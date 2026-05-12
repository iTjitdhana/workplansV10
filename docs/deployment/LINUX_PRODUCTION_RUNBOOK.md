# Linux Production Runbook

This runbook is the operational reference for internal Linux deployment.

## 1) One-time server preparation

1. Install Docker Engine and Docker Compose plugin.
2. Create deploy directory, example: `/opt/workplansV10-1`.
3. Ensure network policy allows only internal access (LAN/VPN/allowlist).

## 2) Prepare environment

```bash
cd /opt/workplansV10-1/deployment/linux
cp .env.prod.example .env
```

Edit `.env` with real values:

- `DB_HOST`, `DB_PORT`, `DB_USER`, `DB_PASSWORD`, `DB_NAME`
- `CORS_ORIGINS` (comma-separated internal origins)
- `PUBLIC_HOST`
- `NGINX_HTTP_PORT` (usually `80`)

## 3) Deploy / Start

```bash
cd /opt/workplansV10-1/deployment/linux
docker compose --env-file .env -f docker-compose.prod.yml up -d --build
docker compose --env-file .env -f docker-compose.prod.yml ps
```

## 4) Validation checklist

```bash
curl -f http://127.0.0.1:${NGINX_HTTP_PORT:-80}/health
docker compose --env-file .env -f docker-compose.prod.yml ps
docker compose --env-file .env -f docker-compose.prod.yml logs --tail=100
```

Required:

- `backend` and `frontend` are `healthy`
- `nginx` is `running`
- `/health` returns HTTP `200`

## 5) Update deployment

```bash
cd /opt/workplansV10-1
git fetch origin
git checkout main
git pull --ff-only origin main
cd deployment/linux
docker compose --env-file .env -f docker-compose.prod.yml up -d --build
```

## 6) Rollback

```bash
cd /opt/workplansV10-1
git log --oneline -n 5
git checkout <previous-good-commit>
cd deployment/linux
docker compose --env-file .env -f docker-compose.prod.yml up -d --build
```

## 7) Notes

- Never commit real secrets into git.
- Keep `.env` only on server with restricted permission (`chmod 600 .env`).
- Expose only Nginx ingress port to internal network.
