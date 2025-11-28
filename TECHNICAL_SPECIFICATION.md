# ТЕХНИЧЕСКОЕ ЗАДАНИЕ
# Система регистрации и бухгалтерского учета участников мероприятий Федерации танцев России
# FTR Registration System

**Версия:** 1.0  
**Дата:** 2025  
**Статус:** Детальное ТЗ для разработки

---

## 1. ОБЩЕЕ ОПИСАНИЕ

### 1.1. Назначение
Веб-приложение для автоматизации регистрации участников танцевальных мероприятий, управления оплатами, учета дипломов/медалей, бухгалтерского учета и статистики.

### 1.2. Целевая аудитория
- **ADMIN** - полный доступ
- **REGISTRATOR** - регистрации и оплаты
- **ACCOUNTANT** - бухгалтерия и откаты
- **STATISTICIAN** - статистика и экспорт

### 1.3. Архитектура
Монорепозиторий:
- Backend: Node.js + Express + TypeScript + Prisma + PostgreSQL
- Frontend: React 18 + TypeScript + Vite + Material-UI
- Docker для деплоя

---

## 2. ФУНКЦИОНАЛЬНЫЕ ТРЕБОВАНИЯ

### 2.1. Система авторизации и безопасности

#### 2.1.1. Аутентификация
- JWT токены (access token: 100 лет, refresh token: 100 лет - практически бессрочные)
- Токены не истекают автоматически, только при явном logout
- Хеширование паролей (bcrypt, 10 rounds)
- Middleware для проверки токенов на всех защищенных роутах
- Endpoint GET /api/auth/me для получения информации о текущем пользователе

#### 2.1.2. Роли и права доступа
- **ADMIN**: все операции
- **REGISTRATOR**: создание/редактирование регистраций, оплаты, дипломы
- **ACCOUNTANT**: бухгалтерия, откаты, редактирование записей
- **STATISTICIAN**: просмотр статистики, экспорт

#### 2.1.3. Защита роутов
- Frontend: ProtectedRoute компонент
- Backend: authenticateToken + requireRole middleware
- Проверка прав на уровне API

---

### 2.2. Управление мероприятиями (Events)

#### 2.2.1. CRUD операции
- Создание мероприятия (ADMIN)
- Редактирование (ADMIN)
- Просмотр списка (все авторизованные)
- Фильтрация по статусу (DRAFT, ACTIVE, ARCHIVED)

#### 2.2.2. Поля мероприятия
- name (обязательно)
- startDate, endDate (обязательно)
- description (опционально)
- image (URL, опционально)
- status (DRAFT/ACTIVE/ARCHIVED)
- isOnline (boolean)
- paymentEnable (boolean)
- categoryEnable (boolean)
- songEnable (boolean)
- durationMax (секунды, по умолчанию 43200)
- durationGroupsInterval, durationParticipantsInterval
- pricePerDiploma, pricePerMedal (Decimal)
- discountTiers (JSON строка с уровнями откатов)

#### 2.2.3. Уровни откатов (discountTiers)
Формат JSON:
```json
[
  {"minAmount": 0, "maxAmount": 9999, "percentage": 0},
  {"minAmount": 10000, "maxAmount": 30999, "percentage": 10},
  {"minAmount": 31000, "maxAmount": 50999, "percentage": 15},
  {"minAmount": 51000, "maxAmount": 70999, "percentage": 20},
  {"minAmount": 71000, "maxAmount": 140999, "percentage": 25},
  {"minAmount": 141000, "maxAmount": 999999999, "percentage": 30}
]
```

---

### 2.3. Управление ценами на выступления (EventPrices)

#### 2.3.1. CRUD операции
- Создание/обновление цены для номинации (ADMIN)
- Просмотр цен (все авторизованные)

#### 2.3.2. Поля
- eventId (FK)
- nominationId (FK)
- pricePerParticipant (Decimal, обязательно)
- pricePerFederationParticipant (Decimal, опционально)

#### 2.3.3. Логика расчета
- Обычные участники: pricePerParticipant × количество
- Федеральные участники: pricePerFederationParticipant × количество (если указано, иначе pricePerParticipant)
- Общая сумма = обычные + федеральные

---

### 2.4. Система регистраций (Registrations)

#### 2.4.1. Создание регистрации
**Доступ:** ADMIN, REGISTRATOR

**Обязательные поля:**
- eventId
- collectiveName (или collectiveId)
- leaders (строка через запятую)
- disciplineId
- nominationId
- ageId
- duration

**Опциональные поля:**
- accessory (принадлежность коллектива)
- trainers (строка через запятую)
- categoryId (если categoryEnable=true)
- danceName
- participantsCount (по умолчанию из номинации)
- federationParticipantsCount (по умолчанию 0)
- participantIds (массив ID для соло/дуэта)
- videoUrl (если isOnline=true)
- songUrl (если songEnable=true)
- agreement, agreement2 (boolean)
- status (только ADMIN, по умолчанию PENDING)
- resume (только ADMIN)

**Автоматические поля:**
- userId (из токена)
- paymentStatus = UNPAID
- createdAt, updatedAt

#### 2.4.2. Автозаполнение
- Коллективы: поиск по имени (min 2 символа, debounce 300ms, max 10 результатов)
- Руководители/тренеры: поиск по ФИО + роль (min 2 символа)
- Создание новых записей через upsert

#### 2.4.3. Парсинг участников
Функция parseParticipants:
- Удаление нумерации (1., 2), 1, 2. и т.д.)
- Удаление лишних знаков препинания
- Split по переносам строки
- Trim пробелов
- Фильтрация пустых строк

#### 2.4.4. Валидация номинаций
- Соло: точно 1 участник, обязателен participantId
- Дуэт/Пара: точно 2 участника, обязательны participantIds
- Малая группа: от 3 до 7 участников (включая составы из 3–4 человек)
- Малая группа: 3-7 участников
- Формейшн: 8-24 участника
- Продакшн: от 25 участников

#### 2.4.5. Просмотр регистраций
- Список с фильтрацией по eventId и поиском
- Поиск по: коллектив, название танца, дисциплина, руководители, тренеры
- Сортировка: по коллективу (asc), затем по дате создания (desc)
- Детальный просмотр с полной информацией

#### 2.4.6. Редактирование регистрации
**Доступ:** ADMIN, REGISTRATOR

**Редактируемые поля:**
- participantsCount
- federationParticipantsCount
- medalsCount
- diplomasCount
- diplomasList
- nominationId

#### 2.4.7. Расчет стоимости
Endpoint: GET /api/registrations/:id/calculate-price

Параметры (опционально):
- participantsCount
- federationParticipantsCount
- diplomasCount
- medalsCount

Возвращает:
- performancePrice (с учетом федеральных участников)
- diplomasAndMedalsPrice
- total
- Детализацию цен

#### 2.4.8. Подсчет заявок по направлению
Endpoint: POST /api/registrations/count-in-direction

Параметры:
- eventId
- disciplineId
- nominationId
- ageId
- categoryId

Возвращает количество одобренных заявок (status=APPROVED)

---

### 2.5. Система оплат (Payments)

#### 2.5.1. Создание оплаты
Endpoint: POST /api/payments/create

**Доступ:** ADMIN, REGISTRATOR

**Параметры:**
- registrationIds: number[] (минимум 1)
- paymentsByMethod: { cash?: number, card?: number, transfer?: number }
- payingPerformance: boolean
- payingDiplomasAndMedals: boolean
- applyDiscount: boolean (только для PERFORMANCE)
- paymentGroupName?: string (для объединенных платежей)
- registrationsData?: Array<{registrationId, participantsCount?, medalsCount?, diplomasCount?, diplomasList?}>

**Логика:**
1. Расчет общей суммы выступлений (с учетом федеральных участников)
2. Расчет общей суммы дипломов/медалей
3. Если applyDiscount=true и payingPerformance=true:
   - Расчет отката от общей суммы выступлений по discountTiers
   - Откат применяется ТОЛЬКО к выступлениям
4. Проверка совпадения суммы оплаты с требуемой (с учетом отката)
5. Создание записей Payment и AccountingEntry:
   - Пропорциональное распределение по способам оплаты
   - Пропорциональное распределение отката между регистрациями
   - Группировка через paymentGroupId (UUID)
6. Обновление статусов регистраций

#### 2.5.2. Статусы оплаты
- **UNPAID** - не оплачено (красный)
- **PERFORMANCE_PAID** - оплачено только выступление (оранжевый)
- **DIPLOMAS_PAID** - оплачены только дипломы/медали (оранжевый)
- **PAID** - все оплачено (зеленый)

#### 2.5.3. Пересчет статусов
Функция recalculateRegistrationPaymentStatus:
1. Получение всех не удаленных AccountingEntry для регистрации
2. Подсчет оплаченных сумм по категориям (PERFORMANCE, DIPLOMAS_MEDALS)
3. Расчет требуемых сумм:
   - Выступления: с учетом федеральных участников
   - Дипломы/медали: из Event (pricePerDiploma, pricePerMedal)
4. Определение статусов по категориям
5. Определение общего статуса
6. Обновление registration

#### 2.5.4. Обновление оплаты
Endpoint: PUT /api/payments/:id

**Доступ:** ADMIN, REGISTRATOR

**Параметры:**
- paymentStatus
- paidAmount (опционально)
- diplomasPaid, medalsPaid (опционально)

---

### 2.6. Бухгалтерский учет (Accounting)

