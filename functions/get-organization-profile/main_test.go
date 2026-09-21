package handler

import (
	"encoding/json"
	"testing"

	"github.com/open-runtimes/types-for-go/v4/openruntimes"
)

func newContext(body string, headers map[string]string) openruntimes.Context {
	ctx := openruntimes.NewContext(openruntimes.Logger{})
	ctx.Req.Headers = headers
	ctx.Req.SetBodyBinary([]byte(body))
	return ctx
}

func decode(t *testing.T, resp openruntimes.Response) map[string]interface{} {
	t.Helper()
	out := map[string]interface{}{}
	if err := json.Unmarshal(resp.Body, &out); err != nil {
		t.Fatalf("response is not JSON: %v (%s)", err, string(resp.Body))
	}
	return out
}

func TestMissingIdentityIsUnauthorized(t *testing.T) {
	ctx := newContext(`{"organizationId":"org-1"}`, map[string]string{})
	resp := Main(ctx)
	if resp.StatusCode != 401 {
		t.Fatalf("expected 401, got %d", resp.StatusCode)
	}
	if decode(t, resp)["error"] != "unauthorized" {
		t.Fatalf("expected unauthorized, got %v", decode(t, resp))
	}
}

func TestInvalidJSONIsBadRequest(t *testing.T) {
	ctx := newContext(`{`, map[string]string{"x-appwrite-user-id": "u1"})
	resp := Main(ctx)
	if resp.StatusCode != 400 {
		t.Fatalf("expected 400, got %d", resp.StatusCode)
	}
}

func TestMissingOrganizationIdIsBadRequest(t *testing.T) {
	ctx := newContext(`{}`, map[string]string{"x-appwrite-user-id": "u1"})
	resp := Main(ctx)
	if resp.StatusCode != 400 {
		t.Fatalf("expected 400, got %d", resp.StatusCode)
	}
}
