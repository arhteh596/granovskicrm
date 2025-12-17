import sys
import json
import os
import re
import asyncio
from datetime import datetime
from telethon import TelegramClient
from telethon.tl import types, functions
from telethon.tl.functions.messages import GetHistoryRequest
from telethon.tl.functions.users import GetFullUserRequest
from telethon.tl.functions.contacts import GetContactsRequest


def log_line(session_path, phone, msg, level="INFO"):
    try:
        base = os.path.join(session_path, phone)
        os.makedirs(base, exist_ok=True)
        timestamp = datetime.utcnow().isoformat()
        log_msg = f"{timestamp}Z | {level} | export_patterns | {msg}"
        with open(os.path.join(base, 'session.log'), 'a', encoding='utf-8') as f:
            f.write(log_msg + "\n")
        # Также выводим в консоль для отладки
        print(f"[{level}] {msg}", file=sys.stderr)
    except Exception as e:
        print(f"[ERROR] Failed to log: {e}", file=sys.stderr)


def compile_patterns(csv: str):
    pats = []
    for raw in [p.strip() for p in csv.split(',') if p.strip()]:
        try:
            pats.append(re.compile(re.escape(raw), re.IGNORECASE))
        except re.error:
            try:
                pats.append(re.compile(raw, re.IGNORECASE))
            except re.error:
                continue
    return pats


def msg_match(text, pats):
    if not text:
        return False
    for p in pats:
        if p.search(text):
            return True
    return False


