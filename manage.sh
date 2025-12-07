#!/bin/bash

###############################################################################
# FTR Registration System - Universal Management Script
# Универсальный скрипт управления системой FTR Registration
###############################################################################

set -euo pipefail

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
MAGENTA='\033[0;35m'
CYAN='\033[0;36m'
WHITE='\033[1;37m'
NC='\033[0m' # No Color
BOLD='\033[1m'

# Configuration
GITHUB_REPO="https://github.com/punk03/FTR_REG.git"
BRANCH="main"

# Determine project directory
if [ "$EUID" -eq 0 ]; then
    if id "ftr" &>/dev/null; then
        APP_USER="ftr"
    elif id "fil" &>/dev/null; then
        APP_USER="fil"
    else
        APP_USER="ftr"
    fi
    if [ "$APP_USER" = "root" ]; then
        PROJECT_DIR="/root/FTR_REG"
    else
        APP_USER_HOME=$(eval echo ~$APP_USER)
        PROJECT_DIR="${APP_USER_HOME}/FTR_REG"
    fi
else
    PROJECT_DIR="${HOME}/FTR_REG"
fi

export PROJECT_DIR

###############################################################################
# Utility Functions
###############################################################################

print_header() {
    clear
    echo -e "${CYAN}${BOLD}"
    echo "╔════════════════════════════════════════════════════════════════╗"
    echo "║                                                                ║"
    echo "║         FTR Registration System - Management Console          ║"
    echo "║                                                                ║"
    echo "╚════════════════════════════════════════════════════════════════╝"
    echo -e "${NC}"
}

print_success() {
    echo -e "${GREEN}✓${NC} $1"
}

print_error() {
    echo -e "${RED}✗${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}⚠${NC} $1"
}

print_info() {
    echo -e "${BLUE}ℹ${NC} $1"
}

print_section() {
    echo -e "\n${CYAN}${BOLD}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo -e "${CYAN}${BOLD}  $1${NC}"
    echo -e "${CYAN}${BOLD}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}\n"
}

wait_for_key() {
    echo -e "\n${YELLOW}Нажмите Enter для продолжения...${NC}"
    read -r
}

###############################################################################
# Installation Functions
###############################################################################

check_dependencies() {
    print_section "Проверка зависимостей"
    
    local missing=0
    
    if ! command -v node &> /dev/null; then
        print_error "Node.js не установлен"
        missing=1
    else
        print_success "Node.js: $(node --version)"
    fi
    
    if ! command -v npm &> /dev/null; then
        print_error "npm не установлен"
        missing=1
    else
        print_success "npm: $(npm --version)"
    fi
    
    if ! command -v git &> /dev/null; then
        print_error "Git не установлен"
        missing=1
    else
        print_success "Git: $(git --version | cut -d' ' -f3)"
    fi
    
    if ! command -v psql &> /dev/null; then
        print_warning "PostgreSQL client не установлен (psql)"
    else
        print_success "PostgreSQL client установлен"
    fi
    
    if [ $missing -eq 1 ]; then
        print_error "Установите недостающие зависимости перед продолжением"
        wait_for_key
        return 1
    fi
    
    return 0
}

install_system() {
    print_section "Установка системы"
    
    if [ -d "$PROJECT_DIR" ]; then
        print_warning "Директория $PROJECT_DIR уже существует"
        echo -e "${YELLOW}Продолжить установку? (y/n): ${NC}"
        read -r response
        if [[ ! "$response" =~ ^[Yy]$ ]]; then
            return 1
        fi
    fi
    
    print_info "Клонирование репозитория..."
    if [ ! -d "$PROJECT_DIR" ]; then
        git clone "$GITHUB_REPO" "$PROJECT_DIR" || {
            print_error "Ошибка клонирования репозитория"
            return 1
        }
    fi
    
    cd "$PROJECT_DIR"
    
    print_info "Установка зависимостей backend..."
    cd backend
    npm install || {
        print_error "Ошибка установки зависимостей backend"
        return 1
    }
    
    print_info "Установка зависимостей frontend..."
    cd ../frontend
    npm install || {
        print_error "Ошибка установки зависимостей frontend"
        return 1
    }
    
    print_info "Настройка переменных окружения..."
    if [ ! -f backend/.env ]; then
        print_warning "Создайте файл backend/.env с необходимыми переменными"
        print_info "Пример:"
        echo "DATABASE_URL=postgresql://user:password@localhost:5432/ftr_db"
        echo "JWT_SECRET=your-secret-key"
        echo "JWT_REFRESH_SECRET=your-refresh-secret-key"
        echo "PORT=3001"
    fi
    
    if [ ! -f frontend/.env ]; then
        print_warning "Создайте файл frontend/.env"
        print_info "Пример:"
        echo "VITE_API_URL=http://localhost:3001"
    fi
    
    print_success "Установка завершена!"
    wait_for_key
}

