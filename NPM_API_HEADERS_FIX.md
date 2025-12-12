# Исправление: API не работает - неправильные заголовки

## Проблема

Фронтенд открывается, но API запросы не работают. В логах backend видно:
- `Host: localhost:3001` (должно быть доменное имя)
- `X-Forwarded-For: undefined` (заголовки не передаются)
- `Origin: undefined` (Origin не передается)

## Решение

Нужно добавить правильные заголовки в Custom Location для `/api` в NPM.

### Шаг 1: Откройте Custom Location для `/api`

В NPM веб-интерфейсе:
1. Откройте Proxy Host для `ftr.lilfil.ru`
2. Перейдите на вкладку **Custom Locations**
3. Откройте Location `/api`
4. Перейдите на вкладку **Advanced**

### Шаг 2: Добавьте Custom Nginx Configuration

В поле **Custom Nginx Configuration** вставьте следующий код:

```nginx
# Правильная передача заголовков
proxy_set_header Host $host;
proxy_set_header X-Real-IP $remote_addr;
proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
proxy_set_header X-Forwarded-Proto $scheme;
proxy_set_header X-Forwarded-Host $host;
proxy_set_header X-Forwarded-Port $server_port;

# Передаем оригинальный Origin для CORS
proxy_set_header Origin $http_origin;

# Таймауты
proxy_connect_timeout 60s;
proxy_send_timeout 60s;
proxy_read_timeout 60s;

# Отключаем буферизацию
proxy_buffering off;
```

### Шаг 3: Сохраните изменения

Нажмите **Save** и подождите несколько секунд, пока NPM применит изменения.

### Шаг 4: Проверьте

После сохранения проверьте логи backend:

```bash
docker-compose logs backend | tail -20
```

Теперь должны появиться правильные заголовки:
- `Host: ftr.lilfil.ru` (или правильный домен)
- `X-Forwarded-For: <IP адрес>`
- `Origin: https://ftr.lilfil.ru`

## Альтернативный вариант: Проверка настроек в NPM

Если Custom Nginx Configuration не помогает, проверьте:

1. **Scheme:** Должен быть `http` (не `https`)
2. **Forward Hostname / IP:** `192.168.1.138`
3. **Forward Port:** `3001`
4. **Websockets Support:** ✅ Включено

## Проверка работы API

После исправления попробуйте:

1. Откройте сайт: `https://ftr.lilfil.ru`
2. Попробуйте войти в систему
3. Проверьте консоль браузера (F12) на наличие ошибок API

Если все правильно настроено, запросы к API должны работать.

