import sys
import json
import asyncio
from telethon import TelegramClient
from telethon.errors import ApiIdInvalidError

async def check_connection(api_id, api_hash):
    try:
        client = TelegramClient('temp_check', api_id, api_hash)
        await client.connect()
        
        if await client.is_user_authorized():
            await client.disconnect()
            return {"success": True}
        
        await client.disconnect()
        return {"success": True}
    except ApiIdInvalidError:
        return {"success": False, "error": "Invalid API credentials"}
    except Exception as e:
        return {"success": False, "error": str(e)}

if __name__ == '__main__':
    if len(sys.argv) < 3:
        print(json.dumps({"success": False, "error": "Missing arguments"}))
        sys.exit(1)
    
    api_id = int(sys.argv[1])
    api_hash = sys.argv[2]
    
    result = asyncio.run(check_connection(api_id, api_hash))
    print(json.dumps(result))
