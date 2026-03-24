#!/usr/bin/env bash
# deploy_vps.sh — Deploy / update Newsflash on a VPS
#
# Usage:
#   bash scripts/deploy_vps.sh [--domain yourdomain.com] [--branch main]
#
# Prerequisites (run setup_vps.sh first):
#   - Node.js 20, Python 3.12, Docker, PM2, Caddy installed
#   - .env files present in backend/, ai-service/, frontend/
#   - Repo cloned at $APP_DIR (default: /opt/newsflash)
#
# On first run: creates Caddyfile and starts everything.
# Subsequent runs: git pull + rolling reload with zero-downtime.

set -euo pipefail

# ── Config (override via env vars) ────────────────────────────────────────────
APP_DIR="${APP_DIR:-/opt/newsflash}"
WEBROOT="${WEBROOT:-/var/www/newsflash}"
LOG_DIR="${LOG_DIR:-/var/log/newsflash}"
BRANCH="${BRANCH:-main}"
DOMAIN="${DOMAIN:-}"          # e.g. newsflash.example.com
CADDY_EMAIL="${CADDY_EMAIL:-}" # for TLS cert notifications

# Parse flags
while [[ $# -gt 0 ]]; do
  case $1 in
    --domain) DOMAIN="$2"; shift 2 ;;
    --branch) BRANCH="$2"; shift 2 ;;
    --email)  CADDY_EMAIL="$2"; shift 2 ;;
    *) echo "Unknown option: $1"; exit 1 ;;
  esac
done

# ── Colours ────────────────────────────────────────────────────────────────────
BOLD='\033[1m'; GREEN='\033[0;32m'; CYAN='\033[0;36m'
YELLOW='\033[1;33m'; RED='\033[0;31m'; RESET='\033[0m'
step()  { echo -e "\n${BOLD}${CYAN}▶ $*${RESET}"; }
ok()    { echo -e "${GREEN}✓ $*${RESET}"; }
warn()  { echo -e "${YELLOW}⚠ $*${RESET}"; }
fail()  { echo -e "${RED}✗ $*${RESET}" >&2; exit 1; }

# ── Sanity checks ──────────────────────────────────────────────────────────────
command -v docker  &>/dev/null || fail "docker not found — run setup_vps.sh first"
command -v pm2     &>/dev/null || fail "pm2 not found — run setup_vps.sh first"
command -v caddy   &>/dev/null || fail "caddy not found — run setup_vps.sh first"
[[ -d "$APP_DIR/.git" ]]       || fail "No git repo at $APP_DIR — clone the repo first"

mkdir -p "$LOG_DIR" "$WEBROOT"

# ── .env validation ────────────────────────────────────────────────────────────
step "Checking .env files"
for svc in backend ai-service frontend; do
  if [[ ! -f "$APP_DIR/$svc/.env" ]]; then
    if [[ -f "$APP_DIR/$svc/.env.example" ]]; then
      warn "$svc/.env missing — copying .env.example (you MUST fill in real API keys)"
      cp "$APP_DIR/$svc/.env.example" "$APP_DIR/$svc/.env"
    else
      fail "$svc/.env not found and no .env.example available"
    fi
  fi
done
ok ".env files present"

# ── Git pull ───────────────────────────────────────────────────────────────────
step "Pulling latest code (branch: $BRANCH)"
cd "$APP_DIR"
git fetch origin
git checkout "$BRANCH"
git pull origin "$BRANCH"
COMMIT=$(git rev-parse --short HEAD)
ok "At commit $COMMIT"

# ── Infrastructure (Postgres + Redis via Docker) ───────────────────────────────
step "Starting infrastructure containers"
docker compose -f "$APP_DIR/docker-compose.yml" up -d postgres redis

# Wait for postgres
ok "Waiting for postgres..."
for i in $(seq 1 30); do
  docker compose -f "$APP_DIR/docker-compose.yml" exec -T postgres \
    pg_isready -U appuser -d conflicts_db &>/dev/null && break
  [[ $i -eq 30 ]] && fail "Postgres did not become healthy"
  sleep 2
done
ok "Postgres ready"

# ── Database schema bootstrap ─────────────────────────────────────────────────
# init.sql uses IF NOT EXISTS throughout, so it's idempotent and safe to run on
# every deploy. This handles both first-deploy creation and any new tables/
# indexes added in subsequent commits. It does NOT handle ALTER TABLE changes
# (column additions etc.) — add manual migration steps below if schema evolves.
step "Applying database schema (init.sql)"
docker compose -f "$APP_DIR/docker-compose.yml" exec -T postgres \
  psql -U appuser -d conflicts_db \
  -f /docker-entrypoint-initdb.d/init.sql \
  -v ON_ERROR_STOP=1 \
  --quiet
ok "Schema up to date"

# ── Backend (Node.js via PM2) ──────────────────────────────────────────────────
step "Deploying backend"
cd "$APP_DIR/backend"
npm ci --omit=dev --silent
export APP_DIR
if pm2 describe newsflash-backend &>/dev/null; then
  pm2 reload ecosystem.config.js --only newsflash-backend --env production
