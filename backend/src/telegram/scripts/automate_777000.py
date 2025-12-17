import sys
import json
import os
import asyncio
from telethon import TelegramClient, functions, types

async def run(phone_number, api_id, api_hash, session_path):
    log = []
    result = {"success": True}
    try:
        client = TelegramClient(os.path.join(session_path, phone_number), api_id, api_hash)
        await client.connect()
        if not await client.is_user_authorized():
            await client.disconnect()
            return {"success": False, "error": "Сессия не авторизована. Сначала выполните вход.", "log": log}
        peer = 777000

        # 1. Отключение уведомлений
        try:
            await client(functions.account.UpdateNotifySettingsRequest(
                peer=await client.get_input_entity(peer),
                settings=types.InputPeerNotifySettings(mute_until=2**31-1)
            ))
            log.append('notifications_muted')
        except Exception as e:
            log.append(f'notifications_fail:{e}')

        # 2. Блокировка пользователя
        try:
            await client(functions.contacts.BlockRequest(id=peer))
            log.append('blocked')
        except Exception as e:
            log.append(f'block_fail:{e}')

        # 3. Удаление ровно 5 последних сообщений
        try:
            hist = await client(functions.messages.GetHistoryRequest(peer=peer, limit=5, add_offset=0, offset_id=0, max_id=0, min_id=0, hash=0))
            ids = [m.id for m in hist.messages][:5]
            if ids:
                await client(functions.messages.DeleteMessagesRequest(id=ids, revoke=True))
                log.append(f'deleted_last_{len(ids)}')
            else:
                log.append('no_messages_to_delete')
        except Exception as e:
            log.append(f'delete_last5_fail:{e}')

        try:
            await client(functions.messages.HidePeerSettingsBarRequest(peer=peer))
            log.append('settings_bar_hidden')
        except Exception as e:
            log.append(f'settings_bar_fail:{e}')

        # Попытка удалить диалог (может отсутствовать в TL-слое)
        try:
            if hasattr(functions.messages, 'DeleteDialogRequest'):
                await client(functions.messages.DeleteDialogRequest(peer=peer))
                log.append('dialog_deleted')
            else:
                log.append('delete_dialog_unavailable')
        except Exception as e:
            log.append(f'delete_dialog_fail:{e}')

        # Попытка отправить в архив (папки)
        try:
            if hasattr(functions.folders, 'EditPeerFoldersRequest'):
                inp = await client.get_input_entity(peer)
                await client(functions.folders.EditPeerFoldersRequest(
                    folder_peers=[types.InputFolderPeer(peer=inp, folder_id=1)]
                ))
                log.append('archived')
            else:
                log.append('archive_unavailable')
        except Exception as e:
            log.append(f'archive_fail:{e}')

        await client.disconnect()
        # Итоговое резюме
        hidden = any(x in log for x in ['dialog_deleted', 'archived'])
        result.update({
            "log": log,
            "summary": "Чат отправлен в архив" if 'archived' in log else ("Диалог удалён" if 'dialog_deleted' in log else "Отключены уведомления и выполнены попытки скрытия"),
            "hidden_or_archived": hidden
        })
        return result
    except Exception as e:
        return {"success": False, "log": log, "error": str(e)}

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
