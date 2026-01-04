# Устранение неполадок

## Проблема: "Failed to resolve host" или "Cannot connect to server"

### Симптомы:
```
ERROR: Connection error: HTTPSConnectionPool(host='back.ftr.lilfil.ru', port=443): 
Failed to resolve 'back.ftr.lilfil.ru'
```

### Решения:

#### 1. Проверьте адрес сервера в .env

Откройте файл `.env` и проверьте `API_BASE_URL`:

```bash
cd desktop-app
cat .env | grep API_BASE_URL
```

**Возможные варианты:**

- **Локальный сервер (Docker):**
  ```env
  API_BASE_URL=http://localhost:3001/api
  ```

- **Удаленный сервер с IP:**
  ```env
  API_BASE_URL=http://192.168.1.100:3001/api
  ```

- **Удаленный сервер с доменом:**
  ```env
  API_BASE_URL=https://your-domain.com/api
  ```

#### 2. Проверьте доступность сервера

```bash
# Проверка DNS
ping back.ftr.lilfil.ru

# Проверка HTTP
curl http://localhost:3001/api/health
# или
curl https://your-server.com/api/health
```

#### 3. Проверьте, запущен ли сервер

```bash
# Если сервер в Docker
docker ps | grep backend

# Если сервер локальный
ps aux | grep node
```

#### 4. Используйте оффлайн режим

Если сервер недоступен, но у вас уже есть данные в локальной БД:

1. Нажмите кнопку **"Работать оффлайн (без авторизации)"** на экране входа
2. Приложение откроется с локальными данными
3. Синхронизация произойдет автоматически при появлении интернета

## Проблема: "Authentication failed"

### Решения:

1. Проверьте правильность email и пароля
2. Убедитесь, что используете те же учетные данные, что и для веб-версии
3. Проверьте, что сервер доступен (см. выше)

## Проблема: Приложение не запускается

### Решения:

1. **Проверьте версию Python:**
   ```bash
   python3 --version
   # Должна быть 3.10 или выше
   ```

2. **Проверьте установленные зависимости:**
   ```bash
   pip3 list | grep customtkinter
   pip3 list | grep SQLAlchemy
   ```

3. **Переустановите зависимости:**
   ```bash
   pip3 install -r requirements.txt --upgrade
   ```

4. **Проверьте логи:**
   ```bash
   cat ~/.local/share/ftr_registration/logs/app.log
   ```

## Проблема: База данных не создается

### Решения:

1. **Проверьте права доступа:**
   ```bash
   ls -la ~/.local/share/ftr_registration/
   ```

2. **Создайте папку вручную:**
   ```bash
   mkdir -p ~/.local/share/ftr_registration/data
   mkdir -p ~/.local/share/ftr_registration/logs
   ```

3. **Проверьте путь в .env:**
   ```env
   DB_PATH=./data/ftr_registration.db
   ```

## Проблема: GUI не отображается

### Решения:

1. **Проверьте, что CustomTkinter установлен:**
   ```bash
   pip3 show customtkinter
   ```

2. **Попробуйте запустить с явным указанием Python:**
   ```bash
   python3 -m app.main
   ```

3. **Проверьте системные требования:**
   - macOS 10.14+
   - Windows 10+
   - Linux с поддержкой GUI

## Частые ошибки DNS

### Ошибка: "nodename nor servname provided"

Это означает, что DNS не может разрешить доменное имя.

**Решения:**
1. Используйте IP-адрес вместо домена
2. Проверьте интернет-соединение
3. Проверьте настройки DNS (в `/etc/resolv.conf` на Linux/macOS)

### Ошибка: "Connection refused"

Сервер доступен, но не принимает соединения.

**Решения:**
1. Проверьте, что сервер запущен
2. Проверьте правильность порта
3. Проверьте файрвол

## Получение помощи

Если проблема не решена:

1. Проверьте логи: `~/.local/share/ftr_registration/logs/app.log`
2. Создайте issue в репозитории с:
   - Описанием проблемы
   - Сообщением об ошибке из логов
   - Версией Python: `python3 --version`
   - Операционной системой

