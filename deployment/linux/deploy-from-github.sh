#!/usr/bin/env bash
set -euo pipefail

# Safe deploy script for Linux production.
# This script does not generate credentials and does not write secrets into the repo.

REPO_URL="${REPO_URL:-}"
REPO_BRANCH="${REPO_BRANCH:-main}"
DEPLOY_DIR="${DEPLOY_DIR:-/opt/workplansV10-1}"

if [[ -z "$REPO_URL" ]]; then
  echo "REPO_URL is required. Example:"
  echo "  REPO_URL=https://github.com/<org>/<repo>.git ./deploy-from-github.sh"
  exit 1
fi

if ! command -v git >/dev/null 2>&1; then
  echo "git is required"
  exit 1
fi

if ! command -v docker >/dev/null 2>&1; then
  echo "docker is required"
  exit 1
fi

echo "Deploy directory: $DEPLOY_DIR"
if [[ ! -d "$DEPLOY_DIR/.git" ]]; then
  mkdir -p "$DEPLOY_DIR"
  git clone --branch "$REPO_BRANCH" "$REPO_URL" "$DEPLOY_DIR"
else
  git -C "$DEPLOY_DIR" fetch origin "$REPO_BRANCH"
  git -C "$DEPLOY_DIR" checkout "$REPO_BRANCH"
  git -C "$DEPLOY_DIR" pull --ff-only origin "$REPO_BRANCH"
fi

cd "$DEPLOY_DIR/deployment/linux"

if [[ ! -f ".env" ]]; then
  cp .env.prod.example .env
  echo "Created deployment/linux/.env from template."
  echo "Please edit deployment/linux/.env and set real production values, then rerun."
  exit 1
fi

echo "Starting services..."
docker compose --env-file .env -f docker-compose.prod.yml up -d --build

echo "Service status:"
docker compose --env-file .env -f docker-compose.prod.yml ps

echo "Recent logs:"
docker compose --env-file .env -f docker-compose.prod.yml logs --tail=20
