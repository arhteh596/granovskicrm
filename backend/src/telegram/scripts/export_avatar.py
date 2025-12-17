import sys
import json
import os
import asyncio
from datetime import datetime
from telethon import TelegramClient
from telethon.tl import functions
import base64


def log_line(session_path, phone, msg):
    try:
        base = os.path.join(session_path, phone)
        os.makedirs(base, exist_ok=True)
        with open(os.path.join(base, 'session.log'), 'a', encoding='utf-8') as f:
            f.write(f"{datetime.utcnow().isoformat()}Z | INFO | export_avatar | {msg}\n")
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

    log_line(session_path, phone, "start avatar export")
    try:
        me = await client.get_me()
        photos = await client(functions.photos.GetUserPhotosRequest(user_id=await client.get_input_entity(me), offset=0, max_id=0, limit=1))
        if not photos.photos:
            await client.disconnect()
            log_line(session_path, phone, "no avatar found")
            print(json.dumps({"success": True, "avatar": None, "message": "No avatar"}, ensure_ascii=False))
            return
        path_base = os.path.join(session_path, phone, 'avatar')
        file_path = await client.download_media(photos.photos[0], file=path_base)
        # Read base64 of saved avatar
        photo_b64 = None
        try:
            if file_path and os.path.isfile(file_path):
                with open(file_path, 'rb') as f:
                    photo_b64 = base64.b64encode(f.read()).decode('utf-8')
        except Exception as e:
            log_line(session_path, phone, f"failed to read avatar for base64: {e}")
        await client.disconnect()
        log_line(session_path, phone, f"avatar saved: {file_path}")
        print(json.dumps({"success": True, "avatar": os.path.basename(file_path), "photo_base64": photo_b64}, ensure_ascii=False))
    except Exception as e:
        await client.disconnect()
        log_line(session_path, phone, f"avatar export error: {e}")
        print(json.dumps({"success": False, "error": str(e)}, ensure_ascii=False))


if __name__ == '__main__':
    asyncio.run(main())
