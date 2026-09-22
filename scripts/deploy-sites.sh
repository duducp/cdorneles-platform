#!/usr/bin/env bash
# Creates (if missing) and deploys the Next.js apps to Appwrite Sites.
#
# Usage:
#   ./scripts/deploy-sites.sh                  # every site
#   ./scripts/deploy-sites.sh admin            # one site
#   ./scripts/deploy-sites.sh admin client
#
# Two deployment modes, chosen per site:
#
#   1. VCS (preferred). If the site is linked to the Git repository
#      (`providerRepositoryId` set), the deployment is triggered from the
#      connected repository. `providerRootDirectory` must be the repository
#      root, because the build needs the pnpm workspace.
#
#   2. Upload. If the site is not VCS-linked, the repository root is uploaded.
#      The CLI respects .gitignore, so node_modules/, .next/ and dist/ are
#      excluded.
#
# In both modes the build runs scripts/build-appwrite-site.mjs, which builds the
# app and restructures the standalone output into the layout Appwrite's Next.js
# runtime expects. See that script for why the restructuring is necessary.
#
# Requirements:
#   - The Appwrite CLI installed and logged in (`appwrite login` +
#     `appwrite init project`), or configured in non-interactive mode
#     (`appwrite client --endpoint ... --project-id ... --key ...`).
#
# Environment:
#   SITE_BUILD_RUNTIME   build runtime (default node-24; LTS, and it still
#                        ships corepack. node-25+ dropped corepack, so those
#                        would need a different install command.)
#   SITE_VCS_BRANCH      branch to deploy from (default main)
#   SITE_DOMAIN_SUFFIX   domain suffix for the per-site proxy rule
#                        (default sites.cdorneles.com.br). Set it empty to skip
#                        domain management entirely.
#   SITE_INSTALLATION_ID Appwrite VCS installation id. When set together with
#   SITE_REPOSITORY_ID   SITE_REPOSITORY_ID (both from the Console's Git
#                        connection), the script links the repository: new
#                        sites are created linked, and existing sites without a
#                        link are updated. Without them, sites are left
#                        unlinked and deploy by upload.
#   SITE_NO_AUTODEPLOY_PATTERN
#                        Branch pattern for Appwrite's automatic deployments
#                        (default __no-autodeploy__, which matches nothing).
#                        Deploys therefore come only from this script and the
#                        release workflow.
#   NEXT_PUBLIC_APPWRITE_ENDPOINT
#   NEXT_PUBLIC_APPWRITE_PROJECT_ID
#                        build-time variables, set on each site when present
set -euo pipefail

cd "$(dirname "$0")/.."

FRAMEWORK="nextjs"
# node-24 is LTS and matches the Node version CI builds with. It still ships
# corepack, which the install command relies on (corepack was removed in 25).
BUILD_RUNTIME="${SITE_BUILD_RUNTIME:-node-24}"
ADAPTER="ssr"
INSTALL_COMMAND="corepack enable && pnpm install --frozen-lockfile"
VCS_BRANCH="${SITE_VCS_BRANCH:-main}"
DOMAIN_SUFFIX="${SITE_DOMAIN_SUFFIX:-sites.cdorneles.com.br}"
# Appwrite auto-deploys a VCS-linked site whenever the production branch is
# updated, which would bypass the release workflow and push every merge to
# main straight to production. `providerBranches` is the only lever — leaving it
# empty means "every branch" — so restrict it to a pattern that never matches.
# Explicit deployments (create-vcs-deployment) are unaffected.
NO_AUTODEPLOY_PATTERN="${SITE_NO_AUTODEPLOY_PATTERN:-__no-autodeploy__}"

ALL_SITES=(admin client design-system)

is_known() {
  local candidate="$1" known
  for known in "${ALL_SITES[@]}"; do
    [ "$candidate" = "$known" ] && return 0
  done
  return 1
}

site_exists() {
  appwrite sites get --site-id "$1" >/dev/null 2>&1
}

# A site is VCS-linked when the API reports a provider repository id.
site_is_vcs_linked() {
  appwrite sites get --site-id "$1" --json 2>/dev/null \
    | grep -Eq '"providerRepositoryId"[[:space:]]*:[[:space:]]*"[^"]+"'
}

build_command() {
  echo "node scripts/build-appwrite-site.mjs $1"
}

# Appwrite's Next.js runtime bundles SSR from this directory: its bundle.sh
# cd's here and looks for ./standalone/server.js. Our build script places the
# wrapper at .next/standalone/server.js, so the output directory is `.next`.
output_directory() {
  echo ".next"
}

set_variable() {
  local site_id="$1" var_id="$2" key="$3" value="$4"
  appwrite sites create-variable \
    --site-id "$site_id" --variable-id "$var_id" --key "$key" --value "$value" --force >/dev/null 2>&1 \
    || appwrite sites update-variable \
      --site-id "$site_id" --variable-id "$var_id" --key "$key" --value "$value" --force >/dev/null 2>&1 \
    || echo "   (could not set $key)"
}

site_domain() {
  echo "$1.${DOMAIN_SUFFIX}"
}

