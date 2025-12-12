# Финальное исправление: Заголовки не передаются из NPM

## Проблема

В логах все еще видно:
- `Host: localhost:3001` (должно быть `ftr.lilfil.ru`)
- `Origin: undefined` (должно быть `https://ftr.lilfil.ru`)
- `X-Forwarded-For: undefined`

Это означает, что Custom Location в NPM либо не применяется, либо настроен неправильно.

## Решение 1: Проверка и исправление Custom Location

### Шаг 1: Удалите и создайте Custom Location заново

1. В NPM откройте Proxy Host для `ftr.lilfil.ru`
2. Перейдите на вкладку **Custom Locations**
3. **Удалите** существующий Location `/api` (если есть)
4. Создайте **новый** Location:

   - **Location:** `/api` (обязательно со слешем `/` в начале!)
   - **Scheme:** `http` (НЕ `https`!)
   - **Forward Hostname / IP:** `192.168.1.138`
   - **Forward Port:** `3001`
   - **Websockets Support:** ✅ Включено

5. Перейдите в **Advanced**
6. В поле **Custom Nginx Configuration** вставьте **ТОЧНО** этот код (скопируйте полностью):

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

7. **Сохраните** изменения
8. **Подождите 20-30 секунд** для применения

### Шаг 2: Проверьте основной Proxy Host

В основном Proxy Host для `ftr.lilfil.ru` (Details) также добавьте в **Advanced** → **Custom Nginx Configuration**:

```nginx
proxy_set_header Origin $http_origin;
proxy_set_header Host $host;
proxy_set_header X-Real-IP $remote_addr;
proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
proxy_set_header X-Forwarded-Proto $scheme;
```

## Решение 2: Альтернатива - Использование поддомена

Если Custom Location не работает, создайте отдельный Proxy Host для API:

### Proxy Host 1: Frontend (существующий)
- **Domain Names:** `ftr.lilfil.ru`
- **Scheme:** `http`
- **Forward Hostname / IP:** `192.168.1.138`
- **Forward Port:** `3000`

### Proxy Host 2: Backend API (новый)
- **Domain Names:** `api.ftr.lilfil.ru`
- **Scheme:** `http`
- **Forward Hostname / IP:** `192.168.1.138`
- **Forward Port:** `3001`
- **SSL:** Request certificate для `api.ftr.lilfil.ru`

Затем нужно будет изменить frontend, чтобы использовать `https://api.ftr.lilfil.ru` для API запросов.

## Решение 3: Проверка через прямой запрос

Проверьте, что запросы действительно идут через NPM:

```bash
# Этот запрос должен показать правильные заголовки в логах backend
curl -H "Origin: https://ftr.lilfil.ru" https://ftr.lilfil.ru/api/health
```

Затем проверьте логи:
```bash
docker-compose logs backend | tail -10
```

Если Origin все еще `undefined`, значит NPM не передает заголовки.

## Решение 4: Проверка конфигурации NPM

Если у вас есть доступ к серверу NPM, проверьте сгенерированную конфигурацию:

```bash
# Найдите конфигурацию для вашего домена
docker exec npm-proxy-manager cat /data/nginx/proxy_host/*.conf | grep -A 20 "location /api"
```

Должны быть видны `proxy_set_header` директивы.

## Решение 5: Явная установка Origin

Если `$http_origin` не работает, попробуйте явно установить Origin:

```nginx
# В Custom Nginx Configuration для /api
proxy_set_header Origin https://ftr.lilfil.ru;
proxy_set_header Host ftr.lilfil.ru;
proxy_set_header X-Real-IP $remote_addr;
proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
proxy_set_header X-Forwarded-Proto https;
proxy_set_header X-Forwarded-Host ftr.lilfil.ru;
proxy_set_header X-Forwarded-Port 443;
proxy_connect_timeout 60s;
proxy_send_timeout 60s;
proxy_read_timeout 60s;
proxy_buffering off;
```

## Проверка после исправления

После применения любого из решений:

1. **Подождите 30 секунд** для применения изменений
2. **Проверьте логи:**
   ```bash
   docker-compose logs backend | tail -20
   ```

3. **Должны появиться правильные заголовки:**
   - `Host: ftr.lilfil.ru` (или `api.ftr.lilfil.ru` если используете поддомен)
   - `Origin: https://ftr.lilfil.ru`
   - `X-Forwarded-For: <IP адрес>`

4. **Попробуйте войти в систему** через браузер

5. **Проверьте DevTools (F12) → Network:**
   - Запрос к `/api/auth/login` должен иметь правильные заголовки
   - Response должен содержать CORS заголовки

## Если ничего не помогает

Попробуйте перезапустить NPM контейнер (если есть доступ):

```bash
docker restart npm-proxy-manager
```

Или проверьте, что Custom Location действительно активен в веб-интерфейсе NPM (зеленая галочка).

