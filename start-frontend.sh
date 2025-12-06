#!/bin/bash

# Простой скрипт для запуска frontend сервера

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

# Переход в директорию проекта
cd "$PROJECT_DIR"
print_info "Using project directory: $PROJECT_DIR"

print_info "Starting frontend server..."

# 1. Остановить все старые процессы
print_info "Stopping old processes..."
pkill -f "serve.*dist" 2>/dev/null || true
pkill -f "node.*serve" 2>/dev/null || true
sleep 2

# 2. Проверить наличие dist
if [ ! -d "frontend/dist" ]; then
    print_error "frontend/dist directory not found!"
    print_info "Building frontend..."
    cd frontend
    
    # Создать .env если не существует
    if [ ! -f ".env" ]; then
        echo "VITE_API_URL=http://95.71.125.8:3001" > .env
        print_info "Created frontend/.env"
    fi
    
    npm run build || {
        print_error "Build failed!"
        exit 1
    }
    cd ..
fi

# 3. Перейти в frontend директорию
cd frontend

# 4. Убедиться, что serve.json существует
if [ ! -f "serve.json" ]; then
    print_info "Creating serve.json..."
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

# 5. Проверить, свободен ли порт
if lsof -i :${FRONTEND_PORT} > /dev/null 2>&1; then
    print_warning "Port ${FRONTEND_PORT} is in use, killing process..."
    lsof -ti :${FRONTEND_PORT} | xargs kill -9 2>/dev/null || true
    sleep 2
fi

# 6. Запустить serve
print_info "Starting serve on 0.0.0.0:${FRONTEND_PORT}..."

# serve.json должен быть в frontend/, не в dist/
# serve автоматически найдет его в текущей директории
# НЕ используем -c флаг, так как он ищет файл в dist/

# Запускаем serve без указания конфига (он использует дефолтные настройки для SPA)
# Флаг -s включает SPA режим автоматически
nohup npx -y serve@latest -s dist --listen tcp://0.0.0.0:${FRONTEND_PORT} > ../frontend.log 2>&1 &
SERVE_PID=$!

sleep 3

# Проверить, запустился ли процесс
if ps -p $SERVE_PID > /dev/null 2>&1; then
    echo $SERVE_PID > ../frontend.pid
    print_success "Frontend started (PID: $SERVE_PID)"
else
    print_error "Process died immediately. Check frontend.log:"
    tail -20 ../frontend.log
    exit 1
fi

cd ..

# 7. Подождать и проверить
print_info "Waiting 5 seconds for server to start..."
sleep 5

# Проверить, слушает ли порт
if lsof -i :${FRONTEND_PORT} > /dev/null 2>&1 || ss -tlnp 2>/dev/null | grep -q ":${FRONTEND_PORT}"; then
    print_success "Port ${FRONTEND_PORT} is listening"
    
    # Показать на каких интерфейсах слушает
    print_info "Network interfaces:"
    netstat -tlnp 2>/dev/null | grep ${FRONTEND_PORT} || ss -tlnp 2>/dev/null | grep ${FRONTEND_PORT} || true
    
    # Проверить доступность
    if curl -s -o /dev/null -w "%{http_code}" "http://localhost:${FRONTEND_PORT}" | grep -q "200\|301\|302"; then
        print_success "Frontend is accessible locally at http://localhost:${FRONTEND_PORT}"
    else
        print_warning "Frontend port is listening but not responding. Check logs: tail -f frontend.log"
    fi
else
    print_error "Port ${FRONTEND_PORT} is NOT listening"
    print_info "Check logs: tail -f frontend.log"
    exit 1
fi

# Показать логи
print_info "Last 10 lines of frontend.log:"
tail -10 frontend.log

echo ""
print_success "Frontend server should be running!"
print_info "URL: http://95.71.125.8:${FRONTEND_PORT}"
print_info "Local URL: http://localhost:${FRONTEND_PORT}"
print_info "PID: $(cat frontend.pid 2>/dev/null || echo 'unknown')"
print_info "Logs: tail -f frontend.log"

