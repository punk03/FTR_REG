# Docker Setup для FTR Registration System

## Быстрый старт

### 1. Подготовка

Скопируйте файл `.env.example` в `.env` и настройте переменные окружения:

```bash
cp .env.example .env
# Отредактируйте .env файл, особенно JWT_SECRET и JWT_REFRESH_SECRET
```

### 2. Запуск всего проекта

```bash
# Сборка и запуск всех сервисов
docker-compose up -d --build

# Просмотр логов
docker-compose logs -f

# Остановка
docker-compose down

# Остановка с удалением volumes (ОСТОРОЖНО: удалит данные БД!)
docker-compose down -v
```

### 3. Применение миграций базы данных

Миграции применяются автоматически при запуске backend контейнера. Если нужно применить вручную:

```bash
# Войти в контейнер backend
docker-compose exec backend sh

# Применить миграции
npx prisma migrate deploy

# Сгенерировать Prisma Client
npx prisma generate

# Заполнить базу тестовыми данными (опционально)
npm run prisma:seed
```

### 4. Доступ к сервисам

- **Frontend**: http://localhost:3000
- **Backend API**: http://localhost:3001
- **PostgreSQL**: localhost:5432
- **Redis**: localhost:6379

## Разработка с Docker

Для разработки используйте `docker-compose.dev.yml`, который запускает только PostgreSQL и Redis:

```bash
# Запустить только БД и Redis
docker-compose -f docker-compose.dev.yml up -d

# Backend и Frontend запускать локально в dev режиме
cd backend && npm run dev
cd frontend && npm run dev
```

## Структура сервисов

### Backend
- **Порт**: 3001
- **Health check**: `/api/health` (если реализован)
- **Volumes**: 
  - `./backend/prisma` - для миграций
  - `backend_uploads` - для загруженных файлов

### Frontend
- **Порт**: 3000 (внутри контейнера 80)
- **Nginx**: проксирует `/api` на backend
- **SPA routing**: настроен через `try_files`

### PostgreSQL
- **Порт**: 5432
- **Данные**: сохраняются в volume `postgres_data`
- **Health check**: проверка готовности БД

### Redis
- **Порт**: 6379
- **Данные**: сохраняются в volume `redis_data`
- **Health check**: ping команда

## Переменные окружения

Основные переменные (см. `.env.example`):

- `POSTGRES_USER`, `POSTGRES_PASSWORD`, `POSTGRES_DB` - настройки БД
- `JWT_SECRET`, `JWT_REFRESH_SECRET` - секреты для JWT (ОБЯЗАТЕЛЬНО измените!)
- `CORS_ORIGIN` - разрешённые origins для CORS
- `VITE_API_URL` - URL backend API для frontend
- `EMAIL_*` - настройки email (опционально)

## Полезные команды

```bash
# Просмотр логов конкретного сервиса
docker-compose logs -f backend
docker-compose logs -f frontend

# Перезапуск сервиса
docker-compose restart backend

# Пересборка после изменений
docker-compose up -d --build backend

# Вход в контейнер
docker-compose exec backend sh
docker-compose exec postgres psql -U ftr_user -d ftr_db

# Просмотр использования ресурсов
docker stats

# Очистка неиспользуемых ресурсов
docker system prune -a
```

## Решение проблем

### Backend не запускается
1. Проверьте логи: `docker-compose logs backend`
2. Убедитесь, что БД готова: `docker-compose ps postgres`
3. Проверьте переменные окружения в `.env`

### Frontend не подключается к Backend
1. Проверьте `VITE_API_URL` в `.env`
2. Убедитесь, что backend запущен: `docker-compose ps backend`
3. Проверьте nginx конфигурацию

### База данных не создаётся
1. Проверьте логи PostgreSQL: `docker-compose logs postgres`
2. Убедитесь, что volume создан: `docker volume ls`
3. Попробуйте пересоздать: `docker-compose down -v && docker-compose up -d`

### Миграции не применяются
1. Войдите в контейнер backend: `docker-compose exec backend sh`
2. Проверьте подключение к БД: `npx prisma db pull`
3. Примените миграции вручную: `npx prisma migrate deploy`