#### 2.6.1. Получение записей
Endpoint: GET /api/accounting?eventId=X&includeDeleted=false&deletedOnly=false

**Доступ:** ADMIN, ACCOUNTANT

**Параметры:**
- eventId (обязательно)
- includeDeleted (показывать удаленные)
- deletedOnly (только удаленные)

**Возвращает:**
- entries: AccountingEntry[] (с registration и collective)
- summary: {
  - performance: {cash, card, transfer, total}
  - diplomasAndMedals: {cash, card, transfer, total}
  - totalByMethod: {cash, card, transfer}
  - grandTotal (после откатов)
  - totalDiscount (сумма откатов)
}

#### 2.6.2. Группировка платежей
- Записи с одинаковым paymentGroupId группируются
- Отображение групп с детализацией:
  - Выступления (performanceEntries)
  - Дипломы/медали (diplomasMedalsEntries)
  - Общая сумма
  - Сумма отката
  - Способы оплаты

#### 2.6.3. Одиночные платежи
- Записи без paymentGroupId отображаются отдельно
- Разделение на вкладки: выступления и дипломы/медали

#### 2.6.4. Редактирование записи
Endpoint: PUT /api/accounting/:id

**Доступ:** ADMIN, ACCOUNTANT

**Параметры:**
- amount
- discountAmount, discountPercent (только для PERFORMANCE)
- method
- paidFor
- diplomasList, medalsCount, diplomasCount (для DIPLOMAS_MEDALS)

**Валидация:**
- Откат ТОЛЬКО для PERFORMANCE
- При изменении paidFor на DIPLOMAS_MEDALS откат очищается

**Логика:**
- Обновление AccountingEntry
- Если DIPLOMAS_MEDALS - обновление Registration
- Пересчет статусов

#### 2.6.5. Удаление записи (soft delete)
Endpoint: DELETE /api/accounting/:id

**Доступ:** ADMIN

**Логика:**
- Установка deletedAt = текущая дата
- Пересчет статусов регистрации

#### 2.6.6. Восстановление записи
Endpoint: POST /api/accounting/:id/restore

**Доступ:** ADMIN

**Логика:**
- Очистка deletedAt
- Если DIPLOMAS_MEDALS - восстановление данных в Registration
- Пересчет статусов

#### 2.6.7. Управление названием группы
Endpoint: PUT /api/accounting/payment-group/:paymentGroupId/name

**Доступ:** ADMIN, ACCOUNTANT

**Параметры:**
- name (строка)

**Логика:**
- Обновление paymentGroupName для всех записей группы

#### 2.6.8. Применение отката к группе
Endpoint: PUT /api/accounting/payment-group/:paymentGroupId/discount

**Доступ:** ADMIN, ACCOUNTANT

**Параметры:**
- discountPercent (0-100)

**Логика:**
1. Получение всех записей группы (только PERFORMANCE)
2. Восстановление исходной суммы: amount + discountAmount
3. Расчет общей исходной суммы
4. Расчет суммы отката от исходной суммы
5. Пропорциональное распределение между записями
6. Обновление amount, discountAmount, discountPercent
7. Пересчет статусов для каждой регистрации

**Важно:** Откат применяется ТОЛЬКО к выступлениям!

---

### 2.7. Управление дипломами и медалями (Diplomas)

#### 2.7.1. Получение списка
Endpoint: GET /api/diplomas?eventId=X&includeDeleted=false&deletedOnly=false

**Доступ:** все авторизованные

**Возвращает:**
- Массив регистраций с дипломами/медалями
- Поля: id, blockNumber, collective, discipline, nomination, age, danceName, diplomasCount, diplomasList (массив), medalsCount, diplomasPrinted, diplomasAndMedalsPaid, paidAt, deletedAt

#### 2.7.2. Редактирование списка дипломов
Endpoint: PATCH /api/registrations/:id

**Параметры:**
- diplomasList (строка, переносы строк через \n)
- diplomasCount
- medalsCount

#### 2.7.3. Массовая оплата
Endpoint: POST /api/diplomas/pay

**Доступ:** ADMIN, REGISTRATOR

**Параметры:**
- registrationIds: number[]
- paymentsByMethod: {cash, card, transfer}

**Логика:**
1. Расчет требуемой суммы для всех регистраций
2. Проверка совпадения суммы
3. Создание AccountingEntry с paymentGroupId (если >1 регистрации)
4. Пропорциональное распределение по способам оплаты
5. Обновление diplomasAndMedalsPaid = true

#### 2.7.4. Отмена оплаты
Endpoint: POST /api/diplomas/:id/cancel-payment

**Доступ:** ADMIN, REGISTRATOR

**Ограничения:**
- REGISTRATOR: только в течение 5 минут после оплаты
- ADMIN: без ограничений

**Логика:**
- Soft delete всех AccountingEntry с paidFor=DIPLOMAS_MEDALS
- Обновление diplomasAndMedalsPaid = false

#### 2.7.5. Отметка печати
Endpoint: PATCH /api/diplomas/:id/printed

**Доступ:** ADMIN, REGISTRATOR

**Параметры:**
- printed: boolean

#### 2.7.6. Массовая отметка печати
Endpoint: PATCH /api/diplomas/bulk-printed

**Параметры:**
- registrationIds: number[]
- printed: boolean

#### 2.7.7. Мягкое удаление данных
Endpoint: DELETE /api/diplomas/:id или POST /api/diplomas/:id/delete

**Доступ:** ADMIN, REGISTRATOR

**Логика:**
- Установка diplomasDataDeletedAt = текущая дата

#### 2.7.8. Восстановление данных
Endpoint: POST /api/diplomas/:id/restore

**Логика:**
- Очистка diplomasDataDeletedAt

---

### 2.8. Статистика (Statistics)

#### 2.8.1. Получение статистики
Endpoint: GET /api/statistics?eventId=X

**Доступ:** ADMIN, STATISTICIAN, ACCOUNTANT

**Возвращает:**
- overview: {totalRegistrations, totalCollectives, totalParticipants, totalDiplomas, totalMedals}
- byNomination: Array<{name, count}>
- byDiscipline: Array<{name, count}>
- byAge: Array<{name, count}>
- payments: {paid, performancePaid, diplomasPaid, unpaid, totalAmount}

#### 2.8.2. Экспорт в Excel
Endpoint: GET /api/statistics/export/excel?eventId=X

**Формат:**
- Все поля регистрации
- Форматирование с заголовками
- Поддержка кириллицы

#### 2.8.3. Экспорт в CSV
Endpoint: GET /api/statistics/export/csv?eventId=X

**Формат:**
- UTF-8 с BOM для кириллицы
- Разделитель запятая

---

### 2.9. Админ-панель (Admin)

#### 2.9.1. Управление пользователями
- GET /api/admin/users - список
- POST /api/admin/users - создание
- PUT /api/admin/users/:id - обновление
- DELETE /api/admin/users/:id - удаление

**Поля пользователя:**
- name, email, password, role, city, phone

#### 2.9.2. Управление коллективами
- GET /api/admin/collectives - список
- DELETE /api/admin/collectives/:id - удаление

#### 2.9.3. Управление персонами
- GET /api/admin/persons - список
- DELETE /api/admin/persons/:id - удаление

#### 2.9.4. Системные настройки
- GET /api/admin/settings - все настройки
- PUT /api/admin/settings/:key - обновление

**Формат значений:**
- JSON объекты/массивы: JSON.stringify
- Boolean: "true"/"false"
- Null: "null"
- Остальное: String()

---

### 2.10. Справочники (Reference)

#### 2.10.1. Дисциплины
- GET /api/reference/disciplines
- 47 позиций (Jazz, Street dance show, Contemporary и т.д.)

#### 2.10.2. Номинации
- GET /api/reference/nominations
- 5 позиций: Соло, Дуэт/Пара, Малая группа, Формейшн, Продакшн

#### 2.10.3. Возрастные категории
- GET /api/reference/ages
- 8 позиций: Бэби, Мини 1, Мини 2, Дети, Ювеналы 1, Ювеналы 2, Юниоры, Взрослые, Смешанная

#### 2.10.4. Категории
- GET /api/reference/categories
- 2 позиции: Beginners, Basic, Advanced

#### 2.10.5. События
- GET /api/reference/events
- С фильтрацией по статусу

---

### 2.11. Автозаполнение (Suggestions)

#### 2.11.1. Коллективы
Endpoint: GET /api/suggestions/collectives?q=query

**Логика:**
- Поиск по name (ILIKE, case-insensitive)
- Минимум 2 символа
- Максимум 10 результатов
- Сортировка по name (asc)

#### 2.11.2. Персоны
Endpoint: GET /api/suggestions/persons?q=query&role=LEADER|TRAINER

**Логика:**
- Поиск по fullName (ILIKE)
- Фильтр по role (опционально)
- Минимум 2 символа
- Максимум 10 результатов

---

### 2.12. Импорт данных

#### 2.12.1. Импорт из Excel
Endpoint: POST /api/excel-import

**Доступ:** ADMIN

**Формат файла:**
- Колонка A: номер (может быть категория)
- Колонка B: коллектив
- Колонка C: название танца
- Колонка D: количество участников
- Колонка E: руководители
- Колонка F: тренеры
- Колонка G: школа
- Колонка H: контакты
- Колонка I: город
- Колонка J: длительность (HH:MM:SS или MM:SS)
- Колонка K: видео URL
- Колонка L: ФИО на дипломы
- Колонка M: количество медалей

