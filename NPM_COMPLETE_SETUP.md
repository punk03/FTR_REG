# Полная настройка NPM для работы сайта

## Проблема

Все контейнеры работают, но сайт возвращает 404. Это означает, что NPM не правильно проксирует запросы к frontend.

## Полная проверка и настройка

### Шаг 1: Проверьте основной Proxy Host в NPM

В веб-интерфейсе NPM:

1. **Откройте Proxy Hosts**
2. **Найдите Proxy Host для `ftr.lilfil.ru`**
3. **Проверьте настройки:**

#### Details (Основные настройки):
- ✅ **Domain Names:** `ftr.lilfil.ru`
- ✅ **Scheme:** `http` (НЕ `https`! Это для подключения к Docker контейнеру)
- ✅ **Forward Hostname / IP:** `192.168.1.138` (IP Docker сервера)
- ✅ **Forward Port:** `3000` (порт frontend контейнера)
- ✅ **Cache Assets:** Включено
- ✅ **Block Common Exploits:** Включено
- ✅ **Websockets Support:** Включено

#### SSL:
- ✅ **SSL Certificate:** Должен быть установлен (Request a new SSL Certificate)
- ✅ **Force SSL:** Включено (это редиректит HTTP → HTTPS)
- ✅ **HTTP/2 Support:** Включено
- ✅ **HSTS Enabled:** Включено

#### Advanced → Custom Nginx Configuration:
Добавьте (если еще нет):

```nginx
proxy_set_header Host $host;
proxy_set_header X-Real-IP $remote_addr;
proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
proxy_set_header X-Forwarded-Proto $scheme;
proxy_set_header X-Forwarded-Host $host;
proxy_set_header X-Forwarded-Port $server_port;
proxy_connect_timeout 60s;
proxy_send_timeout 60s;
proxy_read_timeout 60s;
```

### Шаг 2: Проверьте Custom Location для /api

Убедитесь, что Custom Location `/api` настроен:

- **Location:** `/api`
- **Scheme:** `http`
- **Forward Hostname / IP:** `192.168.1.138`
- **Forward Port:** `3001`
- **Websockets Support:** Включено

**Advanced → Custom Nginx Configuration:**

```nginx
proxy_set_header Origin $http_origin;
proxy_set_header Host $host;
proxy_set_header X-Real-IP $remote_addr;
proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
proxy_set_header X-Forwarded-Proto $scheme;
proxy_set_header X-Forwarded-Host $host;
proxy_set_header X-Forwarded-Port $server_port;
proxy_connect_timeout 60s;
proxy_send_timeout 60s;
proxy_read_timeout 60s;
proxy_buffering off;
```

### Шаг 3: Проверьте доступность frontend напрямую

На Docker сервере:

```bash
# Проверьте, что frontend отвечает
curl http://localhost:3000
curl http://192.168.1.138:3000
curl http://192.168.1.138:3000/login

# Все должны вернуть HTML (не 404)
```

### Шаг 4: Проверьте доступность с сервера NPM

На сервере с NPM:

```bash
# Проверьте подключение к Docker серверу
curl http://192.168.1.138:3000
curl http://192.168.1.138:3000/login

# Должны вернуть HTML
```

Если не работает, проверьте файрвол на Docker сервере:

```bash
# На Docker сервере
sudo ufw allow from IP_СЕРВЕРА_NPM to any port 3000
```

### Шаг 5: Проверьте логи NPM

Если есть доступ к серверу NPM:

```bash
# Логи NPM контейнера
docker logs npm-proxy-manager 2>&1 | tail -50 | grep -i error

# Или проверьте сгенерированную конфигурацию
docker exec npm-proxy-manager cat /data/nginx/proxy_host/*.conf | grep -A 20 "server_name ftr.lilfil.ru"
```

### Шаг 6: Пересоздайте Proxy Host

Если ничего не помогает:

1. **Удалите** существующий Proxy Host для `ftr.lilfil.ru`
2. **Создайте новый** с теми же настройками
3. **Сохраните** и подождите 30 секунд

### Шаг 7: Проверка после настройки

1. **Откройте:** `https://ftr.lilfil.ru` (HTTPS!)
2. **Должна открыться главная страница** (не 404)
3. **Попробуйте:** `https://ftr.lilfil.ru/login`
4. **Должна открыться страница входа** (не 404)

## Частые ошибки

### Ошибка 1: Forward Port указан неправильно

**Проверьте:** Forward Port должен быть `3000` (порт frontend контейнера), НЕ `80` и НЕ `3001`.

### Ошибка 2: Forward Hostname указан как localhost

**Проверьте:** Forward Hostname должен быть IP адресом Docker сервера (`192.168.1.138`), НЕ `localhost` и НЕ `127.0.0.1`.

### Ошибка 3: Scheme указан как https

**Проверьте:** Scheme должен быть `http` (для подключения к Docker контейнеру), НЕ `https`. SSL настраивается в разделе SSL, а не в Scheme.

### Ошибка 4: Порты не открыты

**Проверьте:** Порты 3000 и 3001 должны быть доступны с сервера NPM:

```bash
# На Docker сервере
sudo ufw allow from IP_СЕРВЕРА_NPM to any port 3000
sudo ufw allow from IP_СЕРВЕРА_NPM to any port 3001
```

## Финальная проверка

После всех настроек проверьте:

```bash
# 1. Frontend доступен напрямую
curl http://192.168.1.138:3000

# 2. Frontend доступен через NPM (HTTPS)
curl https://ftr.lilfil.ru

# 3. API доступен через NPM
curl https://ftr.lilfil.ru/api/health

# 4. Логи backend показывают правильные заголовки
docker-compose logs backend | tail -10
```

Все должно работать!

