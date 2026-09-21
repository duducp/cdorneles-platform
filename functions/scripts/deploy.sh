#!/usr/bin/env bash
# Deploys every Go function to Appwrite as source.
#
# Appwrite's Go runtime builds each function from source, so the function's
# own directory (main.go, go.mod, go.sum, internal/) is what gets uploaded.
# `make prepare` materialises the shared packages into internal/ first.
#
# Requires the Appwrite CLI, logged in against the target instance.
set -euo pipefail

cd "$(dirname "$0")/.."

make prepare

for fn in resolve-grants update-organization-profile send-email; do
  echo "==> Deploying $fn"
  appwrite functions createDeployment \
    --functionId "$fn" \
    --entrypoint "main.go" \
    --code "$fn" \
    --activate true
done
