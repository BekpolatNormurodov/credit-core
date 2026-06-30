# Deploy — credit-core (creditcore.uz)

Production runs the whole stack with Docker Compose behind nginx: **MySQL + backend + 4 role web
apps + nginx + certbot**. Deploy is **manual** (CI only builds/tests — it does not deploy).

## 0. Server setup (one time, on the Ubuntu server)

```bash
git clone https://github.com/khurshid28/credit-core.git
cd credit-core
sudo bash deploy/server-setup.sh   # installs Docker + Compose plugin, opens firewall (22/80/443)
```

- **DNS A-records** (you manage these) all pointing at the server IP:
  `api`, `operator`, `moderator`, `director`, `admin` `.creditcore.uz`.
  (apex / `www` / `mail` / `ftp` are not used by the app.)
- **certbot is NOT installed on the host** — it runs as a container (see §2).

## 1. First install

```bash
cp deploy/.env.example deploy/.env
nano deploy/.env            # set MYSQL_ROOT_PASSWORD, JWT_SECRET, DATABASE_URL (CERTBOT_EMAIL is preset)
bash deploy/deploy.sh       # builds, starts, syncs schema (prisma db push), seeds
```

Seed logins (password `parol123`): `operator`, `moderator`, `director`, `admin`.

## 2. TLS (one time, after DNS resolves to the server)

```bash
bash deploy/init-letsencrypt.sh
```

Issues one Let's Encrypt certificate covering all 5 names and reloads nginx. The `certbot` container
auto-renews every 12h thereafter.

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
| `CERTBOT_EMAIL` | Let's Encrypt contact |

`deploy/.env` is gitignored — never commit it.

## 5. Routing

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
