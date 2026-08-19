#!/usr/bin/env bash
# ==========================================================================
# EONZARCHIVE - One-shot per-machine setup
# Installs Docker + Caddy, routes the custom domain, and prepares the
# reverse proxy. Run this as root on a fresh Linux machine (Debian/Ubuntu,
# Arch, or Fedora). See the README for Windows instructions.
# ==========================================================================
set -euo pipefail

DOMAIN="eonzarchive.local"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
CADDYFILE_SRC="$SCRIPT_DIR/Caddyfile"
CADDYFILE_DST="/etc/caddy/Caddyfile"

log()  { printf '[setup] %s\n' "$*"; }
fail() { printf '[setup] ERROR: %s\n' "$*" >&2; exit 1; }

# --------------------------------------------------------------------------
# Require root
# --------------------------------------------------------------------------
[[ $EUID -eq 0 ]] || fail "run this script as root: sudo $0"

# --------------------------------------------------------------------------
# Install packages per distro family
# --------------------------------------------------------------------------
install_packages() {
  if command -v apt-get >/dev/null 2>&1; then
    log "Detected Debian/Ubuntu"
    export DEBIAN_FRONTEND=noninteractive
    apt-get update -y
    apt-get install -y docker.io docker-compose-v2 caddy
  elif command -v pacman >/dev/null 2>&1; then
    log "Detected Arch"
    pacman -Sy --noconfirm docker docker-compose caddy
  elif command -v dnf >/dev/null 2>&1; then
    log "Detected Fedora"
    dnf install -y docker docker-compose-plugin caddy
  else
    fail "unsupported package manager; install docker, docker-compose, and caddy manually"
  fi
}

# --------------------------------------------------------------------------
# Ensure the docker service runs
# --------------------------------------------------------------------------
start_docker() {
  if systemctl list-unit-files | grep -q '^docker.service'; then
    systemctl enable --now docker
  else
    log "docker.service not found; start docker with your distro's tooling"
  fi
}

# --------------------------------------------------------------------------
# Prepare .env (copy template if missing; never inject secrets)
# --------------------------------------------------------------------------
prepare_env() {
  if [[ ! -f "$SCRIPT_DIR/.env" ]]; then
    cp "$SCRIPT_DIR/.env.example" "$SCRIPT_DIR/.env"
    log "Created .env from .env.example"
    fail "edit .env and set ARCHIVE_FOLDER_URL, GOOGLE_SERVICE_ACCOUNT_JSON, and API_TOKEN, then re-run this script"
  else
    log ".env already present; leaving it unchanged"
  fi
}

# --------------------------------------------------------------------------
# Route the custom domain in the hosts file (idempotent)
# --------------------------------------------------------------------------
add_hosts_entry() {
  if grep -q "$DOMAIN" /etc/hosts; then
    log "hosts entry for $DOMAIN already present"
  else
    printf '127.0.0.1 %s\n' "$DOMAIN" >> /etc/hosts
    log "Added $DOMAIN to /etc/hosts"
  fi
}

# --------------------------------------------------------------------------
# Install the Caddyfile and configure Caddy
# --------------------------------------------------------------------------
setup_caddy() {
  [[ -f "$CADDYFILE_SRC" ]] || fail "Caddyfile not found at $CADDYFILE_SRC"
  mkdir -p /etc/caddy /var/log/caddy
  cp "$CADDYFILE_SRC" "$CADDYFILE_DST"
  chown -R caddy:caddy /var/log/caddy 2>/dev/null || true
  caddy validate --config "$CADDYFILE_DST" --adapter caddyfile >/dev/null \
    || fail "Caddyfile failed validation"
  systemctl enable --now caddy
  log "Caddy enabled and started"
}

# ==========================================================================
# Run
# ==========================================================================
install_packages
start_docker
prepare_env
add_hosts_entry
setup_caddy

echo
echo "================================================================"
echo " EONZARCHIVE setup complete on this machine."
echo "================================================================"
echo
echo "  Next steps:"
echo "   1. Make sure .env has your values:"
echo "        nano $SCRIPT_DIR/.env"
echo "        - ARCHIVE_FOLDER_URL"
echo "        - GOOGLE_SERVICE_ACCOUNT_JSON"
echo "        - API_TOKEN"
echo "      (ALLOWED_HOSTS stays the same on every machine: $DOMAIN)"
echo "   2. Build and start the app container:"
echo "        cd $SCRIPT_DIR && docker compose up -d --build"
echo "   3. Open the archive in your browser:"
echo "        http://$DOMAIN/"
echo "   4. Watch request logs:"
echo "        sudo tail -f /var/log/caddy/$DOMAIN.access.log"
echo
echo "  To stop the app later:"
echo "        cd $SCRIPT_DIR && docker compose down"
echo "================================================================"