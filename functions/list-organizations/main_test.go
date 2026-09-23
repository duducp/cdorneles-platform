package handler

import (
	"encoding/json"
	"errors"
	"fmt"
	"reflect"
	"testing"

	"github.com/appwrite/sdk-for-go/v7/models"
	"github.com/open-runtimes/types-for-go/v4/openruntimes"

	"openruntimes/handler/internal/httpx"
)

// fakeOps is the in-memory double for the Appwrite operations seam. It records
// what the handler asked it to do so the tests can assert the authorization,
// platform filtering and paging without an SDK mock.
type fakeOps struct {
	platformMember bool
	platformErr    error

	effective []string
	// effectiveCalls counts EffectivePermissions invocations so a test can
	// assert the platform bypass never resolves organization permissions.
	effectiveCalls int
	// effectiveOrgs records the organization id each EffectivePermissions call
	// received, so a test can assert the handler resolves against no
	// organization.
	effectiveOrgs []string
	effectiveErr  error

	// teamsByPage is the page returned for each offset. A missing offset is an
	// empty (short) page, which ends the paging loop.
	teamsByPage map[int][]models.Team
	listErr     error
	// listOffsets records the offsets requested, proving every page is read.
	listOffsets []int

	// platformTeamID is the team the handler must filter out of the result.
	platformTeamID string
}

func (f *fakeOps) IsPlatformMember(userID string) (bool, error) {
	return f.platformMember, f.platformErr
}

func (f *fakeOps) EffectivePermissions(organizationID, userID string) ([]string, error) {
	f.effectiveCalls++
	f.effectiveOrgs = append(f.effectiveOrgs, organizationID)
	return f.effective, f.effectiveErr
}

func (f *fakeOps) ListOrganizationsPage(offset int) ([]models.Team, error) {
	f.listOffsets = append(f.listOffsets, offset)
	if f.listErr != nil {
		return nil, f.listErr
	}
	return f.teamsByPage[offset], nil
}

func (f *fakeOps) PlatformTeamID() string {
	return f.platformTeamID
}

func newContext(body string, headers map[string]string) openruntimes.Context {
	ctx := openruntimes.NewContext(openruntimes.Logger{})
	ctx.Req.Headers = headers
	ctx.Req.SetBodyBinary([]byte(body))
	return ctx
}

const emptyBody = `{}`

func TestMainRejectsInvalidJSON(t *testing.T) {
	ctx := newContext("{", map[string]string{})
	resp := handle(ctx, &fakeOps{})
	assertError(t, resp, 400, "bad_request", "invalid JSON")
}

func TestMainRejectsMissingUserIdentity(t *testing.T) {
	ctx := newContext(emptyBody, map[string]string{})
	resp := handle(ctx, &fakeOps{})
	assertError(t, resp, 401, "unauthorized", "missing user identity")
}

func TestMainDeniesCallerWithoutReadPermission(t *testing.T) {
	ops := &fakeOps{effective: []string{"products.read"}}
	ctx := newContext(emptyBody, map[string]string{"x-appwrite-user-id": "u1"})
	resp := handle(ctx, ops)
	assertError(t, resp, 403, "forbidden", "missing permission: organizations.read")
}

// organizations.read is a platform capability, so a non-platform caller has
// nothing to resolve and must be denied with 403, never a 500 from resolving
// an empty organization id.
func TestMainDeniesNonPlatformCallerWithEmptyOrganization(t *testing.T) {
	ops := &fakeOps{}
	ctx := newContext(emptyBody, map[string]string{"x-appwrite-user-id": "u1"})
	resp := handle(ctx, ops)
	assertError(t, resp, 403, "forbidden", "missing permission: organizations.read")
	if !reflect.DeepEqual(ops.effectiveOrgs, []string{""}) {
		t.Fatalf(`expected EffectivePermissions to resolve against "", got %v`, ops.effectiveOrgs)
	}
}

