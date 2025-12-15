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
    echo -e "${BLUE}   Docker Management Script${NC}"
    echo -e "${BLUE}========================================${NC}"
    echo ""
}

# Функция для проверки наличия docker-compose
check_docker_compose() {
    if ! command -v docker-compose &> /dev/null && ! docker compose version &> /dev/null; then
        echo -e "${RED}Ошибка: docker-compose не установлен!${NC}"
        exit 1
    fi
}

# Функция для проверки наличия git
check_git() {
    if ! command -v git &> /dev/null; then
        echo -e "${RED}Ошибка: git не установлен!${NC}"
        exit 1
    fi
}

# Функция 1: Мониторинг Docker
monitor_docker() {
    show_header
    echo -e "${GREEN}=== Мониторинг Docker ===${NC}"
    echo ""
    
    while true; do
        echo -e "${YELLOW}Статус контейнеров:${NC}"
        docker-compose ps 2>/dev/null || docker compose ps
        
        echo ""
        echo -e "${YELLOW}Использование ресурсов:${NC}"
        docker stats --no-stream --format "table {{.Container}}\t{{.CPUPerc}}\t{{.MemUsage}}\t{{.NetIO}}" $(docker-compose ps -q 2>/dev/null || docker compose ps -q) 2>/dev/null || echo "Контейнеры не запущены"
        
        echo ""
        echo -e "${BLUE}Нажмите Ctrl+C для выхода из мониторинга${NC}"
        echo -e "${BLUE}Обновление через 5 секунд...${NC}"
        sleep 5
        clear
        show_header
        echo -e "${GREEN}=== Мониторинг Docker ===${NC}"
        echo ""
    done
}

