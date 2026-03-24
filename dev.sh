#!/usr/bin/env bash
# dev.sh — Start all services for local development
# Usage: ./dev.sh [--no-frontend] [--infra-only]
#
# Run with bash (not sh):  bash dev.sh  or  chmod +x dev.sh && ./dev.sh
#
# Env files (in priority order):
#   1. .env.local  (root) — put API keys here; gitignored
#   2. <svc>/.env.local   — per-service overrides
#   3. <svc>/.env         — auto-copied from .env.example if missing
#
# NOTE: vite.config.js proxies /api and /ws to :3001, but backend
# .env.example sets PORT=3000. Align one or the other before running.

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

log()  { printf "${BOLD}[dev]${RESET} %s\n" "$*"; }
ok()   { printf "${GREEN}[dev]${RESET} %s\n" "$*"; }
warn() { printf "${YELLOW}[dev]${RESET} %s\n" "$*"; }
err()  { printf "${RED}[dev]${RESET} %s\n" "$*" >&2; }

# ── Prerequisites ──────────────────────────────────────────────────────────────
check_cmd() { command -v "$1" &>/dev/null || { err "Required: $1 not found"; exit 1; }; }
check_cmd docker
check_cmd node
check_cmd python3

mkdir -p "$LOGS_DIR"

# ── Load root .env.local (API keys etc.) ──────────────────────────────────────
ROOT_ENV_FILE=""
if [[ -f "$ROOT/.env.local" ]]; then
  ROOT_ENV_FILE="$ROOT/.env.local"
  log "Loading root .env.local"
  set -a; source "$ROOT_ENV_FILE"; set +a
elif [[ -f "$ROOT/.env" ]]; then
  ROOT_ENV_FILE="$ROOT/.env"
  warn "No .env.local found — using root .env"
  set -a; source "$ROOT_ENV_FILE"; set +a
else
  warn "No root .env.local or .env — API keys may be missing (create .env.local)"
fi

# ── Per-service .env setup ─────────────────────────────────────────────────────
# Services load their own .env (connection strings, local config).
# API keys already exported above will take precedence over .env values.
for svc in backend ai-service frontend; do
  if [[ -f "$ROOT/$svc/.env.local" ]]; then
    : # already handled by the service's own dotenv or inherited from env
  elif [[ ! -f "$ROOT/$svc/.env" ]]; then
    if [[ -f "$ROOT/$svc/.env.example" ]]; then
      warn "$svc/.env missing — copying from .env.example"
      cp "$ROOT/$svc/.env.example" "$ROOT/$svc/.env"
    else
      warn "$svc/.env missing and no .env.example found"
    fi
  fi
done

# ── Cleanup ────────────────────────────────────────────────────────────────────
cleanup() {
  printf "\n"
  log "Shutting down services..."
  if [[ ${#PIDS[@]} -gt 0 ]]; then
    kill "${PIDS[@]}" 2>/dev/null || true
  fi
  docker compose -f "$ROOT/docker-compose.yml" stop postgres redis 2>/dev/null || true
  ok "All services stopped."
}
trap cleanup EXIT INT TERM

# ── Infrastructure (Postgres + Redis) ─────────────────────────────────────────
COMPOSE_ARGS=(-f "$ROOT/docker-compose.yml")
[[ -n "$ROOT_ENV_FILE" ]] && COMPOSE_ARGS+=(--env-file "$ROOT_ENV_FILE")

log "Starting infrastructure (postgres, redis)..."
docker compose "${COMPOSE_ARGS[@]}" up -d postgres redis

# Postgres can take 60-90s on first start (PostGIS + pgvector extension init)
log "Waiting for postgres (up to 90s on first run)..."
for i in $(seq 1 45); do
  if docker compose "${COMPOSE_ARGS[@]}" exec -T postgres \
      pg_isready -U appuser -d conflicts_db &>/dev/null; then
    ok "Postgres ready (${i}x2s)."
    break
  fi
  [[ $i -eq 45 ]] && { err "Postgres did not become healthy in time"; exit 1; }
  sleep 2
done

log "Waiting for redis..."
for i in $(seq 1 15); do
  if docker compose "${COMPOSE_ARGS[@]}" exec -T redis redis-cli ping &>/dev/null; then
    ok "Redis ready."
    break
  fi
  [[ $i -eq 15 ]] && { err "Redis did not become healthy in time"; exit 1; }
  sleep 1
done

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
printf "\n"
printf "${BOLD}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${RESET}\n"
printf "${CYAN}  Frontend   ${RESET}http://localhost:5173\n"
printf "${CYAN}  Backend    ${RESET}http://localhost:3000  (API docs: /api-docs)\n"
printf "${CYAN}  AI Service ${RESET}http://localhost:8000  (docs: /docs)\n"
printf "${CYAN}  Postgres   ${RESET}localhost:5432\n"
printf "${CYAN}  Redis      ${RESET}localhost:6379\n"
printf "${BOLD}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${RESET}\n"
printf "\nLogs: .dev-logs/   |   Press Ctrl+C to stop all services\n\n"

# Tail all logs combined
TAIL_LOGS=("$LOGS_DIR/backend.log" "$LOGS_DIR/ai-service.log")
[[ $NO_FRONTEND == false ]] && TAIL_LOGS+=("$LOGS_DIR/frontend.log")
tail -n 0 -F "${TAIL_LOGS[@]}" 2>/dev/null &
PIDS+=($!)

wait
