# Описание структуры базы данных CRM - Granovski CRM

**Дата создания бэкапа:** 17 декабря 2025 г., 19:39:54
**Кодировка:** UTF-8
**СУБД:** PostgreSQL 16-alpine
**База данных:** crm_db

## Основные параметры подключения

- **Пользователь:** crm_user  
- **Пароль:** crm_password
- **База:** crm_db
- **Порт:** 5433 (внешний), 5432 (внутренний в контейнере)
- **Контейнер:** crm-postgres-local

## Структура таблиц

### 1. **users** - Пользователи системы
Основная таблица пользователей CRM системы
- `id` (SERIAL, PRIMARY KEY) - Уникальный идентификатор пользователя
- `username` (VARCHAR, UNIQUE, NOT NULL) - Логин пользователя
- `password_hash` (VARCHAR, NOT NULL) - Хэш пароля
- `full_name` (VARCHAR) - Полное имя пользователя
- `role` (VARCHAR, DEFAULT 'user') - Роль пользователя (admin/manager/user)
- `is_active` (BOOLEAN, DEFAULT true) - Активен ли пользователь
- `created_at` (TIMESTAMP, DEFAULT NOW()) - Дата создания
- `updated_at` (TIMESTAMP, DEFAULT NOW()) - Дата обновления

**Триггеры:** update_users_updated_at - автообновление updated_at
**Индексы:** idx_users_username - по полю username

### 2. **databases** - Загруженные базы данных
Таблица для хранения информации о загруженных файлах баз данных
- `id` (SERIAL, PRIMARY KEY) - Уникальный идентификатор базы
- `name` (VARCHAR, NOT NULL) - Название базы данных
- `filename` (VARCHAR, NOT NULL) - Имя файла
- `file_path` (VARCHAR, NOT NULL) - Путь к файлу
- `total_records` (INTEGER, DEFAULT 0) - Общее количество записей
- `uploaded_by` (INTEGER, FOREIGN KEY -> users.id) - Кто загрузил базу
- `upload_date` (TIMESTAMP, DEFAULT NOW()) - Дата загрузки
- `is_active` (BOOLEAN, DEFAULT true) - Активна ли база

**Связи:** 
- databases.uploaded_by -> users.id

### 3. **clients** - Клиенты
Основная таблица клиентов
- `id` (SERIAL, PRIMARY KEY) - Уникальный идентификатор клиента
- `database_id` (INTEGER, FOREIGN KEY -> databases.id) - Связь с базой данных
- `full_name` (VARCHAR) - ФИО клиента
- `phone` (VARCHAR) - Основной телефон
- `phone_2` (VARCHAR) - Дополнительный телефон 2
- `phone_3` (VARCHAR) - Дополнительный телефон 3
- `phone_4` (VARCHAR) - Дополнительный телефон 4
- `phone_5` (VARCHAR) - Дополнительный телефон 5
- `phone_6` (VARCHAR) - Дополнительный телефон 6
- `phone_7` (VARCHAR) - Дополнительный телефон 7
- `birth_date` (DATE) - Дата рождения
- `birth_place` (TEXT) - Место рождения
- `wikipedia_link` (TEXT) - Ссылка на Википедию
- `snils` (VARCHAR) - СНИЛС
- `inn` (VARCHAR) - ИНН
- `passport` (VARCHAR) - Паспортные данные
- `address_1` (TEXT) - Адрес 1
- `address_2` (TEXT) - Адрес 2
- `address_3` (TEXT) - Адрес 3
- `address_4` (TEXT) - Адрес 4
- `address_5` (TEXT) - Адрес 5
- `email` (VARCHAR) - Email
- `company` (TEXT) - Компания
- `position` (VARCHAR) - Должность
- `tags` (TEXT) - Теги
- `social_networks` (TEXT) - Социальные сети
- `related_persons` (TEXT) - Связанные лица
- `vehicles` (TEXT) - Транспортные средства
- `call_status` (VARCHAR, DEFAULT 'new') - Статус звонка
- `callback_datetime` (TIMESTAMP) - Дата и время перезвона
- `assigned_to` (INTEGER, FOREIGN KEY -> users.id) - Назначен менеджеру
- `transferred_to` (INTEGER, FOREIGN KEY -> users.id) - Передан менеджеру
- `transfer_date` (TIMESTAMP) - Дата передачи
- `is_priority` (BOOLEAN, DEFAULT false) - Приоритетный клиент
- `created_at` (TIMESTAMP, DEFAULT NOW()) - Дата создания
- `updated_at` (TIMESTAMP, DEFAULT NOW()) - Дата обновления

