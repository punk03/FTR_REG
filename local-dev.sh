#!/bin/bash

# Цвета для вывода
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Функция для отображения заголовка
show_header() {
    clear
    echo -e "${BLUE}========================================${NC}"
    echo -e "${BLUE}   Local Development Management Script${NC}"
    echo -e "${BLUE}========================================${NC}"
    echo ""
}

# Функция для проверки наличия Node.js
check_node() {
    if ! command -v node &> /dev/null; then
        echo -e "${RED}Ошибка: Node.js не установлен!${NC}"
        echo -e "${YELLOW}Установите Node.js версии 18 или выше: https://nodejs.org/${NC}"
        exit 1
    fi
    
    NODE_VERSION=$(node -v | cut -d'v' -f2 | cut -d'.' -f1)
    if [ "$NODE_VERSION" -lt 18 ]; then
        echo -e "${RED}Ошибка: Требуется Node.js версии 18 или выше!${NC}"
        echo -e "${YELLOW}Текущая версия: $(node -v)${NC}"
        exit 1
    fi
    
    echo -e "${GREEN}✓ Node.js установлен: $(node -v)${NC}"
}

# Функция для проверки наличия npm
check_npm() {
    if ! command -v npm &> /dev/null; then
        echo -e "${RED}Ошибка: npm не установлен!${NC}"
        exit 1
    fi
    echo -e "${GREEN}✓ npm установлен: $(npm -v)${NC}"
}

# Функция для проверки наличия PostgreSQL
check_postgres() {
    if command -v psql &> /dev/null; then
        echo -e "${GREEN}✓ PostgreSQL установлен локально${NC}"
        return 0
    elif docker ps --format '{{.Names}}' | grep -q "^ftr_postgres$\|^postgres$"; then
        echo -e "${GREEN}✓ PostgreSQL запущен в Docker${NC}"
        return 0
    else
        echo -e "${YELLOW}⚠ PostgreSQL не найден локально${NC}"
        echo -e "${YELLOW}⚠ Убедитесь, что PostgreSQL установлен или запущен в Docker${NC}"
        return 1
    fi
}

# Функция для проверки наличия Redis
check_redis() {
    if command -v redis-cli &> /dev/null; then
        if redis-cli ping &> /dev/null; then
            echo -e "${GREEN}✓ Redis установлен и запущен локально${NC}"
            return 0
        fi
    elif docker ps --format '{{.Names}}' | grep -q "^ftr_redis$\|^redis$"; then
        echo -e "${GREEN}✓ Redis запущен в Docker${NC}"
        return 0
    else
        echo -e "${YELLOW}⚠ Redis не найден локально${NC}"
        echo -e "${YELLOW}⚠ Убедитесь, что Redis установлен или запущен в Docker${NC}"
        return 1
    fi
}

# Функция для проверки наличия git
check_git() {
    if ! command -v git &> /dev/null; then
        echo -e "${RED}Ошибка: git не установлен!${NC}"
        exit 1
    fi
}

# Функция для установки зависимостей
install_dependencies() {
    show_header
    echo -e "${GREEN}=== Установка зависимостей ===${NC}"
    echo ""
    
    echo -e "${YELLOW}Установка зависимостей backend...${NC}"
    cd backend
    if [ -f package-lock.json ]; then
        npm ci
    else
        npm install
    fi
    
    if [ $? -ne 0 ]; then
        echo -e "${RED}✗ Ошибка при установке зависимостей backend!${NC}"
        cd ..
        read -p "Нажмите Enter для продолжения..."
        return 1
    fi
    echo -e "${GREEN}✓ Зависимости backend установлены${NC}"
    cd ..
    
    echo ""
    echo -e "${YELLOW}Установка зависимостей frontend...${NC}"
    cd frontend
    if [ -f package-lock.json ]; then
        npm ci
    else
        npm install
    fi
    
    if [ $? -ne 0 ]; then
        echo -e "${RED}✗ Ошибка при установке зависимостей frontend!${NC}"
        cd ..
        read -p "Нажмите Enter для продолжения..."
        return 1
    fi
    echo -e "${GREEN}✓ Зависимости frontend установлены${NC}"
    cd ..
    
    echo ""
    echo -e "${GREEN}✓ Все зависимости установлены${NC}"
    read -p "Нажмите Enter для продолжения..."
}

