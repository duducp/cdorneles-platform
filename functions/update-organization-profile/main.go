// Package handler ports the update-organization-profile Appwrite Function to
// Go. It authorizes organizations.update + white-label, then applies the
// white-label profile changes and records an audit entry.
package handler

import (
	"encoding/json"
	"strings"
	"time"

	sdk "github.com/appwrite/sdk-for-go/v7/appwrite"
	"github.com/appwrite/sdk-for-go/v7/id"
	"github.com/appwrite/sdk-for-go/v7/query"
	"github.com/open-runtimes/types-for-go/v4/openruntimes"

	"github.com/cdorneles/platform/functions/internal/appwrite"
	"github.com/cdorneles/platform/functions/internal/authz"
	"github.com/cdorneles/platform/functions/internal/httpx"
)

// profileFields is the ordered set of white-label profile fields, matching the
// TypeScript PROFILE_FIELDS constant.
var profileFields = []string{
	"displayName",
	"primaryColor",
	"secondaryColor",
	"logoLight",
	"logoDark",
	"favicon",
}

type updateRequest struct {
	OrganizationID string  `json:"organizationId"`
	ApplicationID  string  `json:"applicationId"`
	DisplayName    *string `json:"displayName"`
	PrimaryColor   *string `json:"primaryColor"`
	SecondaryColor *string `json:"secondaryColor"`
	LogoLight      *string `json:"logoLight"`
	LogoDark       *string `json:"logoDark"`
	Favicon        *string `json:"favicon"`
}

type updateResponse struct {
	OK bool `json:"ok"`
}

type fieldChange struct {
	key   string
	value string
}

// Main is the function entrypoint.
func Main(ctx openruntimes.Context) openruntimes.Response {
	var req updateRequest
	if err := ctx.Req.BodyJson(&req); err != nil {
		return httpx.BadRequest(ctx, "invalid JSON")
	}

	userID := ctx.Req.Headers["x-appwrite-user-id"]
	if req.OrganizationID == "" || req.ApplicationID == "" {
		return httpx.BadRequest(ctx, "organizationId and applicationId are required")
	}

	// The per-execution API key reaches the runtime as the `x-appwrite-key`
	// request header (open-runtimes v5); it is not injected as an env var.
	clt := appwrite.NewClient(ctx.Req.Headers["x-appwrite-key"])
	repo := appwrite.NewGrantRepo(clt)
	tables := sdk.NewTablesDB(clt)

	decision, err := authz.Authorize(authz.Input{
		UserID:             userID,
		OrganizationID:     req.OrganizationID,
		ApplicationID:      req.ApplicationID,
		RequiredPermission: "organizations.update",
		RequiredFeature:    "white-label",
	}, repo)
	if err != nil {
		ctx.Error(err)
		return internalError(ctx)
	}
	if !decision.OK {
		ctx.Log(map[string]interface{}{
			"action":   "organizations.update",
			"decision": decision,
		})
		if decision.Status == 401 {
			return httpx.Unauthorized(ctx, decision.Reason)
		}
		return httpx.Forbidden(ctx, decision.Reason)
	}

	changes := collectChanges(&req)
	if len(changes) == 0 {
		return httpx.BadRequest(ctx, "no profile fields to update")
	}

	rows, err := tables.ListRows(
		appwrite.DatabaseID,
		"organization_profiles",
		tables.WithListRowsQueries([]string{query.Equal("organizationId", req.OrganizationID)}),
	)
	if err != nil {
		ctx.Error(err)
		return internalError(ctx)
	}
	if len(rows.Rows) == 0 {
		return httpx.Forbidden(ctx, "organization is not active")
	}
	profileRow := rows.Rows[0]

	data := make(map[string]interface{}, len(changes))
	for _, change := range changes {
		data[change.key] = change.value
	}

	if _, err := tables.UpdateRow(
		appwrite.DatabaseID,
		"organization_profiles",
		profileRow.Id,
		tables.WithUpdateRowData(data),
	); err != nil {
		ctx.Error(err)
		return internalError(ctx)
	}

	metadata, err := encodeChanges(changes)
	if err != nil {
		ctx.Error(err)
		return internalError(ctx)
	}

	if _, err := tables.CreateRow(
		appwrite.DatabaseID,
		"audit_logs",
		id.Unique(),
		map[string]interface{}{
			"userId":         userID,
			"organizationId": req.OrganizationID,
			"action":         "organizations.update",
			"resourceType":   "organization",
			"resourceId":     req.OrganizationID,
			"metadata":       metadata,
			"timestamp":      time.Now().UTC().Format(time.RFC3339),
		},
	); err != nil {
		ctx.Error(err)
		return internalError(ctx)
	}

	ctx.Log(map[string]interface{}{
		"action":         "organizations.update",
		"organizationId": req.OrganizationID,
		"userId":         userID,
		"changed":        keys(changes),
	})

	return ctx.Res.Json(updateResponse{OK: true})
}

// collectChanges gathers the non-nil profile fields in PROFILE_FIELDS order.
func collectChanges(req *updateRequest) []fieldChange {
	values := map[string]*string{
		"displayName":    req.DisplayName,
		"primaryColor":   req.PrimaryColor,
		"secondaryColor": req.SecondaryColor,
		"logoLight":      req.LogoLight,
		"logoDark":       req.LogoDark,
		"favicon":        req.Favicon,
	}
	changes := make([]fieldChange, 0, len(profileFields))
	for _, field := range profileFields {
		if value, ok := values[field]; ok && value != nil {
			changes = append(changes, fieldChange{key: field, value: *value})
		}
	}
	return changes
}

// encodeChanges serializes the changes as a JSON object preserving field order.
func encodeChanges(changes []fieldChange) (string, error) {
	var builder strings.Builder
	builder.WriteByte('{')
	for i, change := range changes {
		if i > 0 {
			builder.WriteByte(',')
		}
		key, err := json.Marshal(change.key)
		if err != nil {
			return "", err
		}
		value, err := json.Marshal(change.value)
		if err != nil {
			return "", err
		}
		builder.Write(key)
		builder.WriteByte(':')
		builder.Write(value)
	}
	builder.WriteByte('}')
	return builder.String(), nil
}

func keys(changes []fieldChange) []string {
	out := make([]string, 0, len(changes))
	for _, change := range changes {
		out = append(out, change.key)
	}
	return out
}

func internalError(ctx openruntimes.Context) openruntimes.Response {
	return ctx.Res.Json(
		httpx.Error{Error: "internal_error", Reason: "failed to update organization profile"},
		ctx.Res.WithStatusCode(500),
	)
}