**Связи:**
- clients.database_id -> databases.id
- clients.assigned_to -> users.id
- clients.transferred_to -> users.id

**Индексы:**
- idx_clients_database_id - по database_id
- idx_clients_assigned_to - по assigned_to
- idx_clients_transferred_to - по transferred_to
- idx_clients_call_status - по call_status
- idx_clients_callback_datetime - по callback_datetime

**Триггеры:** update_clients_updated_at

### 4. **call_filters** - Фильтры звонков
Таблица для сохранения настроек фильтров
- `id` (SERIAL, PRIMARY KEY) - Уникальный идентификатор
- `name` (VARCHAR, NOT NULL) - Название фильтра
- `filter_config` (JSONB) - Конфигурация фильтра в JSON
- `database_ids` (INTEGER[]) - Массив ID баз данных
- `created_by` (INTEGER, FOREIGN KEY -> users.id) - Кто создал
- `is_active` (BOOLEAN, DEFAULT true) - Активен ли фильтр
- `created_at` (TIMESTAMP, DEFAULT NOW()) - Дата создания
- `updated_at` (TIMESTAMP, DEFAULT NOW()) - Дата обновления

**Связи:**
- call_filters.created_by -> users.id

**Индексы:** idx_call_filters_created_by
**Триггеры:** update_call_filters_updated_at

### 5. **call_history** - История звонков
Журнал всех совершенных звонков
- `id` (SERIAL, PRIMARY KEY) - Уникальный идентификатор
- `client_id` (INTEGER, FOREIGN KEY -> clients.id) - ID клиента
- `user_id` (INTEGER, FOREIGN KEY -> users.id) - ID пользователя
- `phone_number` (VARCHAR) - Номер телефона
- `call_duration` (INTEGER) - Продолжительность в секундах
- `call_result` (VARCHAR) - Результат звонка
- `notes` (TEXT) - Заметки по звонку
- `call_date` (TIMESTAMP, DEFAULT NOW()) - Дата и время звонка

**Связи:**
- call_history.client_id -> clients.id
- call_history.user_id -> users.id

**Индексы:**
- idx_call_history_client_id
- idx_call_history_user_id

### 6. **client_notes** - Заметки по клиентам
Заметки пользователей по клиентам
- `id` (SERIAL, PRIMARY KEY) - Уникальный идентификатор
- `client_id` (INTEGER, FOREIGN KEY -> clients.id) - ID клиента
- `user_id` (INTEGER, FOREIGN KEY -> users.id) - ID пользователя
- `note` (TEXT, NOT NULL) - Текст заметки
- `is_private` (BOOLEAN, DEFAULT false) - Приватная ли заметка
- `created_at` (TIMESTAMP, DEFAULT NOW()) - Дата создания
- `updated_at` (TIMESTAMP, DEFAULT NOW()) - Дата обновления

**Связи:**
- client_notes.client_id -> clients.id
- client_notes.user_id -> users.id

**Индексы:** idx_client_notes_client_id
**Триггеры:** update_client_notes_updated_at

### 7. **status_buttons** - Кнопки статусов
Настраиваемые кнопки статусов для разных страниц
- `id` (SERIAL, PRIMARY KEY) - Уникальный идентификатор
- `page` (VARCHAR, NOT NULL) - Страница ('calling' или 'wiki')
- `status_value` (VARCHAR, NOT NULL) - Значение статуса
- `display_name` (VARCHAR, NOT NULL) - Отображаемое название
- `color` (VARCHAR, DEFAULT '#3b82f6') - Цвет кнопки
- `position` (INTEGER, DEFAULT 0) - Позиция кнопки
- `is_active` (BOOLEAN, DEFAULT true) - Активна ли кнопка
- `created_by` (INTEGER, FOREIGN KEY -> users.id) - Кто создал
- `updated_by` (INTEGER, FOREIGN KEY -> users.id) - Кто обновил
- `created_at` (TIMESTAMP, DEFAULT NOW()) - Дата создания
- `updated_at` (TIMESTAMP, DEFAULT NOW()) - Дата обновления

