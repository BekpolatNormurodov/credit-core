#!/usr/bin/env bash
# First-time production install on the server. Run from the repo root.
#   bash deploy/deploy.sh
set -euo pipefail
cd "$(dirname "$0")/.."

if [ ! -f deploy/.env ]; then
  echo "ERROR: deploy/.env missing. Copy deploy/.env.example to deploy/.env and fill it in." >&2
  exit 1
fi

echo "==> Building and starting containers"
docker compose --env-file deploy/.env up -d --build
# The backend container syncs the DB schema (prisma db push) on start.

echo "==> Waiting for the backend to come up"
sleep 15

echo "==> Seeding initial data (first run only; safe to skip if already seeded)"
docker compose exec -T backend npm run db:seed || echo "seed skipped (ok if already seeded)"

echo
echo "==> App is up. Next: issue TLS certificates with:"
echo "    bash deploy/init-letsencrypt.sh"
docker compose ps
