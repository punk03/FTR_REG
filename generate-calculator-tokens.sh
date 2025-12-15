#!/bin/bash

# Скрипт для генерации токенов калькулятора для всех существующих событий

set -e

echo "=== Генерация токенов калькулятора для существующих событий ==="
echo ""

# Проверяем, запущен ли контейнер backend
if ! docker ps --format '{{.Names}}' | grep -q "^ftr_backend$"; then
    echo "❌ Контейнер backend не запущен!"
    echo "Запустите: docker-compose up -d backend"
    exit 1
fi

echo "✓ Контейнер backend запущен"
echo ""

# Проверяем, существует ли столбец
echo "Проверка существования столбца calculatorToken..."
EXISTS=$(docker exec ftr_postgres psql -U ftr_user -d ftr_db -t -c "SELECT COUNT(*) FROM information_schema.columns WHERE table_name = 'Event' AND column_name = 'calculatorToken';" 2>/dev/null | tr -d ' ')

if [ "$EXISTS" != "1" ]; then
    echo "❌ Столбец calculatorToken не существует!"
    echo "Сначала выполните: ./fix-calculator-token.sh"
    exit 1
fi

echo "✓ Столбец calculatorToken существует"
echo ""

# Проверяем количество событий без токена
EVENTS_WITHOUT_TOKEN=$(docker exec ftr_postgres psql -U ftr_user -d ftr_db -t -c "SELECT COUNT(*) FROM \"Event\" WHERE \"calculatorToken\" IS NULL;" 2>/dev/null | tr -d ' ')

if [ "$EVENTS_WITHOUT_TOKEN" = "0" ]; then
    echo "✓ Все события уже имеют токены калькулятора"
    exit 0
fi

echo "Найдено событий без токена: $EVENTS_WITHOUT_TOKEN"
echo ""

# Пробуем запустить скрипт через ts-node
echo "→ Генерация токенов через скрипт..."
if docker exec ftr_backend test -f backend/scripts/generate-calculator-tokens.ts; then
    docker exec ftr_backend npx ts-node backend/scripts/generate-calculator-tokens.ts
elif docker exec ftr_backend test -f /app/backend/scripts/generate-calculator-tokens.ts; then
    docker exec ftr_backend npx ts-node /app/backend/scripts/generate-calculator-tokens.ts
else
    echo "⚠ Скрипт не найден, используем прямой SQL..."
    
    # Генерируем токены напрямую через SQL
    docker exec ftr_backend node -e "
    const { v4: uuidv4 } = require('uuid');
    const { PrismaClient } = require('@prisma/client');
    const prisma = new PrismaClient();
    
    (async () => {
      try {
        const events = await prisma.event.findMany({
          where: { calculatorToken: null },
        });
        
        console.log(\`Found \${events.length} events without calculator token\`);
        
        for (const event of events) {
          const token = uuidv4();
          await prisma.event.update({
            where: { id: event.id },
            data: { calculatorToken: token },
          });
          console.log(\`Generated token for event \"\${event.name}\" (ID: \${event.id}): \${token}\`);
        }
        
        console.log('Done!');
      } catch (error) {
        console.error('Error:', error);
        process.exit(1);
      } finally {
        await prisma.\$disconnect();
      }
    })();
    "
fi

if [ $? -eq 0 ]; then
    echo ""
    echo "✓ Токены успешно сгенерированы!"
    
    # Показываем список событий с токенами
    echo ""
    echo "=== Список событий с токенами калькулятора ==="
    docker exec ftr_postgres psql -U ftr_user -d ftr_db -c "SELECT id, name, \"calculatorToken\" FROM \"Event\" ORDER BY id;" 2>/dev/null
else
    echo ""
    echo "❌ Ошибка при генерации токенов"
    exit 1
fi

echo ""
echo "=== Генерация завершена! ==="

