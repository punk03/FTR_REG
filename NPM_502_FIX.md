# Исправление ошибки 502 Bad Gateway в Nginx Proxy Manager

## Диагностика проблемы

Ошибка 502 означает, что NPM не может подключиться к Docker контейнерам.

### Шаг 1: Проверьте подключение с сервера NPM

**На сервере с Nginx Proxy Manager выполните:**

```bash
# Скачайте и запустите скрипт диагностики
chmod +x check-npm-connection.sh
./check-npm-connection.sh 192.168.1.138
```

Или проверьте вручную:

```bash
# Проверка порта 3000 (Frontend)
curl -v http://192.168.1.138:3000

# Проверка порта 3001 (Backend)
curl -v http://192.168.1.138:3001/api/health

# Или используйте nc (netcat)
nc -zv 192.168.1.138 3000
nc -zv 192.168.1.138 3001
```

### Шаг 2: Откройте порты на Docker сервере

**На сервере с Docker контейнерами (192.168.1.138):**

```bash
# Узнайте IP адрес сервера NPM
# Затем откройте порты для этого IP:

# Замените IP_СЕРВЕРА_NPM на реальный IP адрес сервера с NPM
sudo ufw allow from IP_СЕРВЕРА_NPM to any port 3000
sudo ufw allow from IP_СЕРВЕРА_NPM to any port 3001

# Или временно откройте для всех (для тестирования)
sudo ufw allow 3000/tcp
sudo ufw allow 3001/tcp

# Проверьте статус файрвола
sudo ufw status
```

### Шаг 3: Проверьте настройки в NPM

В веб-интерфейсе NPM проверьте:

1. **Proxy Host для ftr.lilfil.ru:**
   - **Forward Hostname / IP:** Должен быть `192.168.1.138` (не `localhost`!)
   - **Forward Port:** `3000`
   - **Websockets Support:** ✅ Включено

2. **Custom Location для /api:**
   - **Location:** `/api`
   - **Forward Hostname / IP:** `192.168.1.138` (не `localhost`!)
   - **Forward Port:** `3001`
   - **Websockets Support:** ✅ Включено

### Шаг 4: Проверьте Docker контейнеры

**На Docker сервере:**

```bash
cd /path/to/FTR_REG

# Проверьте статус контейнеров
docker-compose ps

# Если контейнеры не запущены:
docker-compose up -d

# Проверьте логи
docker-compose logs frontend | tail -30
docker-compose logs backend | tail -30

# Проверьте, что порты действительно слушают
sudo netstat -tlnp | grep -E '3000|3001'
# Или
sudo ss -tlnp | grep -E '3000|3001'
```

### Шаг 5: Проверьте логи NPM

В веб-интерфейсе NPM:
- Перейдите в **System Logs** → **Nginx Logs**
- Ищите ошибки типа "connect() failed", "Connection refused", "No route to host"

Или через SSH на сервере NPM:

```bash
# Если NPM в Docker контейнере
docker logs npm-proxy-manager 2>&1 | grep -i error | tail -20

# Или стандартные логи Nginx
tail -f /data/logs/proxy-host-*.log
```

## Частые проблемы и решения

### Проблема 1: "Connection refused"

**Причина:** Порт закрыт файрволом или контейнер не запущен

**Решение:**
```bash
# На Docker сервере
sudo ufw allow from IP_СЕРВЕРА_NPM to any port 3000
sudo ufw allow from IP_СЕРВЕРА_NPM to any port 3001

# Проверьте контейнеры
docker-compose ps
docker-compose up -d
```

### Проблема 2: "No route to host"

**Причина:** Файрвол блокирует или неправильный IP

**Решение:**
1. Проверьте правильность IP адреса Docker сервера
2. Убедитесь, что серверы в одной сети
3. Откройте порты в файрволе

### Проблема 3: В NPM указан localhost вместо IP

**Причина:** В Forward Hostname указан `localhost` или `127.0.0.1`

**Решение:**
- В NPM измените Forward Hostname на реальный IP: `192.168.1.138`

### Проблема 4: Контейнеры слушают только на localhost

**Причина:** Docker порты привязаны только к localhost

**Решение:**
Проверьте `docker-compose.yml` - порты должны быть в формате:
```yaml
ports:
  - "3000:80"  # Правильно
  # НЕ "127.0.0.1:3000:80" - это привяжет только к localhost
```

### Проблема 5: Docker контейнеры не запущены

**Решение:**
```bash
cd /path/to/FTR_REG
docker-compose up -d
docker-compose ps  # Проверьте статус
```

## Правильная настройка в NPM

### Proxy Host (Основной):

```
Domain Names: ftr.lilfil.ru
Scheme: http
Forward Hostname / IP: 192.168.1.138  ← ВАЖНО: IP адрес, не localhost!
Forward Port: 3000
Websockets Support: ✅ Включено
```

### Custom Location для /api:

```
Location: /api
Scheme: http
Forward Hostname / IP: 192.168.1.138  ← ВАЖНО: IP адрес, не localhost!
Forward Port: 3001
Websockets Support: ✅ Включено
```

### Advanced → Custom Nginx Configuration:

```nginx
proxy_connect_timeout 60s;
proxy_send_timeout 60s;
proxy_read_timeout 60s;
proxy_buffering off;
proxy_set_header Origin $http_origin;
proxy_set_header X-Forwarded-Host $host;
proxy_set_header X-Forwarded-Port $server_port;
```

## Проверка после исправления

```bash
# С сервера NPM
curl http://192.168.1.138:3000
curl http://192.168.1.138:3001/api/health

# Через домен
curl https://ftr.lilfil.ru/api/health
```

Если все работает, откройте в браузере: `https://ftr.lilfil.ru`

## Дополнительная диагностика

Если проблема сохраняется:

1. **Проверьте сетевую связность:**
   ```bash
   # С сервера NPM
   ping 192.168.1.138
   traceroute 192.168.1.138
   ```

2. **Проверьте файрвол на Docker сервере:**
   ```bash
   sudo ufw status verbose
   sudo iptables -L -n -v | grep 3000
   sudo iptables -L -n -v | grep 3001
   ```

3. **Проверьте, что Docker слушает на всех интерфейсах:**
   ```bash
   sudo netstat -tlnp | grep docker
   # Должно быть 0.0.0.0:3000, а не 127.0.0.1:3000
   ```

4. **Проверьте логи NPM более детально:**
   ```bash
   docker logs npm-proxy-manager 2>&1 | tail -50
   ```

