#!/bin/bash
# Self-heal sites/apps.txt and sites/<site>/apps.txt.
#
# Both files can silently drift to a shorter list (root cause unknown — possibly
# container rebuild). When they do:
#   - bench-level drift  → hooks.py for missing apps never loads → desk theme/UI
#                          customizations disappear
#   - site-level missing → page/workspace routes return "Module not found"
#
# This script reads the authoritative list from `bench --site <site> list-apps`
# (which uses the DB-backed installed_apps) and writes it to both files.
# Safe to re-run; idempotent.

export MSYS_NO_PATHCONV=1
set -e

BACKEND="${BACKEND:-frappe_docker-backend-1}"
SITE="${SITE:-frontend}"

if ! docker ps --format '{{.Names}}' | grep -q "^${BACKEND}$"; then
    echo "[fix-apps-txt] ERROR: backend container ${BACKEND} not running."
    exit 1
fi

# Authoritative app list from DB.
APPS=$(docker exec "$BACKEND" bench --site "$SITE" list-apps 2>/dev/null \
       | awk 'NF{print $1}')

if [ -z "$APPS" ]; then
    echo "[fix-apps-txt] ERROR: bench list-apps returned nothing."
    exit 1
fi

EXPECTED_COUNT=$(echo "$APPS" | wc -l)
echo "[fix-apps-txt] Authoritative list (${EXPECTED_COUNT} apps):"
echo "$APPS" | sed 's/^/  • /'

write_if_changed() {
    local path="$1"
    local current
    current=$(docker exec "$BACKEND" cat "$path" 2>/dev/null || echo "")
    if [ "$current" = "$APPS" ]; then
        echo "[fix-apps-txt] ✓ ${path} already correct"
        return
    fi
    docker exec --user root "$BACKEND" bash -c "cat > '$path' <<'APPSEOF'
$APPS
APPSEOF
chown frappe:frappe '$path'"
    echo "[fix-apps-txt] ✓ rewrote ${path}"
}

write_if_changed "/home/frappe/frappe-bench/sites/apps.txt"
write_if_changed "/home/frappe/frappe-bench/sites/${SITE}/apps.txt"

echo "[fix-apps-txt] Done."
