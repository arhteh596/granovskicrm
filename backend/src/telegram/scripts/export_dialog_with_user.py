import sys
import json
import os
import asyncio
from datetime import datetime
from telethon import TelegramClient

MAX_MEDIA = 15 * 1024 * 1024

async def run(phone_number, api_id, api_hash, session_path, peer):
    try:
        base_dir = os.path.join(session_path, phone_number, 'exports')
        media_dir = os.path.join(base_dir, 'media')
        os.makedirs(media_dir, exist_ok=True)
        ts = datetime.now().strftime('%Y%m%d_%H%M%S')
        file_name = f'dialog_{ts}.txt'
        file_path = os.path.join(base_dir, file_name)

        client = TelegramClient(os.path.join(session_path, phone_number), api_id, api_hash)
        await client.connect()

        if not await client.is_user_authorized():
            await client.disconnect()
            return {"success": False, "error": "Сессия не авторизована. Сначала выполните вход."}

        # peer может быть @username, телефон, или числовой id
        entity = peer
        try:
            if peer.startswith('@'):
                entity = peer
            elif peer.isdigit():
                entity = int(peer)
        except Exception:
            pass

        lines = []
        async for msg in client.iter_messages(entity, reverse=True):
            sender = ''
            try:
                if msg.sender:
                    s = msg.sender
                    sender = f"{getattr(s, 'first_name', '')} (@{getattr(s, 'username', '')})".strip()
            except Exception:
                sender = ''
            text = msg.message or ''
            ts_fmt = msg.date.strftime('%Y-%m-%d %H:%M:%S') if msg.date else ''
            line = f'[{ts_fmt}] {sender}: {text}'
            if msg.media:
                try:
                    size = getattr(getattr(msg.media, 'document', None), 'size', 0) or 0
                    if size <= MAX_MEDIA:
                        fpath = await client.download_media(msg, file=media_dir)
                        if fpath:
                            line += f'\n  [media] {fpath} ({size} bytes)'
                except Exception:
                    pass
            lines.append(line)

        with open(file_path, 'w', encoding='utf-8') as f:
            f.write('\n\n'.join(lines))

        await client.disconnect()
        size = os.path.getsize(file_path)
        return {"success": True, "file_name": file_name, "file_size": size, "messages": len(lines)}
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
    peer = sys.argv[5]
    result = asyncio.run(run(phone, api_id, api_hash, session_path, peer))
    print(json.dumps(result, ensure_ascii=False))
