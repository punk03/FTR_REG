#!/bin/bash

# Скрипт для пересборки frontend с новой конфигурацией

echo "=========================================="
echo "Пересборка Frontend контейнера"
echo "=========================================="
echo ""

echo "1. Остановка frontend контейнера..."
docker-compose stop frontend 2>/dev/null || docker compose stop frontend

echo ""
echo "2. Удаление старого образа frontend..."
docker-compose rm -f frontend 2>/dev/null || docker compose rm -f frontend
docker rmi ftr_reg-frontend 2>/dev/null || true

echo ""
echo "3. Пересборка frontend без кэша..."
docker-compose build --no-cache frontend 2>/dev/null || docker compose build --no-cache frontend

if [ $? -eq 0 ]; then
    echo ""
    echo "4. Запуск frontend контейнера..."
    docker-compose up -d frontend 2>/dev/null || docker compose up -d frontend
    
    echo ""
    echo "✓ Frontend успешно пересобран и запущен"
    echo ""
    echo "Проверка статуса:"
    docker-compose ps frontend 2>/dev/null || docker compose ps frontend
else
    echo ""
    echo "✗ Ошибка при пересборке frontend"
    exit 1
fi