**Связи:**
- status_buttons.created_by -> users.id
- status_buttons.updated_by -> users.id

**Ограничения:** Уникальная пара (page, status_value)
**Индексы:** idx_status_buttons_page_position
**Триггеры:** update_status_buttons_updated_at

### 8. **status_layout_settings** - Настройки макета статусов
Настройки расположения кнопок статусов
- `id` (SERIAL, PRIMARY KEY) - Уникальный идентификатор
- `page` (VARCHAR, NOT NULL) - Страница
- `buttons_per_row` (INTEGER, DEFAULT 4) - Кнопок в ряду
- `created_at` (TIMESTAMP, DEFAULT NOW()) - Дата создания
- `updated_at` (TIMESTAMP, DEFAULT NOW()) - Дата обновления

**Триггеры:** update_status_layout_settings_updated_at

### 9. **page_visibility_rules** - Правила видимости страниц
Управление доступом к страницам для разных ролей
- `id` (SERIAL, PRIMARY KEY) - Уникальный идентификатор
- `role` (VARCHAR, NOT NULL) - Роль пользователя
- `page_key` (VARCHAR, NOT NULL) - Ключ страницы
- `is_visible` (BOOLEAN, DEFAULT true) - Видима ли страница
- `created_by` (INTEGER, FOREIGN KEY -> users.id) - Кто создал правило
- `updated_by` (INTEGER, FOREIGN KEY -> users.id) - Кто обновил
- `created_at` (TIMESTAMP, DEFAULT NOW()) - Дата создания
- `updated_at` (TIMESTAMP, DEFAULT NOW()) - Дата обновления

**Связи:**
- page_visibility_rules.created_by -> users.id
- page_visibility_rules.updated_by -> users.id

**Ограничения:** Уникальная пара (role, page_key)
**Индексы:**
- idx_page_visibility_role
- idx_page_visibility_page_key

**Триггеры:** update_page_visibility_rules_updated_at

### 10. **announcements** - Объявления
Система объявлений и уведомлений
- `id` (SERIAL, PRIMARY KEY) - Уникальный идентификатор
- `title` (VARCHAR, NOT NULL) - Заголовок объявления
- `message` (TEXT, NOT NULL) - Текст сообщения
- `type` (VARCHAR, DEFAULT 'popup') - Тип ('popup', 'banner')
- `target_type` (VARCHAR, DEFAULT 'all') - Кому показывать ('all', 'role', 'user')
- `target_role` (VARCHAR) - Целевая роль
- `target_user_id` (INTEGER, FOREIGN KEY -> users.id) - Целевой пользователь
- `banner_repeat_count` (INTEGER, DEFAULT 1) - Количество повторов баннера
- `banner_duration_minutes` (INTEGER, DEFAULT 60) - Длительность показа баннера
- `is_active` (BOOLEAN, DEFAULT true) - Активно ли объявление
- `expires_at` (TIMESTAMP) - Дата истечения
- `created_by` (INTEGER, FOREIGN KEY -> users.id) - Кто создал
- `updated_by` (INTEGER, FOREIGN KEY -> users.id) - Кто обновил
- `created_at` (TIMESTAMP, DEFAULT NOW()) - Дата создания
- `updated_at` (TIMESTAMP, DEFAULT NOW()) - Дата обновления

**Связи:**
- announcements.target_user_id -> users.id
- announcements.created_by -> users.id
- announcements.updated_by -> users.id

**Индексы:**
- idx_announcements_active
- idx_announcements_target

**Триггеры:** update_announcements_updated_at

### 11. **push_subscriptions** - Push подписки
Подписки на push-уведомления
- `id` (SERIAL, PRIMARY KEY) - Уникальный идентификатор
- `user_id` (INTEGER, FOREIGN KEY -> users.id) - ID пользователя
- `endpoint` (TEXT, UNIQUE, NOT NULL) - Endpoint для push
- `p256dh` (TEXT, NOT NULL) - Публичный ключ
- `auth` (TEXT, NOT NULL) - Auth token
- `created_at` (TIMESTAMP, DEFAULT NOW()) - Дата создания