# Функция 2: Обновление из репозитория
update_repository() {
    show_header
    echo -e "${GREEN}=== Обновление из репозитория ===${NC}"
    echo ""
    
    # Проверяем, что мы в git репозитории
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

# Функция для создания резервной копии БД
backup_database() {
    local backup_dir="./backups"
    local timestamp=$(date +"%Y%m%d_%H%M%S")
    local backup_file="${backup_dir}/db_backup_${timestamp}.sql"
    
    mkdir -p "$backup_dir"
    
    echo -e "${YELLOW}Создание резервной копии БД...${NC}"
    
    # Проверяем, запущен ли контейнер PostgreSQL
    if docker ps --format '{{.Names}}' | grep -q "^ftr_postgres$"; then
        # Создаём резервную копию через pg_dump
        docker exec ftr_postgres pg_dump -U ${POSTGRES_USER:-ftr_user} -d ${POSTGRES_DB:-ftr_db} > "$backup_file" 2>/dev/null
        
        if [ $? -eq 0 ] && [ -s "$backup_file" ]; then
            echo -e "${GREEN}✓ Резервная копия создана: ${backup_file}${NC}"
            # Удаляем старые резервные копии (оставляем последние 5)
            ls -t "${backup_dir}"/db_backup_*.sql 2>/dev/null | tail -n +6 | xargs rm -f 2>/dev/null
            return 0
        else
            echo -e "${YELLOW}⚠ Не удалось создать резервную копию (БД может быть пустой или контейнер не готов)${NC}"
            rm -f "$backup_file" 2>/dev/null
            return 1
        fi
    else
        echo -e "${YELLOW}⚠ Контейнер PostgreSQL не запущен, резервная копия не создана${NC}"
        return 1
    fi
}

# Функция для проверки существования volumes
check_volumes() {
    local postgres_volume="ftr_reg_postgres_data"
    local redis_volume="ftr_reg_redis_data"
    
    # Проверяем существование volume для PostgreSQL
    if docker volume ls --format '{{.Name}}' | grep -q "^${postgres_volume}$"; then
        echo -e "${GREEN}✓ Volume PostgreSQL найден: ${postgres_volume}${NC}"
        return 0
    else
        echo -e "${YELLOW}⚠ Volume PostgreSQL не найден: ${postgres_volume}${NC}"
        return 1
    fi
}

# Функция 3: Установка обновлений
install_updates() {
    show_header
    echo -e "${GREEN}=== Установка обновлений ===${NC}"
    echo ""
    
    # Проверяем наличие docker-compose.yml
    if [ ! -f docker-compose.yml ]; then
        echo -e "${RED}Ошибка: файл docker-compose.yml не найден!${NC}"
        read -p "Нажмите Enter для продолжения..."
        return
    fi
    
    # Проверяем существование volumes перед обновлением
    echo -e "${YELLOW}Проверка volumes БД...${NC}"
    check_volumes
    volume_exists=$?
    
    # Создаём резервную копию БД перед обновлением
    backup_database
    
    echo ""
    echo -e "${BLUE}⚠ ВАЖНО: При обновлении volumes НЕ будут удалены${NC}"
    echo -e "${BLUE}⚠ Используется команда 'docker-compose down' БЕЗ флага -v${NC}"
    echo ""
    
    # КРИТИЧЕСКИ ВАЖНО: НЕ останавливаем postgres контейнер вообще!
    # Пересобираем и перезапускаем только backend и frontend, postgres остаётся работать
    
    echo -e "${YELLOW}Проверка состояния контейнера PostgreSQL...${NC}"
    if docker ps --format '{{.Names}}' | grep -q "^ftr_postgres$"; then
        echo -e "${GREEN}✓ Контейнер PostgreSQL работает, НЕ будет остановлен${NC}"
        postgres_running=true
    elif docker ps -a --format '{{.Names}}' | grep -q "^ftr_postgres$"; then
        echo -e "${YELLOW}⚠ Контейнер PostgreSQL остановлен, запускаем его...${NC}"
        docker-compose up -d postgres 2>/dev/null || docker compose up -d postgres
        sleep 5
        postgres_running=true
    else
        echo -e "${YELLOW}⚠ Контейнер PostgreSQL не найден, будет создан заново${NC}"
        postgres_running=false
    fi
    
    # Проверяем, что volume существует
    if [ $volume_exists -eq 0 ]; then
        echo -e "${GREEN}✓ Volume PostgreSQL существует: ftr_reg_postgres_data${NC}"
    else
        echo -e "${YELLOW}⚠ Volume PostgreSQL не найден, будет создан новый${NC}"
    fi
    
    echo ""
    echo -e "${YELLOW}Остановка только backend и frontend контейнеров...${NC}"
    docker-compose stop backend frontend 2>/dev/null || docker compose stop backend frontend
    
    echo ""
    echo -e "${GREEN}✓ Backend и Frontend остановлены, PostgreSQL продолжает работать${NC}"
    
    echo ""
    echo -e "${YELLOW}Пересборка backend и frontend (PostgreSQL НЕ трогается)...${NC}"
    # Пересобираем только backend и frontend, postgres не трогаем
    docker-compose build backend frontend 2>/dev/null || docker compose build backend frontend
    
    if [ $? -ne 0 ]; then
        echo -e "${RED}✗ Ошибка при пересборке контейнеров!${NC}"
        read -p "Нажмите Enter для продолжения..."
        return 1
    fi
    
    echo ""
    echo -e "${YELLOW}Запуск backend и frontend (PostgreSQL уже работает)...${NC}"
    # Запускаем backend и frontend с --no-deps, чтобы не трогать зависимости (postgres, redis)
    docker-compose up -d --no-deps backend frontend 2>/dev/null || docker compose up -d --no-deps backend frontend
    
    # Убеждаемся, что postgres всё ещё работает
    if [ "$postgres_running" = true ]; then
        if ! docker ps --format '{{.Names}}' | grep -q "^ftr_postgres$"; then
            echo -e "${RED}✗ КРИТИЧЕСКАЯ ОШИБКА: Контейнер PostgreSQL был остановлен!${NC}"
            echo -e "${YELLOW}Запускаем PostgreSQL...${NC}"
            docker-compose up -d postgres 2>/dev/null || docker compose up -d postgres
            sleep 5
        else
            echo -e "${GREEN}✓ Контейнер PostgreSQL продолжает работать${NC}"
        fi
    fi
    
    # Финальная проверка volumes
    if [ $volume_exists -eq 0 ]; then
        if ! docker volume ls --format '{{.Name}}' | grep -q "^ftr_reg_postgres_data$"; then
            echo -e "${RED}✗ КРИТИЧЕСКАЯ ОШИБКА: Volume PostgreSQL был удалён!${NC}"
            echo -e "${RED}✗ Немедленно проверьте состояние БД!${NC}"
            read -p "Нажмите Enter для продолжения..."
            return 1
        fi
        echo -e "${GREEN}✓ Volume PostgreSQL подтверждён после обновления${NC}"
    fi
    
    echo ""
    echo -e "${GREEN}✓ Контейнеры успешно пересобраны и запущены${NC}"
    echo ""
    echo -e "${YELLOW}Статус контейнеров:${NC}"
    docker-compose ps 2>/dev/null || docker compose ps
    
    # Проверяем, что postgres работает и данные доступны
    echo ""
    echo -e "${YELLOW}Проверка доступности БД...${NC}"
    sleep 5  # Даём время БД на полную инициализацию
    
    if docker ps --format '{{.Names}}' | grep -q "^ftr_postgres$"; then
        echo -e "${GREEN}✓ Контейнер PostgreSQL запущен${NC}"
        
        # Ждём, пока БД станет доступной
        db_available=false
        for i in {1..10}; do
            if docker exec ftr_postgres psql -U ${POSTGRES_USER:-ftr_user} -d ${POSTGRES_DB:-ftr_db} -c "SELECT 1" > /dev/null 2>&1; then
                echo -e "${GREEN}✓ База данных доступна и работает${NC}"
                db_available=true
                
                # Проверяем наличие таблиц
                table_count=$(docker exec ftr_postgres psql -U ${POSTGRES_USER:-ftr_user} -d ${POSTGRES_DB:-ftr_db} -t -c "SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = 'public';" 2>/dev/null | tr -d ' ')
                if [ -n "$table_count" ] && [ "$table_count" -gt "0" ]; then
                    echo -e "${GREEN}✓ В базе данных найдено таблиц: ${table_count}${NC}"
                    
                    # Проверяем наличие данных в основных таблицах
                    event_count=$(docker exec ftr_postgres psql -U ${POSTGRES_USER:-ftr_user} -d ${POSTGRES_DB:-ftr_db} -t -c "SELECT COUNT(*) FROM \"Event\";" 2>/dev/null | tr -d ' ')
                    if [ -n "$event_count" ]; then
                        echo -e "${GREEN}✓ Событий в БД: ${event_count}${NC}"
                    fi
                else
                    echo -e "${YELLOW}⚠ В базе данных нет таблиц (возможно, БД пустая или миграции не применены)${NC}"
                    echo -e "${YELLOW}⚠ Проверьте логи backend для информации о миграциях${NC}"
                fi
                break
            else
                if [ $i -eq 10 ]; then
                    echo -e "${RED}✗ База данных недоступна после 10 попыток!${NC}"
                    echo -e "${YELLOW}Проверьте логи PostgreSQL:${NC}"
                    docker-compose logs --tail=30 postgres 2>/dev/null || docker compose logs --tail=30 postgres
                else
                    sleep 2
                fi
            fi
        done
        
        if [ "$db_available" = false ]; then
            echo -e "${RED}✗ ВНИМАНИЕ: База данных недоступна!${NC}"
            echo -e "${YELLOW}Проверьте логи PostgreSQL выше${NC}"
        fi
    else
        echo -e "${RED}✗ Контейнер PostgreSQL не запущен!${NC}"
        echo -e "${YELLOW}Попытка запуска...${NC}"
        docker-compose up -d postgres 2>/dev/null || docker compose up -d postgres
        sleep 5
    fi
    
    echo ""
    echo -e "${YELLOW}Логи последних 20 строк backend:${NC}"
    docker-compose logs --tail=20 backend 2>/dev/null || docker compose logs --tail=20 backend
    
    echo ""
    read -p "Нажмите Enter для продолжения..."
}

# Функция для просмотра логов
view_logs() {
    while true; do
        show_header
        echo -e "${GREEN}=== Просмотр логов ===${NC}"
        echo ""
        echo "Выберите сервис для просмотра логов:"
        echo "1) Backend (последние 50 строк)"
        echo "2) Frontend (последние 50 строк)"
        echo "3) PostgreSQL (последние 50 строк)"
        echo "4) Redis (последние 50 строк)"
        echo "5) Все сервисы (последние 50 строк)"
        echo "6) Backend (следить в реальном времени, Ctrl+C для выхода)"
        echo "7) Frontend (следить в реальном времени, Ctrl+C для выхода)"
        echo "8) Все сервисы (следить в реальном времени, Ctrl+C для выхода)"
        echo "9) Назад"
        echo ""
        read -p "Ваш выбор: " log_choice
        
        case $log_choice in
            1)
                show_header
                echo -e "${GREEN}=== Логи Backend (последние 50 строк) ===${NC}"
                echo ""
                docker-compose logs --tail=50 backend 2>/dev/null || docker compose logs --tail=50 backend
                echo ""
                read -p "Нажмите Enter для продолжения..."
                ;;
            2)
                show_header
                echo -e "${GREEN}=== Логи Frontend (последние 50 строк) ===${NC}"
                echo ""
                docker-compose logs --tail=50 frontend 2>/dev/null || docker compose logs --tail=50 frontend
                echo ""
                read -p "Нажмите Enter для продолжения..."
                ;;
            3)
                show_header
                echo -e "${GREEN}=== Логи PostgreSQL (последние 50 строк) ===${NC}"
                echo ""
                docker-compose logs --tail=50 postgres 2>/dev/null || docker compose logs --tail=50 postgres
                echo ""
                read -p "Нажмите Enter для продолжения..."
                ;;
            4)
                show_header
                echo -e "${GREEN}=== Логи Redis (последние 50 строк) ===${NC}"
                echo ""
                docker-compose logs --tail=50 redis 2>/dev/null || docker compose logs --tail=50 redis
                echo ""
                read -p "Нажмите Enter для продолжения..."
                ;;
            5)
                show_header
                echo -e "${GREEN}=== Логи всех сервисов (последние 50 строк) ===${NC}"
                echo ""
                docker-compose logs --tail=50 2>/dev/null || docker compose logs --tail=50
                echo ""
                read -p "Нажмите Enter для продолжения..."
                ;;
            6)
                show_header
                echo -e "${GREEN}=== Логи Backend (реальное время) ===${NC}"
                echo -e "${YELLOW}Нажмите Ctrl+C для выхода${NC}"
                echo ""
                docker-compose logs -f backend 2>/dev/null || docker compose logs -f backend
                read -p "Нажмите Enter для продолжения..."
                ;;
            7)
                show_header
                echo -e "${GREEN}=== Логи Frontend (реальное время) ===${NC}"
                echo -e "${YELLOW}Нажмите Ctrl+C для выхода${NC}"
                echo ""
                docker-compose logs -f frontend 2>/dev/null || docker compose logs -f frontend
                read -p "Нажмите Enter для продолжения..."
                ;;
            8)
                show_header
                echo -e "${GREEN}=== Логи всех сервисов (реальное время) ===${NC}"
                echo -e "${YELLOW}Нажмите Ctrl+C для выхода${NC}"
                echo ""
                docker-compose logs -f 2>/dev/null || docker compose logs -f
                read -p "Нажмите Enter для продолжения..."
                ;;
            9)
                return
                ;;
            *)
                echo -e "${RED}Неверный выбор!${NC}"
                sleep 1
                ;;
        esac
    done
}

