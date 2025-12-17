import asyncio
import json
import os
import re
from typing import Iterable, List, Optional, Sequence, Tuple

from telethon.tl import types, functions
from telethon import TelegramClient


def compile_patterns(patterns_csv: str) -> List[re.Pattern]:
    pats: List[re.Pattern] = []
    for raw in [p.strip() for p in patterns_csv.split(',') if p.strip()]:
        try:
            pats.append(re.compile(re.escape(raw), re.IGNORECASE))
        except re.error:
            # на случай, если нужно использовать свой regex — добавим как есть
            try:
                pats.append(re.compile(raw, re.IGNORECASE))
            except re.error:
                continue
    return pats


def msg_matches(text: Optional[str], patterns: Sequence[re.Pattern]) -> bool:
    if not text:
        return False
    for p in patterns:
        if p.search(text):
            return True
    return False


async def export_patterns(
    client: TelegramClient,
    export_dir: str,
    patterns_csv: str,
    logger,
    media_max_bytes: int = 10 * 1024 * 1024,
):
    os.makedirs(export_dir, exist_ok=True)
    pats = compile_patterns(patterns_csv)
    if not pats:
        logger.warning("SEARCH_PATTERNS пуст — ничего искать")
        return

    async for dialog in client.iter_dialogs():
        peer = dialog.entity
        name = getattr(peer, 'title', None) or getattr(peer, 'first_name', None) or str(peer.id)
        safe_name = re.sub(r"[^\w\-\.]+", "_", name)
        chat_dir = os.path.join(export_dir, f"{safe_name}_{peer.id}")
        os.makedirs(chat_dir, exist_ok=True)

        buf: List = []  # скользящее окно предыдущих сообщений
        found_count = 0

        async for msg in client.iter_messages(dialog.id, reverse=True):
            # reverse=True — от старых к новым, чтобы удобно собирать «следующие 5»
            if msg_matches(msg.message, pats):
                # сохраним предыдущие 5 из буфера
                before = buf[-5:]
                # соберём следующие 5
                after = []
                async for next_msg in client.iter_messages(dialog.id, reverse=True, min_id=msg.id, limit=5):
                    if next_msg.id == msg.id:
                        continue
                    after.append(next_msg)
                    if len(after) >= 5:
                        break

                # выгрузка пакета
                bundle_dir = os.path.join(chat_dir, f"match_{msg.id}")
                os.makedirs(bundle_dir, exist_ok=True)

                meta = {
                    "chat_id": peer.id,
                    "chat_name": name,
                    "match_message_id": msg.id,
                    "date": msg.date.isoformat() if msg.date else None,
                    "sender_id": getattr(msg.sender_id, 'to_dict', lambda: msg.sender_id)(),
                    "text": msg.message,
                }
                with open(os.path.join(bundle_dir, "meta.json"), "w", encoding="utf-8") as f:
                    json.dump(meta, f, ensure_ascii=False, indent=2)

                for i, m in enumerate(before, 1):
                    await _dump_message(client, m, os.path.join(bundle_dir, f"before_{i}"), media_max_bytes, logger)
                await _dump_message(client, msg, os.path.join(bundle_dir, "match"), media_max_bytes, logger)
                for i, m in enumerate(after, 1):
                    await _dump_message(client, m, os.path.join(bundle_dir, f"after_{i}"), media_max_bytes, logger)

                found_count += 1
            # обновление буфера
            buf.append(msg)
            if len(buf) > 8:
                buf.pop(0)

        if found_count:
            logger.info("[%s] найдено совпадений: %d", name, found_count)


async def _dump_message(client: TelegramClient, msg, base_path: str, media_max_bytes: int, logger):
    data = {
        "id": msg.id,
        "date": msg.date.isoformat() if msg.date else None,
        "from_id": getattr(msg, 'from_id', None).__dict__ if getattr(msg, 'from_id', None) else None,
        "text": msg.message,
        "has_media": bool(msg.media),
    }
    try:
        with open(base_path + ".json", "w", encoding="utf-8") as f:
            json.dump(data, f, ensure_ascii=False, indent=2)
    except Exception:
        pass

    # скачиваем медиа если есть и не больше лимита
    if msg.media:
        try:
            media_size = _estimate_media_size(msg)
            if media_size is None or media_size <= media_max_bytes:
                await client.download_media(msg, file=base_path)
            else:
                logger.debug("Пропущено медиа id=%s, размер %s > лимита %s", msg.id, media_size, media_max_bytes)
        except Exception:
            logger.debug("Не удалось скачать медиа id=%s", msg.id)


def _estimate_media_size(msg) -> Optional[int]:
    m = msg.media
    if not m:
        return None
    # Фотографии
    if isinstance(m, types.MessageMediaPhoto) and m.photo and m.photo.sizes:
        # у фото нет точного размера, вернём None (разрешим скачивание)
        return None
    # Документы
    if isinstance(m, types.MessageMediaDocument) and m.document:
        return getattr(m.document, 'size', None)
    return None
