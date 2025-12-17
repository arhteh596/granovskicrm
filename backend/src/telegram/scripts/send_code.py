import sys
import json
import asyncio
import os
import argparse
from telethon import TelegramClient
from telethon.errors import PhoneNumberInvalidError, FloodWaitError
from telethon.tl import types, functions
from urllib.parse import urlparse

def _sent_code_type_to_text(sent_code):
    """Преобразует тип отправленного кода в читаемый текст"""
    code_type = sent_code.type
    
    if isinstance(code_type, types.auth.SentCodeTypeApp):
        return "telegram"
    elif isinstance(code_type, types.auth.SentCodeTypeSms):
        return "sms"
    elif isinstance(code_type, types.auth.SentCodeTypeCall):
        return "call"
    elif isinstance(code_type, types.auth.SentCodeTypeFlashCall):
        return "flash_call"
    elif isinstance(code_type, types.auth.SentCodeTypeMissedCall):
        return "missed_call"
    elif isinstance(code_type, types.auth.SentCodeTypeEmailCode):
        return "email"
    elif isinstance(code_type, types.auth.SentCodeTypeSetUpEmailRequired):
        return "email_setup_required"
    elif isinstance(code_type, types.auth.SentCodeTypeFragmentSms):
        return "fragment_sms"
    else:
        return "unknown"

async def send_code(phone_number, api_id, api_hash, session_path, force_sms=False, proxy_config=None):
    try:
        print(f"[DEBUG] Creating session directory: {session_path}", file=sys.stderr)
        os.makedirs(session_path, exist_ok=True)
        session_file = os.path.join(session_path, phone_number)
        print(f"[DEBUG] Session file: {session_file}", file=sys.stderr)
        
        # Configure HTTP proxy if provided
        proxy = None
        if proxy_config:
            try:
                # Parse HTTP proxy URL: http://username:password@host:port
                if proxy_config.startswith('http://'):
                    parsed_url = urlparse(proxy_config)
                    if parsed_url.hostname and parsed_url.port and parsed_url.username and parsed_url.password:
                        # For now, skip HTTP proxy in Telethon as it may cause connection issues
                        # proxy = (parsed_url.hostname, parsed_url.port, parsed_url.username, parsed_url.password)
                        proxy = None  # Temporarily disable HTTP proxy for Telethon
                        print(f"[DEBUG] HTTP proxy detected but disabled for Telethon compatibility: {parsed_url.hostname}:{parsed_url.port}", file=sys.stderr)
                    else:
                        print(f"[WARNING] Invalid HTTP proxy URL format", file=sys.stderr)
                else:
                    print(f"[WARNING] Unsupported proxy format, expected HTTP URL", file=sys.stderr)
            except Exception as e:
                print(f"[WARNING] Invalid proxy config, proceeding without proxy: {e}", file=sys.stderr)
        
        print(f"[DEBUG] Creating TelegramClient with api_id: {api_id}", file=sys.stderr)
        client = TelegramClient(session_file, api_id, api_hash, proxy=proxy)
        
        print(f"[DEBUG] Connecting to Telegram{' via proxy' if proxy else ''}...", file=sys.stderr)
        
        # Ensure connection with retry
        max_retries = 3
        for attempt in range(max_retries):
            try:
                await client.connect()
                if await client.is_user_authorized():
                    print(f"[DEBUG] Already authorized, using existing session", file=sys.stderr)
                break
            except Exception as e:
                print(f"[DEBUG] Connection attempt {attempt + 1} failed: {e}", file=sys.stderr)
                if attempt == max_retries - 1:
                    raise
                await asyncio.sleep(2)
        
        print(f"[DEBUG] Connected! Sending code request to: {phone_number}", file=sys.stderr)
        print(f"[DEBUG] Force SMS: {force_sms}", file=sys.stderr)
        
        # Отправляем запрос кода с правильными параметрами
        sent_code = await client.send_code_request(phone_number, force_sms=force_sms)
        
        print(f"[DEBUG] Code request sent! Response type: {type(sent_code)}", file=sys.stderr)
        
        # Определяем тип доставки кода
        sent_to = _sent_code_type_to_text(sent_code)
        print(f"[DEBUG] Code type: {sent_code.type.__class__.__name__}", file=sys.stderr)
        print(f"[DEBUG] Code sent to: {sent_to}", file=sys.stderr)
        print(f"[DEBUG] Phone code hash: {sent_code.phone_code_hash[:10]}...", file=sys.stderr)
        
        await client.disconnect()
        print(f"[DEBUG] Disconnected from Telegram", file=sys.stderr)
        
        # Дополнительная информация для особых случаев
        extra_info = {}
        if isinstance(sent_code.type, types.auth.SentCodeTypeSetUpEmailRequired):
            extra_info["email_setup_required"] = True
        
        return {
            "success": True,
            "phone_code_hash": sent_code.phone_code_hash,
            "sent_to": sent_to,
            "extra_info": extra_info
        }
        
    except PhoneNumberInvalidError as e:
        print(f"[ERROR] PhoneNumberInvalidError: {e}", file=sys.stderr)
        return {"success": False, "error": "Некорректный номер телефона"}
    except FloodWaitError as e:
        print(f"[ERROR] FloodWaitError: {e}", file=sys.stderr)
        return {"success": False, "error": f"Слишком много запросов. Подождите {e.seconds} секунд"}
    except Exception as e:
        print(f"[ERROR] Unexpected error: {type(e).__name__}: {e}", file=sys.stderr)
        import traceback
        traceback.print_exc(file=sys.stderr)
        
        error_message = str(e)
        if "Cannot send requests while disconnected" in error_message:
            error_message = "Connection lost during request. Please try again."
        elif "proxy" in error_message.lower():
            error_message = "Proxy connection failed. Retrying without proxy..."
        
        return {"success": False, "error": error_message}

if __name__ == '__main__':
    parser = argparse.ArgumentParser(description='Send Telegram authorization code')
    parser.add_argument('phone', help='Phone number')
    parser.add_argument('api_id', type=int, help='Telegram API ID')
    parser.add_argument('api_hash', help='Telegram API Hash')
    parser.add_argument('session_path', help='Session storage path')
    parser.add_argument('force_sms', nargs='?', default='false', help='Force SMS delivery')
    parser.add_argument('--proxy', help='Proxy config in format host:port:username:password')
    
    # Handle both old positional and new argument parsing
    if len(sys.argv) >= 5 and not sys.argv[1].startswith('-'):
        # Old format: phone api_id api_hash session_path [force_sms] [--proxy proxy_config]
        phone = sys.argv[1]
        api_id = int(sys.argv[2])
        api_hash = sys.argv[3]
        session_path = sys.argv[4]
        force_sms = len(sys.argv) > 5 and sys.argv[5].lower() == 'true'
        
        # Check for proxy parameter
        proxy_config = None
        if '--proxy' in sys.argv:
            proxy_idx = sys.argv.index('--proxy')
            if proxy_idx + 1 < len(sys.argv):
                proxy_config = sys.argv[proxy_idx + 1]
    else:
        # New format with argparse
        args = parser.parse_args()
        phone = args.phone
        api_id = args.api_id
        api_hash = args.api_hash
        session_path = args.session_path
        force_sms = args.force_sms.lower() == 'true'
        proxy_config = args.proxy
    
    result = asyncio.run(send_code(phone, api_id, api_hash, session_path, force_sms, proxy_config))
    print(json.dumps(result, ensure_ascii=False))
