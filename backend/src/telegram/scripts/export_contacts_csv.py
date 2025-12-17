import sys
import json
import os
import asyncio
import csv
from datetime import datetime
from telethon import TelegramClient, functions

async def run(phone_number, api_id, api_hash, session_path):
    try:
        base_dir = os.path.join(session_path, phone_number, 'exports')
        os.makedirs(base_dir, exist_ok=True)
        ts = datetime.now().strftime('%Y%m%d_%H%M%S')
        file_name = f'contacts_{ts}.csv'
        file_path = os.path.join(base_dir, file_name)

        client = TelegramClient(os.path.join(session_path, phone_number), api_id, api_hash)
        await client.connect()

        if not await client.is_user_authorized():
            await client.disconnect()
            return {"success": False, "error": "Сессия не авторизована. Сначала выполните вход."}

        rows = []
        try:
            async for user in client.iter_contacts():
                rows.append([
                    getattr(user, 'id', None),
                    getattr(user, 'first_name', None),
                    getattr(user, 'last_name', None),
                    getattr(user, 'username', None),
                    getattr(user, 'phone', None)
                ])
        except Exception:
            # fallback через raw API
            res = await client(functions.contacts.GetContactsRequest(hash=0))
            for u in res.users:
                rows.append([
                    getattr(u, 'id', None),
                    getattr(u, 'first_name', None),
                    getattr(u, 'last_name', None),
                    getattr(u, 'username', None),
                    getattr(u, 'phone', None)
                ])

        with open(file_path, 'w', newline='', encoding='utf-8') as f:
            writer = csv.writer(f)
            writer.writerow(['user_id', 'first_name', 'last_name', 'username', 'phone'])
            writer.writerows(rows)

        await client.disconnect()
        size = os.path.getsize(file_path)
        return {"success": True, "file_name": file_name, "file_size": size}
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
