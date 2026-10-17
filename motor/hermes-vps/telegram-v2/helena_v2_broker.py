"""Optional Telegram command bridge for pinned Hermes 0.15.1.

Only /vincular and /pedido private-human updates are diverted.  The Supabase
service role stays in the Edge Function; this process has only a narrow
transport capability.  This module never passes credentials to model prompts.
"""

from __future__ import annotations

import os
import re
from typing import Awaitable, Callable
from urllib.parse import urlsplit

import httpx


_BROKER_HOST = "wxkgrykduqtsgmjkzlou.supabase.co"
_BROKER_PATH = "/functions/v1/helena-v2-telegram"
_SECRET = re.compile(r"^[A-Za-z0-9_-]{32,256}$")
_FAILURE = "Não foi possível confirmar agora. Consulte o site antes de reenviar."


def _valid_broker_url(value: str) -> bool:
    try:
        parsed = urlsplit(value)
        return (
            parsed.scheme == "https"
            and parsed.hostname == _BROKER_HOST
            and parsed.port is None
            and not parsed.username
            and not parsed.password
            and parsed.path == _BROKER_PATH
            and not parsed.query
            and not parsed.fragment
        )
    except ValueError:
        return False


def _safe_id(value: object) -> bool:
    return type(value) is int and 0 < value <= (2**53 - 1)


def _eligible_command(update: object) -> bool:
    message = getattr(update, "message", None)
    text = getattr(message, "text", None)
    chat = getattr(message, "chat", None)
    user = getattr(message, "from_user", None)
    if not isinstance(text, str) or not (
        text.startswith("/pedido") or text.startswith("/vincular")
    ):
        return False
    return (
        getattr(chat, "type", None) == "private"
        and _safe_id(getattr(chat, "id", None))
        and getattr(chat, "id", None) == getattr(user, "id", None)
        and getattr(user, "is_bot", None) is False
        and _safe_id(getattr(message, "message_id", None))
        and _safe_id(getattr(update, "update_id", None))
    )


async def handle_helena_v2_command(
    update: object,
    send_reply: Callable[[str], Awaitable[object]],
    *,
    post: Callable[..., Awaitable[httpx.Response]] | None = None,
) -> bool:
    """Return True for intercepted commands even when the broker is down.

    A failed command is never passed to the model as an alternative executor.
    Both HTTP attempts carry the identical serialized Telegram Update.
    """
    if not _eligible_command(update):
        return False

    async def reply_safely(text: str) -> None:
        try:
            await send_reply(text)
        except Exception:
            # A failed Telegram send cannot authorize model fallback.
            pass

    url = os.environ.get("HELENA_V2_TELEGRAM_BROKER_URL", "")
    secret = os.environ.get("HELENA_V2_TELEGRAM_BROKER_SECRET", "")
    if not _valid_broker_url(url) or not _SECRET.fullmatch(secret):
        await reply_safely(_FAILURE)
        return True

    try:
        payload = update.to_dict()
        message = payload.get("message")
        if not isinstance(message, dict) or message.get("text") != update.message.text or (
            payload.get("update_id") != update.update_id
        ):
            raise ValueError("Invalid update serialization")
    except Exception:
        await reply_safely(_FAILURE)
        return True

    async def attempt(send: Callable[..., Awaitable[httpx.Response]]) -> list[str] | None:
        try:
            result = await send(
                url,
                json=payload,
                headers={"X-Telegram-Bot-Api-Secret-Token": secret},
                timeout=8.0,
                follow_redirects=False,
            )
            if result.status_code != 200:
                return None
            data = result.json()
            if data.get("ok") is not True or not isinstance(data.get("respostas"), list):
                return None
            responses = data["respostas"]
            if not responses or any(not isinstance(item, str) or not item or len(item) > 4096
                                    for item in responses):
                return None
            return responses
        except Exception:
            return None

    if post is None:
        try:
            async with httpx.AsyncClient() as client:
                for _ in range(2):
                    responses = await attempt(client.post)
                    if responses is not None:
                        for text in responses:
                            await reply_safely(text)
                        return True
        except Exception:
            pass
    else:
        for _ in range(2):
            responses = await attempt(post)
            if responses is not None:
                for text in responses:
                    await reply_safely(text)
                return True

    await reply_safely(_FAILURE)
    return True