# Функция для настройки базы данных
setup_database() {
    show_header
    echo -e "${GREEN}=== Настройка базы данных ===${NC}"
    echo ""
    
    # Проверяем наличие .env файла в backend
    if [ ! -f backend/.env ]; then
        echo -e "${YELLOW}Файл backend/.env не найден. Создаю шаблон...${NC}"
        cat > backend/.env << 'ENVEOF'
# Database
DATABASE_URL="postgresql://ftr_user:ftr_password@localhost:5432/ftr_db?schema=public"

# Redis
REDIS_URL="redis://localhost:6379"

# JWT
JWT_SECRET="change-this-secret-in-production"
JWT_REFRESH_SECRET="change-this-refresh-secret-in-production"

# Server
PORT=3001
NODE_ENV=development

# CORS
CORS_ORIGIN="http://localhost:5173,http://localhost:3000"

# Email (опционально)
SMTP_HOST=""
SMTP_PORT=""
SMTP_USER=""
SMTP_PASS=""
ENVEOF
        echo -e "${GREEN}✓ Создан файл backend/.env${NC}"
        echo -e "${YELLOW}⚠ ВАЖНО: Отредактируйте backend/.env с правильными настройками БД!${NC}"
        echo ""
    fi
    
    # Проверяем подключение к БД
    echo -e "${YELLOW}Проверка подключения к базе данных...${NC}"
    cd backend
    
    # Генерируем Prisma Client
    echo -e "${YELLOW}Генерация Prisma Client...${NC}"
    npx prisma generate --schema=prisma/schema.prisma
    
    if [ $? -ne 0 ]; then
        echo -e "${RED}✗ Ошибка при генерации Prisma Client!${NC}"
        cd ..
        read -p "Нажмите Enter для продолжения..."
        return 1
    fi
    
    echo -e "${GREEN}✓ Prisma Client сгенерирован${NC}"
    
    # Применяем миграции
    echo ""
    echo -e "${YELLOW}Применение миграций базы данных...${NC}"
    npx prisma migrate deploy --schema=prisma/schema.prisma 2>/dev/null || {
        echo -e "${YELLOW}⚠ Миграции не применены автоматически${NC}"
        echo -e "${YELLOW}Попытка использовать db push...${NC}"
        npx prisma db push --schema=prisma/schema.prisma --accept-data-loss || {
            echo -e "${RED}✗ Ошибка при применении миграций!${NC}"
            echo -e "${YELLOW}Проверьте подключение к базе данных в backend/.env${NC}"
            cd ..
            read -p "Нажмите Enter для продолжения..."
            return 1
        }
    }
    
    echo -e "${GREEN}✓ Миграции применены${NC}"
    cd ..
    
    echo ""
    echo -e "${GREEN}✓ База данных настроена${NC}"
    read -p "Нажмите Enter для продолжения..."
}

# Функция для запуска всех сервисов
start_services() {
    show_header
    echo -e "${GREEN}=== Запуск сервисов ===${NC}"
    echo ""
    
    # Проверяем, что зависимости установлены
    if [ ! -d "backend/node_modules" ] || [ ! -d "frontend/node_modules" ]; then
        echo -e "${YELLOW}Зависимости не установлены. Устанавливаю...${NC}"
        install_dependencies
    fi
    
    # Проверяем настройку БД
    if [ ! -f "backend/.env" ]; then
        echo -e "${YELLOW}База данных не настроена. Настраиваю...${NC}"
        setup_database
    fi
    
    echo -e "${YELLOW}Запуск backend и frontend в режиме разработки...${NC}"
    echo -e "${BLUE}Backend будет доступен на http://localhost:3001${NC}"
    echo -e "${BLUE}Frontend будет доступен на http://localhost:5173${NC}"
    echo ""
    echo -e "${YELLOW}Нажмите Ctrl+C для остановки всех сервисов${NC}"
    echo ""
    
    # Запускаем через npm scripts из корня проекта
    npm run dev
}

# Функция для запуска только backend
start_backend() {
    show_header
    echo -e "${GREEN}=== Запуск Backend ===${NC}"
    echo ""
    
    if [ ! -d "backend/node_modules" ]; then
        echo -e "${YELLOW}Зависимости не установлены. Устанавливаю...${NC}"
        cd backend
        npm install
        cd ..
    fi
    
    if [ ! -f "backend/.env" ]; then
        echo -e "${YELLOW}Файл backend/.env не найден. Настраиваю...${NC}"
        setup_database
    fi
    
    echo -e "${YELLOW}Запуск backend в режиме разработки...${NC}"
    echo -e "${BLUE}Backend будет доступен на http://localhost:3001${NC}"
    echo ""
    echo -e "${YELLOW}Нажмите Ctrl+C для остановки${NC}"
    echo ""
    
    cd backend
    npm run dev
    cd ..
}

