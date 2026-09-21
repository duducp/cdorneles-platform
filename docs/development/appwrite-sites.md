# Deploying the apps to Appwrite Sites

Operational guide for hosting the Next.js apps on Appwrite Sites. For the
rationale see [ADR-013](../decisions/ADR-013-appwrite-sites-hosting.md).

## Commands

```bash
make deploy-sites              # every site
make deploy-site-design-system # one site
```

`scripts/deploy-sites.sh` creates each site if missing, sets its build-time
variables, then deploys. It picks the mode automatically:

- **VCS** — if the site is linked to the repository (`providerRepositoryId`
  set), it triggers a build from the connected branch. `providerRootDirectory`
  must be the **repository root**, because the build needs the pnpm workspace.
- **Upload** — otherwise it uploads the repository root. The CLI respects
  `.gitignore`, so `node_modules/`, `.next/` and `dist/` are excluded
  (~700 KB of source).

Set `SITE_INSTALLATION_ID` and `SITE_REPOSITORY_ID` (from the Console's Git
connection) to have the script manage the link: new sites are created linked,
and existing sites without a link are updated. Without them, sites are left
unlinked and deploy by upload.

### Automatic deployments are disabled on purpose

A VCS-linked site makes Appwrite **auto-deploy whenever the production branch
is updated**, which would push every merge to `main` straight to production and
bypass the release workflow. `providerBranches` is the only lever — leaving it
empty means "every branch" — so the script sets it to a pattern that never
matches:

```bash
--provider-branches "__no-autodeploy__"
```

Override with `SITE_NO_AUTODEPLOY_PATTERN`. Explicit deployments
(`create-vcs-deployment`, which is what the release workflow runs) are
**unaffected** — verified: an explicit deployment still builds and activates
with the pattern in place.

The Go functions are not VCS-linked at all, so they never auto-deploy.

In CI these come from repository **variables** (not secrets — they identify the
connection, not a credential):

```bash
gh variable set SITE_INSTALLATION_ID --repo <owner>/<repo>
gh variable set SITE_REPOSITORY_ID   --repo <owner>/<repo>
```

> `appwrite sites update` replaces unspecified fields, so the script always
> sends the full configuration alongside the provider flags. Sending only the
> provider flags wipes the build settings.

## What Appwrite's Next.js runtime expects

Appwrite's runtime bundles SSR from the configured **output directory**:

```bash
# runtimes/javascript/helpers/next-js/bundle.sh
cd "$OPEN_RUNTIMES_OUTPUT_DIRECTORY"
STANDALONE_ENTRYPOINT="./standalone/server.js"
if [ -e "$STANDALONE_ENTRYPOINT" ]; then
    # flatten .next/standalone/* into the output directory
```

and then boots `./server.js` from that directory with `PORT=3000`.

Two consequences drive our configuration:

1. **The output directory is `.next`, not `.next/standalone`.** With
   `.next/standalone` the runtime looks for
   `.next/standalone/standalone/server.js`, finds nothing, and falls back to a
   middleware entrypoint that does not exist here.
2. **`server.js` must exist at the root of `.next/standalone`.** In a monorepo
   Next.js nests it at `apps/<app>/server.js`.

## Why the build needs a post-build step

`scripts/build-appwrite-site.mjs <app>`:

1. runs `pnpm --filter @cdorneles/<app> build` from the repository root, so the
   workspace and lockfile are present;
2. copies `apps/<app>/.next/standalone/*` to a root `.next/standalone/`;
3. writes `.next/standalone/server.js` delegating to the nested server;
4. copies `public/` and `.next/static/` beside the nested server;
5. **rewrites pnpm's absolute symlinks as relative ones.**

### The symlink trap

`pnpm` links packages with **absolute** symlinks pointing at the machine that
ran the build:

```
apps/design-system/node_modules/next
  -> /Volumes/Lexar/oracle/admin/apps/design-system/.next/standalone/node_modules/.pnpm/next@…/node_modules/next
```

Appwrite builds in one container and serves from another, so that path does not
exist at runtime and the app crashes on boot:

```
Error: Cannot find module 'next'
Require stack:
- /usr/local/server/src/function/apps/design-system/server.js
- /usr/local/server/src/function/server.js
```

The build script rewrites every absolute symlink under `.next/standalone` that
points inside a `.next/standalone` tree into a relative link. Relative links
survive both the flattening `bundle.sh` performs and the move into the runtime
container.

