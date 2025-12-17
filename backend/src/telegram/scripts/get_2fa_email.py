import sys
import json
import os
import asyncio
from telethon import TelegramClient, functions, types

# Получение email паттерна (маски) если требуется настройка либо уже привязана почта для login 2FA
# Логика:
# 1. Подключаемся по номеру телефона к существующей сессии (файл сессии создаётся ранее send_code).
# 2. Запрашиваем информацию о пароле: functions.account.GetPasswordRequest()
# 3. В ответе может быть:
#    - email_unconfirmed_pattern (если требуется подтвердить email)
#    - email_verified (если подтверждён) + pattern отсутствует
#    - В некоторых случаях Telegram отдаёт только hint для пароля без email
# 4. Если ни одного email паттерна нет — считаем что email не привязан.
# Скрипт печатает JSON: { success: bool, email_pattern?: str }

async def get_email_pattern(phone_number, api_id, api_hash, session_path):
    try:
        os.makedirs(session_path, exist_ok=True)
        session_file = os.path.join(session_path, phone_number)
        client = TelegramClient(session_file, api_id, api_hash)
        await client.connect()

        # Запрос информации о пароле
        pwd_info = await client(functions.account.GetPasswordRequest())
        # В новых версиях Telethon парольная информация представлена в объекте account.Password
        # Проверяем поля email_unconfirmed_pattern / email_verified
        pattern = None
        if getattr(pwd_info, 'email_unconfirmed_pattern', None):
            pattern = pwd_info.email_unconfirmed_pattern
        elif getattr(pwd_info, 'email_verified', None):
            # email_verified может содержать полный email, маскируем его в стиле Telegram (оставляя первые символы)
            full_email = pwd_info.email_verified
            # Простая маска: первая буква локали + '***' + '@' + первая буква домена + '***'
            if full_email and '@' in full_email:
                local, domain = full_email.split('@', 1)
                d_main = domain.split('.')[0]
                pattern = f"{local[0]}***@{d_main[0]}***"
        else:
            pattern = None

        await client.disconnect()
        if pattern:
            print(json.dumps({"success": True, "email_pattern": pattern}, ensure_ascii=False))
        else:
            print(json.dumps({"success": True, "email_pattern": None}, ensure_ascii=False))
    except Exception as e:
        print(json.dumps({"success": False, "error": str(e)}))

if __name__ == '__main__':
    if len(sys.argv) < 5:
        print(json.dumps({"success": False, "error": "Missing arguments"}))
        sys.exit(1)

    phone = sys.argv[1]
    api_id = int(sys.argv[2])
    api_hash = sys.argv[3]
    session_path = sys.argv[4]

    asyncio.run(get_email_pattern(phone, api_id, api_hash, session_path))
