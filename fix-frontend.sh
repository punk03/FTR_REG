#!/bin/bash

# Скрипт для диагностики и исправления проблем с frontend

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

echo "=========================================="
print_info "Frontend Diagnostic and Fix Script"
echo "=========================================="
echo ""

# 1. Проверка существования dist директории
print_info "1. Checking frontend build..."
if [ ! -d "frontend/dist" ]; then
    print_error "frontend/dist directory not found!"
    print_info "Building frontend..."
    cd frontend
    if [ ! -f ".env" ]; then
        print_warning "Creating frontend/.env file..."
        echo "VITE_API_URL=http://${FRONTEND_IP}:3001" > .env
    fi
    npm run build || {
        print_error "Build failed!"
        exit 1
    }
    cd ..
    print_success "Frontend built successfully"
else
    print_success "frontend/dist exists"
fi

# 2. Проверка запущенных процессов
print_info "2. Checking running processes..."
if pgrep -f "serve.*dist" > /dev/null; then
    FRONTEND_PID=$(pgrep -f "serve.*dist" | head -1)
    print_warning "Frontend process found (PID: $FRONTEND_PID)"
    print_info "Stopping existing process..."
    pkill -f "serve.*dist" || true
    sleep 2
else
    print_info "No frontend process running"
fi

# 3. Проверка порта
print_info "3. Checking port ${FRONTEND_PORT}..."
if lsof -i :${FRONTEND_PORT} > /dev/null 2>&1; then
    print_warning "Port ${FRONTEND_PORT} is in use:"
    lsof -i :${FRONTEND_PORT}
    read -p "Kill process on port ${FRONTEND_PORT}? (y/N): " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        lsof -ti :${FRONTEND_PORT} | xargs kill -9 2>/dev/null || true
        sleep 2
        print_success "Port ${FRONTEND_PORT} freed"
    fi
else
    print_success "Port ${FRONTEND_PORT} is available"
fi

# 4. Проверка файрвола
print_info "4. Checking firewall..."
if command -v ufw &> /dev/null; then
    if ufw status | grep -q "Status: active"; then
        print_warning "UFW firewall is active"
        if ufw status | grep -q "${FRONTEND_PORT}"; then
            print_success "Port ${FRONTEND_PORT} is allowed in UFW"
        else
            print_error "Port ${FRONTEND_PORT} is NOT allowed in UFW"
            read -p "Allow port ${FRONTEND_PORT} in UFW? (y/N): " -n 1 -r
            echo
            if [[ $REPLY =~ ^[Yy]$ ]]; then
                sudo ufw allow ${FRONTEND_PORT}/tcp
                print_success "Port ${FRONTEND_PORT} allowed in UFW"
            fi
        fi
    else
        print_info "UFW firewall is not active"
    fi
elif command -v firewall-cmd &> /dev/null; then
    print_info "firewalld detected"
    if sudo firewall-cmd --list-ports | grep -q "${FRONTEND_PORT}"; then
        print_success "Port ${FRONTEND_PORT} is allowed in firewalld"
    else
        print_error "Port ${FRONTEND_PORT} is NOT allowed in firewalld"
        read -p "Allow port ${FRONTEND_PORT} in firewalld? (y/N): " -n 1 -r
        echo
        if [[ $REPLY =~ ^[Yy]$ ]]; then
            sudo firewall-cmd --permanent --add-port=${FRONTEND_PORT}/tcp
            sudo firewall-cmd --reload
            print_success "Port ${FRONTEND_PORT} allowed in firewalld"
        fi
    fi
else
    print_warning "No firewall management tool detected (ufw/firewalld)"
    print_info "Please check your firewall settings manually"
fi

# 5. Запуск frontend на всех интерфейсах
print_info "5. Starting frontend server..."
cd frontend

# Убедимся, что serve.json существует
if [ ! -f "serve.json" ]; then
    print_warning "serve.json not found, creating..."
    cat > serve.json << 'EOF'
{
  "public": "dist",
  "rewrites": [
    {
      "source": "**",
      "destination": "/index.html"
    }
  ]
}
EOF
fi