update_system() {
    print_section "Обновление системы"
    
    if [ ! -d "$PROJECT_DIR" ]; then
        print_error "Проект не найден. Выполните установку сначала."
        wait_for_key
        return 1
    fi
    
    cd "$PROJECT_DIR"
    
    print_info "Получение обновлений из репозитория..."
    git pull origin "$BRANCH" || {
        print_error "Ошибка получения обновлений"
        wait_for_key
        return 1
    }
    
    print_info "Обновление зависимостей backend..."
    cd backend
    npm install || {
        print_error "Ошибка обновления зависимостей backend"
        wait_for_key
        return 1
    }
    
    print_info "Обновление зависимостей frontend..."
    cd ../frontend
    npm install || {
        print_error "Ошибка обновления зависимостей frontend"
        wait_for_key
        return 1
    }
    
    print_success "Обновление завершено!"
    wait_for_key
}

###############################################################################
# Database Functions
###############################################################################

apply_migrations() {
    print_section "Применение миграций базы данных"
    
    cd "$PROJECT_DIR/backend"
    
    if [ ! -f .env ]; then
        print_error "Файл .env не найден в backend/"
        wait_for_key
        return 1
    fi
    
    source .env
    
    if [ -z "${DATABASE_URL:-}" ]; then
        print_error "DATABASE_URL не установлен в .env"
        wait_for_key
        return 1
    fi
    
    print_info "Применение миграций Prisma..."
    npx prisma migrate deploy || {
        print_error "Ошибка применения миграций"
        wait_for_key
        return 1
    }
    
    print_success "Миграции применены!"
    wait_for_key
}

apply_import_errors_migration() {
    print_section "Применение миграции ImportError"
    
    cd "$PROJECT_DIR/backend"
    
    if [ ! -f .env ]; then
        print_error "Файл .env не найден"
        wait_for_key
        return 1
    fi
    
    source .env
    
    if [ -z "${DATABASE_URL:-}" ]; then
        print_error "DATABASE_URL не установлен"
        wait_for_key
        return 1
    fi
    
    # Check if table exists
    TABLE_EXISTS=$(psql "$DATABASE_URL" -tAc "SELECT EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'ImportError');" 2>/dev/null || echo "f")
    
    if [ "$TABLE_EXISTS" = "t" ]; then
        print_success "Таблица ImportError уже существует"
        wait_for_key
        return 0
    fi
    
    print_info "Создание таблицы ImportError..."
    psql "$DATABASE_URL" <<'SQL' || {
        print_error "Ошибка создания таблицы"
        wait_for_key
        return 1
    }
CREATE TABLE IF NOT EXISTS "ImportError" (
    "id" SERIAL NOT NULL,
    "eventId" INTEGER NOT NULL,
    "rowNumber" INTEGER NOT NULL,
    "rowData" TEXT NOT NULL,
    "errors" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ImportError_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "ImportError_eventId_idx" ON "ImportError"("eventId");
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'ImportError_eventId_fkey'
    ) THEN
        ALTER TABLE "ImportError" 
        ADD CONSTRAINT "ImportError_eventId_fkey" 
        FOREIGN KEY ("eventId") 
        REFERENCES "Event"("id") 
        ON DELETE CASCADE 
        ON UPDATE CASCADE;
    END IF;
END $$;
SQL
    
    print_success "Миграция применена!"
    wait_for_key
}

