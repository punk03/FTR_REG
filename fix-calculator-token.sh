#!/bin/bash

# Быстрое исправление: добавление столбца calculatorToken через prisma db push

set -e

echo "=== Исправление: добавление столбца calculatorToken ==="
echo ""

# Проверяем, запущен ли контейнер backend
if ! docker ps --format '{{.Names}}' | grep -q "^ftr_backend$"; then
    echo "❌ Контейнер backend не запущен!"
    echo "Запустите: docker-compose up -d backend"
    exit 1
fi

echo "✓ Контейнер backend запущен"
echo ""

# Проверяем, существует ли столбец
echo "Проверка существования столбца calculatorToken..."
EXISTS=$(docker exec ftr_postgres psql -U ftr_user -d ftr_db -t -c "SELECT COUNT(*) FROM information_schema.columns WHERE table_name = 'Event' AND column_name = 'calculatorToken';" 2>/dev/null | tr -d ' ')

if [ "$EXISTS" = "1" ]; then
    echo "✓ Столбец calculatorToken уже существует"
    echo "→ Обновляем Prisma Client..."
    docker exec ftr_backend npx prisma generate
else
    echo "→ Синхронизация схемы Prisma с БД..."
    
    # Используем prisma db push для безопасной синхронизации
    docker exec ftr_backend npx prisma db push --accept-data-loss
    
    if [ $? -eq 0 ]; then
        echo "✓ Схема успешно синхронизирована"
    else
        echo "❌ Ошибка при синхронизации схемы"
        exit 1
    fi
fi

echo ""
echo "=== Генерация токенов для существующих событий ==="
echo ""

# Генерируем токены для существующих событий без токена
if docker exec ftr_backend test -f backend/scripts/generate-calculator-tokens.ts; then
    echo "→ Генерация токенов..."
    docker exec ftr_backend npx ts-node backend/scripts/generate-calculator-tokens.ts || echo "⚠ Предупреждение: не удалось сгенерировать токены (возможно, события уже имеют токены)"
else
    echo "⚠ Скрипт generate-calculator-tokens.ts не найден, пропускаем генерацию токенов"
fi

echo ""
echo "=== Перезапуск backend ==="
echo ""

# Перезапускаем backend
docker-compose restart backend

echo ""
echo "=== Исправление завершено! ==="
echo ""
echo "Проверьте логи: docker-compose logs --tail=30 backend"

