# Локальные инструкции: Telethon инструменты и интеграция

Документ для разработчиков и DevOps-инженеров. Описывает локальные CLI-инструменты на Python для работы с аккаунтами Telegram через Telethon (низкоуровневые методы), правила окружения, логи, и интеграцию с текущим проектом.

## Обзор

- Язык/библиотеки: Python 3.10+, Telethon, python-dotenv.
- Назначение: единый CLI для обслуживания сессий Telegram (смена login email, уведомления, поиск по паттернам, аватарка, баланс, экспорт контактов).
- Состояние: все команды логируют ход выполнения и ошибки в файл сессии + в консоль.
- Безопасность: секреты только через .env, файлы и логи не содержат паролей/кодовых значений.

## Структура (встраивание в текущий backend)

- Python-скрипты размещаем строго в `backend/src/telegram/scripts/` (единая точка вызова из Node).
- Вызов скриптов и маршрутизация — через `backend/src/telegram/services/telegramAuth.service.ts` (метод `run()` уже реализован).
- Экспозиция в API — через `backend/src/telegram/controllers/telegram.controller.ts` и `backend/src/routes/telegram.routes.ts`.
- Хранилище сессий/логов/экспортов — `SESSION_STORAGE_PATH` из `backend/src/telegram/config/credentials.ts` (по умолчанию `./telegram-sessions`).
- Логи действий пишем в `telegram-sessions/<phone>/session.log` + возвращаем JSON-результаты для UI.

## Переменные окружения (.env)

Скопируйте `.env.example` в `.env` и заполните:

- `API_ID` — Telegram API ID.
- `API_HASH` — Telegram API Hash.
- `SESSION_DIR` — директория с .session файлами (по умолчанию `telegram-sessions`).
- `EMAIL_LIST` — список e-mail через запятую для login email (карусель/round-robin).
- `GMAIL_ADDRESS` — адрес почты, куда перенаправляются коды от Telegram.
- `GMAIL_APP_PASSWORD` — пароль приложения для IMAP.
- `IMAP_SERVER` — IMAP сервер (по умолчанию `imap.gmail.com`).
- `SEARCH_PATTERNS` — ключевые слова/фразы через запятую.
- `CRYPTO_WALLET_BOTS` — список ботов через запятую (например `@wallet,@CryptoBot`).
- `CRYPTO_BALANCE_COMMANDS` — возможные команды запроса баланса (по умолчанию `balance,wallet`).

## Интеграция в существующую архитектуру backend

Все функции встраиваем в уже существующую цепочку: Route → Controller → Service (exec Python script) → Session files/exports. Никаких отдельных CLI в проде — только вызовы из Node.

Что нужно добавить/использовать:

- Уведомления off / блок / удаление / архив 777000
  - Скрипт: уже есть `automate_777000.py` (при необходимости дополняем удалением «последних 5 сообщений» вместо тотального `DeleteHistory`).
  - Service: `telegramAuthService.automate777000(phone)` — уже реализован.
  - Route: добавить в `telegram.routes.ts`
    - `router.post('/katka/notifications-off', authenticate, telegramController.automate777000);`

- Смена login email (round-robin из EMAIL_LIST)
  - Если требуется автоматизация «код из почты» — реализуем/дополняем скрипт в `scripts/` (либо используем уже имеющийся `auto_change_login_email.py`).
  - Service: `telegramAuthService.autoChangeLoginEmail(phone)` — уже есть.
  - Route: `router.post('/katka/change-login-email/auto', authenticate, telegramController.autoChangeLoginEmail);`

- Паттерны (поиск по SEARCH_PATTERNS с контекстом ±5 и выгрузкой медиа ≤10 МБ)
  - Новый скрипт: `export_patterns.py` в `backend/src/telegram/scripts/` (на Telethon низкого уровня; экспорт в `exports/patterns/`).
  - Service: `exportPatterns(phone)` с вызовом `run('export_patterns.py', [...])`.
  - Controller + Route:
    - Controller: `exportPatterns(req, res)`.
    - Route: `router.post('/katka/patterns', authenticate, telegramController.exportPatterns);`

- Аватарка (сохранить текущую аватарку и отобразить в карточке)
  - Новый скрипт: `export_avatar.py` (берёт последнюю через `photos.GetUserPhotos`, сохраняет `avatar.*` в корень папки сессии).
  - Service: `exportAvatar(phone)`.
  - Controller + Route:
    - `router.post('/katka/avatar', authenticate, telegramController.exportAvatar);`
  - UI читает файл `telegram-sessions/<phone>/avatar.*` и показывает превью.

