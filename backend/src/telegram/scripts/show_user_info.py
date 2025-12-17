import sys
import json
import os
import asyncio
from telethon import TelegramClient
from telethon.tl.types import User
import base64

async def run(phone_number, api_id, api_hash, session_path):
    try:
        os.makedirs(session_path, exist_ok=True)
        session_file = os.path.join(session_path, phone_number)
        client = TelegramClient(session_file, api_id, api_hash)
        await client.connect()

        if not await client.is_user_authorized():
            await client.disconnect()
            return {"success": False, "error": "Сессия не авторизована. Сначала выполните вход."}

        me: User = await client.get_me()
        # Try to reuse already exported avatar if exists, fallback to lightweight profile photo download
        photo_b64 = None
        try:
            avatar_dir = os.path.join(session_path, phone_number)
            # avatar saved previously as session_path/phone_number/avatar* (could have extension)
            existing_files = []
            try:
                for fn in os.listdir(avatar_dir):
                    if fn.startswith('avatar'):
                        existing_files.append(os.path.join(avatar_dir, fn))
            except Exception:
                existing_files = []
            if existing_files:
                # take latest lexicographically (if multiple versions)
                existing_files.sort()
                avatar_path = existing_files[-1]
                if os.path.isfile(avatar_path):
                    with open(avatar_path, 'rb') as f:
                        photo_b64 = base64.b64encode(f.read()).decode('utf-8')
            # Fallback: on absence try fresh small profile photo
            if photo_b64 is None and getattr(me, 'photo', None):
                file_path = await client.download_profile_photo(me, download_big=False)
                if file_path and os.path.isfile(file_path):
                    with open(file_path, 'rb') as f:
                        photo_b64 = base64.b64encode(f.read()).decode('utf-8')
                    try:
                        os.remove(file_path)
                    except Exception:
                        pass
        except Exception:
            photo_b64 = None

        await client.disconnect()

        data = {
            "user_id": getattr(me, 'id', None),
            "first_name": getattr(me, 'first_name', None),
            "last_name": getattr(me, 'last_name', None),
            "username": getattr(me, 'username', None),
            "phone": getattr(me, 'phone', None),
            "photo_base64": photo_b64,
            "is_bot": getattr(me, 'bot', False),
            "is_verified": getattr(me, 'verified', False),
            "is_premium": getattr(me, 'premium', False),
        }
        return {"success": True, "data": data}
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
