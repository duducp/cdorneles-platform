import "@testing-library/jest-dom/vitest";

import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { TenantBridge } from "./tenant-bridge";
import { useTenant } from "./tenant-context";
import type { TenantService } from "./tenant-service";
import type { Organization, OrganizationMembership } from "./types";

const { useAuthMock } = vi.hoisted(() => ({ useAuthMock: vi.fn() }));

vi.mock("@cdorneles/auth", () => ({ useAuth: useAuthMock }));

const STORAGE_KEY = "cdorneles-active-org";

function fakeService(initial: Organization[]): TenantService {
  const orgs = [...initial];
  return {
    listOrganizations: vi.fn(async () => [...orgs]),
    listMemberships: vi.fn(async (): Promise<OrganizationMembership[]> =>
      orgs.map((organization) => ({ organizationId: organization.id, roles: ["owner"] })),
    ),
    getProfile: vi.fn(async () => null),
    createOrganization: vi.fn(async (name: string) => {
      const organization = { id: `org-${name}`, name };
      orgs.push(organization);
      return organization;
    }),
  };
}

function Probe() {
  const { currentOrganization, organizations, createOrganization } = useTenant();
  return (
    <div>
      <span data-testid="current">{currentOrganization?.id ?? "none"}</span>
      <ul>
        {organizations.map((organization) => (
          <li key={organization.id}>{organization.id}</li>
        ))}
      </ul>
      <button onClick={() => void createOrganization("New")}>default</button>
      <button onClick={() => void createOrganization("New", { makeActive: false })}>
        no-switch
      </button>
    </div>
  );
}

async function renderBridge(service: TenantService) {
  render(
    <TenantBridge tenantService={service}>
      <Probe />
    </TenantBridge>,
  );
  await waitFor(() => expect(screen.getByTestId("current")).toHaveTextContent("org-1"));
}

describe("TenantBridge createOrganization", () => {
  beforeEach(() => {
    localStorage.clear();
    useAuthMock.mockReturnValue({ user: { id: "u1" }, status: "authenticated" });
  });

  it("makes the new organization active by default", async () => {
    const service = fakeService([{ id: "org-1", name: "Acme" }]);
    await renderBridge(service);

    fireEvent.click(screen.getByRole("button", { name: "default" }));

    await waitFor(() => expect(screen.getByTestId("current")).toHaveTextContent("org-New"));
    expect(screen.getByRole("list")).toHaveTextContent("org-New");
    expect(localStorage.getItem(STORAGE_KEY)).toBe("org-New");
  });

  it("keeps the current organization and persists it when makeActive is false", async () => {
    const service = fakeService([{ id: "org-1", name: "Acme" }]);
    await renderBridge(service);

    fireEvent.click(screen.getByRole("button", { name: "no-switch" }));

    await waitFor(() => expect(screen.getByRole("list")).toHaveTextContent("org-New"));
    expect(screen.getByTestId("current")).toHaveTextContent("org-1");
    expect(localStorage.getItem(STORAGE_KEY)).toBe("org-1");
    expect(service.createOrganization).toHaveBeenCalledWith("New");
  });
});
