# CI/CD + Production Deploy (creditcore.uz) — Design Spec

> Set up CI (GitHub Actions: test/lint/build) and a manual git-pull production deploy for the
> 4-role-subdomain layout on `creditcore.uz`. Builds on the existing `deploy/` + `docker-compose.yml`.

## 1. Goal

The monorepo (4 web apps + backend) has a near-complete prod setup (`docker-compose.yml`, `deploy/`
Dockerfiles, `deploy/nginx/default.conf`) but **no CI** and a domain config that doesn't fully match the
target DNS. This module adds GitHub Actions CI (no auto-deploy), reconciles the nginx/domain config to
the real subdomains, adds TLS, and provides one-command **install / update / deploy** scripts plus docs.

**Boundary:** this delivers the configs, scripts, CI workflow, and docs. The actual server actions (SSH
to the box, `docker compose up`, issuing TLS certs, adding DNS records) are run **by the operator** — out
of scope for automated execution here.

## 2. Domains (target)

DNS A-records (operator-managed) → server IP:
- `api.creditcore.uz` → backend
- `operator.creditcore.uz`, `moderator.creditcore.uz`, `director.creditcore.uz`, `admin.creditcore.uz` → role web apps

**Not in scope:** `creditcore.uz` (apex), `www`, `mail`, `ftp` — no app behaviour; `mail`/`ftp` are the
host's defaults. No landing page.

## 3. nginx routing (`deploy/nginx/default.conf`)

- `api.creditcore.uz` → `proxy_pass http://backend:3000` (keep; `client_max_body_size 25m`).
- 4 role subdomains → their web containers via the existing `$host → $web_upstream` map.
- **Add:** TLS `server` blocks on 443 for all 5 names referencing `/etc/nginx/certs`; redirect 80→443
  (except the ACME challenge path `/.well-known/acme-challenge/`).
- Security headers: `X-Forwarded-*` already set; add `X-Content-Type-Options`, `X-Frame-Options`.

## 4. TLS (Let's Encrypt)

- A `certbot` container (or host certbot) issues a single cert covering the 5 names
  (`api` + 4 roles) into `deploy/nginx/certs`.
- Auto-renew via a cron / `certbot renew` + `nginx -s reload`.
- Documented as a **one-time manual issuance** + renew step (operator runs it; needs DNS already pointing
  at the server). nginx 80 serves the ACME challenge before certs exist.

## 5. CI — GitHub Actions (`.github/workflows/ci.yml`)

Triggers: `pull_request` + `push` to `master`. Single workflow, Node 20, npm cache. Steps:
1. `npm ci`
2. `npm run build -w @credit-core/shared`
3. `npm run db:generate -w @credit-core/backend` (prisma client for typecheck; no DB needed — tests are pure-unit)
4. `npm run lint` (workspaces, `--if-present`)
5. Backend: `tsc --noEmit` + `npm test -w @credit-core/backend` (Jest)
6. Web: for each of the 4 apps, `tsc --noEmit` + `vite build`

No deploy job (operator deploys manually). Green check gates merges.

## 6. Deploy & ops (manual)

- `deploy/.env.example` (prod): `MYSQL_ROOT_PASSWORD`, `JWT_SECRET`, `DATABASE_URL`,
  `VITE_API_URL=https://api.creditcore.uz`, `CORS_ORIGINS=https://operator…,https://moderator…,…`.
- `deploy/deploy.sh` (first install): assert `.env` present → `docker compose build` →
  `docker compose up -d` → `prisma migrate deploy` (in the backend container) → first-run `db:seed`.
- `deploy/update.sh` (the "git pull / update" flow): `git pull` → `docker compose up -d --build` →
  `prisma migrate deploy`. Idempotent; safe to re-run.
- `deploy/README.md`: server prerequisites (Docker + compose plugin), DNS checklist, first install,
  update, TLS issuance/renew, env reference, rollback note (`git checkout <tag> && update.sh`).

## 7. Prod migrations (drift fix)

The audit tables (`AuditLog`/`RequestLog`/`QueryLog` + `AuditAction` enum) were synced to dev via
`prisma db push` and have **no migration file**, so `prisma migrate deploy` on a fresh prod DB would not
create them. Generate a catch-up migration (`prisma migrate diff` from the migrations dir to
`schema.prisma`, emitted as SQL under `prisma/migrations/<ts>_audit_trail/`) so `migrate deploy` yields a
DB matching the schema. If `migrate diff` proves unreliable in this environment, the fallback is to switch
`deploy.sh`/`update.sh` to `prisma db push` (consistent with dev), documented as the alternative.

## 8. Compose adjustments (`docker-compose.yml`)

Mostly ready. Confirm/add: `web-*` build arg `VITE_API_URL` passed through `deploy/Dockerfile.web`;
`env_file: deploy/.env` on backend (instead of inline secrets); healthchecks optional. Keep MySQL `3307`
host mapping or close it (prod DB need not be host-exposed — bind to internal network only).

## 9. Testing / verification

- CI YAML: validate syntax (actionlint if available, else schema review); confirm step commands match
  the repo scripts.
- nginx config: `docker run --rm -v …:… nginx:1.27-alpine nginx -t` to syntax-check.
- deploy scripts: `bash -n` lint; dry-run the command sequence (no server).
- Catch-up migration: apply to a scratch DB (or verify SQL against the 3 models) — `migrate deploy`
  produces AuditLog/RequestLog/QueryLog.
- Whole repo still builds (shared/backend/web tsc + vite) and 44 backend tests pass.

## 10. Risks

- **Secrets:** never commit `deploy/.env` (gitignore it); only `.env.example` is committed.
- **TLS ordering:** certs require DNS→server first; nginx must serve port 80 ACME before 443 blocks
  reference missing certs — use a two-phase nginx conf or `certbot --webroot`.
- **DB exposure:** drop the `3307:3306` host mapping in prod so MySQL isn't reachable from outside.
- **migrate diff** may need a shadow DB / engine; fallback to `db push` documented (§7).
