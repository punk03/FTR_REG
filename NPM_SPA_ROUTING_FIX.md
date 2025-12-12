# Исправление: 404 на страницах SPA (например, /login)

## Проблема

Запросы к страницам SPA (например, `/login`) возвращают 404. Это происходит потому, что NPM не правильно проксирует запросы к frontend для SPA роутинга.

## Причина

В SPA (Single Page Application) все маршруты должны проксироваться к frontend, который затем обрабатывает роутинг на клиенте. NPM должен проксировать все запросы (кроме `/api`) к frontend контейнеру.

## Решение

### Шаг 1: Проверьте основной Proxy Host в NPM

В NPM для Proxy Host `ftr.lilfil.ru`:

1. **Details (Основные настройки):**
   - **Domain Names:** `ftr.lilfil.ru`
   - **Scheme:** `http` (для подключения к Docker контейнеру)
   - **Forward Hostname / IP:** `192.168.1.138`
   - **Forward Port:** `3000` (frontend контейнер)
   - **Websockets Support:** ✅ Включено

2. **Advanced → Custom Nginx Configuration:**

Добавьте следующую конфигурацию для правильной работы SPA:

```nginx
# SPA роутинг - все запросы (кроме /api) идут к frontend
# Frontend обработает роутинг на клиенте

# Убедитесь, что Host передается правильно
proxy_set_header Host $host;
proxy_set_header X-Real-IP $remote_addr;
proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
proxy_set_header X-Forwarded-Proto $scheme;
proxy_set_header X-Forwarded-Host $host;
proxy_set_header X-Forwarded-Port $server_port;

# Таймауты
proxy_connect_timeout 60s;
proxy_send_timeout 60s;
proxy_read_timeout 60s;
```

### Шаг 2: Проверьте Custom Location для /api

Убедитесь, что Custom Location `/api` настроен правильно и находится **ПЕРЕД** основным Proxy Host в приоритете.

В NPM порядок важен:
1. Сначала обрабатываются Custom Locations (например, `/api`)
2. Затем основной Proxy Host (все остальное)

### Шаг 3: Проверьте конфигурацию frontend Nginx

Убедитесь, что внутренний Nginx в frontend контейнере правильно настроен для SPA.

Проверьте файл `frontend/nginx.conf`:

```nginx
location / {
    try_files $uri $uri/ /index.html;  # ← Это важно для SPA!
}
```

Если этого нет, нужно обновить конфигурацию.

### Шаг 4: Проверьте SSL редирект

Убедитесь, что HTTP запросы редиректятся на HTTPS:

В NPM для Proxy Host `ftr.lilfil.ru`:
- **SSL Certificate:** Должен быть установлен
- **Force SSL:** ✅ Включено
- **HTTP/2 Support:** ✅ Включено

### Шаг 5: Проверка

После настройки:

1. **Откройте:** `https://ftr.lilfil.ru/login` (HTTPS!)
2. **Проверьте Network tab:**
   - Запрос должен идти на `https://ftr.lilfil.ru/login`
   - Статус должен быть 200 (не 404)
   - Ответ должен быть HTML страницей

3. **Проверьте логи frontend:**
   ```bash
   docker-compose logs frontend | tail -10
   ```
   Должны быть запросы к `/login`, `/`, и другим маршрутам SPA.

## Альтернативное решение: Явная настройка try_files

Если проблема сохраняется, в Custom Nginx Configuration основного Proxy Host добавьте:

```nginx
# Но это обычно не нужно, так как frontend Nginx уже настроен
# Это только если frontend Nginx не обрабатывает SPA роутинг
```

## Важно

1. **Все запросы к `/api`** должны идти через Custom Location к backend (порт 3001)
2. **Все остальные запросы** должны идти к frontend (порт 3000)
3. **Frontend Nginx** должен иметь `try_files $uri $uri/ /index.html;` для SPA роутинга
4. **Используйте HTTPS**, не HTTP!

## Проверка frontend/nginx.conf

Проверьте, что в `frontend/nginx.conf` есть правильная настройка для SPA:

```bash
docker exec ftr_frontend cat /etc/nginx/conf.d/default.conf | grep -A 5 "location /"
```

Должно быть:
```nginx
location / {
    try_files $uri $uri/ /index.html;
}
```

Если этого нет, нужно обновить `frontend/nginx.conf` и пересобрать frontend.

