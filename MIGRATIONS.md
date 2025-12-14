# Миграции базы данных

## Общая информация

В этом документе описаны все миграции базы данных и способы их безопасного применения без потери данных.

## ⚠️ Важно: Безопасное применение миграций

**НЕ СОГЛАШАЙТЕСЬ на reset базы данных**, если Prisma предлагает это! Это приведет к потере всех данных.

## Применение миграций

### Автоматическое применение (рекомендуется)

```bash
docker-compose exec backend npx prisma migrate deploy --schema=prisma/schema.prisma
```

Эта команда применяет все непримененные миграции без потери данных.

### Ручное применение SQL (самый безопасный способ)

Если автоматические миграции не работают или Prisma обнаруживает drift, используйте ручное применение:

```bash
# Добавление поля notes в таблицу Registration
docker-compose exec postgres psql -U ftr_user -d ftr_db -c "ALTER TABLE \"Registration\" ADD COLUMN IF NOT EXISTS \"notes\" TEXT;"

# Добавление полей abbreviations и variants в таблицу Discipline
docker-compose exec postgres psql -U ftr_user -d ftr_db -c "ALTER TABLE \"Discipline\" ADD COLUMN IF NOT EXISTS \"abbreviations\" TEXT, ADD COLUMN IF NOT EXISTS \"variants\" TEXT;"
```

### Использование db push (для разработки)

Для синхронизации схемы без создания миграций:

```bash
docker-compose exec backend npx prisma db push --schema=prisma/schema.prisma
```

⚠️ **Внимание:** Этот метод не создает файлы миграций и не рекомендуется для production.

## Проверка статуса миграций

```bash
docker-compose exec backend npx prisma migrate status --schema=prisma/schema.prisma
```

## Решение проблем с drift

Если Prisma обнаруживает расхождение между схемой и историей миграций:

1. **НЕ соглашайтесь на reset**
2. Используйте ручное применение SQL (см. выше)
3. Пометите миграцию как примененную:
   ```bash
   docker-compose exec backend npx prisma migrate resolve --applied <migration_name> --schema=prisma/schema.prisma
   ```

## Список миграций

### Добавление поля notes в Registration

**Описание:** Добавляет поле для заметок к регистрациям.

**SQL:**
```sql
ALTER TABLE "Registration" ADD COLUMN IF NOT EXISTS "notes" TEXT;
```

**Подробности:** [APPLY_NOTES_MIGRATION.md](APPLY_NOTES_MIGRATION.md)

### Добавление полей abbreviations и variants в Discipline

**Описание:** Добавляет поля для хранения аббревиатур и вариантов написания дисциплин.

**SQL:**
```sql
ALTER TABLE "Discipline" ADD COLUMN IF NOT EXISTS "abbreviations" TEXT, ADD COLUMN IF NOT EXISTS "variants" TEXT;
```

## Резервное копирование перед миграциями

Перед применением миграций рекомендуется создать резервную копию:

```bash
# Создание резервной копии
docker-compose exec postgres pg_dump -U ftr_user ftr_db > backup_$(date +%Y%m%d_%H%M%S).sql

# Восстановление из резервной копии
docker-compose exec -T postgres psql -U ftr_user ftr_db < backup_YYYYMMDD_HHMMSS.sql
```

## Дополнительная информация

- [Защита базы данных при обновлениях](PROTECT_DATABASE.md)
- [Инициализация базы данных](INIT_DATABASE.md)

