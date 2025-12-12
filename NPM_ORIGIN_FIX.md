# Исправление: Origin не передается, авторизация не работает

## Проблема

API работает через curl, но при запросах из браузера:
- `Origin: undefined` в логах backend
- Ошибка "Не удалось подключиться к серверу"
- Авторизация не работает

## Причина

Origin заголовок не передается из браузера через NPM в backend, что вызывает проблемы с CORS.

## Решение

### Шаг 1: Проверьте Custom Nginx Configuration в NPM

В Custom Location `/api` в разделе **Advanced** → **Custom Nginx Configuration** должно быть:

```nginx
# ОБЯЗАТЕЛЬНО: Передаем оригинальный Origin от клиента
proxy_set_header Origin $http_origin;

# Основные заголовки
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

# Отключаем буферизацию
proxy_buffering off;
```

**Важно:** `proxy_set_header Origin $http_origin;` должна быть ПЕРВОЙ строкой!

### Шаг 2: Также добавьте в основной Proxy Host

В основном Proxy Host для `ftr.lilfil.ru` (не в Custom Location) также добавьте в **Advanced** → **Custom Nginx Configuration**:

```nginx
proxy_set_header Origin $http_origin;
proxy_set_header Host $host;
proxy_set_header X-Real-IP $remote_addr;
proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
proxy_set_header X-Forwarded-Proto $scheme;
```

### Шаг 3: Проверьте CORS настройки в backend

Убедитесь, что в `backend/src/index.ts` домен `ftr.lilfil.ru` добавлен в `productionOrigins`:

```typescript
const productionOrigins = [
  'http://95.71.125.8:3000',
  'http://95.71.125.8',
  'http://ftr.lil-fil.netcraze.pro:8080',
  'http://ftr.lil-fil.netcraze.pro',
  'https://ftr.lilfil.ru',  // ← Должно быть
  'http://ftr.lilfil.ru',   // ← Должно быть
];
```

### Шаг 4: Перезапустите backend

После изменений перезапустите backend:

```bash
cd /path/to/FTR_REG
git pull
docker-compose build backend
docker-compose up -d backend
```

### Шаг 5: Проверьте логи

После исправления проверьте логи:

```bash
docker-compose logs backend | tail -30
```

Теперь должны появиться:
- `Origin: https://ftr.lilfil.ru` (вместо `undefined`)
- `CORS allowed origin: https://ftr.lilfil.ru`

## Альтернативное решение: Явное указание Origin

Если проблема сохраняется, можно явно установить Origin в Custom Nginx Configuration:

```nginx
# Явно устанавливаем Origin для CORS
proxy_set_header Origin https://ftr.lilfil.ru;

# Остальные заголовки
proxy_set_header Host $host;
proxy_set_header X-Real-IP $remote_addr;
proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
proxy_set_header X-Forwarded-Proto $scheme;
proxy_set_header X-Forwarded-Host $host;
proxy_set_header X-Forwarded-Port $server_port;
```

Но лучше использовать `$http_origin` чтобы передавать оригинальный Origin от браузера.

## Проверка через браузер

После исправления:

1. Откройте сайт: `https://ftr.lilfil.ru`
2. Откройте DevTools (F12) → Network
3. Попробуйте войти
4. Проверьте запрос к `/api/auth/login`:
   - В Headers должен быть `Origin: https://ftr.lilfil.ru`
   - В Response Headers должны быть CORS заголовки:
     - `Access-Control-Allow-Origin: https://ftr.lilfil.ru`
     - `Access-Control-Allow-Credentials: true`

## Если все еще не работает

Проверьте:

1. **Custom Location `/api` активен** в NPM
2. **Custom Nginx Configuration сохранен** без ошибок
3. **Backend перезапущен** после изменений
4. **В логах backend** появляется правильный Origin

Если Origin все еще `undefined`, возможно проблема в самом NPM - попробуйте перезапустить контейнер NPM (если есть доступ).