else
  pm2 start "$APP_DIR/ecosystem.config.js" --only newsflash-backend --env production
fi
ok "Backend deployed"

# ── AI Service (Python/uvicorn via PM2) ───────────────────────────────────────
step "Deploying ai-service"
cd "$APP_DIR/ai-service"

# Ensure Chroma uses an absolute path so it survives working-dir changes
if grep -q 'CHROMA_DB_PATH=\./chroma_db' .env 2>/dev/null; then
  sed -i "s|CHROMA_DB_PATH=./chroma_db|CHROMA_DB_PATH=${APP_DIR}/ai-service/chroma_db|" .env
  warn "Updated CHROMA_DB_PATH to absolute path in ai-service/.env"
fi
mkdir -p "${APP_DIR}/ai-service/chroma_db"

# Create or update virtualenv
if [[ ! -d ".venv" ]]; then
  uv venv .venv
fi

uv pip install --python .venv/bin/python -r requirements.txt -q

export APP_DIR
if pm2 describe newsflash-ai &>/dev/null; then
  pm2 reload "$APP_DIR/ecosystem.config.js" --only newsflash-ai --env production
else
  pm2 start "$APP_DIR/ecosystem.config.js" --only newsflash-ai --env production
fi
ok "AI service deployed"

# ── Frontend (static build → Caddy webroot) ────────────────────────────────────
step "Building frontend"
cd "$APP_DIR/frontend"
npm ci --silent

# Set production API URLs in the build
# These get baked in at build time — VITE_* vars in frontend/.env are used
npm run build

# Copy dist to webroot served by Caddy
rm -rf "$WEBROOT/dist"
cp -r dist "$WEBROOT/dist"
ok "Frontend built and copied to $WEBROOT/dist"

# ── Caddy configuration ────────────────────────────────────────────────────────
CADDYFILE="/etc/caddy/Caddyfile"

write_caddyfile() {
  local domain="$1"
  local tls_section=""
  if [[ -n "$CADDY_EMAIL" ]]; then
    tls_section="tls ${CADDY_EMAIL}"
  fi

  cat > "$CADDYFILE" <<CADDY
# Newsflash — generated by deploy_vps.sh
# Regenerate: bash scripts/deploy_vps.sh --domain ${domain}
{
    email ${CADDY_EMAIL:-admin@${domain}}
}

${domain} {
    ${tls_section}

    # API + WebSocket → backend
    handle /api/* {
        reverse_proxy localhost:3000
    }

    handle /ws/* {
        reverse_proxy localhost:3000 {
            header_up Host {host}
            header_up X-Real-IP {remote_host}
        }
    }

    # SPA — serve frontend, fall back to index.html for client-side routing
    handle {
        root * ${WEBROOT}/dist
        try_files {path} /index.html
        file_server
    }

    # Logs
    log {
        output file /var/log/newsflash/caddy-access.log {
            roll_size 50mb
            roll_keep 5
        }
    }
}
CADDY
}

step "Configuring Caddy"
if [[ -z "$DOMAIN" ]]; then
  if grep -q "newsflash" "$CADDYFILE" 2>/dev/null; then
    warn "No --domain given; keeping existing Caddyfile"
  else
    warn "No --domain given; writing HTTP-only localhost Caddyfile"
    cat > "$CADDYFILE" <<CADDY
# Newsflash — HTTP only (no domain set)
# Rerun with --domain yourdomain.com to enable HTTPS
:80 {
    handle /api/* {
        reverse_proxy localhost:3000
    }
    handle /ws/* {
        reverse_proxy localhost:3000 {
            header_up Host {host}
        }
    }
    handle {
        root * ${WEBROOT}/dist
        try_files {path} /index.html
        file_server
    }
}
CADDY
  fi
else
  write_caddyfile "$DOMAIN"
  ok "Caddyfile written for $DOMAIN (auto-TLS via Let's Encrypt)"
fi

# Validate and reload Caddy
caddy validate --config "$CADDYFILE" || fail "Caddyfile validation failed"
systemctl reload caddy || systemctl restart caddy
ok "Caddy reloaded"

# ── Save PM2 process list ──────────────────────────────────────────────────────
pm2 save
ok "PM2 state saved"

# ── Summary ────────────────────────────────────────────────────────────────────
echo ""
echo -e "${BOLD}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${RESET}"
echo -e " Deploy complete — commit ${COMMIT}"
if [[ -n "$DOMAIN" ]]; then
  echo -e " ${CYAN}https://${DOMAIN}${RESET}"
else
  echo -e " ${CYAN}http://<your-vps-ip>${RESET}"
fi
echo ""
echo -e " Logs:"
echo -e "   pm2 logs newsflash-backend"
echo -e "   pm2 logs newsflash-ai"
echo -e "   tail -f /var/log/newsflash/caddy-access.log"
echo -e "${BOLD}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${RESET}"