generate_prisma_client() {
    print_section "Генерация Prisma Client"
    
    cd "$PROJECT_DIR/backend"
    
    print_info "Генерация Prisma Client..."
    npx prisma generate || {
        print_error "Ошибка генерации Prisma Client"
        wait_for_key
        return 1
    }
    
    print_success "Prisma Client сгенерирован!"
    wait_for_key
}

###############################################################################
# Backend Functions
###############################################################################

stop_backend() {
    print_section "Остановка Backend"
    
    print_info "Поиск процессов backend..."
    BACKEND_PIDS=$(pgrep -f "node.*dist/index.js" || echo "")
    
    if [ -z "$BACKEND_PIDS" ]; then
        print_warning "Процессы backend не найдены"
    else
        echo "$BACKEND_PIDS" | while read -r pid; do
            if [ -n "$pid" ]; then
                print_info "Остановка процесса $pid..."
                kill "$pid" 2>/dev/null || true
            fi
        done
        
        sleep 2
        
        # Force kill if still running
        pkill -9 -f "node.*dist/index.js" 2>/dev/null || true
        
        # Free port
        lsof -ti:3001 | xargs kill -9 2>/dev/null || true
        
        print_success "Backend остановлен"
    fi
    
    wait_for_key
}

build_backend() {
    print_section "Сборка Backend"
    
    cd "$PROJECT_DIR/backend"
    
    print_info "Сборка TypeScript..."
    npm run build || {
        print_error "Ошибка сборки backend"
        wait_for_key
        return 1
    }
    
    print_success "Backend собран!"
    wait_for_key
}

start_backend() {
    print_section "Запуск Backend"
    
    cd "$PROJECT_DIR/backend"
    
    # Check if already running
    if pgrep -f "node.*dist/index.js" > /dev/null; then
        print_warning "Backend уже запущен"
        wait_for_key
        return 1
    fi
    
    # Check if built
    if [ ! -d "dist" ]; then
        print_warning "Backend не собран. Выполняю сборку..."
        build_backend
    fi
    
    # Free port
    lsof -ti:3001 | xargs kill -9 2>/dev/null || true
    sleep 1
    
    print_info "Запуск backend..."
    nohup node dist/index.js > backend.log 2>&1 &
    BACKEND_PID=$!
    
    sleep 3
    
    if ps -p $BACKEND_PID > /dev/null 2>&1; then
        print_success "Backend запущен (PID: $BACKEND_PID)"
        print_info "Логи: tail -f $PROJECT_DIR/backend/backend.log"
    else
        print_error "Backend не запустился. Проверьте логи."
        tail -20 backend.log
    fi
    
    wait_for_key
}

restart_backend() {
    print_section "Перезапуск Backend"
    
    stop_backend
    sleep 2
    build_backend
    sleep 1
    start_backend
}

view_backend_logs() {
    print_section "Логи Backend"
    
    if [ -f "$PROJECT_DIR/backend/backend.log" ]; then
        tail -50 "$PROJECT_DIR/backend/backend.log"
    else
        print_warning "Файл логов не найден"
    fi
    
    wait_for_key
}

###############################################################################
# Frontend Functions
###############################################################################

stop_frontend() {
    print_section "Остановка Frontend"
    
    print_info "Поиск процессов frontend..."
    FRONTEND_PIDS=$(pgrep -f "serve.*frontend" || echo "")
    
    if [ -z "$FRONTEND_PIDS" ]; then
        print_warning "Процессы frontend не найдены"
    else
        echo "$FRONTEND_PIDS" | while read -r pid; do
            if [ -n "$pid" ]; then
                print_info "Остановка процесса $pid..."
                kill "$pid" 2>/dev/null || true
            fi
        done
        
        sleep 2
        pkill -9 -f "serve.*frontend" 2>/dev/null || true
        lsof -ti:3000 | xargs kill -9 2>/dev/null || true
        
        print_success "Frontend остановлен"
    fi
    
    wait_for_key
}

