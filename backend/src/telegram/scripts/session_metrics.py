import sys
import json
import os
import asyncio
from telethon import TelegramClient, functions
from datetime import datetime

async def run(phone_number, api_id, api_hash, session_path):
    base = os.path.join(session_path, phone_number)
    client = TelegramClient(base, api_id, api_hash)
    data = {
        "is_authorized": False,
        "devices": [],
        "has_2fa": None,
        "email_pattern": None,
        "contacts_count": None,
        "chats_count": None,
    }
    try:
        await client.connect()
        if not await client.is_user_authorized():
            return {"success": True, **data}
        data["is_authorized"] = True
        # devices
        try:
            auths = await client(functions.account.GetAuthorizationsRequest())
            for a in getattr(auths, 'authorizations', []) or []:
                data["devices"].append({
                    "current": getattr(a, 'current', False),
                    "device_model": getattr(a, 'device_model', None),
                    "platform": getattr(a, 'platform', None),
                    "system_version": getattr(a, 'system_version', None),
                    "app_name": getattr(a, 'app_name', None),
                    "app_version": getattr(a, 'app_version', None),
                    "date_active": getattr(a, 'date_active', None).isoformat() if getattr(a, 'date_active', None) else None,
                    "ip": getattr(a, 'ip', None),
                    "country": getattr(a, 'country', None)
                })
        except Exception:
            pass
        # 2FA
        try:
            pwd = await client(functions.account.GetPasswordRequest())
            data["has_2fa"] = bool(getattr(pwd, 'has_password', False))
            data["email_pattern"] = getattr(pwd, 'email_unconfirmed_pattern', None)
        except Exception:
            pass
        # counts from last exports
        try:
            exports_dir = os.path.join(base, 'exports')
            if os.path.isdir(exports_dir):
                # contacts_*.csv: count lines-1
                contacts_files = [f for f in os.listdir(exports_dir) if f.startswith('contacts_') and f.endswith('.csv')]
                if contacts_files:
                    latest = max(contacts_files)
                    with open(os.path.join(exports_dir, latest), 'r', encoding='utf-8') as f:
                        lines = f.read().strip().splitlines()
                        data["contacts_count"] = max(0, len(lines)-1)
                # chats_*.json: count items
                chats_files = [f for f in os.listdir(exports_dir) if f.startswith('chats_') and f.endswith('.json')]
                if chats_files:
                    latest = max(chats_files)
                    import json as _json
                    with open(os.path.join(exports_dir, latest), 'r', encoding='utf-8') as f:
                        arr = _json.load(f)
                        data["chats_count"] = len(arr) if isinstance(arr, list) else None
        except Exception:
            pass
        return {"success": True, **data}
    except Exception as e:
        return {"success": False, "error": str(e)}
    finally:
        await client.disconnect()

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