**Связи:**
- push_subscriptions.user_id -> users.id

**Ограничения:** Уникальный endpoint

### 12. **exports_log** - Журнал экспорта
Логирование экспорта данных
- `id` (SERIAL, PRIMARY KEY) - Уникальный идентификатор
- `user_id` (INTEGER, FOREIGN KEY -> users.id) - Кто экспортировал
- `session_id` (VARCHAR) - ID сессии
- `action` (VARCHAR, NOT NULL) - Тип действия
- `data_exported` (JSONB) - Экспортированные данные
- `export_date` (TIMESTAMP, DEFAULT NOW()) - Дата экспорта

**Связи:**
- exports_log.user_id -> users.id

**Индексы:**
- idx_exports_log_user_id
- idx_exports_log_session_id
- idx_exports_log_action

### 13. **session_history** - История сессий
Журнал сессий пользователей
- `id` (SERIAL, PRIMARY KEY) - Уникальный идентификатор
- `user_id` (INTEGER, FOREIGN KEY -> users.id) - ID пользователя
- `session_id` (VARCHAR, NOT NULL) - ID сессии
- `login_time` (TIMESTAMP, DEFAULT NOW()) - Время входа
- `logout_time` (TIMESTAMP) - Время выхода
- `ip_address` (INET) - IP адрес
- `user_agent` (TEXT) - User agent браузера

**Связи:**
- session_history.user_id -> users.id

**Индексы:**
- idx_session_history_user_id
- idx_session_history_session_id

### 14. **telegram_sessions** - Telegram сессии
Сессии для работы с Telegram API
- `id` (SERIAL, PRIMARY KEY) - Уникальный идентификатор
- `phone_number` (VARCHAR, UNIQUE, NOT NULL) - Номер телефона
- `client_id` (INTEGER, FOREIGN KEY -> clients.id) - Связанный клиент
- `session_data` (TEXT) - Данные сессии
- `is_active` (BOOLEAN, DEFAULT true) - Активна ли сессия
- `created_by` (INTEGER, FOREIGN KEY -> users.id) - Кто создал
- `created_at` (TIMESTAMP, DEFAULT NOW()) - Дата создания
- `updated_at` (TIMESTAMP, DEFAULT NOW()) - Дата обновления

**Связи:**
- telegram_sessions.client_id -> clients.id
- telegram_sessions.created_by -> users.id

**Ограничения:** Уникальный phone_number
**Индексы:**
- idx_telegram_sessions_phone
- idx_telegram_sessions_client_id
- idx_telegram_sessions_created_by

**Триггеры:** update_telegram_sessions_updated_at

## Функции

### update_updated_at_column()
Универсальная функция для автоматического обновления поля `updated_at` при изменении записи.

## Файлы бэкапа

1. **full_db_backup_20251217_193954.sql** - Полный дамп базы данных с данными (UTF-8)
2. **database_schema_only_20251217_193954.sql** - Только структура без данных (UTF-8)
3. **database_structure_tables_20251217_193954.txt** - Список таблиц с размерами
4. **database_full_schema_20251217_193954.txt** - Полная схема в текстовом формате

## Особенности кодировки

- Кодировка: UTF-8
- Локаль: ru_RU.UTF-8
- Поддержка кириллицы: Да
- Параметры PostgreSQL:
  - client_encoding=UTF8
  - lc_messages=ru_RU.UTF-8
  - POSTGRES_INITDB_ARGS="--encoding=UTF8 --locale=ru_RU.UTF-8"

## Рекомендации по восстановлению

1. Убедитесь, что целевая база данных настроена с UTF-8 кодировкой
2. Используйте psql с параметром --set client_encoding=UTF8
3. При восстановлении: `psql -U crm_user -d crm_db --set client_encoding=UTF8 < backup_file.sql`

## Размеры и статистика

- Общее количество таблиц: 14
- Общее количество индексов: 17
- Общее количество триггеров: 9
- Общее количество внешних ключей: 20
- Общее количество последовательностей: 13

Дата создания документации: 17 декабря 2025 г.
Автор: Система автоматического документирования CRM