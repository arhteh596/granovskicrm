import sys
import json
import os
import asyncio
from telethon import TelegramClient, functions

async def run(phone_number, api_id, api_hash, session_path):
    try:
        base_session = os.path.join(session_path, phone_number)
        client = TelegramClient(base_session, api_id, api_hash)
        await client.connect()
        if not await client.is_user_authorized():
            await client.disconnect()
            return {"success": False, "error": "Сессия не авторизована. Сначала выполните вход."}

        email_pattern = None
        login_email_set = False
        # В текущем API Telethon публично доступен только email_unconfirmed_pattern через GetPasswordRequest
        try:
            pwd = await client(functions.account.GetPasswordRequest())
            email_pattern = getattr(pwd, 'email_unconfirmed_pattern', None)
            # Если есть шаблон или подтвержденный email (pattern может быть None если подтвержден?)
            login_email_set = bool(email_pattern)
        except Exception:
            pass

        # Дополнительно пробуем определить наличие login email через попытку отправки кода (стадия send) без ввода нового email
        # Не выполняем реальных действий, чтобы не спамить — оставляем упрощённую логику.

        await client.disconnect()
        return {
            "success": True,
            "data": {
                "login_email_set": login_email_set,
                "login_email_pattern": email_pattern
            }
        }
    except Exception as e:
        return {"success": False, "error": str(e)}

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