# Proxy rule ids are the MD5 of the domain; computing that portably is awkward,
# so look the rule up by domain instead.
proxy_rule_id() {
  appwrite proxy list-rules --filter "domain=$1" --json 2>/dev/null \
    | node -e 'let raw="";process.stdin.on("data",c=>raw+=c).on("end",()=>{try{const p=JSON.parse(raw);const rules=p.rules??p;if(Array.isArray(rules)&&rules[0]&&rules[0].$id)process.stdout.write(rules[0].$id)}catch{}})'
}

# A site has no domain by default. Without a proxy rule Traefik has no router
# for the host and the request never reaches the runtime.
ensure_domain() {
  local site="$1" domain="$2" rule_id

  rule_id="$(proxy_rule_id "$domain")"

  if [ -n "$rule_id" ]; then
    echo "==> Domain $domain already exists"
  else
    echo "==> Creating domain $domain"
    appwrite proxy create-site-rule \
      --site-id "$site" --domain "$domain" --force >/dev/null 2>&1 \
      || echo "   (could not create the proxy rule for $domain)"
    rule_id="$(proxy_rule_id "$domain")"
  fi

  if [ -n "$rule_id" ]; then
    # Triggers DNS verification; on success Appwrite provisions a TLS
    # certificate for the domain asynchronously.
    appwrite proxy update-rule-status --rule-id "$rule_id" --force >/dev/null 2>&1 \
      || echo "   (could not trigger verification for $domain)"
  fi
}

if [ "$#" -gt 0 ]; then
  SITES=("$@")
else
  SITES=("${ALL_SITES[@]}")
fi

for site in "${SITES[@]}"; do
  if ! is_known "$site"; then
    echo "Unknown site: $site" >&2
    echo "Known sites: ${ALL_SITES[*]}" >&2
    exit 1
  fi
done

for site in "${SITES[@]}"; do
  build_cmd="$(build_command "$site")"
  out_dir="$(output_directory "$site")"

  base_args=(
    --framework "$FRAMEWORK"
    --build-runtime "$BUILD_RUNTIME"
    --adapter "$ADAPTER"
    --install-command "$INSTALL_COMMAND"
    --build-command "$build_cmd"
    --output-directory "$out_dir"
  )

  provider_args=()
  if [ -n "${SITE_INSTALLATION_ID:-}" ] && [ -n "${SITE_REPOSITORY_ID:-}" ]; then
    provider_args=(
      --installation-id "$SITE_INSTALLATION_ID"
      --provider-repository-id "$SITE_REPOSITORY_ID"
      --provider-branch "$VCS_BRANCH"
      # The repository root, not apps/<site>: the build needs the pnpm
      # workspace and the lockfile, which only exist at the root.
      --provider-root-directory "."
      # Keep Appwrite from auto-deploying on every push to the branch.
      --provider-branches "$NO_AUTODEPLOY_PATTERN"
    )
  fi

  if site_exists "$site"; then
    # Keep the site configuration in sync (build runtime, commands, provider).
    # Only when the provider args are present: `sites update` replaces
    # unspecified fields, so updating without them would clear the VCS link.
    if [ "${#provider_args[@]}" -gt 0 ]; then
      echo "==> Updating $site"
      appwrite sites update \
        --site-id "$site" \
        --name "$site" \
        "${base_args[@]}" \
        "${provider_args[@]}" \
        --force
    else
      echo "==> $site already exists"
    fi
  else
    echo "==> Creating $site"
    appwrite sites create \
      --site-id "$site" \
      --name "$site" \
      "${base_args[@]}" \
      ${provider_args[@]+"${provider_args[@]}"} \
      --force
  fi

  # Variable ids are unique per project, not per site, so they must be
  # namespaced by site — reusing "appwrite-endpoint" would silently fail for
  # every site after the first.
  if [ -n "${NEXT_PUBLIC_APPWRITE_ENDPOINT:-}" ]; then
    echo "==> Setting NEXT_PUBLIC_APPWRITE_ENDPOINT on $site"
    set_variable "$site" "$site-appwrite-endpoint" "NEXT_PUBLIC_APPWRITE_ENDPOINT" "$NEXT_PUBLIC_APPWRITE_ENDPOINT"
  fi
  if [ -n "${NEXT_PUBLIC_APPWRITE_PROJECT_ID:-}" ]; then
    echo "==> Setting NEXT_PUBLIC_APPWRITE_PROJECT_ID on $site"
    set_variable "$site" "$site-appwrite-project" "NEXT_PUBLIC_APPWRITE_PROJECT_ID" "$NEXT_PUBLIC_APPWRITE_PROJECT_ID"
  fi

  if site_is_vcs_linked "$site"; then
    echo "==> Deploying $site (VCS, branch $VCS_BRANCH)"
    appwrite sites create-vcs-deployment \
      --site-id "$site" \
      --type branch \
      --reference "$VCS_BRANCH" \
      --activate \
      --force
  else
    echo "==> Deploying $site (upload)"
    appwrite sites create-deployment \
      --site-id "$site" \
      --code . \
      --install-command "$INSTALL_COMMAND" \
      --build-command "$build_cmd" \
      --output-directory "$out_dir" \
      --activate \
      --force
  fi

  # After the deploy, so the proxy rule can bind to an active deployment.
  if [ -n "$DOMAIN_SUFFIX" ]; then
    ensure_domain "$site" "$(site_domain "$site")"
  fi
done

echo "==> Done"
