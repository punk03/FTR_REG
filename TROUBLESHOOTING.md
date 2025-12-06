# Решение проблем с Frontend

## Проблема: Frontend не открывается по IP адресу

### Симптомы
- `curl http://95.71.125.8:3000` возвращает "Failed to connect"
- `curl http://localhost:3000` также не работает
- Порт 3000 не слушает

### Решение

#### Шаг 1: Проверка статуса

```bash
cd ~/FTR_REG

# Проверить, запущен ли процесс
ps aux | grep serve

# Проверить, слушает ли порт
netstat -tlnp | grep 3000
# или
ss -tlnp | grep 3000

# Проверить логи
tail -50 frontend.log
```

#### Шаг 2: Остановка всех процессов

```bash
# Остановить все процессы serve
pkill -f "serve.*dist"
pkill -f "node.*serve"

# Убедиться, что порт свободен
lsof -ti :3000 | xargs kill -9 2>/dev/null || true
```

#### Шаг 3: Проверка сборки

```bash
cd ~/FTR_REG/frontend

# Проверить наличие dist
ls -la dist/

# Если dist отсутствует или пустой, пересобрать
npm run build
```

#### Шаг 4: Запуск frontend

**Вариант A: Использовать скрипт (рекомендуется)**

```bash
cd ~/FTR_REG
chmod +x start-frontend.sh
./start-frontend.sh
```

**Вариант B: Ручной запуск**

```bash
cd ~/FTR_REG/frontend

# Убедиться, что serve.json существует
cat > serve.json << 'EOF'
{
  "public": "dist",
  "rewrites": [
    {
      "source": "**",
      "destination": "/index.html"
    }
  ]
}
EOF

# Запустить serve на всех интерфейсах
nohup npx -y serve@latest -s dist --listen tcp://0.0.0.0:3000 > ../frontend.log 2>&1 &
echo $! > ../frontend.pid

# Проверить через 5 секунд
sleep 5
curl http://localhost:3000
```

#### Шаг 5: Проверка файрвола

```bash
# UFW
sudo ufw status
sudo ufw allow 3000/tcp
sudo ufw reload

# firewalld
sudo firewall-cmd --list-ports
sudo firewall-cmd --permanent --add-port=3000/tcp
sudo firewall-cmd --reload

# iptables (если используется)
sudo iptables -L -n | grep 3000
sudo iptables -A INPUT -p tcp --dport 3000 -j ACCEPT
sudo iptables-save
```

#### Шаг 6: Проверка провайдера

Если файрвол на сервере настроен правильно, но порт все равно недоступен:

1. **Проверьте Security Groups** (если используете облако):
   - AWS: Security Groups → Inbound Rules
   - DigitalOcean: Networking → Firewalls
   - Hetzner: Firewall Rules
   - Добавьте правило: TCP порт 3000 из любого источника (0.0.0.0/0)

2. **Проверьте сетевые настройки сервера**:
   ```bash
   # Проверить, на каких интерфейсах слушает
   ss -tlnp | grep 3000
   
   # Должно быть: 0.0.0.0:3000 или :::3000
   # НЕ должно быть: 127.0.0.1:3000
   ```

### Альтернативное решение: Использовать Nginx

Если `serve` не работает, можно использовать Nginx:

```bash
# Установить Nginx
sudo apt-get update
sudo apt-get install -y nginx

# Создать конфигурацию
sudo tee /etc/nginx/sites-available/ftr-frontend > /dev/null << 'EOF'
server {
    listen 3000;
    server_name 95.71.125.8;
    root /home/ftr/FTR_REG/frontend/dist;
    index index.html;

    location / {
        try_files $uri $uri/ /index.html;
    }

    location /api {
        proxy_pass http://localhost:3001;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }
}
EOF

# Активировать конфигурацию
sudo ln -s /etc/nginx/sites-available/ftr-frontend /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl restart nginx
```

### Диагностика

```bash
# Полная диагностика
cd ~/FTR_REG
./fix-frontend.sh

# Или вручную:

# 1. Проверить процессы
ps aux | grep -E "serve|node" | grep -v grep

# 2. Проверить порты
netstat -tlnp | grep 3000
ss -tlnp | grep 3000

# 3. Проверить логи
tail -100 frontend.log

# 4. Проверить файлы
ls -la frontend/dist/
ls -la frontend/serve.json

# 5. Проверить доступность
curl -v http://localhost:3000
curl -v http://95.71.125.8:3000

# 6. Проверить файрвол
sudo ufw status numbered
sudo iptables -L -n -v | grep 3000
```

### Частые ошибки

1. **"EADDRINUSE: address already in use"**
   - Решение: `lsof -ti :3000 | xargs kill -9`

2. **"Cannot find module 'serve'"**
   - Решение: `npm install -g serve` или использовать `npx serve@latest`

3. **"Port 3000 is not listening"**
   - Проверьте, что процесс запущен: `ps aux | grep serve`
   - Проверьте логи: `tail -f frontend.log`

4. **"Connection refused" извне, но работает локально**
   - Serve слушает только на localhost
   - Решение: Использовать `--listen tcp://0.0.0.0:3000` или `HOST=0.0.0.0`

