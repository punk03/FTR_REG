#!/bin/bash

# Скрипт для перезапуска backend с обновленным кодом

set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

print_info() { echo -e "${BLUE}[INFO]${NC} $1"; }
print_success() { echo -e "${GREEN}[✓]${NC} $1"; }
print_warning() { echo -e "${YELLOW}[!]${NC} $1"; }
print_error() { echo -e "${RED}[✗]${NC} $1"; }

# Определить директорию проекта
if [ -d ".git" ] && [ -d "frontend" ] && [ -d "backend" ]; then
    PROJECT_DIR=$(pwd)
elif [ -d "${HOME}/FTR_REG" ]; then
    PROJECT_DIR="${HOME}/FTR_REG"
elif [ -d "/home/fil/FTR_REG" ]; then
    PROJECT_DIR="/home/fil/FTR_REG"
elif [ -d "/root/FTR_REG" ]; then
    PROJECT_DIR="/root/FTR_REG"
else
    print_error "FTR_REG project directory not found!"
    exit 1
fi

cd "$PROJECT_DIR"

echo "=========================================="
print_info "Restarting Backend"
echo "=========================================="
echo ""

# 1. Обновить код
print_info "1. Updating code from GitHub..."
git pull origin main || print_warning "Git pull failed, continuing with current code"
echo ""

# 2. Остановить старый процесс
print_info "2. Stopping old backend process..."
if pgrep -f "node.*dist/index.js" > /dev/null; then
    PID=$(pgrep -f "node.*dist/index.js" | head -1)
    print_info "Found backend process (PID: $PID), stopping..."
    kill $PID 2>/dev/null || true
    sleep 2
    
    # Если не остановился, убить принудительно
    if pgrep -f "node.*dist/index.js" > /dev/null; then
        print_warning "Process still running, force killing..."
        pkill -9 -f "node.*dist/index.js" || true
        sleep 1
    fi
    print_success "Backend stopped"
else
    print_info "No backend process found"
fi
echo ""

# 3. Пересобрать backend
print_info "3. Rebuilding backend..."
cd backend

if [ ! -d "node_modules" ]; then
    print_info "Installing dependencies..."
    npm install
fi

print_info "Building backend..."
npm run build || {
    print_error "Build failed!"
    exit 1
}

cd ..
print_success "Backend built successfully"
echo ""

# 4. Проверить .env
print_info "4. Checking backend/.env..."
if [ -f "backend/.env" ]; then
    if grep -q "CORS_ORIGIN" backend/.env; then
        print_info "CORS_ORIGIN found in .env"
        grep "CORS_ORIGIN" backend/.env | sed 's/^/   /'
    else
        print_warning "CORS_ORIGIN not found in .env, will use defaults"
    fi
else
    print_warning "backend/.env not found"
fi
echo ""

# 5. Запустить backend
print_info "5. Starting backend..."
cd backend

# Запустить в фоне
nohup npm start > ../backend.log 2>&1 &
BACKEND_PID=$!
echo $BACKEND_PID > ../backend.pid

cd ..
print_success "Backend started (PID: $BACKEND_PID)"
print_info "Waiting 5 seconds for startup..."
sleep 5

# 6. Проверить статус
print_info "6. Checking backend status..."
if ps -p $BACKEND_PID > /dev/null 2>&1; then
    print_success "Backend process is running"
    
    # Проверить порт
    if lsof -i :3001 > /dev/null 2>&1 || ss -tlnp 2>/dev/null | grep -q ":3001"; then
        print_success "Backend is listening on port 3001"
    else
        print_warning "Backend port 3001 is not listening yet"
    fi
    
    # Проверить API
    sleep 2
    if curl -s "http://localhost:3001/api/health" > /dev/null 2>&1; then
        print_success "Backend API is responding"
    else
        print_warning "Backend API is not responding yet"
        print_info "Check logs: tail -f backend.log"
    fi
else
    print_error "Backend process died!"
    print_info "Check logs: tail -50 backend.log"
    exit 1
fi
echo ""

# 7. Показать логи
if [ -f "backend.log" ]; then
    print_info "7. Last 15 lines of backend.log:"
    tail -15 backend.log | sed 's/^/   /'
fi

echo ""
echo "=========================================="
print_success "Backend Restart Complete!"
echo "=========================================="
echo ""
print_info "Backend URL: http://95.71.125.8:3001"
print_info "PID: $BACKEND_PID"
print_info "Logs: tail -f backend.log"
print_info ""
print_info "Test CORS:"
echo "   curl -X OPTIONS http://localhost:3001/api/auth/login \\"
echo "     -H 'Origin: http://95.71.125.8:3000' \\"
echo "     -H 'Access-Control-Request-Method: POST' \\"
echo "     -v"

