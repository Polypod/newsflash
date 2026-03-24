#!/usr/bin/env bash
# setup_vps.sh — Provision a fresh Ubuntu 22.04/24.04 VPS for Newsflash
#
# Run as root (or sudo) on the VPS:
#   curl -sSL https://raw.githubusercontent.com/YOUR/REPO/main/scripts/setup_vps.sh | sudo bash
#   — or —
#   sudo bash scripts/setup_vps.sh
#
# What this installs:
#   - Node.js 20 (via NodeSource)
#   - Python 3.12 + uv
#   - Docker + Docker Compose plugin
#   - PM2 (global, via npm)
#   - Caddy (web server / reverse proxy with auto-TLS)
#   - UFW firewall rules (22, 80, 443)

set -euo pipefail

# ── Config ─────────────────────────────────────────────────────────────────────
APP_DIR="${APP_DIR:-/opt/newsflash}"
APP_USER="${APP_USER:-deploy}"
LOG_DIR="/var/log/newsflash"
WEBROOT="/var/www/newsflash"

# ── Colours ────────────────────────────────────────────────────────────────────
BOLD='\033[1m'; GREEN='\033[0;32m'; CYAN='\033[0;36m'; RESET='\033[0m'
step() { echo -e "\n${BOLD}${CYAN}▶ $*${RESET}"; }
ok()   { echo -e "${GREEN}✓ $*${RESET}"; }

# ── Root check ─────────────────────────────────────────────────────────────────
[[ $EUID -ne 0 ]] && { echo "Run as root or with sudo"; exit 1; }

# ── System update ──────────────────────────────────────────────────────────────
step "Updating system packages"
apt-get update -q
apt-get upgrade -y -q
apt-get install -y -q \
  curl wget git build-essential \
  ca-certificates gnupg lsb-release \
  unzip software-properties-common \
  ufw fail2ban
ok "System packages installed"

# ── Node.js 20 ─────────────────────────────────────────────────────────────────
step "Installing Node.js 20"
if ! command -v node &>/dev/null || [[ $(node -v | cut -d. -f1 | tr -d 'v') -lt 20 ]]; then
  curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
  apt-get install -y nodejs
fi
ok "Node $(node -v) / npm $(npm -v)"

# ── Python 3.12 + uv ───────────────────────────────────────────────────────────
step "Installing Python 3.12 + uv"
if ! python3.12 --version &>/dev/null 2>&1; then
  add-apt-repository -y ppa:deadsnakes/ppa
  apt-get update -q
  apt-get install -y python3.12 python3.12-venv python3.12-dev python3-pip
fi
# uv — fast Python package manager
if ! command -v uv &>/dev/null; then
  curl -LsSf https://astral.sh/uv/install.sh | sh
  # Make uv available system-wide
  ln -sf "$HOME/.cargo/bin/uv" /usr/local/bin/uv 2>/dev/null || true
  ln -sf "$HOME/.local/bin/uv" /usr/local/bin/uv 2>/dev/null || true
fi
ok "Python $(python3.12 --version)"

# ── Docker ─────────────────────────────────────────────────────────────────────
step "Installing Docker"
if ! command -v docker &>/dev/null; then
  install -m 0755 -d /etc/apt/keyrings
  curl -fsSL https://download.docker.com/linux/ubuntu/gpg \
    | gpg --dearmor -o /etc/apt/keyrings/docker.gpg
  chmod a+r /etc/apt/keyrings/docker.gpg
  echo \
    "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] \
    https://download.docker.com/linux/ubuntu $(lsb_release -cs) stable" \
    > /etc/apt/sources.list.d/docker.list
  apt-get update -q
  apt-get install -y docker-ce docker-ce-cli containerd.io docker-compose-plugin
  systemctl enable --now docker
fi
ok "Docker $(docker --version | cut -d' ' -f3 | tr -d ',')"

# ── PM2 ────────────────────────────────────────────────────────────────────────
step "Installing PM2"
npm install -g pm2 --silent
pm2 startup systemd -u root --hp /root | tail -1 | bash || true
ok "PM2 $(pm2 -v)"

# ── Caddy ──────────────────────────────────────────────────────────────────────
step "Installing Caddy"
if ! command -v caddy &>/dev/null; then
  curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/gpg.key' \
    | gpg --dearmor -o /usr/share/keyrings/caddy-stable-archive-keyring.gpg
  curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/debian.deb.txt' \
    | tee /etc/apt/sources.list.d/caddy-stable.list
  apt-get update -q
  apt-get install -y caddy
  systemctl enable caddy
fi
ok "Caddy $(caddy version)"

# ── Deploy user ────────────────────────────────────────────────────────────────
step "Creating deploy user: $APP_USER"
if ! id "$APP_USER" &>/dev/null; then
  useradd -m -s /bin/bash "$APP_USER"
  # Add to docker group so deploy user can run docker compose
  usermod -aG docker "$APP_USER"
fi
ok "User $APP_USER ready"

# ── Directory layout ───────────────────────────────────────────────────────────
step "Creating directories"
mkdir -p "$APP_DIR" "$LOG_DIR" "$WEBROOT"
chown -R "$APP_USER:$APP_USER" "$APP_DIR" "$WEBROOT"
chown -R "$APP_USER:$APP_USER" "$LOG_DIR"
ok "Directories: $APP_DIR  $LOG_DIR  $WEBROOT"

# ── Firewall ───────────────────────────────────────────────────────────────────
step "Configuring UFW firewall"
ufw --force reset
ufw default deny incoming
ufw default allow outgoing
ufw allow 22/tcp   comment 'SSH'
ufw allow 80/tcp   comment 'HTTP (Caddy → HTTPS redirect)'
ufw allow 443/tcp  comment 'HTTPS (Caddy)'
# Internal ports (3000, 8000, 5432, 6379) stay closed externally
ufw --force enable
ok "UFW enabled: 22, 80, 443 open"

# ── fail2ban ───────────────────────────────────────────────────────────────────
step "Enabling fail2ban"
systemctl enable --now fail2ban
ok "fail2ban running"

# ── Done ───────────────────────────────────────────────────────────────────────
echo ""
echo -e "${BOLD}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${RESET}"
echo -e " VPS setup complete. Next steps:"
echo -e ""
echo -e "  1. Clone your repo to ${APP_DIR}:"
echo -e "       git clone <repo-url> ${APP_DIR}"
echo -e "       chown -R ${APP_USER}:${APP_USER} ${APP_DIR}"
echo ""
echo -e "  2. Create .env files in backend/, ai-service/, frontend/"
echo -e "     (copy from .env.example and fill in API keys)"
echo ""
echo -e "  3. Run the deploy script:"
echo -e "       sudo bash ${APP_DIR}/scripts/deploy_vps.sh"
echo -e "${BOLD}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${RESET}"
