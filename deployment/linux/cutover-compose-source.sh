#!/usr/bin/env bash
set -euo pipefail

PROJECT_NAME="${PROJECT_NAME:-linux}"
SERVICE_NAME="${SERVICE_NAME:-backend}"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "${SCRIPT_DIR}/../.." && pwd)"
LEGACY_COMPOSE_PATH="${SCRIPT_DIR}/docker-compose.prod.yml"
CANONICAL_COMPOSE_PATH="${ROOT_DIR}/tools/docker/docker-compose.prod.yml"
STATE_FILE="${SCRIPT_DIR}/.compose-cutover-state"
TIMESTAMP="$(date +%Y%m%d-%H%M%S)"
BACKUP_PATH="${SCRIPT_DIR}/docker-compose.prod.yml.bak-${TIMESTAMP}"
DEFAULT_PRODUCTS_DB="${DEFAULT_PRODUCTS_DB:-manufacturing_system}"
ENV_FILE="${SCRIPT_DIR}/.env"

echo "=== Workplan Deploy Compose Cutover ==="
echo "Project: ${PROJECT_NAME}"
echo "Service: ${SERVICE_NAME}"
echo "Legacy path: ${LEGACY_COMPOSE_PATH}"
echo "Canonical path: ${CANONICAL_COMPOSE_PATH}"
echo

if ! command -v docker >/dev/null 2>&1; then
  echo "ERROR: docker command not found"
  exit 1
fi

if [[ ! -f "${CANONICAL_COMPOSE_PATH}" ]]; then
  echo "ERROR: canonical compose file not found: ${CANONICAL_COMPOSE_PATH}"
  exit 1
fi

echo "[1/7] Pre-check docker stack metadata"
docker inspect workplan-backend --format 'project={{ index .Config.Labels "com.docker.compose.project" }} service={{ index .Config.Labels "com.docker.compose.service" }} file={{ index .Config.Labels "com.docker.compose.project.config_files" }}' || true
echo

echo "[2/7] Verify canonical compose contains PRODUCTS_DB_NAME"
if ! grep -q "PRODUCTS_DB_NAME" "${CANONICAL_COMPOSE_PATH}"; then
  echo "ERROR: canonical compose does not contain PRODUCTS_DB_NAME"
  exit 1
fi
echo "OK: PRODUCTS_DB_NAME found in canonical compose"
echo

echo "[3/7] Validate canonical compose runtime readiness"
CONFIG_TMP="$(mktemp)"
docker compose -p "${PROJECT_NAME}" -f "${CANONICAL_COMPOSE_PATH}" config > "${CONFIG_TMP}"
if grep -q "yourusername/workplanv6-backend" "${CONFIG_TMP}"; then
  echo "ERROR: canonical compose still references placeholder backend image"
  echo "Please switch backend service to build mode or a real registry image before cutover."
  rm -f "${CONFIG_TMP}"
  exit 1
fi
if ! grep -q "image: linux-backend" "${CONFIG_TMP}"; then
  echo "ERROR: canonical compose resolved backend image is not linux-backend"
  echo "Please verify backend build/image settings in ${CANONICAL_COMPOSE_PATH}"
  rm -f "${CONFIG_TMP}"
  exit 1
fi
rm -f "${CONFIG_TMP}"
echo "OK: canonical compose runtime settings are valid"
echo

echo "[4/7] Backup current legacy compose (if regular file)"
if [[ -L "${LEGACY_COMPOSE_PATH}" ]]; then
  CURRENT_TARGET="$(readlink "${LEGACY_COMPOSE_PATH}")"
  echo "Legacy compose is already a symlink -> ${CURRENT_TARGET}"
else
  if [[ -f "${LEGACY_COMPOSE_PATH}" ]]; then
    cp -a "${LEGACY_COMPOSE_PATH}" "${BACKUP_PATH}"
    echo "Backup created: ${BACKUP_PATH}"
  else
    echo "No existing legacy compose file to back up"
  fi
fi
echo

echo "[5/7] Ensure products DB env exists in ${ENV_FILE}"
if [[ -f "${ENV_FILE}" ]]; then
  if ! grep -q "^PRODUCTS_DB_NAME=" "${ENV_FILE}"; then
    echo "PRODUCTS_DB_NAME=${DEFAULT_PRODUCTS_DB}" >> "${ENV_FILE}"
    echo "Appended PRODUCTS_DB_NAME=${DEFAULT_PRODUCTS_DB}"
  else
    echo "PRODUCTS_DB_NAME already present"
  fi
else
  echo "PRODUCTS_DB_NAME=${DEFAULT_PRODUCTS_DB}" > "${ENV_FILE}"
  echo "Created ${ENV_FILE} with PRODUCTS_DB_NAME=${DEFAULT_PRODUCTS_DB}"
fi
echo

echo "[6/7] Switch legacy compose to symlink"
ln -sfn "${CANONICAL_COMPOSE_PATH}" "${LEGACY_COMPOSE_PATH}"
echo "Symlink set: ${LEGACY_COMPOSE_PATH} -> ${CANONICAL_COMPOSE_PATH}"
echo

echo "[7/7] Recreate backend and run verification"
docker compose -p "${PROJECT_NAME}" -f "${LEGACY_COMPOSE_PATH}" config >/dev/null
docker compose -p "${PROJECT_NAME}" -f "${LEGACY_COMPOSE_PATH}" up -d --build --force-recreate "${SERVICE_NAME}"

CONTAINER_ID="$(docker compose -p "${PROJECT_NAME}" -f "${LEGACY_COMPOSE_PATH}" ps -q "${SERVICE_NAME}")"
if [[ -z "${CONTAINER_ID}" ]]; then
  echo "ERROR: cannot resolve container id for service ${SERVICE_NAME}"
  exit 1
fi

docker exec "${CONTAINER_ID}" sh -lc 'printenv | grep PRODUCTS_DB_NAME'
curl -fsS "http://127.0.0.1:8080/api/process-steps/search?query=882540" || true
echo

printf '%s\n' \
  "timestamp=${TIMESTAMP}" \
  "project=${PROJECT_NAME}" \
  "service=${SERVICE_NAME}" \
  "legacy=${LEGACY_COMPOSE_PATH}" \
  "canonical=${CANONICAL_COMPOSE_PATH}" \
  "backup=${BACKUP_PATH}" \
  "env_file=${ENV_FILE}" > "${STATE_FILE}"

echo "Cutover completed."
echo "State saved to ${STATE_FILE}"
echo "Use rollback script if needed: ${SCRIPT_DIR}/rollback-compose-source.sh"
