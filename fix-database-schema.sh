#!/bin/bash

# Скрипт для синхронизации схемы Prisma с базой данных

echo "Синхронизация схемы Prisma с базой данных..."

# Проверяем, запущены ли контейнеры
if ! docker-compose ps | grep -q "ftr_postgres.*Up"; then
    echo "Ошибка: Контейнер PostgreSQL не запущен"
    exit 1
fi

if ! docker-compose ps | grep -q "ftr_backend.*Up"; then
    echo "Ошибка: Контейнер Backend не запущен"
    exit 1
fi

echo "Шаг 1: Проверка существующих таблиц..."
docker-compose exec -T postgres psql -U ftr_user -d ftr_db -c "\dt" | cat

echo ""
echo "Шаг 2: Синхронизация схемы Prisma с базой данных (db push)..."
docker-compose exec backend npx prisma db push --schema=prisma/schema.prisma --accept-data-loss

if [ $? -eq 0 ]; then
    echo ""
    echo "✓ Схема успешно синхронизирована!"
    echo ""
    echo "Шаг 3: Генерация Prisma Client..."
    docker-compose exec backend npx prisma generate --schema=prisma/schema.prisma
    
    echo ""
    echo "Шаг 4: Проверка таблицы disciplines..."
    docker-compose exec -T postgres psql -U ftr_user -d ftr_db -c "\d disciplines" | cat
    
    echo ""
    echo "Шаг 5: Проверка наличия колонок abbreviations и variants..."
    docker-compose exec -T postgres psql -U ftr_user -d ftr_db -c "SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'disciplines' AND column_name IN ('abbreviations', 'variants');" | cat
    
    echo ""
    echo "✓ Готово! Теперь можно добавлять дисциплины через форму."
else
    echo "✗ Ошибка при синхронизации схемы"
    exit 1
fi