- Баланс по ботам (CRYPTO_WALLET_BOTS, CRYPTO_BALANCE_COMMANDS)
  - Новый скрипт: `collect_balance.py` (проверка истории, отправка команд, парсинг ответов; результат в `exports/balance/balances.json`).
  - Service: `collectBalance(phone)`.
  - Route: `router.post('/katka/balance', authenticate, telegramController.collectBalance);`

- Экспорт контактов и контактов с фото
  - Контакты CSV уже реализованы (`export_contacts_csv.py` + `telegramAuthService.exportContactsCsv`).
  - Для «с фото» — новый скрипт: `export_contacts_with_photos.py` → `exports/contacts_with_photos/`.
  - Route: `router.post('/katka/export-contacts-photos', authenticate, telegramController.exportContactsWithPhotos);`

Важно: каждый скрипт обязан писать читаемые шаги в `telegram-sessions/<phone>/session.log` и финальный JSON в stdout, чтобы контроллер вернул корректный ответ UI.

## Реализация и низкоуровневые методы

- Login Email:
  - `account.SendVerifyEmailCode` с `EmailVerifyPurposeLoginChange` и `EmailVerifyPurposeLoginSetup`.
  - `auth.SendCode` для получения `phone_code_hash` при первичной установке.
  - `account.VerifyEmail` подтверждением кода из письма (IMAP парсинг из `email_utils`).
- Уведомления/777000:
  - `account.UpdateNotifySettings` с `InputPeerNotifySettings` (mute, silent).
  - `contacts.Block` для блокировки.
  - `messages.GetHistory` + `messages.DeleteMessages` (или `DeleteHistory`) для удаления последних 5 сообщений.
  - `folders.EditPeerFolders` с `folder_id = 1` для архивирования.
- Паттерны:
  - Перебор `dialogs` + `iter_messages` по чатам с локальным буфером для контекста ±5.
  - Скачивание медиа до 10 МБ, де-дупликация по id, сохранение метаданных.
- Аватарка:
  - `photos.GetUserPhotos` + скачивание файла последней аватарки.
- Баланс по ботам:
  - Проверка истории взаимодействия, отправка команд (`balance`, `wallet`), ожидание ответа, парсинг.
- Контакты:
  - `contacts.GetContacts` + сериализация полей; при необходимости `download_profile_photo` для миниатюр.

## Логи и наблюдаемость

- Все команды пишут логи в консоль и `telegram-sessions/<session>/session.log`.
- Формат: timestamp | level | команда | шаг | сообщение.
- Ошибки содержат стеки и подробности Telethon исключений (FloodWait, EmailInvalid и т.д.).

## Интеграция со страницей «катка»

- Фронтенд вызывает существующий REST API бэкенда (`/api/telegram/...`).
- Для новых кнопок добавляем соответствующие маршруты (см. выше) и контроллеры, которые дергают сервис-методы.
- Прогресс/результаты UI читает из:
  - `telegram-sessions/<phone>/session.log` (журнал шагов),
  - файлов выгрузки в `telegram-sessions/<phone>/exports/...`;
  - для скачивания есть уже эндпоинт `GET /api/telegram/exports/:sessionId/:fileName`.

## Откат и резервы

- Команды допускают повторные запуски (idempotent где возможно).
- При FloodWait — логируется рекомендуемая пауза; повтор выполнять по логам.
- Для login email реализован fallback: если `loginChange` даёт `EmailNotSetup` — выполняется `loginSetup`.
- Ведётся round-robin e-mail из `EMAIL_LIST` с сохранением индекса в `email_rr_index.json` внутри директории сессии.

## Риски и меры

- Не сохранять в репозитории реальные секреты и полученные коды.
- Обрабатывать ошибки IMAP и недоступность почты с ретраями.
- Ограничивать объёмы выгружаемых медиа (<=10 МБ) и скорость запросов к API Telegram.

---

Подробные этапы реализации, тесты и планы см. в `TODO.md`.

Важное: все функции внедряем в текущую архитектуру бэкенда, сохраняя связь и отображение в UI. Не создаём дополнительных файлов инструкций — этот документ является единственным источником правды.