build_frontend() {
    print_section "Сборка Frontend"
    
    cd "$PROJECT_DIR/frontend"
    
    print_info "Сборка frontend..."
    npm run build || {
        print_error "Ошибка сборки frontend"
        wait_for_key
        return 1
    }
    
    print_success "Frontend собран!"
    wait_for_key
}

start_frontend() {
    print_section "Запуск Frontend"
    
    cd "$PROJECT_DIR/frontend"
    
    # Check if already running
    if pgrep -f "serve.*frontend" > /dev/null; then
        print_warning "Frontend уже запущен"
        wait_for_key
        return 1
    fi
    
    # Check if built
    if [ ! -d "dist" ]; then
        print_warning "Frontend не собран. Выполняю сборку..."
        build_frontend
    fi
    
    # Free port
    lsof -ti:3000 | xargs kill -9 2>/dev/null || true
    sleep 1
    
    print_info "Запуск frontend..."
    cd dist
    nohup npx serve -s . -l 3000 --listen tcp://0.0.0.0:3000 > ../frontend.log 2>&1 &
    FRONTEND_PID=$!
    
    sleep 3
    
    if ps -p $FRONTEND_PID > /dev/null 2>&1; then
        print_success "Frontend запущен (PID: $FRONTEND_PID)"
        print_info "Логи: tail -f $PROJECT_DIR/frontend/frontend.log"
    else
        print_error "Frontend не запустился. Проверьте логи."
        tail -20 ../frontend.log
    fi
    
    wait_for_key
}

restart_frontend() {
    print_section "Перезапуск Frontend"
    
    stop_frontend
    sleep 2
    build_frontend
    sleep 1
    start_frontend
}

view_frontend_logs() {
    print_section "Логи Frontend"
    
    if [ -f "$PROJECT_DIR/frontend/frontend.log" ]; then
        tail -50 "$PROJECT_DIR/frontend/frontend.log"
    else
        print_warning "Файл логов не найден"
    fi
    
    wait_for_key
}

###############################################################################
# Diagnostic Functions
###############################################################################

check_status() {
    print_section "Статус системы"
    
    echo -e "${BOLD}Backend:${NC}"
    if pgrep -f "node.*dist/index.js" > /dev/null; then
        BACKEND_PID=$(pgrep -f "node.*dist/index.js" | head -1)
        print_success "Запущен (PID: $BACKEND_PID)"
        
        # Check port
        if lsof -Pi :3001 -sTCP:LISTEN -t >/dev/null 2>&1; then
            print_success "Порт 3001 открыт"
        else
            print_warning "Порт 3001 не слушается"
        fi
    else
        print_error "Не запущен"
    fi
    
    echo -e "\n${BOLD}Frontend:${NC}"
    if pgrep -f "serve.*frontend" > /dev/null; then
        FRONTEND_PID=$(pgrep -f "serve.*frontend" | head -1)
        print_success "Запущен (PID: $FRONTEND_PID)"
        
        # Check port
        if lsof -Pi :3000 -sTCP:LISTEN -t >/dev/null 2>&1; then
            print_success "Порт 3000 открыт"
        else
            print_warning "Порт 3000 не слушается"
        fi
    else
        print_error "Не запущен"
    fi
    
    echo -e "\n${BOLD}База данных:${NC}"
    cd "$PROJECT_DIR/backend"
    if [ -f .env ]; then
        source .env
        if [ -n "${DATABASE_URL:-}" ]; then
            if psql "$DATABASE_URL" -c "SELECT 1" > /dev/null 2>&1; then
                print_success "Подключение к БД успешно"
            else
                print_error "Не удается подключиться к БД"
            fi
        else
            print_warning "DATABASE_URL не установлен"
        fi
    else
        print_warning "Файл .env не найден"
    fi
    
    wait_for_key
}

