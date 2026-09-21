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
supports Next.js out of the box, without the OpenNext adapter.

Its Next.js runtime, however, assumes a **single project at the build root**.
Its `bundle.sh` runs from the configured output directory and looks for
`./standalone/server.js`; in a monorepo, Next.js nests that server at
`.next/standalone/apps/<app>/server.js`, so nothing is found and the runtime
falls back to a middleware path that does not exist. The runtime also boots
`server.js` from the output root and expects `next.config.*` there.

## Decision

Host the applications on **Appwrite Sites**, with `framework: nextjs`,
`buildRuntime: node-22` and `adapter: ssr`.

Because the apps are not self-contained, each site builds from the
**repository root** (the pnpm workspace must be present) and a post-build step
restructures the output into the layout Appwrite expects:

| Setting | Value |
|---|---|
| Install command | `corepack enable && pnpm install --frozen-lockfile` |
| Build command | `node scripts/build-appwrite-site.mjs <app>` |
| Output directory | `.next` |

`scripts/build-appwrite-site.mjs` builds the app, then:

1. copies `apps/<app>/.next/standalone/*` to a root `.next/standalone/`;
2. writes `.next/standalone/server.js` — a one-line wrapper delegating to the
   nested server — so `bundle.sh` detects a standalone build and flattens it;
3. copies `public/` and `.next/static/` beside the nested server;
4. rewrites pnpm's **absolute** symlinks as relative ones (see below).

`buildRuntime` is `node-22` because the instance offers `node-22` and
`node-25`, not `node-24`; `node-22` is LTS and still ships `corepack`.

Deployment is driven by `scripts/deploy-sites.sh`
(`make deploy-sites` / `make deploy-site-<app>`), and by
`.github/workflows/sites-deploy.yml` in CI. It creates each site if missing and
either triggers a VCS deployment or uploads the repository root.

## Consequences

- **The build context is the whole repository.** A change to any shared package
  affects every site. That is intended: the sites are one workspace.
- **pnpm symlinks are absolute.** `pnpm` links packages with absolute symlinks
  pointing at the machine that ran the build. Appwrite builds in one container
  and serves from another, so those links break and the app dies with
  `Cannot find module 'next'`. The build script rewrites them relative, which
  makes the tree relocatable. This is the single most important non-obvious
  detail of hosting this monorepo on Appwrite Sites.
- **`NEXT_PUBLIC_*` is inlined at build time**, so
  `NEXT_PUBLIC_APPWRITE_ENDPOINT` and `NEXT_PUBLIC_APPWRITE_PROJECT_ID` are set
  as site variables (the deploy script does this when the variables are present
  in the environment).
- **A site has no domain by default.** A proxy rule
  (`proxy_create_site_rule`) must be created for each site domain; without it
  the request never reaches the runtime. The deploy script does not create it.
- **Appwrite's automatic deployments are disabled.** Linking a site to the
  repository makes Appwrite redeploy whenever the production branch is updated,
  which would bypass the release workflow and send every merge to `main` to
  production. `providerBranches` is the only control (empty means "every
  branch"), so the script sets it to `__no-autodeploy__`. Deployments happen
  only from the release workflow or an explicit run. The Go functions are not
  VCS-linked, so they never auto-deploy.
- **Site domains use Traefik's default certificate.** Appwrite's sites router
  is a `HostRegexp` with `tls=true` and no `certresolver`, so the operator is
  expected to supply a wildcard certificate for `*.<sites domain>` (a wildcard
  cannot be issued over HTTP-01). This is a hosting-layer concern, not an
  application one.
- **The site request timeout caps at 60s**, so a runtime that fails to start
  surfaces as `408` rather than an error.
- **Deployment uploads source; Appwrite performs the build.** Build failures
  surface in the Appwrite console, not in the CI job that triggered the deploy.
- The apps' `start` scripts pin ports for local development; Appwrite supplies
  `PORT` to the standalone server, which honours it, so no change was needed.

## Alternatives considered

- **Publishing the shared packages to a registry** so each app builds
  standalone. Rejected: it inverts the deliberate source-consumption design,
  costs a build + publish pipeline and a private registry, degrades local
  development, and risks version skew between apps.
- **Hosting elsewhere** (Vercel, or Dokploy alongside Appwrite). Rejected for
  now: Appwrite Sites keeps one vendor and one deploy pipeline, and the
  monorepo problem is solvable with a build step.

## Related

- `docs/development/appwrite-sites.md` — the operational runbook
- `docs/decisions/ADR-011-go-functions.md` — the Functions counterpart
- `functions/README.md` — function deployment
