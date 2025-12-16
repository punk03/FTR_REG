#!/bin/bash

# Простой скрипт для решения конфликта с package-lock.json при git pull

set -e

echo "=== Решение конфликта git pull ==="
echo ""

# Проверяем, есть ли незакоммиченные изменения
if git diff-index --quiet HEAD --; then
    echo "Нет незакоммиченных изменений, выполняем pull..."
    git pull origin main || git pull origin master
    echo "✓ Готово!"
    exit 0
fi

echo "Обнаружены незакоммиченные изменения:"
git status --short

echo ""
echo "Сохраняем изменения в stash..."
git stash push -m "Auto-stash before pull $(date +%Y%m%d_%H%M%S)" || {
    echo "Предупреждение: stash не удался, пробуем отбросить изменения в package-lock.json..."
    git checkout -- package-lock.json 2>/dev/null || true
}

echo ""
echo "Выполняем pull..."
git pull origin main || git pull origin master || {
    echo "Ошибка при pull. Пробуем принудительно отбросить локальные изменения в package-lock.json..."
    git checkout HEAD -- package-lock.json 2>/dev/null || true
    git pull origin main || git pull origin master
}

echo ""
echo "✓ Код успешно обновлен!"
echo ""
echo "Если нужно восстановить сохраненные изменения:"
echo "  git stash list"
echo "  git stash pop"

