package handler

import (
	"encoding/json"
	"errors"
	"reflect"
	"testing"

	"github.com/open-runtimes/types-for-go/v4/openruntimes"

	"openruntimes/handler/internal/httpx"
)

// fakeOps is the in-memory double for the Appwrite operations seam. It records
// what the handler asked it to do so the tests can assert the reconciliation
// without an SDK mock.
type fakeOps struct {
	platformMember bool
	platformErr    error

	effective    []string
	effectiveErr error

	permissionIDs map[string]string
	permissionErr error

	existingRows []userPermission
	existingErr  error

	deleted   []string
	deleteErr error

	granted  []grantRecord
	grantErr error
}

type grantRecord struct {
	UserID         string
	OrganizationID string
	PermissionID   string
	GrantedBy      string
}

func (f *fakeOps) IsPlatformMember(userID string) (bool, error) {
	return f.platformMember, f.platformErr
}

func (f *fakeOps) EffectivePermissions(organizationID, userID string) ([]string, error) {
	return f.effective, f.effectiveErr
}

func (f *fakeOps) PermissionIDForKey(key string) (string, error) {
	if f.permissionErr != nil {
		return "", f.permissionErr
	}
	return f.permissionIDs[key], nil
}

func (f *fakeOps) ListUserPermissions(userID, organizationID string) ([]userPermission, error) {
	return f.existingRows, f.existingErr
}

func (f *fakeOps) CreateUserPermission(userID, organizationID, permissionID, grantedBy string) error {
	f.granted = append(f.granted, grantRecord{userID, organizationID, permissionID, grantedBy})
	return f.grantErr
}

func (f *fakeOps) DeleteUserPermission(rowID string) error {
	f.deleted = append(f.deleted, rowID)
	return f.deleteErr
}

func newContext(body string, headers map[string]string) openruntimes.Context {
	ctx := openruntimes.NewContext(openruntimes.Logger{})
	ctx.Req.Headers = headers
	ctx.Req.SetBodyBinary([]byte(body))
	return ctx
}

const validBody = `{"userId":"user-2","organizationId":"org-1","permissions":[]}`

func TestMainRejectsInvalidJSON(t *testing.T) {
	ctx := newContext("{", map[string]string{})
	resp := handle(ctx, &fakeOps{})
	assertError(t, resp, 400, "bad_request", "invalid JSON")
}

func TestMainRejectsMissingUserIdentity(t *testing.T) {
	ctx := newContext(validBody, map[string]string{})
	resp := handle(ctx, &fakeOps{})
	assertError(t, resp, 401, "unauthorized", "missing user identity")
}

func TestMainRejectsMissingRequiredFields(t *testing.T) {
	ctx := newContext(`{"organizationId":"org-1","permissions":[]}`, map[string]string{"x-appwrite-user-id": "caller-1"})
	resp := handle(ctx, &fakeOps{})
	assertError(t, resp, 400, "bad_request", "userId and organizationId are required")
}

func TestMainDeniesCallerWithoutManagePermissions(t *testing.T) {
	ops := &fakeOps{effective: []string{"products.read"}}
	body := `{"userId":"user-2","organizationId":"org-1","permissions":["products.read"]}`
	ctx := newContext(body, map[string]string{"x-appwrite-user-id": "caller-1"})
	resp := handle(ctx, ops)
	assertError(t, resp, 403, "forbidden", "missing permission: users.manage_permissions")
}

func TestMainDeniesGrantingAPermissionTheCallerLacks(t *testing.T) {
	ops := &fakeOps{effective: []string{"users.manage_permissions"}}
	body := `{"userId":"user-2","organizationId":"org-1","permissions":["products.read"]}`
	ctx := newContext(body, map[string]string{"x-appwrite-user-id": "caller-1"})
	resp := handle(ctx, ops)
	assertError(t, resp, 403, "forbidden", "cannot grant permission: products.read")
}

