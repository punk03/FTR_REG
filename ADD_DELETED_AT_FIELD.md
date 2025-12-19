# Добавление поля deletedAt в таблицу CalculatorStatement

## Проблема
Ошибка: `The column CalculatorStatement.deletedAt does not exist in the current database`

## Решение

Выполните следующую команду для добавления поля `deletedAt`:

```bash
docker-compose exec postgres psql -U ftr_user -d ftr_db -c 'ALTER TABLE "CalculatorStatement" ADD COLUMN IF NOT EXISTS "deletedAt" TIMESTAMP(3);'
```

Затем создайте индекс:

```bash
docker-compose exec postgres psql -U ftr_user -d ftr_db -c 'CREATE INDEX IF NOT EXISTS "CalculatorStatement_deletedAt_idx" ON "CalculatorStatement"("deletedAt");'
```

После этого перегенерируйте Prisma Client:

```bash
docker-compose exec backend npx prisma generate --schema=prisma/schema.prisma
```

## Альтернативный способ (все команды сразу)

```bash
docker-compose exec postgres psql -U ftr_user -d ftr_db << 'SQL'
ALTER TABLE "CalculatorStatement" ADD COLUMN IF NOT EXISTS "deletedAt" TIMESTAMP(3);
CREATE INDEX IF NOT EXISTS "CalculatorStatement_deletedAt_idx" ON "CalculatorStatement"("deletedAt");
SQL

docker-compose exec backend npx prisma generate --schema=prisma/schema.prisma
```

## Проверка

После применения миграции проверьте, что поле добавлено:

```bash
docker-compose exec postgres psql -U ftr_user -d ftr_db -c '\d "CalculatorStatement"'
```

В выводе должно быть поле `deletedAt` типа `timestamp(3)`.