# Функция для запуска только frontend
start_frontend() {
    show_header
    echo -e "${GREEN}=== Запуск Frontend ===${NC}"
    echo ""
    
    if [ ! -d "frontend/node_modules" ]; then
        echo -e "${YELLOW}Зависимости не установлены. Устанавливаю...${NC}"
        cd frontend
        npm install
        cd ..
    fi
    
    echo -e "${YELLOW}Запуск frontend в режиме разработки...${NC}"
    echo -e "${BLUE}Frontend будет доступен на http://localhost:5173${NC}"
    echo ""
    echo -e "${YELLOW}Нажмите Ctrl+C для остановки${NC}"
    echo ""
    
    cd frontend
    npm run dev
    cd ..
}

# Функция для сборки проекта
build_project() {
    show_header
    echo -e "${GREEN}=== Сборка проекта ===${NC}"
    echo ""
    
    echo -e "${YELLOW}Сборка backend...${NC}"
    cd backend
    npm run build
    
    if [ $? -ne 0 ]; then
        echo -e "${RED}✗ Ошибка при сборке backend!${NC}"
        cd ..
        read -p "Нажмите Enter для продолжения..."
        return 1
    fi
    echo -e "${GREEN}✓ Backend собран${NC}"
    cd ..
    
    echo ""
    echo -e "${YELLOW}Сборка frontend...${NC}"
    cd frontend
    npm run build
    
    if [ $? -ne 0 ]; then
        echo -e "${RED}✗ Ошибка при сборке frontend!${NC}"
        cd ..
        read -p "Нажмите Enter для продолжения..."
        return 1
    fi
    echo -e "${GREEN}✓ Frontend собран${NC}"
    cd ..
    
    echo ""
    echo -e "${GREEN}✓ Проект успешно собран${NC}"
    read -p "Нажмите Enter для продолжения..."
}

# Функция для обновления из репозитория
update_repository() {
    show_header
    echo -e "${GREEN}=== Обновление из репозитория ===${NC}"
    echo ""
    
    if [ ! -d .git ]; then
        echo -e "${RED}Ошибка: текущая директория не является git репозиторием!${NC}"
        read -p "Нажмите Enter для продолжения..."
        return
    fi
    
    echo -e "${YELLOW}Текущая ветка:${NC}"
    git branch --show-current
    
    echo ""
    echo -e "${YELLOW}Проверка изменений в удалённом репозитории...${NC}"
    git fetch origin
    
    LOCAL=$(git rev-parse @)
    REMOTE=$(git rev-parse @{u} 2>/dev/null || echo "")
    
    if [ -z "$REMOTE" ]; then
        echo -e "${YELLOW}Удалённая ветка не настроена. Выполняю git pull...${NC}"
        git pull origin $(git branch --show-current) || {
            echo -e "${RED}Ошибка при выполнении git pull!${NC}"
            read -p "Нажмите Enter для продолжения..."
            return
        }
    elif [ "$LOCAL" = "$REMOTE" ]; then
        echo -e "${GREEN}✓ Репозиторий уже обновлён, изменений нет${NC}"
    else
        echo -e "${YELLOW}Обнаружены изменения. Выполняю git pull...${NC}"
        git pull origin $(git branch --show-current) || {
            echo -e "${RED}Ошибка при выполнении git pull!${NC}"
            read -p "Нажмите Enter для продолжения..."
            return
        }
        echo -e "${GREEN}✓ Репозиторий успешно обновлён${NC}"
    fi
    
    echo ""
    echo -e "${GREEN}Последние коммиты:${NC}"
    git --no-pager log --oneline -5
    
    echo ""
    read -p "Нажмите Enter для продолжения..."
}

# Функция для быстрого обновления
quick_update() {
    show_header
    echo -e "${GREEN}=== Быстрое обновление ===${NC}"
    echo ""
    
    echo -e "${YELLOW}Шаг 1: Обновление репозитория...${NC}"
    update_repository_silent
    
    echo ""
    echo -e "${YELLOW}Шаг 2: Установка зависимостей...${NC}"
    install_dependencies
    
    echo ""
    echo -e "${YELLOW}Шаг 3: Применение миграций БД...${NC}"
    cd backend
    npx prisma generate --schema=prisma/schema.prisma
    npx prisma migrate deploy --schema=prisma/schema.prisma 2>/dev/null || npx prisma db push --schema=prisma/schema.prisma --accept-data-loss
    cd ..
    
    echo ""
    echo -e "${GREEN}✓ Обновление завершено${NC}"
    read -p "Нажмите Enter для продолжения..."
}

