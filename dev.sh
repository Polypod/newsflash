#!/usr/bin/env bash
# dev.sh — Start all services for local development
# Usage: ./dev.sh [--no-frontend] [--infra-only]
#
# NOTE: vite.config.js proxies /api and /ws to :3001, but the backend
# .env.example sets PORT=3000. If the frontend can't reach the API,
# either change vite.config.js target to :3000 or set PORT=3001 in
# backend/.env.

set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
LOGS_DIR="$ROOT/.dev-logs"
PIDS=()
NO_FRONTEND=false
INFRA_ONLY=false

for arg in "$@"; do
  case $arg in
    --no-frontend) NO_FRONTEND=true ;;
    --infra-only)  INFRA_ONLY=true ;;
  esac
done

# ── Colours ────────────────────────────────────────────────────────────────────
RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'
CYAN='\033[0;36m'; BOLD='\033[1m'; RESET='\033[0m'

log()  { echo -e "${BOLD}[dev]${RESET} $*"; }
ok()   { echo -e "${GREEN}[dev]${RESET} $*"; }
warn() { echo -e "${YELLOW}[dev]${RESET} $*"; }
err()  { echo -e "${RED}[dev]${RESET} $*" >&2; }

# ── Prerequisites ──────────────────────────────────────────────────────────────
check_cmd() {
  command -v "$1" &>/dev/null || { err "Required: $1 not found"; exit 1; }
}
check_cmd docker
check_cmd node
check_cmd python3

mkdir -p "$LOGS_DIR"

# ── .env setup ─────────────────────────────────────────────────────────────────
for svc in backend ai-service frontend; do
  if [[ ! -f "$ROOT/$svc/.env" ]]; then
    if [[ -f "$ROOT/$svc/.env.example" ]]; then
      warn "$svc/.env missing — copying from .env.example (fill in API keys!)"
      cp "$ROOT/$svc/.env.example" "$ROOT/$svc/.env"
    else
      warn "$svc/.env missing and no .env.example found"
    fi
  fi
done

# ── Cleanup ────────────────────────────────────────────────────────────────────
cleanup() {
  echo ""
  log "Shutting down services..."
  for pid in "${PIDS[@]}"; do
    kill "$pid" 2>/dev/null || true
  done
  # Stop infra containers
  docker compose -f "$ROOT/docker-compose.yml" stop postgres redis 2>/dev/null || true
  ok "All services stopped."
}
trap cleanup EXIT INT TERM

# ── Infrastructure (Postgres + Redis) ─────────────────────────────────────────
log "Starting infrastructure (postgres, redis)..."
docker compose -f "$ROOT/docker-compose.yml" up -d postgres redis

log "Waiting for postgres to be healthy..."
for i in $(seq 1 30); do
  docker compose -f "$ROOT/docker-compose.yml" exec -T postgres \
    pg_isready -U appuser -d conflicts_db &>/dev/null && break
  [[ $i -eq 30 ]] && { err "Postgres did not become healthy in time"; exit 1; }
  sleep 1
done
ok "Postgres ready."

log "Waiting for redis to be healthy..."
for i in $(seq 1 15); do
  docker compose -f "$ROOT/docker-compose.yml" exec -T redis \
    redis-cli ping &>/dev/null && break
  [[ $i -eq 15 ]] && { err "Redis did not become healthy in time"; exit 1; }
  sleep 1
done
ok "Redis ready."

[[ $INFRA_ONLY == true ]] && { ok "Infra only mode — done."; exit 0; }

# ── Backend ────────────────────────────────────────────────────────────────────
if [[ ! -d "$ROOT/backend/node_modules" ]]; then
  log "Installing backend dependencies..."
  (cd "$ROOT/backend" && npm install) >> "$LOGS_DIR/backend-install.log" 2>&1
fi

log "Starting backend..."
(cd "$ROOT/backend" && npm run dev) > "$LOGS_DIR/backend.log" 2>&1 &
PIDS+=($!)
ok "Backend started (pid $!, log: .dev-logs/backend.log)"

# ── AI Service ─────────────────────────────────────────────────────────────────
if [[ ! -d "$ROOT/ai-service/.venv" ]]; then
  log "Creating ai-service virtualenv..."
  python3 -m venv "$ROOT/ai-service/.venv"
fi

log "Checking ai-service dependencies..."
(cd "$ROOT/ai-service" && .venv/bin/pip install -q -r requirements.txt) \
  >> "$LOGS_DIR/ai-service-install.log" 2>&1

log "Starting ai-service..."
(cd "$ROOT/ai-service" && .venv/bin/uvicorn src.main:app --reload --port 8000 --host 127.0.0.1) \
  > "$LOGS_DIR/ai-service.log" 2>&1 &
PIDS+=($!)
ok "AI service started (pid $!, log: .dev-logs/ai-service.log)"

# ── Frontend ───────────────────────────────────────────────────────────────────
if [[ $NO_FRONTEND == false ]]; then
  if [[ ! -d "$ROOT/frontend/node_modules" ]]; then
    log "Installing frontend dependencies..."
    (cd "$ROOT/frontend" && npm install) >> "$LOGS_DIR/frontend-install.log" 2>&1
  fi

  log "Starting frontend..."
  (cd "$ROOT/frontend" && npm run dev) > "$LOGS_DIR/frontend.log" 2>&1 &
  PIDS+=($!)
  ok "Frontend started (pid $!, log: .dev-logs/frontend.log)"
fi

# ── Summary ────────────────────────────────────────────────────────────────────
echo ""
echo -e "${BOLD}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${RESET}"
echo -e "${CYAN}  Frontend   ${RESET}http://localhost:5173"
echo -e "${CYAN}  Backend    ${RESET}http://localhost:3000  (API docs: /api-docs)"
echo -e "${CYAN}  AI Service ${RESET}http://localhost:8000  (docs: /docs)"
echo -e "${CYAN}  Postgres   ${RESET}localhost:5432"
echo -e "${CYAN}  Redis      ${RESET}localhost:6379"
echo -e "${BOLD}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${RESET}"
echo ""
echo "Logs: .dev-logs/   |   Press Ctrl+C to stop all services"
echo ""

# Tail all logs combined
tail -n 0 -F \
  "$LOGS_DIR/backend.log" \
  "$LOGS_DIR/ai-service.log" \
  ${NO_FRONTEND:-"$LOGS_DIR/frontend.log"} \
  2>/dev/null &
PIDS+=($!)

wait
