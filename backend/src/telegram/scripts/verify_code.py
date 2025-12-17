import sys
import json
import asyncio
import os
from telethon import TelegramClient
from telethon.errors import PhoneCodeInvalidError, PhoneCodeExpiredError, SessionPasswordNeededError

async def verify_code(phone_number, code, phone_code_hash, api_id, api_hash, session_path):
    try:
        session_file = os.path.join(session_path, phone_number)
        
        client = TelegramClient(session_file, api_id, api_hash)
        await client.connect()
        
        try:
            await client.sign_in(phone_number, code, phone_code_hash=phone_code_hash)
            
            session_string = client.session.save()
            await client.disconnect()
            
            return {
                "success": True,
                "requires_2fa": False,
                "session_string": str(session_string)
            }
            
        except SessionPasswordNeededError:
            await client.disconnect()
            return {
                "success": True,
                "requires_2fa": True
            }
            
    except PhoneCodeInvalidError:
        return {"success": False, "error": "Неверный код"}
    except PhoneCodeExpiredError:
        return {"success": False, "error": "Код истек. Запросите новый код"}
    except Exception as e:
        return {"success": False, "error": str(e)}

if __name__ == '__main__':
    if len(sys.argv) < 7:
        print(json.dumps({"success": False, "error": "Missing arguments"}))
        sys.exit(1)
    
    phone = sys.argv[1]
    code = sys.argv[2]
    phone_code_hash = sys.argv[3]
    api_id = int(sys.argv[4])
    api_hash = sys.argv[5]
    session_path = sys.argv[6]
    
    result = asyncio.run(verify_code(phone, code, phone_code_hash, api_id, api_hash, session_path))
    print(json.dumps(result, ensure_ascii=False))
