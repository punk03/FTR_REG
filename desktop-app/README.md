# FTR Registration Desktop Application

Десктопное приложение для управления регистрациями на мероприятия FTR.

## Особенности

- 🚀 **Быстрая работа** - локальная БД для мгновенного доступа к данным
- 📱 **Кросс-платформенность** - работает на Windows, macOS, Linux
- 🔄 **Оффлайн режим** - полная функциональность без интернета
- 🔁 **Автосинхронизация** - автоматическая синхронизация при появлении интернета
- 💾 **Локальный кэш** - вся БД хранится локально для быстрого доступа
- 🎨 **Современный UI** - красивый интерфейс на CustomTkinter

## Установка

### Требования
- Python 3.10 или выше
- pip

### Установка зависимостей

```bash
pip install -r requirements.txt
```

## Запуск

```bash
python main.py
```

## Сборка исполняемого файла

### Windows
```bash
pyinstaller --onefile --windowed --name "FTR Registration" main.py
```

### macOS/Linux
```bash
pyinstaller --onefile --name "FTR Registration" main.py
```

## Конфигурация

Создайте файл `.env` в корне проекта:

```env
API_BASE_URL=http://localhost:5000/api
API_TIMEOUT=30
SYNC_INTERVAL=60  # секунды между синхронизациями
DB_PATH=./data/ftr_registration.db
LOG_LEVEL=INFO
```

## Архитектура

```
desktop-app/
├── main.py                 # Точка входа
├── app/
│   ├── __init__.py
│   ├── gui/               # GUI компоненты
│   │   ├── main_window.py
│   │   ├── events_view.py
│   │   ├── registrations_view.py
│   │   └── ...
│   ├── database/          # Локальная БД
│   │   ├── models.py
│   │   ├── session.py
│   │   └── migrations/
│   ├── api/               # API клиент
│   │   ├── client.py
│   │   └── sync.py
│   ├── services/          # Бизнес-логика
│   │   ├── auth_service.py
│   │   ├── event_service.py
│   │   └── ...
│   └── utils/             # Утилиты
│       ├── config.py
│       └── logger.py
└── data/                  # Локальные данные
    └── ftr_registration.db
```

## Функциональность

- ✅ Управление событиями
- ✅ Регистрации участников
- ✅ Управление оплатами
- ✅ Учет дипломов и медалей
- ✅ Статистика и отчеты
- ✅ Импорт/экспорт данных
- ✅ Оффлайн режим с синхронизацией

## Лицензия

MIT

