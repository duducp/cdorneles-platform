// Package handler implements the update-user-permissions Appwrite Function. It
// reconciles a user's direct permissions (the Django-style user_permissions
// table) within an organization: it revokes the rows no longer requested and
// grants the ones that are missing, leaving an unchanged set untouched.
package handler

import (
	"os"
	"sort"

	sdk "github.com/appwrite/sdk-for-go/v7/appwrite"
	"github.com/appwrite/sdk-for-go/v7/id"
	"github.com/appwrite/sdk-for-go/v7/models"
	"github.com/appwrite/sdk-for-go/v7/query"
	"github.com/appwrite/sdk-for-go/v7/tablesdb"
	"github.com/appwrite/sdk-for-go/v7/teams"
	"github.com/open-runtimes/types-for-go/v4/openruntimes"

	"openruntimes/handler/internal/appwrite"
	"openruntimes/handler/internal/httpx"
)

// pageSize bounds each Appwrite list page when paging team memberships.
const pageSize = 100

// permissionUsersManagePermissions is the platform capability required to grant
// or revoke a user's direct permissions.
const permissionUsersManagePermissions = "users.manage_permissions"

type updateUserPermissionsRequest struct {
	// UserID is the target user whose direct permissions are reconciled. The
	// caller is identified separately by the x-appwrite-user-id header.
	UserID         string   `json:"userId"`
	OrganizationID string   `json:"organizationId"`
	Permissions    []string `json:"permissions"`
}

type updateUserPermissionsResponse struct{}

// userPermission is one existing user_permissions row: its row id (needed to
// delete it) and the permission it grants.
type userPermission struct {
	RowID        string
	PermissionID string
}

// operations is the seam over the Appwrite SDK (teams and tables) so the
// handler's validation, authorization and reconciliation are unit-testable
// without an SDK mock.
type operations interface {
	IsPlatformMember(userID string) (bool, error)
	EffectivePermissions(organizationID, userID string) ([]string, error)
	PermissionIDForKey(key string) (string, error)
	ListUserPermissions(userID, organizationID string) ([]userPermission, error)
	CreateUserPermission(userID, organizationID, permissionID, grantedBy string) error
	DeleteUserPermission(rowID string) error
}

// Main is the function entrypoint.
func Main(ctx openruntimes.Context) openruntimes.Response {
	return handle(ctx, newAppwriteOps(ctx.Req.Headers["x-appwrite-key"]))
}

// handle validates the request, authorizes the caller, then reconciles the
// target user's direct permissions through the injected operations seam.
func handle(ctx openruntimes.Context, ops operations) openruntimes.Response {
	var body updateUserPermissionsRequest
	if err := ctx.Req.BodyJson(&body); err != nil {
		return httpx.BadRequest(ctx, "invalid JSON")
	}

	callerID := ctx.Req.Headers["x-appwrite-user-id"]
	if callerID == "" {
		return httpx.Unauthorized(ctx, "missing user identity")
	}
	if body.UserID == "" || body.OrganizationID == "" {
		return httpx.BadRequest(ctx, "userId and organizationId are required")
	}

	// A member of the platform team (the root) holds every permission. A stale
	// or invalid platform team must not break ordinary traffic, so a failed
	// lookup is treated as "not a platform member" and falls through to the
	// organization permission resolution.
	platformMember, err := ops.IsPlatformMember(callerID)
	if err != nil {
		ctx.Log("platform membership lookup failed", "error", err.Error())
		platformMember = false
	}
	if !platformMember {
		permissions, err := ops.EffectivePermissions(body.OrganizationID, callerID)
		if err != nil {
			ctx.Error(err)
			return internalError(ctx)
		}
		if !contains(permissions, permissionUsersManagePermissions) {
			return httpx.Forbidden(ctx, "missing permission: "+permissionUsersManagePermissions)
		}
		// A caller can only grant permissions they themselves hold: direct
		// grants are additive, and this blocks privilege escalation.
		//
		// This constraint is deliberately asymmetric — it guards grants, not
		// revokes. A caller holding users.manage_permissions may remove a direct
		// grant they do not themselves hold (the additive model has no deny, and
		// the capability already authorizes managing the target's permissions).
		for _, key := range body.Permissions {
			if !contains(permissions, key) {
				return httpx.Forbidden(ctx, "cannot grant permission: "+key)
			}
		}
	}

	// Resolve the requested keys to permission ids. An unknown key is a client
	// error, not an internal failure.
	requested := make(map[string]struct{}, len(body.Permissions))
	for _, key := range body.Permissions {
		permissionID, err := ops.PermissionIDForKey(key)
		if err != nil {
			ctx.Error(err)
			return internalError(ctx)
		}
		if permissionID == "" {
			return httpx.BadRequest(ctx, "unknown permission: "+key)
		}
		requested[permissionID] = struct{}{}
	}

	existing, err := ops.ListUserPermissions(body.UserID, body.OrganizationID)
	if err != nil {
		ctx.Error(err)
		return internalError(ctx)
	}

	// Revoke the direct permissions that are no longer requested. Rows whose
	// permission is still requested are remembered so the grant pass below does
	// not duplicate them — an unchanged set is a no-op.
	kept := make(map[string]struct{}, len(existing))
	revoked := 0
	for _, row := range existing {
		if _, ok := requested[row.PermissionID]; ok {
			kept[row.PermissionID] = struct{}{}
			continue
		}
		if err := ops.DeleteUserPermission(row.RowID); err != nil {
			ctx.Error(err)
			return internalError(ctx)
		}
		revoked++
	}

	// Grant the requested permissions that are missing.
	granted := 0
	for permissionID := range requested {
		if _, ok := kept[permissionID]; ok {
			continue
		}
		if err := ops.CreateUserPermission(body.UserID, body.OrganizationID, permissionID, callerID); err != nil {
			ctx.Error(err)
			return internalError(ctx)
		}
		granted++
	}

	ctx.Log(map[string]interface{}{
		"action":         "users.update_permissions",
		"userId":         body.UserID,
		"organizationId": body.OrganizationID,
		"grantedBy":      callerID,
		"granted":        granted,
		"revoked":        revoked,
	})

	return ctx.Res.Json(updateUserPermissionsResponse{})
}