**Логика парсинга:**
1. Определение категории из строки вида "1. Jazz Соло Бэби Beginners"
2. Парсинг: номер блока, дисциплина, номинация, возраст, категория
3. Поиск или создание записей в справочниках
4. Парсинг участников (удаление нумерации)
5. Создание регистраций

**Режимы:**
- dryRun=true: предпросмотр (первые 10 строк)
- dryRun=false: полный импорт (удаление старых регистраций события)

#### 2.12.2. Импорт из SQL
Endpoint: POST /api/admin/database/import

**Доступ:** ADMIN

**Логика:**
- Выполнение SQL запросов
- Валидация и обработка ошибок

---

### 2.13. Участники (Participants)

#### 2.13.1. Получение списка
Endpoint: GET /api/participants

**Возвращает:**
- items: {[id]: fullName}
- optAttributes: {[id]: {'data-subtext': 'возраст, дата рождения'}}

#### 2.13.2. Создание участника
Endpoint: POST /api/participants

**Параметры:**
- fullName
- birthDate (ISO string)

**Логика:**
- Автоматический расчет возраста
- Форматирование для select

---

## 3. НЕФУНКЦИОНАЛЬНЫЕ ТРЕБОВАНИЯ

### 3.1. Производительность
- Время отклика API: < 500ms (95 перцентиль)
- Загрузка страниц: < 2 секунды
- Поддержка до 10,000 регистраций на событие
- Оптимизация запросов к БД (индексы, select только нужных полей)

### 3.2. Безопасность
- HTTPS обязателен в production
- Валидация всех входных данных
- Защита от SQL injection (Prisma ORM)
- Защита от XSS (React экранирование)
- Rate limiting на критичных endpoints
- Логирование действий администраторов

### 3.3. Надежность
- Обработка всех ошибок
- Транзакции для критичных операций
- Soft delete для важных данных
- Резервное копирование БД

### 3.4. Масштабируемость
- Горизонтальное масштабирование backend
- Кэширование справочников
- Оптимизация запросов

### 3.5. Совместимость
- Браузеры: Chrome 90+, Firefox 88+, Safari 14+, Edge 90+
- Мобильные устройства: адаптивный дизайн
- Разрешения: от 320px до 4K

---

## 4. ТЕХНИЧЕСКИЕ ТРЕБОВАНИЯ

### 4.1. Backend

#### 4.1.1. Технологии
- Node.js 18+
- Express 4.x
- TypeScript 5.x
- Prisma ORM 5.x
- PostgreSQL 14+
- JWT (jsonwebtoken)
- bcryptjs
- express-validator
- XLSX (ExcelJS)
- multer (для загрузки файлов)

#### 4.1.2. Структура проекта
```
backend/
├── src/
│   ├── index.ts              # Точка входа
│   ├── routes/               # API роуты
│   ├── middleware/           # Middleware (auth)
│   ├── services/             # Бизнес-логика
│   └── utils/                # Утилиты (JWT)
├── prisma/
│   ├── schema.prisma         # Схема БД
│   ├── migrations/           # Миграции
│   └── seed.ts               # Seed данные
└── package.json
```

#### 4.1.3. Переменные окружения
- DATABASE_URL (PostgreSQL connection string)
- JWT_SECRET (секрет для access token)
- JWT_REFRESH_SECRET (секрет для refresh token)
- PORT (по умолчанию 3001)
- NODE_ENV (development/production)

---

### 4.2. Frontend

#### 4.2.1. Технологии
- React 18
- TypeScript 5.x
- Vite 5.x
- Material-UI 5.x
- React Router 6.x
- Axios
- Recharts (графики)
- ExcelJS (экспорт)
- pdfMake (PDF с кириллицей)
- SweetAlert2 (модальные окна)

#### 4.2.2. Структура проекта
```
frontend/
├── src/
│   ├── main.tsx              # Точка входа
│   ├── App.tsx               # Главный компонент
│   ├── components/           # Переиспользуемые компоненты
│   ├── pages/                # Страницы
│   ├── context/              # Context API (AuthContext)
│   ├── services/             # API клиент
│   ├── theme.ts              # Тема Material-UI
│   └── types/                # TypeScript типы
└── package.json
```

#### 4.2.3. Переменные окружения
- VITE_API_URL (URL backend API)

---

### 4.3. База данных

#### 4.3.1. PostgreSQL
- Версия: 14+
- Кодировка: UTF-8
- Схема: public

#### 4.3.2. Основные таблицы

**users**
- id (PK, autoincrement)
- name, email (unique), password (hashed)
- role (enum: ADMIN, REGISTRATOR, STATISTICIAN, ACCOUNTANT)
- city, phone
- createdAt, updatedAt

**events**
- id (PK)
- name, startDate, endDate
- description, image
- status (enum: DRAFT, ACTIVE, ARCHIVED)
- isOnline, paymentEnable, categoryEnable, songEnable
- durationMax, durationGroupsInterval, durationParticipantsInterval
- pricePerDiploma, pricePerMedal (Decimal)
- discountTiers (JSON string)
- createdAt, updatedAt

**event_prices**
- id (PK)
- eventId (FK), nominationId (FK)
- pricePerParticipant, pricePerFederationParticipant (Decimal)
- unique(eventId, nominationId)

**collectives**
- id (PK)
- name (unique), accessory
- createdAt, updatedAt

**persons**
- id (PK)
- fullName, role (enum: LEADER, TRAINER)
- phone
- unique(fullName, role)
- createdAt, updatedAt

**disciplines, nominations, ages, categories**
- id (PK)
- name (unique)
- createdAt, updatedAt

**registrations**
- id (PK)
- userId (FK), eventId (FK), collectiveId (FK)
- disciplineId (FK), nominationId (FK), ageId (FK), categoryId (FK)
- danceName, duration
- participantsCount, federationParticipantsCount
- diplomasCount, medalsCount, diplomasList
- paymentStatus (enum: UNPAID, PERFORMANCE_PAID, DIPLOMAS_PAID, PAID)
- paidAmount (Decimal)
- performancePaid, diplomasAndMedalsPaid, diplomasPaid, medalsPaid (boolean)
- diplomasPrinted (boolean)
- diplomasDataDeletedAt (soft delete)
- status (enum: PENDING, APPROVED, REJECTED)
- resume
- number, blockNumber
- performedAt, placeId
- videoUrl, songUrl
- agreement, agreement2
- createdAt, updatedAt
- unique(eventId, number)

**registration_leaders, registration_trainers**
- id (PK)
- registrationId (FK), personId (FK)
- unique(registrationId, personId)

**participants**
- id (PK)
- fullName, birthDate (Date)
- userId (FK)
- createdAt, updatedAt

**registration_participants**
- id (PK)
- registrationId (FK), participantId (FK)
- unique(registrationId, participantId)

**accounting_entries**
- id (PK)
- registrationId (FK), collectiveId (FK)
- amount (Decimal, после отката)
- discountAmount, discountPercent (Decimal, только для PERFORMANCE)
- method (enum: CASH, CARD, TRANSFER)
- paidFor (enum: PERFORMANCE, DIPLOMAS_MEDALS)
- paymentGroupId (UUID, nullable)
- paymentGroupName (string, nullable)
- deletedAt (soft delete)
- createdAt

**payments**
- id (PK)
- registrationId (FK)
- amount (Decimal)
- method (enum)
- paidFor (enum)
- createdAt

**price_settings**
- id (PK)
- diplomaPrice, medalPrice (Decimal)
- updatedAt

**system_settings**
- id (PK)
- key (unique), value (string)
- description
- updatedBy (FK users)
- updatedAt

#### 4.3.3. Индексы
- users.email (unique)
- collectives.name (unique)
- persons(fullName, role) (unique)
- registrations(eventId, number) (unique)
- event_prices(eventId, nominationId) (unique)
- accounting_entries.paymentGroupId
- accounting_entries.deletedAt
- registrations.diplomasDataDeletedAt

---

## 5. API СПЕЦИФИКАЦИЯ

### 5.1. Авторизация

#### POST /api/auth/login
**Body:** {email, password}  
**Response:** {accessToken, refreshToken, user}

#### POST /api/auth/refresh
**Body:** {refreshToken}  
**Response:** {accessToken}

#### GET /api/auth/me
**Доступ:** все авторизованные  
**Response:** {id, name, email, role}

---

### 5.2. Регистрации

#### GET /api/registrations?eventId=X&search=query
**Headers:** Authorization: Bearer {token}  
**Response:** Registration[]

#### POST /api/registrations
**Body:** см. раздел 2.4.1  
**Response:** Registration

#### GET /api/registrations/:id
**Response:** Registration

#### PATCH /api/registrations/:id
**Body:** {participantsCount?, medalsCount?, diplomasList?, diplomasCount?, nominationId?, federationParticipantsCount?, diplomasDataDeletedAt?}  
**Response:** Registration

#### DELETE /api/registrations/:id
**Доступ:** ADMIN  
**Response:** {message}

#### GET /api/registrations/:id/calculate-price?participantsCount=X&...
**Response:** {performancePrice, diplomasAndMedalsPrice, total, ...}

#### POST /api/registrations/count-in-direction
**Body:** {eventId, disciplineId, nominationId, ageId, categoryId}  
**Response:** number

---

### 5.3. Оплаты

#### POST /api/payments/create
**Body:** см. раздел 2.5.1  
**Response:** {success, results, totalPaid, totalToPay, discount}

#### PUT /api/payments/:id
**Body:** {paymentStatus, paidAmount?, diplomasPaid?, medalsPaid?}  
**Response:** Registration

