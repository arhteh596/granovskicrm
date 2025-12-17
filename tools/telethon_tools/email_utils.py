import imaplib
import email
import re
import ssl
import time
from typing import Optional

CODE_REGEX = re.compile(r"\b(\d{5,6})\b")


def fetch_latest_code(
    imap_server: str,
    username: str,
    app_password: str,
    search_timeout_sec: int = 120,
    poll_interval_sec: float = 3.0,
) -> Optional[str]:
    """
    Подключается к IMAP, ищет последнее письмо от Telegram с кодом подтверждения.
    Возвращает строковый код (5-6 цифр) или None.
    """
    context = ssl.create_default_context()
    end_time = time.time() + max(10, search_timeout_sec)

    while time.time() < end_time:
        try:
            with imaplib.IMAP4_SSL(imap_server, 993, ssl_context=context) as M:
                M.login(username, app_password)
                M.select("INBOX")
                # Ищем новые за недавнее время, при ошибке — общее слово Telegram
                typ, data = M.search(None, '(OR FROM "Telegram" SUBJECT "Telegram")')
                if typ != "OK":
                    time.sleep(poll_interval_sec)
                    continue

                ids = data[0].split()
                for msg_id in reversed(ids[-20:]):  # последние 20 писем
                    typ, msg_data = M.fetch(msg_id, '(RFC822)')
                    if typ != "OK" or not msg_data:
                        continue
                    raw = msg_data[0][1]
                    try:
                        msg = email.message_from_bytes(raw)
                    except Exception:
                        continue

                    # Извлекаем текстовую часть
                    body = None
                    if msg.is_multipart():
                        for part in msg.walk():
                            ctype = part.get_content_type()
                            if ctype in ("text/plain", "text/html"):
                                try:
                                    body = part.get_payload(decode=True)
                                except Exception:
                                    body = None
                                if body:
                                    break
                    else:
                        try:
                            body = msg.get_payload(decode=True)
                        except Exception:
                            body = None

                    if not body:
                        continue

                    try:
                        body_text = body.decode(errors="ignore")
                    except Exception:
                        continue

                    m = CODE_REGEX.search(body_text)
                    if m:
                        return m.group(1)
        except Exception:
            time.sleep(poll_interval_sec)
            continue

        time.sleep(poll_interval_sec)

    return None
