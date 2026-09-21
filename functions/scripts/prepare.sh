#!/usr/bin/env bash
# Copies the shared packages into each function's internal/ directory.
#
# Appwrite's Go runtime builds each function from source as a standalone
# module named `openruntimes/handler`, and only the function's own directory
# is available at build time. The shared packages therefore cannot be imported
# across modules; this script materialises them into each function before
# building or deploying.
set -euo pipefail

cd "$(dirname "$0")/.."

FUNCTIONS=(resolve-grants update-organization-profile send-email get-organization-profile provision-organization)

for fn in "${FUNCTIONS[@]}"; do
  rm -rf "$fn/internal"
  mkdir -p "$fn/internal"
  cp -R shared/. "$fn/internal/"
  echo "==> prepared $fn/internal"
done
