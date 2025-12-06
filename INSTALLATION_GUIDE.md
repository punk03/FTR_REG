# Руководство по установке FTR Registration System

Полное руководство по установке проекта из GitHub репозитория.

## 📋 Содержание

1. [Требования](#требования)
2. [Быстрая установка (автоматическая)](#быстрая-установка-автоматическая)
3. [Установка для разработки](#установка-для-разработки)
4. [Ручная установка](#ручная-установка)
5. [Настройка переменных окружения](#настройка-переменных-окружения)
6. [Запуск проекта](#запуск-проекта)
7. [Проверка работоспособности](#проверка-работоспособности)
8. [Обновление проекта](#обновление-проекта)
9. [Решение проблем](#решение-проблем)

---

## Требования

### Минимальные требования

- **ОС**: Ubuntu 20.04+ / macOS 10.15+ / Windows 10+
- **RAM**: 2 GB минимум (4 GB рекомендуется)
- **Диск**: 5 GB свободного места
- **Интернет**: для загрузки зависимостей

### Необходимое ПО

- **Git** 2.20+
- **Docker** 20.10+ и **Docker Compose** 2.0+
- **Node.js** 18+ и **npm** 9+
- **PostgreSQL** 14+ (или использование Docker)

---

## Быстрая установка (автоматическая)

### Для Ubuntu 24 (Production)

Самый простой способ установки на сервер Ubuntu:

```bash
# Скачать и запустить скрипт установки
curl -fsSL https://raw.githubusercontent.com/punk03/FTR_REG/main/install.sh -o install.sh
chmod +x install.sh
./install.sh
```

Или клонировать репозиторий и запустить:

```bash
git clone https://github.com/punk03/FTR_REG.git ~/FTR_REG
cd ~/FTR_REG
chmod +x install.sh
./install.sh
```

**Что делает скрипт:**
- ✅ Устанавливает Git, Docker, Node.js (если не установлены)
- ✅ Клонирует/обновляет репозиторий с GitHub
- ✅ Настраивает права доступа
- ✅ Запускает Docker контейнеры (PostgreSQL, Redis)
- ✅ Устанавливает зависимости (npm install)
- ✅ Применяет миграции базы данных
- ✅ Собирает backend и frontend
- ✅ Запускает приложение

**После установки:**
- Backend API: `http://your-server-ip:3001`
- Frontend: `http://your-server-ip:3000`
- PostgreSQL: `localhost:5432`
- Redis: `localhost:6379`

### Для обновления проекта

Просто запустите скрипт снова:

```bash
cd ~/FTR_REG
./install.sh
```

Скрипт автоматически:
- Создаст резервную копию базы данных
- Обновит код из GitHub
- Пересоберет приложение
- Применит новые миграции
- Перезапустит сервисы

---

## Установка для разработки

### 1. Клонирование репозитория

```bash
git clone https://github.com/punk03/FTR_REG.git
cd FTR_REG
```

### 2. Установка зависимостей

```bash
# Backend
cd backend
npm install
cd ..

# Frontend
cd frontend
npm install
cd ..
```

### 3. Запуск базы данных и Redis

```bash
# Запуск PostgreSQL и Redis в Docker
docker-compose up -d

# Проверка статуса
docker-compose ps
```

### 4. Настройка переменных окружения

Создайте файлы `.env` в `backend/` и `frontend/`:

**backend/.env:**
```env
# Database
DATABASE_URL="postgresql://ftr_user:ftr_password@localhost:5432/ftr_db?schema=public"

# JWT Secrets (сгенерируйте свои)
JWT_SECRET=your-secret-key-here-min-32-chars
JWT_REFRESH_SECRET=your-refresh-secret-key-here-min-32-chars

# Server
PORT=3001
NODE_ENV=development

# Redis
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=

# CORS (укажите ваш frontend URL)
CORS_ORIGIN=http://localhost:5173,http://localhost:3000
```

**frontend/.env:**
```env
VITE_API_URL=http://localhost:3001
VITE_MODE=development
```

### 5. Применение миграций и заполнение данных

```bash
cd backend

# Генерация Prisma Client
npx prisma generate

# Применение миграций
npx prisma migrate dev

# Заполнение базы тестовыми данными
npx prisma db seed
```

### 6. Запуск в режиме разработки

**Терминал 1 - Backend:**
```bash
cd backend
npm run dev
```

**Терминал 2 - Frontend:**
```bash
cd frontend
npm run dev
```

**Результат:**
- Backend: `http://localhost:3001`
- Frontend: `http://localhost:5173`

---

## Ручная установка

Если автоматические скрипты не подходят, выполните шаги вручную:

### Шаг 1: Установка зависимостей системы

**Ubuntu/Debian:**
```bash
sudo apt-get update
sudo apt-get install -y git curl

# Docker
curl -fsSL https://get.docker.com -o get-docker.sh
sudo sh get-docker.sh
sudo usermod -aG docker $USER
# Выйдите и войдите снова для применения изменений группы

# Node.js 20.x
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt-get install -y nodejs
```

**macOS:**
```bash
# Установите Homebrew если еще не установлен
/bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"

# Установите зависимости
brew install git docker node@20
brew services start docker
```

**Windows:**
- Установите [Git for Windows](https://git-scm.com/download/win)
- Установите [Docker Desktop](https://www.docker.com/products/docker-desktop)
- Установите [Node.js 20.x](https://nodejs.org/)

### Шаг 2: Клонирование репозитория

```bash
git clone https://github.com/punk03/FTR_REG.git
cd FTR_REG
```

### Шаг 3: Настройка базы данных

```bash
# Запуск PostgreSQL и Redis
docker-compose up -d

# Ожидание готовности PostgreSQL (около 10 секунд)
sleep 10

# Проверка подключения
docker exec ftr_postgres pg_isready -U ftr_user
```

### Шаг 4: Установка зависимостей проекта

```bash
# Backend
cd backend
npm install
npx prisma generate
cd ..

# Frontend
cd frontend
npm install
cd ..
```

### Шаг 5: Настройка переменных окружения

См. раздел [Настройка переменных окружения](#настройка-переменных-окружения)

### Шаг 6: Применение миграций

```bash
cd backend
npx prisma migrate deploy
npx prisma db seed
cd ..
```

### Шаг 7: Сборка проекта

```bash
# Backend
cd backend
npm run build
cd ..

# Frontend
cd frontend
npm run build
cd ..
```

### Шаг 8: Запуск приложения

**Вариант A: Production режим**

```bash
# Backend
cd backend
npm start
# Или в фоне: nohup npm start > ../backend.log 2>&1 &

# Frontend (используя serve)
cd frontend
npx serve -s dist -l 3000
# Или в фоне: nohup npx serve -s dist -l 3000 > ../frontend.log 2>&1 &
```

**Вариант B: Development режим**

```bash
# Backend (в отдельном терминале)
cd backend
npm run dev

# Frontend (в отдельном терминале)
cd frontend
npm run dev
```

---

## Настройка переменных окружения

### Backend (.env)

Создайте файл `backend/.env`:

```env
# База данных PostgreSQL
# Для миграций с хоста используйте localhost
# Для подключения из Docker контейнеров используйте postgres
DATABASE_URL="postgresql://ftr_user:ftr_password@localhost:5432/ftr_db?schema=public"

# JWT секреты (обязательно измените!)
# Генерация: openssl rand -hex 32
JWT_SECRET=ваш-секретный-ключ-минимум-32-символа
JWT_REFRESH_SECRET=ваш-рефреш-секрет-минимум-32-символа

# Порт сервера
PORT=3001

# Окружение
NODE_ENV=production

# Redis
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=

# CORS (укажите все домены, с которых будет доступ)
CORS_ORIGIN=http://your-domain.com,http://your-ip:3000,http://localhost:5173
```

**Генерация секретов:**
```bash
openssl rand -hex 32
```

### Frontend (.env)

Создайте файл `frontend/.env`:

```env
# URL backend API
VITE_API_URL=http://your-server-ip:3001

# Режим работы
VITE_MODE=production
```

**Для разработки:**
```env
VITE_API_URL=http://localhost:3001
VITE_MODE=development
```

---

## Запуск проекта

### Автоматический запуск (через скрипты)

После установки через `install.sh`, приложение запускается автоматически.

### Ручной запуск

**Production:**
```bash
# Запуск Docker сервисов
docker-compose up -d

# Backend
cd backend
npm start

# Frontend (в другом терминале)
cd frontend
npx serve -s dist -l 3000
```

**Development:**
```bash
# Запуск Docker сервисов
docker-compose up -d

# Backend (терминал 1)
cd backend
npm run dev

# Frontend (терминал 2)
cd frontend
npm run dev
```

### Использование systemd (Linux)

Создайте сервисы для автоматического запуска:

**`/etc/systemd/system/ftr-backend.service`:**
```ini
[Unit]
Description=FTR Registration System Backend
After=network.target docker.service

[Service]
Type=simple
User=ftr
WorkingDirectory=/home/ftr/FTR_REG/backend
ExecStart=/usr/bin/npm start
Restart=always
RestartSec=10
Environment=NODE_ENV=production

[Install]
WantedBy=multi-user.target
```

**`/etc/systemd/system/ftr-frontend.service`:**
```ini
[Unit]
Description=FTR Registration System Frontend
After=network.target

[Service]
Type=simple
User=ftr
WorkingDirectory=/home/ftr/FTR_REG/frontend
ExecStart=/usr/bin/npx serve -s dist -l 3000
Restart=always
RestartSec=10

[Install]
WantedBy=multi-user.target
```

**Активация:**
```bash
sudo systemctl daemon-reload
sudo systemctl enable ftr-backend ftr-frontend
sudo systemctl start ftr-backend ftr-frontend
```

---

## Проверка работоспособности

### 1. Проверка Docker контейнеров

```bash
docker-compose ps
```

Должны быть запущены:
- `ftr_postgres` (PostgreSQL)
- `ftr_redis` (Redis)

### 2. Проверка Backend API

```bash
# Проверка здоровья API
curl http://localhost:3001/api/health

# Проверка справочников
curl http://localhost:3001/api/reference/disciplines
```

### 3. Проверка Frontend

Откройте в браузере:
- `http://localhost:3000` (production)
- `http://localhost:5173` (development)

### 4. Проверка базы данных

```bash
# Подключение к PostgreSQL
docker exec -it ftr_postgres psql -U ftr_user -d ftr_db

# Проверка таблиц
\dt

# Проверка пользователей
SELECT email, role FROM "User";
```

### 5. Тестовые учетные данные

После применения seed данных доступны:

- **ADMIN**: `admin@ftr.ru` / `admin123`
- **REGISTRATOR**: `registrar@ftr.ru` / `registrar123`
- **ACCOUNTANT**: `accountant@ftr.ru` / `accountant123`
- **STATISTICIAN**: `statistician@ftr.ru` / `statistician123`

**⚠️ ВАЖНО:** Смените пароли после первой установки!

---

## Обновление проекта

### Автоматическое обновление

```bash
cd ~/FTR_REG
./install.sh
```

### Ручное обновление

```bash
cd ~/FTR_REG

# Создание резервной копии БД
docker exec ftr_postgres pg_dump -U ftr_user -d ftr_db > backup_$(date +%Y%m%d_%H%M%S).sql

# Обновление кода
git pull origin main

# Пересборка
cd backend && npm install && npm run build && cd ..
cd frontend && npm install && npm run build && cd ..

# Применение миграций
cd backend && npx prisma migrate deploy && cd ..

# Перезапуск
# Остановите старые процессы и запустите заново
```

---

## Решение проблем

### Проблема: "Permission denied" при запуске скриптов

**Решение:**
```bash
chmod +x install.sh deploy.sh
```

### Проблема: Docker требует sudo

**Решение:**
```bash
sudo usermod -aG docker $USER
# Выйдите и войдите снова
newgrp docker
```

### Проблема: Порт уже занят

**Решение:**
```bash
# Проверка занятых портов
sudo lsof -i :3000
sudo lsof -i :3001
sudo lsof -i :5432

# Остановка процессов или изменение портов в .env
```

### Проблема: Ошибка подключения к базе данных

**Решение:**
```bash
# Проверка статуса PostgreSQL
docker-compose ps
docker logs ftr_postgres

# Перезапуск контейнеров
docker-compose restart postgres
```

### Проблема: Prisma миграции не применяются

**Решение:**
```bash
cd backend

# Сброс базы данных (⚠️ удалит все данные!)
npx prisma migrate reset

# Или принудительное применение
npx prisma migrate deploy --force
```

### Проблема: Frontend не подключается к Backend

**Решение:**
1. Проверьте `VITE_API_URL` в `frontend/.env`
2. Проверьте `CORS_ORIGIN` в `backend/.env`
3. Убедитесь, что Backend запущен и доступен
4. Проверьте файрвол (порты 3000, 3001 должны быть открыты)

### Проблема: Ошибки при сборке

**Решение:**
```bash
# Очистка кэша и переустановка зависимостей
cd backend
rm -rf node_modules package-lock.json
npm install
npm run build

cd ../frontend
rm -rf node_modules package-lock.json
npm install
npm run build
```

---

## Дополнительная информация

### Структура проекта

```
FTR_REG/
├── backend/              # Backend API
│   ├── src/             # Исходный код
│   ├── prisma/         # Схема БД и миграции
│   └── package.json
├── frontend/            # Frontend приложение
│   ├── src/            # Исходный код
│   └── package.json
├── docker-compose.yml   # Docker конфигурация
├── install.sh          # Скрипт установки
├── deploy.sh           # Скрипт развертывания
└── README.md           # Основная документация
```

### Полезные команды

```bash
# Просмотр логов
tail -f backend.log
tail -f frontend.log
docker-compose logs -f

# Остановка всех сервисов
docker-compose down
pkill -f "node.*backend"
pkill -f "serve.*frontend"

# Очистка Docker
docker-compose down -v  # ⚠️ удалит данные БД!
docker system prune -a
```

### Поддержка

Если возникли проблемы:
1. Проверьте логи: `backend.log`, `frontend.log`, `docker-compose logs`
2. Убедитесь, что все требования выполнены
3. Проверьте переменные окружения
4. Создайте issue на GitHub: https://github.com/punk03/FTR_REG/issues

---

**Успешной установки! 🚀**

