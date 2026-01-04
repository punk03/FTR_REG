#!/bin/bash

# Цвета для вывода
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

echo -e "${YELLOW}Применение индексов для оптимизации производительности БД...${NC}"

# Проверка наличия docker-compose
if ! command -v docker-compose &> /dev/null; then
    echo -e "${RED}✗ docker-compose не найден. Убедитесь, что Docker установлен.${NC}"
    exit 1
fi

# Применение индексов через Prisma миграцию
echo -e "${YELLOW}Создание миграции Prisma...${NC}"
docker-compose exec backend npx prisma migrate dev --name add_performance_indexes --schema=prisma/schema.prisma --create-only

if [ $? -eq 0 ]; then
    echo -e "${GREEN}✓ Миграция создана.${NC}"
else
    echo -e "${YELLOW}⚠ Возможно, миграция уже существует или есть изменения. Продолжаем...${NC}"
fi

# Применение миграции
echo -e "${YELLOW}Применение миграции...${NC}"
docker-compose exec backend npx prisma migrate deploy --schema=prisma/schema.prisma

if [ $? -eq 0 ]; then
    echo -e "${GREEN}✓ Миграция применена.${NC}"
else
    echo -e "${RED}✗ Ошибка при применении миграции.${NC}"
    exit 1
fi

# Перегенерация Prisma Client
echo -e "${YELLOW}Перегенерация Prisma Client...${NC}"
docker-compose exec backend npx prisma generate --schema=prisma/schema.prisma

if [ $? -eq 0 ]; then
    echo -e "${GREEN}✓ Prisma Client перегенерирован.${NC}"
else
    echo -e "${RED}✗ Ошибка при перегенерации Prisma Client.${NC}"
    exit 1
fi

# Создание дополнительных индексов для полнотекстового поиска (если нужно)
echo -e "${YELLOW}Создание GIN индексов для полнотекстового поиска (опционально)...${NC}"
docker-compose exec postgres psql -U ftr_user -d ftr_db <<EOF
-- Создание расширения для полнотекстового поиска (если еще не создано)
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- GIN индексы для ускорения ILIKE поиска
CREATE INDEX IF NOT EXISTS "Registration_danceName_gin_idx" ON "Registration" USING gin("danceName" gin_trgm_ops);
CREATE INDEX IF NOT EXISTS "Collective_name_gin_idx" ON "Collective" USING gin("name" gin_trgm_ops);
CREATE INDEX IF NOT EXISTS "Person_fullName_gin_idx" ON "Person" USING gin("fullName" gin_trgm_ops);
EOF

if [ $? -eq 0 ]; then
    echo -e "${GREEN}✓ GIN индексы созданы (или уже существовали).${NC}"
else
    echo -e "${YELLOW}⚠ Не удалось создать GIN индексы. Это не критично, базовые индексы работают.${NC}"
fi

echo -e "${GREEN}Все индексы успешно применены!${NC}"
echo -e "${YELLOW}Рекомендуется перезапустить backend для применения изменений:${NC}"
echo -e "${YELLOW}docker-compose restart backend${NC}"