#### GET /api/payments/price-settings
**Response:** {diplomaPrice, medalPrice}

#### PUT /api/payments/price-settings
**Доступ:** ADMIN  
**Body:** {diplomaPrice, medalPrice}  
**Response:** {diplomaPrice, medalPrice}

---

### 5.4. Бухгалтерия

#### GET /api/accounting?eventId=X&includeDeleted=false&deletedOnly=false
**Доступ:** ADMIN, ACCOUNTANT  
**Response:** {entries, summary}

#### PUT /api/accounting/:id
**Доступ:** ADMIN, ACCOUNTANT  
**Body:** см. раздел 2.6.4  
**Response:** AccountingEntry

#### DELETE /api/accounting/:id
**Доступ:** ADMIN  
**Response:** {message}

#### POST /api/accounting/:id/restore
**Доступ:** ADMIN  
**Response:** {message, entry}

#### PUT /api/accounting/payment-group/:paymentGroupId/name
**Доступ:** ADMIN, ACCOUNTANT  
**Body:** {name}  
**Response:** {message, updatedCount}

#### PUT /api/accounting/payment-group/:paymentGroupId/discount
**Доступ:** ADMIN, ACCOUNTANT  
**Body:** {discountPercent}  
**Response:** {message, discountPercent, discountAmount, originalAmount, finalAmount, affectedEntries}

---

### 5.5. Дипломы

#### GET /api/diplomas?eventId=X&includeDeleted=false&deletedOnly=false
**Response:** DiplomasData[]

#### DELETE /api/diplomas/:id
**Доступ:** ADMIN, REGISTRATOR  
**Response:** {success, deletedAt}

#### POST /api/diplomas/:id/restore
**Доступ:** ADMIN, REGISTRATOR  
**Response:** {success, restored}

#### PATCH /api/diplomas/:id/printed
**Доступ:** ADMIN, REGISTRATOR  
**Body:** {printed}  
**Response:** {id, diplomasPrinted, message}

#### PATCH /api/diplomas/bulk-printed
**Доступ:** ADMIN, REGISTRATOR  
**Body:** {registrationIds, printed}  
**Response:** {updated, message}

#### POST /api/diplomas/pay
**Доступ:** ADMIN, REGISTRATOR  
**Body:** {registrationIds, paymentsByMethod}  
**Response:** {success, message, totalPaid}

#### POST /api/diplomas/:id/cancel-payment
**Доступ:** ADMIN, REGISTRATOR  
**Response:** {success, message}

---

### 5.6. Статистика

#### GET /api/statistics?eventId=X
**Доступ:** ADMIN, STATISTICIAN, ACCOUNTANT  
**Response:** Statistics

#### GET /api/statistics/export/excel?eventId=X
**Response:** Excel file

#### GET /api/statistics/export/csv?eventId=X
**Response:** CSV file

---

### 5.7. Админ

#### GET /api/admin/users
**Доступ:** ADMIN  
**Response:** User[]

#### POST /api/admin/users
**Body:** {name, email, password, role (ADMIN|REGISTRATOR|STATISTICIAN|ACCOUNTANT), city?, phone?}  
**Response:** User

#### PUT /api/admin/users/:id
**Body:** {name?, email?, password?, role? (ADMIN|REGISTRATOR|STATISTICIAN|ACCOUNTANT), city?, phone?}  
**Response:** User

#### DELETE /api/admin/users/:id
**Response:** {message}

#### GET /api/admin/collectives
**Response:** Collective[]

#### DELETE /api/admin/collectives/:id
**Response:** {message}

#### GET /api/admin/persons
**Response:** Person[]

#### DELETE /api/admin/persons/:id
**Response:** {message}

#### GET /api/admin/settings
**Response:** {[key]: value}

#### PUT /api/admin/settings/:key
**Body:** {value, description?}  
**Response:** SystemSetting

---

### 5.8. События

#### GET /api/events?status=ACTIVE
**Response:** Event[]

#### GET /api/events/:id
**Response:** Event

#### POST /api/events
**Доступ:** ADMIN  
**Body:** см. раздел 2.2.2  
**Response:** Event

#### PUT /api/events/:id
**Доступ:** ADMIN  
**Body:** см. раздел 2.2.2  
**Response:** Event

#### POST /api/events/:id/duplicate
**Доступ:** ADMIN  
**Body:** {name}  
**Response:** Event  
**Описание:** Дублирование события со всеми настройками цен и параметрами. Новое событие создается со статусом DRAFT.

#### DELETE /api/events/:id/registrations
**Доступ:** ADMIN  
**Response:** {message, deleted: {registrations, payments, accountingEntries}}  
**Описание:** Удаление всех регистраций события и связанных данных (оплаты, записи бухгалтерии). Само событие и настройки цен не удаляются.

#### DELETE /api/events/:id
**Доступ:** ADMIN  
**Response:** {message}  
**Ограничения:** Нельзя удалить событие с существующими регистрациями. Используйте архивирование (status=ARCHIVED) или удаление регистраций.

---

### 5.9. Цены на события

#### GET /api/events/:id/prices
**Response:** EventPrice[]

#### POST /api/events/:id/prices
**Доступ:** ADMIN  
**Body:** {nominationId, pricePerParticipant, pricePerFederationParticipant?}  
**Response:** EventPrice

#### PUT /api/events/:eventId/prices
**Доступ:** ADMIN  
**Body:** {pricePerDiploma?, pricePerMedal?, prices: Array<{nominationId, pricePerParticipant, pricePerFederationParticipant?}>}  
**Response:** {pricePerDiploma, pricePerMedal, prices: EventPrice[]}  
**Описание:** Массовое обновление всех цен события (общие цены на дипломы/медали и цены по номинациям). Старые цены по номинациям удаляются и создаются новые.

---

### 5.10. Справочники

#### GET /api/reference/disciplines
**Response:** Discipline[]

#### GET /api/reference/nominations
**Response:** Nomination[]

#### GET /api/reference/ages
**Response:** Age[]

#### GET /api/reference/categories
**Response:** Category[]

#### GET /api/reference/events
**Response:** Event[]

---

### 5.11. Автозаполнение

#### GET /api/suggestions/collectives?q=query
**Response:** Collective[]

#### GET /api/suggestions/persons?q=query&role=LEADER
**Response:** Person[]

---

### 5.12. Импорт

#### POST /api/excel-import
**Доступ:** ADMIN  
**Body:** FormData {file, eventId, dryRun?}  
**Response:** {success, imported, skipped, errors, preview?}

#### POST /api/admin/database/import
**Доступ:** ADMIN  
**Body:** {sql}  
**Response:** {success, message}

---

### 5.13. Участники

#### GET /api/participants
**Response:** {items, optAttributes}

#### POST /api/participants
**Body:** {fullName, birthDate}  
**Response:** Participant

---

## 6. UI/UX ТРЕБОВАНИЯ

### 6.1. Общие требования
- Material Design принципы
- Адаптивный дизайн
- Поддержка кириллицы
- Темная/светлая тема (опционально)

### 6.2. Страницы

#### 6.2.1. Авторизация (/login)
- Форма: email, password
- Кнопка "Войти"
- Обработка ошибок
- Редирект после успешного входа

#### 6.2.2. Список регистраций (/registrations)
- Фильтр по событию
- Поиск (debounce 300ms)
- Таблица с колонками: коллектив, название, дисциплина, номинация, возраст, статус оплаты
- Цветовая индикация статусов
- Кнопка "Создать регистрацию"
- Клик по строке → детали

#### 6.2.3. Создание регистрации (/registrations/new)
- Многошаговая форма:
  1. Информация о коллективе (событие, коллектив, руководители, тренеры)
  2. Участники (номинация, количество, выбор участников для соло/дуэта)
  3. Направление (дисциплина, номинация, возраст, категория)
  4. Информация о номере (название, длительность, видео, песня)
  5. Соглашения
- Валидация на каждом шаге
- Автозаполнение полей
- Предупреждения о количестве заявок по направлению
- Кнопки "Назад", "Далее", "Сохранить"

#### 6.2.4. Детали регистрации (/registrations/:id)
- Полная информация о регистрации
- Кнопка "Редактировать" (ADMIN, REGISTRATOR)
- Кнопка "Удалить" (ADMIN)
- Расчет стоимости
- История оплат

#### 6.2.5. Бухгалтерия (/accounting)
- Выбор события
- Карточки сводных данных:
  - Итого получено (до откатов)
  - После откатов
  - Выданные откаты
  - Выступления (по способам оплаты)
  - Дипломы и медали (по способам оплаты)
- Вкладки:
  - Объединенные платежи (группы)
  - Одиночные выступления
  - Одиночные дипломы/медали
- Фильтры: поиск, способ оплаты, категория
- Группы платежей:
  - Карточка с общей информацией
  - Кнопка развернуть/свернуть
  - Редактирование названия группы
  - Кнопка "Назначить откат" / "Изменить откат"
  - Таблицы выступлений и дипломов/медалей
- Таблицы одиночных платежей:
  - Колонки: дата, коллектив, название, блок, номинация, возраст, сумма, откат, способ, действия
  - Кнопки редактирования и удаления (по ролям)
- Кнопки экспорта: Excel, PDF
- Диалог редактирования записи:
  - Поля: сумма, способ оплаты, за что, откат (только для выступлений)
  - Для дипломов/медалей: список дипломов, количество медалей/дипломов
