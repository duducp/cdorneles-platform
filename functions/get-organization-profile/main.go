// Package handler ports the get-organization-profile Appwrite Function to Go.
// It authenticates the caller, verifies organization membership, and returns
// the organization's white-label profile.
package handler

import (
	"github.com/appwrite/sdk-for-go/v7/query"
	"github.com/open-runtimes/types-for-go/v4/openruntimes"

	"openruntimes/handler/internal/appwrite"
	"openruntimes/handler/internal/httpx"
)

type getRequest struct {
	OrganizationID string `json:"organizationId"`
}

type response struct {
	DisplayName    string  `json:"displayName"`
	LogoLight      *string `json:"logoLight"`
	LogoDark       *string `json:"logoDark"`
	Favicon        *string `json:"favicon"`
	PrimaryColor   *string `json:"primaryColor"`
	SecondaryColor *string `json:"secondaryColor"`
	DefaultTheme   string  `json:"defaultTheme"`
}

// Main is the function entrypoint.
func Main(ctx openruntimes.Context) openruntimes.Response {
	userID := ctx.Req.Headers["x-appwrite-user-id"]
	if userID == "" {
		return httpx.Unauthorized(ctx, "missing user identity")
	}

	var body getRequest
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
		ctx.Error(err)
		return internalError(ctx, "failed to list memberships")
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
	row, err := appwrite.FindOne(
		tables,
		"organization_profiles",
		query.Equal("organizationId", body.OrganizationID),
	)
	if err != nil {
		ctx.Error(err)
		return internalError(ctx, "failed to load organization profile")
	}
	if row == nil {
		return httpx.Forbidden(ctx, "organization is not provisioned")
	}

	data, err := appwrite.RowData(row)
	if err != nil {
		ctx.Error(err)
		return internalError(ctx, "failed to decode organization profile")
	}

	defaultTheme := appwrite.StringField(data, "defaultTheme")
	if defaultTheme == "" {
		defaultTheme = "light"
	}

	return ctx.Res.Json(response{
		DisplayName:    appwrite.StringField(data, "displayName"),
		LogoLight:      optionalString(data, "logoLight"),
		LogoDark:       optionalString(data, "logoDark"),
		Favicon:        optionalString(data, "favicon"),
		PrimaryColor:   optionalString(data, "primaryColor"),
		SecondaryColor: optionalString(data, "secondaryColor"),
		DefaultTheme:   defaultTheme,
	})
}

// optionalString returns a pointer to the field's value, or nil when the field
// is absent or empty.
func optionalString(data map[string]interface{}, key string) *string {
	value := appwrite.StringField(data, key)
	if value == "" {
		return nil
	}
	return &value
}

func internalError(ctx openruntimes.Context, reason string) openruntimes.Response {
	return ctx.Res.Json(
		httpx.Error{Error: "internal_error", Reason: reason},
		ctx.Res.WithStatusCode(500),
	)
}
