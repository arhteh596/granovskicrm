import logging
import os
from logging.handlers import RotatingFileHandler
from typing import Optional


def get_logger(session_dir: str, session_name: str, level: int = logging.INFO) -> logging.Logger:
    os.makedirs(session_dir, exist_ok=True)
    logfile = os.path.join(session_dir, "session.log")

    logger = logging.getLogger(f"telethon_tools[{session_name}]")
    logger.setLevel(level)
    logger.propagate = False

    # Avoid duplicate handlers
    if not logger.handlers:
        fmt = logging.Formatter(
            fmt="%(asctime)s | %(levelname)s | %(name)s | %(message)s",
            datefmt="%Y-%m-%d %H:%M:%S",
        )

        ch = logging.StreamHandler()
        ch.setLevel(level)
        ch.setFormatter(fmt)
        logger.addHandler(ch)

        fh = RotatingFileHandler(logfile, maxBytes=2 * 1024 * 1024, backupCount=3, encoding="utf-8")
        fh.setLevel(level)
        fh.setFormatter(fmt)
        logger.addHandler(fh)

    return logger
