import { beforeEach, describe, expect, it, vi } from "vitest";

import { authorize, type GrantRepo } from "../authorize";

const memberships = vi.fn();
const listOrganizationRoles = vi.fn();
const listPermissionKeysForRoles = vi.fn();
const listApplicationIdsForRoles = vi.fn();
const getOrganizationProfile = vi.fn();
const isFeatureEnabled = vi.fn();

function createRepo(overrides: Partial<GrantRepo> = {}): GrantRepo {
  return {
    listMemberships: memberships,
    listOrganizationRoles,
    listPermissionKeysForRoles,
    listApplicationIdsForRoles,
    getOrganizationProfile,
    isFeatureEnabled,
    ...overrides,
  };
}

const input = {
  userId: "u1",
  organizationId: "org-1",
  applicationId: "admin",
  requiredPermission: "organizations.update",
  requiredFeature: "white-label",
};

const fullGrant = {
  memberships: [{ userId: "u1", roles: ["owner"] }],
  roles: [{ id: "role-owner", name: "owner" }],
  permissions: ["organizations.update"],
  applications: ["admin"],
  profile: { active: true },
  featureEnabled: true,
};

function seedAllGranted(repo: GrantRepo): void {
  vi.mocked(repo.listMemberships).mockResolvedValue(fullGrant.memberships);
  vi.mocked(repo.listOrganizationRoles).mockResolvedValue(fullGrant.roles);
  vi.mocked(repo.listPermissionKeysForRoles).mockResolvedValue(fullGrant.permissions);
  vi.mocked(repo.listApplicationIdsForRoles).mockResolvedValue(fullGrant.applications);
  vi.mocked(repo.getOrganizationProfile).mockResolvedValue(fullGrant.profile);
  vi.mocked(repo.isFeatureEnabled).mockResolvedValue(fullGrant.featureEnabled);
}

describe("authorize", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns ok when every condition passes", async () => {
    const repo = createRepo();
    seedAllGranted(repo);

    await expect(authorize(input, repo)).resolves.toEqual({ ok: true, roles: ["owner"] });
  });

  it("denies an unauthenticated request (401)", async () => {
    const repo = createRepo();

    await expect(authorize({ ...input, userId: "" }, repo)).resolves.toEqual({
      ok: false,
      status: 401,
      reason: "not authenticated",
    });
  });

  it("denies a non-member (403)", async () => {
    const repo = createRepo();
    vi.mocked(repo.listMemberships).mockResolvedValue([
      { userId: "someone-else", roles: ["owner"] },
    ]);

    await expect(authorize(input, repo)).resolves.toEqual({
      ok: false,
      status: 403,
      reason: "not a member of the organization",
    });
  });

  it("denies an organization with no profile (403)", async () => {
    const repo = createRepo();
    vi.mocked(repo.listMemberships).mockResolvedValue(fullGrant.memberships);
    vi.mocked(repo.getOrganizationProfile).mockResolvedValue(null);

    await expect(authorize(input, repo)).resolves.toEqual({
      ok: false,
      status: 403,
      reason: "organization is not active",
    });
  });

  it("denies an explicitly inactive organization (403)", async () => {
    const repo = createRepo();
    vi.mocked(repo.listMemberships).mockResolvedValue(fullGrant.memberships);
    vi.mocked(repo.getOrganizationProfile).mockResolvedValue({ active: false });

    await expect(authorize(input, repo)).resolves.toEqual({
      ok: false,
      status: 403,
      reason: "organization is not active",
    });
  });

  it("denies when no role matches the membership (403)", async () => {
    const repo = createRepo();
    vi.mocked(repo.listMemberships).mockResolvedValue(fullGrant.memberships);
    vi.mocked(repo.getOrganizationProfile).mockResolvedValue(fullGrant.profile);
    vi.mocked(repo.listOrganizationRoles).mockResolvedValue([]);

    await expect(authorize(input, repo)).resolves.toEqual({
      ok: false,
      status: 403,
      reason: "no role grants access",
    });
  });

  it("denies when the application is not granted (403)", async () => {
    const repo = createRepo();
    vi.mocked(repo.listMemberships).mockResolvedValue(fullGrant.memberships);
    vi.mocked(repo.getOrganizationProfile).mockResolvedValue(fullGrant.profile);
    vi.mocked(repo.listOrganizationRoles).mockResolvedValue(fullGrant.roles);
    vi.mocked(repo.listApplicationIdsForRoles).mockResolvedValue(["customer"]);

    await expect(authorize(input, repo)).resolves.toEqual({
      ok: false,
      status: 403,
      reason: "missing application access: admin",
    });
  });

  it("denies when the permission is not granted (403)", async () => {
    const repo = createRepo();
    vi.mocked(repo.listMemberships).mockResolvedValue(fullGrant.memberships);
    vi.mocked(repo.getOrganizationProfile).mockResolvedValue(fullGrant.profile);
    vi.mocked(repo.listOrganizationRoles).mockResolvedValue(fullGrant.roles);
    vi.mocked(repo.listApplicationIdsForRoles).mockResolvedValue(fullGrant.applications);
    vi.mocked(repo.listPermissionKeysForRoles).mockResolvedValue([]);

    await expect(authorize(input, repo)).resolves.toEqual({
      ok: false,
      status: 403,
      reason: "missing permission: organizations.update",
    });
  });

  it("denies when the feature is disabled (403)", async () => {
    const repo = createRepo();
    vi.mocked(repo.listMemberships).mockResolvedValue(fullGrant.memberships);
    vi.mocked(repo.getOrganizationProfile).mockResolvedValue(fullGrant.profile);
    vi.mocked(repo.listOrganizationRoles).mockResolvedValue(fullGrant.roles);
    vi.mocked(repo.listApplicationIdsForRoles).mockResolvedValue(fullGrant.applications);
    vi.mocked(repo.listPermissionKeysForRoles).mockResolvedValue(fullGrant.permissions);
    vi.mocked(repo.isFeatureEnabled).mockResolvedValue(false);

    await expect(authorize(input, repo)).resolves.toEqual({
      ok: false,
      status: 403,
      reason: "missing feature: white-label",
    });
  });
});
