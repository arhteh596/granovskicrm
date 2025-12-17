# План работ (TODO)

Документ отражает полный цикл и ориентирован на интеграцию только в существующую архитектуру бэкенда (routes → controllers → services → scripts). Отдельные CLI-инструменты не используются в продакшене.

## Этап 0. Подготовка
- [ ] Python 3.10+ на backend-хосте.
- [ ] Зависимости для Python-скриптов (если используются новые модули) — согласовать и зафиксировать в инструкции для деплоя (без создания новых файлов инструкций).
- [ ] Переменные окружения в Node: TELEGRAM_* уже есть; для почты/EMAIL_LIST — использовать существующие механизмы конфигурации (без добавления новых инструкций).

## Этап 1. Исследование Telethon (низкоуровневые вызовы)
- [ ] `account.SendVerifyEmailCode`, `account.VerifyEmail`, `auth.SendCode` — логика loginChange/loginSetup.
- [ ] `account.UpdateNotifySettings`, `InputPeerNotifySettings`, `InputNotifyPeer` — управление уведомлениями.
- [ ] `contacts.Block`, `messages.GetHistory`, `messages.DeleteMessages|DeleteHistory`, `folders.EditPeerFolders` — действия с чатом 777000.
- [ ] Поиск: `iter_messages`, `messages.Search` — стратегия быстрого контекстного поиска.
- [ ] Фото профиля: `photos.GetUserPhotos` + download.
- [ ] Контакты: `contacts.GetContacts`.
- [ ] Ограничения (FloodWait, rate limits) и best practices.

## Этап 2. Проектирование интеграции в backend
- [ ] Python-скрипты размещаем в `backend/src/telegram/scripts/`.
- [ ] Логи действий — в `telegram-sessions/<phone>/session.log` (единый формат: time | level | шаг | сообщение).
- [ ] Экспорты — в `telegram-sessions/<phone>/exports/<feature>/...`.
- [ ] Все скрипты возвращают итоговый JSON в stdout для контроллеров.
- [ ] Сервисный слой: расширить `telegramAuth.service.ts` методами-обёртками `run()`.
- [ ] Маршруты/контроллеры: добавить POST-эндпоинты для “катки”.

## Этап 3. Реализация фич
- [ ] 777000 (уведомления off, блокировка, удалить 5 последних, архив):
	- [ ] Уточнить/дополнить `automate_777000.py` — вместо тотального `DeleteHistory` удалять строго последние 5 сообщений (`GetHistory(limit=5)` → `DeleteMessages`).
	- [ ] Проверить `folders.EditPeerFolders` (folder_id=1) и фиксировать результат в лог.
	- [ ] Маршрут: `POST /api/telegram/katka/notifications-off` → controller → service. 
- [ ] Смена login email (round-robin EMAIL_LIST, IMAP-код):
	- [ ] Использовать/адаптировать `auto_change_login_email.py` (низкоуровневые вызовы, fallback loginSetup, маскирование, ретраи IMAP).
	- [ ] Маршрут: `POST /api/telegram/katka/change-login-email/auto` (уже есть контроллер `autoChangeLoginEmail`).
- [ ] Паттерны (SEARCH_PATTERNS, контекст ±5, медиа ≤10 МБ):
	- [ ] Добавить `export_patterns.py` (быстрый проход по диалогам, сбор контекстов, скачивание медиа, сохранение мета).
	- [ ] Service: `exportPatterns(phone)` → `run('export_patterns.py', ...)`.
	- [ ] Route/Controller: `POST /api/telegram/katka/patterns`.
- [ ] Аватарка:
	- [ ] Добавить `export_avatar.py` (последняя аватарка → `telegram-sessions/<phone>/avatar.*`).
	- [ ] Service: `exportAvatar(phone)`.
	- [ ] Route/Controller: `POST /api/telegram/katka/avatar`; UI считывает файл и отображает в карточке.
- [ ] Баланс по ботам (CRYPTO_WALLET_BOTS, CRYPTO_BALANCE_COMMANDS):
	- [ ] Добавить `collect_balance.py` (если нет истории — пропуск; отправка команд, ожидание ответа, парсинг валют; `exports/balance/balances.json`).
	- [ ] Service: `collectBalance(phone)`.
	- [ ] Route/Controller: `POST /api/telegram/katka/balance`.
- [ ] Контакты с фото:
	- [ ] Добавить `export_contacts_with_photos.py` (скачивание миниатюр; JSON/структура в экспорт).
	- [ ] Service/Route/Controller: `POST /api/telegram/katka/export-contacts-photos`.

## Этап 4. Резервные алгоритмы и устойчивость
- [ ] IMAP: ретраи с экспоненциальной задержкой, таймауты, запасные фильтры по заголовкам.
- [ ] Email round-robin: корректное хранение индекса в папке сессии (например `email_rr_index.json`), защита от гонок (блокировка файла).
- [ ] Поиск: ограничение скорости/объёма, пропуски больших медиа, паузы при FloodWait.
- [ ] Баланс: fallback по альтернативным командам из `CRYPTO_BALANCE_COMMANDS`.
- [ ] 777000: валидация результата каждого шага (mute, block, delete5, archive) и повторная попытка при частичной неудаче.

## Этап 5. Тестирование
- [ ] Юнит-проверки Python-скриптов на синтаксис и базовую работоспособность (локально).
- [ ] Интеграционные прогоны эндпоинтов через backend (на тестовой сессии).
- [ ] Валидация логов шагов и ошибок; проверка ожидаемых артефактов в `exports`.
- [ ] Проверка UI “катки”: отображение аватарки, чтение логов, скачивание выгрузок через `/api/telegram/exports/:sessionId/:fileName`.

## Этап 6. Поддержка и оптимизация
- [ ] Отладка инцидентов из логов `session.log` и stderr Python.
- [ ] Оптимизация поиска «паттерны» на больших объёмах истории (батчи, лимиты, фильтры).
- [ ] Метрики в логах: длительность операций, количество найденных совпадений/файлов/балансов.

Примечание: не создаём дополнительных файлов инструкций — все уточнения встраиваем в существующую документацию и кодовую базу.