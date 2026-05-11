#!/bin/bash
# Auto-deploy custom_erp after `git pull`.
# Safe to re-run manually: scripts/post-pull-deploy.sh
#
# Skip via:  SKIP_AUTO_DEPLOY=1 git pull

export MSYS_NO_PATHCONV=1

if [ "${SKIP_AUTO_DEPLOY:-0}" = "1" ]; then
    echo "[deploy] SKIP_AUTO_DEPLOY=1, skipping."
    exit 0
fi

REPO_ROOT="$(git rev-parse --show-toplevel 2>/dev/null)"
if [ -z "$REPO_ROOT" ]; then
    echo "[deploy] ERROR: not in a git repo"
    exit 1
fi
cd "$REPO_ROOT"

BACKEND="frappe_docker-backend-1"
FRONTEND="frappe_docker-frontend-1"
SITE="frontend"

# --- preflight ---
if ! docker ps --format '{{.Names}}' | grep -q "^${BACKEND}$"; then
    echo "[deploy] ERROR: backend container not running. Start docker first."
    exit 1
fi

# Self-heal apps.txt drift before anything else. If bench-level apps.txt is
# missing entries, hooks.py won't load for those apps and the migrate / build
# below will silently produce a half-broken desk.
bash "$REPO_ROOT/scripts/fix-apps-txt.sh" || {
    echo "[deploy] ERROR: apps.txt preflight failed."
    exit 1
}

# --- detect changes ---
if git rev-parse ORIG_HEAD >/dev/null 2>&1; then
    CHANGED=$(git diff --name-only ORIG_HEAD..HEAD 2>/dev/null)
else
    # Manual run with no merge context — process everything in custom_erp/
    CHANGED=$(git ls-files custom_erp/)
fi

if [ -z "$CHANGED" ]; then
    echo "[deploy] No changes. Done."
    exit 0
fi

NEEDS_SYNC=$(echo "$CHANGED" | grep -E "^custom_erp/" || true)
if [ -z "$NEEDS_SYNC" ]; then
    echo "[deploy] No custom_erp/ files changed. Done."
    exit 0
fi

echo ""
echo "════════════════════════════════════════"
echo " Auto-deploy starting"
echo "════════════════════════════════════════"
echo "Changed files:"
echo "$NEEDS_SYNC" | sed 's/^/  • /'

