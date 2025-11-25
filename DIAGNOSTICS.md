# Диагностика белого экрана

## Шаги для диагностики:

1. **Проверьте логи frontend:**
   ```bash
   tail -f /home/fil/FTR_REG/frontend.log
   ```

2. **Проверьте логи backend:**
   ```bash
   tail -f /home/fil/FTR_REG/backend.log
   ```

3. **Проверьте, что сервисы запущены:**
   ```bash
   ps aux | grep -E "node|serve"
   ```

4. **Проверьте доступность frontend:**
   ```bash
   curl http://localhost:3000
   ```

5. **Проверьте доступность backend:**
   ```bash
   curl http://localhost:3001/api/health
   ```

6. **Проверьте консоль браузера (F12):**
   - Откройте Developer Tools (F12)
   - Перейдите на вкладку Console
   - Посмотрите на ошибки (красные сообщения)

7. **Проверьте Network вкладку:**
   - Откройте Developer Tools (F12)
   - Перейдите на вкладку Network
   - Обновите страницу (F5)
   - Проверьте, какие файлы загружаются, а какие нет

## Частые проблемы:

1. **404 на JS/CSS файлы** - проблема с путями в dist/index.html
2. **CORS ошибки** - проблема с настройками CORS в backend
3. **API недоступен** - backend не запущен или неправильный URL
4. **JavaScript ошибки** - проблемы в коде приложения

## Быстрое решение:

```bash
cd /home/fil/FTR_REG

# Остановите все процессы
pkill -f "node.*dist/index.js"
pkill -f "serve.*dist"

# Пересоберите frontend
cd frontend
npm run build
cd ..

# Перезапустите через deploy.sh
bash deploy.sh
```