- Диалог управления откатом:
  - Процент отката (0-100)
  - Показ исходной суммы, суммы отката, итоговой суммы
  - Предупреждение о применении только к выступлениям

#### 6.2.6. Объединенная оплата (/combined-payment)
- Выбор события
- Список регистраций с чекбоксами
- Фильтры и поиск
- Выбор что оплачиваем (выступления, дипломы/медали)
- **Редактирование данных регистраций прямо в форме оплаты:**
  - Количество участников (participantsCount)
  - Количество федеральных участников (federationParticipantsCount)
  - Количество медалей (medalsCount)
  - Список дипломов (diplomasList) - многострочное поле
- Автоматический пересчет стоимости при изменении данных
- Распределение суммы по способам оплаты
- Чекбокс "Применить откат" (только для выступлений)
- Поле названия группы платежей
- Кнопка "Создать оплату"
- Предпросмотр сумм с детализацией

#### 6.2.7. Дипломы и медали (/diplomas)
- Выбор события
- Таблица регистраций с дипломами/медалями
- Колонки: блок, коллектив, дисциплина, номинация, возраст, название, дипломы, медали, оплачено, печать
- **Пагинация:** 25 записей на страницу (настраиваемо)
- **Поиск:** по коллективу, названию танца, дисциплине (debounce 300ms)
- **Фильтры:**
  - Показать/скрыть оплаченные
  - Показать/скрыть неоплаченные
  - Показать/скрыть распечатанные
  - Показать/скрыть удаленные (soft delete)
- **Развертывание строки:** просмотр полного списка дипломов
- Массовый выбор (чекбоксы)
- Кнопки:
  - "Оплатить выбранные"
  - "Отметить как распечатанные" (массово)
  - "Редактировать список дипломов"
  - "Удалить данные" (soft delete, ADMIN, REGISTRATOR)
  - "Восстановить данные" (ADMIN, REGISTRATOR)
- Диалог оплаты:
  - Распределение по способам оплаты
  - Проверка суммы
- Диалог редактирования дипломов:
  - Многострочное поле списка ФИО
  - Поля количества медалей и дипломов
  - Автоматический подсчет количества дипломов из списка
- Диалог предзаказа дипломов:
  - Выбор регистрации из списка
  - Ввод списка ФИО и количества медалей

#### 6.2.8. Статистика (/statistics)
- Выбор события
- Карточки общей статистики
- Графики:
  - Круговая диаграмма по номинациям
  - Круговая диаграмма по статусам оплат
  - Столбчатая диаграмма по дисциплинам
  - Столбчатая диаграмма по возрастам
- Кнопки экспорта: Excel, CSV

#### 6.2.9. Админ-панель (/admin)
- Вкладки:
  - Пользователи
  - Мероприятия
  - Цены на выступления
  - Системные настройки
- Управление пользователями:
  - Таблица пользователей (колонки: имя, email, роль, город, телефон, дата создания)
  - Кнопки: создать, редактировать, удалить
  - Диалог создания/редактирования:
    - Поля: имя, email, пароль (при создании), роль (ADMIN, REGISTRATOR, STATISTICIAN, ACCOUNTANT), город, телефон
    - Валидация: email уникален, пароль минимум 6 символов
- Управление мероприятиями:
  - Список мероприятий с фильтрацией по статусу
  - Кнопка "Создать мероприятие"
  - Кнопка "Дублировать мероприятие" (с копированием всех настроек)
  - Форма создания/редактирования (вкладки):
    - Основная информация: название, описание, даты, изображение, статус
    - Настройки: онлайн, оплаты, категории, песни, длительность
    - Цены: дипломы/медали, цены по номинациям (таблица с редактированием)
    - Откаты: редактор уровней откатов с валидацией диапазонов
  - Кнопка "Удалить все регистрации" (с подтверждением)
  - Кнопка "Удалить мероприятие" (только если нет регистраций)
- Управление коллективами:
  - Список всех коллективов
  - Кнопка удаления
- Управление персонами:
  - Список всех руководителей и тренеров
  - Кнопка удаления
- Системные настройки:
  - Список настроек (ключ, значение, описание, дата обновления)
  - Редактирование значений (поддержка JSON, boolean, null, строки)

---

### 6.3. Компоненты

#### 6.3.1. AutoCompleteTextField
- Debounce поиск (300ms)
- Минимум 2 символа для запроса
- Индикатор загрузки
- Выпадающий список результатов
- Обработка выбора

#### 6.3.2. ParticipantModal
- Список участников с поиском
- Форма создания нового участника
- Выбор участников (чекбоксы или одиночный выбор)
- Отображение возраста и даты рождения

#### 6.3.3. CountInDirectionAlert
- Предупреждение о количестве заявок по направлению
- Отображение текущего количества

#### 6.3.4. DiscountTiersEditor
- Список уровней откатов
- Добавление/удаление уровней
- Валидация диапазонов
- Визуализация уровней

#### 6.3.5. ExcelImportDialog
- Загрузка файла
- Предпросмотр данных
- Выбор события
- Кнопка импорта
- Отображение результатов

#### 6.3.6. ProtectedRoute
- Проверка авторизации
- Проверка роли
- Редирект на /login при отсутствии авторизации

#### 6.3.7. Layout
- Навигационное меню
- Отображение текущего пользователя
- Кнопка выхода
- Адаптивное меню для мобильных

#### 6.3.8. ErrorBoundary
- Обработка ошибок React
- Отображение сообщения об ошибке
- Кнопка перезагрузки

---

## 7. БЕЗОПАСНОСТЬ

### 7.1. Аутентификация
- JWT токены с коротким временем жизни
- Refresh tokens с длительным временем жизни
- Автоматическое обновление токенов
- Логирование неудачных попыток входа

### 7.2. Авторизация
- Проверка прав на уровне backend
- Middleware для защиты роутов
- Проверка прав на уровне frontend (UX)

### 7.3. Валидация данных
- Валидация всех входных данных (express-validator)
- Санитизация строковых полей
- Проверка типов данных
- Проверка диапазонов значений

### 7.4. Защита от атак
- SQL injection: Prisma ORM (параметризованные запросы)
- XSS: React экранирование, валидация входных данных
- CSRF: проверка origin, SameSite cookies
- Rate limiting на критичных endpoints

### 7.5. Хранение паролей
- Хеширование bcrypt (10 rounds)
- Никогда не передавать пароли в открытом виде
- Минимальная длина пароля: 6 символов

---

## 8. ИНТЕГРАЦИИ

### 8.1. Excel импорт/экспорт
- Библиотека: ExcelJS (backend), ExcelJS (frontend)
- Формат: .xlsx
- Поддержка кириллицы
- Парсинг сложных структур данных

### 8.2. PDF генерация
- Библиотека: pdfMake
- Поддержка кириллицы через vfs_fonts
- Форматирование таблиц
- Экспорт бухгалтерии в PDF

### 8.3. Docker
- Docker Compose для PostgreSQL
- Dockerfile для backend и frontend
- Nginx для frontend
- Health checks

---

## 9. ТЕСТИРОВАНИЕ

### 9.1. Unit тесты
- Критичная бизнес-логика (расчет откатов, пересчет статусов)
- Парсинг данных (участники, категории)
- Валидация данных

### 9.2. Интеграционные тесты
- API endpoints
- Работа с БД
- Транзакции

### 9.3. E2E тесты
- Критичные пользовательские сценарии
- Создание регистрации
- Создание оплаты
- Применение отката

---

## 10. ДЕПЛОЙ

### 10.1. Разработка
- Локальный запуск через start.sh / start.bat
- Docker Compose для PostgreSQL
- Hot reload для frontend и backend

### 10.2. Production
- Docker контейнеры для всех сервисов
- Nginx reverse proxy
- SSL сертификаты
- Резервное копирование БД
- Мониторинг и логирование

### 10.3. CI/CD
- GitHub Actions
- Автоматические тесты
- Сборка и деплой

---

## 11. ДОКУМЕНТАЦИЯ

### 11.1. Техническая документация
- README.md с инструкциями по установке
- API документация (описание всех endpoints)
- Архитектура системы
- Схема базы данных

### 11.2. Пользовательская документация
- Руководство пользователя
- Инструкции по работе с системой
- FAQ

### 11.3. Документация разработчика
- Стандарты кодирования
- Процесс разработки
- Git workflow

---

## 12. ПРИЛОЖЕНИЯ

### 12.1. Справочники (начальные данные)

**Дисциплины (47):**
Jazz, Street dance show, Contemporary, Hip-Hop, House, Waacking, Vogue, Locking, Popping, Breaking, Dancehall, Afro, Krump, Experimental, Show, Театр танца, Классический танец, Народный танец, Бальный танец, Современный танец, Эстрадный танец, Детский танец, Спортивный танец, Акробатический танец, Цирковой танец, Пантомима, Пластика, Движение, Перформанс, Инсталляция, Видео-арт, Мультимедиа, Интерактивный танец, Сайт-специфик, Импровизация, Контактная импровизация, Композиция, Хореография, Режиссура, Сценография, Музыка, Звук, Свет, Костюм, Грим, Техника, Теория

**Номинации (7):**
Соло, Дуэт/Пара, Малая группа, Формейшн, Продакшн

**Возрастные категории (8):**
Бэби, Мини 1, Мини 2, Дети, Ювеналы 1, Ювеналы 2, Юниоры, Взрослые, Смешанная

**Категории (3):**
Beginners, Basic, Advanced

---

### 12.2. Формулы расчетов

