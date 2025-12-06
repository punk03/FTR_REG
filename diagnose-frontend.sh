#!/bin/bash

# Комплексная диагностика проблем с frontend

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
FRONTEND_PORT=3000
FRONTEND_IP="95.71.125.8"

echo "=========================================="
print_info "Frontend Diagnostic Tool"
echo "=========================================="
echo ""

# 1. Проверка процессов
echo "1. Checking processes..."
if pgrep -f "serve.*dist" > /dev/null; then
    PID=$(pgrep -f "serve.*dist" | head -1)
    print_success "Frontend process is running (PID: $PID)"
    ps -p $PID -o pid,ppid,cmd --no-headers | sed 's/^/   /'
else
    print_error "Frontend process is NOT running"
fi
echo ""

# 2. Проверка порта
echo "2. Checking port ${FRONTEND_PORT}..."
if lsof -i :${FRONTEND_PORT} > /dev/null 2>&1 || ss -tlnp 2>/dev/null | grep -q ":${FRONTEND_PORT}"; then
    print_success "Port ${FRONTEND_PORT} is in use"
    echo "   Listening interfaces:"
    (netstat -tlnp 2>/dev/null | grep ":${FRONTEND_PORT}" || ss -tlnp 2>/dev/null | grep ":${FRONTEND_PORT}") | sed 's/^/   /'
    
    # Проверить, слушает ли на всех интерфейсах
    if netstat -tlnp 2>/dev/null | grep -q "0.0.0.0:${FRONTEND_PORT}" || ss -tlnp 2>/dev/null | grep -q "0.0.0.0:${FRONTEND_PORT}"; then
        print_success "Port is listening on all interfaces (0.0.0.0)"
    elif netstat -tlnp 2>/dev/null | grep -q "127.0.0.1:${FRONTEND_PORT}" || ss -tlnp 2>/dev/null | grep -q "127.0.0.1:${FRONTEND_PORT}"; then
        print_error "Port is ONLY listening on localhost (127.0.0.1) - this is the problem!"
        print_warning "Frontend must listen on 0.0.0.0 to be accessible from outside"
    fi
else
    print_error "Port ${FRONTEND_PORT} is NOT listening"
fi
echo ""

# 3. Проверка локальной доступности
echo "3. Testing local connectivity..."
if curl -s -o /dev/null -w "%{http_code}" --connect-timeout 2 "http://localhost:${FRONTEND_PORT}" 2>/dev/null | grep -q "200\|301\|302"; then
    print_success "Frontend is accessible locally (http://localhost:${FRONTEND_PORT})"
else
    print_error "Frontend is NOT accessible locally"
    HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" --connect-timeout 2 "http://localhost:${FRONTEND_PORT}" 2>/dev/null || echo "000")
    print_info "HTTP response code: $HTTP_CODE"
fi
echo ""

# 4. Проверка внешней доступности
echo "4. Testing external connectivity..."
EXTERNAL_IP=$(curl -s ifconfig.me 2>/dev/null || curl -s icanhazip.com 2>/dev/null || echo "unknown")
print_info "Server external IP: $EXTERNAL_IP"
print_info "Expected IP: $FRONTEND_IP"

if [ "$EXTERNAL_IP" != "unknown" ] && [ "$EXTERNAL_IP" != "$FRONTEND_IP" ]; then
    print_warning "IP mismatch! Server IP is $EXTERNAL_IP, but config expects $FRONTEND_IP"
fi

if curl -s -o /dev/null -w "%{http_code}" --connect-timeout 2 "http://${FRONTEND_IP}:${FRONTEND_PORT}" 2>/dev/null | grep -q "200\|301\|302"; then
    print_success "Frontend is accessible via external IP"
else
    print_error "Frontend is NOT accessible via external IP (ERR_CONNECTION_REFUSED)"
fi
echo ""

# 5. Проверка файрвола (UFW)
echo "5. Checking firewall (UFW)..."
if command -v ufw &> /dev/null; then
    if ufw status | grep -q "Status: active"; then
        print_info "UFW is active"
        if ufw status | grep -q "${FRONTEND_PORT}"; then
            print_success "Port ${FRONTEND_PORT} is allowed in UFW"
            ufw status | grep "${FRONTEND_PORT}" | sed 's/^/   /'
        else
            print_error "Port ${FRONTEND_PORT} is NOT allowed in UFW"
            print_warning "Run: sudo ufw allow ${FRONTEND_PORT}/tcp"
        fi
    else
        print_info "UFW is inactive"
    fi
