# Защита базы данных при обновлении

## Важно!

При обновлении системы база данных **НЕ должна** сбрасываться. Все данные должны сохраняться.

## Как это работает

### 1. Volumes Docker
База данных хранится в Docker volume `ftr_reg_postgres_data`. Этот volume **НЕ удаляется** при выполнении команды `docker-compose down` без флага `-v`.

### 2. Скрипт обновления
Скрипт `docker-manage.sh` использует команду:
```bash
docker-compose down  # БЕЗ флага -v
```

Это гарантирует, что volumes сохраняются.

### 3. Резервное копирование
Перед каждым обновлением автоматически создаётся резервная копия БД в директории `./backups/`.

## Что делать, если БД всё же сбросилась

### Восстановление из резервной копии

1. Найдите последнюю резервную копию в директории `./backups/`:
   ```bash
   ls -lt ./backups/db_backup_*.sql | head -1
   ```

2. Восстановите БД из резервной копии:
   ```bash
   docker exec -i ftr_postgres psql -U ftr_user -d ftr_db < ./backups/db_backup_YYYYMMDD_HHMMSS.sql
   ```

### Проверка существования volumes

Проверьте, существуют ли volumes:
```bash
docker volume ls | grep ftr_reg
```

Если volumes отсутствуют, они будут созданы заново при следующем запуске, но данные будут потеряны.

## Команды, которые НЕОБХОДИМО ИЗБЕГАТЬ

❌ **НИКОГДА не используйте:**
```bash
docker-compose down -v          # Удаляет volumes!
docker-compose down --volumes   # Удаляет volumes!
docker volume rm ftr_reg_postgres_data  # Удаляет volume напрямую!
```

✅ **Используйте только:**
```bash
docker-compose down              # Сохраняет volumes
docker-compose restart          # Перезапускает без удаления
```

## Автоматическая защита

Скрипт `docker-manage.sh` теперь включает:
1. ✅ Автоматическое создание резервных копий перед обновлением
2. ✅ Проверку существования volumes перед остановкой
3. ✅ Подтверждение перед обновлением
4. ✅ Явные предупреждения о сохранении данных

## Ручное создание резервной копии

Если нужно создать резервную копию вручную:
```bash
mkdir -p ./backups
docker exec ftr_postgres pg_dump -U ftr_user -d ftr_db > ./backups/db_backup_manual_$(date +%Y%m%d_%H%M%S).sql
```

## Восстановление из резервной копии

```bash
docker exec -i ftr_postgres psql -U ftr_user -d ftr_db < ./backups/db_backup_YYYYMMDD_HHMMSS.sql
```