**Стоимость выступления:**
```
regularCount = max(0, participantsCount - federationParticipantsCount)
regularPrice = pricePerParticipant × regularCount
federationPrice = pricePerFederationParticipant × federationParticipantsCount
performancePrice = regularPrice + federationPrice
```

**Стоимость дипломов и медалей:**
```
diplomasPrice = pricePerDiploma × diplomasCount
medalsPrice = pricePerMedal × medalsCount
totalDiplomasAndMedalsPrice = diplomasPrice + medalsPrice
```

**Откат:**
```
originalAmount = amount + discountAmount
discountAmount = originalAmount × (discountPercent / 100)
finalAmount = originalAmount - discountAmount
```

**Статус оплаты:**
```
if (performancePaid && diplomasAndMedalsPaid) → PAID
else if (performancePaid && !diplomasAndMedalsPaid) → PERFORMANCE_PAID
else if (!performancePaid && diplomasAndMedalsPaid) → DIPLOMAS_PAID
else → UNPAID
```

---

## 13. КРИТЕРИИ ПРИЕМКИ

### 13.1. Функциональность
- Все функции из ТЗ реализованы
- Валидация работает корректно
- Обработка ошибок на всех уровнях
- Все роли работают согласно требованиям

### 13.2. Производительность
- Время отклика API < 500ms
- Загрузка страниц < 2 секунды
- Поддержка 10,000+ регистраций

### 13.3. Безопасность
- Все данные защищены
- Валидация на всех уровнях
- Нет уязвимостей

### 13.4. Документация
- Полная техническая документация
- Руководство пользователя
- Инструкции по деплою

---

## 14. ДЕТАЛЬНАЯ СПЕЦИФИКАЦИЯ БАЗЫ ДАННЫХ

### 14.1. Таблица users
- **id**: INT PRIMARY KEY AUTO_INCREMENT
- **name**: VARCHAR(255) NOT NULL
- **email**: VARCHAR(255) UNIQUE NOT NULL
- **password**: VARCHAR(255) NOT NULL (bcrypt hash)
- **role**: ENUM('ADMIN', 'REGISTRATOR', 'STATISTICIAN', 'ACCOUNTANT') DEFAULT 'REGISTRATOR'
- **city**: VARCHAR(255) NULL
- **phone**: VARCHAR(50) NULL
- **createdAt**: TIMESTAMP DEFAULT NOW()
- **updatedAt**: TIMESTAMP DEFAULT NOW() ON UPDATE NOW()

**Индексы:**
- PRIMARY KEY (id)
- UNIQUE INDEX (email)

### 14.2. Таблица events
- **id**: INT PRIMARY KEY AUTO_INCREMENT
- **name**: VARCHAR(255) NOT NULL
- **startDate**: TIMESTAMP NOT NULL
- **endDate**: TIMESTAMP NOT NULL
- **description**: TEXT NULL
- **image**: VARCHAR(500) NULL
- **status**: ENUM('DRAFT', 'ACTIVE', 'ARCHIVED') DEFAULT 'DRAFT'
- **isOnline**: BOOLEAN DEFAULT FALSE
- **paymentEnable**: BOOLEAN DEFAULT TRUE
- **categoryEnable**: BOOLEAN DEFAULT TRUE
- **songEnable**: BOOLEAN DEFAULT FALSE
- **durationMax**: INT DEFAULT 43200 (секунды)
- **durationGroupsInterval**: INT DEFAULT 0
- **durationParticipantsInterval**: INT DEFAULT 0
- **pricePerDiploma**: DECIMAL(10,2) NULL
- **pricePerMedal**: DECIMAL(10,2) NULL
- **discountTiers**: TEXT NULL (JSON строка)
- **createdAt**: TIMESTAMP DEFAULT NOW()
- **updatedAt**: TIMESTAMP DEFAULT NOW() ON UPDATE NOW()

**Индексы:**
- PRIMARY KEY (id)
- INDEX (status)

### 14.3. Таблица event_prices
- **id**: INT PRIMARY KEY AUTO_INCREMENT
- **eventId**: INT NOT NULL FK → events.id ON DELETE CASCADE
- **nominationId**: INT NOT NULL FK → nominations.id
- **pricePerParticipant**: DECIMAL(10,2) NOT NULL
- **pricePerFederationParticipant**: DECIMAL(10,2) NULL
- **createdAt**: TIMESTAMP DEFAULT NOW()
- **updatedAt**: TIMESTAMP DEFAULT NOW() ON UPDATE NOW()

**Индексы:**
- PRIMARY KEY (id)
- UNIQUE INDEX (eventId, nominationId)
- INDEX (eventId)
- INDEX (nominationId)

### 14.4. Таблица collectives
- **id**: INT PRIMARY KEY AUTO_INCREMENT
- **name**: VARCHAR(255) UNIQUE NOT NULL
- **accessory**: VARCHAR(255) NULL
- **createdAt**: TIMESTAMP DEFAULT NOW()
- **updatedAt**: TIMESTAMP DEFAULT NOW() ON UPDATE NOW()

**Индексы:**
- PRIMARY KEY (id)
- UNIQUE INDEX (name)

### 14.5. Таблица persons
- **id**: INT PRIMARY KEY AUTO_INCREMENT
- **fullName**: VARCHAR(255) NOT NULL
- **role**: ENUM('LEADER', 'TRAINER') NOT NULL
- **phone**: VARCHAR(50) NULL
- **createdAt**: TIMESTAMP DEFAULT NOW()
- **updatedAt**: TIMESTAMP DEFAULT NOW() ON UPDATE NOW()

**Индексы:**
- PRIMARY KEY (id)
- UNIQUE INDEX (fullName, role)

### 14.6. Таблица registrations
- **id**: INT PRIMARY KEY AUTO_INCREMENT
- **userId**: INT NOT NULL FK → users.id
- **eventId**: INT NOT NULL FK → events.id
- **collectiveId**: INT NOT NULL FK → collectives.id
- **disciplineId**: INT NOT NULL FK → disciplines.id
- **nominationId**: INT NOT NULL FK → nominations.id
- **ageId**: INT NOT NULL FK → ages.id
- **categoryId**: INT NULL FK → categories.id
- **danceName**: VARCHAR(255) NULL
- **duration**: VARCHAR(20) NULL (формат MM:SS)
- **participantsCount**: INT DEFAULT 0
- **federationParticipantsCount**: INT DEFAULT 0
- **diplomasCount**: INT DEFAULT 0
- **medalsCount**: INT DEFAULT 0
- **diplomasList**: TEXT NULL (многострочный текст, разделитель \\n)
- **paymentStatus**: ENUM('UNPAID', 'PERFORMANCE_PAID', 'DIPLOMAS_PAID', 'PAID') DEFAULT 'UNPAID'
- **paidAmount**: DECIMAL(10,2) NULL
- **performancePaid**: BOOLEAN DEFAULT FALSE
- **diplomasAndMedalsPaid**: BOOLEAN DEFAULT FALSE
- **diplomasPaid**: BOOLEAN DEFAULT FALSE
- **medalsPaid**: BOOLEAN DEFAULT FALSE
- **diplomasPrinted**: BOOLEAN DEFAULT FALSE
- **diplomasDataDeletedAt**: TIMESTAMP NULL (soft delete)
- **status**: ENUM('PENDING', 'APPROVED', 'REJECTED') DEFAULT 'PENDING'
- **resume**: TEXT NULL
- **number**: INT NULL (номер в событии)
- **blockNumber**: INT NULL
- **performedAt**: TIMESTAMP NULL
- **placeId**: INT NULL
- **videoUrl**: VARCHAR(500) NULL
- **songUrl**: VARCHAR(500) NULL
- **agreement**: BOOLEAN DEFAULT FALSE
- **agreement2**: BOOLEAN DEFAULT FALSE
- **createdAt**: TIMESTAMP DEFAULT NOW()
- **updatedAt**: TIMESTAMP DEFAULT NOW() ON UPDATE NOW()

**Индексы:**
- PRIMARY KEY (id)
- UNIQUE INDEX (eventId, number)
- INDEX (eventId)
- INDEX (collectiveId)
- INDEX (userId)
- INDEX (paymentStatus)
- INDEX (diplomasDataDeletedAt)

### 14.7. Таблица accounting_entries
- **id**: INT PRIMARY KEY AUTO_INCREMENT
- **registrationId**: INT NOT NULL FK → registrations.id ON DELETE CASCADE
- **collectiveId**: INT NOT NULL FK → collectives.id
- **amount**: DECIMAL(10,2) NOT NULL (сумма ПОСЛЕ отката)
- **discountAmount**: DECIMAL(10,2) DEFAULT 0 (сумма отката, только для PERFORMANCE)
- **discountPercent**: DECIMAL(5,2) DEFAULT 0 (процент отката, только для PERFORMANCE)
- **method**: ENUM('CASH', 'CARD', 'TRANSFER') NOT NULL
- **paidFor**: ENUM('PERFORMANCE', 'DIPLOMAS_MEDALS') NOT NULL
- **paymentGroupId**: VARCHAR(36) NULL (UUID для группировки)
- **paymentGroupName**: VARCHAR(255) NULL
- **deletedAt**: TIMESTAMP NULL (soft delete)
- **createdAt**: TIMESTAMP DEFAULT NOW()

**Индексы:**
- PRIMARY KEY (id)
- INDEX (registrationId)
- INDEX (collectiveId)
- INDEX (paymentGroupId)
- INDEX (deletedAt)
- INDEX (paidFor)
- INDEX (createdAt)

