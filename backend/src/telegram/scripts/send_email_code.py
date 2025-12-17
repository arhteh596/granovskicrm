
import sys
import json
from telethon.sync import TelegramClient
from telethon.sessions import StringSession
from telethon import functions, types

def main(phone, phone_code_hash, email, api_id, api_hash, session_string=None):
    if session_string:
        client = TelegramClient(StringSession(session_string), int(api_id), api_hash)
    else:
        client = TelegramClient(StringSession(), int(api_id), api_hash)

    try:
        client.connect()
        if not client.is_user_authorized():
            sent_email = client(functions.account.SendVerifyEmailCodeRequest(
                purpose=types.EmailVerifyPurposeLoginSetup(
                    phone_number=phone,
                    phone_code_hash=phone_code_hash,
                ),
                email=email,
            ))
            
            print(json.dumps({
                "success": True,
                "email_pattern": sent_email.pattern
            }))
        else:
            print(json.dumps({"success": False, "error": "User already authorized"}))

    except Exception as e:
        print(json.dumps({"success": False, "error": str(e)}))
    finally:
        client.disconnect()

if __name__ == "__main__":
    phone_arg = sys.argv[1]
    phone_code_hash_arg = sys.argv[2]
    email_arg = sys.argv[3]
    api_id_arg = sys.argv[4]
    api_hash_arg = sys.argv[5]
    session_string_arg = sys.argv[6] if len(sys.argv) > 6 else None
    main(phone_arg, phone_code_hash_arg, email_arg, api_id_arg, api_hash_arg, session_string_arg)
