# Исправление: NPM пытается подключиться по HTTPS вместо HTTP

## Проблема

В логах видно TLS handshake байты (`\x16\x03\x01`), что означает, что NPM пытается подключиться по HTTPS к Docker контейнерам, которые слушают только HTTP.

## Решение

В Nginx Proxy Manager нужно указать **Scheme: http** для подключения к Docker контейнерам.

### Исправление в NPM:

1. **Откройте Proxy Host для `ftr.lilfil.ru`**

2. **В разделе Details:**
   - **Scheme:** Измените на `http` (НЕ `https`!)
   - **Forward Hostname / IP:** `192.168.1.138`
   - **Forward Port:** `3000`
   - **Websockets Support:** ✅ Включено

3. **В Custom Location для `/api`:**
   - **Scheme:** Измените на `http` (НЕ `https`!)
   - **Forward Hostname / IP:** `192.168.1.138`
   - **Forward Port:** `3001`
   - **Websockets Support:** ✅ Включено

### Важно:

- **SSL сертификат** настраивается в NPM для внешних запросов (клиент → NPM)
- **Scheme для Docker контейнеров** должен быть `http` (NPM → Docker контейнеры)

Схема работы:
```
Клиент (HTTPS) → NPM (HTTPS с SSL) → Docker контейнеры (HTTP)
```

## Проверка после исправления

После изменения Scheme на `http`:

1. Сохраните изменения в NPM
2. Проверьте логи:
   ```bash
   docker-compose logs frontend | tail -10
   docker-compose logs backend | tail -10
   ```

3. Должны исчезнуть ошибки 400 с TLS handshake байтами
4. Вместо них должны появиться нормальные HTTP запросы

## Дополнительно: Исправление Host заголовка

Если в логах backend видно `Host: localhost:3001`, добавьте в **Advanced → Custom Nginx Configuration** для Custom Location `/api`:

```nginx
proxy_set_header Host $host;
proxy_set_header X-Real-IP $remote_addr;
proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
proxy_set_header X-Forwarded-Proto $scheme;
proxy_set_header X-Forwarded-Host $host;
proxy_set_header X-Forwarded-Port $server_port;
proxy_set_header Origin $http_origin;
```

Это обеспечит правильную передачу заголовков от NPM к backend.

