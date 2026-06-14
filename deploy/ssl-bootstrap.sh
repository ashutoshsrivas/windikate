#!/usr/bin/env bash
# =====================================================================
# ssl-bootstrap.sh — Windikate Apache HTTPS bootstrap.
#
# Run once on a fresh EC2:
#     sudo bash /var/www/windikate/deploy/ssl-bootstrap.sh
#
# What it does:
#   1) Enables Apache ssl, headers, rewrite, macro modules.
#   2) Provisions a self-signed cert at /etc/ssl/windikate/{fullchain,privkey}.pem
#      (idempotent — re-running won't clobber a certbot-managed pair).
#   3) Installs certbot + python3-certbot-apache so a real cert is one
#      command away the moment a domain points at this box.
#   4) Activates the SSL vhost and disables the old port-80-only one.
#
# Re-run any time to repair drift; it's idempotent.
# ====================================================================

set -euo pipefail

bold()    { printf "\n\e[1m▸ %s\e[0m\n" "$1"; }
ok()      { printf "  \e[32m✓\e[0m %s\n" "$1"; }
warn()    { printf "  \e[33m⚠\e[0m %s\n" "$1"; }

SSL_DIR=/etc/ssl/windikate
CERT="$SSL_DIR/fullchain.pem"
KEY="$SSL_DIR/privkey.pem"

# Hostnames to put on the self-signed SAN — add yours as needed.
HOSTNAMES=(
    "ec2-35-154-88-44.ap-south-1.compute.amazonaws.com"
    "windikate.com"
    "www.windikate.com"
    "localhost"
)

# ------ 1) apache modules + macro support ----------------------------
bold "1/4 · enabling apache modules"
sudo a2enmod ssl headers rewrite proxy proxy_http proxy_wstunnel macro >/dev/null
ok "ssl + headers + rewrite + proxy + macro enabled"

# ------ 2) self-signed cert ------------------------------------------
bold "2/4 · provisioning TLS cert"
sudo mkdir -p "$SSL_DIR"
if [ -f "$CERT" ] && [ -f "$KEY" ]; then
    # Don't clobber an existing cert (could be certbot-managed).
    ok "cert already exists — leaving as is ($(sudo openssl x509 -in $CERT -noout -issuer | head -1))"
else
    SAN=""
    for h in "${HOSTNAMES[@]}"; do
        SAN+="DNS:$h,"
    done
    SAN="${SAN%,}"   # trim trailing comma

    sudo openssl req -x509 -nodes \
        -newkey rsa:2048 \
        -days 825 \
        -keyout "$KEY" \
        -out    "$CERT" \
        -subj "/C=IN/ST=Delhi/L=Delhi/O=Windikate/CN=${HOSTNAMES[0]}" \
        -addext "subjectAltName=$SAN" \
        -addext "basicConstraints=CA:FALSE" \
        -addext "keyUsage=digitalSignature,keyEncipherment" \
        -addext "extendedKeyUsage=serverAuth" \
        >/dev/null 2>&1
    sudo chmod 600 "$KEY"
    sudo chmod 644 "$CERT"
    ok "self-signed cert minted (RSA-2048, 825 days, SAN: $SAN)"
fi

# ------ 3) install certbot for future Let's Encrypt ------------------
bold "3/4 · installing certbot (for real cert later)"
if command -v certbot >/dev/null 2>&1; then
    ok "certbot already installed ($(certbot --version 2>&1 | head -1))"
else
    sudo apt-get update -qq
    sudo DEBIAN_FRONTEND=noninteractive apt-get install -y -qq certbot python3-certbot-apache >/dev/null
    ok "certbot installed"
fi

# ------ 4) wire the vhost --------------------------------------------
bold "4/4 · activating SSL vhost"
sudo cp /var/www/windikate/deploy/apache-windikate.conf /etc/apache2/sites-available/windikate.conf
sudo a2ensite windikate >/dev/null 2>&1 || true
# Disable the default 80-only vhost if it's still active.
sudo a2dissite 000-default >/dev/null 2>&1 || true

# Make sure Apache listens on 443. Default ports.conf already has it
# inside an <IfModule ssl_module> block — only append a top-level Listen
# when neither form is present.
if ! grep -qE '^[[:space:]]*Listen 443' /etc/apache2/ports.conf; then
    echo "Listen 443" | sudo tee -a /etc/apache2/ports.conf >/dev/null
fi

sudo apache2ctl -t   # syntax check
sudo systemctl reload apache2
ok "apache reloaded — https now serving on :443"

cat <<'POST'

────────────────────────────────────────────────────────────────────
✓ TLS is live.

  Browsers will show a "not trusted" warning until you swap in a real
  cert. To upgrade to Let's Encrypt once a domain points at this box:

      sudo certbot --apache -d windikate.com -d www.windikate.com

  Certbot will replace /etc/ssl/windikate/{fullchain,privkey}.pem
  in place and set up auto-renewal via systemd timer.
────────────────────────────────────────────────────────────────────
POST
