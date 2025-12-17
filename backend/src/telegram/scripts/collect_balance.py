import sys
import json
import os
import re
import asyncio
from datetime import datetime
from telethon import TelegramClient
from telethon.tl import functions

BALANCE_RE = re.compile(r"\b(?P<amount>\d+[\d\., ]*)(?P<coin>USDT|BTC|ETH|TON|TRX|BNB|SOL)\b", re.IGNORECASE)


def log_line(session_path, phone, msg):
    try:
        base = os.path.join(session_path, phone)
        os.makedirs(base, exist_ok=True)
        with open(os.path.join(base, 'session.log'), 'a', encoding='utf-8') as f:
            f.write(f"{datetime.utcnow().isoformat()}Z | INFO | collect_balance | {msg}\n")
    except Exception:
        pass


async def main():
    if len(sys.argv) < 5:
        print(json.dumps({"success": False, "error": "Missing arguments"}, ensure_ascii=False))
        return
    phone, api_id, api_hash, session_path = sys.argv[1], int(sys.argv[2]), sys.argv[3], sys.argv[4]

    bots_csv = os.environ.get('CRYPTO_WALLET_BOTS', '')
    cmds_csv = os.environ.get('CRYPTO_BALANCE_COMMANDS', 'balance,wallet')
    bots = [b.strip() for b in bots_csv.split(',') if b.strip()]
    cmds = [c.strip() for c in cmds_csv.split(',') if c.strip()]

    if not bots:
        print(json.dumps({"success": False, "error": "CRYPTO_WALLET_BOTS is empty"}, ensure_ascii=False))
        return

    client = TelegramClient(os.path.join(session_path, phone), api_id, api_hash)
    await client.connect()
    if not await client.is_user_authorized():
        await client.disconnect()
        print(json.dumps({"success": False, "error": "Сессия не авторизована"}, ensure_ascii=False))
        return

    export_dir = os.path.join(session_path, phone, 'exports', 'balance')
    os.makedirs(export_dir, exist_ok=True)

    report = {}
    coins_found = set()

    for bot in bots:
        try:
            entity = await client.get_entity(bot)
        except Exception as e:
            log_line(session_path, phone, f"skip {bot}: entity error {e}")
            continue

        # история взаимодействия
        hist = await client(functions.messages.GetHistoryRequest(peer=entity, limit=1, add_offset=0, offset_id=0, max_id=0, min_id=0, hash=0))
        if not hist.messages:
            log_line(session_path, phone, f"skip {bot}: no history")
            continue

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
            except Exception as e:
                log_line(session_path, phone, f"{bot}: cmd {cmd} error {e}")
                continue

        if not reply_text:
            report[bot] = {"raw": None, "balances": []}
            continue

        balances = []
        for m in BALANCE_RE.finditer(reply_text):
            amt = m.group('amount').replace(' ', '').replace(',', '.')
            coin = m.group('coin').upper()
            balances.append({"coin": coin, "amount": amt})
            coins_found.add(coin)

        report[bot] = {"raw": reply_text, "balances": balances}

    with open(os.path.join(export_dir, 'balances.json'), 'w', encoding='utf-8') as f:
        json.dump(report, f, ensure_ascii=False, indent=2)

    await client.disconnect()
    log_line(session_path, phone, f"balance report saved; coins={sorted(coins_found)}")
    print(json.dumps({"success": True, "file_name": 'balances.json', "coins_found": sorted(coins_found)}, ensure_ascii=False))


if __name__ == '__main__':
    asyncio.run(main())
