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

PROJECT_DIR="${HOME}/FTR_REG}"
FRONTEND_PORT=3000

# Переход в директорию проекта
if [ -d "$PROJECT_DIR" ]; then
    cd "$PROJECT_DIR"
else
    print_error "Project directory not found: $PROJECT_DIR"
    exit 1
fi

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

# Попробуем разные варианты запуска
if npx -y serve@latest --version > /dev/null 2>&1; then
    # Вариант 1: с явным указанием хоста и порта
    nohup npx -y serve@latest -s dist --listen tcp://0.0.0.0:${FRONTEND_PORT} > ../frontend.log 2>&1 &
    SERVE_PID=$!
    
    sleep 3
    
    # Проверить, запустился ли процесс
    if ps -p $SERVE_PID > /dev/null 2>&1; then
        echo $SERVE_PID > ../frontend.pid
        print_success "Frontend started (PID: $SERVE_PID)"
    else
        print_error "Process died immediately. Trying alternative method..."
        
        # Вариант 2: через переменную окружения
        PORT=${FRONTEND_PORT} HOST=0.0.0.0 nohup npx -y serve@latest -s dist > ../frontend.log 2>&1 &
        SERVE_PID=$!
        sleep 3
        
        if ps -p $SERVE_PID > /dev/null 2>&1; then
            echo $SERVE_PID > ../frontend.pid
            print_success "Frontend started with alternative method (PID: $SERVE_PID)"
        else
            print_error "All methods failed. Check frontend.log:"
            tail -20 ../frontend.log
            exit 1
        fi
    fi
else
    print_error "serve command not found"
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

