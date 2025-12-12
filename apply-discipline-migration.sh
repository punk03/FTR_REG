#!/bin/bash

# Скрипт для применения миграции добавления полей abbreviations и variants в таблицу disciplines

echo "Применение миграции для таблицы disciplines..."

# Проверяем, запущены ли контейнеры
if ! docker-compose ps | grep -q "ftr_postgres.*Up"; then
    echo "Ошибка: Контейнер PostgreSQL не запущен"
    exit 1
fi

# Применяем SQL миграцию
echo "Добавление колонок abbreviations и variants..."
docker-compose exec -T postgres psql -U ftr_user -d ftr_db <<EOF
ALTER TABLE "disciplines" 
ADD COLUMN IF NOT EXISTS "abbreviations" TEXT,
ADD COLUMN IF NOT EXISTS "variants" TEXT;
EOF

if [ $? -eq 0 ]; then
    echo "✓ Миграция успешно применена!"
    echo ""
    echo "Проверка структуры таблицы:"
    docker-compose exec -T postgres psql -U ftr_user -d ftr_db -c "\d disciplines" | grep -E "(abbreviations|variants)"
else
    echo "✗ Ошибка при применении миграции"
    exit 1
fi

