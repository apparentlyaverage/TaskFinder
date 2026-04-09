#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────
# TaskFinder — One-Command Installer
# Usage: bash install.sh
# ─────────────────────────────────────────────────────────────
set -e

BOLD="\033[1m"
GREEN="\033[0;32m"
YELLOW="\033[0;33m"
RED="\033[0;31m"
CYAN="\033[0;36m"
RESET="\033[0m"

info()    { echo -e "${CYAN}▸${RESET} $1"; }
success() { echo -e "${GREEN}✓${RESET} $1"; }
warn()    { echo -e "${YELLOW}⚠${RESET} $1"; }
error()   { echo -e "${RED}✗${RESET} $1"; exit 1; }

echo ""
echo -e "${BOLD}TaskFinder — Frontend Installer${RESET}"
echo "─────────────────────────────────"
echo ""

# ── 1. Check Node.js ─────────────────────────────────────────
info "Checking Node.js..."
if ! command -v node &>/dev/null; then
  error "Node.js is not installed. Please install Node.js 18+ from https://nodejs.org and re-run this script."
fi

NODE_VER=$(node -v | sed 's/v//' | cut -d. -f1)
if [ "$NODE_VER" -lt 18 ]; then
  error "Node.js 18+ is required. You have $(node -v). Please upgrade from https://nodejs.org"
fi
success "Node.js $(node -v) detected"

# ── 2. Check npm ─────────────────────────────────────────────
info "Checking npm..."
if ! command -v npm &>/dev/null; then
  error "npm not found. Please reinstall Node.js from https://nodejs.org"
fi
success "npm $(npm -v) detected"

# ── 3. Install dependencies ──────────────────────────────────
info "Installing dependencies (this may take a minute)..."
npm install --silent
success "Dependencies installed"

# ── 4. Create .env if missing ────────────────────────────────
if [ ! -f .env ]; then
  info "Creating .env file..."
  cat > .env << 'EOF'
# TaskFinder — Environment Variables
# ─────────────────────────────────────────────────────────────
# In DEMO MODE (default), these are not required.
# Fill these in only when connecting to your live backend.

# API Gateway URL (when backend is running)
VITE_API_URL=http://localhost:8080

# WebSocket URL (Messaging service)
VITE_SOCKET_URL=http://localhost:3004
EOF
  success ".env created"
fi

# ── Done ─────────────────────────────────────────────────────
echo ""
echo -e "${GREEN}${BOLD}Installation complete!${RESET}"
echo ""
echo -e "  ${BOLD}To start the app:${RESET}"
echo -e "  ${CYAN}npm run dev${RESET}"
echo ""
echo -e "  ${BOLD}Then open:${RESET} http://localhost:3000"
echo ""
echo -e "  ${BOLD}Demo login presets:${RESET}"
echo -e "  ${YELLOW}Creator${RESET}  →  creator@demo.com  (post & manage tasks)"
echo -e "  ${YELLOW}Earner${RESET}   →  earner@demo.com   (browse & bid on tasks)"
echo -e "  ${YELLOW}Admin${RESET}    →  admin@demo.com    (dispute resolution)"
echo ""