test_backend_connection() {
    print_section "Тест подключения к Backend"
    
    print_info "Проверка health endpoint..."
    if curl -s http://localhost:3001/health > /dev/null 2>&1; then
        print_success "Backend отвечает на /health"
        curl -s http://localhost:3001/health | jq . 2>/dev/null || curl -s http://localhost:3001/health
    else
        print_error "Backend не отвечает"
    fi
    
    wait_for_key
}

###############################################################################
# Quick Fixes
###############################################################################

fix_cors() {
    print_section "Исправление CORS"
    
    print_info "Проверка конфигурации CORS в backend..."
    cd "$PROJECT_DIR/backend"
    
    if grep -q "app.options('*', cors())" src/index.ts 2>/dev/null; then
        print_success "CORS настроен правильно"
    else
        print_warning "Требуется обновление конфигурации CORS"
        print_info "Перезапустите backend после обновления кода"
    fi
    
    restart_backend
}

fix_import_errors() {
    print_section "Исправление функционала Import Errors"
    
    apply_import_errors_migration
    restart_backend
}

fix_frontend_env() {
    print_section "Исправление переменных окружения Frontend"
    
    cd "$PROJECT_DIR/frontend"
    
    if [ ! -f .env ]; then
        print_info "Создание файла .env..."
        echo "VITE_API_URL=http://95.71.125.8:3001" > .env
    else
        print_info "Обновление VITE_API_URL..."
        sed -i 's|VITE_API_URL=.*|VITE_API_URL=http://95.71.125.8:3001|' .env
    fi
    
    print_info "Пересборка frontend..."
    build_frontend
    
    print_info "Перезапуск frontend..."
    restart_frontend
}

###############################################################################
# Main Menu
###############################################################################

show_main_menu() {
    print_header
    
    echo -e "${WHITE}${BOLD}Главное меню:${NC}\n"
    
    echo -e "  ${CYAN}1)${NC} Установка и обновление"
    echo -e "  ${CYAN}2)${NC} Управление базой данных"
    echo -e "  ${CYAN}3)${NC} Управление Backend"
    echo -e "  ${CYAN}4)${NC} Управление Frontend"
    echo -e "  ${CYAN}5)${NC} Диагностика"
    echo -e "  ${CYAN}6)${NC} Быстрые исправления"
    echo -e "  ${CYAN}0)${NC} Выход"
    
    echo -e "\n${YELLOW}Выберите пункт меню: ${NC}"
}

show_install_menu() {
    print_header
    
    echo -e "${WHITE}${BOLD}Установка и обновление:${NC}\n"
    
    echo -e "  ${CYAN}1)${NC} Проверить зависимости"
    echo -e "  ${CYAN}2)${NC} Установить систему"
    echo -e "  ${CYAN}3)${NC} Обновить систему"
    echo -e "  ${CYAN}0)${NC} Назад"
    
    echo -e "\n${YELLOW}Выберите пункт меню: ${NC}"
}

show_database_menu() {
    print_header
    
    echo -e "${WHITE}${BOLD}Управление базой данных:${NC}\n"
    
    echo -e "  ${CYAN}1)${NC} Применить миграции Prisma"
    echo -e "  ${CYAN}2)${NC} Применить миграцию ImportError"
    echo -e "  ${CYAN}3)${NC} Сгенерировать Prisma Client"
    echo -e "  ${CYAN}0)${NC} Назад"
    
    echo -e "\n${YELLOW}Выберите пункт меню: ${NC}"
}

show_backend_menu() {
    print_header
    
    echo -e "${WHITE}${BOLD}Управление Backend:${NC}\n"
    
    echo -e "  ${CYAN}1)${NC} Остановить"
    echo -e "  ${CYAN}2)${NC} Собрать"
    echo -e "  ${CYAN}3)${NC} Запустить"
    echo -e "  ${CYAN}4)${NC} Перезапустить"
    echo -e "  ${CYAN}5)${NC} Просмотр логов"
    echo -e "  ${CYAN}0)${NC} Назад"
    
    echo -e "\n${YELLOW}Выберите пункт меню: ${NC}"
}

