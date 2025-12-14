# Безопасное применение миграции для поля notes (без потери данных)

## Проблема
Prisma обнаружил расхождение между схемой БД и историей миграций (колонки `abbreviations` и `variants` уже есть в БД, но нет в истории миграций).

## ⚠️ ВАЖНО: НЕ СОГЛАШАЙТЕСЬ НА RESET!
Если вы согласитесь на reset, все данные будут потеряны!

## Безопасное решение (сохраняет все данные)

### Шаг 1: Пометить существующие изменения как примененные
Сначала нужно пометить миграцию для `abbreviations` и `variants` как примененную:

```bash
# Проверяем, какая миграция должна быть применена
docker-compose exec backend npx prisma migrate status --schema=prisma/schema.prisma
```

Если миграция `add_discipline_abbreviations_variants` существует, но не применена, пометим её как примененную:

```bash
docker-compose exec backend npx prisma migrate resolve --applied add_discipline_abbreviations_variants --schema=prisma/schema.prisma
```

### Шаг 2: Использовать db push вместо migrate dev (рекомендуется)
Этот способ синхронизирует схему без потери данных:

```bash
docker-compose exec backend npx prisma db push --schema=prisma/schema.prisma
```

Это добавит поле `notes` в таблицу `Registration` без потери данных.

### Шаг 3: Создать baseline миграцию (альтернатива)
Если хотите сохранить историю миграций:

```bash
# Сначала синхронизируем схему
docker-compose exec backend npx prisma db push --schema=prisma/schema.prisma

# Затем создаем baseline миграцию
docker-compose exec backend npx prisma migrate resolve --applied add_discipline_abbreviations_variants --schema=prisma/schema.prisma 2>/dev/null || true

# Создаем новую миграцию для notes
docker-compose exec backend npx prisma migrate dev --name add_notes_to_registration --create-only --schema=prisma/schema.prisma

# Применяем миграцию
docker-compose exec backend npx prisma migrate deploy --schema=prisma/schema.prisma
```

## Ручное применение SQL (самый безопасный способ)
Если хотите быть абсолютно уверены, что данные не потеряются:

```bash
# Просто добавляем колонку напрямую
docker-compose exec postgres psql -U ftr_user -d ftr_db -c "ALTER TABLE \"Registration\" ADD COLUMN IF NOT EXISTS \"notes\" TEXT;"
```

Это добавит колонку без каких-либо проверок миграций и гарантированно сохранит все данные.

## Проверка после применения
После применения проверьте, что колонка добавлена:

```bash
docker-compose exec postgres psql -U ftr_user -d ftr_db -c "\d \"Registration\""
```

В списке колонок должно появиться поле `notes` типа `text`.

## Рекомендация
Для вашего случая рекомендую использовать **ручное применение SQL** (последний вариант) - это самый безопасный способ, который гарантированно не затронет существующие данные.

