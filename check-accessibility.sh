#!/bin/bash

# Скрипт для диагностики доступности сайта

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

echo -e "${BLUE}========================================${NC}"
echo -e "${BLUE}   Диагностика доступности сайта${NC}"
echo -e "${BLUE}========================================${NC}"
echo ""

# Проверка статуса контейнеров
echo -e "${YELLOW}1. Статус Docker контейнеров:${NC}"
docker-compose ps 2>/dev/null || docker compose ps
echo ""

# Проверка портов
echo -e "${YELLOW}2. Проверка открытых портов:${NC}"
echo "Порт 3000 (Frontend):"
ss -tlnp | grep :3000 || netstat -tlnp | grep :3000 || echo "Порт 3000 не найден"
echo ""
echo "Порт 3001 (Backend):"
ss -tlnp | grep :3001 || netstat -tlnp | grep :3001 || echo "Порт 3001 не найден"
echo ""

# Проверка доступности frontend локально
echo -e "${YELLOW}3. Проверка доступности Frontend (localhost:3000):${NC}"
if curl -s -o /dev/null -w "%{http_code}" http://localhost:3000 | grep -q "200\|301\|302"; then
    echo -e "${GREEN}✓ Frontend доступен на localhost:3000${NC}"
else
    echo -e "${RED}✗ Frontend НЕ доступен на localhost:3000${NC}"
fi
echo ""

# Проверка доступности backend локально
echo -e "${YELLOW}4. Проверка доступности Backend (localhost:3001):${NC}"
if curl -s -o /dev/null -w "%{http_code}" http://localhost:3001/api/health | grep -q "200"; then
    echo -e "${GREEN}✓ Backend доступен на localhost:3001${NC}"
    echo "Ответ от /api/health:"
    curl -s http://localhost:3001/api/health | head -3
else
    echo -e "${RED}✗ Backend НЕ доступен на localhost:3001${NC}"
fi
echo ""

# Проверка логов frontend
echo -e "${YELLOW}5. Последние строки логов Frontend:${NC}"
docker-compose logs --tail=10 frontend 2>/dev/null || docker compose logs --tail=10 frontend
echo ""

# Проверка логов backend
echo -e "${YELLOW}6. Последние строки логов Backend:${NC}"
docker-compose logs --tail=10 backend 2>/dev/null || docker compose logs --tail=10 backend
echo ""

# Проверка переменных окружения frontend
echo -e "${YELLOW}7. Переменные окружения Frontend контейнера:${NC}"
docker-compose exec -T frontend env 2>/dev/null | grep VITE || docker compose exec -T frontend env 2>/dev/null | grep VITE || echo "Не удалось получить переменные окружения"
echo ""

# Проверка файрвола
echo -e "${YELLOW}8. Статус файрвола (ufw):${NC}"
if command -v ufw &> /dev/null; then
    sudo ufw status | head -10
else
    echo "ufw не установлен"
fi
echo ""

# Проверка сетевых интерфейсов
echo -e "${YELLOW}9. Сетевые интерфейсы:${NC}"
ip addr show | grep -E "inet.*95\.71\.125" || ifconfig | grep -E "inet.*95\.71\.125" || echo "IP 95.71.125.8 не найден на локальных интерфейсах"
echo ""

# Проверка nginx конфигурации в контейнере
echo -e "${YELLOW}10. Конфигурация Nginx в Frontend контейнере:${NC}"
docker-compose exec -T frontend cat /etc/nginx/conf.d/default.conf 2>/dev/null | head -30 || docker compose exec -T frontend cat /etc/nginx/conf.d/default.conf 2>/dev/null | head -30 || echo "Не удалось получить конфигурацию"
echo ""

echo -e "${BLUE}========================================${NC}"
echo -e "${YELLOW}Рекомендации:${NC}"
echo "1. Убедитесь, что порт 3000 открыт на роутере (Port Forwarding)"
echo "2. Проверьте файрвол на сервере: sudo ufw allow 3000/tcp"
echo "3. Проверьте, что контейнеры запущены: docker-compose ps"
echo "4. Проверьте логи: docker-compose logs frontend"
echo -e "${BLUE}========================================${NC}"

