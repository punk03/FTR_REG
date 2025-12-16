#!/bin/bash

# Скрипт для безопасного обновления кода с сервера
# Решает конфликты с package-lock.json и другими файлами

set -e

echo "Проверка статуса git..."
git status

echo ""
echo "Сохранение локальных изменений в stash..."
git stash save "Auto-stash before pull $(date +%Y%m%d_%H%M%S)" || {
    echo "Предупреждение: не удалось сохранить изменения в stash (возможно, stash пуст)"
}

echo ""
echo "Получение обновлений из репозитория..."
git pull origin main || git pull origin master || {
    echo "Ошибка: не удалось выполнить pull"
    exit 1
}

echo ""
echo "Обновление зависимостей..."
if [ -f "package.json" ]; then
    echo "Обновление корневых зависимостей..."
    npm install --package-lock-only 2>/dev/null || true
fi

if [ -d "frontend" ] && [ -f "frontend/package.json" ]; then
    echo "Обновление зависимостей frontend..."
    cd frontend
    npm install --package-lock-only 2>/dev/null || true
    cd ..
fi

if [ -d "backend" ] && [ -f "backend/package.json" ]; then
    echo "Обновление зависимостей backend..."
    cd backend
    npm install --package-lock-only 2>/dev/null || true
    cd ..
fi

echo ""
echo "✓ Код успешно обновлен!"
echo ""
echo "Если нужно восстановить локальные изменения из stash:"
echo "  git stash list  # посмотреть список сохраненных изменений"
echo "  git stash pop   # восстановить последние изменения"

