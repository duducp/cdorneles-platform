# ADR-013: Hosting the Applications on Appwrite Sites

## Status

Accepted

## Context

The platform ships four Next.js (App Router) applications that need a host:
`admin`, `client`, `customer` and `design-system`. They live in a pnpm
monorepo and consume the shared packages (`@cdorneles/ui`, `@cdorneles/auth`,
…) as **TypeScript source** via `transpilePackages`, not as published
packages. `outputFileTracingRoot` points at the repository root.

Appwrite Sites runs Next.js in a managed container-based Node environment and
supports Next.js out of the box, without the OpenNext adapter. A site is
configured with a framework, a build runtime, an adapter (`static` or `ssr`),
and install/build/output commands.

## Decision

Host the applications on **Appwrite Sites**, with `framework: nextjs`,
`buildRuntime: node-24` and `adapter: ssr`.

Because the apps are not self-contained, each site builds from the
**repository root** rather than from `apps/<name>`:

| Setting | Value |
|---|---|
| Install command | `corepack enable && pnpm install --frozen-lockfile` |
| Build command | `pnpm --filter @cdorneles/<app> build` |
| Output directory | `apps/<app>/.next` |

Deployment is driven by `scripts/deploy-sites.sh`, which creates each site if
missing and uploads the repository root. The Appwrite CLI respects
`.gitignore` (and adds any per-resource `ignore` rules), so `node_modules/`,
`.next/` and `dist/` are excluded and the upload stays around 5 MB.

`make deploy-sites` / `make deploy-site-<app>` run it locally;
`.github/workflows/sites-deploy.yml` runs it in CI, gated by a `verify` job and
the `production` environment.

## Consequences

- The build context is the whole repository, so a change to any shared package
  affects every site. That is intended: the sites are one workspace.
- `NEXT_PUBLIC_*` values are inlined at **build** time, so
  `NEXT_PUBLIC_APPWRITE_ENDPOINT` and `NEXT_PUBLIC_APPWRITE_PROJECT_ID` are set
  as site variables (the deploy script does this when the variables are present
  in the environment).
- The build environment must provide pnpm. `corepack enable` is used because
  `packageManager` is pinned in the root `package.json`.
- Deployment uploads source; Appwrite performs the build. Build failures surface
  in the Appwrite console, not in the CI job that triggered the deploy.

## Open items

- The apps' `start` scripts pin ports (`next start --port 3001…3004`). Appwrite
  Sites manages the container port, so the start command may need to honour
  `PORT` instead. To be confirmed against the first deployment.
- Whether `corepack` is available in the Appwrite Sites build runtime is
  unverified; if not, the install command falls back to `npx pnpm@11.20.0`.
