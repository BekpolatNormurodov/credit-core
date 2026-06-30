# Deploy — credit-core (creditcore.uz)

Production runs the stack with Docker Compose: **MySQL + backend + 4 role web apps + nginx**.
The stack's nginx serves **plain HTTP on `127.0.0.1:8080`**; the **server's own reverse proxy /
panel owns ports 80 + 443, terminates TLS, and forwards** the 5 subdomains to it. Deploy is
**manual** (CI only builds/tests — it does not deploy).

## 0. Server setup (one time — Ubuntu 22.04 or 24.04)

```bash
git clone https://github.com/khurshid28/credit-core.git
cd credit-core
sudo bash deploy/server-setup.sh   # installs Docker + Compose plugin, opens firewall (22/80/443)
```

- **DNS A-records** (you manage these) all pointing at the server IP:
  `api`, `operator`, `moderator`, `director`, `admin` `.creditcore.uz`.
  (apex / `www` / `mail` / `ftp` are not used by the app.)
- **TLS is handled by your existing reverse proxy / panel** (the thing already on 80/443) —
  this stack does not run certbot and does not bind 80/443 (it would error if it tried).

## 1. First install

```bash
cp deploy/.env.example deploy/.env
nano deploy/.env            # set MYSQL_ROOT_PASSWORD, JWT_SECRET, DATABASE_URL
bash deploy/deploy.sh       # builds, starts, syncs schema (prisma db push), seeds
```

Seed logins (password `parol123`): `operator`, `moderator`, `director`, `admin`.

## 2. Host nginx + TLS (one command, after DNS resolves to the server)

The app's container nginx listens on `:80` internally and is published on `127.0.0.1:8080`.
The **host's own nginx** sits in front on 80/443, terminates TLS, and proxies the 5 subdomains
to it. One script does the whole thing — installs host nginx + certbot, writes the vhost, and
issues the certificate:

```bash
sudo bash deploy/host-tls.sh
```

It:
- installs `nginx` + `certbot` on the host (no-op if already there),
- writes `/etc/nginx/sites-available/creditcore.uz` proxying all 5 subdomains → `http://127.0.0.1:8080`
  (passing the `Host` header — routing is by host),
- runs `certbot --nginx` for `api/operator/moderator/director/admin.creditcore.uz`, which adds the
  443 server block, the HTTP→HTTPS redirect, and a **systemd auto-renew timer** (no certbot container).

Email + domains are baked into the script (`khurshidi2827@gmail.com`). Verify renewal with
`certbot renew --dry-run`.

> **Using a panel** (aaPanel / CyberPanel / Plesk / etc.) instead of plain host nginx? Don't run
> the script — it would clash with the panel's nginx. Instead create a reverse-proxy site for each
> subdomain pointing at `http://127.0.0.1:8080` (preserve the `Host` header) and flip on its TLS toggle.

## 3. Update (deploy new code)

```bash
bash deploy/update.sh        # git pull → rebuild → restart (schema re-synced on backend start)
```

## 4. Environment (`deploy/.env`)

| Var | Meaning |
|---|---|
| `MYSQL_ROOT_PASSWORD` | MySQL root password (internal network only) |
| `JWT_SECRET` | backend JWT signing secret (long random) |
| `DATABASE_URL` | `mysql://root:<pw>@mysql:3306/credit_core` |
| `VITE_API_URL` | baked into web builds — `https://api.creditcore.uz` |
| `CORS_ORIGINS` | the 4 role origins, comma-separated |

`deploy/.env` is gitignored — never commit it. (TLS lives on the host proxy, so there's no
`CERTBOT_EMAIL` here.)

## 5. Routing

The host proxy forwards every subdomain to `http://127.0.0.1:8080`; the stack's nginx then
splits by `Host`:

| Host | → |
|---|---|
| `api.creditcore.uz` | backend (NestJS :3000) |
| `operator/moderator/director/admin.creditcore.uz` | the matching role web app |

## 6. Ops

- Logs: `docker compose logs -f backend` (or `nginx`, `web-operator`, …).
- Status: `docker compose ps`.
- Rollback: `git checkout <previous-commit-or-tag> && bash deploy/update.sh`.
- DB is **not** exposed to the host; reach it via `docker compose exec mysql mysql -uroot -p`.

## Notes

- Schema is applied with `prisma db push` (additive-safe, matches dev). For audited migrations later,
  switch the backend `Dockerfile.backend` CMD to `prisma migrate deploy` and add migration files.
- The 4 web apps share `packages/ui` (`RoleApp`); each image is built with its own `APP` arg.
