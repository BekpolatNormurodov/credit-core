#!/usr/bin/env bash
# Build the five images one at a time.
#
# `docker compose up --build` builds them concurrently, and every one of them runs the same
# `npm ci` over the same ~950-package tree. While the lock file is unchanged that costs nothing —
# all five hit the same cached layer. The moment a dependency changes, the lock changes, every
# image's `npm ci` layer is invalidated at once, and five cold installs start together and
# saturate the link. .npmrc already retries (see the note there); this removes the pile-up that
# makes the retries necessary.
#
# Serial is barely slower in the cached case — a cache hit costs nothing whether or not it is
# parallel — and it is the difference between a deploy that works and one that fails at npm ci
# exactly on the deploys that change dependencies.
set -euo pipefail
cd "$(dirname "$0")/.."

# Order matters only in that the backend is the one that must exist for `migrate` to run.
SERVICES="backend web-operator web-moderator web-director web-admin"

for svc in $SERVICES; do
  echo "==> build $svc"
  docker compose --env-file deploy/.env build "$svc"
done

echo "==> all images built"