else
    print_info "UFW not installed"
fi
echo ""

# 6. Проверка файрвола (firewalld)
echo "6. Checking firewall (firewalld)..."
if command -v firewall-cmd &> /dev/null; then
    if systemctl is-active --quiet firewalld; then
        print_info "firewalld is active"
        if firewall-cmd --list-ports 2>/dev/null | grep -q "${FRONTEND_PORT}"; then
            print_success "Port ${FRONTEND_PORT} is allowed in firewalld"
        else
            print_error "Port ${FRONTEND_PORT} is NOT allowed in firewalld"
            print_warning "Run: sudo firewall-cmd --permanent --add-port=${FRONTEND_PORT}/tcp && sudo firewall-cmd --reload"
        fi
    else
        print_info "firewalld is inactive"
    fi
else
    print_info "firewalld not installed"
fi
echo ""

# 7. Проверка iptables
echo "7. Checking iptables..."
if command -v iptables &> /dev/null; then
    if iptables -L INPUT -n 2>/dev/null | grep -q "${FRONTEND_PORT}"; then
        print_success "Port ${FRONTEND_PORT} rule found in iptables"
        iptables -L INPUT -n | grep "${FRONTEND_PORT}" | sed 's/^/   /'
    else
        print_warning "No explicit rule for port ${FRONTEND_PORT} in iptables"
        print_info "Check if default policy allows connections"
    fi
else
    print_info "iptables not available"
fi
echo ""

# 8. Проверка dist директории
echo "8. Checking frontend build..."
if [ -d "frontend/dist" ]; then
    FILE_COUNT=$(find frontend/dist -type f | wc -l)
    if [ "$FILE_COUNT" -gt 0 ]; then
        print_success "frontend/dist exists with $FILE_COUNT files"
        if [ -f "frontend/dist/index.html" ]; then
            print_success "index.html exists"
        else
            print_error "index.html NOT found in dist/"
        fi
    else
        print_error "frontend/dist is empty"
    fi
else
    print_error "frontend/dist directory NOT found"
fi
echo ""

# 9. Проверка логов
echo "9. Checking logs..."
if [ -f "frontend.log" ]; then
    print_info "Last 15 lines of frontend.log:"
    tail -15 frontend.log | sed 's/^/   /'
else
    print_warning "frontend.log not found"
fi
echo ""

# 10. Рекомендации
echo "=========================================="
print_info "Recommendations"
echo "=========================================="

if ! pgrep -f "serve.*dist" > /dev/null; then
    print_warning "1. Frontend is not running. Start it with: ./start-frontend.sh"
fi

if netstat -tlnp 2>/dev/null | grep -q "127.0.0.1:${FRONTEND_PORT}" || ss -tlnp 2>/dev/null | grep -q "127.0.0.1:${FRONTEND_PORT}"; then
    if ! netstat -tlnp 2>/dev/null | grep -q "0.0.0.0:${FRONTEND_PORT}" && ! ss -tlnp 2>/dev/null | grep -q "0.0.0.0:${FRONTEND_PORT}"; then
        print_error "2. Frontend is listening only on localhost. Restart with:"
        echo "   cd frontend"
        echo "   pkill -f serve"
        echo "   nohup npx -y serve@latest -s dist --listen tcp://0.0.0.0:${FRONTEND_PORT} > ../frontend.log 2>&1 &"
    fi
fi

if command -v ufw &> /dev/null && ufw status | grep -q "Status: active"; then
    if ! ufw status | grep -q "${FRONTEND_PORT}"; then
        print_warning "3. Open port in UFW: sudo ufw allow ${FRONTEND_PORT}/tcp"
    fi
fi

print_info "4. Check provider firewall/security groups:"
echo "   - AWS: Security Groups → Inbound Rules"
echo "   - DigitalOcean: Networking → Firewalls"
echo "   - Hetzner: Firewall Rules"
echo "   - Add rule: TCP port ${FRONTEND_PORT} from 0.0.0.0/0"

print_info "5. Verify server IP matches:"
echo "   Current external IP: $EXTERNAL_IP"
echo "   Expected IP: $FRONTEND_IP"

echo ""
print_info "Quick fix command:"
echo "   cd $PROJECT_DIR && ./start-frontend.sh"

