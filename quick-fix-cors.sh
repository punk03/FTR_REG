#!/bin/bash

# Быстрое исправление CORS - обновление и перезапуск backend

set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

print_info() { echo -e "${BLUE}[INFO]${NC} $1"; }
print_success() { echo -e "${GREEN}[✓]${NC} $1"; }
print_error() { echo -e "${RED}[✗]${NC} $1"; }

# Определить директорию проекта
if [ -d ".git" ] && [ -d "frontend" ] && [ -d "backend" ]; then
    PROJECT_DIR=$(pwd)
elif [ -d "/home/fil/FTR_REG" ]; then
    PROJECT_DIR="/home/fil/FTR_REG"
elif [ -d "${HOME}/FTR_REG" ]; then
    PROJECT_DIR="${HOME}/FTR_REG"
elif [ -d "/root/FTR_REG" ]; then
    PROJECT_DIR="/root/FTR_REG"
else
    print_error "FTR_REG project directory not found!"
    exit 1
fi

cd "$PROJECT_DIR"

print_info "Quick CORS Fix - Updating and restarting backend..."

# Исправить проблему с Git ownership если нужно
git config --global --add safe.directory "$PROJECT_DIR" 2>/dev/null || true

# Обновить код
git pull origin main || {
    print_error "Git pull failed, but continuing with current code..."
}

# Остановить backend
pkill -f "node.*dist/index.js" 2>/dev/null || true
sleep 2

# Пересобрать и запустить
cd backend
npm run build
nohup npm start > ../backend.log 2>&1 &
BACKEND_PID=$!
echo $BACKEND_PID > ../backend.pid
cd ..

print_success "Backend restarted (PID: $BACKEND_PID)"
print_info "Waiting 5 seconds..."
sleep 5

# Проверить
if curl -s -X OPTIONS "http://localhost:3001/api/auth/login" \
  -H "Origin: http://95.71.125.8:3000" \
  -H "Access-Control-Request-Method: POST" | grep -q "CORS\|200"; then
    print_success "CORS test passed!"
else
    print_error "CORS test failed. Check backend.log"
    tail -20 backend.log
fi

print_info "Done! Try logging in now."

