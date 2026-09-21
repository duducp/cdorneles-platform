#!/usr/bin/env bash
# Creates (if missing) and deploys the Next.js apps to Appwrite Sites.
#
# Usage:
#   ./scripts/deploy-sites.sh                  # every site
#   ./scripts/deploy-sites.sh admin            # one site
#   ./scripts/deploy-sites.sh admin customer
#
# Appwrite Sites builds the app from source. The apps live in a pnpm monorepo
# and consume the shared packages as TypeScript source, so the deployment
# uploads the REPOSITORY ROOT (not just the app directory) and builds a single
# workspace with --filter. The CLI respects .gitignore, which already excludes
# node_modules/, .next/ and dist/, so the upload stays around 5 MB.
#
# Requirements:
#   - The Appwrite CLI installed and logged in (`appwrite login` +
#     `appwrite init project`), or configured in non-interactive mode
#     (`appwrite client --endpoint ... --project-id ... --key ...`).
#   - Run from anywhere; the script cd's to the repository root.
#
# Optional environment (creates/updates the sites' build-time variables):
#   NEXT_PUBLIC_APPWRITE_ENDPOINT
#   NEXT_PUBLIC_APPWRITE_PROJECT_ID
set -euo pipefail

cd "$(dirname "$0")/.."

FRAMEWORK="nextjs"
BUILD_RUNTIME="node-24"
ADAPTER="ssr"
INSTALL_COMMAND="corepack enable && pnpm install --frozen-lockfile"

ALL_SITES=(admin client customer design-system)

# npm package name of an app.
site_package() {
  case "$1" in
    admin)         echo "@cdorneles/admin" ;;
    client)        echo "@cdorneles/client" ;;
    customer)      echo "@cdorneles/customer" ;;
    design-system) echo "@cdorneles/design-system" ;;
    *)             echo "" ;;
  esac
}

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

build_command() {
  echo "pnpm --filter $(site_package "$1") build"
}

output_directory() {
  echo "apps/$1/.next"
}

# Creates or updates a build-time variable, ignoring a missing command.
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
    appwrite sites create \
      --site-id "$site" \
      --name "$site" \
      --framework "$FRAMEWORK" \
      --build-runtime "$BUILD_RUNTIME" \
      --adapter "$ADAPTER" \
      --install-command "$INSTALL_COMMAND" \
      --build-command "$build_cmd" \
      --output-directory "$out_dir" \
      --force
  fi

  if [ -n "${NEXT_PUBLIC_APPWRITE_ENDPOINT:-}" ]; then
    echo "==> Setting NEXT_PUBLIC_APPWRITE_ENDPOINT on $site"
    set_variable "$site" "appwrite-endpoint" "NEXT_PUBLIC_APPWRITE_ENDPOINT" "$NEXT_PUBLIC_APPWRITE_ENDPOINT"
  fi
  if [ -n "${NEXT_PUBLIC_APPWRITE_PROJECT_ID:-}" ]; then
    echo "==> Setting NEXT_PUBLIC_APPWRITE_PROJECT_ID on $site"
    set_variable "$site" "appwrite-project" "NEXT_PUBLIC_APPWRITE_PROJECT_ID" "$NEXT_PUBLIC_APPWRITE_PROJECT_ID"
  fi

  echo "==> Deploying $site"
  appwrite sites create-deployment \
    --site-id "$site" \
    --code . \
    --install-command "$INSTALL_COMMAND" \
    --build-command "$build_cmd" \
    --output-directory "$out_dir" \
    --activate \
    --force
done

echo "==> Done"
