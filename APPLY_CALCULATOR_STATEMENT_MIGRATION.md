# Применение миграции для таблицы CalculatorStatement

## Описание
Создана отдельная таблица `CalculatorStatement` для ведомости калькулятора. Эта таблица полностью независима от `AccountingEntry` и регистраций, что позволяет вручную вносить данные в ведомость без связи с данными мероприятия.

## Применение миграции

### ✅ Вариант 1: Ручное применение SQL (РЕКОМЕНДУЕТСЯ)

```bash
docker-compose exec postgres psql -U ftr_user -d ftr_db -f /path/to/add_calculator_statement.sql
```

Или выполните SQL команды напрямую:

```bash
docker-compose exec postgres psql -U ftr_user -d ftr_db << EOF
-- Создание таблицы CalculatorStatement
CREATE TABLE IF NOT EXISTS "CalculatorStatement" (
    "id" SERIAL NOT NULL,
    "eventId" INTEGER NOT NULL,
    "collectiveName" TEXT NOT NULL,
    "amount" DECIMAL(10, 2) NOT NULL,
    "method" "PaymentMethod" NOT NULL,
    "paidFor" "PaidFor" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "CalculatorStatement_pkey" PRIMARY KEY ("id")
);

-- Создание индексов
CREATE INDEX IF NOT EXISTS "CalculatorStatement_eventId_idx" ON "CalculatorStatement"("eventId");
CREATE INDEX IF NOT EXISTS "CalculatorStatement_createdAt_idx" ON "CalculatorStatement"("createdAt");
CREATE INDEX IF NOT EXISTS "CalculatorStatement_method_idx" ON "CalculatorStatement"("method");
CREATE INDEX IF NOT EXISTS "CalculatorStatement_paidFor_idx" ON "CalculatorStatement"("paidFor");

-- Добавление внешнего ключа
ALTER TABLE "CalculatorStatement" ADD CONSTRAINT "CalculatorStatement_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "Event"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EOF
```

### ✅ Вариант 2: Использование db push (безопасно)

```bash
docker-compose exec backend npx prisma db push --schema=prisma/schema.prisma
```

После применения миграции необходимо перегенерировать Prisma Client:

```bash
docker-compose exec backend npx prisma generate --schema=prisma/schema.prisma
```

## Структура таблицы

- `id` - уникальный идентификатор записи
- `eventId` - ID события (связь с Event)
- `collectiveName` - название коллектива (строка, не связь с таблицей Collective)
- `amount` - сумма платежа (DECIMAL(10, 2))
- `method` - способ оплаты (CASH, CARD, TRANSFER)
- `paidFor` - назначение платежа (PERFORMANCE, DIPLOMAS_MEDALS)
- `createdAt` - дата создания записи

## Важно

- Таблица `CalculatorStatement` полностью независима от `AccountingEntry`
- Данные в ведомости калькулятора не связаны с регистрациями
- Все записи вводятся вручную через интерфейс калькулятора