show_frontend_menu() {
    print_header
    
    echo -e "${WHITE}${BOLD}Управление Frontend:${NC}\n"
    
    echo -e "  ${CYAN}1)${NC} Остановить"
    echo -e "  ${CYAN}2)${NC} Собрать"
    echo -e "  ${CYAN}3)${NC} Запустить"
    echo -e "  ${CYAN}4)${NC} Перезапустить"
    echo -e "  ${CYAN}5)${NC} Просмотр логов"
    echo -e "  ${CYAN}0)${NC} Назад"
    
    echo -e "\n${YELLOW}Выберите пункт меню: ${NC}"
}

show_diagnostics_menu() {
    print_header
    
    echo -e "${WHITE}${BOLD}Диагностика:${NC}\n"
    
    echo -e "  ${CYAN}1)${NC} Проверить статус системы"
    echo -e "  ${CYAN}2)${NC} Тест подключения к Backend"
    echo -e "  ${CYAN}0)${NC} Назад"
    
    echo -e "\n${YELLOW}Выберите пункт меню: ${NC}"
}

show_fixes_menu() {
    print_header
    
    echo -e "${WHITE}${BOLD}Быстрые исправления:${NC}\n"
    
    echo -e "  ${CYAN}1)${NC} Исправить CORS"
    echo -e "  ${CYAN}2)${NC} Исправить Import Errors"
    echo -e "  ${CYAN}3)${NC} Исправить переменные окружения Frontend"
    echo -e "  ${CYAN}0)${NC} Назад"
    
    echo -e "\n${YELLOW}Выберите пункт меню: ${NC}"
}

###############################################################################
# Main Loop
###############################################################################

main() {
    while true; do
        show_main_menu
        read -r choice
        
        case $choice in
            1)
                while true; do
                    show_install_menu
                    read -r sub_choice
                    case $sub_choice in
                        1) check_dependencies ;;
                        2) install_system ;;
                        3) update_system ;;
                        0) break ;;
                        *) print_error "Неверный выбор" ; sleep 1 ;;
                    esac
                done
                ;;
            2)
                while true; do
                    show_database_menu
                    read -r sub_choice
                    case $sub_choice in
                        1) apply_migrations ;;
                        2) apply_import_errors_migration ;;
                        3) generate_prisma_client ;;
                        0) break ;;
                        *) print_error "Неверный выбор" ; sleep 1 ;;
                    esac
                done
                ;;
            3)
                while true; do
                    show_backend_menu
                    read -r sub_choice
                    case $sub_choice in
                        1) stop_backend ;;
                        2) build_backend ;;
                        3) start_backend ;;
                        4) restart_backend ;;
                        5) view_backend_logs ;;
                        0) break ;;
                        *) print_error "Неверный выбор" ; sleep 1 ;;
                    esac
                done
                ;;
            4)
                while true; do
                    show_frontend_menu
                    read -r sub_choice
                    case $sub_choice in
                        1) stop_frontend ;;
                        2) build_frontend ;;
                        3) start_frontend ;;
                        4) restart_frontend ;;
                        5) view_frontend_logs ;;
                        0) break ;;
                        *) print_error "Неверный выбор" ; sleep 1 ;;
                    esac
                done
                ;;
            5)
                while true; do
                    show_diagnostics_menu
                    read -r sub_choice
                    case $sub_choice in
                        1) check_status ;;
                        2) test_backend_connection ;;
                        0) break ;;
                        *) print_error "Неверный выбор" ; sleep 1 ;;
                    esac
                done
                ;;
            6)
                while true; do
                    show_fixes_menu
                    read -r sub_choice
                    case $sub_choice in
                        1) fix_cors ;;
                        2) fix_import_errors ;;
                        3) fix_frontend_env ;;
                        0) break ;;
                        *) print_error "Неверный выбор" ; sleep 1 ;;
                    esac
                done
                ;;
            0)
                print_info "Выход..."
                exit 0
                ;;
            *)
                print_error "Неверный выбор"
                sleep 1
                ;;
        esac
    done
}

# Run main function
main

