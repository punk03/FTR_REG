#!/bin/bash

###############################################################################
# FTR Registration System - Auto Update Script
# 
# Этот скрипт автоматически обновляет систему из GitHub репозитория:
# - Обновляет код из GitHub
# - Пересобирает backend и frontend
# - Перезапускает сервисы
# - Проверяет статус
#
# Использование:
#   ./update.sh                    # Обновление от текущего пользователя
#   sudo ./update.sh               # Обновление от root (автоматически определит пользователя)
###############################################################################

set -e

# Цвета для вывода
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Функции для вывода
print_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

print_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Определяем текущую директорию
CURRENT_DIR=$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)
cd "$CURRENT_DIR"

# Определяем пользователя приложения
get_app_user() {
    if [ "$EUID" -eq 0 ]; then
        # Если запущено от root, ищем пользователя приложения
        if id "ftr" &>/dev/null; then
            echo "ftr"
        elif id "fil" &>/dev/null; then
            echo "fil"
        else
            echo "root"
        fi
    else
        echo "$USER"
    fi
}

APP_USER=$(get_app_user)
APP_USER_HOME=$(eval echo ~$APP_USER)

print_info "FTR Registration System - Auto Update Script"
echo ""

# Проверка Git репозитория
if [ ! -d ".git" ]; then
    print_error "Это не Git репозиторий. Нельзя обновить."
    exit 1
fi

# Проверка наличия deploy.sh
if [ ! -f "deploy.sh" ]; then
    print_error "Файл deploy.sh не найден. Невозможно обновить."
    exit 1
fi

# Проверка прав на выполнение
if [ ! -x "deploy.sh" ]; then
    print_info "Устанавливаем права на выполнение для deploy.sh..."
    chmod +x deploy.sh
fi

# Создаем резервную копию базы данных перед обновлением
backup_database() {
    print_info "Создание резервной копии базы данных..."
    
    BACKUP_DIR="$CURRENT_DIR/backups"
    mkdir -p "$BACKUP_DIR"
    
    TIMESTAMP=$(date +%Y%m%d_%H%M%S)
    BACKUP_FILE="$BACKUP_DIR/ftr_db_backup_${TIMESTAMP}.sql"
    
    # Проверяем, запущен ли PostgreSQL контейнер
    if docker ps | grep -q "ftr_postgres"; then
        if docker exec ftr_postgres pg_dump -U ftr_user ftr_db > "$BACKUP_FILE" 2>/dev/null; then
            # Сжимаем резервную копию
            gzip -f "$BACKUP_FILE"
            print_success "Резервная копия создана: ${BACKUP_FILE}.gz"
        else
            print_warning "Не удалось создать резервную копию базы данных"
        fi
    else
        print_warning "PostgreSQL контейнер не запущен. Пропускаем резервное копирование."
    fi
}

# Обновление кода из GitHub
update_code() {
    print_info "Обновление кода из GitHub..."
    
    # Настраиваем Git safe.directory если нужно
    git config --global --add safe.directory "$CURRENT_DIR" 2>/dev/null || true
    
    # Сохраняем незакоммиченные изменения
    if ! git diff-index --quiet HEAD --; then
        print_warning "Обнаружены незакоммиченные изменения. Сохраняем их..."
        git stash save "Auto-stash before update $(date +%Y%m%d_%H%M%S)" || true
    fi
    
    # Получаем текущую ветку
    CURRENT_BRANCH=$(git rev-parse --abbrev-ref HEAD)
    
    # Обновляем код
    if git fetch origin "$CURRENT_BRANCH" && git pull origin "$CURRENT_BRANCH"; then
        print_success "Код обновлен из GitHub"
    else
        print_error "Не удалось обновить код из GitHub"
        exit 1
    fi
}

# Остановка сервисов
stop_services() {
    print_info "Остановка сервисов..."
    
    # Останавливаем backend процессы
    if pgrep -f "node.*dist/index.js" > /dev/null; then
        pkill -f "node.*dist/index.js" || true
        sleep 2
        print_success "Backend остановлен"
    fi
    
    # Останавливаем frontend процессы
    if pgrep -f "serve.*dist" > /dev/null; then
        pkill -f "serve.*dist" || true
        sleep 2
        print_success "Frontend остановлен"
    fi
}

