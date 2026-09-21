#!/usr/bin/env bash
# Creates (if missing) and deploys every Go function to Appwrite as source.
#
# Appwrite's Go runtime builds each function from source, so the function's own
# directory (main.go, go.mod, go.sum, internal/) is what gets uploaded.
# `make prepare` materialises the shared packages into internal/ first.
#
# Requirements:
#   - The Appwrite CLI installed and logged in (appwrite login).
#   - A configured project (appwrite init project) or CI mode
#     (appwrite client --endpoint ... --key ...).
set -euo pipefail

cd "$(dirname "$0")/.."

RUNTIME="go-1.26"
ENTRYPOINT="main.go"
EXECUTE="users"

FUNCTIONS=(resolve-grants update-organization-profile send-email get-organization-profile provision-organization)

# API key scopes the function's per-execution key needs.
scopes_for() {
  case "$1" in
    resolve-grants)              echo "teams.read rows.read" ;;
    update-organization-profile) echo "teams.read rows.read rows.write" ;;
    send-email)                  echo "messages.write" ;;
    get-organization-profile)    echo "teams.read rows.read" ;;
    provision-organization)      echo "teams.read rows.read rows.write" ;;
    *)                           echo "" ;;
  esac
}

function_exists() {
  appwrite functions get --functionId "$1" >/dev/null 2>&1
}

make prepare

for fn in "${FUNCTIONS[@]}"; do
  if function_exists "$fn"; then
    echo "==> $fn already exists"
  else
    echo "==> Creating $fn"
    # Word splitting is intentional: the CLI takes space-separated arrays.
    # shellcheck disable=SC2086
    appwrite functions create \
      --functionId "$fn" \
      --name "$fn" \
      --runtime "$RUNTIME" \
      --execute $EXECUTE \
      --entrypoint "$ENTRYPOINT" \
      --scopes $(scopes_for "$fn")
  fi

  echo "==> Deploying $fn"
  appwrite functions createDeployment \
    --functionId "$fn" \
    --entrypoint "$ENTRYPOINT" \
    --code "$fn" \
    --activate true
done

echo "==> Done"
