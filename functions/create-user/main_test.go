package handler

import (
	"encoding/json"
	"reflect"
	"testing"

	"github.com/open-runtimes/types-for-go/v4/openruntimes"

	"openruntimes/handler/internal/httpx"
)

// fakeOps is the in-memory double for the Appwrite operations seam. It records
// what the handler asked it to do so the tests can assert the orchestration
// without an SDK mock.
type fakeOps struct {
	platformMember bool
	platformErr    error

	effective    []string
	effectiveErr error

	permissionIDs map[string]string
	permissionErr error

	createdUserID string
	createUserErr error
	createdEmail  string
	createdName   string
	createdPass   string

	setLabelsID     string
	setLabelsValues []string
	setLabelsErr    error

	membershipTeamID string
	membershipRoles  []string
	membershipEmail  string
	membershipErr    error

	granted  []grantRecord
	grantErr error

	emailTo       string
	emailName     string
	emailPassword string
	emailErr      error
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

func (f *fakeOps) CreateUser(email, password, name string) (string, error) {
	f.createdEmail = email
	f.createdName = name
	f.createdPass = password
	return f.createdUserID, f.createUserErr
}

func (f *fakeOps) SetLabels(userID string, labels []string) error {
	f.setLabelsID = userID
	f.setLabelsValues = labels
	return f.setLabelsErr
}

func (f *fakeOps) AddMembership(teamID string, roles []string, email string) error {
	f.membershipTeamID = teamID
	f.membershipRoles = roles
	f.membershipEmail = email
	return f.membershipErr
}

func (f *fakeOps) PermissionIDForKey(key string) (string, error) {
	if f.permissionErr != nil {
		return "", f.permissionErr
	}
	return f.permissionIDs[key], nil
}

func (f *fakeOps) CreateUserPermission(userID, organizationID, permissionID, grantedBy string) error {
	f.granted = append(f.granted, grantRecord{userID, organizationID, permissionID, grantedBy})
	return f.grantErr
}

func (f *fakeOps) SendWelcomeEmail(to, name, password string) error {
	f.emailTo = to
	f.emailName = name
	f.emailPassword = password
	return f.emailErr
}

func newContext(body string, headers map[string]string) openruntimes.Context {
	ctx := openruntimes.NewContext(openruntimes.Logger{})
	ctx.Req.Headers = headers
	ctx.Req.SetBodyBinary([]byte(body))
	return ctx
}

const validBody = `{"email":"new@example.com","name":"New User","organizationId":"org-1","role":"admin"}`

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

func TestMainRejectsUserIDMismatch(t *testing.T) {
	body := `{"userId":"u2","email":"new@example.com","name":"New User","organizationId":"org-1","role":"admin"}`
	ctx := newContext(body, map[string]string{"x-appwrite-user-id": "u1"})
	resp := handle(ctx, &fakeOps{})
	assertError(t, resp, 403, "forbidden", "userId mismatch")
}

func TestMainRejectsMissingRequiredFields(t *testing.T) {
	ctx := newContext(`{"email":"new@example.com"}`, map[string]string{"x-appwrite-user-id": "u1"})
	resp := handle(ctx, &fakeOps{})
	assertError(t, resp, 400, "bad_request", "email, name, organizationId and role are required")
}

func TestMainDeniesCallerWithoutCreatePermission(t *testing.T) {
	ops := &fakeOps{effective: []string{"products.read"}}
	ctx := newContext(validBody, map[string]string{"x-appwrite-user-id": "u1"})
	resp := handle(ctx, ops)
	assertError(t, resp, 403, "forbidden", "missing permission: users.create")
}

func TestMainDeniesCallerWithoutManagePermissions(t *testing.T) {
	ops := &fakeOps{effective: []string{"users.create"}}
	body := `{"email":"new@example.com","name":"New User","organizationId":"org-1","role":"admin","permissions":["products.read"]}`
	ctx := newContext(body, map[string]string{"x-appwrite-user-id": "u1"})
	resp := handle(ctx, ops)
	assertError(t, resp, 403, "forbidden", "missing permission: users.manage_permissions")
}

func TestMainDoesNotRequireManagePermissionsWithoutDirectPermissions(t *testing.T) {
	ops := &fakeOps{effective: []string{"users.create"}, createdUserID: "user-1"}
	ctx := newContext(validBody, map[string]string{"x-appwrite-user-id": "u1"})
	resp := handle(ctx, ops)
	if resp.StatusCode != 200 {
		t.Fatalf("expected 200, got %d (%s)", resp.StatusCode, resp.Body)
	}
	if len(ops.granted) != 0 {
		t.Fatalf("expected no direct grants, got %v", ops.granted)
	}
}

func TestMainCreatesUserWithRoleAndDirectPermissions(t *testing.T) {
	ops := &fakeOps{
		effective:     []string{"users.create", "users.manage_permissions"},
		createdUserID: "user-1",
		permissionIDs: map[string]string{"products.read": "perm_products_read"},
	}
	body := `{"email":"new@example.com","name":"New User","organizationId":"org-1","role":"admin","permissions":["products.read"],"labels":["root"]}`
	ctx := newContext(body, map[string]string{"x-appwrite-user-id": "caller-1"})

	resp := handle(ctx, ops)
	if resp.StatusCode != 200 {
		t.Fatalf("expected 200, got %d (%s)", resp.StatusCode, resp.Body)
	}

	var out createUserResponse
	if err := json.Unmarshal(resp.Body, &out); err != nil {
		t.Fatalf("could not unmarshal response %q: %v", resp.Body, err)
	}
	if out.UserID != "user-1" {
		t.Fatalf("expected userId user-1, got %q", out.UserID)
	}

	if ops.createdEmail != "new@example.com" || ops.createdName != "New User" {
		t.Fatalf("unexpected create user args: email=%q name=%q", ops.createdEmail, ops.createdName)
	}
	if ops.createdPass == "" {
		t.Fatal("expected a generated temporary password")
	}

	if ops.setLabelsID != "user-1" || !reflect.DeepEqual(ops.setLabelsValues, []string{"root"}) {
		t.Fatalf("unexpected labels call: id=%q labels=%v", ops.setLabelsID, ops.setLabelsValues)
	}

	if ops.membershipTeamID != "org-1" {
		t.Fatalf("expected membership in org-1, got %q", ops.membershipTeamID)
	}
	if !reflect.DeepEqual(ops.membershipRoles, []string{"admin"}) {
		t.Fatalf("expected role admin, got %v", ops.membershipRoles)
	}
	if ops.membershipEmail != "new@example.com" {
		t.Fatalf("expected membership by email, got %q", ops.membershipEmail)
	}

	want := grantRecord{
		UserID:         "user-1",
		OrganizationID: "org-1",
		PermissionID:   "perm_products_read",
		GrantedBy:      "caller-1",
	}
	if len(ops.granted) != 1 || ops.granted[0] != want {
		t.Fatalf("expected grant %+v, got %+v", want, ops.granted)
	}

	if ops.emailTo != "new@example.com" || ops.emailName != "New User" {
		t.Fatalf("unexpected welcome email args: to=%q name=%q", ops.emailTo, ops.emailName)
	}
	if ops.emailPassword != ops.createdPass {
		t.Fatal("welcome email must carry the same temporary password that was set")
	}
}

func TestMainPlatformMemberBypassesPermissionLookup(t *testing.T) {
	ops := &fakeOps{
		platformMember: true,
		createdUserID:  "user-1",
		permissionIDs:  map[string]string{"products.read": "perm_products_read"},
	}
	body := `{"email":"new@example.com","name":"New User","organizationId":"org-1","role":"owner","permissions":["products.read"]}`
	ctx := newContext(body, map[string]string{"x-appwrite-user-id": "root-1"})

	resp := handle(ctx, ops)
	if resp.StatusCode != 200 {
		t.Fatalf("expected 200, got %d (%s)", resp.StatusCode, resp.Body)
	}
	if ops.effective != nil {
		t.Fatalf("platform member must not need organization permissions, got %v", ops.effective)
	}
}

func TestMainRejectsUnknownPermission(t *testing.T) {
	ops := &fakeOps{
		effective:     []string{"users.create", "users.manage_permissions"},
		createdUserID: "user-1",
		permissionIDs: map[string]string{},
	}
	body := `{"email":"new@example.com","name":"New User","organizationId":"org-1","role":"admin","permissions":["ghost.read"]}`
	ctx := newContext(body, map[string]string{"x-appwrite-user-id": "u1"})
	resp := handle(ctx, ops)
	assertError(t, resp, 400, "bad_request", "unknown permission: ghost.read")
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
