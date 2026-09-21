# ADR-014: Shared Application Composition in `@cdorneles/app`

## Status

Accepted

## Context

The platform has three product applications (`admin`, `client`, `customer`) that
are the same application with different navigation, titles and audience. The
auth screens, the provider tree, the shell layout, the request proxy and the
observability bootstrap were identical in all three — copied, and therefore
drifting.

The shared packages did not absorb this duplication, and could not as they were
scoped:

- `@cdorneles/ui` is a **design system**: thin Mantine wrappers, theme-aware and
  framework-agnostic. It deliberately imports no Next.js — no `next/link`, no
  `useRouter`, no `next/navigation`.
- `@cdorneles/auth` and `@cdorneles/tenant` are **framework-agnostic** too.
  `OrgGuard`, for example, takes an `onRedirectToSelectOrg` callback instead of
  importing a router, so the same component could serve a non-Next consumer.

The pieces that needed sharing are the opposite: they are Next-specific
composition — a root layout, a route group's shell, a `proxy.ts`, per-app
metadata. Putting them in `@cdorneles/ui` would have forced a Next dependency
into the design system. Leaving them per-app meant maintaining three copies of
the same wiring.

## Decision

Introduce `@cdorneles/app` as the **composition layer** the applications share.

It exports factories rather than finished components, so each application keeps
its own values and nothing else:

| Factory | Application supplies |
|---|---|
| `createProviders({ applicationId })` | the Appwrite application id |
| `createShellLayout({ navItems })` | its navigation |
| `createMetadata({ title, description })` | its title and description |
| `proxy` | a literal `config.matcher` (Next rejects a re-exported `config`) |
| `SelectOrgPage`, the auth pages | at most `redirectWhenAuthenticated` |

`@cdorneles/app` is **the one package allowed to depend on Next.js**. The
framework boundary is one-directional:

- `@cdorneles/ui` renders whatever element or component it is handed. The shell
  takes `linkComponent` (a Next app passes `next/link`) and `pendingComponent`
  (a Next app passes a `useLinkStatus` indicator). The design system stays free
  of the framework and its tests stay framework-free.
- `@cdorneles/app` imports `next/link`, `next/navigation` and Next's metadata
  types, and supplies those pieces to the design system.

## Consequences

- `apps/<app>/src` is reduced to the application's own values: providers,
  layout, metadata, the route files that re-export the shared pages, and its
  `proxy.ts`. `apps/admin/src` went from ~800 to ~186 lines.
- A change to the shared composition lands once, in one package.
- `@cdorneles/app` must stay free of application-specific values. Anything an
  app would need to configure belongs in a factory argument, not in the package.
- The dependency direction is now explicit: apps → `@cdorneles/app` →
  (`@cdorneles/ui`, `@cdorneles/auth`, `@cdorneles/tenant`). The reverse must
  never be introduced, and `@cdorneles/ui` must never import Next.js.
- `apps/design-system` is intentionally not a consumer: it is a playground with
  no session and no organization, so it keeps its own simpler provider tree and
  passes `redirectWhenAuthenticated={false}` on the auth pages.
- The duplication is prevented by convention, not by the type system. A new
  shared screen must be added to `@cdorneles/app`; nothing fails if it is copied
  into an app instead.

## Alternatives considered

- **Put the shared screens in `@cdorneles/ui`.** Rejected: it would add a Next.js
  dependency to the design system and break its framework-agnostic boundary.
- **Publish the composition as a separate repository or npm package.** Rejected:
  it is consumed only by this monorepo, and splitting it would reintroduce the
  cross-repo coordination cost ADR-012 rejected.
- **Keep the copies and accept the drift.** Rejected: the copies had already
  diverged in behaviour (session bootstrap, post-auth redirect, error mapping),
  which is exactly the class of bug that is expensive to find three times.

## Revisit when

- a non-Next consumer needs the shell or the auth screens;
- `@cdorneles/app` accumulates application-specific conditionals, which would
  mean the factories are too narrow;
- the applications diverge enough that they are no longer one product with
  different navigation.
