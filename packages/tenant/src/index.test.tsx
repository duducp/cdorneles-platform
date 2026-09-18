import "@testing-library/jest-dom/vitest";

import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { normalizeHost, resolveDomain, type DomainRoutingConfig } from "./domain";
import { TenantProvider, useTenant } from "./tenant-context";
import { isMemberOf, type Organization } from "./types";

const config: DomainRoutingConfig = {
  applicationHosts: {
    admin: "admin.example.com",
    client: "client.example.com",
    customer: "customer.example.com",
  },
  organizationHosts: { "portal.acme.com": "team-acme" },
};

describe("domain resolution", () => {
  it("normalizes hosts", () => {
    expect(normalizeHost("ADMIN.Example.com:3000")).toBe("admin.example.com");
    expect(normalizeHost("admin.example.com.")).toBe("admin.example.com");
  });

  it("maps standard hosts to applications", () => {
    expect(resolveDomain("client.example.com", config)).toEqual({
      kind: "application",
      application: "client",
      organizationId: null,
    });
  });

  it("maps custom hosts to organizations", () => {
    expect(resolveDomain("portal.acme.com", config)).toEqual({
      kind: "organization",
      application: null,
      organizationId: "team-acme",
    });
  });

  it("returns unknown for unmapped hosts", () => {
    expect(resolveDomain("nope.example.com", config).kind).toBe("unknown");
  });
});

describe("membership trust", () => {
  it("only trusts organization ids backed by a membership", () => {
    const memberships = [{ organizationId: "team-acme", roles: ["owner"] }];
    expect(isMemberOf("team-acme", memberships)).toBe(true);
    expect(isMemberOf("team-other", memberships)).toBe(false);
  });
});

describe("TenantProvider", () => {
  const organizations: Organization[] = [
    { id: "team-acme", name: "Acme" },
    { id: "team-globex", name: "Globex" },
  ];

  function Probe() {
    const { currentOrganization, switchOrganization } = useTenant();
    return (
      <div>
        <span data-testid="current">{currentOrganization?.name ?? "none"}</span>
        <button onClick={() => switchOrganization("team-globex")}>switch</button>
      </div>
    );
  }

  it("defaults to the first organization and switches on demand", () => {
    const onChange = vi.fn();
    render(
      <TenantProvider organizations={organizations} onOrganizationChange={onChange}>
        <Probe />
      </TenantProvider>,
    );

    expect(screen.getByTestId("current")).toHaveTextContent("Acme");

    fireEvent.click(screen.getByRole("button", { name: "switch" }));

    expect(screen.getByTestId("current")).toHaveTextContent("Globex");
    expect(onChange).toHaveBeenCalledWith(organizations[1]);
  });

  it("ignores unknown organization ids", () => {
    const onChange = vi.fn();
    let result: boolean | undefined;

    function BadSwitch() {
      const { switchOrganization } = useTenant();
      return (
        <button
          onClick={() => {
            result = switchOrganization("missing");
          }}
        >
          bad
        </button>
      );
    }

    render(
      <TenantProvider organizations={organizations} onOrganizationChange={onChange}>
        <BadSwitch />
      </TenantProvider>,
    );

    fireEvent.click(screen.getByRole("button", { name: "bad" }));

    expect(result).toBe(false);
    expect(onChange).not.toHaveBeenCalled();
  });
});
