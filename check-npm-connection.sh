#!/bin/bash

# Скрипт для проверки подключения с сервера NPM к Docker контейнерам
# Запустите этот скрипт НА СЕРВЕРЕ С NGINX PROXY MANAGER

# Цвета
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

DOCKER_SERVER_IP="${1:-192.168.1.138}"

echo -e "${BLUE}========================================${NC}"
echo -e "${BLUE}Проверка подключения к Docker серверу${NC}"
echo -e "${BLUE}IP: ${DOCKER_SERVER_IP}${NC}"
echo -e "${BLUE}========================================${NC}"
echo ""

# Проверка доступности портов
echo -e "${YELLOW}1. Проверка порта 3000 (Frontend):${NC}"
if command -v nc >/dev/null 2>&1; then
    if nc -zv -w 3 ${DOCKER_SERVER_IP} 3000 2>&1 | grep -q "succeeded"; then
        echo -e "${GREEN}✓ Порт 3000 доступен${NC}"
    else
        echo -e "${RED}✗ Порт 3000 НЕ доступен${NC}"
        echo -e "${YELLOW}  Попытка подключения:${NC}"
        nc -zv -w 3 ${DOCKER_SERVER_IP} 3000
    fi
else
    # Fallback на curl
    HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" --connect-timeout 3 http://${DOCKER_SERVER_IP}:3000 2>/dev/null || echo "000")
    if [ "$HTTP_CODE" != "000" ] && [ "$HTTP_CODE" != "" ]; then
        echo -e "${GREEN}✓ Порт 3000 доступен (HTTP $HTTP_CODE)${NC}"
    else
        echo -e "${RED}✗ Порт 3000 НЕ доступен${NC}"
    fi
fi
echo ""

echo -e "${YELLOW}2. Проверка порта 3001 (Backend):${NC}"
if command -v nc >/dev/null 2>&1; then
    if nc -zv -w 3 ${DOCKER_SERVER_IP} 3001 2>&1 | grep -q "succeeded"; then
        echo -e "${GREEN}✓ Порт 3001 доступен${NC}"
    else
        echo -e "${RED}✗ Порт 3001 НЕ доступен${NC}"
        echo -e "${YELLOW}  Попытка подключения:${NC}"
        nc -zv -w 3 ${DOCKER_SERVER_IP} 3001
    fi
else
    HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" --connect-timeout 3 http://${DOCKER_SERVER_IP}:3001/api/health 2>/dev/null || echo "000")
    if [ "$HTTP_CODE" != "000" ] && [ "$HTTP_CODE" != "" ]; then
        echo -e "${GREEN}✓ Порт 3001 доступен (HTTP $HTTP_CODE)${NC}"
    else
        echo -e "${RED}✗ Порт 3001 НЕ доступен${NC}"
    fi
fi
echo ""

# Проверка HTTP ответов
echo -e "${YELLOW}3. Проверка HTTP ответов:${NC}"
echo -e "${BLUE}Frontend (порт 3000):${NC}"
curl -s -o /dev/null -w "  HTTP код: %{http_code}\n" --connect-timeout 3 http://${DOCKER_SERVER_IP}:3000 2>&1 | head -1
echo -e "${BLUE}Backend API (порт 3001):${NC}"
curl -s -o /dev/null -w "  HTTP код: %{http_code}\n" --connect-timeout 3 http://${DOCKER_SERVER_IP}:3001/api/health 2>&1 | head -1
echo ""

# Проверка сетевого подключения
echo -e "${YELLOW}4. Проверка сетевого подключения:${NC}"
if ping -c 2 -W 2 ${DOCKER_SERVER_IP} > /dev/null 2>&1; then
    echo -e "${GREEN}✓ Ping успешен${NC}"
else
    echo -e "${RED}✗ Ping не проходит${NC}"
    echo -e "${YELLOW}  Возможно, сервер блокирует ICMP или недоступен${NC}"
fi
echo ""

# Проверка маршрутизации
echo -e "${YELLOW}5. Проверка маршрутизации:${NC}"
if command -v traceroute >/dev/null 2>&1; then
    echo -e "${BLUE}Маршрут к Docker серверу:${NC}"
    traceroute -n -m 5 ${DOCKER_SERVER_IP} 2>&1 | head -10
else
    echo -e "${YELLOW}  traceroute не установлен, пропускаем${NC}"
fi
echo ""

# Рекомендации
echo -e "${BLUE}========================================${NC}"
echo -e "${YELLOW}Рекомендации:${NC}"
echo ""
echo -e "Если порты недоступны:"
echo -e "1. На Docker сервере (${DOCKER_SERVER_IP}) откройте порты:"
echo -e "   ${BLUE}sudo ufw allow from $(hostname -I | awk '{print $1}') to any port 3000${NC}"
echo -e "   ${BLUE}sudo ufw allow from $(hostname -I | awk '{print $1}') to any port 3001${NC}"
echo ""
echo -e "2. Проверьте, что Docker контейнеры запущены:"
echo -e "   ${BLUE}docker-compose ps${NC}"
echo ""
echo -e "3. Проверьте логи Docker контейнеров:"
echo -e "   ${BLUE}docker-compose logs frontend | tail -20${NC}"
echo -e "   ${BLUE}docker-compose logs backend | tail -20${NC}"
echo ""
echo -e "4. В NPM проверьте настройки Proxy Host:"
echo -e "   - Forward Hostname/IP должен быть: ${DOCKER_SERVER_IP}"
echo -e "   - Forward Port для frontend: 3000"
echo -e "   - Forward Port для /api location: 3001"
echo -e "   - Websockets Support должен быть включен"
echo ""
echo -e "${BLUE}========================================${NC}"

