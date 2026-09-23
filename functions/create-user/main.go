// Package handler implements the create-user Appwrite Function. It creates a
// platform user, adds them to an organization with a role, grants optional
// direct permissions, and emails a temporary password.
package handler

import (
	"crypto/rand"
	"encoding/base64"
	"os"
	"sort"

	sdk "github.com/appwrite/sdk-for-go/v7/appwrite"
	"github.com/appwrite/sdk-for-go/v7/id"
	"github.com/appwrite/sdk-for-go/v7/messaging"
	"github.com/appwrite/sdk-for-go/v7/query"
	"github.com/appwrite/sdk-for-go/v7/tablesdb"
	"github.com/appwrite/sdk-for-go/v7/teams"
	"github.com/appwrite/sdk-for-go/v7/users"
	"github.com/open-runtimes/types-for-go/v4/openruntimes"

	"openruntimes/handler/internal/appwrite"
	"openruntimes/handler/internal/email"
	"openruntimes/handler/internal/httpx"
)

// pageSize bounds each Appwrite list page when paging team memberships.
const pageSize = 100

// Platform capabilities required to create a user.
const (
	permissionUsersCreate            = "users.create"
	permissionUsersManagePermissions = "users.manage_permissions"
)

type createUserRequest struct {
	// UserID is an optional caller-identity echo. When present it must match
	// the authenticated identity (defense in depth, mirroring resolve-grants).
	UserID         string   `json:"userId"`
	Email          string   `json:"email"`
	Name           string   `json:"name"`
	OrganizationID string   `json:"organizationId"`
	Role           string   `json:"role"`
	Permissions    []string `json:"permissions"`
	Labels         []string `json:"labels"`
}

type createUserResponse struct {
	UserID string `json:"userId"`
}

// operations is the seam over the Appwrite SDK (users, teams, tables and
// messaging) so the handler's validation, authorization and orchestration are
// unit-testable without an SDK mock.
type operations interface {
	IsPlatformMember(userID string) (bool, error)
	EffectivePermissions(organizationID, userID string) ([]string, error)
	RoleExists(organizationID, role string) (bool, error)
	CreateUser(email, password, name string) (string, error)
	SetLabels(userID string, labels []string) error
	AddMembership(teamID string, roles []string, email string) error
	PermissionIDForKey(key string) (string, error)
	CreateUserPermission(userID, organizationID, permissionID, grantedBy string) error
	SendWelcomeEmail(userID, name, password string) error
}

// Main is the function entrypoint.
func Main(ctx openruntimes.Context) openruntimes.Response {
	return handle(ctx, newAppwriteOps(ctx.Req.Headers["x-appwrite-key"]))
}

// handle validates the request, authorizes the caller, then orchestrates the
// Appwrite writes through the injected operations seam.
func handle(ctx openruntimes.Context, ops operations) openruntimes.Response {
	var body createUserRequest
	if err := ctx.Req.BodyJson(&body); err != nil {
		return httpx.BadRequest(ctx, "invalid JSON")
	}

	callerID := ctx.Req.Headers["x-appwrite-user-id"]
	if callerID == "" {
		return httpx.Unauthorized(ctx, "missing user identity")
	}
	if body.UserID != "" && body.UserID != callerID {
		return httpx.Forbidden(ctx, "userId mismatch")
	}
	if body.Email == "" || body.Name == "" || body.OrganizationID == "" || body.Role == "" {
		return httpx.BadRequest(ctx, "email, name, organizationId and role are required")
	}

	// The role must be one of the target organization's roles, so a typo or a
	// foreign role cannot silently create a member with no grants.
	roleExists, err := ops.RoleExists(body.OrganizationID, body.Role)
	if err != nil {
		ctx.Error(err)
		return internalError(ctx)
	}
	if !roleExists {
		return httpx.BadRequest(ctx, "unknown role: "+body.Role)
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
		if !contains(permissions, permissionUsersCreate) {
			return httpx.Forbidden(ctx, "missing permission: "+permissionUsersCreate)
		}
		if len(body.Permissions) > 0 {
			if !contains(permissions, permissionUsersManagePermissions) {
				return httpx.Forbidden(ctx, "missing permission: "+permissionUsersManagePermissions)
			}
			// A caller can only grant permissions they themselves hold: direct
			// grants are additive, and this blocks privilege escalation.
			for _, key := range body.Permissions {
				if !contains(permissions, key) {
					return httpx.Forbidden(ctx, "cannot grant permission: "+key)
				}
			}
		}
	}

	password, err := generatePassword()
	if err != nil {
		ctx.Error(err)
		return internalError(ctx)
	}

	userID, err := ops.CreateUser(body.Email, password, body.Name)
	if err != nil {
		ctx.Error(err)
		return internalError(ctx)
	}

	// Labels are a marker only — never authorization. Pass them through.
	if len(body.Labels) > 0 {
		if err := ops.SetLabels(userID, body.Labels); err != nil {
			ctx.Error(err)
			return internalError(ctx)
		}
	}

	if err := ops.AddMembership(body.OrganizationID, []string{body.Role}, body.Email); err != nil {
		ctx.Error(err)
		return internalError(ctx)
	}

	for _, key := range body.Permissions {
		permissionID, err := ops.PermissionIDForKey(key)
		if err != nil {
			ctx.Error(err)
			return internalError(ctx)
		}
		if permissionID == "" {
			return httpx.BadRequest(ctx, "unknown permission: "+key)
		}
		if err := ops.CreateUserPermission(userID, body.OrganizationID, permissionID, callerID); err != nil {
			ctx.Error(err)
			return internalError(ctx)
		}
	}

	// The user already exists, so a failed welcome email must not fail the
	// request (a retry would collide). Log it for follow-up instead.
	if err := ops.SendWelcomeEmail(userID, body.Name, password); err != nil {
		ctx.Log("welcome email failed", "error", err.Error())
	}

	ctx.Log(map[string]interface{}{
		"action":            "users.create",
		"userId":            userID,
		"organizationId":    body.OrganizationID,
		"role":              body.Role,
		"grantedBy":         callerID,
		"directPermissions": len(body.Permissions),
	})

	return ctx.Res.Json(createUserResponse{UserID: userID})
}

