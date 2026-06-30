#!/usr/bin/env bash
# Pull the latest code and update the running deployment. Run from the repo root.
#   bash deploy/update.sh
set -euo pipefail
cd "$(dirname "$0")/.."

echo "==> git pull"
git pull --ff-only

echo "==> Rebuild + restart (backend re-syncs schema via prisma db push on start)"
docker compose --env-file deploy/.env up -d --build

echo "==> Update complete"
docker compose ps
