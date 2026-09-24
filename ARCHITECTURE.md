# Carlos Dorneles Platform Architecture

## 1. Overview

Carlos Dorneles Platform is a multi-tenant SaaS/ERP platform with two user-facing applications and a shared design system.

```text
                         Cloudflare
                             │
                      ┌──────┼──────┐
                      │             │
                    admin         client
                      │             │
                      └──────┼──────┘
                             │
                    @cdorneles/*
                             │
                         Appwrite 2
          ┌──────────────────┼──────────────────┐
          │                  │                  │
        Auth               Teams            Functions
          │                  │                  │
        Users          Organizations      Business Rules
                                             │
                                  ┌──────────┼──────────┐
                                  │          │          │
                               Database   Storage   Messaging
```

## 2. Applications

```text
apps/admin
apps/client
apps/design-system
```

- `admin`: internal Carlos Dorneles administration.
- `client`: organization/tenant administration and operational panel.
- `design-system`: visual playground/documentation for shared UI.

## 3. Shared Packages

```text
@cdorneles/app
@cdorneles/ui
@cdorneles/theme
@cdorneles/tokens
@cdorneles/auth
@cdorneles/tenant
@cdorneles/permissions
@cdorneles/api-client
@cdorneles/schemas
@cdorneles/types
@cdorneles/observability
```

`@cdorneles/app` is the composition layer the applications share: the auth
screens, the provider tree, the shell layout, the request proxy, observability
and the root metadata, exposed as factories so each app keeps only its own
values (`applicationId`, navigation, titles). It is the one package allowed to
depend on Next.js; `@cdorneles/ui` stays framework-agnostic and renders whatever
the application hands it.

Packages should contain reusable platform capabilities, not business modules.

## 4. Backend

Appwrite 2 is the primary backend platform.

It provides:

- Authentication
- Teams
- Databases
- Functions
- Storage
- Messaging

No separate REST backend is required for the initial architecture.

`@cdorneles/api-client` abstracts Appwrite SDK usage and Function calls so application code does not scatter Appwrite-specific calls throughout the UI.

## 5. Identity and Tenancy

### Identity

Appwrite User/Account is the global identity source of truth.

### Tenant

Appwrite Team represents an Organization.

```text
Appwrite User
    │
    ├── Team A
    ├── Team B
    └── Team C
```

A user can belong to multiple organizations.

Team membership represents the user-to-organization relationship and contains Appwrite roles.

## 6. Authorization

There are two complementary authorization layers.

### Appwrite authorization

Used for resource-level access and data isolation where appropriate.

### Domain authorization

The platform maintains business permissions such as:

```text
customers.read
orders.create
invoices.approve
```

Functions enforce domain authorization.

Effective capability:

```text
Authentication
AND Membership
AND Organization active
AND Application access
AND Permission
AND Feature enabled
```

## 7. Database Model

Application-specific data:

```text
organization_profiles
roles
permissions
role_permissions
applications
role_applications
features
organization_features
domains
audit_logs
```

The database does not duplicate Appwrite identity, Teams, or memberships unless a concrete requirement later justifies a projection/cache.

## 8. Applications and Roles

Applications are a global registry:

```text
admin
client
```

Roles are organization-scoped metadata associated with Team roles.

Roles can reference existing permissions and applications.

## 9. Features

Features are globally defined capabilities.

Organizations receive feature enablement records.

Permissions answer:

> Can this user perform this capability?

Features answer:

> Is this capability enabled for this organization?

Both are required.

## 10. Domains

Standard domains identify an application:

```text
admin.cdorneles.com.br
client.cdorneles.com.br
```

A custom domain identifies an organization:

```text
portal.example.com
```

An organization may have at most one custom domain.

A custom domain does not permanently select one panel. The authenticated user can access applications enabled for that organization.

## 11. White-label

Organization-specific branding includes:

```text
displayName
logoLight
logoDark
favicon
primaryColor
secondaryColor
defaultTheme
```

Color inputs are converted into semantic/component tokens and validated for contrast.

## 12. Observability

```text
Frontend ──────────> @cdorneles/observability ──> Sentry
Functions ─────────> @cdorneles/observability ──> Sentry
Functions ─────────> Appwrite Logs
Infrastructure ────> Prometheus ────────────────> Grafana
```

OpenTelemetry is a planned evolution, not a Foundation requirement.

Audit logs are distinct from technical logs and observability.

## 13. Design System

Primary UI framework: Mantine.

Official icon system: Lucide.

Design direction:

> Professional SaaS / Enterprise Dashboard

Rules:

- controlled density;
- high readability;
- minimal elevation;
- no glassmorphism;
- no decorative gradients;
- subtle motion;
- accessible components.

Default UI typography is 14px.

## 14. Responsive Design

Breakpoints:

```text
xs   0
sm   576
md   768
lg   1024
xl   1280
xxl  1536
```

All applications share one responsive design system.

## 15. State

- TanStack Query: server state.
- Mantine Form: form state.
- Zod: validation.
- Zustand: only genuine client/global state.

## 16. Security Boundary

React components, route guards, PermissionGate, and FeatureGate are not security boundaries.

Appwrite Functions are the security boundary for business operations.

Sensitive operations must be re-authorized server-side.

## 17. Architecture Evolution

Architectural changes require an ADR or update to an existing ADR and explicit approval before implementation.

The architecture favors simplicity, reuse, maintainability, and explicit security boundaries.
