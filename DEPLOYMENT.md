# Руководство по развертыванию FTR Registration System

## Автоматическое развертывание на Ubuntu 24

### Требования

- Ubuntu 24.04 LTS
- Права sudo
- Интернет-соединение

### Быстрый старт

1. **Клонируйте репозиторий** (если используете git):
```bash
git clone <repository-url>
cd ftr-registration-system
```

2. **Запустите скрипт развертывания**:
```bash
./deploy.sh
```

Скрипт автоматически:
- Установит Docker и Docker Compose (если не установлены)
- Создаст резервные копии базы данных (при обновлении)
- Сохранит конфигурационные файлы (.env)
- Установит зависимости
- Запустит миграции базы данных
- Соберет и запустит контейнеры

### Первое развертывание

При первом запуске скрипт:
1. Установит все необходимые компоненты
2. Создаст файлы конфигурации (.env)
3. Запустит базу данных и Redis
4. Выполнит миграции и заполнит базу тестовыми данными
5. Соберет и запустит приложение

**Демо-аккаунты после первого развертывания:**
- **ADMIN**: admin@ftr.ru / admin123
- **REGISTRATOR**: registrar@ftr.ru / registrar123
- **ACCOUNTANT**: accountant@ftr.ru / accountant123
- **STATISTICIAN**: statistician@ftr.ru / statistician123

### Обновление проекта

При повторном запуске скрипта из папки проекта:
1. Автоматически создаст резервную копию базы данных
2. Сохранит все файлы .env
3. Обновит код из git (если это git репозиторий)
4. Восстановит сохраненные .env файлы
5. Обновит зависимости
6. Выполнит новые миграции
7. Пересоберет и перезапустит контейнеры

**Важно:** Все данные сохраняются! Резервные копии БД хранятся в папке `./backups/`

### Ручное управление

#### Просмотр статуса контейнеров:
```bash
docker compose -f docker-compose.prod.yml ps
```

#### Просмотр логов:
```bash
# Все логи
docker compose -f docker-compose.prod.yml logs -f

# Логи backend
docker compose -f docker-compose.prod.yml logs -f backend

# Логи frontend
docker compose -f docker-compose.prod.yml logs -f frontend

# Логи базы данных
docker compose -f docker-compose.prod.yml logs -f postgres
```

#### Остановка сервисов:
```bash
docker compose -f docker-compose.prod.yml down
```

#### Перезапуск сервисов:
```bash
docker compose -f docker-compose.prod.yml restart
```

#### Восстановление из резервной копии:
```bash
# Найти резервную копию
ls -lh backups/

# Восстановить (замените backup_file.sql.gz на нужный файл)
gunzip < backups/backup_YYYYMMDD_HHMMSS.sql.gz | docker exec -i ftr_postgres psql -U ftr_user -d ftr_db
```

### Конфигурация

#### Переменные окружения Backend (backend/.env):
```env
DATABASE_URL="postgresql://ftr_user:ftr_password@postgres:5432/ftr_db?schema=public"
JWT_SECRET="your-secret-key"
JWT_REFRESH_SECRET="your-refresh-secret-key"
PORT=3001
NODE_ENV=production
REDIS_HOST=redis
REDIS_PORT=6379
CORS_ORIGIN="http://your-domain.com"
```

#### Переменные окружения Frontend (frontend/.env):
```env
VITE_API_URL=http://your-backend-url:3001
```

### Структура резервных копий

Резервные копии сохраняются в папке `./backups/`:
- Формат: `backup_YYYYMMDD_HHMMSS.sql.gz`
- Хранятся последние 5 копий
- Автоматически создаются перед обновлением

### Устранение неполадок

#### Проблема: Docker не запускается
```bash
sudo systemctl start docker
sudo systemctl enable docker
```

#### Проблема: Порты заняты
Измените порты в `docker-compose.prod.yml`:
- PostgreSQL: 5432
- Redis: 6379
- Backend: 3001
- Frontend: 80

#### Проблема: Миграции не выполняются
```bash
cd backend
npx prisma migrate deploy
npx prisma generate
```

#### Проблема: Контейнеры не запускаются
```bash
# Проверить логи
docker compose -f docker-compose.prod.yml logs

# Пересобрать контейнеры
docker compose -f docker-compose.prod.yml build --no-cache
docker compose -f docker-compose.prod.yml up -d
```

### Безопасность

⚠️ **Важно для production:**

1. Измените пароли в `docker-compose.prod.yml`:
   - `POSTGRES_PASSWORD`
   - `POSTGRES_USER`

2. Установите безопасные секреты в `backend/.env`:
   - `JWT_SECRET` (минимум 32 символа)
   - `JWT_REFRESH_SECRET` (минимум 32 символа)

3. Настройте файрвол:
```bash
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
sudo ufw enable
```

4. Используйте HTTPS (настройте reverse proxy с SSL):
   - Nginx с Let's Encrypt
   - Traefik
   - Cloudflare

5. Регулярно создавайте резервные копии:
```bash
# Ручное создание резервной копии
docker exec ftr_postgres pg_dump -U ftr_user -d ftr_db | gzip > backups/manual_backup_$(date +%Y%m%d_%H%M%S).sql.gz
```

### Мониторинг

#### Проверка использования ресурсов:
```bash
docker stats
```

#### Проверка места на диске:
```bash
docker system df
```

#### Очистка неиспользуемых ресурсов:
```bash
docker system prune -a
```

### Поддержка

При возникновении проблем:
1. Проверьте логи: `docker compose -f docker-compose.prod.yml logs`
2. Проверьте статус контейнеров: `docker compose -f docker-compose.prod.yml ps`
3. Убедитесь, что все порты свободны: `netstat -tulpn | grep LISTEN`


