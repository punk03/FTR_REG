# Настройка через Nginx Proxy Manager

Эта инструкция поможет настроить проксирование для `ftr.lilfil.ru` через Nginx Proxy Manager.

## Предварительные требования

1. Nginx Proxy Manager установлен и работает
2. Доступ к веб-интерфейсу NPM (обычно `http://your-server-ip:81`)
3. Docker контейнеры запущены на сервере с IP `192.168.1.138`
4. Порты 3000 (frontend) и 3001 (backend) доступны с сервера NPM

## Шаг 1: Настройка Proxy Host для Frontend

1. Войдите в веб-интерфейс Nginx Proxy Manager
2. Перейдите в **Proxy Hosts** → **Add Proxy Host**
3. Заполните форму:

### Details (Основные настройки)

- **Domain Names:** `ftr.lilfil.ru`
- **Scheme:** `http`
- **Forward Hostname / IP:** `192.168.1.138`
- **Forward Port:** `3000`
- **Cache Assets:** ✅ (включено)
- **Block Common Exploits:** ✅ (включено)
- **Websockets Support:** ✅ (включено) - **ВАЖНО!**

### SSL (SSL сертификат)

- **SSL Certificate:** Выберите **Request a new SSL Certificate**
- **Force SSL:** ✅ (включено)
- **HTTP/2 Support:** ✅ (включено)
- **HSTS Enabled:** ✅ (включено)
- **HSTS Subdomains:** ✅ (включено)

Нажмите **Save** и дождитесь получения SSL сертификата.

## Шаг 2: Настройка Custom Location для API

После создания основного Proxy Host нужно добавить Custom Location для API запросов:

1. Откройте созданный Proxy Host для `ftr.lilfil.ru`
2. Перейдите на вкладку **Custom Locations**
3. Нажмите **Add Location**

### Настройки Custom Location:

- **Location:** `/api`
- **Scheme:** `http`
- **Forward Hostname / IP:** `192.168.1.138`
- **Forward Port:** `3001`
- **Websockets Support:** ✅ (включено) - **ВАЖНО!**

### Advanced (Дополнительные настройки)

Вставьте следующий код в поле **Custom Nginx Configuration**:

```nginx
# Увеличенные таймауты для API
proxy_connect_timeout 60s;
proxy_send_timeout 60s;
proxy_read_timeout 60s;

# Отключаем буферизацию для streaming ответов
proxy_buffering off;

# Передаем оригинальный Origin для CORS
proxy_set_header Origin $http_origin;

# Дополнительные заголовки
proxy_set_header X-Forwarded-Host $host;
proxy_set_header X-Forwarded-Port $server_port;
```

Нажмите **Save**.

## Шаг 3: Проверка настройки

После сохранения проверьте:

1. **Проверка frontend:**
   ```bash
   curl -I https://ftr.lilfil.ru
   ```

2. **Проверка API:**
   ```bash
   curl https://ftr.lilfil.ru/api/health
   ```

3. **Откройте в браузере:** `https://ftr.lilfil.ru`

## Шаг 4: Настройка CORS на Backend

Убедитесь, что backend разрешает запросы с нового домена:

1. На Docker сервере обновите код:
   ```bash
   cd /path/to/FTR_REG
   git pull
   docker-compose build backend
   docker-compose up -d backend
   ```

2. Проверьте переменную окружения `CORS_ORIGIN` в `.env` или `docker-compose.yml`:
   ```bash
   # Должно содержать:
   CORS_ORIGIN=http://localhost:3000,http://localhost:5173,https://ftr.lilfil.ru,http://ftr.lilfil.ru
   ```

## Альтернативный вариант: Два отдельных Proxy Host

Если Custom Locations не работают, можно создать два отдельных Proxy Host:

### Proxy Host 1: Frontend

- **Domain Names:** `ftr.lilfil.ru`
- **Forward Hostname / IP:** `192.168.1.138`
- **Forward Port:** `3000`
- **Websockets Support:** ✅

### Proxy Host 2: Backend API

- **Domain Names:** `api.ftr.lilfil.ru` (или используйте поддомен)
- **Forward Hostname / IP:** `192.168.1.138`
- **Forward Port:** `3001`
- **Websockets Support:** ✅

Затем в frontend настройте `VITE_API_URL=https://api.ftr.lilfil.ru` (но это требует изменений в коде).

## Устранение проблем

### Проблема: 502 Bad Gateway

**Причины и решения:**

1. **Порты недоступны:**
   ```bash
   # На сервере с Docker контейнерами
   sudo ufw allow from IP_СЕРВЕРА_NPM to any port 3000
   sudo ufw allow from IP_СЕРВЕРА_NPM to any port 3001
   ```

2. **Docker контейнеры не запущены:**
   ```bash
   docker-compose ps
   docker-compose up -d
   ```

3. **Неправильный IP адрес:**
   - Проверьте IP адрес Docker сервера: `ip addr show` или `hostname -I`
   - Обновите Forward Hostname в NPM

### Проблема: CORS ошибки

**Решение:**
1. Убедитесь, что backend обновлен с поддержкой `ftr.lilfil.ru`
2. Проверьте логи backend: `docker-compose logs backend | grep CORS`
3. Убедитесь, что `Websockets Support` включен в NPM

### Проблема: WebSocket не работает

**Решение:**
- Включите **Websockets Support** в настройках Proxy Host
- Проверьте, что в Custom Location также включен WebSockets Support

### Проблема: SSL сертификат не выдается

**Решение:**
1. Убедитесь, что домен `ftr.lilfil.ru` указывает на IP сервера NPM
2. Проверьте, что порт 80 открыт для Let's Encrypt
3. В NPM попробуйте выдать сертификат вручную через SSL Certificates

## Проверка логов

В Nginx Proxy Manager можно посмотреть логи:

1. Перейдите в **System Logs** → **Nginx Logs**
2. Или через SSH на сервере:
   ```bash
   # Логи NPM
   docker logs npm-proxy-manager
   
   # Или если используете стандартный путь:
   tail -f /data/logs/proxy-host-*.log
   ```

## Дополнительные настройки безопасности

В NPM можно включить:

1. **Access Lists** - ограничение доступа по IP
2. **Block Common Exploits** - блокировка распространенных атак
3. **HSTS** - принудительное использование HTTPS

## Важные моменты

1. **Websockets Support** должен быть включен для обоих Proxy Host (frontend и API location)
2. **Custom Location** для `/api` должен указывать на порт `3001` (backend)
3. **SSL сертификат** выдается автоматически через Let's Encrypt в NPM
4. **CORS** настраивается на backend, NPM просто проксирует запросы

## После настройки

После успешной настройки:

1. ✅ Сайт доступен по `https://ftr.lilfil.ru`
2. ✅ API запросы проксируются на backend
3. ✅ SSL сертификат работает
4. ✅ CORS настроен правильно
5. ✅ WebSockets работают (если используются)

Если что-то не работает, проверьте логи в NPM и убедитесь, что порты доступны с сервера NPM.

