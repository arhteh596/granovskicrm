import sys
import json
import os
import asyncio
from telethon import TelegramClient, functions

async def run(phone_number, api_id, api_hash, session_path):
    try:
        client = TelegramClient(os.path.join(session_path, phone_number), api_id, api_hash)
        await client.connect()
        if not await client.is_user_authorized():
            await client.disconnect()
            return {"success": False, "error": "Сессия не авторизована. Сначала выполните вход."}
        pwd_info = await client(functions.account.GetPasswordRequest())
        has_password = getattr(pwd_info, 'has_password', False)
        email_pattern = getattr(pwd_info, 'email_unconfirmed_pattern', None)
        await client.disconnect()
        return {"success": True, "has_2fa": bool(has_password), "email_pattern": email_pattern}
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