// appwriteOps is the Appwrite-backed implementation of operations.
type appwriteOps struct {
	users     *users.Users
	teams     *teams.Teams
	tables    *tablesdb.TablesDB
	messaging *messaging.Messaging
	repo      *appwrite.GrantRepo
}

func newAppwriteOps(apiKey string) operations {
	clt := appwrite.NewClient(apiKey)
	return &appwriteOps{
		users:     sdk.NewUsers(clt),
		teams:     sdk.NewTeams(clt),
		tables:    sdk.NewTablesDB(clt),
		messaging: sdk.NewMessaging(clt),
		repo:      appwrite.NewGrantRepo(clt),
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

// directPermissionKeys resolves the permission keys granted directly to a user
// within an organization (the Django-style user_permissions table).
func (o *appwriteOps) directPermissionKeys(organizationID, userID string) ([]string, error) {
	rows, err := o.tables.ListRows(
		appwrite.DatabaseID,
		"user_permissions",
		o.tables.WithListRowsQueries([]string{
			query.Equal("organizationId", organizationID),
			query.Equal("userId", userID),
		}),
	)
	if err != nil {
		return nil, err
	}
	rowData, err := appwrite.RowsData(rows)
	if err != nil {
		return nil, err
	}
	keys := make([]string, 0, len(rowData))
	for _, data := range rowData {
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

// CreateUser creates the Appwrite user with a temporary password and returns
// its generated id.
func (o *appwriteOps) CreateUser(email, password, name string) (string, error) {
	user, err := o.users.Create(
		id.Unique(),
		o.users.WithCreateEmail(email),
		o.users.WithCreatePassword(password),
		o.users.WithCreateName(name),
	)
	if err != nil {
		return "", err
	}
	return user.Id, nil
}

// SetLabels applies the labels to the user. Labels are markers only.
func (o *appwriteOps) SetLabels(userID string, labels []string) error {
	_, err := o.users.UpdateLabels(userID, labels)
	return err
}

// AddMembership adds the user to the organization team with the given roles.
func (o *appwriteOps) AddMembership(teamID string, roles []string, email string) error {
	_, err := o.teams.CreateMembership(
		teamID,
		roles,
		o.teams.WithCreateMembershipEmail(email),
	)
	return err
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
	return appwrite.StringField(row, "$id"), nil
}

// RoleExists reports whether the role name is one of the organization's roles.
func (o *appwriteOps) RoleExists(organizationID, role string) (bool, error) {
	row, err := appwrite.FindOne(
		o.tables,
		"roles",
		query.Equal("organizationId", organizationID),
		query.Equal("name", role),
	)
	if err != nil {
		return false, err
	}
	return row != nil, nil
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

// SendWelcomeEmail sends the temporary-password welcome email through Appwrite
// Messaging, targeting the newly created user (whose email Appwrite registers
// as a target). The content is Brazilian Portuguese HTML rendered with the
// shared email package, which mirrors the Appwrite default email theme (card,
// Inter typography, light/dark support, dark action button). The login URL
// comes from WELCOME_LOGIN_URL when configured; without it the email carries
// only the temporary password. Delivery is asynchronous: CreateEmail only
// queues the message, so a provider failure is not observable here — only the
// synchronous error is returned.
//
// The password is interpolated unescaped: generatePassword emits base64
// raw-URL characters (A-Z a-z 0-9 - _), which contain no HTML metacharacters.
func (o *appwriteOps) SendWelcomeEmail(userID, name, password string) error {
	htmlBody := email.Welcome(name, password, os.Getenv("WELCOME_LOGIN_URL"))
	_, err := o.messaging.CreateEmail(
		id.Unique(),
		"Sua conta foi criada",
		htmlBody,
		o.messaging.WithCreateEmailUsers([]string{userID}),
		o.messaging.WithCreateEmailHtml(true),
	)
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

// generatePassword returns a strong random temporary password (24 URL-safe
// characters, well above Appwrite's 8-character minimum).
func generatePassword() (string, error) {
	buffer := make([]byte, 18)
	if _, err := rand.Read(buffer); err != nil {
		return "", err
	}
	return base64.RawURLEncoding.EncodeToString(buffer), nil
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
		httpx.Error{Error: "internal_error", Reason: "failed to create user"},
		ctx.Res.WithStatusCode(500),
	)
}
