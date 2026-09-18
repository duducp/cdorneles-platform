import type { ApplicationId } from "@cdorneles/types";

/**
 * Domain routing configuration (ADR-007).
 *
 * Values are injected by the application (from configuration/env); the
 * foundation never hardcodes real domains. Standard hosts identify the
 * application; custom hosts identify an organization.
 */
export interface DomainRoutingConfig {
  applicationHosts: Partial<Record<ApplicationId, string>>;
  organizationHosts?: Record<string, string>;
}

export type DomainResolution =
  | { kind: "application"; application: ApplicationId; organizationId: null }
  | { kind: "organization"; application: null; organizationId: string }
  | { kind: "unknown"; application: null; organizationId: null };

/** Lowercases, strips the port and any trailing dot from a host. */
export function normalizeHost(host: string): string {
  const withoutPort = host.split(":")[0] ?? "";
  return withoutPort.trim().toLowerCase().replace(/\.$/, "");
}

export function resolveDomain(host: string, config: DomainRoutingConfig): DomainResolution {
  const normalized = normalizeHost(host);

  for (const [application, configuredHost] of Object.entries(config.applicationHosts)) {
    if (configuredHost && normalizeHost(configuredHost) === normalized) {
      return {
        kind: "application",
        application: application as ApplicationId,
        organizationId: null,
      };
    }
  }

  const organizationId = config.organizationHosts?.[normalized];
  if (organizationId) {
    return { kind: "organization", application: null, organizationId };
  }

  return { kind: "unknown", application: null, organizationId: null };
}
