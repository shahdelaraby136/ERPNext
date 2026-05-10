#!/usr/bin/env bash
# ---------------------------------------------------------------------------
# export-customizations.sh
#
# Dumps everything our hooks.py fixtures filter matches (workspaces, server
# scripts, print formats, custom fields, property setters, healthcare
# reference data, etc.) from the running site into apps/custom_erp/fixtures/,
# then copies the generated JSONs back to this host so they can be committed.
#
# Usage:   ./scripts/export-customizations.sh [BACKEND_CONTAINER] [SITE]
# Default: BACKEND_CONTAINER = erpnext-custom-backend-1
#          SITE              = frontend
#
# When you add a new Custom Field / Property Setter / Workspace via the UI:
#   1. Open  custom_erp/hooks.py
#   2. Add the name (or doc_type) to the matching whitelist in `fixtures`
#   3. Run this script
#   4. git add custom_erp/fixtures/ && git commit
# ---------------------------------------------------------------------------
set -euo pipefail

CONTAINER="${1:-erpnext-custom-backend-1}"
SITE="${2:-frontend}"

REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
APP_FIXTURES_HOST="$REPO_ROOT/custom_erp/custom_erp/fixtures"
APP_FIXTURES_CONTAINER="/home/frappe/frappe-bench/apps/custom_erp/custom_erp/fixtures"
APP_HOOKS_HOST="$REPO_ROOT/custom_erp/custom_erp/hooks.py"
APP_HOOKS_CONTAINER="/home/frappe/frappe-bench/apps/custom_erp/custom_erp/hooks.py"

echo "==> Container: $CONTAINER  Site: $SITE"

if ! docker ps --format '{{.Names}}' | grep -q "^${CONTAINER}$"; then
  echo "ERROR: container '$CONTAINER' not running. Start the stack first."
  exit 1
fi

# Sync the latest hooks.py into the container so its `fixtures` filter is current.
echo "==> Syncing hooks.py into container..."
docker cp "$APP_HOOKS_HOST" "$CONTAINER:$APP_HOOKS_CONTAINER"

# Run export-fixtures inside the bench. The output JSONs land in apps/custom_erp/fixtures/.
echo "==> Running bench export-fixtures..."
docker exec "$CONTAINER" bench --site "$SITE" export-fixtures --app custom_erp

# Copy the freshly written fixtures back to the host so git sees them.
echo "==> Copying fixtures back to host..."
docker cp "$CONTAINER:$APP_FIXTURES_CONTAINER/." "$APP_FIXTURES_HOST/"

echo
echo "==> Done. Diff:"
( cd "$REPO_ROOT" && git -c color.ui=always diff --stat custom_erp/custom_erp/fixtures/ || true )
echo
echo "Review the diff, then:  git add custom_erp/custom_erp/fixtures/ && git commit"
