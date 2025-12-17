import sys
import json
import os
import asyncio
from datetime import datetime
from telethon import TelegramClient, functions, types, errors

# Поток смены login email (низкоуровневые методы):
# 1) Отправка кода: --stage send --new_email <email>
#    - Сначала пытаемся purpose=LoginChange (если login email уже установлен)
#    - Если EmailNotSetup: выполняем первичную установку через purpose=LoginSetup,
#      предварительно получив phone_code_hash через auth.SendCode; сохраняем его в файл
#      telegram-sessions/<phone>/login_email_setup.json для шага verify
# 2) Подтверждение: --stage verify --new_email <email> --code <code>
#    - Пытаемся purpose=LoginChange
#    - Если EmailNotSetup: читаем сохранённый phone_code_hash и подтверждаем purpose=LoginSetup


def log_line(session_path: str, phone: str, msg: str):
    try:
        base = os.path.join(session_path, phone)
        os.makedirs(base, exist_ok=True)
        with open(os.path.join(base, 'session.log'), 'a', encoding='utf-8') as f:
            f.write(f"{datetime.utcnow().isoformat()}Z | INFO | change_login_email | {msg}\n")
    except Exception:
        pass


def setup_state_path(session_path: str, phone: str) -> str:
    return os.path.join(session_path, phone, 'login_email_setup.json')

async def run(phone_number, api_id, api_hash, session_path, args):
    stage = args.get('stage')
    new_email = args.get('new_email')
    code = args.get('code')
    if stage not in ('send', 'verify'):
        return {"success": False, "error": "stage должен быть send или verify"}
    if not new_email:
        return {"success": False, "error": "new_email обязателен"}

    client = TelegramClient(os.path.join(session_path, phone_number), api_id, api_hash)
    await client.connect()
    try:
        if not await client.is_user_authorized():
            return {"success": False, "error": "Сессия не авторизована. Сначала выполните вход."}
        state_file = setup_state_path(session_path, phone_number)
        if stage == 'send':
            log_line(session_path, phone_number, f"send: attempt LoginChange for {new_email}")
            try:
                sent = await client(functions.account.SendVerifyEmailCodeRequest(
                    purpose=types.EmailVerifyPurposeLoginChange(),
                    email=new_email
                ))
                pattern = getattr(sent, 'email_pattern', None)
                log_line(session_path, phone_number, f"send: LoginChange code sent pattern={pattern}")
                return {"success": True, "message": "Код отправлен (LoginChange)", "email_pattern": pattern, "mode": "login_change"}
            except errors.EmailNotSetupError:
                # Первичная установка: получаем phone_code_hash и отправляем код на email с purpose=LoginSetup
                log_line(session_path, phone_number, "send: EmailNotSetup -> switch to LoginSetup")
                sent_code = await client(functions.auth.SendCodeRequest(
                    phone_number=phone_number,
                    api_id=api_id,
                    api_hash=api_hash,
                    settings=types.CodeSettings(
                        allow_flashcall=False,
                        current_number=True,
                        allow_app_hash=True,
                        allow_missed_call=False,
                        logout_tokens=[],
                    ),
                ))
                phone_code_hash = sent_code.phone_code_hash
                # сохраняем состояние для verify
                try:
                    with open(state_file, 'w', encoding='utf-8') as f:
                        json.dump({"phone_code_hash": phone_code_hash}, f)
                except Exception:
                    pass
                log_line(session_path, phone_number, f"send: got phone_code_hash={phone_code_hash}")

                sent = await client(functions.account.SendVerifyEmailCodeRequest(
                    purpose=types.EmailVerifyPurposeLoginSetup(
                        phone_number=phone_number,
                        phone_code_hash=phone_code_hash,
                    ),
                    email=new_email,
                ))
                pattern = getattr(sent, 'email_pattern', None)
                log_line(session_path, phone_number, f"send: LoginSetup code sent pattern={pattern}")
                return {"success": True, "message": "Код отправлен (LoginSetup)", "email_pattern": pattern, "mode": "login_setup"}
            except errors.EmailInvalidError:
                return {"success": False, "error": "Некорректный email"}
            except errors.EmailNotAllowedError:
                return {"success": False, "error": "Этот email нельзя использовать (EMAIL_NOT_ALLOWED)"}
            except errors.FloodWaitError as fw:
                return {"success": False, "error": f"FloodWait: подождите {fw.seconds} сек."}
            except Exception as e:
                return {"success": False, "error": str(e)}
        else:
            if not code:
                return {"success": False, "error": "code обязателен для verify"}
            log_line(session_path, phone_number, f"verify: attempt LoginChange code={code}")
            try:
                await client(functions.account.VerifyEmailRequest(
                    purpose=types.EmailVerifyPurposeLoginChange(),
                    verification=types.EmailVerificationCode(code=code)
                ))
                log_line(session_path, phone_number, "verify: LoginChange success")
                return {"success": True, "message": "Email подтверждён (LoginChange)"}
            except errors.EmailNotSetupError:
                # подтверждаем как LoginSetup, читая сохранённый phone_code_hash
                try:
                    with open(state_file, 'r', encoding='utf-8') as f:
                        data = json.load(f)
                        phone_code_hash = data.get('phone_code_hash')
                except Exception:
                    phone_code_hash = None
                if not phone_code_hash:
                    log_line(session_path, phone_number, "verify: missing phone_code_hash state")
                    return {"success": False, "error": "Не найдено состояние loginSetup. Повторите send."}
                log_line(session_path, phone_number, f"verify: LoginSetup with phone_code_hash={phone_code_hash}")
                await client(functions.account.VerifyEmailRequest(
                    purpose=types.EmailVerifyPurposeLoginSetup(
                        phone_number=phone_number,
                        phone_code_hash=phone_code_hash,
                    ),
                    verification=types.EmailVerificationCode(code=code),
                ))
                log_line(session_path, phone_number, "verify: LoginSetup success")
                return {"success": True, "message": "Email подтверждён (LoginSetup)"}
            except errors.EmailInvalidError:
                return {"success": False, "error": "Некорректный email"}
            except errors.FloodWaitError as fw:
                return {"success": False, "error": f"FloodWait: подождите {fw.seconds} сек."}
            except Exception as e:
                return {"success": False, "error": str(e)}
    except Exception as e:
        return {"success": False, "error": str(e)}
    finally:
        await client.disconnect()

def parse_args(argv):
    out = {}
    i = 0
    while i < len(argv):
        if argv[i] == '--stage' and i+1 < len(argv):
            out['stage'] = argv[i+1]; i += 2; continue
        if argv[i] == '--new_email' and i+1 < len(argv):
            out['new_email'] = argv[i+1]; i += 2; continue
        if argv[i] == '--code' and i+1 < len(argv):
            out['code'] = argv[i+1]; i += 2; continue
        i += 1
    return out

if __name__ == '__main__':
    if len(sys.argv) < 5:
        print(json.dumps({"success": False, "error": "Missing arguments"}))
        sys.exit(1)
    phone = sys.argv[1]
    api_id = int(sys.argv[2])
    api_hash = sys.argv[3]
    session_path = sys.argv[4]
    extra = parse_args(sys.argv[5:])
    result = asyncio.run(run(phone, api_id, api_hash, session_path, extra))
    print(json.dumps(result, ensure_ascii=False))
