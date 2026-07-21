#!/usr/bin/env bash
# Pull the latest code and update the running deployment. Run from the repo root.
#   bash deploy/update.sh
set -euo pipefail
cd "$(dirname "$0")/.."

echo "==> git pull"
git pull --ff-only

bash deploy/build-images.sh

echo "==> Restart (the one-shot 'migrate' service runs prisma db push once, before the"
echo "    backend/ocr/scheduler start — so the 3 backend replicas don't race to push the schema)"
docker compose --env-file deploy/.env up -d

echo "==> Update complete"
docker compose ps
