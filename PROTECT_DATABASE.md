# Защита базы данных при обновлениях

## Важно

При обновлении через Docker Management Script (`docker-manage.sh`) данные базы данных **НЕ удаляются**.

## Как это работает

### Docker Volumes сохраняются

В `docker-compose.yml` определены volumes:
- `postgres_data` - данные PostgreSQL
- `redis_data` - данные Redis  
- `backend_uploads` - загруженные файлы

Эти volumes **НЕ удаляются** при выполнении `docker-compose down` без флага `-v`.

### Команды, которые НЕ удаляют данные

✅ **Безопасные команды (данные сохраняются):**
```bash
docker-compose down          # Останавливает контейнеры, volumes сохраняются
docker-compose restart       # Перезапускает контейнеры, volumes сохраняются
docker-compose up -d --build # Пересобирает и запускает, volumes сохраняются
```

❌ **Опасные команды (удаляют данные):**
```bash
docker-compose down -v      # ⚠️ УДАЛИТ volumes и все данные БД!
docker-compose down --volumes # ⚠️ УДАЛИТ volumes и все данные БД!
docker volume rm postgres_data # ⚠️ УДАЛИТ данные БД!
```

## Что делает docker-manage.sh

Скрипт `docker-manage.sh` использует **только безопасные команды**:

1. **Функция `install_updates()`:**
   - Использует `docker-compose down` (без `-v`)
   - Volumes сохраняются
   - Данные БД не теряются

2. **Функция `quick_update()`:**
   - Вызывает `install_updates()`
   - Данные БД сохраняются

3. **Остановка контейнеров (пункт 7 меню):**
   - Использует `docker-compose down` (без `-v`)
   - Данные БД сохраняются

## Проверка сохранности данных

После обновления проверьте:

```bash
# Проверьте, что volume существует
docker volume ls | grep postgres_data

# Проверьте содержимое БД
docker-compose exec postgres psql -U ftr_user -d ftr_db -c "SELECT COUNT(*) FROM users;"
```

## Резервное копирование

Хотя данные сохраняются при обновлениях, рекомендуется делать резервные копии:

```bash
# Создать резервную копию БД
docker-compose exec postgres pg_dump -U ftr_user ftr_db > backup_$(date +%Y%m%d_%H%M%S).sql

# Или использовать встроенную функцию в manage.sh
./manage.sh
# Выберите: Database → Backup
```

## Если нужно полностью пересоздать БД

⚠️ **ВНИМАНИЕ:** Это удалит все данные!

```bash
# Только если действительно нужно удалить все данные
docker-compose down -v
docker-compose up -d
```

## Итог

✅ При обновлении через `docker-manage.sh` данные БД **сохраняются**  
✅ Volumes не удаляются автоматически  
✅ Можно безопасно обновлять систему без потери данных

