#!/bin/bash

# FTR Registration System - Автоматическое обновление с GitHub
# Скрипт для автоматической проверки и установки обновлений из репозитория
# Можно запускать вручную или через cron (например, каждые 6 часов)

set -e  # Exit on error

# Цвета для вывода
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Конфигурация
PROJECT_NAME="ftr-registration-system"
BACKUP_DIR="./backups"
LOG_DIR="./logs"
LOG_FILE="${LOG_DIR}/auto-update_$(date +%Y%m%d).log"
LOCK_FILE="/tmp/ftr_auto_update.lock"
APP_USER="" # Будет определен автоматически
BRANCH="main" # Ветка для обновления

# Функции логирования
log_info() {
    echo -e "${BLUE}[INFO]${NC} $(date '+%Y-%m-%d %H:%M:%S') - $1" | tee -a "$LOG_FILE"
}

log_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $(date '+%Y-%m-%d %H:%M:%S') - $1" | tee -a "$LOG_FILE"
}

log_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $(date '+%Y-%m-%d %H:%M:%S') - $1" | tee -a "$LOG_FILE"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $(date '+%Y-%m-%d %H:%M:%S') - $1" | tee -a "$LOG_FILE"
}

# Проверка блокировки (предотвращение одновременного запуска)
check_lock() {
    if [ -f "$LOCK_FILE" ]; then
        local pid=$(cat "$LOCK_FILE")
        if ps -p "$pid" > /dev/null 2>&1; then
            log_error "Другой процесс обновления уже запущен (PID: $pid)"
            exit 1
        else
            log_warning "Найден устаревший lock файл. Удаляем..."
            rm -f "$LOCK_FILE"
        fi
    fi
    echo $$ > "$LOCK_FILE"
}

# Очистка блокировки при выходе
cleanup() {
    rm -f "$LOCK_FILE"
    log_info "Очистка завершена"
}
trap cleanup EXIT INT TERM

# Получение текущего пользователя
get_current_user() {
    if [ -n "$SUDO_USER" ]; then
        echo "$SUDO_USER"
    elif [ -n "$USER" ]; then
        echo "$USER"
    else
        whoami 2>/dev/null || echo "unknown"
    fi
}

# Определение команд Docker
check_docker_access() {
    if docker info >/dev/null 2>&1; then
        DOCKER_CMD="docker"
        DOCKER_COMPOSE_CMD="docker compose"
    elif sudo docker info >/dev/null 2>&1; then
        DOCKER_CMD="sudo docker"
        DOCKER_COMPOSE_CMD="sudo docker compose"
    else
        log_error "Docker недоступен. Проверьте установку Docker."
        exit 1
    fi
}

# Проверка Node.js
check_nodejs() {
    if ! command -v node >/dev/null 2>&1 || ! command -v npm >/dev/null 2>&1; then
        log_error "Node.js и npm не установлены. Используйте install.sh для установки."
        exit 1
    fi
}

# Создание необходимых директорий
create_directories() {
    mkdir -p "$BACKUP_DIR"
    mkdir -p "$LOG_DIR"
}

# Проверка наличия обновлений
check_for_updates() {
    log_info "Проверка наличия обновлений в репозитории..."
    
    # Переходим в директорию проекта
    cd "$(dirname "$0")" || exit 1
    
    # Проверяем, что это git репозиторий
    if [ ! -d ".git" ]; then
        log_error "Текущая директория не является git репозиторием"
        exit 1
    fi
    
    # Получаем текущий коммит
    CURRENT_COMMIT=$(git rev-parse HEAD)
    
    # Настраиваем Git safe.directory если нужно
    CURRENT_DIR=$(pwd)
    git config --global --add safe.directory "$CURRENT_DIR" 2>/dev/null || true
    
    # Получаем последние изменения из репозитория
    git fetch origin "$BRANCH" >/dev/null 2>&1 || {
        log_error "Не удалось получить обновления из репозитория"
        exit 1
    }
    
    # Проверяем, есть ли новые коммиты
    REMOTE_COMMIT=$(git rev-parse "origin/$BRANCH")
    
    if [ "$CURRENT_COMMIT" = "$REMOTE_COMMIT" ]; then
        log_info "Обновлений не найдено. Текущая версия: ${CURRENT_COMMIT:0:7}"
        return 1  # Нет обновлений
    else
        log_info "Найдены обновления!"
        log_info "Текущая версия: ${CURRENT_COMMIT:0:7}"
        log_info "Новая версия: ${REMOTE_COMMIT:0:7}"
        
        # Показываем список изменений
        COMMITS_COUNT=$(git rev-list --count HEAD.."origin/$BRANCH")
        log_info "Количество новых коммитов: $COMMITS_COUNT"
        
        return 0  # Есть обновления
    fi
}

