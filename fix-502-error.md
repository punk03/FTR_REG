# Исправление ошибки 502 Bad Gateway

Ошибка 502 означает, что внешний Nginx не может подключиться к Docker контейнерам.

## Быстрое решение

### Шаг 1: Проверьте доступность портов

На внешней VM выполните:

```bash
# Замените 192.168.1.138 на IP вашего Docker сервера
curl -v http://192.168.1.138:3000
curl -v http://192.168.1.138:3001/api/health
```

Если не подключается, переходите к шагу 2.

### Шаг 2: Откройте порты на Docker сервере

На сервере с Docker контейнерами выполните:

```bash
# Узнайте IP адрес внешней VM
# Затем откройте порты для этого IP
sudo ufw allow from IP_ВНЕШНЕЙ_VM to any port 3000
sudo ufw allow from IP_ВНЕШНЕЙ_VM to any port 3001

# Или временно откройте для всех (НЕ рекомендуется для production)
sudo ufw allow 3000/tcp
sudo ufw allow 3001/tcp
```

### Шаг 3: Проверьте, что контейнеры запущены

На Docker сервере:

```bash
cd /path/to/FTR_REG
docker-compose ps

# Если контейнеры не запущены:
docker-compose up -d

# Проверьте логи:
docker-compose logs frontend | tail -20
docker-compose logs backend | tail -20
```

### Шаг 4: Используйте HTTP конфигурацию для тестирования

Если SSL сертификат еще не настроен или есть проблемы:

1. Скопируйте `nginx-external-vm-http-only.conf` на VM
2. Отредактируйте IP адрес в файле
3. Примените конфигурацию:

```bash
sudo cp nginx-external-vm-http-only.conf /etc/nginx/sites-available/ftr.lilfil.ru
sudo ln -sf /etc/nginx/sites-available/ftr.lilfil.ru /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx
```

### Шаг 5: Запустите диагностику

Используйте скрипт диагностики:

```bash
chmod +x diagnose-502-error.sh
./diagnose-502-error.sh 192.168.1.138
```

## Детальная диагностика

### Проверка 1: Доступность портов

```bash
# С внешней VM
telnet 192.168.1.138 3000
telnet 192.168.1.138 3001

# Или используйте nc (netcat)
nc -zv 192.168.1.138 3000
nc -zv 192.168.1.138 3001
```

### Проверка 2: Логи Nginx

```bash
# На внешней VM
sudo tail -f /var/log/nginx/ftr.lilfil.ru_error.log

# Типичные ошибки:
# - "connect() failed (111: Connection refused)" - порт закрыт или контейнер не запущен
# - "connect() failed (113: No route to host)" - файрвол блокирует
# - "upstream timed out" - таймаут подключения
```

### Проверка 3: Проверка файрвола на Docker сервере

```bash
# На Docker сервере
sudo ufw status
sudo iptables -L -n | grep 3000
sudo iptables -L -n | grep 3001
```

### Проверка 4: Проверка сетевого подключения

```bash
# С внешней VM - проверьте ping
ping 192.168.1.138

# Проверьте маршрутизацию
traceroute 192.168.1.138
```

### Проверка 5: Проверка конфигурации Nginx

```bash
# На внешней VM
sudo nginx -t

# Проверьте, что конфигурация активна
ls -la /etc/nginx/sites-enabled/

# Проверьте содержимое конфигурации
sudo cat /etc/nginx/sites-available/ftr.lilfil.ru | grep -E "server.*:3000|server.*:3001"
```

## Частые проблемы и решения

### Проблема: "Connection refused"

**Причина:** Порт закрыт или контейнер не запущен

**Решение:**
1. Проверьте статус контейнеров: `docker-compose ps`
2. Запустите контейнеры: `docker-compose up -d`
3. Проверьте, что порты открыты: `docker-compose port frontend 80`

### Проблема: "No route to host"

**Причина:** Файрвол блокирует подключение

**Решение:**
```bash
# На Docker сервере
sudo ufw allow from IP_ВНЕШНЕЙ_VM to any port 3000
sudo ufw allow from IP_ВНЕШНЕЙ_VM to any port 3001
```

### Проблема: SSL сертификат не работает

**Решение:** Используйте HTTP конфигурацию (`nginx-external-vm-http-only.conf`) для тестирования

### Проблема: Неправильный IP адрес

**Решение:**
1. Узнайте правильный IP Docker сервера: `ip addr show` или `hostname -I`
2. Обновите конфигурацию Nginx
3. Перезагрузите Nginx: `sudo systemctl reload nginx`

### Проблема: Контейнеры слушают только на localhost

**Решение:** Проверьте `docker-compose.yml` - порты должны быть в формате `"3000:80"`, а не `"127.0.0.1:3000:80"`

## После исправления

1. Проверьте доступность:
   ```bash
   curl http://ftr.lilfil.ru/api/health
   ```

2. Откройте в браузере: `http://ftr.lilfil.ru`

3. Если все работает, настройте SSL и переключитесь на HTTPS конфигурацию

