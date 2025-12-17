# Тестовые скрипты смены email (Telegram 2FA)

Задача: попытаться сменить/установить email восстановления для двухфакторной аутентификации (2FA) аккаунта Telegram на `arhteh601@gmail.com`.

Важно:
- Email в Telegram используется для восстановления пароля 2FA. Это «официальный» функционал MTProto, а не «логин по email».
- Для изменения email почти всегда требуется текущий пароль 2FA. Если 2FA не включена — сначала её нужно включить, задав новый пароль.
- При изменении/установке email Telegram отправляет код на указанный адрес — скрипты ожидают ввод кода в консоли.

## Вариант 1: Python (Telethon)

Файл: `./python/change_email_telethon.py`

Предустановки:
- Python 3.10+
- Установить зависимости (Telethon). Можно использовать уже указанную зависимость в `backend/requirements.txt` или локально:

```powershell
# локальная установка для test/python
python -m venv .venv ; .\.venv\Scripts\Activate.ps1 ; pip install --upgrade pip ; pip install telethon==1.35.0
```

Запуск:

```powershell
# из корня репозитория
cd test/python
$env:NEW_EMAIL = "arhteh601@gmail.com"
# при желании можно указать TELEGRAM_API_ID/TELEGRAM_API_HASH
python .\change_email_telethon.py
```

Сценарий:
1) Если нет сессии — введите номер телефона и код из Telegram, при включенной 2FA — пароль.
2) Если 2FA отключена, скрипт предложит её включить и сразу задать email.
3) Сценарий отправит код на email и попросит ввести его в консоли.
4) После подтверждения email будет привязан.

Сессионный файл Telethon по умолчанию: `test/python/telethon.session` (сессии от gramJS несовместимы с Telethon).

## Вариант 2: Node.js (GramJS — telegram)

Файл: `./node/change_email_gramjs.js`

Предустановки:
- Node.js 18+
- Установка зависимостей:

```powershell
cd test/node
npm install
```

Переменные окружения (необязательно):
- `TELEGRAM_API_ID` и `TELEGRAM_API_HASH` — по умолчанию берутся из запроса (33104909 / 788e3ff651cd500926b4be32d07daa45).
- `TELEGRAM_GRAMJS_SESSION` — путь к файлу сессии GramJS. По умолчанию используется:
  `C:\Users\user\Desktop\Main\12121\telegram-sessions\+79933647011\+79933647011.session`
- `NEW_EMAIL` — новый email (по умолчанию `arhteh601@gmail.com`).

Запуск:

```powershell
cd test/node
$env:NEW_EMAIL = "arhteh601@gmail.com"
npm run start:gramjs
```

Сценарий:
- Если сессия действительна — сразу попытается сменить email; при включенной 2FA попросит текущий пароль.
- Если 2FA отключена — предложит включить (через helper `edit2FA`) и затем подтвердить email кодом из письма.

## Примечания и ограничения
- Telegram не поддерживает «логин по email» для пользователя — email служит только для восстановления 2FA.
- Для смены email почти всегда требуется текущий пароль 2FA или включение 2FA с новым паролем.
- Сессии Telethon и GramJS несовместимы. Для Python создаётся отдельная сессия `telethon.session`.
- Если при запуске Node-скрипта будет ошибка версии (нет helper `edit2FA`), используйте Python-скрипт — Telethon стабильно поддерживает эти операции.

## Безопасность
- Не передавайте пароль 2FA и коды подтверждения третьим лицам.
- Храните файлы сессий в защищённом месте. Удалите их после завершения работ при необходимости.
