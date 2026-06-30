#!/usr/bin/env bash
# One-time server provisioning for credit-core. Tested on Ubuntu 22.04 LTS (jammy)
# and 24.04; get.docker.com supports both. Installs Docker Engine + Compose plugin,
# opens the firewall. Run as root:
#   sudo bash deploy/server-setup.sh
# The app's nginx is published on 8080 (HTTP) + 9443 (HTTPS) and terminates TLS itself.
# The edge (87.x) forwards public 80 -> this host's 8080 and 443 -> 9443.
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

echo "==> Firewall: allow SSH + the app's published ports (the edge forwards 80->8080, 443->9443)"
ufw allow OpenSSH 2>/dev/null || ufw allow 22/tcp
ufw allow 8080/tcp
ufw allow 9443/tcp
# Tip: if you know the edge's IP, tighten these to it, e.g. `ufw allow from <edge-ip> to any port 8080`.
ufw --force enable
ufw status

echo
echo "==> Server ready. Next:"
echo "    cp deploy/.env.example deploy/.env && nano deploy/.env"
echo "    bash deploy/deploy.sh                # build, start, sync schema, seed (app on 8080/9443)"
echo "    bash deploy/init-letsencrypt.sh      # TLS — after DNS+edge forward 80->8080 is live"
