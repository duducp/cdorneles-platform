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
// what the handler asked it to do so the tests can assert the authorization and
// paging without an SDK mock.
type fakeOps struct {
	platformMember bool
	platformErr    error

	effective    []string
	effectiveErr error
	// effectiveCalls counts EffectivePermissions invocations so a test can
	// assert the platform bypass never resolves organization permissions.
	effectiveCalls int
	// effectiveOrgs records the organization id each EffectivePermissions call
	// received, so a test can assert list-users resolves against no organization.
	effectiveOrgs []string

	// usersByPage is the page returned for each offset. A missing offset is an
	// empty (short) page, which ends the paging loop.
	usersByPage map[int][]models.User
	listErr     error
	// listOffsets records the offsets requested, proving every page is read.
	listOffsets []int
}

func (f *fakeOps) IsPlatformMember(userID string) (bool, error) {
	return f.platformMember, f.platformErr
}

func (f *fakeOps) EffectivePermissions(organizationID, userID string) ([]string, error) {
	f.effectiveCalls++
	f.effectiveOrgs = append(f.effectiveOrgs, organizationID)
	return f.effective, f.effectiveErr
}

func (f *fakeOps) ListUsersPage(offset int) ([]models.User, error) {
	f.listOffsets = append(f.listOffsets, offset)
	if f.listErr != nil {
		return nil, f.listErr
	}
	return f.usersByPage[offset], nil
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
	assertError(t, resp, 403, "forbidden", "missing permission: users.read")
}

// list-users resolves permissions against no organization: users.read is a
// platform capability, so a non-platform caller has nothing to resolve and must
// be denied with 403, never a 500 from resolving an empty organization id.
func TestMainDeniesNonPlatformCallerWithEmptyOrganization(t *testing.T) {
	ops := &fakeOps{}
	ctx := newContext(emptyBody, map[string]string{"x-appwrite-user-id": "u1"})
	resp := handle(ctx, ops)
	assertError(t, resp, 403, "forbidden", "missing permission: users.read")
	if !reflect.DeepEqual(ops.effectiveOrgs, []string{""}) {
		t.Fatalf(`expected EffectivePermissions to resolve against "", got %v`, ops.effectiveOrgs)
	}
}

func TestMainPlatformMemberBypassesPermissionLookup(t *testing.T) {
	ops := &fakeOps{
		platformMember: true,
		usersByPage: map[int][]models.User{
			0: {{Id: "u1", Email: "a@example.com", Name: "A"}},
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
		effective:   []string{"users.read"},
		usersByPage: map[int][]models.User{
			0: {{Id: "u1", Email: "a@example.com", Name: "A"}},
		},
	}
	ctx := newContext(emptyBody, map[string]string{"x-appwrite-user-id": "u1"})
	resp := handle(ctx, ops)
	if resp.StatusCode != 200 {
		t.Fatalf("expected 200 despite the platform lookup failure, got %d (%s)", resp.StatusCode, resp.Body)
	}
}

func TestMainReturnsUsers(t *testing.T) {
	ops := &fakeOps{
		effective: []string{"users.read"},
		usersByPage: map[int][]models.User{
			0: {
				{Id: "u1", Email: "a@example.com", Name: "A", Labels: []string{"root"}},
				{Id: "u2", Email: "b@example.com", Name: "B"},
			},
		},
	}
	ctx := newContext(emptyBody, map[string]string{"x-appwrite-user-id": "u1"})
	resp := handle(ctx, ops)
	if resp.StatusCode != 200 {
		t.Fatalf("expected 200, got %d (%s)", resp.StatusCode, resp.Body)
	}
	var out listUsersResponse
	if err := json.Unmarshal(resp.Body, &out); err != nil {
		t.Fatalf("could not unmarshal response %q: %v", resp.Body, err)
	}
	if len(out.Users) != 2 {
		t.Fatalf("expected 2 users, got %d", len(out.Users))
	}
	first := out.Users[0]
	if first.ID != "u1" || first.Email != "a@example.com" || first.Name != "A" {
		t.Fatalf("unexpected first user %+v", first)
	}
	if !reflect.DeepEqual(first.Labels, []string{"root"}) {
		t.Fatalf("expected labels [root], got %v", first.Labels)
	}
	if out.Users[1].Labels == nil || len(out.Users[1].Labels) != 0 {
		t.Fatalf("expected an empty labels array, got %#v", out.Users[1].Labels)
	}
}

// The server users.list is paginated (25 by default), so the handler must read
// every page rather than only the first.
func TestMainReadsEveryPage(t *testing.T) {
	total := pageSize + pageSize + 5
	ops := &fakeOps{
		effective:   []string{"users.read"},
		usersByPage: map[int][]models.User{},
	}
	for offset := 0; offset < total; offset += pageSize {
		count := total - offset
		if count > pageSize {
			count = pageSize
		}
		page := make([]models.User, count)
		for i := range page {
			page[i] = models.User{
				Id:    fmt.Sprintf("user-%d", offset+i),
				Email: "a@example.com",
				Name:  "A",
			}
		}
		ops.usersByPage[offset] = page
	}

	ctx := newContext(emptyBody, map[string]string{"x-appwrite-user-id": "u1"})
	resp := handle(ctx, ops)
	if resp.StatusCode != 200 {
		t.Fatalf("expected 200, got %d (%s)", resp.StatusCode, resp.Body)
	}
	var out listUsersResponse
	if err := json.Unmarshal(resp.Body, &out); err != nil {
		t.Fatalf("could not unmarshal response %q: %v", resp.Body, err)
	}
	if len(out.Users) != total {
		t.Fatalf("expected %d users across pages, got %d", total, len(out.Users))
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
	ops := &fakeOps{effective: []string{"users.read"}, listErr: errors.New("boom")}
	ctx := newContext(emptyBody, map[string]string{"x-appwrite-user-id": "u1"})
	resp := handle(ctx, ops)
	if resp.StatusCode != 500 {
		t.Fatalf("expected 500, got %d (%s)", resp.StatusCode, resp.Body)
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