# Запуск serve на всех интерфейсах (0.0.0.0)
print_info "Starting serve on 0.0.0.0:${FRONTEND_PORT}..."
nohup npx -y serve@latest -s dist -l tcp://0.0.0.0:${FRONTEND_PORT} -c serve.json > ../frontend.log 2>&1 &
FRONTEND_PID=$!
echo $FRONTEND_PID > ../frontend.pid
cd ..

print_success "Frontend started (PID: $FRONTEND_PID)"
print_info "Waiting 5 seconds for startup..."
sleep 5

# 6. Проверка доступности
print_info "6. Testing accessibility..."

# Локальная проверка
if curl -s -o /dev/null -w "%{http_code}" "http://localhost:${FRONTEND_PORT}" | grep -q "200\|301\|302"; then
    print_success "Frontend is accessible locally"
else
    print_error "Frontend is NOT accessible locally"
    print_info "Check logs: tail -f frontend.log"
    exit 1
fi

# Проверка через внешний IP
print_info "Testing external IP access..."
if curl -s -o /dev/null -w "%{http_code}" "http://${FRONTEND_IP}:${FRONTEND_PORT}" | grep -q "200\|301\|302"; then
    print_success "Frontend is accessible via external IP: http://${FRONTEND_IP}:${FRONTEND_PORT}"
else
    print_warning "Frontend is NOT accessible via external IP"
    print_info "Possible issues:"
    print_info "  1. Firewall blocking port ${FRONTEND_PORT}"
    print_info "  2. Server provider firewall/security group"
    print_info "  3. Network routing issue"
    print_info ""
    print_info "Check if process is listening on all interfaces:"
    print_info "  netstat -tlnp | grep ${FRONTEND_PORT}"
    print_info "  or"
    print_info "  ss -tlnp | grep ${FRONTEND_PORT}"
fi

# 7. Проверка SPA routing
print_info "7. Testing SPA routing..."
ROOT_RESPONSE=$(curl -s "http://localhost:${FRONTEND_PORT}/" | head -5)
if echo "$ROOT_RESPONSE" | grep -q "root\|id=\"root\"\|<html"; then
    print_success "Root route (/) works correctly"
else
    print_error "Root route (/) does not return HTML"
fi

SPA_RESPONSE=$(curl -s "http://localhost:${FRONTEND_PORT}/login" | head -5)
if echo "$SPA_RESPONSE" | grep -q "root\|id=\"root\"\|<html"; then
    print_success "SPA routing works (login route returns index.html)"
else
    print_error "SPA routing broken"
fi

# 8. Показать информацию о процессе
print_info "8. Process information:"
if [ -f "frontend.pid" ]; then
    PID=$(cat frontend.pid)
    if ps -p $PID > /dev/null 2>&1; then
        print_success "Frontend process is running (PID: $PID)"
        print_info "Process details:"
        ps -p $PID -o pid,ppid,cmd
        print_info ""
        print_info "Network connections:"
        netstat -tlnp 2>/dev/null | grep ${FRONTEND_PORT} || ss -tlnp 2>/dev/null | grep ${FRONTEND_PORT} || print_warning "Could not check network connections"
    else
        print_error "Frontend process is not running (PID file exists but process is dead)"
    fi
fi

# 9. Показать последние логи
if [ -f "frontend.log" ]; then
    print_info "9. Last 15 lines of frontend.log:"
    tail -15 frontend.log
fi

echo ""
echo "=========================================="
print_info "Diagnostic complete!"
echo "=========================================="
echo ""
print_info "Frontend URL: http://${FRONTEND_IP}:${FRONTEND_PORT}"
print_info "Local URL: http://localhost:${FRONTEND_PORT}"
print_info "Logs: tail -f frontend.log"
print_info "PID file: frontend.pid"
echo ""

