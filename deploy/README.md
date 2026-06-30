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

## 2. Front the app with your reverse proxy + TLS (one time)

The app listens on `127.0.0.1:8080`. Point your existing proxy / panel at it and let **it**
terminate TLS for the 5 subdomains, preserving the `Host` header. Example host-nginx vhost
(adjust cert paths to whatever your panel issues — Let's Encrypt, the panel's own ACME, etc.):

```nginx
# /etc/nginx/sites-available/creditcore.uz  (on the host, NOT in the container)
server {
    listen 443 ssl;
    http2  on;
    server_name api.creditcore.uz operator.creditcore.uz moderator.creditcore.uz
                director.creditcore.uz admin.creditcore.uz;

    ssl_certificate     /etc/letsencrypt/live/creditcore.uz/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/creditcore.uz/privkey.pem;

    client_max_body_size 25m;

    location / {
        proxy_pass http://127.0.0.1:8080;
        proxy_set_header Host              $host;             # required — routing is by Host
        proxy_set_header X-Real-IP         $remote_addr;
        proxy_set_header X-Forwarded-For   $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
server {                                   # redirect plain HTTP → HTTPS
    listen 80;
    server_name api.creditcore.uz operator.creditcore.uz moderator.creditcore.uz
                director.creditcore.uz admin.creditcore.uz;
    return 301 https://$host$request_uri;
}
```

Issue the cert with your host's certbot (covers all 5 names in one go):

```bash
sudo certbot --nginx -d api.creditcore.uz -d operator.creditcore.uz \
  -d moderator.creditcore.uz -d director.creditcore.uz -d admin.creditcore.uz \
  --email khurshidi2827@gmail.com --agree-tos --no-eff-email
```

> If your panel (aaPanel / CyberPanel / Plesk / etc.) manages vhosts, just create a reverse-proxy
> site for each subdomain pointing at `http://127.0.0.1:8080` and enable its TLS toggle.

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
