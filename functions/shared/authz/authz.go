// Package authz is the Go port of @cdorneles/authz. It evaluates effective
// access (ADR-005): authenticated AND membership AND organization active AND
// application access AND permission AND feature enabled. Deny-by-default.
package authz

// Membership is a user's membership in an organization (Appwrite Team).
type Membership struct {
	UserID string
	Roles  []string
}

// Role is an organization-scoped role definition.
type Role struct {
	ID   string
	Name string
}

// Profile is the organization's profile state.
type Profile struct {
	Active bool
}

// GrantRepo is the data-access contract for authorization decisions.
// Each function supplies a concrete implementation backed by Appwrite.
type GrantRepo interface {
	ListMemberships(teamID string) ([]Membership, error)
	ListOrganizationRoles(organizationID string) ([]Role, error)
	ListPermissionKeysForRoles(roleIDs []string) ([]string, error)
	ListApplicationIDsForRoles(roleIDs []string) ([]string, error)
	GetOrganizationProfile(organizationID string) (*Profile, error)
	IsFeatureEnabled(organizationID, featureKey string) (bool, error)
}

// Input describes an authorization request. RequiredPermission and
// RequiredFeature must be server-side constants, never client input.
type Input struct {
	UserID             string
	OrganizationID     string
	ApplicationID      string
	RequiredPermission string
	RequiredFeature    string
}

// Decision is the outcome of an authorization check.
type Decision struct {
	OK     bool
	Status int
	Reason string
	Roles  []string
}

// Authorize evaluates effective access. The first failing condition
// short-circuits. A non-nil error indicates a repository failure.
func Authorize(input Input, repo GrantRepo) (Decision, error) {
	if input.UserID == "" {
		return Decision{Status: 401, Reason: "not authenticated"}, nil
	}

	memberships, err := repo.ListMemberships(input.OrganizationID)
	if err != nil {
		return Decision{}, err
	}
	var membership *Membership
	for i := range memberships {
		if memberships[i].UserID == input.UserID {
			membership = &memberships[i]
			break
		}
	}
	if membership == nil {
		return Decision{Status: 403, Reason: "not a member of the organization"}, nil
	}

	profile, err := repo.GetOrganizationProfile(input.OrganizationID)
	if err != nil {
		return Decision{}, err
	}
	if profile == nil || !profile.Active {
		return Decision{Status: 403, Reason: "organization is not active"}, nil
	}

	roles, err := repo.ListOrganizationRoles(input.OrganizationID)
	if err != nil {
		return Decision{}, err
	}
	var roleIDs []string
	for _, role := range roles {
		for _, membershipRole := range membership.Roles {
			if membershipRole == role.Name {
				roleIDs = append(roleIDs, role.ID)
				break
			}
		}
	}
	if len(roleIDs) == 0 {
		return Decision{Status: 403, Reason: "no role grants access"}, nil
	}

	applications, err := repo.ListApplicationIDsForRoles(roleIDs)
	if err != nil {
		return Decision{}, err
	}
	if !contains(applications, input.ApplicationID) {
		return Decision{
			Status: 403,
			Reason: "missing application access: " + input.ApplicationID,
		}, nil
	}

	permissions, err := repo.ListPermissionKeysForRoles(roleIDs)
	if err != nil {
		return Decision{}, err
	}
	if !contains(permissions, input.RequiredPermission) {
		return Decision{
			Status: 403,
			Reason: "missing permission: " + input.RequiredPermission,
		}, nil
	}

	enabled, err := repo.IsFeatureEnabled(input.OrganizationID, input.RequiredFeature)
	if err != nil {
		return Decision{}, err
	}
	if !enabled {
		return Decision{
			Status: 403,
			Reason: "missing feature: " + input.RequiredFeature,
		}, nil
	}

	return Decision{OK: true, Roles: membership.Roles}, nil
}

func contains(values []string, target string) bool {
	for _, value := range values {
		if value == target {
			return true
		}
	}
	return false
}
