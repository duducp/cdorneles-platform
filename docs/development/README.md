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

## Commands

```text
pnpm dev:admin | dev:client | dev:customer | dev:design-system
pnpm lint
pnpm typecheck
pnpm test
pnpm build
pnpm format
pnpm format:check
```

## Environment variables

Copy `.env.example` to `.env.local` per app. Only `NEXT_PUBLIC_*` values reach
the browser. Appwrite server keys and Sentry auth tokens are server-side only.

## Testing

Unit tests use Vitest with jsdom and Testing Library. Tests live next to the
source as `*.test.ts(x)` under `packages/*/src` and run from the repository
root via `pnpm test`.

## Intentionally deferred

The Foundation deliberately stops short of these, pending explicit approval:

- the Sentry provider for `@cdorneles/observability`;
- Appwrite project ids, endpoints, domains and production roles/permissions;
- all business modules.
