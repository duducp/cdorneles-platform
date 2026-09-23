// Package handler ports the resolve-grants Appwrite Function to Go. It
// resolves a user's effective permissions and features for an organization
// and application, enforcing the same validation order as the TypeScript
// original.
package handler

import (
	"os"
	"sort"

	sdk "github.com/appwrite/sdk-for-go/v7/appwrite"
	"github.com/appwrite/sdk-for-go/v7/query"
	"github.com/appwrite/sdk-for-go/v7/tablesdb"
	teamsdk "github.com/appwrite/sdk-for-go/v7/teams"
	"github.com/open-runtimes/types-for-go/v4/openruntimes"

	"openruntimes/handler/internal/appwrite"
	"openruntimes/handler/internal/httpx"
)

// pageSize bounds each Appwrite list page. Appwrite defaults to 25 rows, which
// is smaller than the seeded permission set, so every "all rows" read pages.
const pageSize = 100

type grantRequest struct {
	UserID         string `json:"userId"`
	OrganizationID string `json:"organizationId"`
	ApplicationID  string `json:"applicationId"`
}

type grantResponse struct {
	Permissions []string `json:"permissions"`
	Features    []string `json:"features"`
}

// Main is the function entrypoint.
func Main(ctx openruntimes.Context) openruntimes.Response {
	var body grantRequest
	if err := ctx.Req.BodyJson(&body); err != nil {
		return httpx.BadRequest(ctx, "invalid JSON")
	}

	headerUserID := ctx.Req.Headers["x-appwrite-user-id"]
	if headerUserID == "" {
		return httpx.Unauthorized(ctx, "missing user identity")
	}

	if body.UserID == "" || headerUserID != body.UserID {
		return httpx.Forbidden(ctx, "userId mismatch")
	}

	// A member of the platform team is the root and holds every permission and
	// feature, with or without an organization. A stale or invalid platform
	// team must not break ordinary traffic, so a failed lookup is treated as
	// "not a platform member" and the request falls through to the org flow.
	if platformTeamID := os.Getenv("PLATFORM_TEAM_ID"); platformTeamID != "" {
		client := appwrite.NewClient(ctx.Req.Headers["x-appwrite-key"])
		teams := sdk.NewTeams(client)
		member, err := isTeamMember(teams, platformTeamID, headerUserID)
		if err != nil {
			ctx.Log("platform membership lookup failed", "teamId", platformTeamID, "error", err.Error())
		} else if member {
			return platformGrants(ctx, sdk.NewTablesDB(client))
		}
	}

	organizationID := body.OrganizationID
	applicationID := body.ApplicationID
	if organizationID == "" {
		return ctx.Res.Json(grantResponse{Permissions: []string{}, Features: []string{}})
	}
	if applicationID == "" {
		return httpx.BadRequest(ctx, "applicationId is required")
	}

	client := appwrite.NewClient(ctx.Req.Headers["x-appwrite-key"])
	teams := sdk.NewTeams(client)
	tables := sdk.NewTablesDB(client)

	membershipResult, err := teams.ListMemberships(organizationID)
	if err != nil {
		ctx.Error(err)
		return internalError(ctx)
	}
	var membershipRoles []string
	found := false
	for _, membership := range membershipResult.Memberships {
		if membership.UserId == headerUserID {
			membershipRoles = membership.Roles
			found = true
			break
		}
	}
	if !found {
		return httpx.Forbidden(ctx, "not a member of the organization")
	}

	roleRows, err := tables.ListRows(
		appwrite.DatabaseID,
		"roles",
		tables.WithListRowsQueries([]string{query.Equal("organizationId", organizationID)}),
	)
	if err != nil {
		ctx.Error(err)
		return internalError(ctx)
	}
	roleRowsData, err := appwrite.RowsData(roleRows)
	if err != nil {
		ctx.Error(err)
		return internalError(ctx)
	}
	roleIDs := make([]string, 0, len(roleRowsData))
	for i, data := range roleRowsData {
		if contains(membershipRoles, appwrite.StringField(data, "name")) {
			roleIDs = append(roleIDs, roleRows.Rows[i].Id)
		}
	}

	// Known limitation: a user with only direct permissions and no matching
	// role gets no grants. App access itself is role-derived, and the
	// create-user flow always assigns a role, so this is not hit in practice.
	if len(roleIDs) == 0 {
		ctx.Log("no matching roles", "userId", headerUserID, "organizationId", organizationID)
		return ctx.Res.Json(grantResponse{Permissions: []string{}, Features: []string{}})
	}

	var rolePermissionKeys []string
	for _, roleID := range roleIDs {
		permissionRows, err := tables.ListRows(
			appwrite.DatabaseID,
			"role_permissions",
			tables.WithListRowsQueries([]string{query.Equal("roleId", roleID)}),
		)
		if err != nil {
			ctx.Error(err)
			return internalError(ctx)
		}
		permissionRowData, err := appwrite.RowsData(permissionRows)
		if err != nil {
			ctx.Error(err)
			return internalError(ctx)
		}
		for _, data := range permissionRowData {
			permission, err := tables.GetRow(
				appwrite.DatabaseID,
				"permissions",
				appwrite.StringField(data, "permissionId"),
			)
			if err != nil {
				ctx.Error(err)
				return internalError(ctx)
			}
			permissionData, err := appwrite.RowData(permission)
			if err != nil {
				ctx.Error(err)
				return internalError(ctx)
			}
			rolePermissionKeys = append(rolePermissionKeys, appwrite.StringField(permissionData, "key"))
		}
	}

	directPermissionKeys, err := directPermissionKeysForUser(tables, organizationID, headerUserID)
	if err != nil {
		ctx.Error(err)
		return internalError(ctx)
	}
	permissionKeys := collectPermissionKeys(rolePermissionKeys, directPermissionKeys)

	appIDs := map[string]struct{}{}
	for _, roleID := range roleIDs {
		applicationRows, err := tables.ListRows(
			appwrite.DatabaseID,
			"role_applications",
			tables.WithListRowsQueries([]string{query.Equal("roleId", roleID)}),
		)
		if err != nil {
			ctx.Error(err)
			return internalError(ctx)
		}
		applicationRowData, err := appwrite.RowsData(applicationRows)
		if err != nil {
			ctx.Error(err)
			return internalError(ctx)
		}
		for _, data := range applicationRowData {
			application, err := tables.GetRow(
				appwrite.DatabaseID,
				"applications",
				appwrite.StringField(data, "applicationId"),
			)
			if err != nil {
				ctx.Error(err)
				return internalError(ctx)
			}
			applicationData, err := appwrite.RowData(application)
			if err != nil {
				ctx.Error(err)
				return internalError(ctx)
			}
			appIDs[appwrite.StringField(applicationData, "appId")] = struct{}{}
		}
	}

	if _, ok := appIDs[applicationID]; !ok {
		ctx.Log("missing application access", "userId", headerUserID, "applicationId", applicationID)
		return httpx.Forbidden(ctx, "missing application access: "+applicationID)
	}

	featureKeys := map[string]struct{}{}
	orgFeatureRows, err := tables.ListRows(
		appwrite.DatabaseID,
		"organization_features",
		tables.WithListRowsQueries([]string{
			query.Equal("organizationId", organizationID),
			query.Equal("enabled", true),
		}),
	)
	if err != nil {
		ctx.Error(err)
		return internalError(ctx)
	}
	orgFeatureData, err := appwrite.RowsData(orgFeatureRows)
	if err != nil {
		ctx.Error(err)
		return internalError(ctx)
	}
	for _, data := range orgFeatureData {
		feature, err := tables.GetRow(
			appwrite.DatabaseID,
			"features",
			appwrite.StringField(data, "featureId"),
		)
		if err != nil {
			ctx.Error(err)
			return internalError(ctx)
		}
		featureData, err := appwrite.RowData(feature)
		if err != nil {
			ctx.Error(err)
			return internalError(ctx)
		}
		featureKeys[appwrite.StringField(featureData, "key")] = struct{}{}
	}

	features := make([]string, 0, len(featureKeys))
	for key := range featureKeys {
		features = append(features, key)
	}
	sort.Strings(features)

	ctx.Log(
		"resolved grants",
		"userId", headerUserID,
		"organizationId", organizationID,
		"applicationId", applicationID,
		"permissions", len(permissionKeys),
		"features", len(features),
	)

	return ctx.Res.Json(grantResponse{Permissions: permissionKeys, Features: features})
}

