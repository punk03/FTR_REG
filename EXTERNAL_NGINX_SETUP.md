# Настройка внешнего Nginx на отдельной VM

Это руководство поможет настроить внешний Nginx на отдельной виртуальной машине для работы с Docker контейнерами на другом сервере.

## Предварительные требования

1. Отдельная VM с установленным Nginx
2. Домен `ftr.lilfil.ru` привязан к IP адресу этой VM
3. Docker контейнеры запущены на другом сервере (IP_АДРЕС_DOCKER_СЕРВЕРА)
4. Порты 3000 (frontend) и 3001 (backend) доступны с VM на Docker сервер

## Шаг 1: Установка Nginx (если еще не установлен)

```bash
# Ubuntu/Debian
sudo apt update
sudo apt install nginx

# CentOS/RHEL
sudo yum install nginx
```

## Шаг 2: Настройка SSL сертификата

### Вариант A: Let's Encrypt (рекомендуется)

```bash
# Установка Certbot
sudo apt install certbot python3-certbot-nginx  # Ubuntu/Debian
# или
sudo yum install certbot python3-certbot-nginx  # CentOS/RHEL

# Получение сертификата
sudo certbot --nginx -d ftr.lilfil.ru -d www.ftr.lilfil.ru

# Автоматическое обновление
sudo certbot renew --dry-run
```

### Вариант B: Самоподписанный сертификат (для тестирования)

```bash
sudo mkdir -p /etc/nginx/ssl
sudo openssl req -x509 -nodes -days 365 -newkey rsa:2048 \
  -keyout /etc/nginx/ssl/ftr.lilfil.ru.key \
  -out /etc/nginx/ssl/ftr.lilfil.ru.crt
```

## Шаг 3: Создание конфигурации Nginx

1. Скопируйте файл `nginx-external-vm.conf.example` на VM:

```bash
# На вашем локальном компьютере
scp nginx-external-vm.conf.example user@vm-ip:/tmp/
```

2. На VM отредактируйте файл и замените `IP_АДРЕС_DOCKER_СЕРВЕРА` на реальный IP:

```bash
sudo nano /tmp/nginx-external-vm.conf.example
# Найдите и замените IP_АДРЕС_DOCKER_СЕРВЕРА на реальный IP, например: 192.168.1.100
```

3. Скопируйте конфигурацию в sites-available:

```bash
sudo cp /tmp/nginx-external-vm.conf.example /etc/nginx/sites-available/ftr.lilfil.ru
```

4. Создайте симлинк в sites-enabled:

```bash
sudo ln -s /etc/nginx/sites-available/ftr.lilfil.ru /etc/nginx/sites-enabled/
```

5. Удалите дефолтную конфигурацию (если нужно):

```bash
sudo rm /etc/nginx/sites-enabled/default
```

## Шаг 4: Проверка конфигурации и перезапуск

```bash
# Проверка синтаксиса
sudo nginx -t

# Если все ОК, перезапустите Nginx
sudo systemctl restart nginx

# Проверка статуса
sudo systemctl status nginx
```

## Шаг 5: Настройка файрвола

Убедитесь, что порты 80 и 443 открыты:

```bash
# UFW (Ubuntu)
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
sudo ufw reload

# firewalld (CentOS/RHEL)
sudo firewall-cmd --permanent --add-service=http
sudo firewall-cmd --permanent --add-service=https
sudo firewall-cmd --reload
```

## Шаг 6: Обновление CORS на Docker сервере

На сервере с Docker контейнерами:

1. Обновите `.env` файл или переменные окружения:

```bash
# Добавьте новый домен в CORS_ORIGIN
CORS_ORIGIN=http://localhost:3000,http://localhost:5173,https://ftr.lilfil.ru,http://ftr.lilfil.ru
```

2. Перезапустите backend контейнер:

```bash
cd /path/to/FTR_REG
docker-compose restart backend
```

Или если используете docker-compose:

```bash
docker-compose up -d --force-recreate backend
```

## Шаг 7: Проверка работы

1. Проверьте доступность сайта:
   ```bash
   curl -I https://ftr.lilfil.ru
   ```

2. Проверьте API:
   ```bash
   curl https://ftr.lilfil.ru/api/health
   ```

3. Откройте в браузере: `https://ftr.lilfil.ru`

## Устранение проблем

### Проблема: "502 Bad Gateway"

**Причина:** Nginx не может подключиться к Docker серверу.

**Решение:**
1. Проверьте доступность портов с VM:
   ```bash
   telnet 192.168.1.138 3000
   telnet 192.168.1.138 3001
   ```

2. Проверьте файрвол на Docker сервере:
   ```bash
   # На Docker сервере
   sudo ufw allow from VM_IP_ADDRESS to any port 3000
   sudo ufw allow from VM_IP_ADDRESS to any port 3001
   ```

3. Проверьте, что контейнеры запущены:
   ```bash
   # На Docker сервере
   docker-compose ps
   ```

### Проблема: CORS ошибки

**Причина:** Backend не разрешает запросы с нового домена.

**Решение:**
1. Проверьте логи backend:
   ```bash
   docker-compose logs backend | grep CORS
   ```

2. Убедитесь, что домен добавлен в `CORS_ORIGIN` в `.env`

3. Перезапустите backend контейнер

### Проблема: "Connection refused"

**Причина:** Docker контейнеры не слушают на внешних интерфейсах.

**Решение:**
1. Проверьте `docker-compose.yml` - порты должны быть открыты:
   ```yaml
   ports:
     - "3000:80"  # frontend
     - "3001:3001"  # backend
   ```

2. Убедитесь, что Docker слушает на всех интерфейсах (0.0.0.0), а не только на localhost

### Проблема: SSL сертификат не работает

**Решение:**
1. Проверьте пути к сертификатам в конфигурации Nginx
2. Проверьте права доступа:
   ```bash
   sudo chmod 644 /etc/letsencrypt/live/ftr.lilfil.ru/fullchain.pem
   sudo chmod 600 /etc/letsencrypt/live/ftr.lilfil.ru/privkey.pem
   ```

## Дополнительные настройки

### Логирование

Логи доступны по адресам:
- Access log: `/var/log/nginx/ftr.lilfil.ru_access.log`
- Error log: `/var/log/nginx/ftr.lilfil.ru_error.log`

Просмотр в реальном времени:
```bash
sudo tail -f /var/log/nginx/ftr.lilfil.ru_error.log
```

### Мониторинг

Настройте мониторинг доступности:
```bash
# Добавьте в crontab
*/5 * * * * curl -f https://ftr.lilfil.ru/api/health || echo "Site is down" | mail -s "Alert" admin@example.com
```

## Безопасность

1. **Ограничьте доступ к backend порту:**
   На Docker сервере разрешите доступ к порту 3001 только с IP адреса VM:
   ```bash
   sudo ufw allow from VM_IP_ADDRESS to any port 3001
   sudo ufw deny 3001
   ```

2. **Используйте fail2ban** для защиты от брутфорса:
   ```bash
   sudo apt install fail2ban
   ```

3. **Регулярно обновляйте Nginx:**
   ```bash
   sudo apt update && sudo apt upgrade nginx
   ```


