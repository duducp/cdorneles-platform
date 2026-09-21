// Package appwrite adapts the Appwrite Go SDK to the contracts the
// functions need (authz.GrantRepo plus shared table helpers).
package appwrite

import (
	"errors"
	"os"

	sdk "github.com/appwrite/sdk-for-go/v7/appwrite"
	"github.com/appwrite/sdk-for-go/v7/client"
	"github.com/appwrite/sdk-for-go/v7/models"
	"github.com/appwrite/sdk-for-go/v7/query"
	"github.com/appwrite/sdk-for-go/v7/tablesdb"
	"github.com/appwrite/sdk-for-go/v7/teams"

	"openruntimes/handler/internal/authz"
)

// DatabaseID is the platform's TablesDB database.
const DatabaseID = "cdorneles_platform"

// NewTablesDB builds a TablesDB service from a client.
func NewTablesDB(clt client.Client) *tablesdb.TablesDB {
	return sdk.NewTablesDB(clt)
}

// FindOne returns the first row matching the given queries, or nil when no
// row matches.
func FindOne(tables *tablesdb.TablesDB, tableID string, queries ...string) (*models.Row, error) {
	result, err := tables.ListRows(
		DatabaseID,
		tableID,
		tables.WithListRowsQueries(queries),
	)
	if err != nil {
		return nil, err
	}
	if len(result.Rows) == 0 {
		return nil, nil
	}
	return &result.Rows[0], nil
}

// CreateRow creates a row. It returns false when the row already exists
// (HTTP 409), which makes bootstrap operations idempotent.
func CreateRow(
	tables *tablesdb.TablesDB,
	tableID string,
	rowID string,
	data map[string]interface{},
) (bool, error) {
	_, err := tables.CreateRow(DatabaseID, tableID, rowID, data)
	if err != nil {
		if IsConflict(err) {
			return false, nil
		}
		return false, err
	}
	return true, nil
}

// IsConflict reports whether the error is an Appwrite 409.
func IsConflict(err error) bool {
	var apiErr *client.AppwriteError
	if errors.As(err, &apiErr) {
		return apiErr.GetStatusCode() == 409
	}
	return false
}

// NewClient builds an Appwrite client using the runtime's environment and
// the per-execution API key header.
func NewClient(apiKey string) client.Client {
	return sdk.NewClient(
		sdk.WithEndpoint(os.Getenv("APPWRITE_FUNCTION_API_ENDPOINT")),
		sdk.WithProject(os.Getenv("APPWRITE_FUNCTION_PROJECT_ID")),
		sdk.WithKey(apiKey),
	)
}

// RowData decodes a row's data payload into a map.
func RowData(row *models.Row) (map[string]interface{}, error) {
	data := map[string]interface{}{}
	if err := row.Decode(&data); err != nil {
		return nil, err
	}
	return data, nil
}

// StringField reads a string field from a decoded row.
func StringField(data map[string]interface{}, key string) string {
	if value, ok := data[key].(string); ok {
		return value
	}
	return ""
}

// GrantRepo is the Appwrite-backed authz.GrantRepo implementation.
type GrantRepo struct {
	client client.Client
	tables *tablesdb.TablesDB
	teams  *teams.Teams
}

// NewGrantRepo builds a GrantRepo from a client.
func NewGrantRepo(clt client.Client) *GrantRepo {
	return &GrantRepo{
		client: clt,
		tables: sdk.NewTablesDB(clt),
		teams:  sdk.NewTeams(clt),
	}
}

// ListMemberships returns the members of an organization (Appwrite Team).
func (r *GrantRepo) ListMemberships(teamID string) ([]authz.Membership, error) {
	result, err := r.teams.ListMemberships(teamID)
	if err != nil {
		return nil, err
	}
	memberships := make([]authz.Membership, 0, len(result.Memberships))
	for _, membership := range result.Memberships {
		memberships = append(memberships, authz.Membership{
			UserID: membership.UserId,
			Roles:  membership.Roles,
		})
	}
	return memberships, nil
}

