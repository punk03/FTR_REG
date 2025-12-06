#!/bin/bash

# Скрипт для проверки подключения frontend к backend

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
BACKEND_PORT=3001
FRONTEND_PORT=3000
BACKEND_IP="95.71.125.8"

echo "=========================================="
print_info "Backend Connection Diagnostic"
echo "=========================================="
echo ""

# 1. Проверка backend процесса
echo "1. Checking backend process..."
if pgrep -f "node.*dist/index.js" > /dev/null || pgrep -f "npm.*start" > /dev/null; then
    PID=$(pgrep -f "node.*dist/index.js" | head -1 || pgrep -f "npm.*start" | head -1)
    print_success "Backend process is running (PID: $PID)"
    ps -p $PID -o pid,ppid,cmd --no-headers | sed 's/^/   /'
else
    print_error "Backend process is NOT running"
    print_warning "Start backend with: cd backend && npm start"
fi
echo ""

# 2. Проверка backend порта
echo "2. Checking backend port ${BACKEND_PORT}..."
if lsof -i :${BACKEND_PORT} > /dev/null 2>&1 || ss -tlnp 2>/dev/null | grep -q ":${BACKEND_PORT}"; then
    print_success "Port ${BACKEND_PORT} is listening"
    (netstat -tlnp 2>/dev/null | grep ":${BACKEND_PORT}" || ss -tlnp 2>/dev/null | grep ":${BACKEND_PORT}") | sed 's/^/   /'
    
    if netstat -tlnp 2>/dev/null | grep -q "0.0.0.0:${BACKEND_PORT}" || ss -tlnp 2>/dev/null | grep -q "0.0.0.0:${BACKEND_PORT}"; then
        print_success "Backend is listening on all interfaces (0.0.0.0)"
    else
        print_warning "Backend might be listening only on localhost"
    fi
else
    print_error "Port ${BACKEND_PORT} is NOT listening"
fi
echo ""

# 3. Проверка backend API локально
echo "3. Testing backend API locally..."
if curl -s -o /dev/null -w "%{http_code}" --connect-timeout 2 "http://localhost:${BACKEND_PORT}/api/health" 2>/dev/null | grep -q "200\|404"; then
    print_success "Backend API is responding locally"
    HEALTH_RESPONSE=$(curl -s "http://localhost:${BACKEND_PORT}/api/health" 2>/dev/null || echo "")
    if [ -n "$HEALTH_RESPONSE" ]; then
        echo "   Response: $HEALTH_RESPONSE" | head -3 | sed 's/^/   /'
    fi
else
    print_error "Backend API is NOT responding locally"
    HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" --connect-timeout 2 "http://localhost:${BACKEND_PORT}/api/health" 2>/dev/null || echo "000")
    print_info "HTTP response code: $HTTP_CODE"
fi
echo ""

# 4. Проверка backend API через внешний IP
echo "4. Testing backend API via external IP..."
if curl -s -o /dev/null -w "%{http_code}" --connect-timeout 2 "http://${BACKEND_IP}:${BACKEND_PORT}/api/health" 2>/dev/null | grep -q "200\|404"; then
    print_success "Backend API is accessible via external IP"
else
    print_error "Backend API is NOT accessible via external IP"
    HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" --connect-timeout 2 "http://${BACKEND_IP}:${BACKEND_PORT}/api/health" 2>/dev/null || echo "000")
    print_info "HTTP response code: $HTTP_CODE"
fi
echo ""

# 5. Проверка frontend .env
echo "5. Checking frontend .env configuration..."
if [ -f "frontend/.env" ]; then
    print_success "frontend/.env exists"
    VITE_API_URL=$(grep "^VITE_API_URL=" frontend/.env | cut -d'=' -f2 | tr -d '"' | tr -d "'" || echo "")
    if [ -n "$VITE_API_URL" ]; then
        print_info "VITE_API_URL=$VITE_API_URL"
        if echo "$VITE_API_URL" | grep -q "${BACKEND_IP}:${BACKEND_PORT}"; then
            print_success "VITE_API_URL points to correct backend"
        else
            print_error "VITE_API_URL does NOT point to correct backend!"
            print_warning "Expected: http://${BACKEND_IP}:${BACKEND_PORT}"
            print_warning "Found: $VITE_API_URL"
        fi
    else
        print_error "VITE_API_URL not found in frontend/.env"
    fi
else
    print_error "frontend/.env NOT found"
    print_warning "Create it with: echo 'VITE_API_URL=http://${BACKEND_IP}:${BACKEND_PORT}' > frontend/.env"
fi
echo ""

# 6. Проверка CORS на backend
echo "6. Testing CORS configuration..."
CORS_TEST=$(curl -s -o /dev/null -w "%{http_code}" -H "Origin: http://${BACKEND_IP}:${FRONTEND_PORT}" \
    -H "Access-Control-Request-Method: POST" \
    -X OPTIONS \
    "http://localhost:${BACKEND_PORT}/api/auth/login" 2>/dev/null || echo "000")

if [ "$CORS_TEST" = "200" ] || [ "$CORS_TEST" = "204" ]; then
    print_success "CORS preflight request succeeded"
else
    print_warning "CORS preflight request returned: $CORS_TEST"
    print_info "This might be normal if backend handles CORS differently"
fi
echo ""

# 7. Тест авторизации
echo "7. Testing login endpoint..."
LOGIN_TEST=$(curl -s -X POST \
    -H "Content-Type: application/json" \
    -H "Origin: http://${BACKEND_IP}:${FRONTEND_PORT}" \
    -d '{"email":"admin@ftr.ru","password":"admin123"}' \
    "http://localhost:${BACKEND_PORT}/api/auth/login" 2>/dev/null || echo "")

if echo "$LOGIN_TEST" | grep -q "accessToken\|error"; then
    print_success "Login endpoint is responding"
    echo "$LOGIN_TEST" | head -5 | sed 's/^/   /'
else
    print_error "Login endpoint is NOT responding correctly"
    print_info "Response: $LOGIN_TEST"
fi
echo ""

# 8. Проверка логов backend
echo "8. Checking backend logs..."
if [ -f "backend.log" ]; then
    print_info "Last 20 lines of backend.log:"
    tail -20 backend.log | sed 's/^/   /'
else
    print_warning "backend.log not found"
fi
echo ""

# 9. Рекомендации
echo "=========================================="
print_info "Recommendations"
echo "=========================================="

if ! pgrep -f "node.*dist/index.js" > /dev/null; then
    print_warning "1. Start backend: cd backend && npm start"
fi

if [ ! -f "frontend/.env" ] || ! grep -q "VITE_API_URL=http://${BACKEND_IP}:${BACKEND_PORT}" frontend/.env 2>/dev/null; then
    print_warning "2. Fix frontend/.env:"
    echo "   echo 'VITE_API_URL=http://${BACKEND_IP}:${BACKEND_PORT}' > frontend/.env"
    echo "   Then rebuild frontend: cd frontend && npm run build"
fi

if ! netstat -tlnp 2>/dev/null | grep -q "0.0.0.0:${BACKEND_PORT}" && ! ss -tlnp 2>/dev/null | grep -q "0.0.0.0:${BACKEND_PORT}"; then
    print_warning "3. Backend might not be listening on all interfaces"
    print_info "Check backend/src/index.ts - should listen on 0.0.0.0 or process.env.PORT"
fi

print_info "4. Check browser console (F12) for errors when trying to login"
print_info "5. Check network tab (F12) to see if requests are being sent"

echo ""

