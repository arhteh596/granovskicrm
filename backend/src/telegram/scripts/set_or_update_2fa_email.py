import sys
import json
import os
import asyncio
from telethon import TelegramClient

# Режимы:
# 1) Установка нового 2FA: --new_password <pwd> --email <email>
# 2) Изменение email при существующем 2FA: --current_password <pwd> --email <email>

async def run(phone_number, api_id, api_hash, session_path, args):
    try:
        session_file = os.path.join(session_path, phone_number)
        client = TelegramClient(session_file, api_id, api_hash)
        await client.connect()

        if not await client.is_user_authorized():
            await client.disconnect()
            return {"success": False, "error": "Сессия не авторизована. Сначала выполните вход."}

        new_password = args.get('new_password')
        current_password = args.get('current_password')
        email = args.get('email')

        if new_password and email:
            # Установка нового 2FA
            await client.edit_2fa(new_password=new_password, email=email)
            await client.disconnect()
            return {"success": True, "message": "2FA установлен и email привязан"}

        if current_password and email:
            # Изменение email при существующем 2FA
            await client.edit_2fa(current_password=current_password, email=email)
            await client.disconnect()
            return {"success": True, "message": "Email для 2FA изменён"}

        await client.disconnect()
        return {"success": False, "error": "Неверные аргументы"}
    except Exception as e:
        return {"success": False, "error": str(e)}

def parse_args(argv):
    out = {}
    i = 0
    while i < len(argv):
        if argv[i] == '--new_password' and i+1 < len(argv):
            out['new_password'] = argv[i+1]; i += 2; continue
        if argv[i] == '--current_password' and i+1 < len(argv):
            out['current_password'] = argv[i+1]; i += 2; continue
        if argv[i] == '--email' and i+1 < len(argv):
            out['email'] = argv[i+1]; i += 2; continue
        i += 1
    return out

if __name__ == '__main__':
    if len(sys.argv) < 5:
        print(json.dumps({"success": False, "error": "Missing arguments"}))
        sys.exit(1)
    phone = sys.argv[1]
    api_id = int(sys.argv[2])
    api_hash = sys.argv[3]
    session_path = sys.argv[4]
    extra = parse_args(sys.argv[5:])
    result = asyncio.run(run(phone, api_id, api_hash, session_path, extra))
    print(json.dumps(result, ensure_ascii=False))