# Резервное копирование базы данных
backup_database() {
    log_info "Создание резервной копии базы данных..."
    TIMESTAMP=$(date +%Y%m%d_%H%M%S)
    BACKUP_FILE="${BACKUP_DIR}/backup_${TIMESTAMP}.sql"
    
    if $DOCKER_CMD exec ftr_postgres pg_dump -U ftr_user -d ftr_db > "$BACKUP_FILE" 2>/dev/null; then
        gzip "$BACKUP_FILE"
        log_success "Резервная копия создана: ${BACKUP_FILE}.gz"
        return 0
    else
        log_warning "Не удалось создать резервную копию. Продолжаем без резервной копии."
        return 1
    fi
}

# Обновление кода из репозитория
update_code() {
    log_info "Обновление кода из репозитория..."
    
    # Сохраняем незакоммиченные изменения
    if ! git diff-index --quiet HEAD --; then
        log_warning "Обнаружены незакоммиченные изменения. Сохраняем их..."
        git stash save "Auto-stash before update $(date +%Y%m%d_%H%M%S)" || true
    fi
    
    # Обновляем код
    if git pull origin "$BRANCH"; then
        log_success "Код успешно обновлен"
        return 0
    else
        log_error "Ошибка при обновлении кода"
        return 1
    fi
}

# Установка зависимостей
install_dependencies() {
    log_info "Установка зависимостей backend..."
    cd backend
    npm install >/dev/null 2>&1 || {
        log_error "Ошибка установки зависимостей backend"
        return 1
    }
    cd ..
    
    log_info "Установка зависимостей frontend..."
    cd frontend
    npm install >/dev/null 2>&1 || {
        log_error "Ошибка установки зависимостей frontend"
        return 1
    }
    cd ..
    
    log_success "Зависимости установлены"
    return 0
}

# Сборка приложений
build_applications() {
    log_info "Сборка backend..."
    cd backend
    if npm run build >/dev/null 2>&1; then
        log_success "Backend собран успешно"
    else
        log_error "Ошибка сборки backend"
        cd ..
        return 1
    fi
    cd ..
    
    log_info "Сборка frontend..."
    cd frontend
    
    # Убеждаемся, что .env файл существует
    if [ ! -f ".env" ]; then
        echo "VITE_API_URL=http://185.185.68.105:3001" > .env
    fi
    
    if npm run build >/dev/null 2>&1; then
        log_success "Frontend собран успешно"
    else
        log_error "Ошибка сборки frontend"
        cd ..
        return 1
    fi
    cd ..
    
    return 0
}

# Применение миграций базы данных
run_migrations() {
    log_info "Применение миграций базы данных..."
    cd backend
    
    # Генерируем Prisma Client
    npx prisma generate >/dev/null 2>&1 || {
        log_error "Ошибка генерации Prisma Client"
        cd ..
        return 1
    }
    
    # Применяем миграции
    npx prisma migrate deploy >/dev/null 2>&1 || {
        log_error "Ошибка применения миграций"
        cd ..
        return 1
    }
    
    cd ..
    log_success "Миграции применены успешно"
    return 0
}