## Domains and TLS

**A site has no domain by default.** Without a proxy rule Traefik has no router
for the host and the request never reaches the runtime — it returns `404`
immediately, or `500`/`408` when Appwrite tries to screenshot the deployment.

`scripts/deploy-sites.sh` creates it automatically after each deploy:

```bash
appwrite proxy create-site-rule --site-id <site> --domain <site>.<suffix>
appwrite proxy update-rule-status --rule-id <id>   # triggers verification
```

The suffix comes from `SITE_DOMAIN_SUFFIX` (default `sites.cdorneles.com.br`);
set it empty to skip domain management. `update-rule-status` starts DNS
verification, after which Appwrite provisions a TLS certificate for the domain
asynchronously.

To do it by hand, the console/MCP equivalent is
`proxy_create_site_rule --domain <site>.<suffix> --site_id <site>`.

**TLS follows domain verification.** Appwrite's sites wildcard router is
declared as

```yaml
traefik.http.routers.appwrite-sites-wildcard-secure.rule=HostRegexp(`^.+\.${_APP_DOMAIN_SITES}$`)
traefik.http.routers.appwrite-sites-wildcard-secure.tls=true
```

with **no `certresolver`**, so before a domain is verified Traefik serves its
self-signed default certificate (`CN=TRAEFIK DEFAULT CERT`) and browsers reject
the connection. `update-rule-status` triggers verification, and Appwrite
provisions a per-domain certificate afterwards. If a domain stays on the
default certificate, the fallback is a wildcard certificate for
`*.<suffix>` issued through a DNS-01 challenge (Cloudflare, Route53, …), since
a wildcard cannot be issued over HTTP-01.

## Troubleshooting playbook

Start by reading the **runtime container** log. The container is named
`exc1-<projectId>-<deploymentId>` and the runtime lives in the same Docker host
as Appwrite (it is created dynamically by the executor, so it does not appear
in the Appwrite compose's service list):

```bash
# runtime containers, including crashed/restarting ones
sudo docker ps -a --format "table {{.Names}}\t{{.Image}}\t{{.Status}}" | grep -i openruntimes

# the crash reason
sudo docker logs --tail 80 exc1-<projectId>-<deploymentId>
```

| Symptom | Cause | Fix |
|---|---|---|
| `Cannot find module 'next'` | Absolute pnpm symlinks | Build with `scripts/build-appwrite-site.mjs` |
| `mv: can't rename 'next.config.*'` | No `next.config.*` at the build root | Same script (it writes one) |
| `ERR_PNPM_NO_LOCKFILE` | Build ran in `apps/<app>` instead of the repo root | `providerRootDirectory` must be the repo root |
| `404` immediately | No proxy rule / domain for the site | Create one with `proxy_create_site_rule` |
| `408` at 60s | Runtime never started | Check the runtime container log |
| `TRAEFIK DEFAULT CERT` | No wildcard certificate | Configure DNS-01 in Traefik |

Useful Appwrite-side checks:

```bash
# build log of a deployment
appwrite sites get-deployment --site-id <site> --deployment-id <id> --raw

# request log (status + duration)
appwrite sites list-logs --site-id <site> --limit 5

# what the executor actually received
sudo docker exec exc1 env | grep -E "RUNTIMES|IMAGES"
```

## Gotchas

- **Build runtimes depend on the instance.** This one offers `node-22`,
  `node-24` and `node-26`. We use `node-24` (LTS, matches CI, still ships
  corepack). List them with
  `appwrite functions list-runtimes` (there is no `sites list-runtimes`).
- **Site request timeout caps at 60s.** A runtime that fails to start surfaces
  as `408`, not as a startup error.
- **Screenshot capture is a good health signal.** `Screenshot capturing
  finished` means the app responded; a deployment that hangs there is not
  serving.
- **`appwrite sites update` replaces unspecified fields.** Omitting the
  `--provider-*` flags clears the VCS link. Always pass the full set when
  updating a VCS-linked site.
- **The Appwrite CLI uses kebab-case flags** (`--function-id`,
  `create-deployment`) and `--scopes` is a string array, so each scope needs
  its own flag.
- **A tag pushed with `GITHUB_TOKEN` does not trigger other workflows**, which
  is why the release workflow invokes the deploy via `workflow_call`.
