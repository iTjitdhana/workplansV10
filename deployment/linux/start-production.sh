#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

if [[ ! -f ".env" ]]; then
  echo "Missing deployment/linux/.env"
  echo "Run: cp .env.prod.example .env"
  echo "Then edit .env with production values"
  exit 1
fi

echo "Bringing up Linux production stack..."
docker compose --env-file .env -f docker-compose.prod.yml up -d --build

echo "Waiting for health checks..."
sleep 5
docker compose --env-file .env -f docker-compose.prod.yml ps

echo "Health endpoint:"
NGINX_PORT="$(awk -F= '/^NGINX_HTTP_PORT=/{print $2}' .env | tr -d '\r' || true)"
if [[ -z "${NGINX_PORT:-}" ]]; then
  NGINX_PORT=80
fi
echo "  http://localhost:${NGINX_PORT}/health"
