# Применение миграции для полей abbreviations и variants в таблице disciplines

## Проблема
При добавлении дисциплины через форму возникает ошибка:
```
Invalid `prisma.discipline.create()` invocation: The column `abbreviations` does not exist in the current database.
```

## Решение

### Вариант 1: Через Docker (рекомендуется)

Если контейнеры запущены, выполните:

```bash
docker-compose exec backend npx prisma migrate deploy
```

Или примените SQL напрямую:

```bash
docker-compose exec postgres psql -U ftr_user -d ftr_db -c "ALTER TABLE disciplines ADD COLUMN IF NOT EXISTS abbreviations TEXT, ADD COLUMN IF NOT EXISTS variants TEXT;"
```

### Вариант 2: Через SQL напрямую

Подключитесь к базе данных и выполните:

```sql
ALTER TABLE "disciplines" 
ADD COLUMN IF NOT EXISTS "abbreviations" TEXT,
ADD COLUMN IF NOT EXISTS "variants" TEXT;
```

### Вариант 3: Через Prisma Studio

1. Запустите Prisma Studio:
```bash
docker-compose exec backend npx prisma studio
```

2. Или выполните миграцию вручную через Prisma CLI:
```bash
docker-compose exec backend npx prisma migrate dev --name add_discipline_abbreviations_variants
```

## Проверка

После применения миграции проверьте структуру таблицы:

```sql
\d disciplines
```

Должны появиться колонки:
- `abbreviations` (TEXT, nullable)
- `variants` (TEXT, nullable)