# Пересборка и перезапуск
rebuild_and_restart() {
    print_info "Пересборка и перезапуск сервисов..."
    
    # Пересобираем backend
    if [ -d "backend" ]; then
        cd backend
        
        print_info "Установка зависимостей backend..."
        npm install --silent
        
        print_info "Пересборка backend..."
        if npm run build; then
            print_success "Backend пересобран"
        else
            print_error "Ошибка пересборки backend"
            cd ..
            return 1
        fi
        
        cd ..
    fi
    
    # Пересобираем frontend
    if [ -d "frontend" ]; then
        cd frontend
        
        print_info "Установка зависимостей frontend..."
        npm install --silent
        
        print_info "Пересборка frontend..."
        if npm run build; then
            print_success "Frontend пересобран"
        else
            print_error "Ошибка пересборки frontend"
            cd ..
            return 1
        fi
        
        cd ..
    fi
    
    # Применяем миграции базы данных
    if [ -d "backend" ]; then
        cd backend
        print_info "Применение миграций базы данных..."
        npx prisma generate
        npx prisma migrate deploy || print_warning "Миграции уже применены или произошла ошибка"
        cd ..
    fi
    
    # Запускаем сервисы
    print_info "Запуск сервисов..."
    
    # Запускаем backend
    if [ -d "backend" ]; then
        cd backend
        nohup npm start > ../backend.log 2>&1 &
        BACKEND_PID=$!
        sleep 3
        
        # Проверяем, что backend запустился
        if ps -p $BACKEND_PID > /dev/null; then
            print_success "Backend запущен (PID: $BACKEND_PID)"
        else
            print_error "Backend не запустился. Проверьте логи: backend.log"
        fi
        cd ..
    fi
    
    # Запускаем frontend
    if [ -d "frontend" ] && [ -d "frontend/dist" ]; then
        cd frontend
        nohup npx -y serve@latest -s dist -l 3000 > ../frontend.log 2>&1 &
        FRONTEND_PID=$!
        sleep 2
        
        # Проверяем, что frontend запустился
        if ps -p $FRONTEND_PID > /dev/null; then
            print_success "Frontend запущен (PID: $FRONTEND_PID)"
        else
            print_error "Frontend не запустился. Проверьте логи: frontend.log"
        fi
        cd ..
    fi
}

# Проверка статуса
check_status() {
    print_info "Проверка статуса сервисов..."
    
    # Проверка backend
    if curl -s http://localhost:3001/api/health > /dev/null 2>&1; then
        print_success "Backend доступен на http://localhost:3001"
    else
        print_warning "Backend не отвечает на http://localhost:3001"
    fi
    
    # Проверка frontend
    if curl -s http://localhost:3000 > /dev/null 2>&1; then
        print_success "Frontend доступен на http://localhost:3000"
    else
        print_warning "Frontend не отвечает на http://localhost:3000"
    fi
    
    # Проверка PostgreSQL
    if docker ps | grep -q "ftr_postgres"; then
        print_success "PostgreSQL контейнер запущен"
    else
        print_warning "PostgreSQL контейнер не запущен"
    fi
    
    # Проверка Redis
    if docker ps | grep -q "ftr_redis"; then
        print_success "Redis контейнер запущен"
    else
        print_warning "Redis контейнер не запущен"
    fi
}

# Показываем информацию о версии
show_version() {
    if [ -f ".git/HEAD" ]; then
        CURRENT_COMMIT=$(git rev-parse --short HEAD)
        CURRENT_BRANCH=$(git rev-parse --abbrev-ref HEAD)
        print_info "Текущая версия: $CURRENT_BRANCH ($CURRENT_COMMIT)"
    fi
}

# Основная функция
main() {
    echo ""
    print_info "Начало автоматического обновления..."
    echo ""
    
    # Показываем текущую версию
    show_version
    
    # Создаем резервную копию
    backup_database
    
    # Обновляем код
    update_code
    
    # Показываем новую версию
    echo ""
    print_info "Новая версия после обновления:"
    show_version
    echo ""
    
    # Останавливаем сервисы
    stop_services
    
    # Пересобираем и перезапускаем
    if rebuild_and_restart; then
        echo ""
        print_success "Обновление завершено успешно!"
        echo ""
        
        # Проверяем статус
        check_status
        
        echo ""
        print_info "Логи сервисов:"
        print_info "  Backend:  $CURRENT_DIR/backend.log"
        print_info "  Frontend: $CURRENT_DIR/frontend.log"
        echo ""
        print_info "Для просмотра логов используйте:"
        print_info "  tail -f backend.log"
        print_info "  tail -f frontend.log"
    else
        echo ""
        print_error "Обновление завершилось с ошибками!"
        print_info "Проверьте логи выше для деталей."
        exit 1
    fi
}

# Запуск основной функции
main