# Функция для быстрого обновления (обновить репозиторий + установить обновления)
quick_update() {
    show_header
    echo -e "${GREEN}=== Быстрое обновление ===${NC}"
    echo ""
    echo -e "${BLUE}⚠ ВАЖНО: Данные БД будут сохранены (volumes не удаляются)${NC}"
    echo -e "${BLUE}⚠ Перед обновлением будет создана резервная копия БД${NC}"
    echo ""
    read -p "Продолжить обновление? (y/n): " confirm
    if [ "$confirm" != "y" ] && [ "$confirm" != "Y" ]; then
        echo -e "${YELLOW}Обновление отменено${NC}"
        sleep 2
        return
    fi
    
    echo ""
    echo -e "${YELLOW}Шаг 1: Обновление репозитория...${NC}"
    update_repository_silent
    
    echo ""
    echo -e "${YELLOW}Шаг 2: Установка обновлений...${NC}"
    install_updates
}

# Тихая версия обновления репозитория (без меню)
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

# Главное меню
main_menu() {
    while true; do
        show_header
        echo -e "${GREEN}Главное меню:${NC}"
        echo ""
        echo "1) Мониторинг Docker (статус контейнеров и ресурсы)"
        echo "2) Обновить данные из репозитория"
        echo "3) Установить обновления (пересобрать и запустить контейнеры)"
        echo "4) Быстрое обновление (обновить репозиторий + установить обновления)"
        echo "5) Просмотр логов"
        echo "6) Статус контейнеров"
        echo "7) Остановить все контейнеры"
        echo "8) Запустить все контейнеры"
        echo "9) Перезапустить все контейнеры"
        echo "0) Выход"
        echo ""
        read -p "Ваш выбор: " choice
        
        case $choice in
            1)
                monitor_docker
                ;;
            2)
                update_repository
                ;;
            3)
                install_updates
                ;;
            4)
                quick_update
                ;;
            5)
                view_logs
                ;;
            6)
                show_header
                echo -e "${GREEN}=== Статус контейнеров ===${NC}"
                echo ""
                docker-compose ps 2>/dev/null || docker compose ps
                echo ""
                read -p "Нажмите Enter для продолжения..."
                ;;
            7)
                show_header
                echo -e "${YELLOW}Остановка всех контейнеров (volumes гарантированно сохраняются)...${NC}"
                echo -e "${BLUE}⚠ ВАЖНО: Используется 'stop' вместо 'down' для защиты volumes${NC}"
                # КРИТИЧЕСКИ ВАЖНО: Используем 'stop' вместо 'down', чтобы НЕ удалять контейнеры и volumes
                docker-compose stop 2>/dev/null || docker compose stop
                echo -e "${GREEN}✓ Контейнеры остановлены, данные БД гарантированно сохранены${NC}"
                sleep 2
                ;;
            8)
                show_header
                echo -e "${YELLOW}Запуск всех контейнеров...${NC}"
                docker-compose up -d 2>/dev/null || docker compose up -d
                echo -e "${GREEN}✓ Контейнеры запущены${NC}"
                sleep 2
                ;;
            9)
                show_header
                echo -e "${YELLOW}Перезапуск всех контейнеров...${NC}"
                docker-compose restart 2>/dev/null || docker compose restart
                echo -e "${GREEN}✓ Контейнеры перезапущены${NC}"
                sleep 2
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
    check_docker_compose
    check_git
    
    # Обработка сигналов для корректного выхода из мониторинга
    trap 'echo ""; echo -e "${YELLOW}Выход из мониторинга...${NC}"; sleep 1; main_menu' INT
    
    # Запуск главного меню
    main_menu
}

# Запуск скрипта
main

