// Package handler ports the resolve-grants Appwrite Function to Go. It
// resolves a user's effective permissions and features for an organization
// and application, enforcing the same validation order as the TypeScript
// original.
package handler

import (
	sdk "github.com/appwrite/sdk-for-go/v7/appwrite"
	"github.com/appwrite/sdk-for-go/v7/query"
	"github.com/open-runtimes/types-for-go/v4/openruntimes"

	"openruntimes/handler/internal/appwrite"
	"openruntimes/handler/internal/httpx"
)

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

	organizationID := body.OrganizationID
	applicationID := body.ApplicationID
	if organizationID == "" || applicationID == "" {
		return httpx.BadRequest(ctx, "organizationId and applicationId are required")
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
	roleIDs := make([]string, 0, len(roleRows.Rows))
	for i := range roleRows.Rows {
		data, err := appwrite.RowData(&roleRows.Rows[i])
		if err != nil {
			ctx.Error(err)
			return internalError(ctx)
		}
		if contains(membershipRoles, appwrite.StringField(data, "name")) {
			roleIDs = append(roleIDs, roleRows.Rows[i].Id)
		}
	}

	if len(roleIDs) == 0 {
		ctx.Log("no matching roles", "userId", headerUserID, "organizationId", organizationID)
		return ctx.Res.Json(grantResponse{Permissions: []string{}, Features: []string{}})
	}

	permissionKeys := map[string]struct{}{}
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
		for i := range permissionRows.Rows {
			data, err := appwrite.RowData(&permissionRows.Rows[i])
			if err != nil {
				ctx.Error(err)
				return internalError(ctx)
			}
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
			permissionKeys[appwrite.StringField(permissionData, "key")] = struct{}{}
		}
	}

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
		for i := range applicationRows.Rows {
			data, err := appwrite.RowData(&applicationRows.Rows[i])
			if err != nil {
				ctx.Error(err)
				return internalError(ctx)
			}
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
	for i := range orgFeatureRows.Rows {
		data, err := appwrite.RowData(&orgFeatureRows.Rows[i])
		if err != nil {
			ctx.Error(err)
			return internalError(ctx)
		}
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

	permissions := make([]string, 0, len(permissionKeys))
	for key := range permissionKeys {
		permissions = append(permissions, key)
	}
	features := make([]string, 0, len(featureKeys))
	for key := range featureKeys {
		features = append(features, key)
	}

	ctx.Log(
		"resolved grants",
		"userId", headerUserID,
		"organizationId", organizationID,
		"applicationId", applicationID,
		"permissions", len(permissions),
		"features", len(features),
	)

	return ctx.Res.Json(grantResponse{Permissions: permissions, Features: features})
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
