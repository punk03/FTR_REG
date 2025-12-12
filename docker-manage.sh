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
    
    echo -e "${YELLOW}Остановка текущих контейнеров (volumes сохраняются)...${NC}"
    # Важно: НЕ используем флаг -v или --volumes, чтобы сохранить данные БД
    docker-compose down 2>/dev/null || docker compose down
    
    echo ""
    echo -e "${GREEN}✓ Контейнеры остановлены, данные БД сохранены${NC}"
    echo ""
    echo -e "${YELLOW}Пересборка и запуск контейнеров...${NC}"
    docker-compose up -d --build 2>/dev/null || docker compose up -d --build
    
    if [ $? -eq 0 ]; then
        echo ""
        echo -e "${GREEN}✓ Контейнеры успешно пересобраны и запущены${NC}"
        echo ""
        echo -e "${YELLOW}Статус контейнеров:${NC}"
        docker-compose ps 2>/dev/null || docker compose ps
        
        echo ""
        echo -e "${YELLOW}Логи последних 20 строк:${NC}"
        docker-compose logs --tail=20 2>/dev/null || docker compose logs --tail=20
    else
        echo -e "${RED}✗ Ошибка при пересборке контейнеров!${NC}"
    fi
    
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
                echo -e "${YELLOW}Остановка всех контейнеров (volumes сохраняются)...${NC}"
                # Важно: НЕ используем флаг -v или --volumes, чтобы сохранить данные БД
                docker-compose down 2>/dev/null || docker compose down
                echo -e "${GREEN}✓ Контейнеры остановлены, данные БД сохранены${NC}"
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