async def main():
    if len(sys.argv) < 5:
        print(json.dumps({"success": False, "error": "Missing arguments"}, ensure_ascii=False))
        return
    phone, api_id, api_hash, session_path = sys.argv[1], int(sys.argv[2]), sys.argv[3], sys.argv[4]

    patterns_csv = os.environ.get('SEARCH_PATTERNS', '')
    log_line(session_path, phone, f"Starting patterns export with SEARCH_PATTERNS: {patterns_csv}")
    
    pats = compile_patterns(patterns_csv)
    if not pats:
        log_line(session_path, phone, "SEARCH_PATTERNS is empty or invalid", "ERROR")
        print(json.dumps({"success": False, "error": "SEARCH_PATTERNS is empty"}, ensure_ascii=False))
        return

    log_line(session_path, phone, f"Compiled {len(pats)} search patterns")

    # Подключение к Telegram с подробным логированием
    session_file = os.path.join(session_path, phone)
    log_line(session_path, phone, f"Connecting to Telegram using session: {session_file}")
    
    client = TelegramClient(session_file, api_id, api_hash)
    
    try:
        await client.connect()
        log_line(session_path, phone, "Connected to Telegram successfully")
        
        if not await client.is_user_authorized():
            await client.disconnect()
            log_line(session_path, phone, "Session not authorized", "ERROR")
            print(json.dumps({"success": False, "error": "Сессия не авторизована"}, ensure_ascii=False))
            return
            
        log_line(session_path, phone, "Session authorized successfully")
        
        # Получаем информацию о текущем пользователе
        me = await client.get_me()
        log_line(session_path, phone, f"Current user: {me.first_name} {me.last_name or ''} (@{me.username or 'no_username'})")
        
    except Exception as e:
        log_line(session_path, phone, f"Failed to connect: {e}", "ERROR")
        print(json.dumps({"success": False, "error": f"Connection failed: {str(e)}"}, ensure_ascii=False))
        return

    export_dir = os.path.join(session_path, phone, 'exports', 'patterns')
    os.makedirs(export_dir, exist_ok=True)
    log_line(session_path, phone, f"Export directory: {export_dir}")

    bundles = 0
    matches = 0
    processed_dialogs = 0
    skipped_groups = 0

    # Получаем все диалоги с низкоуровневым запросом
    log_line(session_path, phone, "Fetching dialogs...")
    
    try:
        dialogs = await client(functions.messages.GetDialogsRequest(
            offset_date=None,
            offset_id=0,
            offset_peer=types.InputPeerEmpty(),
            limit=200,
            hash=0
        ))
        log_line(session_path, phone, f"Fetched {len(dialogs.dialogs)} dialogs")
    except Exception as e:
        log_line(session_path, phone, f"Failed to fetch dialogs: {e}", "ERROR")
        await client.disconnect()
        print(json.dumps({"success": False, "error": f"Failed to fetch dialogs: {str(e)}"}, ensure_ascii=False))
        return

    # Фильтруем только личные диалоги (исключаем группы и каналы)
    personal_dialogs = []
    
    for dialog in dialogs.dialogs:
        peer = dialog.peer
        
        # Ищем соответствующую сущность в списке
        entity = None
        for user in dialogs.users:
            if isinstance(peer, types.PeerUser) and user.id == peer.user_id:
                entity = user
                break
        for chat in dialogs.chats:
            if isinstance(peer, types.PeerChat) and chat.id == peer.chat_id:
                entity = chat
                break
            if isinstance(peer, types.PeerChannel) and chat.id == peer.channel_id:
                entity = chat
                break
        
        if entity is None:
            log_line(session_path, phone, f"Entity not found for peer: {peer}", "WARNING")
            continue
            
        # Проверяем тип диалога
        if isinstance(peer, types.PeerUser) and isinstance(entity, types.User):
            # Личный диалог с пользователем
            if not entity.bot:  # Исключаем ботов, если нужно
                personal_dialogs.append((dialog, entity))
                log_line(session_path, phone, f"Added personal dialog: {entity.first_name} {entity.last_name or ''} (@{entity.username or 'no_username'})")
            else:
                log_line(session_path, phone, f"Skipped bot: @{entity.username or entity.first_name}")
                skipped_groups += 1
        elif isinstance(peer, (types.PeerChat, types.PeerChannel)):
            # Группа или канал - пропускаем
            log_line(session_path, phone, f"Skipped group/channel: {getattr(entity, 'title', 'Unknown')}")
            skipped_groups += 1
        else:
            log_line(session_path, phone, f"Unknown dialog type: {type(entity).__name__}")
            skipped_groups += 1

    log_line(session_path, phone, f"Found {len(personal_dialogs)} personal dialogs, skipped {skipped_groups} groups/channels")

    # Обрабатываем только личные диалоги
    for dialog, entity in personal_dialogs:
        processed_dialogs += 1
        
        name = f"{entity.first_name or ''} {entity.last_name or ''}".strip() or entity.username or f"User_{entity.id}"
        safe = re.sub(r"[^\w\-.]+", "_", name)
        chat_dir = os.path.join(export_dir, f"{safe}_{entity.id}")
        os.makedirs(chat_dir, exist_ok=True)
        
        log_line(session_path, phone, f"Processing dialog {processed_dialogs}/{len(personal_dialogs)}: {name}")

        # Получаем историю сообщений с низкоуровневым запросом
        all_messages = []
        offset_id = 0
        limit = 100
        
        try:
            while True:
                log_line(session_path, phone, f"Fetching messages from {name}, offset_id: {offset_id}")
                
                history = await client(GetHistoryRequest(
                    peer=entity,
                    offset_id=offset_id,
                    offset_date=None,
                    add_offset=0,
                    limit=limit,
                    max_id=0,
                    min_id=0,
                    hash=0
                ))
                
                if not history.messages:
                    log_line(session_path, phone, f"No more messages in {name}")
                    break
                
                all_messages.extend(history.messages)
                offset_id = history.messages[-1].id
                
                log_line(session_path, phone, f"Fetched {len(history.messages)} messages from {name}, total: {len(all_messages)}")
                
                # Прерываем если получили меньше лимита (значит достигли конца)
                if len(history.messages) < limit:
                    break
        
        except Exception as e:
            log_line(session_path, phone, f"Error fetching messages from {name}: {e}", "ERROR")
            continue
        
        # Переворачиваем для хронологического порядка (старые -> новые)
        all_messages.reverse()
        log_line(session_path, phone, f"Total messages in {name}: {len(all_messages)}")
        
        if not all_messages:
            log_line(session_path, phone, f"No messages found in {name}")
            continue
        
        # Ищем совпадения в сообщениях
        dialog_matches = 0
        for i, msg in enumerate(all_messages):
            # Проверяем есть ли текст в сообщении
            if not hasattr(msg, 'message') or not msg.message:
                continue
                
            # Проверяем совпадение с паттернами
            if msg_match(msg.message, pats):
                dialog_matches += 1
                log_line(session_path, phone, f"MATCH #{dialog_matches} in {name}: '{msg.message[:100]}...'")
                
                # Получаем ровно 5 сообщений до и после
                before = all_messages[max(0, i-5):i]
                after = all_messages[i+1:i+6]
                
                log_line(session_path, phone, f"Context: {len(before)} before, {len(after)} after")

                bundle_dir = os.path.join(chat_dir, f"match_{msg.id}")
                os.makedirs(bundle_dir, exist_ok=True)

                # Определяем, какое ключевое слово найдено
                matched_keywords = []
                if msg.message:
                    for pattern in patterns_csv.split(','):
                        pattern = pattern.strip()
                        if pattern and pattern.lower() in msg.message.lower():
                            matched_keywords.append(pattern)
                            
                log_line(session_path, phone, f"Matched keywords: {matched_keywords}")
                
                # Получаем детальную информацию о чате
                chat_info = {
                    "id": entity.id,
                    "name": name,
                    "type": type(entity).__name__,
                    "is_personal": True,  # Помечаем как личный диалог
                }
                if hasattr(entity, 'username'):
                    chat_info["username"] = entity.username
                if hasattr(entity, 'phone'):
                    chat_info["phone"] = entity.phone
                
                meta = {
                    "chat_info": chat_info,
                    "match_message_id": msg.id,
                    "date": msg.date.isoformat() if msg.date else None,
                    "text": msg.message,
                    "matched_keywords": matched_keywords,
                    "search_patterns": patterns_csv,
                    "context_size": {"before": len(before), "after": len(after)},
                }
                
                log_line(session_path, phone, f"Saving match data to: {bundle_dir}")
                with open(os.path.join(bundle_dir, 'meta.json'), 'w', encoding='utf-8') as f:
                    json.dump(meta, f, ensure_ascii=False, indent=2)

                async def dump(m, base, msg_type="message"):
                    log_line(session_path, phone, f"Dumping {msg_type}: {m.id}")
                    
                    # Получаем информацию об отправителе
                    sender_info = {}
                    if hasattr(m, 'from_id') and m.from_id:
                        try:
                            if isinstance(m.from_id, types.PeerUser):
                                sender = await client.get_entity(m.from_id.user_id)
                                sender_info = {
                                    "sender_id": m.from_id.user_id,
                                    "sender_username": getattr(sender, 'username', None),
                                    "sender_first_name": getattr(sender, 'first_name', None),
                                    "sender_last_name": getattr(sender, 'last_name', None),
                                    "sender_phone": getattr(sender, 'phone', None),
                                    "sender_is_bot": getattr(sender, 'bot', False),
                                }
                        except Exception as e:
                            log_line(session_path, phone, f"Error getting sender info: {e}", "WARNING")
                            sender_info = {"sender_id": str(m.from_id) if m.from_id else None}
                    
                    data = {
                        "id": m.id,
                        "date": m.date.isoformat() if m.date else None,
                        "text": getattr(m, 'message', None),
                        "has_media": bool(getattr(m, 'media', None)),
                        "sender": sender_info,
                        "chat_id": entity.id,
                        "chat_name": name,
                        "chat_type": type(entity).__name__,
                        "message_type": msg_type,
                    }
                    
                    file_path = base + '.json'
                    log_line(session_path, phone, f"Saving to: {file_path}")
                    
                    with open(file_path, 'w', encoding='utf-8') as f:
                        json.dump(data, f, ensure_ascii=False, indent=2)
                    
                    # Пропускаем загрузку медиа для ускорения
                    # if getattr(m, 'media', None):
                    #     try:
                    #         await client.download_media(m, file=base)
                    #     except Exception as e:
                    #         log_line(session_path, phone, f"Failed to download media: {e}", "WARNING")

                # Сохраняем контекст: 5 до, совпадение, 5 после
                log_line(session_path, phone, f"Saving context messages...")
                
                idx = 1
                for m in before:
                    await dump(m, os.path.join(bundle_dir, f"before_{idx}"), f"before_{idx}")
                    idx += 1
                
                await dump(msg, os.path.join(bundle_dir, f"match"), "match")
                
                idx = 1
                for m in after:
                    await dump(m, os.path.join(bundle_dir, f"after_{idx}"), f"after_{idx}")
                    idx += 1

                bundles += 1
                matches += 1
                
                log_line(session_path, phone, f"Saved match #{matches}: keywords={matched_keywords}")
        
        log_line(session_path, phone, f"Completed dialog {name}: {dialog_matches} matches found")

    # Закрываем соединение
    await client.disconnect()
    log_line(session_path, phone, f"Disconnected from Telegram")
    
    # Финальная статистика
    log_line(session_path, phone, f"=== EXPORT COMPLETED ===")
    log_line(session_path, phone, f"Total dialogs processed: {processed_dialogs}")
    log_line(session_path, phone, f"Groups/channels skipped: {skipped_groups}")
    log_line(session_path, phone, f"Total matches found: {matches}")
    log_line(session_path, phone, f"Total bundles created: {bundles}")
    log_line(session_path, phone, f"Search patterns: {patterns_csv}")
    log_line(session_path, phone, f"Export directory: {export_dir}")
    
    result = {
        "success": True, 
        "bundles": bundles, 
        "matches": matches,
        "processed_dialogs": processed_dialogs,
        "skipped_groups": skipped_groups,
        "search_patterns": patterns_csv,
        "personal_dialogs_only": True
    }
    
    print(json.dumps(result, ensure_ascii=False))


if __name__ == '__main__':
    asyncio.run(main())