# Тихая версия обновления репозитория
update_repository_silent() {
    if [ ! -d .git ]; then
        echo -e "${RED}Ошибка: текущая директория не является git репозиторием!${NC}"
        return 1
    fi
    
    git fetch origin
    LOCAL=$(git rev-parse @)
    REMOTE=$(git rev-parse @{u} 2>/dev/null || echo "")
    
    if [ -z "$REMOTE" ]; then
        git pull origin $(git branch --show-current) || return 1
    elif [ "$LOCAL" != "$REMOTE" ]; then
        git pull origin $(git branch --show-current) || return 1
        echo -e "${GREEN}✓ Репозиторий обновлён${NC}"
    else
        echo -e "${GREEN}✓ Репозиторий уже актуален${NC}"
    fi
}

# Функция для просмотра статуса процессов
check_status() {
    show_header
    echo -e "${GREEN}=== Статус процессов ===${NC}"
    echo ""
    
    echo -e "${YELLOW}Процессы Node.js:${NC}"
    ps aux | grep -E "node|tsx|vite" | grep -v grep || echo "Нет запущенных процессов"
    
    echo ""
    echo -e "${YELLOW}Порты:${NC}"
    echo -e "Backend (3001): $(lsof -ti:3001 > /dev/null 2>&1 && echo -e "${GREEN}занят${NC}" || echo -e "${RED}свободен${NC}")"
    echo -e "Frontend (5173): $(lsof -ti:5173 > /dev/null 2>&1 && echo -e "${GREEN}занят${NC}" || echo -e "${RED}свободен${NC}")"
    
    echo ""
    read -p "Нажмите Enter для продолжения..."
}

# Функция для остановки всех процессов
stop_services() {
    show_header
    echo -e "${YELLOW}Остановка всех процессов...${NC}"
    
    # Останавливаем процессы на портах 3001 и 5173
    lsof -ti:3001 | xargs kill -9 2>/dev/null
    lsof -ti:5173 | xargs kill -9 2>/dev/null
    
    # Останавливаем все процессы node/tsx/vite связанные с проектом
    pkill -f "tsx watch.*backend" 2>/dev/null
    pkill -f "vite.*frontend" 2>/dev/null
    pkill -f "node.*dist/index.js" 2>/dev/null
    
    echo -e "${GREEN}✓ Процессы остановлены${NC}"
    sleep 2
}

# Главное меню
main_menu() {
    while true; do
        show_header
        echo -e "${GREEN}Главное меню:${NC}"
        echo ""
        echo "1) Установить зависимости (backend + frontend)"
        echo "2) Настроить базу данных (Prisma миграции)"
        echo "3) Запустить все сервисы (backend + frontend)"
        echo "4) Запустить только backend"
        echo "5) Запустить только frontend"
        echo "6) Собрать проект (production build)"
        echo "7) Обновить данные из репозитория"
        echo "8) Быстрое обновление (репозиторий + зависимости + миграции)"
        echo "9) Статус процессов"
        echo "10) Остановить все процессы"
        echo "0) Выход"
        echo ""
        read -p "Ваш выбор: " choice
        
        case $choice in
            1)
                install_dependencies
                ;;
            2)
                setup_database
                ;;
            3)
                start_services
                ;;
            4)
                start_backend
                ;;
            5)
                start_frontend
                ;;
            6)
                build_project
                ;;
            7)
                update_repository
                ;;
            8)
                quick_update
                ;;
            9)
                check_status
                ;;
            10)
                stop_services
                ;;
            0)
                echo -e "${GREEN}Выход...${NC}"
                exit 0
                ;;
            *)
                echo -e "${RED}Неверный выбор!${NC}"
                sleep 1
                ;;
        esac
    done
}

# Основная функция
main() {
    # Проверки
    check_node
    check_npm
    check_git
    
    echo ""
    check_postgres
    check_redis
    
    echo ""
    echo -e "${BLUE}⚠ ВАЖНО:${NC}"
    echo -e "${BLUE}1. Убедитесь, что PostgreSQL запущен (локально или в Docker)${NC}"
    echo -e "${BLUE}2. Убедитесь, что Redis запущен (локально или в Docker)${NC}"
    echo -e "${BLUE}3. Настройте backend/.env с правильными настройками БД${NC}"
    echo ""
    read -p "Нажмите Enter для продолжения..."
    
    # Запуск главного меню
    main_menu
}

# Запуск скрипта
main

