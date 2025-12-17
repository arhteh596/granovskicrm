import sys
import json
import os
import asyncio
from telethon import TelegramClient, functions

# Скрипт пытается инициировать восстановление пароля 2FA (если доступно)
# и/или получить паттерн email через GetPasswordRequest.
# Возвращает JSON:
# { success: bool, email_pattern: str|None, recovery_initiated: bool }

async def run(phone_number, api_id, api_hash, session_path):
    os.makedirs(session_path, exist_ok=True)
    session_file = os.path.join(session_path, phone_number)
    client = TelegramClient(session_file, api_id, api_hash)
    recovery_initiated = False
    pattern = None
    try:
        await client.connect()
        if not await client.is_user_authorized():
            await client.disconnect()
            return {"success": False, "error": "Сессия не авторизована. Сначала выполните вход."}
        # 1. Попытка инициировать восстановление, если метод присутствует в TL layer
        try:
            if hasattr(functions.account, 'RequestPasswordRecovery'):  # Проверка наличия функции
                resp = await client(functions.account.RequestPasswordRecovery())
                recovery_initiated = True
                pattern = getattr(resp, 'email_pattern', pattern)
        except Exception as e:
            # Игнорируем, fallback ниже
            pass
        # 2. Получаем информацию о пароле (паттерн email если есть)
        try:
            pwd = await client(functions.account.GetPasswordRequest())
            if getattr(pwd, 'email_unconfirmed_pattern', None):
                pattern = pwd.email_unconfirmed_pattern
            elif getattr(pwd, 'email_verified', None):
                full_email = pwd.email_verified
                if full_email and '@' in full_email:
                    local, domain = full_email.split('@', 1)
                    d_main = domain.split('.')[0]
                    pattern = f"{local[0]}***@{d_main[0]}***"
        except Exception:
            pass
    except Exception as e:
        return {"success": False, "error": str(e)}
    finally:
        await client.disconnect()
    return {"success": True, "email_pattern": pattern, "recovery_initiated": recovery_initiated}

if __name__ == '__main__':
    if len(sys.argv) < 5:
        print(json.dumps({"success": False, "error": "Missing arguments"}))
        sys.exit(1)
    phone = sys.argv[1]
    api_id = int(sys.argv[2])
    api_hash = sys.argv[3]
    session_path = sys.argv[4]
    result = asyncio.run(run(phone, api_id, api_hash, session_path))
    print(json.dumps(result, ensure_ascii=False))
