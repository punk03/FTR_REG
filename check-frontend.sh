#!/bin/bash

# Скрипт для проверки и перезапуска frontend сервера

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

# Определить директорию проекта автоматически
# Проверяем текущую директорию, затем HOME, затем ищем FTR_REG
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
    print_info "Please run this script from the project directory or set PROJECT_DIR environment variable"
    exit 1
fi

FRONTEND_PORT=3000
FRONTEND_IP="95.71.125.8"

# Переход в директорию проекта
cd "$PROJECT_DIR"
print_info "Using project directory: $PROJECT_DIR"

print_info "Checking frontend status..."

# Проверка, запущен ли frontend
if pgrep -f "serve.*dist" > /dev/null; then
    FRONTEND_PID=$(pgrep -f "serve.*dist" | head -1)
    print_info "Frontend is running (PID: $FRONTEND_PID)"
else
    print_warning "Frontend is not running"
fi

# Проверка доступности
print_info "Testing frontend accessibility..."
if curl -s -o /dev/null -w "%{http_code}" "http://${FRONTEND_IP}:${FRONTEND_PORT}" | grep -q "200\|301\|302"; then
    print_success "Frontend is accessible at http://${FRONTEND_IP}:${FRONTEND_PORT}"
else
    print_error "Frontend is not accessible at http://${FRONTEND_IP}:${FRONTEND_PORT}"
    
    # Проверка локальной доступности
    if curl -s -o /dev/null -w "%{http_code}" "http://localhost:${FRONTEND_PORT}" | grep -q "200\|301\|302"; then
        print_warning "Frontend is accessible locally but not from external IP"
        print_info "Possible issues:"
        print_info "  1. Firewall blocking port ${FRONTEND_PORT}"
        print_info "  2. Server not bound to 0.0.0.0"
        print_info "  3. Network configuration issue"
    else
        print_error "Frontend is not accessible even locally"
    fi
fi

# Проверка SPA routing
print_info "Testing SPA routing..."
ROOT_RESPONSE=$(curl -s "http://localhost:${FRONTEND_PORT}/" | head -20)
if echo "$ROOT_RESPONSE" | grep -q "root\|id=\"root\"\|<html"; then
    print_success "Root route (/) returns HTML"
else
    print_error "Root route (/) does not return HTML"
    echo "Response: $ROOT_RESPONSE"
fi

# Проверка несуществующего маршрута (должен вернуть index.html для SPA)
print_info "Testing SPA fallback routing..."
SPA_RESPONSE=$(curl -s "http://localhost:${FRONTEND_PORT}/nonexistent-route" | head -20)
if echo "$SPA_RESPONSE" | grep -q "root\|id=\"root\"\|<html"; then
    print_success "SPA routing works (nonexistent route returns index.html)"
else
    print_error "SPA routing broken (nonexistent route does not return index.html)"
    echo "Response: $SPA_RESPONSE"
fi

# Показать логи
if [ -f "frontend.log" ]; then
    print_info "Last 20 lines of frontend.log:"
    tail -20 frontend.log
fi

# Предложение перезапуска
echo ""
read -p "Do you want to restart frontend? (y/N): " -n 1 -r
echo
if [[ $REPLY =~ ^[Yy]$ ]]; then
    print_info "Stopping frontend..."
    pkill -f "serve.*dist" || true
    sleep 2
    
    print_info "Starting frontend..."
    cd frontend
    
    if [ -f "serve.json" ]; then
        nohup npx -y serve@latest -s dist -l ${FRONTEND_PORT} -c serve.json > ../frontend.log 2>&1 &
    else
        nohup npx -y serve@latest -s dist -l ${FRONTEND_PORT} > ../frontend.log 2>&1 &
    fi
    
    FRONTEND_PID=$!
    echo $FRONTEND_PID > ../frontend.pid
    cd ..
    
    print_success "Frontend restarted (PID: $FRONTEND_PID)"
    print_info "Waiting 5 seconds for startup..."
    sleep 5
    
    # Проверка после перезапуска
    if curl -s -o /dev/null -w "%{http_code}" "http://localhost:${FRONTEND_PORT}" | grep -q "200\|301\|302"; then
        print_success "Frontend is now accessible"
    else
        print_error "Frontend still not accessible. Check frontend.log for details"
    fi
fi
