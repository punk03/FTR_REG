#!/bin/bash

# Скрипт для исправления frontend .env и пересборки

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
BACKEND_IP="95.71.125.8"
BACKEND_PORT=3001

echo "=========================================="
print_info "Fixing Frontend Environment"
echo "=========================================="
echo ""

# 1. Проверить текущий .env
print_info "1. Checking current frontend/.env..."
if [ -f "frontend/.env" ]; then
    print_info "Current content:"
    cat frontend/.env | sed 's/^/   /'
    
    if grep -q "185.185.68.105" frontend/.env; then
        print_error "Old IP address (185.185.68.105) found in .env"
    fi
else
    print_warning "frontend/.env does not exist"
fi
echo ""

# 2. Создать/обновить .env
print_info "2. Creating/updating frontend/.env..."
cat > frontend/.env << EOF
VITE_API_URL=http://${BACKEND_IP}:${BACKEND_PORT}
VITE_MODE=production
EOF

print_success "frontend/.env updated"
print_info "New content:"
cat frontend/.env | sed 's/^/   /'
echo ""

# 3. Проверить, нужно ли пересобирать
print_info "3. Checking if rebuild is needed..."
if [ -d "frontend/dist" ]; then
    # Проверить, когда был собран dist
    BUILD_TIME=$(stat -c %Y frontend/dist/index.html 2>/dev/null || echo "0")
    ENV_TIME=$(stat -c %Y frontend/.env 2>/dev/null || echo "0")
    
    if [ "$ENV_TIME" -gt "$BUILD_TIME" ]; then
        print_warning "frontend/.env is newer than dist/ - rebuild needed"
        NEED_REBUILD=true
    else
        print_info "Checking if dist contains old IP..."
        if grep -r "185.185.68.105" frontend/dist/ > /dev/null 2>&1; then
            print_error "Old IP found in dist/ - rebuild needed"
            NEED_REBUILD=true
        else
            print_info "dist/ seems up to date"
            NEED_REBUILD=false
        fi
    fi
else
    print_warning "frontend/dist does not exist - rebuild needed"
    NEED_REBUILD=true
fi
echo ""

# 4. Пересобрать frontend
if [ "$NEED_REBUILD" = true ]; then
    print_info "4. Rebuilding frontend..."
    cd frontend
    
    # Убедиться, что зависимости установлены
    if [ ! -d "node_modules" ]; then
        print_info "Installing dependencies..."
        npm install
    fi
    
    # Собрать
    print_info "Building frontend (this may take a few minutes)..."
    npm run build || {
        print_error "Build failed!"
        exit 1
    }
    
    cd ..
    print_success "Frontend rebuilt successfully"
else
    print_info "4. Skipping rebuild (not needed)"
fi
echo ""

# 5. Перезапустить frontend сервер
print_info "5. Restarting frontend server..."
pkill -f "serve.*dist" 2>/dev/null || true
sleep 2

cd frontend
nohup npx -y serve@latest -s dist --listen tcp://0.0.0.0:3000 > ../frontend.log 2>&1 &
FRONTEND_PID=$!
echo $FRONTEND_PID > ../frontend.pid
cd ..

print_success "Frontend server restarted (PID: $FRONTEND_PID)"
sleep 3

# 6. Проверка
print_info "6. Verifying configuration..."
if curl -s "http://localhost:3000" > /dev/null 2>&1; then
    print_success "Frontend is accessible"
    
    # Проверить, что в dist нет старого IP
    if grep -r "185.185.68.105" frontend/dist/ > /dev/null 2>&1; then
        print_error "WARNING: Old IP still found in dist/ - rebuild might have failed"
        print_info "Try manual rebuild: cd frontend && npm run build"
    else
        print_success "No old IP found in dist/"
    fi
else
    print_error "Frontend is not accessible"
    print_info "Check logs: tail -f frontend.log"
fi
echo ""

echo "=========================================="
print_success "Fix Complete!"
echo "=========================================="
echo ""
print_info "Frontend URL: http://${BACKEND_IP}:3000"
print_info "Backend API URL: http://${BACKEND_IP}:${BACKEND_PORT}"
print_info ""
print_warning "IMPORTANT: Clear browser cache or do hard refresh (Ctrl+F5)"
print_warning "The old IP might be cached in your browser!"