// ListOrganizationRoles returns the organization's role definitions.
func (r *GrantRepo) ListOrganizationRoles(organizationID string) ([]authz.Role, error) {
	result, err := r.tables.ListRows(
		DatabaseID,
		"roles",
		r.tables.WithListRowsQueries([]string{query.Equal("organizationId", organizationID)}),
	)
	if err != nil {
		return nil, err
	}
	roles := make([]authz.Role, 0, len(result.Rows))
	for i := range result.Rows {
		data, err := RowData(&result.Rows[i])
		if err != nil {
			return nil, err
		}
		roles = append(roles, authz.Role{
			ID:   result.Rows[i].Id,
			Name: StringField(data, "name"),
		})
	}
	return roles, nil
}

// ListPermissionKeysForRoles resolves the permission keys granted by the
// given roles.
func (r *GrantRepo) ListPermissionKeysForRoles(roleIDs []string) ([]string, error) {
	keys := map[string]struct{}{}
	for _, roleID := range roleIDs {
		result, err := r.tables.ListRows(
			DatabaseID,
			"role_permissions",
			r.tables.WithListRowsQueries([]string{query.Equal("roleId", roleID)}),
		)
		if err != nil {
			return nil, err
		}
		for i := range result.Rows {
			data, err := RowData(&result.Rows[i])
			if err != nil {
				return nil, err
			}
			permission, err := r.tables.GetRow(
				DatabaseID,
				"permissions",
				StringField(data, "permissionId"),
			)
			if err != nil {
				return nil, err
			}
			permissionData, err := RowData(permission)
			if err != nil {
				return nil, err
			}
			keys[StringField(permissionData, "key")] = struct{}{}
		}
	}
	out := make([]string, 0, len(keys))
	for key := range keys {
		out = append(out, key)
	}
	return out, nil
}

// ListApplicationIDsForRoles resolves the application IDs granted by the
// given roles.
func (r *GrantRepo) ListApplicationIDsForRoles(roleIDs []string) ([]string, error) {
	ids := map[string]struct{}{}
	for _, roleID := range roleIDs {
		result, err := r.tables.ListRows(
			DatabaseID,
			"role_applications",
			r.tables.WithListRowsQueries([]string{query.Equal("roleId", roleID)}),
		)
		if err != nil {
			return nil, err
		}
		for i := range result.Rows {
			data, err := RowData(&result.Rows[i])
			if err != nil {
				return nil, err
			}
			application, err := r.tables.GetRow(
				DatabaseID,
				"applications",
				StringField(data, "applicationId"),
			)
			if err != nil {
				return nil, err
			}
			applicationData, err := RowData(application)
			if err != nil {
				return nil, err
			}
			ids[StringField(applicationData, "appId")] = struct{}{}
		}
	}
	out := make([]string, 0, len(ids))
	for id := range ids {
		out = append(out, id)
	}
	return out, nil
}

// GetOrganizationProfile returns the organization's profile, or nil when no
// profile row exists. The profile is active unless explicitly disabled.
func (r *GrantRepo) GetOrganizationProfile(organizationID string) (*authz.Profile, error) {
	result, err := r.tables.ListRows(
		DatabaseID,
		"organization_profiles",
		r.tables.WithListRowsQueries([]string{query.Equal("organizationId", organizationID)}),
	)
	if err != nil {
		return nil, err
	}
	if len(result.Rows) == 0 {
		return nil, nil
	}
	data, err := RowData(&result.Rows[0])
	if err != nil {
		return nil, err
	}
	active := true
	if value, ok := data["active"].(bool); ok {
		active = value
	}
	return &authz.Profile{Active: active}, nil
}

// IsFeatureEnabled reports whether the feature is enabled for the
// organization.
func (r *GrantRepo) IsFeatureEnabled(organizationID, featureKey string) (bool, error) {
	features, err := r.tables.ListRows(
		DatabaseID,
		"features",
		r.tables.WithListRowsQueries([]string{query.Equal("key", featureKey)}),
	)
	if err != nil {
		return false, err
	}
	if len(features.Rows) == 0 {
		return false, nil
	}
	featureID := features.Rows[0].Id
	rows, err := r.tables.ListRows(
		DatabaseID,
		"organization_features",
		r.tables.WithListRowsQueries([]string{
			query.Equal("organizationId", organizationID),
			query.Equal("featureId", featureID),
		}),
	)
	if err != nil {
		return false, err
	}
	if len(rows.Rows) == 0 {
		return false, nil
	}
	data, err := RowData(&rows.Rows[0])
	if err != nil {
		return false, err
	}
	enabled, _ := data["enabled"].(bool)
	return enabled, nil
}
