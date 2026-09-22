#!/usr/bin/env bash
# Creates (if missing) and deploys Go functions to Appwrite as source.
#
# Usage:
#   ./scripts/deploy.sh                     # every function
#   ./scripts/deploy.sh resolve-grants      # one function
#   ./scripts/deploy.sh resolve-grants send-email
#
# Appwrite's Go runtime builds each function from source, so the function's own
# directory (main.go, go.mod, go.sum, internal/) is what gets uploaded.
# `make prepare` materialises the shared packages into internal/ first.
#
# Requirements:
#   - The Appwrite CLI installed and logged in (`appwrite login` +
#     `appwrite init project`), or configured in non-interactive mode
#     (`appwrite client --endpoint ... --project-id ... --key ...`).
#
# Note: CLI flags are kebab-case (`--function-id`, `create-deployment`) and
# `--scopes` is a stringArray, so each scope needs its own flag.
set -euo pipefail

cd "$(dirname "$0")/.."

RUNTIME="go-1.26"
ENTRYPOINT="main.go"
EXECUTE="users"

ALL_FUNCTIONS=(
  resolve-grants
  update-organization-profile
  send-email
  get-organization-profile
  provision-organization
  create-user
  update-user-permissions
)

# API key scopes the function's per-execution key needs.
scopes_for() {
  case "$1" in
    resolve-grants)              echo "teams.read rows.read" ;;
    update-organization-profile) echo "teams.read rows.read rows.write" ;;
    send-email)                  echo "messages.write" ;;
    get-organization-profile)    echo "teams.read rows.read" ;;
    provision-organization)      echo "teams.read rows.read rows.write" ;;
    create-user)                 echo "users.write teams.read teams.write rows.read rows.write executions.write" ;;
    update-user-permissions)     echo "teams.read rows.read rows.write" ;;
    *)                           echo "" ;;
  esac
}

is_known() {
  local candidate="$1" known
  for known in "${ALL_FUNCTIONS[@]}"; do
    [ "$candidate" = "$known" ] && return 0
  done
  return 1
}

function_exists() {
  appwrite functions get --function-id "$1" >/dev/null 2>&1
}

if [ "$#" -gt 0 ]; then
  FUNCTIONS=("$@")
else
  FUNCTIONS=("${ALL_FUNCTIONS[@]}")
fi

for fn in "${FUNCTIONS[@]}"; do
  if ! is_known "$fn"; then
    echo "Unknown function: $fn" >&2
    echo "Known functions: ${ALL_FUNCTIONS[*]}" >&2
    exit 1
  fi
done

make prepare

for fn in "${FUNCTIONS[@]}"; do
  if function_exists "$fn"; then
    echo "==> $fn already exists"
  else
    echo "==> Creating $fn"
    scope_args=()
    for scope in $(scopes_for "$fn"); do
      scope_args+=(--scopes "$scope")
    done
    appwrite functions create \
      --function-id "$fn" \
      --name "$fn" \
      --runtime "$RUNTIME" \
      --execute "$EXECUTE" \
      --entrypoint "$ENTRYPOINT" \
      --force \
      ${scope_args[@]+"${scope_args[@]}"}
  fi

  echo "==> Deploying $fn"
  appwrite functions create-deployment \
    --function-id "$fn" \
    --entrypoint "$ENTRYPOINT" \
    --code "$fn" \
    --activate \
    --force
done

echo "==> Done"
