# Development

Development is governed by:

- `AGENTS.md`
- `DEFINITION_OF_DONE.md`
- `CONTRIBUTING.md`

AI agents should search existing implementations before adding new abstractions and must validate changes before completion.

## Monorepo conventions

- Package manager: pnpm workspaces. Dependency versions live in the `catalog`
  section of `pnpm-workspace.yaml`; workspace packages reference `catalog:`.
- `apps/*` depend on `packages/*`, never the other way around. Shared packages
  must not depend on application code.
- Shared packages are consumed as TypeScript **source**. Each package exposes
  `./src/index.ts` and apps list them in `transpilePackages`
  (`tooling/next-config.mjs`). There is no per-package build step.
- Cross-app configuration is shared from `tooling/` (Next.js, PostCSS) and the
  repository root (TypeScript, ESLint, Prettier, Vitest). Do not duplicate it
  inside each app.
- Dependency direction: `types` → `tokens` → `theme` → `ui`; `permissions`,
  `schemas`, `auth`, `tenant`, `api-client`, `observability` sit beside `ui`
  and depend only on lower-level packages.
- `@cdorneles/app` sits **above** the others: it is the composition layer the
  applications share (auth screens, providers, shell, proxy, metadata), and the
  only package allowed to depend on Next.js. `@cdorneles/ui` must never import
  Next.js — it renders whatever the application hands it. See
  [ADR-014](../decisions/ADR-014-shared-app-composition.md).

## Commands

```text
pnpm provision                    # seed the Appwrite schema (one-off per environment)
pnpm seed:dev                     # demo users/organizations for local login (idempotent)
pnpm dev:admin | dev:client | dev:design-system
pnpm lint
pnpm typecheck
pnpm test
pnpm build
pnpm format
pnpm format:check
```

Git hooks run locally on every commit: `pre-commit` formats and lints staged
files (`lint-staged`), `commit-msg` validates Conventional Commits
(`commitlint`), and `pre-push` runs `pnpm typecheck`. Bypass the hooks for a
single command with `HUSKY=0 git commit ...`.
```

See [Local development login](./local-login.md) for the full local login flow
(provision → seed → dev app) and the demo accounts. See
[Resource pages](./resource-pages.md) for the list/add/change page pattern,
the route registry and permission-gated CRUD.

`pnpm build` builds the workspace **serially** (`--workspace-concurrency=1`).
Concurrent `next build` runs race while resolving `next/font/google` and fail
with `next/font/google queries have exactly one entry`; serializing the three
apps is the reliable fix. Revisit only if the font moves off `next/font/google`.

## Environment variables

Copy `.env.example` to `.env.local` per app. Only `NEXT_PUBLIC_*` values reach
the browser. Appwrite server keys and Sentry auth tokens are server-side only.

## Observability

`@cdorneles/observability` is the provider-agnostic facade (ADR-009). Sentry is
the initial provider, but the package stays framework-agnostic: each app owns the
`@sentry/nextjs` dependency and injects the module (`SentryLike`) into
`createProviders` / `initObservability`. The Sentry provider is installed only
when both the injected SDK and `NEXT_PUBLIC_SENTRY_DSN` are present; otherwise
the noop provider is used.

- `@sentry/cli`'s build script is disabled (`allowBuilds` in
  `pnpm-workspace.yaml`), so no source maps are uploaded.
- **Sentry is not initialized yet.** There is no `instrumentation-client.ts`,
  `sentry.server.config.ts` or `withSentryConfig`, so the SDK is a no-op even
  when a DSN is set. Add those to start reporting.

## Testing

Unit tests use Vitest with jsdom and Testing Library. Tests live next to the
source as `*.test.ts(x)` under `packages/*/src` and `apps/*/src` and run from
the repository root via `pnpm test`.

Mantine gotchas:

- Style props (`mih`, `w`, `p`, …) convert numeric and `px` values to `rem`:
  `mih="240px"` renders `min-height: calc(15rem * var(--mantine-scale))`. Assert
  on `element.style.minHeight` with a `rem` value — `toHaveStyle({ minHeight:
  "240px" })` will not match.
- `container.firstChild` is Mantine's injected `<style data-mantine-styles>`
  element, not the component under test. Query the component by role or test id.

## Intentionally deferred

The Foundation deliberately stops short of these, pending explicit approval:

- the Sentry `init` wiring (instrumentation files + `withSentryConfig`);
- Appwrite project ids, endpoints, domains and production roles/permissions;
- all business modules.
