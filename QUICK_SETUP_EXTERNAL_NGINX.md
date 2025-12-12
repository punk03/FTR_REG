# Быстрая настройка для работы через внешний Nginx (ftr.lilfil.ru)

## Что было сделано:

1. ✅ Обновлен CORS на backend для поддержки домена `ftr.lilfil.ru`
2. ✅ Создан пример конфигурации для внешнего Nginx
3. ✅ Создана подробная инструкция по настройке

## Что нужно сделать на сервере:

### 1. На сервере с Docker контейнерами:

```bash
# Обновить код
cd /path/to/FTR_REG
git pull

# Пересобрать и перезапустить backend (чтобы применить изменения CORS)
docker-compose build backend
docker-compose up -d backend

# Проверить логи
docker-compose logs backend | grep CORS
```

### 2. На внешней VM с Nginx:

#### Шаг 1: Установите Nginx (если еще не установлен)
```bash
sudo apt update && sudo apt install nginx
```

#### Шаг 2: Скопируйте конфигурацию
Скопируйте файл `nginx-external-vm.conf.example` на VM и отредактируйте:

```bash
# На вашем компьютере
scp nginx-external-vm.conf.example user@vm-ip:/tmp/

# На VM - замените IP_АДРЕС_DOCKER_СЕРВЕРА на реальный IP
sudo nano /tmp/nginx-external-vm.conf.example
# Найдите IP_АДРЕС_DOCKER_СЕРВЕРА и замените на IP вашего Docker сервера
# Например: 192.168.1.100 или внутренний IP в вашей сети
```

#### Шаг 3: Установите SSL сертификат

**Вариант A: Let's Encrypt (рекомендуется)**
```bash
sudo apt install certbot python3-certbot-nginx
sudo certbot --nginx -d ftr.lilfil.ru -d www.ftr.lilfil.ru
```

**Вариант B: Временно без SSL (для тестирования)**
Используйте HTTP версию конфигурации (без SSL блоков)

#### Шаг 4: Примените конфигурацию
```bash
# Скопируйте отредактированный файл
sudo cp /tmp/nginx-external-vm.conf.example /etc/nginx/sites-available/ftr.lilfil.ru

# Создайте симлинк
sudo ln -s /etc/nginx/sites-available/ftr.lilfil.ru /etc/nginx/sites-enabled/

# Проверьте конфигурацию
sudo nginx -t

# Перезапустите Nginx
sudo systemctl restart nginx
```

#### Шаг 5: Откройте порты в файрволе
```bash
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
sudo ufw reload
```

### 3. Проверьте доступность портов

На внешней VM проверьте, что можете подключиться к Docker серверу:

```bash
# Замените IP_АДРЕС_DOCKER_СЕРВЕРА на реальный IP
telnet IP_АДРЕС_DOCKER_СЕРВЕРА 3000
telnet IP_АДРЕС_DOCKER_СЕРВЕРА 3001
```

Если не подключается, на Docker сервере откройте порты для VM:

```bash
# На Docker сервере - замените VM_IP на IP адрес внешней VM
sudo ufw allow from VM_IP to any port 3000
sudo ufw allow from VM_IP to any port 3001
```

### 4. Проверка работы

```bash
# Проверьте доступность сайта
curl -I https://ftr.lilfil.ru

# Проверьте API
curl https://ftr.lilfil.ru/api/health

# Откройте в браузере
# https://ftr.lilfil.ru
```

## Важные моменты:

1. **IP адрес Docker сервера**: В конфигурации Nginx нужно указать реальный IP адрес сервера, где запущены Docker контейнеры. Это может быть:
   - Внутренний IP в вашей сети (например, 192.168.1.100)
   - Внешний IP, если VM и Docker сервер в одной сети

2. **Порты**: Убедитесь, что порты 3000 и 3001 открыты на Docker сервере для доступа с внешней VM

3. **CORS**: Backend теперь автоматически разрешает запросы с домена `ftr.lilfil.ru`

4. **Frontend использует относительные пути**: Это означает, что все запросы к `/api` будут проксироваться через внешний Nginx к backend

## Если что-то не работает:

1. **Проверьте логи Nginx на внешней VM:**
   ```bash
   sudo tail -f /var/log/nginx/ftr.lilfil.ru_error.log
   ```

2. **Проверьте логи backend на Docker сервере:**
   ```bash
   docker-compose logs backend | tail -50
   ```

3. **Проверьте доступность портов:**
   ```bash
   # С внешней VM
   curl http://IP_АДРЕС_DOCKER_СЕРВЕРА:3000
   curl http://IP_АДРЕС_DOCKER_СЕРВЕРА:3001/api/health
   ```

4. **Проверьте CORS в логах backend:**
   ```bash
   docker-compose logs backend | grep -i cors
   ```

Подробная инструкция находится в файле `EXTERNAL_NGINX_SETUP.md`

