# ADR-007: Custom Domains

## Status

Accepted

## Context

Organizations may access the platform via:
1. **Standard domain** — `app.cdorneles.com` (shared across all tenants)
2. **Custom domain** — `portal.customer.com` (white-labeled per tenant)

Domain resolution determines which organization context is active based on the hostname.

## Decision

### Standard Domain (`app.cdorneles.com`)

- Organization is determined by the authenticated user's team membership
- If the user belongs to multiple organizations, the org picker is shown
- The active organization is stored in localStorage and persists across sessions
- The `domains` table is NOT consulted for standard domains

### Custom Domain (`portal.customer.com`)

- The `domains` table maps hostname → organizationId
- On page load, the middleware resolves the hostname against `domains`
- The resolved organization is used as the domain-implied organization
- User must still be authenticated AND have a valid membership (ADR-004)
- Custom domains override the standard domain resolution

### Resolution Order (ADR-004)

1. **Domain-implied organization** (from custom domain hostname)
2. **User preference** (from localStorage)
3. **First matching membership** (fallback)

### Middleware Integration

The Next.js middleware reads the `cdorneles-session` cookie for route protection.
Domain resolution happens client-side via the `TenantBridge` + `resolveActiveOrganization`
because the Appwrite Web SDK handles session management client-side.

### Security

- A custom domain does NOT grant access — the user must still authenticate
- A custom domain does NOT bypass membership checks
- The `domains` table is read-only from the client; only Appwrite Functions can modify it
- Invalid or unknown hostnames fall back to standard domain behavior

## Consequences

- White-label branding is applied automatically when a custom domain is detected
- Organizations can have multiple custom domains pointing to the same tenant
- Domain resolution is cheap (single table lookup) and can be cached
