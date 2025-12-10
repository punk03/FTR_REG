#!/bin/bash

# Цвета для вывода
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}========================================${NC}"
echo -e "${BLUE}   Диагностика подключения API${NC}"
echo -e "${BLUE}========================================${NC}"
echo ""

# Проверка статуса контейнеров
echo -e "${YELLOW}1. Статус Docker контейнеров:${NC}"
docker-compose ps
echo ""

# Проверка доступности backend изнутри Docker сети
echo -e "${YELLOW}2. Проверка доступности backend из frontend контейнера:${NC}"
if docker-compose exec -T frontend curl -s -o /dev/null -w "%{http_code}" http://backend:3001/api/health 2>/dev/null; then
    HTTP_CODE=$(docker-compose exec -T frontend curl -s -o /dev/null -w "%{http_code}" http://backend:3001/api/health 2>/dev/null)
    if [ "$HTTP_CODE" = "200" ]; then
        echo -e "${GREEN}✓ Backend доступен из frontend контейнера (HTTP $HTTP_CODE)${NC}"
        docker-compose exec -T frontend curl -s http://backend:3001/api/health | head -5
    else
        echo -e "${RED}✗ Backend отвечает, но с ошибкой (HTTP $HTTP_CODE)${NC}"
    fi
else
    echo -e "${RED}✗ Backend НЕ доступен из frontend контейнера${NC}"
fi
echo ""

# Проверка доступности через Nginx
echo -e "${YELLOW}3. Проверка доступности API через Nginx (localhost:3000):${NC}"
HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:3000/api/health 2>/dev/null || echo "000")
if [ "$HTTP_CODE" = "200" ]; then
    echo -e "${GREEN}✓ API доступен через Nginx (HTTP $HTTP_CODE)${NC}"
    curl -s http://localhost:3000/api/health | head -5
else
    echo -e "${RED}✗ API НЕ доступен через Nginx (HTTP $HTTP_CODE)${NC}"
    echo -e "${YELLOW}Попытка получить ответ:${NC}"
    curl -v http://localhost:3000/api/health 2>&1 | head -20
fi
echo ""

# Проверка логов backend
echo -e "${YELLOW}4. Последние 20 строк логов backend:${NC}"
docker-compose logs --tail 20 backend
echo ""

# Проверка логов frontend (Nginx)
echo -e "${YELLOW}5. Последние 20 строк логов frontend:${NC}"
docker-compose logs --tail 20 frontend
echo ""

# Проверка сетевого подключения между контейнерами
echo -e "${YELLOW}6. Проверка сетевого подключения:${NC}"
if docker-compose exec -T frontend ping -c 2 backend > /dev/null 2>&1; then
    echo -e "${GREEN}✓ Frontend может пинговать backend${NC}"
else
    echo -e "${RED}✗ Frontend НЕ может пинговать backend${NC}"
fi
echo ""

# Проверка портов
echo -e "${YELLOW}7. Проверка открытых портов:${NC}"
echo -e "${BLUE}Порт 3000 (Frontend):${NC}"
ss -tlnp | grep 3000 || echo "Порт 3000 не слушает"
echo -e "${BLUE}Порт 3001 (Backend):${NC}"
ss -tlnp | grep 3001 || echo "Порт 3001 не слушает"
echo ""

# Проверка конфигурации Nginx
echo -e "${YELLOW}8. Проверка конфигурации Nginx:${NC}"
docker-compose exec -T frontend nginx -t 2>&1
echo ""

echo -e "${BLUE}========================================${NC}"
echo -e "${YELLOW}Рекомендации:${NC}"
echo -e "${YELLOW}1. Если backend недоступен из frontend, проверьте сеть Docker${NC}"
echo -e "${YELLOW}2. Если Nginx не проксирует запросы, проверьте конфигурацию${NC}"
echo -e "${YELLOW}3. Проверьте логи backend на наличие ошибок${NC}"
echo -e "${BLUE}========================================${NC}"

