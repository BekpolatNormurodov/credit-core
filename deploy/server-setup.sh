#!/usr/bin/env bash
# One-time server provisioning for credit-core. Tested on Ubuntu 22.04 LTS (jammy)
# and 24.04; get.docker.com supports both. Installs Docker Engine + Compose plugin,
# opens the firewall. Run as root:
#   sudo bash deploy/server-setup.sh
# The app's nginx is published on 127.0.0.1:8080 (HTTP only) — the SERVER's own
# reverse proxy / panel owns 80 + 443 and terminates TLS in front of it.
set -euo pipefail

if [ "$(id -u)" -ne 0 ]; then
  echo "Run as root: sudo bash deploy/server-setup.sh" >&2
  exit 1
fi

echo "==> apt update + base packages"
apt-get update -y
apt-get install -y ca-certificates curl git ufw

echo "==> Install Docker Engine + Compose plugin"
if ! command -v docker >/dev/null 2>&1; then
  curl -fsSL https://get.docker.com | sh
fi
docker --version
docker compose version

echo "==> Enable + start Docker"
systemctl enable --now docker

echo "==> Firewall: allow SSH + HTTP + HTTPS (80/443 are served by the host's own proxy)"
ufw allow OpenSSH 2>/dev/null || ufw allow 22/tcp
ufw allow 80/tcp
ufw allow 443/tcp
# 8080 is intentionally NOT opened — the app's nginx binds 127.0.0.1 only.
ufw --force enable
ufw status

echo
echo "==> Server ready. Next:"
echo "    cp deploy/.env.example deploy/.env && nano deploy/.env"
echo "    bash deploy/deploy.sh                # build, start, sync schema, seed (app on 127.0.0.1:8080)"
echo "    then point your reverse proxy / panel at 127.0.0.1:8080 (see deploy/README.md §2)"