// appwriteOps is the Appwrite-backed implementation of operations.
type appwriteOps struct {
	teams  *teams.Teams
	tables *tablesdb.TablesDB
	repo   *appwrite.GrantRepo
}

func newAppwriteOps(apiKey string) operations {
	clt := appwrite.NewClient(apiKey)
	return &appwriteOps{
		teams:  sdk.NewTeams(clt),
		tables: appwrite.NewTablesDB(clt),
		repo:   appwrite.NewGrantRepo(clt),
	}
}

// IsPlatformMember reports whether the caller belongs to PLATFORM_TEAM_ID.
func (o *appwriteOps) IsPlatformMember(userID string) (bool, error) {
	teamID := os.Getenv("PLATFORM_TEAM_ID")
	if teamID == "" {
		return false, nil
	}
	return isTeamMember(o.teams, teamID, userID)
}

// EffectivePermissions resolves the caller's effective permission keys in an
// organization: the union of their role permissions and their direct
// user_permissions, the same model resolve-grants returns. A caller who is not
// a member gets an empty set, which denies by default.
func (o *appwriteOps) EffectivePermissions(organizationID, userID string) ([]string, error) {
	memberships, err := o.repo.ListMemberships(organizationID)
	if err != nil {
		return nil, err
	}
	var roles []string
	for _, membership := range memberships {
		if membership.UserID == userID {
			roles = membership.Roles
			break
		}
	}
	if len(roles) == 0 {
		return nil, nil
	}

	orgRoles, err := o.repo.ListOrganizationRoles(organizationID)
	if err != nil {
		return nil, err
	}
	var roleIDs []string
	for _, role := range orgRoles {
		if contains(roles, role.Name) {
			roleIDs = append(roleIDs, role.ID)
		}
	}

	roleKeys, err := o.repo.ListPermissionKeysForRoles(roleIDs)
	if err != nil {
		return nil, err
	}
	directKeys, err := o.directPermissionKeys(organizationID, userID)
	if err != nil {
		return nil, err
	}
	return collectPermissionKeys(roleKeys, directKeys), nil
}

// listUserPermissionRows reads every user_permissions row for (organizationID,
// userID), paging so a user with more direct permissions than one Appwrite page
// (25 by default) is fully seen. Without this, a permission on a later page
// would never be revoked.
func (o *appwriteOps) listUserPermissionRows(organizationID, userID string) ([]models.Row, error) {
	return pageAll(func(offset int) ([]models.Row, error) {
		result, err := o.tables.ListRows(
			appwrite.DatabaseID,
			"user_permissions",
			o.tables.WithListRowsQueries([]string{
				query.Limit(pageSize),
				query.Offset(offset),
				query.Equal("organizationId", organizationID),
				query.Equal("userId", userID),
			}),
		)
		if err != nil {
			return nil, err
		}
		return result.Rows, nil
	})
}