# Остановка приложения
stop_application() {
    log_info "Остановка текущих процессов приложения..."
    
    # Останавливаем backend
    pkill -f "node.*dist/index.js" >/dev/null 2>&1 || true
    
    # Останавливаем frontend
    pkill -f "serve.*dist" >/dev/null 2>&1 || true
    
    log_success "Процессы остановлены"
}

# Запуск приложения
start_application() {
    log_info "Запуск приложения..."
    
    # Запускаем backend
    cd backend
    nohup npm start > ../backend.log 2>&1 &
    BACKEND_PID=$!
    echo $BACKEND_PID > ../backend.pid
    cd ..
    log_success "Backend запущен с PID $BACKEND_PID"
    
    # Запускаем frontend
    cd frontend
    nohup npx -y serve@latest -s dist -l 3000 > ../frontend.log 2>&1 &
    FRONTEND_PID=$!
    echo $FRONTEND_PID > ../frontend.pid
    cd ..
    log_success "Frontend запущен с PID $FRONTEND_PID"
    
    # Ждем немного для запуска сервисов
    sleep 5
}

# Проверка здоровья приложения
check_health() {
    log_info "Проверка здоровья приложения..."
    
    local max_attempts=5
    local attempt=1
    
    while [ $attempt -le $max_attempts ]; do
        if curl -s http://185.185.68.105:3001/api/health | grep -q '"status":"ok"'; then
            log_success "Backend работает корректно"
            
            if curl -s http://185.185.68.105:3000 | grep -q '<div id="root"'; then
                log_success "Frontend работает корректно"
                return 0
            fi
        fi
        
        log_warning "Попытка $attempt/$max_attempts: сервисы еще не готовы, ждем..."
        sleep 3
        attempt=$((attempt + 1))
    done
    
    log_error "Не удалось проверить здоровье приложения"
    return 1
}

# Откат изменений при ошибке
rollback() {
    log_error "Обнаружена ошибка. Выполняется откат..."
    
    # Останавливаем приложение
    stop_application
    
    # Восстанавливаем код (если есть stash)
    if git stash list | grep -q "Auto-stash"; then
        log_info "Восстановление незакоммиченных изменений..."
        git stash pop >/dev/null 2>&1 || true
    fi
    
    log_error "Откат завершен. Проверьте логи для деталей."
}

# Основная функция
main() {
    log_info "=========================================="
    log_info "FTR Registration System - Автообновление"
    log_info "=========================================="
    log_info ""
    
    # Проверка блокировки
    check_lock
    
    # Определение пользователя
    APP_USER=$(get_current_user)
    log_info "Запуск от пользователя: $APP_USER"
    
    # Проверки
    check_docker_access
    check_nodejs
    
    # Создание директорий
    create_directories
    
    # Проверка наличия обновлений
    if ! check_for_updates; then
        log_info "Обновлений не найдено. Выход."
        exit 0
    fi
    
    # Резервное копирование
    backup_database
    
    # Обновление кода
    if ! update_code; then
        rollback
        exit 1
    fi
    
    # Остановка приложения
    stop_application
    
    # Установка зависимостей
    if ! install_dependencies; then
        rollback
        exit 1
    fi
    
    # Применение миграций
    if ! run_migrations; then
        rollback
        exit 1
    fi
    
    # Сборка приложений
    if ! build_applications; then
        rollback
        exit 1
    fi
    
    # Запуск приложения
    start_application
    
    # Проверка здоровья
    if ! check_health; then
        log_warning "Проверка здоровья не прошла, но приложение запущено"
    fi
    
    log_success "=========================================="
    log_success "Автообновление завершено успешно!"
    log_success "=========================================="
    log_info ""
    log_info "Логи сохранены в: $LOG_FILE"
    log_info "Backend: http://185.185.68.105:3001"
    log_info "Frontend: http://185.185.68.105:3000"
}

# Запуск основной функции
main "$@"

