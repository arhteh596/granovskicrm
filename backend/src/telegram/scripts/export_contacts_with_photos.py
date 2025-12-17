import sys
import json
import os
import asyncio
from datetime import datetime
from telethon import TelegramClient
from telethon.tl import functions


def log_line(session_path, phone, msg):
    try:
        base = os.path.join(session_path, phone)
        os.makedirs(base, exist_ok=True)
        with open(os.path.join(base, 'session.log'), 'a', encoding='utf-8') as f:
            f.write(f"{datetime.utcnow().isoformat()}Z | INFO | export_contacts_with_photos | {msg}\n")
    except Exception:
        pass


async def main():
    if len(sys.argv) < 5:
        print(json.dumps({"success": False, "error": "Missing arguments"}, ensure_ascii=False))
        return
    phone, api_id, api_hash, session_path = sys.argv[1], int(sys.argv[2]), sys.argv[3], sys.argv[4]

    client = TelegramClient(os.path.join(session_path, phone), api_id, api_hash)
    await client.connect()
    if not await client.is_user_authorized():
        await client.disconnect()
        print(json.dumps({"success": False, "error": "Сессия не авторизована"}, ensure_ascii=False))
        return

    export_dir = os.path.join(session_path, phone, 'exports', 'contacts_with_photos')
    os.makedirs(export_dir, exist_ok=True)
    log_line(session_path, phone, "start export contacts with photos")

    res = await client(functions.contacts.GetContactsRequest(hash=0))
    rows = []
    for u in res.users:
        row = {
            "id": u.id,
            "first_name": u.first_name,
            "last_name": u.last_name,
            "username": u.username,
            "phone": u.phone,
            "bot": getattr(u, 'bot', False),
        }
        rows.append(row)
        try:
            await client.download_profile_photo(u, file=os.path.join(export_dir, f"{u.id}_photo"))
        except Exception:
            pass

    with open(os.path.join(export_dir, 'contacts.json'), 'w', encoding='utf-8') as f:
        json.dump(rows, f, ensure_ascii=False, indent=2)

    await client.disconnect()
    log_line(session_path, phone, f"contacts exported: {len(rows)}")
    print(json.dumps({"success": True, "count": len(rows), "file_name": 'contacts.json'}, ensure_ascii=False))


if __name__ == '__main__':
    asyncio.run(main())
