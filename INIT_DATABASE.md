# Инициализация базы данных

## Проблема
Таблица `disciplines` не существует в базе данных. Это означает, что миграции Prisma не были применены.

## Решение

### Вариант 1: Применить все миграции (рекомендуется)

```bash
docker-compose exec backend npx prisma migrate deploy --schema=prisma/schema.prisma
```

### Вариант 2: Создать базу данных с нуля (если данных нет)

```bash
# Остановите контейнеры
docker-compose down

# Удалите volumes (ВНИМАНИЕ: это удалит все данные!)
docker-compose down -v

# Запустите контейнеры заново
docker-compose up -d

# Дождитесь запуска базы данных (около 10 секунд)
sleep 10

# Примените миграции
docker-compose exec backend npx prisma migrate deploy --schema=prisma/schema.prisma

# Сгенерируйте Prisma Client
docker-compose exec backend npx prisma generate --schema=prisma/schema.prisma

# Опционально: загрузите начальные данные (seed)
docker-compose exec backend npx prisma db seed
```

### Вариант 3: Использовать Prisma db push (для разработки)

```bash
docker-compose exec backend npx prisma db push --schema=prisma/schema.prisma
```

Этот метод синхронизирует схему Prisma с базой данных без создания файлов миграций.

### Вариант 4: Проверить статус миграций

```bash
docker-compose exec backend npx prisma migrate status --schema=prisma/schema.prisma
```

Это покажет, какие миграции применены, а какие нет.

## После применения миграций

После успешного применения миграций выполните обновленный скрипт:

```bash
./apply-discipline-migration.sh
```

Или вручную добавьте колонки:

```bash
docker-compose exec postgres psql -U ftr_user -d ftr_db -c "ALTER TABLE disciplines ADD COLUMN IF NOT EXISTS abbreviations TEXT, ADD COLUMN IF NOT EXISTS variants TEXT;"
```

## Проверка

Проверьте, что таблица создана:

```bash
docker-compose exec postgres psql -U ftr_user -d ftr_db -c "\dt"
```

Должны быть видны таблицы:
- disciplines
- nominations
- ages
- categories
- и другие...

