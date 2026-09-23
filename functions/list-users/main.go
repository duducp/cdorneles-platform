// Package handler implements the list-users Appwrite Function. It lists the
// platform's users (the server users.list endpoint), paging through every
// result so the whole list is returned rather than only the first page.
package handler

import (
	"os"
	"sort"

	sdk "github.com/appwrite/sdk-for-go/v7/appwrite"
	"github.com/appwrite/sdk-for-go/v7/models"
	"github.com/appwrite/sdk-for-go/v7/query"
	"github.com/appwrite/sdk-for-go/v7/tablesdb"
	"github.com/appwrite/sdk-for-go/v7/teams"
	"github.com/appwrite/sdk-for-go/v7/users"
	"github.com/open-runtimes/types-for-go/v4/openruntimes"

	"openruntimes/handler/internal/appwrite"
	"openruntimes/handler/internal/httpx"
)

// pageSize bounds each Appwrite users.list page. Appwrite defaults to 25 rows,
// which would silently truncate the list, so every page is read with an
// explicit limit.
const pageSize = 100

// permissionUsersRead is the platform capability required to list users.
const permissionUsersRead = "users.read"

// listUsersRequest is the empty request body. It exists so the handler still
// rejects malformed JSON before authorizing.
type listUsersRequest struct{}

type listUsersResponse struct {
	Users []userSummary `json:"users"`
}

// userSummary is the subset of an Appwrite user the admin UI needs.
type userSummary struct {
	ID     string   `json:"id"`
	Email  string   `json:"email"`
	Name   string   `json:"name"`
	Labels []string `json:"labels"`
}

// operations is the seam over the Appwrite SDK (teams, tables and users) so
// the handler's validation, authorization and paging are unit-testable without
// an SDK mock.
type operations interface {
	IsPlatformMember(userID string) (bool, error)
	EffectivePermissions(organizationID, userID string) ([]string, error)
	ListUsersPage(offset int) ([]models.User, error)
}

// Main is the function entrypoint.
func Main(ctx openruntimes.Context) openruntimes.Response {
	return handle(ctx, newAppwriteOps(ctx.Req.Headers["x-appwrite-key"]))
}

// handle validates the request, authorizes the caller, then lists every user
// through the injected operations seam.
func handle(ctx openruntimes.Context, ops operations) openruntimes.Response {
	var body listUsersRequest
	if err := ctx.Req.BodyJson(&body); err != nil {
		return httpx.BadRequest(ctx, "invalid JSON")
	}

	callerID := ctx.Req.Headers["x-appwrite-user-id"]
	if callerID == "" {
		return httpx.Unauthorized(ctx, "missing user identity")
	}

	// A member of the platform team (the root) holds every permission. A stale
	// or invalid platform team must not break ordinary traffic, so a failed
	// lookup is treated as "not a platform member" and falls through to the
	// permission resolution below.
	platformMember, err := ops.IsPlatformMember(callerID)
	if err != nil {
		ctx.Log("platform membership lookup failed", "error", err.Error())
		platformMember = false
	}
	if !platformMember {
		// users.read is a platform capability, not an organization role grant,
		// so there is no organization context to resolve against. With an empty
		// organization there is nothing to resolve, so a non-platform caller is
		// denied; the platform-member bypass above is how users.read is granted.
		permissions, err := ops.EffectivePermissions("", callerID)
		if err != nil {
			ctx.Error(err)
			return internalError(ctx)
		}
		if !contains(permissions, permissionUsersRead) {
			return httpx.Forbidden(ctx, "missing permission: "+permissionUsersRead)
		}
	}

	rows, err := pageAllUsers(ops.ListUsersPage)
	if err != nil {
		ctx.Error(err)
		return internalError(ctx)
	}

	summaries := make([]userSummary, 0, len(rows))
	for i := range rows {
		// Labels are a marker only — never authorization. Always return an
		// array so the JSON shape is stable when a user has no labels.
		labels := rows[i].Labels
		if labels == nil {
			labels = []string{}
		}
		summaries = append(summaries, userSummary{
			ID:     rows[i].Id,
			Email:  rows[i].Email,
			Name:   rows[i].Name,
			Labels: labels,
		})
	}

	ctx.Log(map[string]interface{}{
		"action": "users.list",
		"count":  len(summaries),
	})

	return ctx.Res.Json(listUsersResponse{Users: summaries})
}

// appwriteOps is the Appwrite-backed implementation of operations.
type appwriteOps struct {
	users  *users.Users
	teams  *teams.Teams
	tables *tablesdb.TablesDB
	repo   *appwrite.GrantRepo
}

func newAppwriteOps(apiKey string) operations {
	clt := appwrite.NewClient(apiKey)
	return &appwriteOps{
		users:  sdk.NewUsers(clt),
		teams:  sdk.NewTeams(clt),
		tables: appwrite.NewTablesDB(clt),
		repo:   appwrite.NewGrantRepo(clt),
	}
}

// IsPlatformMember reports whether the caller belongs to NEXT_PUBLIC_PLATFORM_TEAM_ID.
func (o *appwriteOps) IsPlatformMember(userID string) (bool, error) {
	teamID := os.Getenv("NEXT_PUBLIC_PLATFORM_TEAM_ID")
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
	// An empty organization means there is no organization context to resolve:
	// list-users calls this with "" for the platform-capability check, where the
	// platform-member bypass is the only grant path. Guarding here avoids asking
	// Appwrite for the memberships of "". The SDK guard is not unit-testable
	// (the operations seam is faked); it is covered by the live smoke test.
	if organizationID == "" {
		return nil, nil
	}

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

// ListUsersPage returns one page of the platform's users at the given offset.
// The handler's pageAllUsers loop calls it with increasing offsets until a
// short page ends the list.
func (o *appwriteOps) ListUsersPage(offset int) ([]models.User, error) {
	result, err := o.users.List(
		o.users.WithListQueries([]string{query.Limit(pageSize), query.Offset(offset)}),
	)
	if err != nil {
		return nil, err
	}
	return result.Users, nil
}

// pageAllUsers calls fetch with increasing offsets until it returns a short
// page, accumulating every user. It is the same paging contract as
// resolve-grants's allKeys and update-user-permissions's pageAll.
func pageAllUsers(fetch func(offset int) ([]models.User, error)) ([]models.User, error) {
	var all []models.User
	for offset := 0; ; offset += pageSize {
		page, err := fetch(offset)
		if err != nil {
			return nil, err
		}
		all = append(all, page...)
		if len(page) < pageSize {
			return all, nil
		}
	}
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
		httpx.Error{Error: "internal_error", Reason: "failed to list users"},
		ctx.Res.WithStatusCode(500),
	)
}
