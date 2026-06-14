#!/usr/bin/env bash
# =====================================================================
# Windikate · Server provisioning · one-time setup
# =====================================================================
# Bootstraps an Ubuntu 22.04/24.04/26.04 EC2 box from scratch into a
# ready-to-deploy Windikate Analysis app host:
#
#   · Apache 2.4 reverse proxy on :80
#   · Node.js 20 LTS + pm2 for the Next.js (3000) and Express (4000)
#     services
#   · MariaDB 10 with a windikate_analysis database
#   · phpMyAdmin at /phpmyadmin
#   · UFW firewall opened for SSH + HTTP
#   · A 2 GB swap file (because t3.micro / t4g.small have ~ 1 GB RAM
#     and Next.js builds OOM without it)
#
# Run once as the `ubuntu` user:
#     bash ~/windikate/deploy/provision.sh
#
# Idempotent — safe to re-run; existing pieces are skipped.
# =====================================================================

set -euo pipefail

REPO_URL="https://github.com/ashutoshsrivas/windikate.git"
APP_DIR="/var/www/windikate"
SECRETS_FILE="/home/ubuntu/.windikate-secrets"

NODE_MAJOR="20"

log() { printf '\n\033[1;35m▸ %s\033[0m\n' "$*"; }

[ "$EUID" -ne 0 ] || { echo "Run as the ubuntu user, not root."; exit 1; }

# ---------------------------------------------------------------------
log "1 · System update"
sudo apt-get update -y
sudo apt-get upgrade -y

# ---------------------------------------------------------------------
log "2 · Swap (2 GB) for safe Next.js builds"
if [ ! -f /swapfile ]; then
    sudo fallocate -l 2G /swapfile
    sudo chmod 600 /swapfile
    sudo mkswap /swapfile
    sudo swapon /swapfile
    grep -q '/swapfile' /etc/fstab || echo '/swapfile none swap sw 0 0' | sudo tee -a /etc/fstab
fi
free -h | head -3

# ---------------------------------------------------------------------
log "3 · Node.js ${NODE_MAJOR}.x + pm2"
if ! command -v node >/dev/null 2>&1; then
    curl -fsSL "https://deb.nodesource.com/setup_${NODE_MAJOR}.x" | sudo -E bash -
    sudo apt-get install -y nodejs
fi
sudo npm install -g pm2 npm
node --version
pm2 --version

# ---------------------------------------------------------------------
log "4 · Apache 2.4 + PHP for phpMyAdmin"
sudo apt-get install -y apache2 libapache2-mod-php php php-mysql php-mbstring php-zip php-gd php-curl unzip

# Required mods for reverse proxying Node services
sudo a2enmod proxy proxy_http rewrite headers expires
sudo systemctl enable apache2

# ---------------------------------------------------------------------
log "5 · MariaDB"
sudo apt-get install -y mariadb-server mariadb-client
sudo systemctl enable --now mariadb

# ---------------------------------------------------------------------
log "6 · Secrets · generate passwords once and persist them"
if [ ! -f "$SECRETS_FILE" ]; then
    DB_APP_PASSWORD=$(openssl rand -base64 24 | tr -d '/+=' | head -c 32)
    DB_ROOT_PASSWORD=$(openssl rand -base64 24 | tr -d '/+=' | head -c 32)
    JWT_SECRET=$(openssl rand -base64 48 | tr -d '/+=')
    PMA_BLOWFISH=$(openssl rand -base64 30 | tr -d '/+=' | head -c 32)
    umask 077
    cat > "$SECRETS_FILE" <<EOF
# Generated $(date -u +%FT%TZ) — DO NOT COMMIT.
DB_ROOT_PASSWORD='${DB_ROOT_PASSWORD}'
DB_APP_PASSWORD='${DB_APP_PASSWORD}'
JWT_SECRET='${JWT_SECRET}'
PMA_BLOWFISH='${PMA_BLOWFISH}'
EOF
    chmod 600 "$SECRETS_FILE"
fi
# shellcheck disable=SC1090
source "$SECRETS_FILE"

# ---------------------------------------------------------------------
log "7 · DB · create windikate_analysis + app user"
sudo mariadb <<SQL
ALTER USER 'root'@'localhost' IDENTIFIED BY '${DB_ROOT_PASSWORD}';
CREATE DATABASE IF NOT EXISTS windikate_analysis
    CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE USER IF NOT EXISTS 'windikate'@'localhost' IDENTIFIED BY '${DB_APP_PASSWORD}';
GRANT ALL PRIVILEGES ON windikate_analysis.* TO 'windikate'@'localhost';
FLUSH PRIVILEGES;
SQL

