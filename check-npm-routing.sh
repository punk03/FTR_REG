#!/bin/bash

# Скрипт для проверки маршрутизации через NPM

echo "=========================================="
echo "Проверка маршрутизации через NPM"
echo "=========================================="
echo ""

echo "1. Проверка прямого доступа к backend (должен быть доступен):"
curl -s -o /dev/null -w "HTTP код: %{http_code}\n" http://192.168.1.138:3001/api/health
echo ""

echo "2. Проверка доступа через NPM (должен проксировать):"
curl -s -o /dev/null -w "HTTP код: %{http_code}\n" https://ftr.lilfil.ru/api/health
echo ""

echo "3. Проверка заголовков ответа от NPM:"
curl -s -I https://ftr.lilfil.ru/api/health | grep -i "access-control\|server\|x-"
echo ""

echo "4. Полный ответ от API через NPM:"
curl -s https://ftr.lilfil.ru/api/health
echo ""
echo ""

echo "=========================================="
echo "Интерпретация результатов:"
echo "=========================================="
echo ""
echo "Если оба запроса возвращают 200 - это нормально"
echo "Но если в логах backend видно 'Host: localhost:3001',"
echo "значит NPM не передает правильные заголовки."
echo ""
echo "Решение: Проверьте Custom Location в NPM:"
echo "1. Location должен быть '/api' (со слешем)"
echo "2. Custom Nginx Configuration должен содержать proxy_set_header директивы"
echo "3. Сохраните и подождите 30 секунд"
echo ""

