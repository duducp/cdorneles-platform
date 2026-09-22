package handler

import (
	"encoding/json"
	"testing"

	"github.com/open-runtimes/types-for-go/v4/openruntimes"

	"openruntimes/handler/internal/httpx"
)

func newContext(body string, headers map[string]string) openruntimes.Context {
	ctx := openruntimes.NewContext(openruntimes.Logger{})
	ctx.Req.Headers = headers
	ctx.Req.SetBodyBinary([]byte(body))
	return ctx
}

func TestMainRejectsInvalidJSON(t *testing.T) {
	ctx := newContext("{", map[string]string{})
	resp := Main(ctx)
	assertError(t, resp, 400, "bad_request", "invalid JSON")
}

func TestMainRejectsMissingUserIdentity(t *testing.T) {
	ctx := newContext(
		`{"userId":"u1","organizationId":"org-1","applicationId":"admin"}`,
		map[string]string{},
	)
	resp := Main(ctx)
	assertError(t, resp, 401, "unauthorized", "missing user identity")
}

func TestMainRejectsUserIDMismatch(t *testing.T) {
	ctx := newContext(
		`{"userId":"u2","organizationId":"org-1","applicationId":"admin"}`,
		map[string]string{"x-appwrite-user-id": "u1"},
	)
	resp := Main(ctx)
	assertError(t, resp, 403, "forbidden", "userId mismatch")
}

// Platform mode (empty organizationId) resolves grants from the platform team
// membership. With PLATFORM_TEAM_ID unset the function short-circuits to an
// empty grant before touching Appwrite, so this unit test can assert it without
// an SDK mock. The membership path itself needs the live SDK, so it is verified
// by the live probe, not here.
func TestMainPlatformGrantsWithoutPlatformTeam(t *testing.T) {
	t.Setenv("PLATFORM_TEAM_ID", "")
	ctx := newContext(
		`{"userId":"u1","organizationId":"","applicationId":"admin"}`,
		map[string]string{"x-appwrite-user-id": "u1"},
	)
	resp := Main(ctx)
	if resp.StatusCode != 200 {
		t.Fatalf("expected status 200, got %d", resp.StatusCode)
	}
	if got := string(resp.Body); got != `{"permissions":[],"features":[]}` {
		t.Fatalf("expected empty grants, got %q", got)
	}
}

func assertError(t *testing.T, resp openruntimes.Response, status int, kind, reason string) {
	t.Helper()
	if resp.StatusCode != status {
		t.Fatalf("expected status %d, got %d", status, resp.StatusCode)
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
