#!/bin/bash
# Скрипт для безопасного добавления поля deletedAt в таблицу CalculatorStatement

echo "Применение миграции для добавления поля deletedAt..."

docker-compose exec postgres psql -U ftr_user -d ftr_db << SQL
-- Добавление поля deletedAt для мягкого удаления
ALTER TABLE "CalculatorStatement" ADD COLUMN IF NOT EXISTS "deletedAt" TIMESTAMP(3);

-- Создание индекса для поля deletedAt
CREATE INDEX IF NOT EXISTS "CalculatorStatement_deletedAt_idx" ON "CalculatorStatement"("deletedAt");
SQL

if [ $? -eq 0 ]; then
    echo "✓ Миграция успешно применена"
    echo "Перегенерируем Prisma Client..."
    docker-compose exec backend npx prisma generate --schema=prisma/schema.prisma
    echo "✓ Готово!"
else
    echo "✗ Ошибка при применении миграции"
    exit 1
fi
