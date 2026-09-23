// Package handler implements provision-organization: it idempotently
// bootstraps the per-organization rows an organization needs to be usable —
// its profile, its default roles, the role→permission and role→application
// mappings, and its feature flags.
//
// Any authenticated member of the organization may trigger it; every write is
// create-if-missing, so re-running is safe.
package handler

import (
	"github.com/appwrite/sdk-for-go/v7/id"
	"github.com/appwrite/sdk-for-go/v7/query"
	"github.com/appwrite/sdk-for-go/v7/tablesdb"
	"github.com/open-runtimes/types-for-go/v4/openruntimes"

	"openruntimes/handler/internal/appwrite"
	"openruntimes/handler/internal/httpx"
)

type request struct {
	OrganizationID string `json:"organizationId"`
	DisplayName    string `json:"displayName"`
}

type roleDef struct {
	name         string
	description  string
	permissions  []string
	applications []string
}

// allPermissions is a sentinel meaning "every seeded permission".
const allPermissions = ""

var roleDefs = []roleDef{
	{
		name:         "owner",
		description:  "Full control of the organization",
		permissions:  []string{allPermissions},
		applications: []string{"app_admin", "app_client"},
	},
	{
		name:         "admin",
		description:  "Administrative access",
		permissions:  []string{allPermissions},
		applications: []string{"app_admin", "app_client"},
	},
	{
		name:        "member",
		description: "Standard access",
		permissions: []string{
			"perm_organizations_read",
			"perm_customers_read",
			"perm_orders_read",
			"perm_invoices_read",
			"perm_products_read",
			"perm_roles_read",
			"perm_features_read",
			"perm_audit_read",
		},
		applications: []string{"app_client"},
	},
}

// adminExcluded lists permissions the admin role must not receive.
var adminExcluded = map[string]struct{}{
	"perm_features_manage": {},
}

// defaultEnabledFeatures are the features enabled for a new organization.
var defaultEnabledFeatures = map[string]struct{}{
	"feat_white_label": {},
}

var allFeatureIDs = []string{
	"feat_customers", "feat_orders", "feat_invoices", "feat_products",
	"feat_inventory", "feat_financial", "feat_sales", "feat_white_label",
}

func internalError(ctx openruntimes.Context, reason string) openruntimes.Response {
	ctx.Error(reason)
	return ctx.Res.Json(
		httpx.Error{Error: "internal_error", Reason: reason},
		ctx.Res.WithStatusCode(500),
	)
}

// Main is the function entrypoint.
func Main(ctx openruntimes.Context) openruntimes.Response {
	userID := ctx.Req.Headers["x-appwrite-user-id"]
	if userID == "" {
		return httpx.Unauthorized(ctx, "missing user identity")
	}

	var body request
	if err := ctx.Req.BodyJson(&body); err != nil {
		return httpx.BadRequest(ctx, "invalid JSON")
	}
	if body.OrganizationID == "" {
		return httpx.BadRequest(ctx, "organizationId is required")
	}

	// The per-execution API key reaches the runtime as the `x-appwrite-key`
	// request header (open-runtimes v5); it is not injected as an env var.
	client := appwrite.NewClient(ctx.Req.Headers["x-appwrite-key"])
	repo := appwrite.NewGrantRepo(client)

	memberships, err := repo.ListMemberships(body.OrganizationID)
	if err != nil {
		return internalError(ctx, "could not list memberships")
	}
	member := false
	for _, membership := range memberships {
		if membership.UserID == userID {
			member = true
			break
		}
	}
	if !member {
		return httpx.Forbidden(ctx, "not a member of the organization")
	}

	tables := appwrite.NewTablesDB(client)

	if err := ensureProfile(ctx, tables, body.OrganizationID, body.DisplayName); err != nil {
		return internalError(ctx, "could not provision organization profile")
	}
	for _, def := range roleDefs {
		if err := ensureRole(ctx, tables, body.OrganizationID, def); err != nil {
			return internalError(ctx, "could not provision roles")
		}
	}
	if err := ensureFeatures(ctx, tables, body.OrganizationID); err != nil {
		return internalError(ctx, "could not provision features")
	}

	ctx.Log("provisioned organization " + body.OrganizationID + " for user " + userID)

	return ctx.Res.Json(map[string]interface{}{"ok": true})
}

