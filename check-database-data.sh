#!/bin/bash

# Скрипт для проверки данных в БД

echo "=== Проверка данных в базе данных ==="
echo ""

# Проверяем, запущен ли контейнер PostgreSQL
if ! docker ps --format '{{.Names}}' | grep -q "^ftr_postgres$"; then
    echo "❌ Контейнер PostgreSQL не запущен!"
    echo "Запустите: docker-compose up -d postgres"
    exit 1
fi

echo "✓ Контейнер PostgreSQL запущен"
echo ""

# Проверяем подключение к БД
echo "Проверка подключения к БД..."
if docker exec ftr_postgres psql -U ftr_user -d ftr_db -c "SELECT 1" > /dev/null 2>&1; then
    echo "✓ Подключение к БД успешно"
else
    echo "❌ Не удалось подключиться к БД"
    exit 1
fi

echo ""
echo "=== Статистика данных ==="
echo ""

# Количество событий
EVENT_COUNT=$(docker exec ftr_postgres psql -U ftr_user -d ftr_db -t -c "SELECT COUNT(*) FROM \"Event\";" 2>/dev/null | tr -d ' ')
echo "Событий: ${EVENT_COUNT}"

# Количество регистраций
REG_COUNT=$(docker exec ftr_postgres psql -U ftr_user -d ftr_db -t -c "SELECT COUNT(*) FROM \"Registration\";" 2>/dev/null | tr -d ' ')
echo "Регистраций: ${REG_COUNT}"

# Количество регистраций по событиям
echo ""
echo "Регистрации по событиям:"
docker exec ftr_postgres psql -U ftr_user -d ftr_db -c "SELECT e.id, e.name, e.status, COUNT(r.id) as registrations_count FROM \"Event\" e LEFT JOIN \"Registration\" r ON e.id = r.\"eventId\" GROUP BY e.id, e.name, e.status ORDER BY e.\"createdAt\" DESC;" 2>/dev/null

# Количество платежей
PAYMENT_COUNT=$(docker exec ftr_postgres psql -U ftr_user -d ftr_db -t -c "SELECT COUNT(*) FROM \"AccountingEntry\" WHERE \"deletedAt\" IS NULL;" 2>/dev/null | tr -d ' ')
echo ""
echo "Активных платежей: ${PAYMENT_COUNT}"

# Последние регистрации
echo ""
echo "Последние 5 регистраций:"
docker exec ftr_postgres psql -U ftr_user -d ftr_db -c "SELECT r.id, r.\"danceName\", c.name as collective, e.name as event, r.\"createdAt\" FROM \"Registration\" r JOIN \"Collective\" c ON r.\"collectiveId\" = c.id JOIN \"Event\" e ON r.\"eventId\" = e.id ORDER BY r.\"createdAt\" DESC LIMIT 5;" 2>/dev/null

echo ""
echo "=== Проверка завершена ==="