func TestMainPlatformMemberBypassesPermissionLookup(t *testing.T) {
	ops := &fakeOps{
		platformMember: true,
		permissionIDs:  map[string]string{"products.read": "perm_products_read"},
	}
	body := `{"userId":"user-2","organizationId":"org-1","permissions":["products.read"]}`
	ctx := newContext(body, map[string]string{"x-appwrite-user-id": "root-1"})

	resp := handle(ctx, ops)
	if resp.StatusCode != 200 {
		t.Fatalf("expected 200, got %d (%s)", resp.StatusCode, resp.Body)
	}
	if ops.effective != nil {
		t.Fatalf("platform member must not need organization permissions, got %v", ops.effective)
	}
	if len(ops.granted) != 1 {
		t.Fatalf("expected one grant, got %v", ops.granted)
	}
}

func TestMainRejectsUnknownPermission(t *testing.T) {
	ops := &fakeOps{platformMember: true, permissionIDs: map[string]string{}}
	body := `{"userId":"user-2","organizationId":"org-1","permissions":["ghost.read"]}`
	ctx := newContext(body, map[string]string{"x-appwrite-user-id": "root-1"})
	resp := handle(ctx, ops)
	assertError(t, resp, 400, "bad_request", "unknown permission: ghost.read")
}

func TestMainGrantsAPermissionThatIsOnlyAdded(t *testing.T) {
	ops := &fakeOps{
		effective: []string{"users.manage_permissions", "products.read", "products.write"},
		permissionIDs: map[string]string{
			"products.read":  "perm_products_read",
			"products.write": "perm_products_write",
		},
		existingRows: []userPermission{
			{RowID: "row-1", PermissionID: "perm_products_read"},
		},
	}
	body := `{"userId":"user-2","organizationId":"org-1","permissions":["products.read","products.write"]}`
	ctx := newContext(body, map[string]string{"x-appwrite-user-id": "caller-1"})

	resp := handle(ctx, ops)
	if resp.StatusCode != 200 {
		t.Fatalf("expected 200, got %d (%s)", resp.StatusCode, resp.Body)
	}
	if len(ops.deleted) != 0 {
		t.Fatalf("expected no deletions, got %v", ops.deleted)
	}
	want := grantRecord{
		UserID:         "user-2",
		OrganizationID: "org-1",
		PermissionID:   "perm_products_write",
		GrantedBy:      "caller-1",
	}
	if len(ops.granted) != 1 || ops.granted[0] != want {
		t.Fatalf("expected grant %+v, got %+v", want, ops.granted)
	}
}

func TestMainRevokesAPermissionThatIsOnlyRemoved(t *testing.T) {
	ops := &fakeOps{
		effective:     []string{"users.manage_permissions", "products.read"},
		permissionIDs: map[string]string{"products.read": "perm_products_read"},
		existingRows: []userPermission{
			{RowID: "row-1", PermissionID: "perm_products_read"},
			{RowID: "row-2", PermissionID: "perm_products_write"},
		},
	}
	body := `{"userId":"user-2","organizationId":"org-1","permissions":["products.read"]}`
	ctx := newContext(body, map[string]string{"x-appwrite-user-id": "caller-1"})

	resp := handle(ctx, ops)
	if resp.StatusCode != 200 {
		t.Fatalf("expected 200, got %d (%s)", resp.StatusCode, resp.Body)
	}
	if !reflect.DeepEqual(ops.deleted, []string{"row-2"}) {
		t.Fatalf("expected to delete row-2, got %v", ops.deleted)
	}
	if len(ops.granted) != 0 {
		t.Fatalf("expected no grants, got %v", ops.granted)
	}
}

