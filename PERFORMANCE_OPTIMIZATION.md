# Оптимизация производительности базы данных

## Проблема
Сайт работал очень медленно, особенно с ростом размера БД. Основные проблемы:
- Отсутствие индексов для поиска по текстовым полям
- Отсутствие составных индексов для частых комбинаций условий
- Медленный поиск по связанным таблицам (leaders, trainers)
- Отсутствие индексов для сортировки

## Решение

### 1. Добавлены индексы для поиска

#### Registration модель:
- `@@index([danceName])` - для поиска по названию номера
- `@@index([status])` - для фильтрации по статусу регистрации
- `@@index([createdAt])` - для сортировки по дате создания
- `@@index([blockNumber])` - для сортировки в дипломах
- `@@index([number])` - для сортировки по номеру

#### Составные индексы для оптимизации частых запросов:
- `@@index([eventId, paymentStatus])` - фильтрация по событию и статусу оплаты
- `@@index([eventId, status])` - фильтрация по событию и статусу регистрации
- `@@index([eventId, createdAt])` - сортировка по событию и дате
- `@@index([eventId, collectiveId])` - группировка по событию и коллективу
- `@@index([eventId, blockNumber, number])` - сортировка для дипломов

#### Person модель:
- `@@index([fullName])` - для поиска по имени без роли

#### RegistrationLeader и RegistrationTrainer:
- `@@index([registrationId])` - для быстрого поиска лидеров/тренеров регистрации
- `@@index([personId])` - для обратного поиска (какие регистрации у человека)

### 2. GIN индексы для полнотекстового поиска

Скрипт автоматически создает GIN индексы с использованием расширения `pg_trgm` для ускорения ILIKE поиска:
- `Registration.danceName` - поиск по названию номера
- `Collective.name` - поиск по названию коллектива
- `Person.fullName` - поиск по ФИО

## Применение изменений

### Вариант 1: Использование скрипта (РЕКОМЕНДУЕТСЯ)

```bash
./apply-performance-indexes.sh
```

Скрипт автоматически:
1. Создаст Prisma миграцию
2. Применит миграцию к базе данных
3. Перегенерирует Prisma Client
4. Создаст GIN индексы для полнотекстового поиска

### Вариант 2: Ручное применение

```bash
# Создание и применение миграции
docker-compose exec backend npx prisma migrate dev --name add_performance_indexes --schema=prisma/schema.prisma

# Перегенерация Prisma Client
docker-compose exec backend npx prisma generate --schema=prisma/schema.prisma

# Создание GIN индексов (опционально, но рекомендуется)
docker-compose exec postgres psql -U ftr_user -d ftr_db <<EOF
CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE INDEX IF NOT EXISTS "Registration_danceName_gin_idx" ON "Registration" USING gin("danceName" gin_trgm_ops);
CREATE INDEX IF NOT EXISTS "Collective_name_gin_idx" ON "Collective" USING gin("name" gin_trgm_ops);
CREATE INDEX IF NOT EXISTS "Person_fullName_gin_idx" ON "Person" USING gin("fullName" gin_trgm_ops);
EOF
```

### После применения

**Важно:** Перезапустите backend для применения изменений:

```bash
docker-compose restart backend
```

## Ожидаемые результаты

После применения индексов ожидается:
- **Ускорение поиска** по текстовым полям в 10-100 раз
- **Ускорение фильтрации** по комбинациям условий (eventId + paymentStatus) в 5-20 раз
- **Ускорение сортировки** по коллективам и датам в 3-10 раз
- **Ускорение поиска** по leaders/trainers в 5-15 раз
- **Общее улучшение производительности** на 50-80% для больших БД

## Проверка индексов

Для проверки созданных индексов:

```bash
docker-compose exec postgres psql -U ftr_user -d ftr_db -c "\d+ \"Registration\""
```

## Дополнительные оптимизации

Если производительность все еще недостаточна, можно рассмотреть:
1. Партиционирование таблиц по eventId (для очень больших БД)
2. Материализованные представления для статистики
3. Кэширование часто запрашиваемых данных в Redis
4. Оптимизация запросов с использованием `select` вместо `include` где возможно

## Откат изменений

Если нужно откатить миграцию:

```bash
docker-compose exec backend npx prisma migrate resolve --rolled-back add_performance_indexes --schema=prisma/schema.prisma
```

Затем удалите индексы вручную через SQL, если они были созданы.

