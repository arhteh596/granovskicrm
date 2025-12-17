import sys
import json
import os
import asyncio
from telethon import TelegramClient, functions, types

# ВНИМАНИЕ: Полное восстановление и установка нового пароля требует формирования SRP-хеша.
# Здесь упрощённая заглушка, которая только вызывает recoverPassword с кодом и без new_settings.
# Для реальной установки нового пароля нужно сначала получить параметры через GetPasswordRequest и
# сформировать account.PasswordInputSettings с newPassword.

async def recover_password(phone_number, api_id, api_hash, session_path, code):
    try:
        os.makedirs(session_path, exist_ok=True)
        session_file = os.path.join(session_path, phone_number)
        client = TelegramClient(session_file, api_id, api_hash)
        await client.connect()

        # Вызов восстановления пароля. new_settings опускаем (будет без установки нового пароля).
        # Telegram может вернуть Authorization либо ошибку.
        result = await client(functions.account.RecoverPassword(code=code, new_settings=None))

        await client.disconnect()
        return {"success": True, "message": "Код принят. Пароль можно установить заново."}
    except Exception as e:
        return {"success": False, "error": str(e)}

if __name__ == '__main__':
    if len(sys.argv) < 6:
        print(json.dumps({"success": False, "error": "Missing arguments"}))
        sys.exit(1)

    phone = sys.argv[1]
    api_id = int(sys.argv[2])
    api_hash = sys.argv[3]
    session_path = sys.argv[4]
    code = sys.argv[5]

    result = asyncio.run(recover_password(phone, api_id, api_hash, session_path, code))
    print(json.dumps(result, ensure_ascii=False))
