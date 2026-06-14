#!/usr/bin/env bash
# =====================================================================
# Windikate · per-deploy script
# =====================================================================
# Runs on the server on every push. Idempotent and fast:
#   1 · git pull
#   2 · backend npm install (if package.json changed)
#   3 · frontend npm install + next build (if changed)
#   4 · Apply DB migrations if schema.sql changed
#   5 · pm2 reload (zero-downtime restart of both services)
#   6 · Reload Apache only if its config changed
#
# Triggered by:
#   · GitHub Actions on push to main, OR
#   · `bash /var/www/windikate/deploy/deploy.sh` run by hand
# =====================================================================

set -euo pipefail

APP_DIR="/var/www/windikate"
BRANCH="${1:-main}"

log() { printf '\n\033[1;36m▸ %s\033[0m\n' "$*"; }

cd "$APP_DIR"

# ---------------------------------------------------------------------
log "1 · git pull (origin/${BRANCH})"
PREV=$(git rev-parse HEAD)
git fetch origin
git reset --hard "origin/${BRANCH}"
CURR=$(git rev-parse HEAD)
echo "  ${PREV:0:9} → ${CURR:0:9}"

CHANGED=$(git diff --name-only "$PREV" "$CURR")
echo "$CHANGED" | sed 's/^/  /'

changed() { echo "$CHANGED" | grep -qE "^$1"; }

# ---------------------------------------------------------------------
if changed "analysis-app/backend/package.json|analysis-app/backend/package-lock.json"; then
    log "2 · backend deps changed → npm install"
    cd "$APP_DIR/analysis-app/backend"
    npm install --omit=dev --silent
else
    log "2 · backend deps unchanged · skipping"
fi

# ---------------------------------------------------------------------
if changed "analysis-app/frontend|^assets/" ; then
    log "3 · frontend changed → install + build"
    cd "$APP_DIR/analysis-app/frontend"
    if changed "analysis-app/frontend/package(\.json|-lock\.json)"; then
        npm install --silent
    fi
    npm run build
else
    log "3 · frontend unchanged · skipping"
fi

# ---------------------------------------------------------------------
if changed "analysis-app/backend/db/schema\.sql"; then
    log "4 · schema.sql changed · applying"
    # shellcheck disable=SC1091
    source /home/ubuntu/.windikate-secrets
    mariadb -u windikate -p"${DB_APP_PASSWORD}" windikate_analysis \
        < "$APP_DIR/analysis-app/backend/db/schema.sql"
else
    log "4 · schema.sql unchanged · skipping"
fi

# ---------------------------------------------------------------------
log "5 · pm2 reload"
pm2 startOrReload "$APP_DIR/deploy/pm2-ecosystem.config.js" --update-env
pm2 save

# ---------------------------------------------------------------------
if changed "deploy/apache-windikate\.conf"; then
    log "6 · Apache vhost changed · reloading"
    sudo cp "$APP_DIR/deploy/apache-windikate.conf" /etc/apache2/sites-available/windikate.conf
    sudo apachectl configtest
    sudo systemctl reload apache2
else
    log "6 · Apache vhost unchanged · skipping"
fi

log "✓ deploy complete · ${CURR:0:9}"