# ---------------------------------------------------------------------
log "8 · phpMyAdmin (preseeded, no prompts)"
sudo debconf-set-selections <<EOF
phpmyadmin phpmyadmin/dbconfig-install boolean true
phpmyadmin phpmyadmin/app-password-confirm password ${DB_APP_PASSWORD}
phpmyadmin phpmyadmin/mysql/admin-pass password ${DB_ROOT_PASSWORD}
phpmyadmin phpmyadmin/mysql/app-pass password ${DB_APP_PASSWORD}
phpmyadmin phpmyadmin/reconfigure-webserver multiselect apache2
EOF
sudo DEBIAN_FRONTEND=noninteractive apt-get install -y phpmyadmin

# Some Ubuntu releases ship phpMyAdmin alias config, others don't.
# Make sure Apache includes it.
if [ -f /etc/phpmyadmin/apache.conf ] && [ ! -L /etc/apache2/conf-enabled/phpmyadmin.conf ]; then
    sudo ln -sf /etc/phpmyadmin/apache.conf /etc/apache2/conf-available/phpmyadmin.conf
    sudo a2enconf phpmyadmin
fi

# ---------------------------------------------------------------------
log "9 · App dir + git clone"
sudo mkdir -p "$APP_DIR"
sudo chown ubuntu:ubuntu "$APP_DIR"
if [ ! -d "$APP_DIR/.git" ]; then
    git clone "$REPO_URL" "$APP_DIR"
fi
cd "$APP_DIR"

# ---------------------------------------------------------------------
log "10 · Backend .env"
cat > "$APP_DIR/analysis-app/backend/.env" <<EOF
PORT=4000
NODE_ENV=production
DB_HOST=127.0.0.1
DB_PORT=3306
DB_USER=windikate
DB_PASSWORD=${DB_APP_PASSWORD}
DB_NAME=windikate_analysis
JWT_SECRET=${JWT_SECRET}
JWT_EXPIRES_IN=7d
ALLOWED_ORIGIN=*
EOF
chmod 600 "$APP_DIR/analysis-app/backend/.env"

cat > "$APP_DIR/analysis-app/frontend/.env.local" <<EOF
API_BASE_URL=http://127.0.0.1:4000
EOF

# ---------------------------------------------------------------------
log "11 · Apply DB schema"
mariadb -u windikate -p"${DB_APP_PASSWORD}" windikate_analysis \
    < "$APP_DIR/analysis-app/backend/db/schema.sql"
mariadb -u windikate -p"${DB_APP_PASSWORD}" windikate_analysis \
    -e "SHOW TABLES;" | head -15

# ---------------------------------------------------------------------
log "12 · Install Node dependencies + build Next.js"
cd "$APP_DIR/analysis-app/backend"
npm install --omit=dev --silent

cd "$APP_DIR/analysis-app/frontend"
npm install --silent
npm run build

# ---------------------------------------------------------------------
log "13 · Apache vhost"
sudo cp "$APP_DIR/deploy/apache-windikate.conf" /etc/apache2/sites-available/windikate.conf
# Disable default site + enable ours
sudo a2dissite 000-default.conf 2>/dev/null || true
sudo a2ensite windikate.conf
sudo apachectl configtest
sudo systemctl reload apache2

# ---------------------------------------------------------------------
log "14 · PM2 — start both services + persist on reboot"
cd "$APP_DIR"
pm2 startOrReload deploy/pm2-ecosystem.config.js --update-env
pm2 save
# Generate systemd unit so PM2 starts at boot
sudo env PATH=$PATH:/usr/bin pm2 startup systemd -u ubuntu --hp /home/ubuntu | tail -1 | sudo bash || true
pm2 list

# ---------------------------------------------------------------------
log "15 · UFW · open SSH + HTTP"
sudo ufw allow OpenSSH
sudo ufw allow 'Apache Full'
echo y | sudo ufw enable || true
sudo ufw status

# ---------------------------------------------------------------------
log "✓ DONE"
cat <<EOF

  ─────────────────────────────────────────────────────────────────
   Windikate is provisioned. URLs:

     Analysis app   http://$(curl -s ifconfig.me)/
     phpMyAdmin     http://$(curl -s ifconfig.me)/phpmyadmin
                    user: windikate
                    pwd:  see ${SECRETS_FILE}

  ─────────────────────────────────────────────────────────────────
   STILL TO DO (manual):

     1. Open port 80 (and 443 later) in the EC2 Security Group.
        Without this the box is unreachable from the internet.

     2. To enable GitHub-Actions auto-deploy on push:
        Go to https://github.com/ashutoshsrivas/windikate/settings/secrets/actions
        Add three secrets:
          EC2_HOST  = ec2-35-154-88-44.ap-south-1.compute.amazonaws.com
          EC2_USER  = ubuntu
          EC2_KEY   = <paste the contents of Windikate.pem>

  ─────────────────────────────────────────────────────────────────
EOF
