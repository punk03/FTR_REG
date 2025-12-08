# 🐳 Docker Setup - FTR Registration System

Полная инструкция по запуску проекта в Docker.

## 📋 Требования

- Docker 20.10+
- Docker Compose 2.0+
- Минимум 2GB свободной RAM
- Минимум 5GB свободного места на диске

## 🚀 Быстрый старт

### 1. Клонирование репозитория

```bash
git clone https://github.com/punk03/FTR_REG.git
cd FTR_REG
```

### 2. Настройка переменных окружения

```bash
cp .env.example .env
```

**ВАЖНО**: Отредактируйте `.env` файл и измените:
- `JWT_SECRET` - используйте сильный случайный ключ
- `JWT_REFRESH_SECRET` - используйте другой сильный случайный ключ
- `POSTGRES_PASSWORD` - установите надёжный пароль для БД

### 3. Запуск проекта

```bash
# Сборка и запуск всех контейнеров
docker-compose up -d --build

# Просмотр логов
docker-compose logs -f
```

### 4. Применение миграций и заполнение БД

Миграции применяются автоматически при первом запуске. Для заполнения тестовыми данными:

```bash
docker-compose exec backend npm run prisma:seed
```

### 5. Доступ к приложению

- **Frontend**: http://localhost:3000
- **Backend API**: http://localhost:3001
- **Swagger API Docs**: http://localhost:3001/api-docs (если настроен)

## 📁 Структура Docker

```
FTR_REG/
├── docker-compose.yml          # Основной файл для production
├── docker-compose.dev.yml      # Для разработки (только БД и Redis)
├── .env.example                # Пример переменных окружения
├── backend/
│   ├── Dockerfile              # Образ для backend
│   └── .dockerignore
├── frontend/
│   ├── Dockerfile              # Образ для frontend
│   ├── nginx.conf              # Конфигурация Nginx
│   └── .dockerignore
└── docker/
    └── README.md               # Дополнительная документация
```

## 🔧 Управление контейнерами

### Основные команды

```bash
# Запуск
docker-compose up -d

# Остановка
docker-compose down

# Перезапуск
docker-compose restart

# Просмотр статуса
docker-compose ps

# Просмотр логов
docker-compose logs -f [service_name]

# Пересборка после изменений
docker-compose up -d --build [service_name]
```

### Работа с базой данных

```bash
# Подключение к PostgreSQL
docker-compose exec postgres psql -U ftr_user -d ftr_db

# Резервное копирование БД
docker-compose exec postgres pg_dump -U ftr_user ftr_db > backup.sql

# Восстановление БД
docker-compose exec -T postgres psql -U ftr_user -d ftr_db < backup.sql

# Применение миграций вручную
docker-compose exec backend npx prisma migrate deploy

# Генерация Prisma Client
docker-compose exec backend npx prisma generate
```

## 🛠️ Разработка

Для разработки рекомендуется запускать только БД и Redis в Docker, а backend и frontend локально:

```bash
# Запустить только БД и Redis
docker-compose -f docker-compose.dev.yml up -d

# Backend локально (в отдельном терминале)
cd backend
npm install
npm run dev

# Frontend локально (в отдельном терминале)
cd frontend
npm install
npm run dev
```

## 🔒 Безопасность

### Production настройки

1. **Измените все секреты** в `.env`:
   - `JWT_SECRET`
   - `JWT_REFRESH_SECRET`
   - `POSTGRES_PASSWORD`

2. **Настройте CORS** правильно:
   ```env
   CORS_ORIGIN=https://yourdomain.com
   ```

3. **Используйте HTTPS** через reverse proxy (Nginx/Traefik)

4. **Ограничьте доступ** к портам БД и Redis (не публикуйте их наружу)

## 📊 Мониторинг

```bash
# Использование ресурсов
docker stats

# Логи всех сервисов
docker-compose logs -f

# Health checks
docker-compose ps
```

## 🐛 Решение проблем

### Контейнер не запускается

1. Проверьте логи: `docker-compose logs [service_name]`
2. Проверьте переменные окружения: `docker-compose config`
3. Проверьте порты: `netstat -tulpn | grep [port]`

### Backend не подключается к БД

1. Убедитесь, что PostgreSQL запущен: `docker-compose ps postgres`
2. Проверьте `DATABASE_URL` в `.env`
3. Проверьте логи: `docker-compose logs backend`

### Frontend показывает ошибки

1. Проверьте `VITE_API_URL` в `.env`
2. Убедитесь, что backend доступен: `curl http://localhost:3001/api/health`
3. Проверьте логи nginx: `docker-compose logs frontend`

### Очистка

```bash
# Остановить и удалить контейнеры
docker-compose down

# Удалить volumes (ОСТОРОЖНО: удалит данные БД!)
docker-compose down -v

# Полная очистка
docker system prune -a --volumes
```

## 📚 Дополнительная информация

- [Docker Compose документация](https://docs.docker.com/compose/)
- [Prisma с Docker](https://www.prisma.io/docs/guides/deployment/deployment-guides/deploying-to-docker)
- Подробности в `docker/README.md`