// platformGrants returns every permission and feature key for a member of the
// platform team (the root). The table reads go through the Appwrite SDK, which
// this package does not mock, so this path is verified by the live probe.
func platformGrants(ctx openruntimes.Context, tables *tablesdb.TablesDB) openruntimes.Response {
	permissions, err := allKeys(tables, "permissions")
	if err != nil {
		ctx.Error(err)
		return internalError(ctx)
	}
	features, err := allKeys(tables, "features")
	if err != nil {
		ctx.Error(err)
		return internalError(ctx)
	}
	return ctx.Res.Json(grantResponse{Permissions: permissions, Features: features})
}

// isTeamMember reports whether the user belongs to the team, paging through
// every membership so teams larger than one page are handled.
func isTeamMember(teams *teamsdk.Teams, teamID, userID string) (bool, error) {
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

// allKeys returns the key field of every row in a table, paging until the
// table is exhausted.
func allKeys(tables *tablesdb.TablesDB, tableID string) ([]string, error) {
	keys := []string{}
	for offset := 0; ; offset += pageSize {
		result, err := tables.ListRows(
			appwrite.DatabaseID,
			tableID,
			tables.WithListRowsQueries([]string{query.Limit(pageSize), query.Offset(offset)}),
		)
		if err != nil {
			return nil, err
		}
		rowData, err := appwrite.RowsData(result)
		if err != nil {
			return nil, err
		}
		for _, data := range rowData {
			keys = append(keys, appwrite.StringField(data, "key"))
		}
		if len(result.Rows) < pageSize {
			break
		}
	}
	return keys, nil
}

// directPermissionKeysForUser resolves the permission keys granted directly to
// a user within an organization (the Django-style user_permissions table).
// The Appwrite SDK path is not unit-tested (no SDK mock here); verified live.
func directPermissionKeysForUser(tables *tablesdb.TablesDB, organizationID, userID string) ([]string, error) {
	rows, err := tables.ListRows(
		appwrite.DatabaseID,
		"user_permissions",
		tables.WithListRowsQueries([]string{
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
		permission, err := tables.GetRow(
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

func internalError(ctx openruntimes.Context) openruntimes.Response {
	return ctx.Res.Json(
		httpx.Error{Error: "internal_error", Reason: "failed to resolve grants"},
		ctx.Res.WithStatusCode(500),
	)
}

func contains(values []string, target string) bool {
	for _, value := range values {
		if value == target {
			return true
		}
	}
	return false
}
