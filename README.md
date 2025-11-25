# FTR Registration System

Система регистрации и бухгалтерского учета участников мероприятий Федерации танцев России

## Описание / Description

**Русский:**

Веб-приложение для автоматизации регистрации участников танцевальных мероприятий, управления оплатами, учета дипломов/медалей, бухгалтерского учета и статистики.

**English:**

Web application for automating registration of dance event participants, payment management, diploma/medal tracking, accounting, and statistics.

## Технологии / Technologies

- **Backend**: Node.js + Express + TypeScript + Prisma + PostgreSQL + Redis
- **Frontend**: React 18 + TypeScript + Vite + Material-UI
- **Database**: PostgreSQL 14+
- **Cache**: Redis
- **Deployment**: Docker + Docker Compose

## Структура проекта / Project Structure

```
ftr-registration-system/
├── backend/          # Backend API (Node.js + Express + TypeScript)
├── frontend/         # Frontend (React + TypeScript + Vite)
├── docker/           # Docker configuration files
└── docker-compose.yml
```

## Автоматическое обновление

Для автоматического обновления системы из GitHub используйте скрипт `update.sh`:

```bash
# Обновление от текущего пользователя
./update.sh

# Или от root (автоматически определит пользователя приложения)
sudo ./update.sh
```

Скрипт автоматически:
- Создает резервную копию базы данных
- Обновляет код из GitHub
- Пересобирает backend и frontend
- Применяет миграции базы данных
- Перезапускает сервисы
- Проверяет статус всех компонентов

## Быстрый старт / Quick Start

### Требования / Requirements

- Node.js 18+
- Docker и Docker Compose
- npm или yarn

### Установка на Ubuntu 24 (Production) / Installation on Ubuntu 24 (Production)

Для установки на сервер Ubuntu 24 используйте скрипт установки:

```bash
# Скачать и запустить скрипт установки
curl -fsSL https://raw.githubusercontent.com/punk03/FTR_REG/main/install.sh -o install.sh
chmod +x install.sh
./install.sh
```

Или клонировать и запустить вручную:

```bash
git clone https://github.com/punk03/FTR_REG.git ~/FTR_REG
cd ~/FTR_REG
chmod +x install.sh
./install.sh
```

Скрипт автоматически:
- Установит необходимые зависимости (Git, Docker и т.д.)
- Клонирует или обновит репозиторий с GitHub
- Установит правильные права доступа
- Запустит скрипт развертывания автоматически

Для обновления проекта в будущем просто запустите `./install.sh` снова.

### Установка для разработки / Development Installation

1. Клонируйте репозиторий / Clone the repository:
```bash
git clone https://github.com/punk03/FTR_REG.git
cd FTR_REG
```

2. Установите зависимости / Install dependencies:
```bash
npm install
```

3. Запустите базу данных и Redis / Start database and Redis:
```bash
docker-compose up -d
```

4. Настройте переменные окружения / Configure environment variables:
```bash
cp backend/.env.example backend/.env
cp frontend/.env.example frontend/.env
```

5. Запустите миграции / Run migrations:
```bash
cd backend
npx prisma migrate dev
npx prisma db seed
```

6. Запустите приложение / Start the application:
```bash
npm run dev
```

Backend будет доступен на http://localhost:3001
Frontend будет доступен на http://localhost:5173

## Демо-аккаунты / Demo Accounts

- **ADMIN**: admin@ftr.ru / admin123
- **REGISTRATOR**: registrar@ftr.ru / registrar123
- **ACCOUNTANT**: accountant@ftr.ru / accountant123
- **STATISTICIAN**: statistician@ftr.ru / statistician123

## Документация / Documentation

Подробная документация доступна в файле `TECHNICAL_SPECIFICATION.md`

Detailed documentation is available in `TECHNICAL_SPECIFICATION.md`

## Лицензия / License

ISC


