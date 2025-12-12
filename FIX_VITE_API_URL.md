# Исправление: Frontend использует прямой URL вместо проксирования через NPM

## Проблема

Frontend делает запросы напрямую к `http://192.168.1.138:3001/api/auth/login` вместо использования относительного пути `/api/auth/login`, который проксируется через NPM.

## Причина

В переменной окружения `VITE_API_URL` установлен прямой URL к backend, что заставляет frontend обходить NPM.

## Решение

### Шаг 1: Проверьте `.env` файл

На сервере с Docker контейнерами проверьте файл `.env`:

```bash
cd /path/to/FTR_REG
cat .env | grep VITE_API_URL
```

Если там установлено `VITE_API_URL=http://192.168.1.138:3001` или что-то подобное, нужно удалить или закомментировать эту строку.

### Шаг 2: Удалите или закомментируйте VITE_API_URL

В файле `.env`:

```bash
# Удалите или закомментируйте эту строку:
# VITE_API_URL=http://192.168.1.138:3001

# Или установите пустое значение:
VITE_API_URL=
```

### Шаг 3: Пересоберите frontend контейнер

После изменения `.env`:

```bash
cd /path/to/FTR_REG

# Пересоберите frontend БЕЗ VITE_API_URL
docker-compose build frontend

# Перезапустите frontend
docker-compose up -d frontend
```

### Шаг 4: Проверьте логи frontend

После перезапуска проверьте логи:

```bash
docker-compose logs frontend | grep "API URL"
```

Должно быть: `API URL:` (пустое значение)

### Шаг 5: Проверьте в браузере

1. Откройте сайт: `https://ftr.lilfil.ru`
2. Откройте DevTools (F12) → Network
3. Попробуйте войти
4. Проверьте запрос к `/api/auth/login`:
   - **Request URL** должен быть: `https://ftr.lilfil.ru/api/auth/login`
   - **НЕ** `http://192.168.1.138:3001/api/auth/login`

### Шаг 6: Проверьте логи backend

После входа проверьте логи:

```bash
docker-compose logs backend | tail -10
```

Теперь должны появиться правильные заголовки:
- `Host: ftr.lilfil.ru` (вместо `192.168.1.138:3001`)
- `Origin: https://ftr.lilfil.ru` (вместо `undefined`)

## Альтернативное решение: Использование поддомена для API

Если вы хотите использовать отдельный поддомен для API:

1. **Создайте Proxy Host в NPM:**
   - Domain: `api.ftr.lilfil.ru`
   - Forward: `192.168.1.138:3001`

2. **Установите в `.env`:**
   ```
   VITE_API_URL=https://api.ftr.lilfil.ru
   ```

3. **Пересоберите frontend:**
   ```bash
   docker-compose build frontend
   docker-compose up -d frontend
   ```

Но для работы через один домен лучше использовать относительные пути (пустой `VITE_API_URL`).

## Важно

После изменения `VITE_API_URL` **обязательно пересоберите** frontend контейнер, так как переменные окружения Vite встраиваются в код во время сборки!

## Проверка после исправления

После пересборки frontend должен использовать относительные пути:
- ✅ `https://ftr.lilfil.ru/api/auth/login` (через NPM)
- ❌ `http://192.168.1.138:3001/api/auth/login` (напрямую)

И авторизация должна заработать!