// pageAll calls fetch with increasing offsets until it returns a short page,
// accumulating every row. It is the same paging contract as resolve-grants's
// allKeys, factored out so the loop itself is unit-testable.
func pageAll(fetch func(offset int) ([]models.Row, error)) ([]models.Row, error) {
	var rows []models.Row
	for offset := 0; ; offset += pageSize {
		page, err := fetch(offset)
		if err != nil {
			return nil, err
		}
		rows = append(rows, page...)
		if len(page) < pageSize {
			return rows, nil
		}
	}
}

// directPermissionKeys resolves the permission keys granted directly to a user
// within an organization (the Django-style user_permissions table).
func (o *appwriteOps) directPermissionKeys(organizationID, userID string) ([]string, error) {
	rows, err := o.listUserPermissionRows(organizationID, userID)
	if err != nil {
		return nil, err
	}
	keys := make([]string, 0, len(rows))
	for i := range rows {
		data, err := appwrite.RowData(&rows[i])
		if err != nil {
			return nil, err
		}
		permission, err := o.tables.GetRow(
			appwrite.DatabaseID,
			"permissions",
			appwrite.StringField(data, "permissionId"),
		)
		if err != nil {
			return nil, err
		}
		permissionData, err := appwrite.RowData(permission)
		if err != nil {
			return nil, err
		}
		keys = append(keys, appwrite.StringField(permissionData, "key"))
	}
	return keys, nil
}

// PermissionIDForKey resolves a permission key (e.g. "products.read") to its
// permissions row id (e.g. "perm_products_read"). An empty string means the
// key is not seeded.
func (o *appwriteOps) PermissionIDForKey(key string) (string, error) {
	row, err := appwrite.FindOne(o.tables, "permissions", query.Equal("key", key))
	if err != nil {
		return "", err
	}
	if row == nil {
		return "", nil
	}
	return row.Id, nil
}

// ListUserPermissions returns the target user's existing direct permission rows
// within an organization, with the row id needed to delete each one. Every page
// is read so a permission beyond the first page is still reconciled.
func (o *appwriteOps) ListUserPermissions(userID, organizationID string) ([]userPermission, error) {
	rows, err := o.listUserPermissionRows(organizationID, userID)
	if err != nil {
		return nil, err
	}
	existing := make([]userPermission, 0, len(rows))
	for i := range rows {
		data, err := appwrite.RowData(&rows[i])
		if err != nil {
			return nil, err
		}
		existing = append(existing, userPermission{
			RowID:        rows[i].Id,
			PermissionID: appwrite.StringField(data, "permissionId"),
		})
	}
	return existing, nil
}

// CreateUserPermission writes one direct user_permissions row.
func (o *appwriteOps) CreateUserPermission(userID, organizationID, permissionID, grantedBy string) error {
	_, err := appwrite.CreateRow(o.tables, "user_permissions", id.Unique(), map[string]interface{}{
		"userId":         userID,
		"organizationId": organizationID,
		"permissionId":   permissionID,
		"grantedBy":      grantedBy,
	})
	return err
}

// DeleteUserPermission removes one direct user_permissions row by its row id.
func (o *appwriteOps) DeleteUserPermission(rowID string) error {
	_, err := o.tables.DeleteRow(appwrite.DatabaseID, "user_permissions", rowID)
	return err
}

// isTeamMember reports whether the user belongs to the team, paging through
// every membership so teams larger than one page are handled.
func isTeamMember(teams *teams.Teams, teamID, userID string) (bool, error) {
	for offset := 0; ; offset += pageSize {
		result, err := teams.ListMemberships(
			teamID,
			teams.WithListMembershipsQueries([]string{query.Limit(pageSize), query.Offset(offset)}),
		)
		if err != nil {
			return false, err
		}
		for _, membership := range result.Memberships {
			if membership.UserId == userID {
				return true, nil
			}
		}
		if len(result.Memberships) < pageSize {
			return false, nil
		}
	}
}

// collectPermissionKeys returns the deduplicated union of role and direct
// permission keys, sorted for deterministic output.
func collectPermissionKeys(roleKeys, directKeys []string) []string {
	seen := make(map[string]struct{}, len(roleKeys)+len(directKeys))
	for _, key := range roleKeys {
		seen[key] = struct{}{}
	}
	for _, key := range directKeys {
		seen[key] = struct{}{}
	}
	keys := make([]string, 0, len(seen))
	for key := range seen {
		keys = append(keys, key)
	}
	sort.Strings(keys)
	return keys
}

func contains(values []string, target string) bool {
	for _, value := range values {
		if value == target {
			return true
		}
	}
	return false
}

func internalError(ctx openruntimes.Context) openruntimes.Response {
	return ctx.Res.Json(
		httpx.Error{Error: "internal_error", Reason: "failed to update user permissions"},
		ctx.Res.WithStatusCode(500),
	)
}