# --- step 1: sync files to container ---
echo ""
echo "[1/6] Syncing files to container..."
SYNC_FAILED=0
while IFS= read -r file; do
    [ -z "$file" ] && continue
    [ ! -f "$file" ] && continue  # deleted file, skip

    # Map host path to container path:
    #   host:      custom_erp/<X>           or  custom_erp/custom_erp/<X>
    #   container: apps/custom_erp/custom_erp/<X> (the loaded module)
    if [[ "$file" == custom_erp/custom_erp/* ]]; then
        rel="${file#custom_erp/custom_erp/}"
    else
        rel="${file#custom_erp/}"
    fi
    target="/home/frappe/frappe-bench/apps/custom_erp/custom_erp/$rel"
    parent=$(dirname "$target")

    docker exec --user root "$BACKEND" mkdir -p "$parent" >/dev/null 2>&1 || true
    if docker cp "$file" "${BACKEND}:${target}" 2>/dev/null; then
        echo "  ✓ $rel"
    else
        echo "  ✗ FAILED: $file"
        SYNC_FAILED=1
    fi
done <<< "$NEEDS_SYNC"

docker exec --user root "$BACKEND" chown -R frappe:frappe /home/frappe/frappe-bench/apps/custom_erp >/dev/null 2>&1 || true

if [ $SYNC_FAILED -eq 1 ]; then
    echo "[deploy] WARN: some files failed to sync. Continuing..."
fi

# --- step 2: clear cache ---
echo ""
echo "[2/6] Clearing cache..."
docker exec "$BACKEND" bench --site "$SITE" clear-cache >/dev/null 2>&1
echo "  ✓ done"

# --- step 3: migrate ---
echo ""
echo "[3/6] Running migrate (--skip-fixtures)..."
if docker exec "$BACKEND" bench --site "$SITE" migrate --skip-fixtures 2>&1 | tail -5; then
    echo "  ✓ done"
else
    echo "  ✗ migrate failed — check output above. Aborting deploy."
    exit 1
fi

# --- step 4: restore any orphaned workspaces ---
echo ""
echo "[4/6] Restoring orphaned workspaces from fixture..."
# Ensure restore script is in container
docker exec --user root "$BACKEND" mkdir -p /home/frappe/frappe-bench/apps/custom_erp/custom_erp/scripts >/dev/null 2>&1
docker exec --user root "$BACKEND" touch /home/frappe/frappe-bench/apps/custom_erp/custom_erp/scripts/__init__.py >/dev/null 2>&1
docker cp "$REPO_ROOT/scripts/restore_workspaces.py" \
    "${BACKEND}:/home/frappe/frappe-bench/apps/custom_erp/custom_erp/scripts/restore_workspaces.py" >/dev/null
docker exec --user root "$BACKEND" chown -R frappe:frappe /home/frappe/frappe-bench/apps/custom_erp/custom_erp/scripts >/dev/null 2>&1
docker exec "$BACKEND" bench --site "$SITE" execute custom_erp.scripts.restore_workspaces.run 2>&1 | tail -10

# --- step 5: build + sync assets ---
if echo "$NEEDS_SYNC" | grep -qE "\.(js|css|scss|html|svg|png|jpg)$"; then
    echo ""
    echo "[5/6] Building assets..."
    docker exec "$BACKEND" bench build --app custom_erp 2>&1 | tail -3
    echo "  ✓ build done"

    echo ""
    echo "      Syncing assets to frontend container..."
    TMP_TAR="$REPO_ROOT/scripts/.assets_sync.tar"
    docker exec "$BACKEND" bash -c \
        "cd /home/frappe/frappe-bench/sites/assets/custom_erp && tar -chf /tmp/custom_erp_assets.tar ." >/dev/null 2>&1
    docker cp "${BACKEND}:/tmp/custom_erp_assets.tar" "$TMP_TAR" >/dev/null
    docker cp "$TMP_TAR" "${FRONTEND}:/tmp/custom_erp_assets.tar" >/dev/null
    docker exec --user root "$FRONTEND" bash -c \
        "cd /home/frappe/frappe-bench/sites/assets/custom_erp && tar -xf /tmp/custom_erp_assets.tar && rm /tmp/custom_erp_assets.tar" >/dev/null 2>&1
    rm -f "$TMP_TAR"
    echo "  ✓ frontend synced"
else
    echo ""
    echo "[5/6] No asset changes — skipping build."
fi

# --- step 6: final cache clear ---
echo ""
echo "[6/6] Final cache clear..."
docker exec "$BACKEND" bench --site "$SITE" clear-cache >/dev/null 2>&1
docker exec "$BACKEND" bench --site "$SITE" clear-website-cache >/dev/null 2>&1
echo "  ✓ done"

# --- step 7: restart workers if Python OR assets changed ---
# gunicorn caches hooks.py (and any imported module) in memory. clear-cache
# only flushes Redis — it does NOT reload Python. If hooks.py changed but we
# don't restart, the desk page keeps rendering OLD asset URLs (?v=N) and new
# JS/CSS files registered in app_include_js/app_include_css never load.
# Same applies to existing CSS/JS edits: gunicorn caches the asset version
# hashes, so the browser keeps requesting ?v=<old_hash> and never sees the
# new file content even after Ctrl+F5.
if echo "$NEEDS_SYNC" | grep -qE "\.(py|js|css|scss|svg)$"; then
    echo ""
    echo "[7/7] Restarting backend (code/assets changed — gunicorn must reload)..."
    docker restart "$BACKEND" >/dev/null 2>&1
    # Wait for backend to come back up
    for i in $(seq 1 30); do
        code=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:8080/api/method/ping 2>/dev/null || echo "000")
        case "$code" in 200|401|403) break ;; esac
        sleep 2
    done
    echo "  ✓ backend up"

    # nginx in frontend caches the backend's old container IP — restart it too,
    # otherwise it 502s until the DNS TTL expires.
    echo "      Restarting frontend (refresh upstream DNS)..."
    docker restart "$FRONTEND" >/dev/null 2>&1
    for i in $(seq 1 20); do
        code=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:8080/ 2>/dev/null || echo "000")
        case "$code" in 200|301|302) break ;; esac
        sleep 2
    done
    echo "  ✓ frontend up"
fi

echo ""
echo "════════════════════════════════════════"
echo " ✓ Deploy complete. Hard-refresh browser (Ctrl+F5)."
echo "════════════════════════════════════════"
