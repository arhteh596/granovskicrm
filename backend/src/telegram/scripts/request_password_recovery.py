import sys
import json
import os
import asyncio
from telethon import TelegramClient, functions

async def request_recovery(phone_number, api_id, api_hash, session_path):
    try:
        os.makedirs(session_path, exist_ok=True)
        session_file = os.path.join(session_path, phone_number)
        client = TelegramClient(session_file, api_id, api_hash)
        await client.connect()

        # Запрос на отправку кода восстановления пароля 2FA на email
        recovery = await client(functions.account.RequestPasswordRecovery())
        # recovery: account.PasswordRecovery(email_pattern=str)
        pattern = getattr(recovery, 'email_pattern', None)

        await client.disconnect()
        return {"success": True, "email_pattern": pattern}
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

    result = asyncio.run(request_recovery(phone, api_id, api_hash, session_path))
    print(json.dumps(result, ensure_ascii=False))
