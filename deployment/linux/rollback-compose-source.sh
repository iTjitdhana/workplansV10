#!/usr/bin/env bash
set -euo pipefail

PROJECT_NAME="${PROJECT_NAME:-linux}"
SERVICE_NAME="${SERVICE_NAME:-backend}"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
LEGACY_COMPOSE_PATH="${SCRIPT_DIR}/docker-compose.prod.yml"
STATE_FILE="${SCRIPT_DIR}/.compose-cutover-state"

echo "=== Workplan Deploy Compose Rollback ==="
echo "Project: ${PROJECT_NAME}"
echo "Service: ${SERVICE_NAME}"
echo

if ! command -v docker >/dev/null 2>&1; then
  echo "ERROR: docker command not found"
  exit 1
fi

BACKUP_PATH=""
if [[ -f "${STATE_FILE}" ]]; then
  # shellcheck disable=SC1090
  source "${STATE_FILE}"
  BACKUP_PATH="${backup:-}"
fi

if [[ -z "${BACKUP_PATH}" || ! -f "${BACKUP_PATH}" ]]; then
  LATEST_BACKUP="$(ls -1t "${SCRIPT_DIR}"/docker-compose.prod.yml.bak-* 2>/dev/null | head -1 || true)"
  BACKUP_PATH="${LATEST_BACKUP}"
fi

if [[ -z "${BACKUP_PATH}" || ! -f "${BACKUP_PATH}" ]]; then
  echo "ERROR: backup compose file not found"
  exit 1
fi

echo "Using backup: ${BACKUP_PATH}"

rm -f "${LEGACY_COMPOSE_PATH}"
cp -a "${BACKUP_PATH}" "${LEGACY_COMPOSE_PATH}"
echo "Restored ${LEGACY_COMPOSE_PATH} from backup"

docker compose -p "${PROJECT_NAME}" -f "${LEGACY_COMPOSE_PATH}" config >/dev/null
docker compose -p "${PROJECT_NAME}" -f "${LEGACY_COMPOSE_PATH}" up -d --build --force-recreate "${SERVICE_NAME}"

CONTAINER_ID="$(docker compose -p "${PROJECT_NAME}" -f "${LEGACY_COMPOSE_PATH}" ps -q "${SERVICE_NAME}")"
if [[ -n "${CONTAINER_ID}" ]]; then
  docker exec "${CONTAINER_ID}" sh -lc 'echo "DB env snapshot:"; printenv | grep -E "DB_NAME|PRODUCTS_DB_NAME" || true'
fi

curl -fsS "http://127.0.0.1:8080/health" || true
echo
echo "Rollback completed."