### 14.8. Таблица payments
- **id**: INT PRIMARY KEY AUTO_INCREMENT
- **registrationId**: INT NOT NULL FK → registrations.id ON DELETE CASCADE
- **amount**: DECIMAL(10,2) NOT NULL
- **method**: ENUM('CASH', 'CARD', 'TRANSFER') NOT NULL
- **paidFor**: ENUM('PERFORMANCE', 'DIPLOMAS_MEDALS') NOT NULL
- **createdAt**: TIMESTAMP DEFAULT NOW()

**Индексы:**
- PRIMARY KEY (id)
- INDEX (registrationId)

### 14.9. Связующие таблицы

**registration_leaders:**
- id, registrationId (FK), personId (FK), createdAt
- UNIQUE (registrationId, personId)

**registration_trainers:**
- id, registrationId (FK), personId (FK), createdAt
- UNIQUE (registrationId, personId)

**registration_participants:**
- id, registrationId (FK), participantId (FK), createdAt
- UNIQUE (registrationId, participantId)

---

## 15. ПРИМЕРЫ API ЗАПРОСОВ И ОТВЕТОВ

### 15.1. Авторизация

**POST /api/auth/login**
```json
Request:
{
  "email": "admin@ftr.ru",
  "password": "admin123"
}

Response (200):
{
  "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "refreshToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "user": {
    "id": 1,
    "name": "Администратор",
    "email": "admin@ftr.ru",
    "role": "ADMIN"
  }
}
```

**POST /api/auth/refresh**
```json
Request:
{
  "refreshToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
}

Response (200):
{
  "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "refreshToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
}
```

### 15.2. Создание регистрации

**POST /api/registrations**
```json
Request:
{
  "eventId": 1,
  "collectiveName": "Танцевальный коллектив",
  "accessory": "Школа танцев",
  "leaders": "Иванов Иван Иванович",
  "trainers": "Петрова Мария Сергеевна",
  "disciplineId": 1,
  "nominationId": 2,
  "ageId": 3,
  "categoryId": 1,
  "danceName": "Танец мечты",
  "duration": "03:30",
  "participantsCount": 2,
  "federationParticipantsCount": 0,
  "participantIds": "[1, 2]",
  "videoUrl": "https://youtube.com/...",
  "agreement": true,
  "agreement2": true
}

Response (201):
{
  "id": 123,
  "eventId": 1,
  "collectiveId": 45,
  "disciplineId": 1,
  "nominationId": 2,
  "ageId": 3,
  "categoryId": 1,
  "danceName": "Танец мечты",
  "duration": "03:30",
  "participantsCount": 2,
  "paymentStatus": "UNPAID",
  "status": "PENDING",
  "createdAt": "2025-01-15T10:30:00Z",
  ...
}
```

### 15.3. Создание оплаты

**POST /api/payments/create**
```json
Request:
{
  "registrationIds": [123, 124, 125],
  "paymentsByMethod": {
    "cash": 5000,
    "card": 10000,
    "transfer": 0
  },
  "payingPerformance": true,
  "payingDiplomasAndMedals": false,
  "applyDiscount": true,
  "paymentGroupName": "Оплата от коллектива",
  "registrationsData": [
    {
      "registrationId": 123,
      "participantsCount": 2
    }
  ]
}

Response (200):
{
  "success": true,
  "results": [
    {"regId": 123, "success": true},
    {"regId": 124, "success": true},
    {"regId": 125, "success": true}
  ],
  "totalPaid": 15000,
  "totalToPay": 13500,
  "discount": 1500
}
```

### 15.4. Получение бухгалтерии

**GET /api/accounting?eventId=1&includeDeleted=false**
```json
Response (200):
{
  "entries": [
    {
      "id": 1,
      "amount": 4500,
      "discountAmount": 500,
      "discountPercent": 10,
      "method": "CASH",
      "paidFor": "PERFORMANCE",
      "paymentGroupId": "uuid-here",
      "paymentGroupName": "Оплата от коллектива",
      "deletedAt": null,
      "createdAt": "2025-01-15T10:30:00Z",
      "registration": {
        "id": 123,
        "blockNumber": 1,
        "danceName": "Танец мечты",
        "discipline": {"name": "Jazz"},
        "nomination": {"name": "Дуэт/Пара"},
        "age": {"name": "Дети"}
      },
      "collective": {
        "id": 45,
        "name": "Танцевальный коллектив"
      }
    }
  ],
  "summary": {
    "performance": {
      "cash": 5000,
      "card": 10000,
      "transfer": 0,
      "total": 15000
    },
    "diplomasAndMedals": {
      "cash": 0,
      "card": 0,
      "transfer": 0,
      "total": 0
    },
    "totalByMethod": {
      "cash": 5000,
      "card": 10000,
      "transfer": 0
    },
    "grandTotal": 15000,
    "totalDiscount": 1500
  }
}
```

### 15.5. Применение отката к группе

**PUT /api/accounting/payment-group/uuid-here/discount**
```json
Request:
{
  "discountPercent": 15
}

Response (200):
{
  "message": "Откат применен",
  "discountPercent": 15,
  "discountAmount": 2250,
  "originalAmount": 15000,
  "finalAmount": 12750,
  "affectedEntries": 3
}
```

---

## 16. ОБРАБОТКА ОШИБОК

### 16.1. HTTP коды ответов
- **200 OK** - успешный запрос
- **201 Created** - ресурс создан
- **400 Bad Request** - ошибка валидации
- **401 Unauthorized** - не авторизован
- **403 Forbidden** - недостаточно прав
- **404 Not Found** - ресурс не найден
- **500 Internal Server Error** - ошибка сервера

### 16.2. Формат ошибок
```json
{
  "error": "Описание ошибки",
  "errors": [
    {
      "msg": "Поле обязательно",
      "param": "email",
      "location": "body"
    }
  ]
}
```

### 16.3. Типичные ошибки

**Валидация:**
- Отсутствие обязательных полей
- Неверный формат данных
- Выход за допустимые диапазоны

**Авторизация:**
- Токен отсутствует или недействителен
- Токен истек
- Недостаточно прав

**Бизнес-логика:**
- Регистрация не найдена
- Сумма оплаты не совпадает
- Откат применяется к дипломам/медалям
- Попытка удалить уже удаленную запись

---

## 17. ЛОГИРОВАНИЕ

### 17.1. Уровни логирования
- **ERROR** - критические ошибки
- **WARN** - предупреждения
- **INFO** - информационные сообщения
- **DEBUG** - отладочная информация

### 17.2. Что логировать
- Все ошибки с полным стеком
- Действия администраторов (создание/удаление пользователей)
- Критичные операции (создание оплат, применение откатов)
- Время выполнения запросов > 1 секунды

### 17.3. Формат логов
```
[2025-01-15 10:30:00] ERROR: Create payment error: Validation failed
[2025-01-15 10:30:00] INFO: User admin@ftr.ru created payment for registration 123
```

---

## 18. МИГРАЦИИ БАЗЫ ДАННЫХ

### 18.1. Prisma Migrate
- Все изменения схемы через миграции
- Версионирование миграций
- Откат миграций (dev режим)

### 18.2. Существующие миграции
1. init - начальная схема
2. add_participants_and_agreements - участники и соглашения
3. add_events_prices_and_registration_status - события, цены, статусы
4. add_discount_tiers - уровни откатов
5. add_payment_group_id - группировка платежей
6. add_soft_delete_accounting_entry - мягкое удаление записей
7. add_diplomas_soft_delete - мягкое удаление дипломов
8. update_payment_status_enum - обновление enum статусов
9. add_system_settings - системные настройки
10. add_federation_participants - федеральные участники
11. add_phone_to_persons - телефон в персонах
12. add_accountant_role - роль бухгалтера
13. add_payment_group_name - название группы платежей

### 18.3. Seed данные
- Справочники (дисциплины, номинации, возрасты, категории)
- Тестовое мероприятие
- Тестовые пользователи (ADMIN, REGISTRATOR, STATISTICIAN, ACCOUNTANT)

---

## 19. ПРОИЗВОДИТЕЛЬНОСТЬ И ОПТИМИЗАЦИЯ

### 19.1. Оптимизация запросов
- Использование select для выбора только нужных полей
- Индексы на часто используемых полях
- Избежание N+1 запросов (использование include)
- Пагинация для больших списков (если требуется)

### 19.2. Кэширование
- Справочники (дисциплины, номинации и т.д.) - кэш на уровне приложения
- Статистика - кэш на 5 минут

### 19.3. Оптимизация фронтенда
- Code splitting
- Lazy loading компонентов
- Мемоизация вычислений (useMemo)
- Debounce для поиска

---

## 20. РАСШИРЯЕМОСТЬ

### 20.1. Архитектурные решения
- Модульная структура кода
- Разделение бизнес-логики и представления
- Использование сервисов для сложной логики
- Типизация TypeScript для безопасности
- Готовность к горизонтальному масштабированию

### 20.2. Возможные направления расширения
- Уведомления по email/SMS
- Экспорт в другие форматы (PDF, JSON, XML)
- Мобильное приложение (React Native)
- Интеграция с платежными системами
- История изменений (аудит)
- Мультиязычность (i18n)
- Темная тема
- WebSocket для real-time обновлений

---

## 21. ПРЕДЛОЖЕНИЯ ПО УЛУЧШЕНИЮ СИСТЕМЫ

### 21.1. Безопасность и производительность

