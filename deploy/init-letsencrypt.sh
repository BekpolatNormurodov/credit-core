#!/usr/bin/env bash
# One-time TLS bootstrap for creditcore.uz (api + 4 role subdomains).
# Prereqs: DNS A-records already point at THIS server; deploy/.env filled in;
# the stack has been started once (bash deploy/deploy.sh).
#   bash deploy/init-letsencrypt.sh
set -euo pipefail
cd "$(dirname "$0")/.."
# shellcheck disable=SC1091
source deploy/.env

domains=(api.creditcore.uz operator.creditcore.uz moderator.creditcore.uz director.creditcore.uz admin.creditcore.uz)
email="${CERTBOT_EMAIL:-admin@creditcore.uz}"
live="/etc/letsencrypt/live/creditcore.uz"

echo "==> 1/4 dummy certificate so nginx can start on 443"
docker compose run --rm --entrypoint "sh -c \
  'mkdir -p $live && openssl req -x509 -nodes -newkey rsa:2048 -days 1 \
   -keyout $live/privkey.pem -out $live/fullchain.pem -subj /CN=localhost'" certbot

echo "==> 2/4 (re)start nginx — serves the ACME challenge on port 80"
docker compose --env-file deploy/.env up -d nginx

echo "==> 3/4 replace dummy with a real Let's Encrypt certificate"
docker compose run --rm --entrypoint "sh -c \
  'rm -rf /etc/letsencrypt/live/creditcore.uz /etc/letsencrypt/archive/creditcore.uz /etc/letsencrypt/renewal/creditcore.uz.conf'" certbot

domain_args=""
for d in "${domains[@]}"; do domain_args="$domain_args -d $d"; done

# shellcheck disable=SC2086
docker compose run --rm --entrypoint "certbot certonly --webroot -w /var/www/certbot \
  --cert-name creditcore.uz $domain_args \
  --email $email --agree-tos --no-eff-email --force-renewal" certbot

echo "==> 4/4 reload nginx with the real certificate"
docker compose exec nginx nginx -s reload
echo "Done — HTTPS issued for: ${domains[*]}"
