# Решение: Запросы идут напрямую к backend

## Проблема

В логах видно `Host: localhost:3001` - это означает, что запросы идут **напрямую к backend**, минуя NPM, или NPM не передает правильный Host заголовок.

## Диагностика

Запустите скрипт проверки:

```bash
chmod +x check-npm-routing.sh
./check-npm-routing.sh
```

## Решение 1: Проверка Custom Location в NPM

### Важно проверить:

1. **Custom Location `/api` существует и активен**
   - В NPM → Proxy Host → Custom Locations
   - Должна быть зеленая галочка

2. **Правильный Location path**
   - Должно быть `/api` (со слешем `/` в начале)
   - НЕ `api` (без слеша)
   - НЕ `/api/` (со слешем в конце)

3. **Custom Nginx Configuration применен**
   - Advanced → Custom Nginx Configuration
   - Должны быть `proxy_set_header` директивы

## Решение 2: Явная установка Host заголовка

Если `$host` не работает, попробуйте явно установить Host:

В Custom Nginx Configuration для `/api`:

```nginx
# Явно устанавливаем Host (вместо $host)
proxy_set_header Host ftr.lilfil.ru;
proxy_set_header Origin https://ftr.lilfil.ru;
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

## Решение 3: Проверка что запросы идут через NPM

Если в логах все еще `Host: localhost:3001`, возможно:

1. **Запросы идут напрямую к backend** (минуя NPM)
   - Проверьте, что frontend использует относительные пути `/api`
   - НЕ абсолютные `http://192.168.1.138:3001/api`

2. **NPM не применяет Custom Location**
   - Удалите и создайте Custom Location заново
   - Убедитесь, что он сохранен и активен

3. **Конфликт конфигураций**
   - Проверьте, нет ли других Proxy Host для того же домена
   - Убедитесь, что используется правильный Proxy Host

## Решение 4: Альтернативный подход - Переменная окружения

Если NPM не работает правильно, можно настроить frontend для использования абсолютного URL API:

1. **Создайте отдельный Proxy Host для API:**
   - Domain: `api.ftr.lilfil.ru`
   - Forward: `192.168.1.138:3001`

2. **Измените frontend:**
   - Установите `VITE_API_URL=https://api.ftr.lilfil.ru` в `.env`
   - Пересоберите frontend: `docker-compose build frontend`

Но это требует изменений в коде и пересборки.

## Решение 5: Проверка логов NPM

Если есть доступ к серверу NPM, проверьте логи:

```bash
# Логи NPM контейнера
docker logs npm-proxy-manager 2>&1 | tail -50 | grep -i error

# Или проверьте сгенерированную конфигурацию
docker exec npm-proxy-manager cat /data/nginx/proxy_host/*.conf | grep -A 30 "location /api"
```

Должны быть видны `proxy_set_header` директивы для `/api` location.

## Финальная проверка

После применения любого решения:

1. **Подождите 30 секунд** для применения изменений
2. **Сделайте запрос:**
   ```bash
   curl https://ftr.lilfil.ru/api/health
   ```
3. **Проверьте логи:**
   ```bash
   docker-compose logs backend | tail -5
   ```
4. **Должны появиться правильные заголовки:**
   - `Host: ftr.lilfil.ru` (НЕ `localhost:3001`)
   - `Origin: https://ftr.lilfil.ru` (НЕ `undefined`)

## Если ничего не помогает

Попробуйте:

1. **Перезапустить NPM контейнер** (если есть доступ):
   ```bash
   docker restart npm-proxy-manager
   ```

2. **Проверить версию NPM** - возможно, старая версия имеет баги

3. **Использовать альтернативное решение** с поддоменом для API

