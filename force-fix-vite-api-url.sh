#!/bin/bash

# Скрипт для принудительного исправления VITE_API_URL

echo "=========================================="
echo "Принудительное исправление VITE_API_URL"
echo "=========================================="
echo ""

# Цвета
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

cd "$(dirname "$0")"

echo -e "${YELLOW}1. Проверка текущего .env файла:${NC}"
if [ -f .env ]; then
    echo "Найден .env файл:"
    grep -E "^VITE_API_URL|^#.*VITE_API_URL" .env || echo "VITE_API_URL не найден в .env"
else
    echo -e "${YELLOW}.env файл не найден, создаем новый${NC}"
fi
echo ""

echo -e "${YELLOW}2. Удаление VITE_API_URL из .env:${NC}"
# Удаляем все строки с VITE_API_URL (закомментированные и нет)
sed -i.bak '/^VITE_API_URL=/d' .env 2>/dev/null || true
sed -i.bak '/^#.*VITE_API_URL/d' .env 2>/dev/null || true
echo -e "${GREEN}✓ VITE_API_URL удален из .env${NC}"
echo ""

echo -e "${YELLOW}3. Проверка docker-compose.yml:${NC}"
if grep -q "VITE_API_URL:" docker-compose.yml; then
    echo -e "${BLUE}Найдено VITE_API_URL в docker-compose.yml:${NC}"
    grep "VITE_API_URL" docker-compose.yml
    echo ""
    echo -e "${YELLOW}Исправляем docker-compose.yml (устанавливаем пустое значение по умолчанию):${NC}"
    # Заменяем VITE_API_URL на пустое значение по умолчанию
    sed -i.bak 's/VITE_API_URL: ${VITE_API_URL:-.*}/VITE_API_URL: ${VITE_API_URL:-}/' docker-compose.yml
    echo -e "${GREEN}✓ docker-compose.yml исправлен${NC}"
else
    echo -e "${GREEN}✓ VITE_API_URL не найден в docker-compose.yml или уже пустой${NC}"
fi
echo ""

echo -e "${YELLOW}4. Остановка frontend контейнера:${NC}"
docker-compose stop frontend 2>/dev/null || echo "Контейнер уже остановлен"
echo ""

echo -e "${YELLOW}5. Удаление старого образа frontend (для полной пересборки):${NC}"
docker-compose rm -f frontend 2>/dev/null || true
docker rmi ftr_reg-frontend 2>/dev/null || echo "Образ не найден или используется"
echo ""

echo -e "${YELLOW}6. Пересборка frontend БЕЗ VITE_API_URL:${NC}"
# Убеждаемся, что переменная окружения не установлена
unset VITE_API_URL
export VITE_API_URL=""
docker-compose build --no-cache frontend
echo ""

echo -e "${YELLOW}7. Запуск frontend:${NC}"
docker-compose up -d frontend
echo ""

echo -e "${YELLOW}8. Проверка логов frontend:${NC}"
sleep 5
docker-compose logs frontend | grep -i "API URL" | tail -3
echo ""

echo -e "${BLUE}=========================================="
echo -e "Проверка результата:${NC}"
echo -e "${BLUE}=========================================="
echo ""
echo -e "${YELLOW}Проверьте в браузере (F12 → Network):${NC}"
echo -e "  - Request URL должен быть: ${GREEN}https://ftr.lilfil.ru/api/...${NC}"
echo -e "  - НЕ должен быть: ${RED}http://192.168.1.138:3001/api/...${NC}"
echo ""
echo -e "${YELLOW}Проверьте логи backend:${NC}"
echo -e "  ${BLUE}docker-compose logs backend | tail -10${NC}"
echo ""
echo -e "${YELLOW}Должны появиться правильные заголовки:${NC}"
echo -e "  - Host: ${GREEN}ftr.lilfil.ru${NC}"
echo -e "  - Origin: ${GREEN}https://ftr.lilfil.ru${NC}"
echo ""