#### 21.1.1. Управление токенами
- **Текущее состояние:** Токены установлены на 100 лет (практически бессрочные)
- **Рекомендация:** Реализовать систему refresh токенов с коротким временем жизни access токенов (15-30 минут) и длительным refresh токенов (7-30 дней)
- **Преимущества:** Повышение безопасности, возможность отзыва токенов
- **Сложность:** Средняя

#### 21.1.2. Rate Limiting
- **Текущее состояние:** Отсутствует
- **Рекомендация:** Добавить rate limiting на критичные endpoints (login, создание оплат, импорт)
- **Преимущества:** Защита от DDoS и злоупотреблений
- **Сложность:** Низкая (express-rate-limit)

#### 21.1.3. Аудит действий
- **Текущее состояние:** Частично (логирование ошибок)
- **Рекомендация:** Создать таблицу audit_logs для записи всех критичных действий (создание/удаление регистраций, оплаты, изменения настроек)
- **Поля:** userId, action, entityType, entityId, oldValue, newValue, timestamp, ipAddress
- **Преимущества:** Отслеживание изменений, восстановление данных
- **Сложность:** Средняя

#### 21.1.4. Кэширование
- **Текущее состояние:** Отсутствует
- **Рекомендация:** 
  - Redis для кэширования справочников (дисциплины, номинации, возрасты)
  - Кэширование статистики на 5 минут
  - Кэширование автозаполнения (коллективы, персоны)
- **Преимущества:** Снижение нагрузки на БД, ускорение ответов
- **Сложность:** Средняя

### 21.2. Функциональность

#### 21.2.1. Уведомления
- **Email уведомления:**
  - При создании регистрации (коллективу)
  - При изменении статуса регистрации
  - При создании оплаты
  - Напоминания о неоплаченных регистрациях
- **Внутренние уведомления:**
  - Уведомления администраторам о новых регистрациях
  - Уведомления о критичных операциях
- **Сложность:** Высокая

#### 21.2.2. История изменений регистраций
- **Текущее состояние:** Отсутствует
- **Рекомендация:** Таблица registration_history с полями: registrationId, userId, field, oldValue, newValue, timestamp
- **Отображение:** Вкладка "История" в деталях регистрации
- **Преимущества:** Прозрачность изменений, восстановление данных
- **Сложность:** Средняя

#### 21.2.3. Массовые операции
- **Массовое редактирование регистраций:**
  - Изменение статуса для выбранных регистраций
  - Изменение блока/номера
  - Массовое добавление дипломов/медалей
- **Массовое удаление регистраций:**
  - С подтверждением и предпросмотром
- **Сложность:** Средняя

#### 21.2.4. Шаблоны регистраций
- **Рекомендация:** Возможность сохранения шаблонов регистраций для быстрого создания похожих заявок
- **Поля шаблона:** коллектив, руководители, тренеры, дисциплина, номинация, возраст, категория
- **Сложность:** Низкая

#### 21.2.5. Экспорт в PDF
- **Текущее состояние:** Экспорт в Excel и CSV
- **Рекомендация:** Добавить экспорт в PDF с форматированием:
  - Список регистраций с детализацией
  - Бухгалтерские отчеты
  - Сертификаты/дипломы (генерация PDF)
- **Сложность:** Средняя (pdfMake уже используется)

#### 21.2.6. Печать дипломов
- **Текущее состояние:** Только отметка о печати
- **Рекомендация:** Генерация PDF файлов для печати дипломов с данными из списка
- **Формат:** Один PDF на регистрацию или массовая генерация
- **Сложность:** Средняя

#### 21.2.7. Импорт с улучшениями
- **Текущее состояние:** Базовый импорт из Excel
- **Рекомендация:**
  - Режим "добавить к существующим" вместо удаления
  - Детальный предпросмотр всех изменений перед импортом
  - Возможность исправления данных в предпросмотре
  - Резервное копирование перед удалением
  - Импорт из CSV
- **Сложность:** Средняя

#### 21.2.8. Фильтры и поиск
- **Улучшения:**
  - Расширенные фильтры на странице регистраций (по статусу оплаты, статусу регистрации, дате создания)
  - Сохранение фильтров в localStorage
  - Экспорт отфильтрованных данных
- **Сложность:** Низкая

#### 21.2.9. Дашборд
- **Рекомендация:** Создать главную страницу с дашбордом:
  - Статистика по активным мероприятиям
  - Последние регистрации
  - Неоплаченные регистрации
  - Графики по дням/неделям
- **Сложность:** Средняя

### 21.3. UX/UI улучшения

#### 21.3.1. Темная тема
- **Текущее состояние:** Только светлая тема
- **Рекомендация:** Добавить переключатель темы (светлая/темная)
- **Сложность:** Низкая (Material-UI поддерживает)

#### 21.3.2. Адаптивность
- **Текущее состояние:** Частично адаптивный дизайн
- **Рекомендация:** Улучшить мобильную версию:
  - Оптимизация таблиц для мобильных
  - Гамбургер-меню
  - Упрощенные формы на маленьких экранах
- **Сложность:** Средняя

#### 21.3.3. Клавиатурные сокращения
- **Рекомендация:** Добавить горячие клавиши:
  - Ctrl+S - сохранить форму
  - Ctrl+F - поиск
  - Ctrl+N - новая регистрация
  - Esc - закрыть диалог
- **Сложность:** Низкая

#### 21.3.4. Drag & Drop
- **Рекомендация:** Возможность перетаскивания файлов для импорта
- **Сложность:** Низкая

#### 21.3.5. Автосохранение
- **Рекомендация:** Автосохранение черновиков форм регистрации
- **Сложность:** Средняя

### 21.4. Интеграции

#### 21.4.1. Платежные системы
- **Рекомендация:** Интеграция с платежными системами (ЮKassa, Stripe):
  - Онлайн оплата через систему
  - Автоматическое обновление статусов оплаты
  - Webhook для обработки платежей
- **Сложность:** Высокая

#### 21.4.2. SMS уведомления
- **Рекомендация:** Интеграция с SMS-сервисами для отправки уведомлений
- **Сложность:** Средняя

#### 21.4.3. Календарь
- **Рекомендация:** Интеграция с Google Calendar / iCal для экспорта расписания мероприятий
- **Сложность:** Низкая

#### 21.4.4. Социальные сети
- **Рекомендация:** Автоматическая публикация результатов мероприятий в социальных сетях
- **Сложность:** Средняя

### 21.5. Аналитика и отчеты

#### 21.5.1. Расширенная аналитика
- **Рекомендация:**
  - Динамика регистраций по времени
  - Анализ популярности дисциплин/номинаций
  - Прогнозирование количества участников
  - Анализ финансовых показателей
- **Сложность:** Высокая

#### 21.5.2. Настраиваемые отчеты
- **Рекомендация:** Конструктор отчетов с выбором полей и фильтров
- **Сложность:** Высокая

#### 21.5.3. Экспорт в различные форматы
- **Рекомендация:** Добавить экспорт в:
  - JSON (для интеграций)
  - XML
  - Google Sheets (через API)
- **Сложность:** Средняя

### 21.6. Технические улучшения

#### 21.6.1. Unit тесты
- **Текущее состояние:** Отсутствуют
- **Рекомендация:** Покрытие тестами критичной бизнес-логики:
  - Расчет стоимости
  - Расчет откатов
  - Пересчет статусов оплаты
  - Парсинг данных импорта
- **Сложность:** Средняя

#### 21.6.2. E2E тесты
- **Рекомендация:** Автоматизированные тесты критичных сценариев (Playwright/Cypress)
- **Сложность:** Высокая

#### 21.6.3. CI/CD
- **Рекомендация:** Настройка GitHub Actions для:
  - Автоматических тестов
  - Сборки и деплоя
  - Проверки кода (ESLint, TypeScript)
- **Сложность:** Средняя

#### 21.6.4. Мониторинг
- **Рекомендация:** Интеграция с системами мониторинга:
  - Sentry для отслеживания ошибок
  - Prometheus/Grafana для метрик
  - Логирование в централизованную систему
- **Сложность:** Средняя

#### 21.6.5. Оптимизация БД
- **Рекомендация:**
  - Анализ медленных запросов
  - Добавление недостающих индексов
  - Партиционирование больших таблиц
  - Архивация старых данных
- **Сложность:** Средняя

#### 21.6.6. Мультиязычность
- **Текущее состояние:** Только русский язык
- **Рекомендация:** Добавить поддержку английского языка (i18n)
- **Сложность:** Средняя

### 21.7. Приоритизация улучшений

#### Высокий приоритет (P0)
1. Исправление управления токенами (безопасность)
2. Rate limiting (безопасность)
3. Аудит действий (безопасность и прозрачность)
4. Unit тесты критичной логики (надежность)

#### Средний приоритет (P1)
1. Кэширование справочников (производительность)
2. Email уведомления (функциональность)
3. История изменений регистраций (прозрачность)
4. Экспорт в PDF (функциональность)
5. Расширенные фильтры (UX)

#### Низкий приоритет (P2)
1. Темная тема (UX)
2. Шаблоны регистраций (UX)
3. Клавиатурные сокращения (UX)
4. Дашборд (UX)
5. Мультиязычность (расширение)

#### Будущие улучшения (P3)
1. Интеграция с платежными системами
2. Расширенная аналитика
3. Мобильное приложение
4. WebSocket для real-time обновлений

---

**Конец технического задания**

**Объем документа:** ~2500+ строк  
**Дата создания:** 2025  
**Дата обновления:** 2025  
**Версия:** 1.1
