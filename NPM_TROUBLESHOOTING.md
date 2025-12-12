# Устранение проблем с заголовками в NPM

## Проблема: Заголовки все еще не передаются

Если после добавления Custom Nginx Configuration в логах все еще видно `Host: localhost:3001` и `undefined`, проверьте следующее:

## Шаг 1: Проверка настроек Custom Location

В NPM убедитесь, что:

1. **Custom Location `/api` существует и активен**
   - Откройте Proxy Host → Custom Locations
   - Должен быть Location `/api`
   - Он должен быть включен (зеленая галочка)

2. **Правильные базовые настройки:**
   - **Location:** `/api` (слеш в начале!)
   - **Scheme:** `http` (НЕ `https`!)
   - **Forward Hostname / IP:** `192.168.1.138`
   - **Forward Port:** `3001`

## Шаг 2: Проверка Custom Nginx Configuration

В Advanced настройках Custom Location `/api` должно быть:

```nginx
proxy_set_header Host $host;
proxy_set_header X-Real-IP $remote_addr;
proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
proxy_set_header X-Forwarded-Proto $scheme;
proxy_set_header X-Forwarded-Host $host;
proxy_set_header X-Forwarded-Port $server_port;
proxy_set_header Origin $http_origin;
proxy_connect_timeout 60s;
proxy_send_timeout 60s;
proxy_read_timeout 60s;
proxy_buffering off;
```

**Важно:** 
- Не должно быть лишних пробелов или символов
- Каждая строка должна заканчиваться точкой с запятой `;`
- Не должно быть дублирующихся директив

## Шаг 3: Перезагрузка NPM

После изменений:

1. **Сохраните изменения** в NPM
2. **Подождите 10-15 секунд** для применения изменений
3. **Проверьте логи NPM** (если есть доступ):
   ```bash
   docker logs npm-proxy-manager 2>&1 | tail -50
   ```

## Шаг 4: Альтернативное решение - Два отдельных Proxy Host

Если Custom Location не работает, можно создать два отдельных Proxy Host:

### Proxy Host 1: Frontend
- **Domain Names:** `ftr.lilfil.ru`
- **Scheme:** `http`
- **Forward Hostname / IP:** `192.168.1.138`
- **Forward Port:** `3000`

### Proxy Host 2: Backend API
- **Domain Names:** `api.ftr.lilfil.ru` (поддомен)
- **Scheme:** `http`
- **Forward Hostname / IP:** `192.168.1.138`
- **Forward Port:** `3001`

Затем в frontend нужно будет изменить `VITE_API_URL` на `https://api.ftr.lilfil.ru` (но это требует изменений в коде и пересборки).

## Шаг 5: Проверка через curl

Проверьте, что NPM правильно проксирует запросы:

```bash
# С сервера NPM или с любого компьютера
curl -v https://ftr.lilfil.ru/api/health

# Должен вернуть ответ от backend
# В заголовках ответа должны быть правильные CORS заголовки
```

## Шаг 6: Проверка логов NPM

Если есть доступ к серверу NPM, проверьте логи:

```bash
# Логи NPM контейнера
docker logs npm-proxy-manager 2>&1 | grep -i error | tail -20

# Или логи Nginx внутри NPM
docker exec npm-proxy-manager cat /data/logs/proxy-host-*.log | tail -50
```

## Частые ошибки

### Ошибка 1: Custom Location не применяется

**Причина:** NPM не перезагрузил конфигурацию

**Решение:** 
- Сохраните изменения еще раз
- Подождите 15-20 секунд
- Попробуйте перезапустить NPM контейнер (если есть доступ)

### Ошибка 2: Синтаксическая ошибка в Custom Nginx Configuration

**Причина:** Неправильный синтаксис в конфигурации

**Решение:**
- Проверьте синтаксис
- Убедитесь, что все строки заканчиваются `;`
- Удалите лишние пробелы

### Ошибка 3: Location не совпадает

**Причина:** Location указан неправильно (например, `api` вместо `/api`)

**Решение:**
- Location должен быть `/api` (со слешем в начале)
- Проверьте, что он точно совпадает с путем запросов

## Проверка после исправления

После применения всех исправлений проверьте логи backend:

```bash
docker-compose logs backend | tail -20
```

Должны появиться правильные заголовки:
- `Host: ftr.lilfil.ru` (или правильный домен)
- `X-Forwarded-For: <IP адрес>`
- `Origin: https://ftr.lilfil.ru`

Если заголовки все еще неправильные, попробуйте альтернативное решение с двумя Proxy Host.

