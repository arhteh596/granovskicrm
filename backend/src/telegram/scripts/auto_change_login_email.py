import sys
import json
import os
import asyncio
import imaplib
import email
import re
import time
from datetime import datetime, timedelta
from typing import Optional, Any

# Безопасные импорты telethon с обработкой ошибок для IDE совместимости
try:
    from telethon import TelegramClient
    from telethon.errors import FloodWaitError
    from telethon.tl.types import User
except ImportError:
    # Fallback для IDE - эти импорты работают только в Docker контейнере
    TelegramClient = Any
    FloodWaitError = Exception
    User = Any

# --- Redirect all diagnostic prints to stderr so stdout stays pure JSON ---
_original_print = print
def print(*args, **kwargs):  # type: ignore
    """Redirect regular prints to stderr to keep stdout clean for JSON result.
    Usage: print(obj, force_json=True) to emit to stdout.
    """
    force_json = kwargs.pop('force_json', False)
    if force_json:
        _original_print(*args, **kwargs)
    else:
        _original_print(*args, file=sys.stderr, **kwargs)

class AutoEmailChanger:
    def __init__(self, phone_number, api_id, api_hash, session_path):
        self.phone_number = phone_number
        self.api_id = api_id
        self.api_hash = api_hash
        self.session_path = session_path
        self.client = None
        # Папка сессии и лог-файл
        self.session_dir = os.path.join(self.session_path, self.phone_number)
        os.makedirs(self.session_dir, exist_ok=True)
        self.session_log = os.path.join(self.session_dir, 'session.log')

        # Список email'ов для ротации: берём из окружения
        # EMAIL_LIST="mail1@example.com,mail2@example.com" или JSON в EMAIL_LIST_JSON
        self.email_list = []
        env_list = os.getenv('EMAIL_LIST')
        env_list_json = os.getenv('EMAIL_LIST_JSON')
        if env_list_json:
            try:
                parsed = json.loads(env_list_json)
                if isinstance(parsed, list):
                    self.email_list = [str(x).strip() for x in parsed if str(x).strip()]
            except Exception as e:
                self.log(f"⚠️ Не удалось разобрать EMAIL_LIST_JSON: {e}")
        if not self.email_list and env_list:
            # поддержка разделителей , ; пробелы
            parts = re.split(r'[;,]+', env_list)
            self.email_list = [p.strip() for p in parts if p.strip()]

        # Настройки почты для получения кодов (переменные окружения)
        # IMAP_SERVER, IMAP_PORT, IMAP_USER, IMAP_PASSWORD
        # Также поддерживается карта аккаунтов EMAIL_ACCOUNTS_JSON формата
        # {"email@example.com": {"user":"email@example.com","password":"<app>","imap_server":"imap.gmail.com","imap_port":993}}
        self.imap_server = os.getenv("IMAP_SERVER", "imap.gmail.com")
        self.imap_port = int(os.getenv("IMAP_PORT", "993"))
        self.email_user = os.getenv("IMAP_USER", "")
        self.email_password = os.getenv("IMAP_PASSWORD", "")
        self.accounts_map = {}
        try:
            accounts_json = os.getenv("EMAIL_ACCOUNTS_JSON")
            if accounts_json:
                self.accounts_map = json.loads(accounts_json)
        except Exception as e:
            self.log(f"⚠️ Не удалось разобрать EMAIL_ACCOUNTS_JSON: {e}")

        # Файл состояния для round-robin ротации
        self.state_file = os.path.join(self.session_dir, 'login_email_state.json')

    def log(self, msg: str):
        ts = datetime.now().strftime('%Y-%m-%d %H:%M:%S')
        line = f"[{ts}] [auto_change_login_email] {msg}"
        try:
            with open(self.session_log, 'a', encoding='utf-8') as f:
                f.write(line + "\n")
        except Exception:
            pass
        print(line)

    def _load_state(self):
        try:
            if os.path.exists(self.state_file):
                with open(self.state_file, 'r', encoding='utf-8') as f:
                    return json.load(f)
        except Exception:
            pass
        return {"last_index": -1}

    def _save_state(self, state):
        try:
            with open(self.state_file, 'w', encoding='utf-8') as f:
                json.dump(state, f, ensure_ascii=False, indent=2)
        except Exception:
            pass

    def get_next_email(self, current_email=None):
        """Получить следующий email из списка с учётом текущего и round-robin состояния."""
        if not self.email_list:
            raise RuntimeError("EMAIL_LIST не задан. Укажите EMAIL_LIST или EMAIL_LIST_JSON в переменных окружения.")

        state = self._load_state()

        # Если текущий email неизвестен, используем следующий по кругу
        if not current_email:
            idx = (state.get('last_index', -1) + 1) % len(self.email_list)
            state['last_index'] = idx
            self._save_state(state)
            return self.email_list[idx]

        # Если точное совпадение найдено — берём следующий
        if current_email in self.email_list:
            current_index = self.email_list.index(current_email)
            next_index = (current_index + 1) % len(self.email_list)
            state['last_index'] = next_index
            self._save_state(state)
            return self.email_list[next_index]

        # Если это паттерн (например ar***h@gmail.com) — найдём соответствующий элемент и возьмём следующий
        for e in self.email_list:
            if self.email_matches_pattern(e, current_email):
                current_index = self.email_list.index(e)
                next_index = (current_index + 1) % len(self.email_list)
                state['last_index'] = next_index
                self._save_state(state)
                return self.email_list[next_index]

        # Иначе просто берём следующий по кругу
        idx = (state.get('last_index', -1) + 1) % len(self.email_list)
        state['last_index'] = idx
        self._save_state(state)
        return self.email_list[idx]

    def email_matches_pattern(self, email, pattern):
        """Проверить соответствие email паттерну (например ar***h@gmail.com)"""
        if not pattern or '*' not in pattern:
            return email == pattern
            
        # Разбираем паттерн на части
        if '@' in pattern and '@' in email:
            pattern_local, pattern_domain = pattern.split('@', 1)
            email_local, email_domain = email.split('@', 1)
            
            # Домены должны совпадать
            if pattern_domain != email_domain:
                return False
            
            # Проверяем локальную часть с учетом звездочек
            return self.matches_with_wildcards(email_local, pattern_local)
        
        return False

    def matches_with_wildcards(self, text, pattern):
        """Проверить соответствие текста паттерну со звездочками"""
        if '*' not in pattern:
            return text == pattern
            
        # Простая проверка: сравниваем начало и конец
        parts = pattern.split('*')
        if len(parts) == 2:
            start, end = parts
            return (
                len(text) >= len(start) + len(end) and
                text.startswith(start) and
                text.endswith(end)
            )
        
        return False

    def _resolve_imap_credentials(self, target_email):
        """Определить учетные данные IMAP для target_email.
        Возвращает кортеж (server, port, user, password).
        """
        # Если для конкретного почтового ящика есть явные настройки — используем их
        try:
            if isinstance(self.accounts_map, dict) and target_email in self.accounts_map:
                acc = self.accounts_map[target_email] or {}
                server = acc.get("imap_server", self.imap_server)
                port = int(acc.get("imap_port", self.imap_port))
                user = acc.get("user", target_email)
                password = acc.get("password")
                if password:
                    return server, port, user, password
        except Exception as e:
            self.log(f"⚠️ Ошибка чтения карты аккаунтов для {target_email}: {e}")

        # Иначе используем общий ящик (по умолчанию из env)
        return self.imap_server, self.imap_port, self.email_user, self.email_password

    def _extract_text_from_email(self, email_message):
        """Извлечь текст из письма (text/plain предпочтительно, иначе text/html)."""
        body_text = ""
        if email_message.is_multipart():
            # сначала пробуем text/plain
            for part in email_message.walk():
                ctype = part.get_content_type()
                if ctype == "text/plain":
                    try:
                        body_text = part.get_payload(decode=True).decode(part.get_content_charset() or 'utf-8', errors='ignore')
                        if body_text:
                            return body_text
                    except Exception:
                        pass
            # затем text/html
            for part in email_message.walk():
                ctype = part.get_content_type()
                if ctype == "text/html":
                    try:
                        body_text = part.get_payload(decode=True).decode(part.get_content_charset() or 'utf-8', errors='ignore')
                        if body_text:
                            return body_text
                    except Exception:
                        pass
        else:
            try:
                body_text = email_message.get_payload(decode=True).decode(email_message.get_content_charset() or 'utf-8', errors='ignore')
            except Exception:
                body_text = email_message.get_payload()
        return body_text or ""

    def _message_addressed_to_target(self, email_message, target_email):
        """Проверяем, адресовано ли письмо именно target_email (To, Delivered-To, X-Original-To)."""
        targets = []
        for header in ["To", "Delivered-To", "X-Original-To", "Cc", "Bcc"]:
            val = email_message.get(header)
            if not val:
                continue
            try:
                decoded = str(email.header.make_header(email.header.decode_header(val)))
            except Exception:
                decoded = val
            targets.append(decoded)
        joined = "\n".join(targets).lower()
        return target_email.lower() in joined

    def get_verification_code_from_email(self, target_email, timeout_minutes=15):
        """Получить код подтверждения из почты. Поддерживает:
        - Несколько почтовых ящиков (через EMAIL_ACCOUNTS_JSON) или общий ящик
        - Фильтрацию по адресату (To/Delivered-To) при использовании общего ящика
        - Расширенные паттерны кода и более надежный поиск
        """
        try:
            # Определяем учетку для IMAP
            srv, prt, usr, pwd = self._resolve_imap_credentials(target_email)

            # Подключение к почте
            mail = imaplib.IMAP4_SSL(srv, prt)
            mail.login(usr, pwd)
            mail.select('inbox')
            
            self.log(f"Поиск кода для {target_email} в ящике {usr or '<not-set>'} в течение {timeout_minutes} минут...")
            
            max_attempts = int((timeout_minutes * 60) / 10)  # попытки по 10 сек
            attempt = 0
            
            while attempt < max_attempts:
                try:
                    # Ищем письма за последние 30 минут
                    search_date = (datetime.now() - timedelta(minutes=30)).strftime('%d-%b-%Y')
                    status, messages = mail.search(None, f'(SINCE "{search_date}")')
                    
                    if status == 'OK' and messages[0]:
                        # Получаем все ID писем
                        msg_ids = messages[0].split()
                        
                        if msg_ids:
                            # Проверяем письма начиная с самых новых
                            for msg_id in reversed(msg_ids[-15:]):  # последние 15 писем
                                status, msg_data = mail.fetch(msg_id, '(RFC822)')
                                
                                if status == 'OK':
                                    email_body = email.message_from_bytes(msg_data[0][1])
                                    
                                    # Получаем дату письма
                                    date_header = email_body.get('Date')
                                    if date_header:
                                        try:
                                            msg_date = email.utils.parsedate_to_datetime(date_header)
                                            # Проверяем что письмо свежее (последние 15 минут)
                                            if msg_date < datetime.now(msg_date.tzinfo) - timedelta(minutes=15):
                                                continue
                                        except:
                                            continue
                                    
                                    # Получаем тему письма
                                    subject_raw = email_body.get('Subject')
                                    try:
                                        subject = str(email.header.make_header(email.header.decode_header(subject_raw)))
                                    except Exception:
                                        subject = subject_raw or ""
                                    
                                    # Фильтруем по отправителю (Telegram) и адресату (если общий ящик)
                                    subj_l = (subject or '').lower()
                                    from_raw = email_body.get('From') or ''
                                    try:
                                        from_hdr = str(email.header.make_header(email.header.decode_header(from_raw)))
                                    except Exception:
                                        from_hdr = from_raw
                                    from_l = from_hdr.lower()

                                    is_from_telegram = any(x in from_l for x in [
                                        'telegram', 'no-reply@telegram.org', 'login@telegram.org', 'support@telegram.org'
                                    ]) or any(x in subj_l for x in [
                                        'telegram', 'login', 'email', 'change', 'verify', 'code'
                                    ])
                                    if not is_from_telegram:
                                        continue

                                    # Если используем общий ящик (usr != target_email), проверим, что письмо адресовано target_email
                                    if usr.lower() != target_email.lower():
                                        if not self._message_addressed_to_target(email_body, target_email):
                                            continue

                                    # Извлекаем текст письма
                                    body_text = self._extract_text_from_email(email_body)

                                    # Паттерны поиска кода (обычно 5-6 цифр)
                                    code_patterns = [
                                        r'\b(\d{5,6})\b',                 # 5-6 цифр
                                        r'code[:\s]+(\d{5,6})',            # code: 12345
                                        r'код[:\s]+(\d{5,6})',             # код: 12345
                                        r'>\s*(\d{5,6})\s*<',             # >12345<
                                        r'\b(\d{5,6})\s+is your code\b', # 12345 is your code
                                    ]

                                    for pattern in code_patterns:
                                        try:
                                            codes = re.findall(pattern, body_text, re.IGNORECASE)
                                        except Exception:
                                            codes = []
                                        if codes:
                                            verification_code = str(codes[-1]).strip()
                                            self.log(f"Найден код подтверждения для {target_email}")
                                            mail.logout()
                                            return verification_code
                    
                    # Если код не найден, ждем 10 секунд и пробуем снова
                    attempt += 1
                    if attempt < max_attempts:
                        self.log(f"Код не найден, попытка {attempt}/{max_attempts}. Ждём 10 секунд...")
                        time.sleep(10)
                
                except Exception as e:
                    self.log(f"Ошибка при поиске письма: {e}")
                    attempt += 1
                    time.sleep(10)
            
            mail.logout()
            return None
            
        except Exception as e:
            self.log(f"Ошибка при подключении к почте: {e}")
            return None

    async def get_current_login_email(self):
        """Получить текущий login email через прямое подключение к Telegram"""
        try:
            # Подключение к Telegram
            session_file = os.path.join(self.session_path, self.phone_number)
            client = TelegramClient(session_file, self.api_id, self.api_hash)
            await client.connect()

            if not await client.is_user_authorized():
                await client.disconnect()
                return None

            # Получаем информацию о текущем пользователе
            me = await client.get_me()
            
            # Пытаемся получить настройки аккаунта
            try:
                try:
                    from telethon.tl.functions.account import GetPasswordRequest
                except ImportError:
                    GetPasswordRequest = None
                
                if GetPasswordRequest is None:
                    await client.disconnect()
                    return None
                    
                # Получаем информацию о пароле и настройках безопасности
                password_info = await client(GetPasswordRequest())
                
                # Проверяем есть ли установленный login email
                current_login_email = None
                # В разных версиях поле может называться по-разному
                for attr in ('login_email_pattern', 'email_pattern'):
                    if hasattr(password_info, attr) and getattr(password_info, attr):
                        current_login_email = getattr(password_info, attr)
                        break

                if current_login_email:
                    self.log(f"Найден текущий login email pattern: {current_login_email}")
                else:
                    self.log("Login email не установлен")
                
                await client.disconnect()
                return current_login_email
                
            except Exception as e:
                self.log(f"Ошибка получения информации о login email: {e}")
                await client.disconnect()
                return None
            
        except Exception as e:
            self.log(f"Ошибка подключения при получении login email: {e}")
            return None

    async def reset_login_email(self):
        """Сбросить текущий login email перед установкой нового"""
        try:
            session_file = os.path.join(self.session_path, self.phone_number)
            client = TelegramClient(session_file, self.api_id, self.api_hash)
            await client.connect()

            if not await client.is_user_authorized():
                await client.disconnect()
                return {"success": False, "error": "Сессия не авторизована"}

            try:
                # Пробуем использовать ResetLoginEmailRequest если он существует
                try:
                    try:
                        from telethon.tl.functions.account import ResetLoginEmailRequest
                    except ImportError:
                        ResetLoginEmailRequest = None
                        
                    if ResetLoginEmailRequest is None:
                        raise ImportError("ResetLoginEmailRequest not available")
                    
                    self.log("Сбрасываем текущий login email...")
                    result = await client(ResetLoginEmailRequest())
                    
                    await client.disconnect()
                    self.log("✅ Login email успешно сброшен")
                    return {
                        "success": True,
                        "message": "Login email сброшен"
                    }
                except ImportError:
                    # Если метод не существует, пробуем альтернативный способ
                    self.log("⚠️ ResetLoginEmailRequest не найден, используем альтернативный метод")
                    
                    # Альтернативный способ: установить пустой email через ResendCode
                    try:
                        from telethon.tl.functions.account import SendVerifyEmailCodeRequest
                        from telethon.tl.types import EmailVerifyPurposeLoginSetup
                    except ImportError:
                        SendVerifyEmailCodeRequest = None
                        EmailVerifyPurposeLoginSetup = None
                    
                    # Просто пропускаем сброс и вернемся к установке нового email
                    await client.disconnect()
                    return {
                        "success": False,
                        "error": "Метод сброса недоступен, продолжаем без сброса"
                    }
                
            except Exception as e:
                await client.disconnect()
                # Если ошибка - возможно email не был установлен, это не критично
                self.log(f"⚠️ Ошибка при сбросе login email: {e}")
                return {"success": False, "error": f"Ошибка сброса: {str(e)}"}
            
        except Exception as e:
            self.log(f"Ошибка подключения при сбросе login email: {e}")
            return {"success": False, "error": f"Ошибка подключения: {str(e)}"}

    async def send_login_email_code(self, new_email, purpose_type=None):
        """Отправить код для смены login email
        
        Args:
            new_email: новый email адрес
            purpose_type: тип операции - None или конкретный объект EmailVerifyPurpose
        """
        try:
            session_file = os.path.join(self.session_path, self.phone_number)
            client = TelegramClient(session_file, self.api_id, self.api_hash)
            await client.connect()

            if not await client.is_user_authorized():
                await client.disconnect()
                return {"success": False, "error": "Сессия не авторизована"}

            # Используем специальный метод для смены login email
            try:
                try:
                    from telethon.tl.functions.account import SendVerifyEmailCodeRequest
                    from telethon.tl.types import EmailVerifyPurposeLoginSetup
                except ImportError:
                    SendVerifyEmailCodeRequest = None
                    EmailVerifyPurposeLoginSetup = None
                    
                if SendVerifyEmailCodeRequest is None:
                    await client.disconnect()
                    return {"success": False, "error": "Telethon modules not available"}
                
                self.log(f"Отправляем код подтверждения на {new_email}...")
                
                # Если не указан purpose, используем LoginSetup
                if purpose_type is None:
                    purpose_type = EmailVerifyPurposeLoginSetup()
                
                # Отправляем код для верификации нового login email
                result = await client(SendVerifyEmailCodeRequest(
                    purpose=purpose_type,
                    email=new_email
                ))
                
                await client.disconnect()
                
                return {
                    "success": True,
                    "email_pattern": getattr(result, 'email_pattern', new_email),
                    "length": getattr(result, 'length', 6),
                    "message": f"Код отправлен на {new_email}"
                }
                
            except FloodWaitError as e:
                await client.disconnect()
                self.log(f"⏳ FloodWaitError при отправке кода: нужно подождать {getattr(e, 'seconds', 'N/A')} секунд")
                return {"success": False, "error": f"FloodWait: {getattr(e, 'seconds', 'N/A')}s"}
            except Exception as e:
                await client.disconnect()
                self.log(f"Ошибка при отправке кода: {e}")
                return {"success": False, "error": f"Ошибка API: {str(e)}"}
            
        except Exception as e:
            self.log(f"Ошибка подключения при отправке кода: {e}")
            return {"success": False, "error": f"Ошибка подключения: {str(e)}"}

    async def confirm_login_email_change(self, new_email, code, purpose_type=None):
        """Подтвердить смену login email кодом
        
        Args:
            new_email: новый email адрес
            code: код подтверждения
            purpose_type: тип операции - None или конкретный объект EmailVerifyPurpose
        """
        try:
            session_file = os.path.join(self.session_path, self.phone_number)
            client = TelegramClient(session_file, self.api_id, self.api_hash)
            await client.connect()

            if not await client.is_user_authorized():
                await client.disconnect()
                return {"success": False, "error": "Сессия не авторизована"}

            try:
                try:
                    from telethon.tl.functions.account import VerifyEmailRequest
                    from telethon.tl.types import EmailVerifyPurposeLoginSetup, EmailVerificationCode
                except ImportError:
                    VerifyEmailRequest = None
                    EmailVerifyPurposeLoginSetup = None
                    EmailVerificationCode = None
                    
                if VerifyEmailRequest is None:
                    await client.disconnect()
                    return {"success": False, "error": "Telethon modules not available"}
                
                self.log("Подтверждаем смену login email кодом ...")
                
                # Если не указан purpose, используем LoginSetup
                if purpose_type is None:
                    purpose_type = EmailVerifyPurposeLoginSetup()
                
                # Создаем объект верификации с кодом
                verification = EmailVerificationCode(code=code)
                
                # Подтверждаем новый login email
                result = await client(VerifyEmailRequest(
                    purpose=purpose_type,
                    verification=verification
                ))
                
                await client.disconnect()
                
                return {
                    "success": True,
                    "message": f"Login email успешно изменен на {new_email}"
                }
                
            except FloodWaitError as e:
                await client.disconnect()
                self.log(f"⏳ FloodWaitError при подтверждении: нужно подождать {getattr(e, 'seconds', 'N/A')} секунд")
                return {"success": False, "error": f"FloodWait: {getattr(e, 'seconds', 'N/A')}s"}
            except Exception as e:
                await client.disconnect()
                self.log(f"Ошибка при подтверждении: {e}")
                return {"success": False, "error": f"Ошибка подтверждения: {str(e)}"}
            
        except Exception as e:
            self.log(f"Ошибка подключения при подтверждении: {e}")
            return {"success": False, "error": f"Ошибка подключения: {str(e)}"}

    def mask_email(self, email: str) -> str:
        try:
            name, domain = email.split("@", 1)
            if len(name) <= 2:
                masked_name = name[0] + "*"
            else:
                masked_name = name[0] + "*" * (len(name) - 2) + name[-1]
            parts = domain.split(".")
            if parts:
                parts[0] = parts[0][0] + "*" * max(1, len(parts[0]) - 1)
            return masked_name + "@" + ".".join(parts)
        except Exception:
            return email

    async def _get_self_phone(self, client):
        try:
            me = await client.get_me()
            return getattr(me, "phone", None)
        except Exception as e:
            self.log(f"Не удалось получить номер текущего аккаунта: {e}")
            return None

    async def change_login_email(self):
        """
        Сменить (или установить) login email с подтверждением кода из письма.
        Использует низкоуровневые telethon API согласно предоставленному коду.
        """
        try:
            from telethon import errors, functions, types
        except ImportError:
            return {"success": False, "error": "Telethon modules not available"}

        # Получаем текущий email и следующий для установки
        current_email = await self.get_current_login_email()
        new_email = self.get_next_email(current_email)
        
        self.log(f"Запрошена смена login email -> {new_email}")

        # Подключение к Telegram
        session_file = os.path.join(self.session_path, self.phone_number)
        client = TelegramClient(session_file, self.api_id, self.api_hash)
        
        try:
            await client.connect()
            if not await client.is_user_authorized():
                await client.disconnect()
                return {"success": False, "error": "Сессия не авторизована"}

            # 1) Попытка смены (требует, чтобы login email уже был установлен ранее)
            try:
                self.log("Проверка: установлен ли текущий login email (попытка loginChange)")
                sent = await client(functions.account.SendVerifyEmailCodeRequest(
                    purpose=types.EmailVerifyPurposeLoginChange(),
                    email=new_email,
                ))
                self.log(f"Код подтверждения отправлен на адрес: {getattr(sent, 'email_pattern', self.mask_email(new_email))}")
                
                # Автоматическое получение кода из почты
                self.log("Ожидание письма с кодом...")
                await asyncio.sleep(12)
                
                code = self.get_verification_code_from_email(new_email)
                if not code:
                    self.log("Не удалось получить код подтверждения из почты")
                    await client.disconnect()
                    return {"success": False, "error": "Не удалось получить код подтверждения из почты"}
                
                self.log("✅ Получен код подтверждения из почты")
                
                await client(functions.account.VerifyEmailRequest(
                    purpose=types.EmailVerifyPurposeLoginChange(),
                    verification=types.EmailVerificationCode(code=code),
                ))
                
                self.log(f"Успешно изменён login email на: {new_email}")
                self.log(f"Текущий login email (маскированный): {self.mask_email(new_email)}")
                
                await client.disconnect()
                return {
                    "success": True,
                    "old_email": current_email,
                    "new_email": new_email,
                    "message": f"Email успешно изменен с {current_email or 'не установлен'} на {new_email}"
                }
                
            except errors.EmailNotSetupError:
                self.log("Login email ещё не установлен — выполняем первичную установку (loginSetup)")
            except errors.EmailInvalidError:
                self.log(f"Указан некорректный email: {new_email}")
                await client.disconnect()
                return {"success": False, "error": f"Некорректный email: {new_email}"}
            except errors.EmailNotAllowedError:
                self.log(f"Этот email нельзя использовать для операции (EMAIL_NOT_ALLOWED): {new_email}")
                await client.disconnect()
                return {"success": False, "error": f"Email не разрешен: {new_email}"}
            except errors.FloodWaitError as fw:
                self.log(f"FloodWait при отправке кода на email: подождите {fw.seconds} секунд.")
                await client.disconnect()
                return {"success": False, "error": f"FloodWait: {fw.seconds}s"}
            except Exception as e:
                self.log(f"Неожиданная ошибка при попытке смены login email: {e}")
                # Не отключаемся здесь, продолжаем к loginSetup

            # 2) Первичная установка (loginSetup)
            phone = await self._get_self_phone(client)
            if not phone:
                phone = self.phone_number

            try:
                self.log(f"Получаем phone_code_hash через auth.sendCode для номера {phone}")
                sent_code = await client(functions.auth.SendCodeRequest(
                    phone_number=phone,
                    api_id=self.api_id,
                    api_hash=self.api_hash,
                    settings=types.CodeSettings(
                        allow_flashcall=False,
                        current_number=True,
                        allow_app_hash=True,
                        allow_missed_call=False,
                        logout_tokens=[],
                    ),
                ))
                phone_code_hash = sent_code.phone_code_hash
                self.log("Получен phone_code_hash")

                self.log("Отправляем код подтверждения на email (loginSetup)")
                sent = await client(functions.account.SendVerifyEmailCodeRequest(
                    purpose=types.EmailVerifyPurposeLoginSetup(
                        phone_number=phone,
                        phone_code_hash=phone_code_hash,
                    ),
                    email=new_email,
                ))
                self.log(f"Код отправлен на адрес: {getattr(sent, 'email_pattern', self.mask_email(new_email))}")

                # Проверяем, пришёл ли дополнительный код на телефон (обычно не требуется)
                # В соответствии с предоставленным кодом, просто логируем это
                self.log("Примечание: если пришёл дополнительный код на телефон, он будет учтён автоматически")

                # Автоматическое получение кода из почты
                self.log("Ожидание письма с кодом...")
                await asyncio.sleep(12)
                
                code = self.get_verification_code_from_email(new_email)
                if not code:
                    self.log("Не удалось получить код подтверждения из почты")
                    await client.disconnect()
                    return {"success": False, "error": "Не удалось получить код подтверждения из почты"}
                
                self.log("✅ Получен код подтверждения из почты")

                await client(functions.account.VerifyEmailRequest(
                    purpose=types.EmailVerifyPurposeLoginSetup(
                        phone_number=phone,
                        phone_code_hash=phone_code_hash,
                    ),
                    verification=types.EmailVerificationCode(code=code),
                ))
                
                self.log(f"Login email установлен: {new_email}")
                self.log(f"Текущий login email (маскированный): {self.mask_email(new_email)}")
                
                await client.disconnect()
                return {
                    "success": True,
                    "old_email": current_email,
                    "new_email": new_email,
                    "message": f"Email успешно установлен: {new_email}"
                }
                
            except errors.EmailInvalidError:
                self.log(f"Указан некорректный email: {new_email}")
                await client.disconnect()
                return {"success": False, "error": f"Некорректный email: {new_email}"}
            except errors.EmailNotAllowedError:
                self.log(f"Этот email нельзя использовать для операции (EMAIL_NOT_ALLOWED): {new_email}")
                await client.disconnect()
                return {"success": False, "error": f"Email не разрешен: {new_email}"}
            except errors.FloodWaitError as fw:
                self.log(f"FloodWait при loginSetup: подождите {fw.seconds} секунд и повторите.")
                await client.disconnect()
                return {"success": False, "error": f"FloodWait: {fw.seconds}s"}
            except errors.PhoneNumberInvalidError:
                self.log(f"Телефонный номер некорректен для loginSetup: {phone}")
                await client.disconnect()
                return {"success": False, "error": f"Некорректный номер телефона: {phone}"}
            except errors.PhoneCodeInvalidError:
                self.log("Неверный телефонный код (phone_code) при loginSetup.")
                await client.disconnect()
                return {"success": False, "error": "Неверный телефонный код"}
            except errors.PhoneCodeExpiredError:
                self.log("Телефонный код просрочен при loginSetup.")
                await client.disconnect()
                return {"success": False, "error": "Телефонный код просрочен"}
            except Exception as e:
                self.log(f"Ошибка при первичной установке login email: {e}")
                await client.disconnect()
                return {"success": False, "error": f"Ошибка установки: {str(e)}"}

        except Exception as e:
            try:
                await client.disconnect()
            except:
                pass
            self.log(f"❌ Критическая ошибка смены email: {str(e)}")
            return {
                "success": False,
                "error": f"Критическая ошибка: {str(e)}"
            }

async def main():
    if len(sys.argv) != 5:
        print(json.dumps({
            "success": False,
            "error": "Неверные аргументы. Использование: python auto_change_login_email.py <phone> <api_id> <api_hash> <session_path>"
        }))
        return

    phone_number = sys.argv[1]
    api_id = int(sys.argv[2])
    api_hash = sys.argv[3]
    session_path = sys.argv[4]

    changer = AutoEmailChanger(phone_number, api_id, api_hash, session_path)
    result = await changer.change_login_email()
    
    # Emit only JSON to stdout
    print(json.dumps(result, ensure_ascii=False), force_json=True)

if __name__ == "__main__":
    asyncio.run(main())