#!/bin/bash

# Quick install script that always allows root execution
# This script bypasses any root checks and directly installs/updates from GitHub

set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

print_info() { echo -e "${BLUE}[INFO]${NC} $1"; }
print_success() { echo -e "${GREEN}[SUCCESS]${NC} $1"; }
print_warning() { echo -e "${YELLOW}[WARNING]${NC} $1"; }
print_error() { echo -e "${RED}[ERROR]${NC} $1"; }

# Configuration
GITHUB_REPO="https://github.com/punk03/FTR_REG.git"
PROJECT_DIR="${HOME}/FTR_REG"
BRANCH="main"

# Determine app user
if [ "$EUID" -eq 0 ]; then
    if id "ftr" &>/dev/null; then
        APP_USER="ftr"
    elif id "fil" &>/dev/null; then
        APP_USER="fil"
    else
        print_info "Creating user 'ftr' for application..."
        useradd -r -s /bin/bash -m ftr 2>/dev/null || APP_USER="root"
        APP_USER="ftr"
    fi
    print_info "Running as root, will use user '$APP_USER' for application files"
else
    APP_USER=$(whoami)
fi

export APP_USER

# Check git
if ! command -v git &> /dev/null; then
    print_info "Installing git..."
    sudo apt-get update && sudo apt-get install -y git
fi

# Setup repository
if [ -d "$PROJECT_DIR/.git" ]; then
    print_info "Updating repository..."
    cd "$PROJECT_DIR"
    git fetch origin
    git checkout "$BRANCH" 2>/dev/null || true
    git pull origin "$BRANCH"
else
    print_info "Cloning repository..."
    mkdir -p "$(dirname "$PROJECT_DIR")"
    git clone "$GITHUB_REPO" "$PROJECT_DIR"
    cd "$PROJECT_DIR"
    git checkout "$BRANCH" 2>/dev/null || true
fi

# Fix permissions
print_info "Setting permissions..."
if [ "$EUID" -eq 0 ] && [ "$APP_USER" != "root" ]; then
    chown -R "$APP_USER:$APP_USER" "$PROJECT_DIR"
fi
chmod +x "$PROJECT_DIR/deploy.sh" "$PROJECT_DIR/install.sh" 2>/dev/null || true

# Run deployment
print_info "Running deployment..."
cd "$PROJECT_DIR"

if [ "$EUID" -eq 0 ] && [ -n "$APP_USER" ] && [ "$APP_USER" != "root" ]; then
    sudo -u "$APP_USER" ./deploy.sh
else
    ./deploy.sh
fi

print_success "Installation completed!"