func TestMainIsANoOpWhenTheSetIsUnchanged(t *testing.T) {
	ops := &fakeOps{
		effective:     []string{"users.manage_permissions", "products.read"},
		permissionIDs: map[string]string{"products.read": "perm_products_read"},
		existingRows: []userPermission{
			{RowID: "row-1", PermissionID: "perm_products_read"},
		},
	}
	body := `{"userId":"user-2","organizationId":"org-1","permissions":["products.read"]}`
	ctx := newContext(body, map[string]string{"x-appwrite-user-id": "caller-1"})

	resp := handle(ctx, ops)
	if resp.StatusCode != 200 {
		t.Fatalf("expected 200, got %d (%s)", resp.StatusCode, resp.Body)
	}
	if len(ops.deleted) != 0 {
		t.Fatalf("expected no deletions, got %v", ops.deleted)
	}
	if len(ops.granted) != 0 {
		t.Fatalf("expected no grants, got %v", ops.granted)
	}
}

func TestMainRevokesEveryPermissionWhenTheSetIsEmpty(t *testing.T) {
	ops := &fakeOps{
		effective: []string{"users.manage_permissions"},
		existingRows: []userPermission{
			{RowID: "row-1", PermissionID: "perm_products_read"},
			{RowID: "row-2", PermissionID: "perm_products_write"},
		},
	}
	body := `{"userId":"user-2","organizationId":"org-1","permissions":[]}`
	ctx := newContext(body, map[string]string{"x-appwrite-user-id": "caller-1"})

	resp := handle(ctx, ops)
	if resp.StatusCode != 200 {
		t.Fatalf("expected 200, got %d (%s)", resp.StatusCode, resp.Body)
	}
	if !reflect.DeepEqual(ops.deleted, []string{"row-1", "row-2"}) {
		t.Fatalf("expected to delete both rows, got %v", ops.deleted)
	}
	if len(ops.granted) != 0 {
		t.Fatalf("expected no grants, got %v", ops.granted)
	}
}

func TestMainReconcilesAddsAndRemovesTogether(t *testing.T) {
	ops := &fakeOps{
		effective: []string{"users.manage_permissions", "products.read", "products.write"},
		permissionIDs: map[string]string{
			"products.read":  "perm_products_read",
			"products.write": "perm_products_write",
		},
		existingRows: []userPermission{
			{RowID: "row-1", PermissionID: "perm_products_read"},
			{RowID: "row-2", PermissionID: "perm_addresses_read"},
		},
	}
	body := `{"userId":"user-2","organizationId":"org-1","permissions":["products.read","products.write"]}`
	ctx := newContext(body, map[string]string{"x-appwrite-user-id": "caller-1"})

	resp := handle(ctx, ops)
	if resp.StatusCode != 200 {
		t.Fatalf("expected 200, got %d (%s)", resp.StatusCode, resp.Body)
	}
	if !reflect.DeepEqual(ops.deleted, []string{"row-2"}) {
		t.Fatalf("expected to delete row-2, got %v", ops.deleted)
	}
	want := grantRecord{
		UserID:         "user-2",
		OrganizationID: "org-1",
		PermissionID:   "perm_products_write",
		GrantedBy:      "caller-1",
	}
	if len(ops.granted) != 1 || ops.granted[0] != want {
		t.Fatalf("expected grant %+v, got %+v", want, ops.granted)
	}
}

func TestMainReturns500WhenTheDeleteFails(t *testing.T) {
	ops := &fakeOps{
		effective:    []string{"users.manage_permissions"},
		existingRows: []userPermission{{RowID: "row-1", PermissionID: "perm_products_read"}},
		deleteErr:    errors.New("boom"),
	}
	ctx := newContext(validBody, map[string]string{"x-appwrite-user-id": "caller-1"})
	resp := handle(ctx, ops)
	if resp.StatusCode != 500 {
		t.Fatalf("expected 500, got %d (%s)", resp.StatusCode, resp.Body)
	}
}

func TestMainReturns500WhenTheGrantFails(t *testing.T) {
	ops := &fakeOps{
		effective:     []string{"users.manage_permissions", "products.read"},
		permissionIDs: map[string]string{"products.read": "perm_products_read"},
		grantErr:      errors.New("boom"),
	}
	body := `{"userId":"user-2","organizationId":"org-1","permissions":["products.read"]}`
	ctx := newContext(body, map[string]string{"x-appwrite-user-id": "caller-1"})
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
