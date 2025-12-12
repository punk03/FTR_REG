#!/bin/bash

# Скрипт для применения миграции добавления полей abbreviations и variants в таблицу disciplines

echo "Применение миграции для таблицы disciplines..."

# Проверяем, запущены ли контейнеры
if ! docker-compose ps | grep -q "ftr_postgres.*Up"; then
    echo "Ошибка: Контейнер PostgreSQL не запущен"
    exit 1
fi

# Сначала применяем все миграции Prisma
echo "Применение всех миграций Prisma..."
docker-compose exec backend npx prisma migrate deploy --schema=prisma/schema.prisma

if [ $? -ne 0 ]; then
    echo "Предупреждение: Не удалось применить миграции через Prisma migrate deploy"
    echo "Попытка применения миграции напрямую через SQL..."
    
    # Проверяем, существует ли таблица disciplines
    TABLE_EXISTS=$(docker-compose exec -T postgres psql -U ftr_user -d ftr_db -tAc "SELECT EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'disciplines');")
    
    if [ "$TABLE_EXISTS" = "t" ]; then
        echo "Таблица disciplines существует, добавляем колонки..."
        docker-compose exec -T postgres psql -U ftr_user -d ftr_db <<EOF
ALTER TABLE "disciplines" 
ADD COLUMN IF NOT EXISTS "abbreviations" TEXT,
ADD COLUMN IF NOT EXISTS "variants" TEXT;
EOF
        
        if [ $? -eq 0 ]; then
            echo "✓ Колонки успешно добавлены!"
        else
            echo "✗ Ошибка при добавлении колонок"
            exit 1
        fi
    else
        echo "Ошибка: Таблица disciplines не существует. Необходимо сначала применить базовые миграции Prisma."
        echo ""
        echo "Попробуйте выполнить:"
        echo "  docker-compose exec backend npx prisma migrate dev"
        echo "или"
        echo "  docker-compose exec backend npx prisma db push"
        exit 1
    fi
else
    echo "✓ Миграции Prisma успешно применены!"
fi

echo ""
echo "Проверка структуры таблицы disciplines:"
docker-compose exec -T postgres psql -U ftr_user -d ftr_db -c "\d disciplines" | grep -E "(abbreviations|variants|Column)" || echo "Таблица disciplines не найдена или колонки отсутствуют"

