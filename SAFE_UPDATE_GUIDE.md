# Безопасное обновление системы без потери данных БД

## Проблема
При обновлении через `docker-compose down` база данных может быть удалена, даже если не используется флаг `-v`.

## Решение
Используется более безопасный подход с явными именами volumes и командой `stop` вместо `down`.

## Изменения

### 1. Явные имена volumes в docker-compose.yml
Volumes теперь имеют явные имена:
- `ftr_reg_postgres_data` - для PostgreSQL
- `ftr_reg_redis_data` - для Redis  
- `ftr_reg_backend_uploads` - для загрузок

Это гарантирует, что volumes не будут случайно удалены или пересозданы.

### 2. Использование `docker-compose stop` вместо `down`
- `docker-compose stop` - только останавливает контейнеры, НЕ удаляет их и volumes
- `docker-compose down` - удаляет контейнеры (но не volumes, если нет флага -v)

### 3. Поэтапная пересборка
1. Останавливаем контейнеры через `stop`
2. Пересобираем только backend и frontend (не трогаем postgres)
3. Запускаем все сервисы (postgres переиспользуется)

## Процесс безопасного обновления

### Автоматический (через скрипт)
```bash
./docker-manage.sh
# Выбрать опцию 3 или 4
```

Скрипт автоматически:
1. ✅ Создаёт резервную копию БД
2. ✅ Проверяет существование volumes
3. ✅ Использует `stop` вместо `down`
4. ✅ Пересобирает только нужные контейнеры
5. ✅ Проверяет сохранность volumes после остановки

### Ручной способ

#### Шаг 1: Резервная копия БД
```bash
mkdir -p ./backups
docker exec ftr_postgres pg_dump -U ftr_user -d ftr_db > ./backups/db_backup_$(date +%Y%m%d_%H%M%S).sql
```

#### Шаг 2: Остановка контейнеров (БЕЗ удаления)
```bash
docker-compose stop
# или
docker compose stop
```

#### Шаг 3: Пересборка только backend и frontend
```bash
docker-compose build backend frontend
# или
docker compose build backend frontend
```

#### Шаг 4: Запуск всех сервисов
```bash
docker-compose up -d
# или
docker compose up -d
```

## Проверка сохранности данных

### Проверка volumes
```bash
docker volume ls | grep ftr_reg
```

Должны быть видны:
- `ftr_reg_postgres_data`
- `ftr_reg_redis_data`
- `ftr_reg_backend_uploads`

### Проверка данных в БД
```bash
docker exec ftr_postgres psql -U ftr_user -d ftr_db -c "SELECT COUNT(*) FROM \"Event\";"
```

## Восстановление из резервной копии

Если данные всё же потеряны:

```bash
# Найти последнюю резервную копию
ls -lt ./backups/db_backup_*.sql | head -1

# Восстановить БД
docker exec -i ftr_postgres psql -U ftr_user -d ftr_db < ./backups/db_backup_YYYYMMDD_HHMMSS.sql
```

## Команды, которые НИКОГДА не использовать

❌ **ОПАСНО - удаляют volumes:**
```bash
docker-compose down -v
docker-compose down --volumes
docker volume rm ftr_reg_postgres_data
docker-compose rm -v
```

❌ **ОПАСНО - могут удалить контейнеры:**
```bash
docker-compose down  # Удаляет контейнеры (volumes сохраняются, но лучше использовать stop)
```

✅ **БЕЗОПАСНО:**
```bash
docker-compose stop          # Только останавливает
docker-compose restart       # Перезапускает
docker-compose up -d         # Запускает/пересоздаёт только если нужно
```

## Дополнительная защита

### Блокировка удаления volumes
Можно добавить в `.env` или использовать внешние volumes:
```yaml
volumes:
  postgres_data:
    external: true
    name: ftr_reg_postgres_data
```

Но это требует предварительного создания volume вручную.

## Мониторинг

После каждого обновления проверяйте:
1. Существование volumes: `docker volume ls | grep ftr_reg`
2. Данные в БД: `docker exec ftr_postgres psql -U ftr_user -d ftr_db -c "\dt"`
3. Логи: `docker-compose logs postgres`

