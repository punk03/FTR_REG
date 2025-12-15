#!/bin/bash

# Скрипт для применения миграции calculatorToken

set -e

echo "=== Применение миграции calculatorToken ==="
echo ""

# Проверяем, запущен ли контейнер PostgreSQL
if ! docker ps --format '{{.Names}}' | grep -q "^ftr_postgres$"; then
    echo "❌ Контейнер PostgreSQL не запущен!"
    echo "Запустите: docker-compose up -d postgres"
    exit 1
fi

echo "✓ Контейнер PostgreSQL запущен"
echo ""

# Проверяем, существует ли столбец
echo "Проверка существования столбца calculatorToken..."
EXISTS=$(docker exec ftr_postgres psql -U ftr_user -d ftr_db -t -c "SELECT COUNT(*) FROM information_schema.columns WHERE table_name = 'Event' AND column_name = 'calculatorToken';" 2>/dev/null | tr -d ' ')

if [ "$EXISTS" = "1" ]; then
    echo "✓ Столбец calculatorToken уже существует"
else
    echo "→ Добавление столбца calculatorToken..."
    
    # Применяем SQL миграцию напрямую
    docker exec ftr_postgres psql -U ftr_user -d ftr_db -c "ALTER TABLE \"Event\" ADD COLUMN IF NOT EXISTS \"calculatorToken\" TEXT;"
    docker exec ftr_postgres psql -U ftr_user -d ftr_db -c "CREATE UNIQUE INDEX IF NOT EXISTS \"Event_calculatorToken_key\" ON \"Event\"(\"calculatorToken\");"
    docker exec ftr_postgres psql -U ftr_user -d ftr_db -c "CREATE INDEX IF NOT EXISTS \"Event_calculatorToken_idx\" ON \"Event\"(\"calculatorToken\");"
    
    if [ $? -eq 0 ]; then
        echo "✓ Столбец calculatorToken успешно добавлен"
    else
        echo "❌ Ошибка при добавлении столбца"
        exit 1
    fi
fi

echo ""
echo "=== Генерация токенов для существующих событий ==="
echo ""

# Генерируем токены для существующих событий без токена
echo "→ Генерация токенов..."
docker exec ftr_backend npx ts-node backend/scripts/generate-calculator-tokens.ts

if [ $? -eq 0 ]; then
    echo "✓ Токены успешно сгенерированы"
else
    echo "⚠ Предупреждение: не удалось сгенерировать токены (возможно, скрипт не найден или события уже имеют токены)"
fi

echo ""
echo "=== Обновление Prisma Client ==="
echo ""

# Обновляем Prisma Client
echo "→ Генерация Prisma Client..."
docker exec ftr_backend npx prisma generate

if [ $? -eq 0 ]; then
    echo "✓ Prisma Client успешно обновлён"
else
    echo "❌ Ошибка при обновлении Prisma Client"
    exit 1
fi

echo ""
echo "=== Перезапуск backend ==="
echo ""

# Перезапускаем backend
docker-compose restart backend

echo ""
echo "=== Миграция завершена успешно! ==="