func TestMainPlatformMemberBypassesPermissionLookup(t *testing.T) {
	ops := &fakeOps{
		platformMember: true,
		teamsByPage: map[int][]models.Team{
			0: {{Id: "org-1", Name: "Acme"}},
		},
	}
	ctx := newContext(emptyBody, map[string]string{"x-appwrite-user-id": "root-1"})
	resp := handle(ctx, ops)
	if resp.StatusCode != 200 {
		t.Fatalf("expected 200, got %d (%s)", resp.StatusCode, resp.Body)
	}
	if ops.effectiveCalls != 0 {
		t.Fatalf("platform member must not resolve organization permissions, got %d call(s)", ops.effectiveCalls)
	}
}

// A stale or invalid platform team must not turn into a 500: the failed lookup
// falls through to the ordinary permission resolution.
func TestMainToleratesPlatformLookupFailure(t *testing.T) {
	ops := &fakeOps{
		platformErr: errors.New("boom"),
		effective:   []string{"organizations.read"},
		teamsByPage: map[int][]models.Team{
			0: {{Id: "org-1", Name: "Acme"}},
		},
	}
	ctx := newContext(emptyBody, map[string]string{"x-appwrite-user-id": "u1"})
	resp := handle(ctx, ops)
	if resp.StatusCode != 200 {
		t.Fatalf("expected 200 despite the platform lookup failure, got %d (%s)", resp.StatusCode, resp.Body)
	}
}

func TestMainReturnsOrganizations(t *testing.T) {
	ops := &fakeOps{
		effective: []string{"organizations.read"},
		teamsByPage: map[int][]models.Team{
			0: {
				{Id: "org-1", Name: "Acme"},
				{Id: "org-2", Name: "Globex"},
			},
		},
	}
	ctx := newContext(emptyBody, map[string]string{"x-appwrite-user-id": "u1"})
	resp := handle(ctx, ops)
	if resp.StatusCode != 200 {
		t.Fatalf("expected 200, got %d (%s)", resp.StatusCode, resp.Body)
	}
	var out listOrganizationsResponse
	if err := json.Unmarshal(resp.Body, &out); err != nil {
		t.Fatalf("could not unmarshal response %q: %v", resp.Body, err)
	}
	if len(out.Organizations) != 2 {
		t.Fatalf("expected 2 organizations, got %d", len(out.Organizations))
	}
	first := out.Organizations[0]
	if first.ID != "org-1" || first.Name != "Acme" {
		t.Fatalf("unexpected first organization %+v", first)
	}
	if out.Organizations[1].ID != "org-2" || out.Organizations[1].Name != "Globex" {
		t.Fatalf("unexpected second organization %+v", out.Organizations[1])
	}
}

// The platform team is not an organization the admin form can target, so it is
// filtered out of the response.
func TestMainExcludesThePlatformTeam(t *testing.T) {
	ops := &fakeOps{
		effective:      []string{"organizations.read"},
		platformTeamID: "platform-admins",
		teamsByPage: map[int][]models.Team{
			0: {
				{Id: "platform-admins", Name: "Platform Admins"},
				{Id: "org-1", Name: "Acme"},
			},
		},
	}
	ctx := newContext(emptyBody, map[string]string{"x-appwrite-user-id": "u1"})
	resp := handle(ctx, ops)
	if resp.StatusCode != 200 {
		t.Fatalf("expected 200, got %d (%s)", resp.StatusCode, resp.Body)
	}
	var out listOrganizationsResponse
	if err := json.Unmarshal(resp.Body, &out); err != nil {
		t.Fatalf("could not unmarshal response %q: %v", resp.Body, err)
	}
	if len(out.Organizations) != 1 || out.Organizations[0].ID != "org-1" {
		t.Fatalf("expected only org-1, got %+v", out.Organizations)
	}
}

