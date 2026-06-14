#!/usr/bin/env bash
# =====================================================================
# letsencrypt-samaj.sh
#
# Run once DNS for samaj.windikate.com points at this box.
# Issues a real Let's Encrypt cert and wires it into the existing
# vhost without touching any apache config.
#
#     sudo bash /var/www/windikate/deploy/letsencrypt-samaj.sh
#
# Idempotent: re-runs use the existing cert if it's still valid;
# certbot's systemd timer handles the 90-day renewal automatically.
# =====================================================================

set -euo pipefail

DOMAIN="samaj.windikate.com"
EMAIL="connect2recycle@gmail.com"
SSL_DIR=/etc/ssl/windikate
LE_DIR=/etc/letsencrypt/live/$DOMAIN

bold() { printf "\n\e[1m▸ %s\e[0m\n" "$1"; }
ok()   { printf "  \e[32m✓\e[0m %s\n" "$1"; }
warn() { printf "  \e[33m⚠\e[0m %s\n" "$1"; }
die()  { printf "  \e[31m✗\e[0m %s\n" "$1"; exit 1; }

# ----- 1) DNS sanity check -------------------------------------------
bold "1/4 · DNS sanity check"
EC2_IP=$(curl -fsS https://api.ipify.org 2>/dev/null || echo "")
RESOLVED=$(dig +short "$DOMAIN" @8.8.8.8 | head -n 1)
if [ -z "$RESOLVED" ]; then
    die "$DOMAIN does not resolve yet. Wait for DNS propagation and re-run."
fi
ok "$DOMAIN → $RESOLVED   (this box: $EC2_IP)"
if [ -n "$EC2_IP" ] && [ "$RESOLVED" != "$EC2_IP" ]; then
    warn "DNS resolves to a different IP than this box. Let's Encrypt will fail."
    warn "Update the A record at Hostinger to $EC2_IP, then re-run."
    exit 1
fi

# ----- 2) certbot ----------------------------------------------------
bold "2/4 · requesting Let's Encrypt cert"
if [ ! -f "$LE_DIR/fullchain.pem" ]; then
    sudo certbot certonly --apache \
        --non-interactive --agree-tos \
        --email "$EMAIL" \
        -d "$DOMAIN"
    ok "cert issued for $DOMAIN"
else
    # Re-run renews only if <30 days remaining; otherwise it's a no-op.
    sudo certbot renew --quiet || true
    ok "cert already present — renewal check completed"
fi

# ----- 3) wire to vhost path -----------------------------------------
# Vhost references /etc/ssl/windikate/{fullchain,privkey}.pem — we keep
# that contract by pointing those files at the certbot-managed cert via
# symlinks. Renewal happens in-place, no apache change needed.
bold "3/4 · symlinking cert into vhost path"
sudo mkdir -p "$SSL_DIR"
sudo ln -sf "$LE_DIR/fullchain.pem" "$SSL_DIR/fullchain.pem"
sudo ln -sf "$LE_DIR/privkey.pem"   "$SSL_DIR/privkey.pem"
ok "$SSL_DIR/{fullchain,privkey}.pem → $LE_DIR/*"

# ----- 4) post-renewal hook to reload apache -------------------------
bold "4/4 · reload-apache renewal hook"
HOOK=/etc/letsencrypt/renewal-hooks/deploy/reload-apache.sh
sudo mkdir -p "$(dirname "$HOOK")"
sudo tee "$HOOK" >/dev/null <<'HOOKSH'
#!/usr/bin/env bash
systemctl reload apache2 || true
HOOKSH
sudo chmod +x "$HOOK"
ok "hook installed at $HOOK"

sudo apache2ctl -t
sudo systemctl reload apache2
ok "apache reloaded — https://samaj.windikate.com is now trusted"

cat <<POST

────────────────────────────────────────────────────────────────────
✓ Let's Encrypt cert active for samaj.windikate.com
  · cert path: $LE_DIR
  · vhost wired via $SSL_DIR (symlinks)
  · auto-renew: systemd timer (run \`systemctl list-timers | grep cert\`)

Visit https://samaj.windikate.com — no browser warning.
────────────────────────────────────────────────────────────────────
POST
