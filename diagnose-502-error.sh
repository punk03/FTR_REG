#!/bin/bash

# Цвета для вывода
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}========================================${NC}"
echo -e "${BLUE}   Диагностика ошибки 502 Bad Gateway${NC}"
echo -e "${BLUE}========================================${NC}"
echo ""

# IP адрес Docker сервера (замените на ваш)
DOCKER_SERVER_IP="${1:-192.168.1.138}"

echo -e "${YELLOW}Проверка подключения к Docker серверу: ${DOCKER_SERVER_IP}${NC}"
echo ""

# Проверка доступности портов
echo -e "${YELLOW}1. Проверка порта 3000 (Frontend):${NC}"
if timeout 3 bash -c "cat < /dev/null > /dev/tcp/${DOCKER_SERVER_IP}/3000" 2>/dev/null; then
    echo -e "${GREEN}✓ Порт 3000 доступен${NC}"
    HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" --connect-timeout 3 http://${DOCKER_SERVER_IP}:3000 2>/dev/null || echo "000")
    if [ "$HTTP_CODE" != "000" ]; then
        echo -e "${GREEN}  HTTP ответ: $HTTP_CODE${NC}"
    else
        echo -e "${RED}  Не удалось получить HTTP ответ${NC}"
    fi
else
    echo -e "${RED}✗ Порт 3000 НЕ доступен${NC}"
    echo -e "${YELLOW}  Возможные причины:${NC}"
    echo -e "  - Файрвол блокирует порт"
    echo -e "  - Docker контейнер не запущен"
    echo -e "  - Неправильный IP адрес"
fi
echo ""

echo -e "${YELLOW}2. Проверка порта 3001 (Backend):${NC}"
if timeout 3 bash -c "cat < /dev/null > /dev/tcp/${DOCKER_SERVER_IP}/3001" 2>/dev/null; then
    echo -e "${GREEN}✓ Порт 3001 доступен${NC}"
    HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" --connect-timeout 3 http://${DOCKER_SERVER_IP}:3001/api/health 2>/dev/null || echo "000")
    if [ "$HTTP_CODE" != "000" ]; then
        echo -e "${GREEN}  HTTP ответ: $HTTP_CODE${NC}"
        if [ "$HTTP_CODE" = "200" ]; then
            echo -e "${GREEN}  Backend работает корректно${NC}"
        fi
    else
        echo -e "${RED}  Не удалось получить HTTP ответ${NC}"
    fi
else
    echo -e "${RED}✗ Порт 3001 НЕ доступен${NC}"
fi
echo ""

# Проверка конфигурации Nginx
echo -e "${YELLOW}3. Проверка конфигурации Nginx:${NC}"
if [ -f /etc/nginx/sites-available/ftr.lilfil.ru ]; then
    echo -e "${GREEN}✓ Файл конфигурации найден${NC}"
    
    # Проверяем IP адрес в конфигурации
    CONFIG_IP=$(grep -E "server.*:3000|server.*:3001" /etc/nginx/sites-available/ftr.lilfil.ru | head -1 | grep -oE '[0-9]+\.[0-9]+\.[0-9]+\.[0-9]+' | head -1)
    if [ -n "$CONFIG_IP" ]; then
        echo -e "${BLUE}  IP в конфигурации: $CONFIG_IP${NC}"
        if [ "$CONFIG_IP" = "$DOCKER_SERVER_IP" ]; then
            echo -e "${GREEN}  ✓ IP адрес совпадает${NC}"
        else
            echo -e "${RED}  ✗ IP адрес НЕ совпадает!${NC}"
            echo -e "${YELLOW}    Ожидается: $DOCKER_SERVER_IP${NC}"
            echo -e "${YELLOW}    В конфиге: $CONFIG_IP${NC}"
        fi
    fi
    
    # Проверяем upstream блоки
    if grep -q "upstream docker_frontend" /etc/nginx/sites-available/ftr.lilfil.ru; then
        echo -e "${GREEN}  ✓ Upstream для frontend найден${NC}"
    else
        echo -e "${RED}  ✗ Upstream для frontend НЕ найден${NC}"
    fi
    
    if grep -q "upstream docker_backend" /etc/nginx/sites-available/ftr.lilfil.ru; then
        echo -e "${GREEN}  ✓ Upstream для backend найден${NC}"
    else
        echo -e "${RED}  ✗ Upstream для backend НЕ найден${NC}"
    fi
else
    echo -e "${RED}✗ Файл конфигурации НЕ найден${NC}"
fi
echo ""

# Проверка синтаксиса Nginx
echo -e "${YELLOW}4. Проверка синтаксиса Nginx:${NC}"
if sudo nginx -t 2>&1 | grep -q "successful"; then
    echo -e "${GREEN}✓ Синтаксис Nginx корректен${NC}"
else
    echo -e "${RED}✗ Ошибки в конфигурации Nginx:${NC}"
    sudo nginx -t 2>&1 | grep -v "^nginx:"
fi
echo ""

# Проверка логов Nginx
echo -e "${YELLOW}5. Последние ошибки из логов Nginx:${NC}"
if [ -f /var/log/nginx/ftr.lilfil.ru_error.log ]; then
    echo -e "${BLUE}Последние 10 строк:${NC}"
    sudo tail -10 /var/log/nginx/ftr.lilfil.ru_error.log | grep -v "^$"
else
    echo -e "${YELLOW}Файл логов не найден${NC}"
fi
echo ""

# Проверка статуса Nginx
echo -e "${YELLOW}6. Статус Nginx:${NC}"
if systemctl is-active --quiet nginx; then
    echo -e "${GREEN}✓ Nginx запущен${NC}"
else
    echo -e "${RED}✗ Nginx НЕ запущен${NC}"
fi
echo ""

# Рекомендации
echo -e "${BLUE}========================================${NC}"
echo -e "${YELLOW}Рекомендации:${NC}"
echo ""
echo -e "1. Если порты недоступны, на Docker сервере выполните:"
echo -e "   ${BLUE}sudo ufw allow from $(hostname -I | awk '{print $1}') to any port 3000${NC}"
echo -e "   ${BLUE}sudo ufw allow from $(hostname -I | awk '{print $1}') to any port 3001${NC}"
echo ""
echo -e "2. Проверьте, что Docker контейнеры запущены:"
echo -e "   ${BLUE}docker-compose ps${NC}"
echo ""
echo -e "3. Проверьте логи Docker контейнеров:"
echo -e "   ${BLUE}docker-compose logs frontend${NC}"
echo -e "   ${BLUE}docker-compose logs backend${NC}"
echo ""
echo -e "4. Если IP в конфигурации неправильный, отредактируйте:"
echo -e "   ${BLUE}sudo nano /etc/nginx/sites-available/ftr.lilfil.ru${NC}"
echo -e "   Замените IP_АДРЕС_DOCKER_СЕРВЕРА на $DOCKER_SERVER_IP"
echo ""
echo -e "5. После изменений перезагрузите Nginx:"
echo -e "   ${BLUE}sudo nginx -t && sudo systemctl reload nginx${NC}"
echo -e "${BLUE}========================================${NC}"