// The server teams list is paginated, so the handler must read every page
// rather than only the first.
func TestMainReadsEveryPage(t *testing.T) {
	total := pageSize + pageSize + 5
	ops := &fakeOps{
		effective:   []string{"organizations.read"},
		teamsByPage: map[int][]models.Team{},
	}
	for offset := 0; offset < total; offset += pageSize {
		count := total - offset
		if count > pageSize {
			count = pageSize
		}
		page := make([]models.Team, count)
		for i := range page {
			page[i] = models.Team{
				Id:   fmt.Sprintf("org-%d", offset+i),
				Name: "Org",
			}
		}
		ops.teamsByPage[offset] = page
	}

	ctx := newContext(emptyBody, map[string]string{"x-appwrite-user-id": "u1"})
	resp := handle(ctx, ops)
	if resp.StatusCode != 200 {
		t.Fatalf("expected 200, got %d (%s)", resp.StatusCode, resp.Body)
	}
	var out listOrganizationsResponse
	if err := json.Unmarshal(resp.Body, &out); err != nil {
		t.Fatalf("could not unmarshal response %q: %v", resp.Body, err)
	}
	if len(out.Organizations) != total {
		t.Fatalf("expected %d organizations across pages, got %d", total, len(out.Organizations))
	}
	wantOffsets := []int{0, pageSize, pageSize * 2}
	if !reflect.DeepEqual(ops.listOffsets, wantOffsets) {
		t.Fatalf("expected offsets %v, got %v", wantOffsets, ops.listOffsets)
	}
}

func TestMainReturns500WhenEffectivePermissionsFail(t *testing.T) {
	ops := &fakeOps{effectiveErr: errors.New("boom")}
	ctx := newContext(emptyBody, map[string]string{"x-appwrite-user-id": "u1"})
	resp := handle(ctx, ops)
	if resp.StatusCode != 500 {
		t.Fatalf("expected 500, got %d (%s)", resp.StatusCode, resp.Body)
	}
}

func TestMainReturns500WhenTheListFails(t *testing.T) {
	ops := &fakeOps{effective: []string{"organizations.read"}, listErr: errors.New("boom")}
	ctx := newContext(emptyBody, map[string]string{"x-appwrite-user-id": "u1"})
	resp := handle(ctx, ops)
	if resp.StatusCode != 500 {
		t.Fatalf("expected 500, got %d (%s)", resp.StatusCode, resp.Body)
	}
}

// An empty platform must still marshal "organizations": [] (never null) so the
// frontend contract is stable.
func TestMainReturnsEmptyListAsArray(t *testing.T) {
	ops := &fakeOps{effective: []string{"organizations.read"}}
	ctx := newContext(emptyBody, map[string]string{"x-appwrite-user-id": "u1"})
	resp := handle(ctx, ops)
	if resp.StatusCode != 200 {
		t.Fatalf("expected 200, got %d (%s)", resp.StatusCode, resp.Body)
	}
	var out listOrganizationsResponse
	if err := json.Unmarshal(resp.Body, &out); err != nil {
		t.Fatalf("could not unmarshal response %q: %v", resp.Body, err)
	}
	if out.Organizations == nil {
		t.Fatalf("expected a non-nil empty organizations array, got null in %s", resp.Body)
	}
	if len(out.Organizations) != 0 {
		t.Fatalf("expected 0 organizations, got %d", len(out.Organizations))
	}
}

func assertError(t *testing.T, resp openruntimes.Response, status int, kind, reason string) {
	t.Helper()
	if resp.StatusCode != status {
		t.Fatalf("expected status %d, got %d (%s)", status, resp.StatusCode, resp.Body)
	}
	var body httpx.Error
	if err := json.Unmarshal(resp.Body, &body); err != nil {
		t.Fatalf("could not unmarshal response body %q: %v", resp.Body, err)
	}
	if body.Error != kind {
		t.Fatalf("expected error %q, got %q", kind, body.Error)
	}
	if body.Reason != reason {
		t.Fatalf("expected reason %q, got %q", reason, body.Reason)
	}
}
