#!/bin/bash

# Скрипт для проверки собранного frontend

echo "=========================================="
echo "Проверка собранного frontend"
echo "=========================================="
echo ""

# Цвета
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

echo -e "${YELLOW}1. Проверка переменных окружения в docker-compose.yml:${NC}"
grep -A 2 "VITE_API_URL" docker-compose.yml
echo ""

echo -e "${YELLOW}2. Проверка .env файла:${NC}"
if [ -f .env ]; then
    grep -E "^VITE_API_URL|^#.*VITE_API_URL" .env || echo -e "${GREEN}✓ VITE_API_URL не найден в .env${NC}"
else
    echo -e "${YELLOW}.env файл не найден${NC}"
fi
echo ""

echo -e "${YELLOW}3. Проверка собранного кода в контейнере:${NC}"
if docker ps | grep -q ftr_frontend; then
    echo -e "${BLUE}Ищем упоминания IP адреса в собранном коде:${NC}"
    docker exec ftr_frontend find /usr/share/nginx/html -name "*.js" -exec grep -l "192.168.1.138" {} \; 2>/dev/null | head -5
    
    echo ""
    echo -e "${BLUE}Ищем VITE_API_URL в собранном коде:${NC}"
    docker exec ftr_frontend find /usr/share/nginx/html -name "*.js" -exec grep -l "VITE_API_URL\|192.168.1.138\|3001" {} \; 2>/dev/null | head -5
    
    echo ""
    echo -e "${BLUE}Пример содержимого (первые 3 совпадения):${NC}"
    docker exec ftr_frontend grep -r "192.168.1.138\|3001" /usr/share/nginx/html --include="*.js" 2>/dev/null | head -3 || echo -e "${GREEN}✓ IP адрес не найден в собранном коде${NC}"
else
    echo -e "${RED}✗ Frontend контейнер не запущен${NC}"
fi
echo ""

echo -e "${YELLOW}4. Проверка логов frontend при запуске:${NC}"
docker-compose logs frontend 2>&1 | grep -i "API URL" | tail -3 || echo "Логи не найдены"
echo ""

echo -e "${BLUE}=========================================="
echo -e "Рекомендации:${NC}"
echo -e "${BLUE}=========================================="
echo ""
echo -e "Если IP адрес найден в собранном коде:"
echo -e "  1. Убедитесь, что VITE_API_URL удален из .env"
echo -e "  2. Удалите старый образ: ${BLUE}docker rmi ftr_reg-frontend${NC}"
echo -e "  3. Пересоберите БЕЗ кэша: ${BLUE}docker-compose build --no-cache frontend${NC}"
echo -e "  4. Перезапустите: ${BLUE}docker-compose up -d frontend${NC}"
echo ""
echo -e "В браузере:"
echo -e "  1. Откройте DevTools (F12)"
echo -e "  2. Правый клик на кнопке обновления → ${BLUE}Очистить кэш и жесткая перезагрузка${NC}"
echo -e "  3. Или используйте Ctrl+Shift+R (Cmd+Shift+R на Mac)"
echo ""
echo -e "Проверьте Network tab:"
echo -e "  - Request URL должен быть: ${GREEN}https://ftr.lilfil.ru/api/auth/login${NC}"
echo -e "  - НЕ должен быть: ${RED}http://192.168.1.138:3001/api/auth/login${NC}"
echo ""

