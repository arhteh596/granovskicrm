import sys
import json
import os
import asyncio
from datetime import datetime
from telethon import TelegramClient, functions, types

async def run(phone_number, api_id, api_hash, session_path):
    try:
        base_dir = os.path.join(session_path, phone_number, 'exports')
        os.makedirs(base_dir, exist_ok=True)
        ts = datetime.now().strftime('%Y%m%d_%H%M%S')
        file_name = f'chats_{ts}.json'
        file_path = os.path.join(base_dir, file_name)

        client = TelegramClient(os.path.join(session_path, phone_number), api_id, api_hash)
        await client.connect()
        if not await client.is_user_authorized():
            await client.disconnect()
            return {"success": False, "error": "Сессия не авторизована. Сначала выполните вход."}
        dialogs = await client.get_dialogs()
        out = []
        for d in dialogs:
            entity = d.entity
            chat_type = 'unknown'
            participants = None
            if isinstance(entity, types.User):
                chat_type = 'user'
            elif isinstance(entity, types.Chat):
                chat_type = 'chat'
                try:
                    full = await client(functions.messages.GetFullChatRequest(chat_id=entity.id))
                    participants = len(getattr(full.full_chat, 'participants', []) or [])
                except Exception:
                    pass
            elif isinstance(entity, types.Channel):
                chat_type = 'channel' if not entity.megagroup else 'supergroup'
                try:
                    full = await client(functions.channels.GetFullChannelRequest(channel=entity))
                    participants = getattr(full.full_chat, 'participants_count', None)
                except Exception:
                    pass

            out.append({
                'chat_id': getattr(entity, 'id', None),
                'title': getattr(entity, 'title', getattr(entity, 'first_name', None)),
                'type': chat_type,
                'participants': participants
            })

        with open(file_path, 'w', encoding='utf-8') as f:
            json.dump(out, f, ensure_ascii=False, indent=2)
        await client.disconnect()
        size = os.path.getsize(file_path)
        return {"success": True, "file_name": file_name, "file_size": size, "count": len(out)}
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
