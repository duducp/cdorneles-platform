<p align="center">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="./apps/design-system/public/brand/logo-dark.png">
    <source media="(prefers-color-scheme: light)" srcset="./apps/design-system/public/brand/logo-light.png">
    <img alt="Cdorneles Platform" src="./apps/design-system/public/brand/logo-light.png" width="320">
  </picture>
</p>

# Cdorneles Platform

Multi-tenant SaaS/ERP platform: three user-facing applications, a shared design
system and an Appwrite backend.

[![CI](https://github.com/duducp/cdorneles-platform/actions/workflows/ci.yml/badge.svg)](https://github.com/duducp/cdorneles-platform/actions/workflows/ci.yml)

## Overview

```text
admin      internal Cdorneles administration
client     organization/tenant administration and operations
customer   end-customer experience
design-system  visual playground for the shared UI
```

The backend is Appwrite: **User** is the identity source of truth, a **Team** is
an Organization, and **Functions** are the security boundary for business
operations. Frontend authorization is UX only.

See [`ARCHITECTURE.md`](./ARCHITECTURE.md) and [`docs/decisions/`](./docs/decisions)
for the full picture. This repository currently contains the **Foundation**
(infrastructure and technical fundamentals) — no business modules yet.

## Tech stack

Next.js · TypeScript · pnpm workspaces · Mantine · Lucide · TanStack Query ·
TanStack Table · Mantine Form · Zod · Zustand · ESLint · Prettier · Vitest ·
Appwrite.

## Requirements

- Node.js `>= 22`
- pnpm `>= 11` (`corepack enable` recommended)
- [`uvx`](https://docs.astral.sh/uv/) — only for the Appwrite MCP server

## Repository structure

```text
apps/
  admin/ client/ customer/     # Next.js applications
  design-system/               # UI playground
packages/
  app/                         # composition layer shared by the apps
  tokens/ theme/ ui/           # design system
  auth/ tenant/ permissions/   # platform capabilities
  api-client/                  # single Appwrite access layer
  schemas/ types/ observability/
docs/                          # architecture, ADRs, conventions
tooling/                       # shared Next.js / PostCSS config
.github/workflows/ci.yml
```

Shared packages are consumed as TypeScript source (no per-package build step);
apps list them in `transpilePackages` from `tooling/next-config.mjs`.

### `@cdorneles/app`

The composition layer. It owns everything the applications used to copy
verbatim — the auth screens, `select-org`, the provider tree, the shell layout,
the request proxy, observability and the root metadata — exposed as factories
so each app keeps only what is genuinely its own:

```typescript
// providers.tsx
export const Providers = createProviders({ applicationId: "admin" });

// (shell)/layout.tsx
export default createShellLayout({ navItems: ADMIN_NAV });

// login/page.tsx
export { LoginPage as default } from "@cdorneles/app/auth";
export { loginMetadata as metadata } from "@cdorneles/app/auth-metadata";
```

The package is the default, not a cage: an app that needs different behaviour
replaces its thin file. The design-system does exactly that for the auth
screens (`redirectWhenAuthenticated={false}`, so the gallery stays viewable) and
keeps its own providers and select-org page.

It is also the only package that depends on Next.js. `@cdorneles/ui` stays
framework-agnostic and renders whatever it is handed — the shell takes the
anchor element (`next/link`) and the pending indicator (`useLinkStatus`) from
`@cdorneles/app`, which supplies both.

## Getting started

```bash
pnpm install
cp .env.example .env          # then fill in the values
pnpm dev:design-system        # http://localhost:3004
```

| App           | Command                 | Port |
| ------------- | ----------------------- | ---- |
| admin         | `pnpm dev:admin`        | 3001 |
| client        | `pnpm dev:client`       | 3002 |
| customer      | `pnpm dev:customer`     | 3003 |
| design-system | `pnpm dev:design-system`| 3004 |

## Environment variables

Copy [`.env.example`](./.env.example) to `.env` (git-ignored) and fill it in.
Only `NEXT_PUBLIC_*` values reach the browser; never put server keys in them.

| Variable                            | Scope        | Purpose                         |
| ----------------------------------- | ------------ | ------------------------------- |
| `NEXT_PUBLIC_APPWRITE_ENDPOINT`     | browser      | Appwrite endpoint               |
| `NEXT_PUBLIC_APPWRITE_PROJECT_ID`   | browser      | Appwrite project id             |
| `APPWRITE_API_KEY`                  | **server**   | Appwrite API key (never expose) |
| `NEXT_PUBLIC_SENTRY_DSN`            | browser      | Sentry DSN (optional)           |
| `SENTRY_AUTH_TOKEN`                 | **server**   | Sentry source-map upload token  |

`NEXT_PUBLIC_APP_VERSION` is not set by hand: `tooling/next-config.mjs` reads
the root `package.json` version (bumped by release-please) and bakes it in at
build time. Read it with `process.env.NEXT_PUBLIC_APP_VERSION` — no per-site
Appwrite variable is involved.

## Appwrite MCP (project-scoped)

This repository configures the Appwrite MCP server for opencode so agents can
inspect and manage the backend. Configuration lives in
[`opencode.json`](./opencode.json) and is scoped to the project (it overrides
any global `appwrite` MCP entry).

The MCP server runs `uvx mcp-server-appwrite` and needs three variables:
`APPWRITE_ENDPOINT`, `APPWRITE_PROJECT_ID`, `APPWRITE_API_KEY`.

**Values come from `.env`, never from the repository.** opencode resolves
`{env:VAR}` only from the shell environment, not from `.env` files, so
[`.opencode/plugin/appwrite-env.ts`](./.opencode/plugin/appwrite-env.ts) loads
`.env` and injects the values into the MCP environment. `.env` stays the single
source of truth for the apps and for the MCP.

```text
.env  ──►  .opencode/plugin/appwrite-env.ts  ──►  mcp.appwrite.environment
```

To point the MCP (and the apps) at another environment, edit `.env` and
**restart opencode** — configuration and plugins are loaded once at startup.

Verify the resolved configuration:

```bash
opencode debug config | grep APPWRITE_
```

The current setup targets a **self-hosted** Appwrite instance. Production values
are not committed; they are supplied through `.env`.

## Scripts

```bash
pnpm lint          # ESLint (flat config)
pnpm typecheck     # tsc --noEmit, all workspaces
pnpm test          # Vitest (unit tests)
pnpm build         # next build, all apps
pnpm format        # Prettier write
pnpm format:check  # Prettier check
```

## Quality gates

CI (`.github/workflows/ci.yml`) runs two jobs:

- `quality` — `install` → `lint` → `typecheck` → `test` → `build`, using pnpm
  with the lockfile cached;
- `functions` — the Go gate (`make -C functions build|vet|test`).

## Releases

Releases are automated with
[release-please](https://github.com/googleapis/release-please-action), driven by
[Conventional Commits](./CONTRIBUTING.md#commits).

`.github/workflows/release.yml` runs on every push to `main` and maintains a
**Release PR** containing:

- the version bump in the root `package.json`;
- `.release-please-manifest.json`;
- a generated `CHANGELOG.md`.

Merging that PR is what cuts a release: release-please creates the `vX.Y.Z` tag
and the GitHub Release, and the same run invokes both deploy workflows.

```text
push to main
  └─ release-please updates the Release PR
       └─ merge it
            ├─ tag vX.Y.Z + GitHub Release
            ├─ Deploy functions
            └─ Deploy sites
```

### When the Release PR appears

**You never create it.** On every push to `main`, release-please decides:

| State | What it does |
|---|---|
| No releasable commits since the last tag | nothing |
| Releasable commits, no Release PR open | **creates** the PR |
| Releasable commits, PR already open | **updates** it |

A commit is releasable when its type changes the version: `feat` (minor), `fix`
(patch), or a `!` / `BREAKING CHANGE` footer (major). Types like `docs`,
`chore`, `test` and `ci` do not change the version on their own, so they never
open a PR — they show up in the changelog once a releasable commit does.

Merging the PR closes it, so the **next** releasable commit opens a fresh one.
The only manual step in the whole flow is that merge.

The tag is `vX.Y.Z` with no component prefix: the whole repository — apps and
functions — versions together, matching the monorepo boundary decision in
[ADR-012](./docs/decisions/ADR-012-monorepo-boundary.md).

The version reaches the frontend as `NEXT_PUBLIC_APP_VERSION`, baked in at
build time from the root `package.json`.

### Deploying without a release

Both deploy workflows can be run by hand from the current `main`, for one
target or all of them:

```bash
gh workflow run "Deploy Functions" --ref main -f function=all
gh workflow run "Deploy Sites"     --ref main -f site=all
```

There is deliberately **no `push: tags` trigger**: release tags are created with
`GITHUB_TOKEN`, which does not trigger other workflows, so relying on the tag
would not work — and allowing it as well as the explicit call would risk two
deploys of different commits.

## Deploy

Both deploys run from the repository root and require the Appwrite CLI,
logged in and configured (`appwrite login` + `appwrite init project`, or
`appwrite client --endpoint ... --project-id ... --key ...`).

```bash
# Go Appwrite Functions
make -C functions deploy                    # every function
make -C functions deploy-resolve-grants     # one function

# Next.js apps on Appwrite Sites
make deploy-sites                           # every site
make deploy-site-admin                      # one site
```

The same scripts run in GitHub Actions:

- `.github/workflows/functions-deploy.yml`
- `.github/workflows/sites-deploy.yml`

Both are triggered two ways: by the release workflow when release-please cuts a
release, and by manual dispatch (one target or all). They deliberately have no
`push: tags` trigger — release tags are created with `GITHUB_TOKEN`, which does
not trigger other workflows, so the release workflow calls them explicitly.
Both deploy from the `production` environment, which can require reviewers.

Required secrets: `APPWRITE_ENDPOINT`, `APPWRITE_PROJECT_ID`,
`APPWRITE_API_KEY`. For the sites, the endpoint and project id are also pushed
as `NEXT_PUBLIC_APPWRITE_*` build-time variables.

Appwrite Sites expects a single Next.js project at the build root, which a
pnpm monorepo does not provide. The build therefore runs from the repository
root and a post-build step restructures the output — see
[`docs/development/appwrite-sites.md`](./docs/development/appwrite-sites.md)
for the contract, the pnpm symlink trap and a troubleshooting playbook.

## Documentation

- [`AGENTS.md`](./AGENTS.md) — engineering rules for agents and contributors
- [`ARCHITECTURE.md`](./ARCHITECTURE.md) — system architecture
- [`DEFINITION_OF_DONE.md`](./DEFINITION_OF_DONE.md) — completion checklist
- [`CONTRIBUTING.md`](./CONTRIBUTING.md) — contribution workflow
- [`docs/decisions/`](./docs/decisions) — architecture decision records

## Deferred (pending approval)

- Sentry provider in `@cdorneles/observability`
- Production Appwrite roles, permissions, features and domains
- Business modules (customers, orders, invoices, …)
