// Package handler implements the list-organizations Appwrite Function. It
// lists every organization (the server teams list), paging through every
// result, and returns only the id and name the admin UI needs. The platform
// team itself is filtered out — it is not an organization the UI can target.
package handler

import (
	"os"

	sdk "github.com/appwrite/sdk-for-go/v7/appwrite"
	"github.com/appwrite/sdk-for-go/v7/models"
	"github.com/appwrite/sdk-for-go/v7/query"
	"github.com/appwrite/sdk-for-go/v7/teams"
	"github.com/open-runtimes/types-for-go/v4/openruntimes"

	"openruntimes/handler/internal/appwrite"
	"openruntimes/handler/internal/httpx"
)

// pageSize bounds each Appwrite teams page. Appwrite defaults to 25 rows,
// which would silently truncate the list, so every page is read with an
// explicit limit.
const pageSize = 100

// permissionOrganizationsRead is the platform capability required to list
// organizations.
const permissionOrganizationsRead = "organizations.read"

// listOrganizationsRequest is the empty request body. It exists so the
// handler still rejects malformed JSON before authorizing.
type listOrganizationsRequest struct{}

type listOrganizationsResponse struct {
	Organizations []organizationSummary `json:"organizations"`
}

// organizationSummary is the subset of an Appwrite team the admin UI needs.
type organizationSummary struct {
	ID   string `json:"id"`
	Name string `json:"name"`
}

// operations is the seam over the Appwrite SDK (teams + grant repo) so the
// handler's validation, authorization, filtering and paging are unit-testable
// without an SDK mock.
type operations interface {
	IsPlatformMember(userID string) (bool, error)
	EffectivePermissions(organizationID, userID string) ([]string, error)
	ListOrganizationsPage(offset int) ([]models.Team, error)
	PlatformTeamID() string
}

// Main is the function entrypoint.
func Main(ctx openruntimes.Context) openruntimes.Response {
	return handle(ctx, newAppwriteOps(ctx.Req.Headers["x-appwrite-key"]))
}

// handle validates the request, authorizes the caller, then lists every
// organization through the injected operations seam.
func handle(ctx openruntimes.Context, ops operations) openruntimes.Response {
	var body listOrganizationsRequest
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
		// organizations.read is a platform capability, not an organization
		// role grant, so there is no organization context to resolve against.
		// With an empty organization there is nothing to resolve, so a
		// non-platform caller is denied; the platform-member bypass above is
		// how organizations.read is granted.
		permissions, err := ops.EffectivePermissions("", callerID)
		if err != nil {
			ctx.Error(err)
			return internalError(ctx)
		}
		if !contains(permissions, permissionOrganizationsRead) {
			return httpx.Forbidden(ctx, "missing permission: "+permissionOrganizationsRead)
		}
	}

	rows, err := pageAllOrganizations(ops.ListOrganizationsPage)
	if err != nil {
		ctx.Error(err)
		return internalError(ctx)
	}

	// The platform team is not an organization the admin form can target, so
	// it is filtered out. An empty PLATFORM_TEAM_ID never equals a real team
	// id, so nothing is excluded in that case.
	platformTeamID := ops.PlatformTeamID()
	summaries := make([]organizationSummary, 0, len(rows))
	for i := range rows {
		if rows[i].Id == platformTeamID {
			continue
		}
		summaries = append(summaries, organizationSummary{
			ID:   rows[i].Id,
			Name: rows[i].Name,
		})
	}

	ctx.Log(map[string]interface{}{
		"action": "organizations.list",
		"count":  len(summaries),
	})

	return ctx.Res.Json(listOrganizationsResponse{Organizations: summaries})
}

// appwriteOps is the Appwrite-backed implementation of operations.
type appwriteOps struct {
	teams *teams.Teams
	repo  *appwrite.GrantRepo
}

func newAppwriteOps(apiKey string) operations {
	clt := appwrite.NewClient(apiKey)
	return &appwriteOps{
		teams: sdk.NewTeams(clt),
		repo:  appwrite.NewGrantRepo(clt),
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
// organization, the same model resolve-grants returns.
//
// organizations.read is platform-only: the platform-member bypass in handle is
// the sole grant path, so there is never an organization context to resolve
// against. Returning an empty (denying) set here keeps the deny-by-default
// contract explicit instead of relying on callers never reaching this method.
// The SDK implementation is therefore intentionally trivial; it is covered by
// the live smoke test in Task 6 rather than by an SDK mock (the operations
// seam is faked in unit tests).
func (o *appwriteOps) EffectivePermissions(organizationID, userID string) ([]string, error) {
	return nil, nil
}

// PlatformTeamID returns the team id that must be filtered from the result
// (empty when the environment does not configure one).
func (o *appwriteOps) PlatformTeamID() string {
	return os.Getenv("PLATFORM_TEAM_ID")
}

// ListOrganizationsPage returns one page of the server teams list at the given
// offset. The handler's pageAllOrganizations loop calls it with increasing
// offsets until a short page ends the list.
func (o *appwriteOps) ListOrganizationsPage(offset int) ([]models.Team, error) {
	result, err := o.teams.List(
		o.teams.WithListQueries([]string{query.Limit(pageSize), query.Offset(offset)}),
	)
	if err != nil {
		return nil, err
	}
	return result.Teams, nil
}

// pageAllOrganizations calls fetch with increasing offsets until it returns a
// short page, accumulating every team. It is the same paging contract as
// list-users's pageAllUsers.
func pageAllOrganizations(fetch func(offset int) ([]models.Team, error)) ([]models.Team, error) {
	var all []models.Team
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
		httpx.Error{Error: "internal_error", Reason: "failed to list organizations"},
		ctx.Res.WithStatusCode(500),
	)
}
