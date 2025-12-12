# Быстрая настройка Nginx Proxy Manager

## Краткая инструкция

### 1. Создайте Proxy Host для Frontend

**В NPM веб-интерфейсе:**

- **Domain Names:** `ftr.lilfil.ru`
- **Forward Hostname / IP:** `192.168.1.138`
- **Forward Port:** `3000`
- **Websockets Support:** ✅ Включено
- **SSL:** Request new certificate (Let's Encrypt)
- **Force SSL:** ✅ Включено

### 2. Добавьте Custom Location для API

В том же Proxy Host:

- **Location:** `/api`
- **Forward Hostname / IP:** `192.168.1.138`
- **Forward Port:** `3001`
- **Websockets Support:** ✅ Включено

**В Advanced → Custom Nginx Configuration добавьте:**

```nginx
proxy_connect_timeout 60s;
proxy_send_timeout 60s;
proxy_read_timeout 60s;
proxy_buffering off;
proxy_set_header Origin $http_origin;
proxy_set_header X-Forwarded-Host $host;
proxy_set_header X-Forwarded-Port $server_port;
```

### 3. Откройте порты на Docker сервере

```bash
# На сервере с Docker (192.168.1.138)
# Замените IP_СЕРВЕРА_NPM на IP адрес сервера с NPM
sudo ufw allow from IP_СЕРВЕРА_NPM to any port 3000
sudo ufw allow from IP_СЕРВЕРА_NPM to any port 3001
```

### 4. Обновите Backend для поддержки нового домена

```bash
cd /path/to/FTR_REG
git pull
docker-compose build backend
docker-compose up -d backend
```

### 5. Проверьте

```bash
curl https://ftr.lilfil.ru/api/health
```

Готово! 🎉

