#!/usr/bin/env bash
# Creates (if missing) and deploys the Next.js apps to Appwrite Sites.
#
# Usage:
#   ./scripts/deploy-sites.sh                  # every site
#   ./scripts/deploy-sites.sh admin            # one site
#   ./scripts/deploy-sites.sh admin customer
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
#   SITE_BUILD_RUNTIME   build runtime (default node-22; this instance offers
#                        node-22 and node-25, not node-24)
#   SITE_VCS_BRANCH      branch to deploy from (default main)
#   SITE_INSTALLATION_ID Appwrite VCS installation id. When set together with
#   SITE_REPOSITORY_ID   SITE_REPOSITORY_ID, newly created sites are linked to
#                        the repository (both come from the Console's Git
#                        connection).
#   NEXT_PUBLIC_APPWRITE_ENDPOINT
#   NEXT_PUBLIC_APPWRITE_PROJECT_ID
#                        build-time variables, set on each site when present
set -euo pipefail

cd "$(dirname "$0")/.."

FRAMEWORK="nextjs"
BUILD_RUNTIME="${SITE_BUILD_RUNTIME:-node-22}"
ADAPTER="ssr"
INSTALL_COMMAND="corepack enable && pnpm install --frozen-lockfile"
VCS_BRANCH="${SITE_VCS_BRANCH:-main}"

ALL_SITES=(admin client customer design-system)

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

  if site_exists "$site"; then
    echo "==> $site already exists"
  else
    echo "==> Creating $site"
    create_args=(
      --site-id "$site"
      --name "$site"
      --framework "$FRAMEWORK"
      --build-runtime "$BUILD_RUNTIME"
      --adapter "$ADAPTER"
      --install-command "$INSTALL_COMMAND"
      --build-command "$build_cmd"
      --output-directory "$out_dir"
      --force
    )
    if [ -n "${SITE_INSTALLATION_ID:-}" ] && [ -n "${SITE_REPOSITORY_ID:-}" ]; then
      create_args+=(
        --installation-id "$SITE_INSTALLATION_ID"
        --provider-repository-id "$SITE_REPOSITORY_ID"
        --provider-branch "$VCS_BRANCH"
        --provider-root-directory "apps/$site"
      )
    fi
    appwrite sites create "${create_args[@]}"
  fi

  if [ -n "${NEXT_PUBLIC_APPWRITE_ENDPOINT:-}" ]; then
    echo "==> Setting NEXT_PUBLIC_APPWRITE_ENDPOINT on $site"
    set_variable "$site" "appwrite-endpoint" "NEXT_PUBLIC_APPWRITE_ENDPOINT" "$NEXT_PUBLIC_APPWRITE_ENDPOINT"
  fi
  if [ -n "${NEXT_PUBLIC_APPWRITE_PROJECT_ID:-}" ]; then
    echo "==> Setting NEXT_PUBLIC_APPWRITE_PROJECT_ID on $site"
    set_variable "$site" "appwrite-project" "NEXT_PUBLIC_APPWRITE_PROJECT_ID" "$NEXT_PUBLIC_APPWRITE_PROJECT_ID"
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
done

echo "==> Done"