// ensureProfile creates the organization profile row when it is missing.
func ensureProfile(
	ctx openruntimes.Context,
	tables *tablesdb.TablesDB,
	organizationID, displayName string,
) error {
	existing, err := appwrite.FindOne(
		tables, "organization_profiles", query.Equal("organizationId", organizationID),
	)
	if err != nil {
		return err
	}
	if existing != nil {
		return nil
	}
	if displayName == "" {
		displayName = "Organization"
	}
	_, err = appwrite.CreateRow(tables, "organization_profiles", id.Unique(), map[string]interface{}{
		"organizationId": organizationID,
		"displayName":    displayName,
		"active":         true,
	})
	return err
}

// ensureRole creates the role row and seeds its permission and application
// mappings when they are missing. Mappings are only seeded when the role has
// none, so partial manual edits are never overwritten.
func ensureRole(
	ctx openruntimes.Context,
	tables *tablesdb.TablesDB,
	organizationID string,
	def roleDef,
) error {
	row, err := appwrite.FindOne(
		tables, "roles",
		query.Equal("organizationId", organizationID),
		query.Equal("name", def.name),
	)
	if err != nil {
		return err
	}

	roleID := ""
	if row != nil {
		roleID = appwrite.StringField(row, "$id")
	} else {
		if _, err := appwrite.CreateRow(tables, "roles", id.Unique(), map[string]interface{}{
			"organizationId": organizationID,
			"name":           def.name,
			"description":    def.description,
		}); err != nil {
			return err
		}
		// Re-read to obtain the generated row ID.
		row, err = appwrite.FindOne(
			tables, "roles",
			query.Equal("organizationId", organizationID),
			query.Equal("name", def.name),
		)
		if err != nil {
			return err
		}
		if row == nil {
			return nil
		}
		roleID = appwrite.StringField(row, "$id")
	}

	existingPerms, err := appwrite.FindOne(
		tables, "role_permissions", query.Equal("roleId", roleID),
	)
	if err != nil {
		return err
	}
	if existingPerms == nil {
		permissions := def.permissions
		if len(permissions) == 1 && permissions[0] == allPermissions {
			permissions = allPermissionIDs()
		}
		for _, permissionID := range permissions {
			if def.name == "admin" {
				if _, excluded := adminExcluded[permissionID]; excluded {
					continue
				}
			}
			if _, err := appwrite.CreateRow(tables, "role_permissions", id.Unique(), map[string]interface{}{
				"roleId":       roleID,
				"permissionId": permissionID,
			}); err != nil {
				return err
			}
		}
	}

	existingApps, err := appwrite.FindOne(
		tables, "role_applications", query.Equal("roleId", roleID),
	)
	if err != nil {
		return err
	}
	if existingApps == nil {
		for _, applicationID := range def.applications {
			if _, err := appwrite.CreateRow(tables, "role_applications", id.Unique(), map[string]interface{}{
				"roleId":        roleID,
				"applicationId": applicationID,
			}); err != nil {
				return err
			}
		}
	}

	return nil
}

// allPermissionIDs returns every seeded permission row ID.
func allPermissionIDs() []string {
	return []string{
		"perm_organizations_read", "perm_organizations_update",
		"perm_customers_read", "perm_customers_create", "perm_customers_update", "perm_customers_delete",
		"perm_orders_read", "perm_orders_create", "perm_orders_update", "perm_orders_delete",
		"perm_invoices_read", "perm_invoices_create", "perm_invoices_approve",
		"perm_products_read", "perm_products_create", "perm_products_update", "perm_products_delete",
		"perm_roles_read", "perm_roles_create", "perm_roles_update", "perm_roles_delete",
		"perm_features_read", "perm_features_manage",
		"perm_audit_read",
	}
}

// ensureFeatures creates the organization's feature rows, enabling only the
// default-enabled set.
func ensureFeatures(
	ctx openruntimes.Context,
	tables *tablesdb.TablesDB,
	organizationID string,
) error {
	for _, featureID := range allFeatureIDs {
		existing, err := appwrite.FindOne(
			tables, "organization_features",
			query.Equal("organizationId", organizationID),
			query.Equal("featureId", featureID),
		)
		if err != nil {
			return err
		}
		if existing != nil {
			continue
		}
		_, enabled := defaultEnabledFeatures[featureID]
		if _, err := appwrite.CreateRow(tables, "organization_features", id.Unique(), map[string]interface{}{
			"organizationId": organizationID,
			"featureId":      featureID,
			"enabled":        enabled,
		}); err != nil {
			return err
		}
	}
	return nil
}
