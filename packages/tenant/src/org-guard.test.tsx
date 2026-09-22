import "@testing-library/jest-dom/vitest";

import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { OrgGuard } from "./org-guard";
import { TenantProvider } from "./tenant-context";
import type { Organization } from "./types";

function renderGuard({
  organizations,
  currentOrganizationId = null,
  ready = true,
}: {
  organizations: Organization[];
  currentOrganizationId?: string | null;
  ready?: boolean;
}) {
  const onRedirectToSelectOrg = vi.fn();
  render(
    <TenantProvider
      organizations={organizations}
      currentOrganizationId={currentOrganizationId}
      ready={ready}
    >
      <OrgGuard onRedirectToSelectOrg={onRedirectToSelectOrg} fallback={<span>loading</span>}>
        <span>dashboard</span>
      </OrgGuard>
    </TenantProvider>,
  );
  return { onRedirectToSelectOrg };
}

describe("OrgGuard", () => {
  it("redirects to select-org when the user has no organization", () => {
    const { onRedirectToSelectOrg } = renderGuard({ organizations: [] });

    expect(onRedirectToSelectOrg).toHaveBeenCalled();
    expect(screen.queryByText("dashboard")).not.toBeInTheDocument();
    expect(screen.getByText("loading")).toBeInTheDocument();
  });

  it("renders the children once an organization is active", () => {
    renderGuard({
      organizations: [{ id: "team-acme", name: "Acme" }],
      currentOrganizationId: "team-acme",
    });

    expect(screen.getByText("dashboard")).toBeInTheDocument();
  });

  it("waits while the tenant state is still resolving", () => {
    const { onRedirectToSelectOrg } = renderGuard({ organizations: [], ready: false });

    expect(onRedirectToSelectOrg).not.toHaveBeenCalled();
    expect(screen.getByText("loading")).toBeInTheDocument();
  });
});
