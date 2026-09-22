import { describe, expect, it } from "vitest";

import { resolveActiveOrganization } from "./active-organization";
import type { Organization, OrganizationMembership } from "./types";

const orgA: Organization = { id: "org-a", name: "Org A" };
const orgB: Organization = { id: "org-b", name: "Org B" };

const membershipA: OrganizationMembership = { organizationId: "org-a", roles: ["owner"] };
const membershipB: OrganizationMembership = { organizationId: "org-b", roles: ["member"] };

describe("resolveActiveOrganization", () => {
  it("honors the domain organization when the user is a member", () => {
    expect(
      resolveActiveOrganization({
        organizations: [orgA, orgB],
        memberships: [membershipA, membershipB],
        domainOrganizationId: "org-b",
      }),
    ).toEqual(orgB);
  });

  it("ignores a domain organization the user is not a member of", () => {
    expect(
      resolveActiveOrganization({
        organizations: [orgA, orgB],
        memberships: [membershipA],
        domainOrganizationId: "org-b",
      }),
    ).toEqual(orgA);
  });

  it("honors the preferred organization when the user is a member", () => {
    expect(
      resolveActiveOrganization({
        organizations: [orgA, orgB],
        memberships: [membershipA, membershipB],
        preferredOrganizationId: "org-b",
      }),
    ).toEqual(orgB);
  });

  it("ignores a preferred organization the user is not a member of", () => {
    expect(
      resolveActiveOrganization({
        organizations: [orgA, orgB],
        memberships: [membershipA],
        preferredOrganizationId: "org-b",
      }),
    ).toEqual(orgA);
  });

  it("prefers the domain organization over the preferred one", () => {
    expect(
      resolveActiveOrganization({
        organizations: [orgA, orgB],
        memberships: [membershipA, membershipB],
        domainOrganizationId: "org-b",
        preferredOrganizationId: "org-a",
      }),
    ).toEqual(orgB);
  });

  it("falls through to the preferred organization when the domain one is not a membership", () => {
    expect(
      resolveActiveOrganization({
        organizations: [orgA, orgB],
        memberships: [membershipA],
        domainOrganizationId: "org-b",
        preferredOrganizationId: "org-a",
      }),
    ).toEqual(orgA);
  });

  it("skips a leading organization the user is not a member of", () => {
    expect(
      resolveActiveOrganization({
        organizations: [orgB, orgA],
        memberships: [membershipA],
      }),
    ).toEqual(orgA);
  });

  it("ignores an empty-string organization id", () => {
    expect(
      resolveActiveOrganization({
        organizations: [orgA],
        memberships: [membershipA],
        domainOrganizationId: "",
      }),
    ).toEqual(orgA);
  });

  it("ignores an id that has a membership but is not in the organization list", () => {
    expect(
      resolveActiveOrganization({
        organizations: [orgA],
        memberships: [membershipA, membershipB],
        domainOrganizationId: "org-b",
      }),
    ).toEqual(orgA);
  });

  it("falls back to the first organization the user belongs to", () => {
    expect(
      resolveActiveOrganization({
        organizations: [orgA, orgB],
        memberships: [membershipB],
      }),
    ).toEqual(orgB);
  });

  it("returns null when there are no organizations", () => {
    expect(resolveActiveOrganization({ organizations: [], memberships: [] })).toBeNull();
  });

  it("returns null when the user has no memberships", () => {
    expect(resolveActiveOrganization({ organizations: [orgA, orgB], memberships: [] })).toBeNull();
  });
});
