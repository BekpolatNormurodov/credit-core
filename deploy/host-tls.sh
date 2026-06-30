#!/usr/bin/env bash
# Runs ON THE HOST (NOT inside Docker). Sets up the host's own nginx + Let's Encrypt
# TLS in front of the app. The app's container nginx keeps listening on :80 internally
# and is published on 127.0.0.1:8080 — this script configures the *host* nginx (80/443)
# to terminate TLS and reverse-proxy the 5 subdomains to it.
#
#   sudo bash deploy/host-tls.sh
#
# Prereqs:
#   - DNS A-records for api/operator/moderator/director/admin.creditcore.uz already
#     point at THIS server (certbot validates over port 80).
#   - The app is already running: `bash deploy/deploy.sh` (listening on 127.0.0.1:8080).
set -euo pipefail

BASE="creditcore.uz"
SUBDOMAINS=(api operator moderator director admin)
EMAIL="khurshidi2827@gmail.com"
UPSTREAM="http://127.0.0.1:8080"

if [ "$(id -u)" -ne 0 ]; then
  echo "Run as root: sudo bash deploy/host-tls.sh" >&2
  exit 1
fi

echo "==> Install host nginx + certbot (no-op if already present)"
apt-get update -y
apt-get install -y nginx certbot python3-certbot-nginx

# "api.creditcore.uz operator.creditcore.uz ..." for server_name
names=""
for d in "${SUBDOMAINS[@]}"; do names="$names $d.$BASE"; done

echo "==> Write host vhost: 80 -> $UPSTREAM (certbot adds 443 + redirect below)"
cat > /etc/nginx/sites-available/creditcore.uz <<NGINX
server {
    listen 80;
    server_name$names;

    client_max_body_size 25m;

    location / {
        proxy_pass $UPSTREAM;
        proxy_set_header Host              \$host;            # routing is by Host — must pass through
        proxy_set_header X-Real-IP         \$remote_addr;
        proxy_set_header X-Forwarded-For   \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
    }
}
NGINX

ln -sf /etc/nginx/sites-available/creditcore.uz /etc/nginx/sites-enabled/creditcore.uz
rm -f /etc/nginx/sites-enabled/default
nginx -t
systemctl reload nginx

echo "==> Issue + install certificates for all 5 names (certbot edits the vhost: adds"
echo "    the 443 server block, the HTTP->HTTPS redirect, and a systemd auto-renew timer)"
domain_args=""
for d in "${SUBDOMAINS[@]}"; do domain_args="$domain_args -d $d.$BASE"; done
# shellcheck disable=SC2086
certbot --nginx $domain_args --email "$EMAIL" --agree-tos --no-eff-email --redirect -n

nginx -t && systemctl reload nginx
echo
echo "==> Done. TLS live for:"
for d in "${SUBDOMAINS[@]}"; do echo "      https://$d.$BASE  ->  127.0.0.1:8080"; done
echo "    Auto-renew: 'systemctl list-timers certbot.timer' / test with 'certbot renew --dry-run'."
