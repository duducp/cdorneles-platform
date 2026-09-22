package authz

import (
	"errors"
	"testing"
)

type fakeRepo struct {
	memberships   []Membership
	roles         []Role
	permissions   []string
	applications  []string
	profile       *Profile
	featureOn     bool
	membershipErr error
}

func (f *fakeRepo) ListMemberships(string) ([]Membership, error) {
	return f.memberships, f.membershipErr
}
func (f *fakeRepo) ListOrganizationRoles(string) ([]Role, error) { return f.roles, nil }
func (f *fakeRepo) ListPermissionKeysForRoles([]string) ([]string, error) {
	return f.permissions, nil
}
func (f *fakeRepo) ListApplicationIDsForRoles([]string) ([]string, error) {
	return f.applications, nil
}
func (f *fakeRepo) GetOrganizationProfile(string) (*Profile, error) { return f.profile, nil }
func (f *fakeRepo) IsFeatureEnabled(string, string) (bool, error)   { return f.featureOn, nil }

func grantedRepo() *fakeRepo {
	return &fakeRepo{
		memberships:  []Membership{{UserID: "u1", Roles: []string{"owner"}}},
		roles:        []Role{{ID: "role-owner", Name: "owner"}},
		permissions:  []string{"organizations.update"},
		applications: []string{"admin"},
		profile:      &Profile{Active: true},
		featureOn:    true,
	}
}

var input = Input{
	UserID:             "u1",
	OrganizationID:     "org-1",
	ApplicationID:      "admin",
	RequiredPermission: "organizations.update",
	RequiredFeature:    "white-label",
}

func TestAuthorizeAllowsWhenEverythingPasses(t *testing.T) {
	decision, err := Authorize(input, grantedRepo())
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if !decision.OK {
		t.Fatalf("expected OK, got %+v", decision)
	}
	if len(decision.Roles) != 1 || decision.Roles[0] != "owner" {
		t.Fatalf("expected roles [owner], got %v", decision.Roles)
	}
}

func TestAuthorizeDeniesUnauthenticated(t *testing.T) {
	in := input
	in.UserID = ""
	decision, _ := Authorize(in, grantedRepo())
	assertDenied(t, decision, 401, "not authenticated")
}

func TestAuthorizeDeniesNonMember(t *testing.T) {
	repo := grantedRepo()
	repo.memberships = []Membership{{UserID: "someone-else", Roles: []string{"owner"}}}
	decision, _ := Authorize(input, repo)
	assertDenied(t, decision, 403, "not a member of the organization")
}

func TestAuthorizeDeniesMissingProfile(t *testing.T) {
	repo := grantedRepo()
	repo.profile = nil
	decision, _ := Authorize(input, repo)
	assertDenied(t, decision, 403, "organization is not active")
}

func TestAuthorizeDeniesInactiveOrganization(t *testing.T) {
	repo := grantedRepo()
	repo.profile = &Profile{Active: false}
	decision, _ := Authorize(input, repo)
	assertDenied(t, decision, 403, "organization is not active")
}

func TestAuthorizeDeniesNoMatchingRole(t *testing.T) {
	repo := grantedRepo()
	repo.roles = []Role{}
	decision, _ := Authorize(input, repo)
	assertDenied(t, decision, 403, "no role grants access")
}

func TestAuthorizeDeniesMissingApplication(t *testing.T) {
	repo := grantedRepo()
	repo.applications = []string{"client"}
	decision, _ := Authorize(input, repo)
	assertDenied(t, decision, 403, "missing application access: admin")
}

func TestAuthorizeDeniesMissingPermission(t *testing.T) {
	repo := grantedRepo()
	repo.permissions = []string{}
	decision, _ := Authorize(input, repo)
	assertDenied(t, decision, 403, "missing permission: organizations.update")
}

func TestAuthorizeDeniesMissingFeature(t *testing.T) {
	repo := grantedRepo()
	repo.featureOn = false
	decision, _ := Authorize(input, repo)
	assertDenied(t, decision, 403, "missing feature: white-label")
}

func TestAuthorizePropagatesRepoError(t *testing.T) {
	repo := grantedRepo()
	repo.membershipErr = errors.New("boom")
	if _, err := Authorize(input, repo); err == nil {
		t.Fatal("expected error to propagate")
	}
}

func assertDenied(t *testing.T, decision Decision, status int, reason string) {
	t.Helper()
	if decision.OK {
		t.Fatalf("expected denial, got OK")
	}
	if decision.Status != status {
		t.Fatalf("expected status %d, got %d", status, decision.Status)
	}
	if decision.Reason != reason {
		t.Fatalf("expected reason %q, got %q", reason, decision.Reason)
	}
}
