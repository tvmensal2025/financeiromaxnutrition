"""Pinned Hermes Telegram adapter fed exclusively by the Edge durable inbox.

The worker capability can claim, renew and complete existing jobs and request
outbox drain. It cannot register Telegram Updates, choose a recipient, or call
Telegram Bot API. The inherited Hermes dispatcher/session path handles normal
text conversations. /pedido is handled by SQL intake, never by the model.
"""

from __future__ import annotations

import asyncio
import copy
from contextlib import suppress
import os
import re
from typing import Any
from urllib.parse import urlsplit

import httpx

from gateway.platforms.telegram import TelegramAdapter, TELEGRAM_AVAILABLE
from gateway.platforms.base import MessageType, SendResult
from gateway.session import build_session_key


_HOST = "wxkgrykduqtsgmjkzlou.supabase.co"
_PATH = "/functions/v1/helena-v2-telegram"
_SECRET = re.compile(r"^[A-Za-z0-9_-]{32,256}$")


def _valid_url(value: str) -> bool:
    try:
        url = urlsplit(value)
        return (url.scheme == "https" and url.hostname == _HOST and url.port is None
                and not url.username and not url.password and url.path == _PATH
                and not url.query and not url.fragment)
    except ValueError:
        return False


def _positive_id(value: Any) -> bool:
    return type(value) is int and 0 < value <= 2**53 - 1


class HelenaV2InboxAdapter(TelegramAdapter):
    """Use Telegram's original event builder and GatewayRunner dispatcher."""

    def __init__(self, config, *, client: httpx.AsyncClient | None = None):
        super().__init__(config)
        self._broker_url = os.environ.get("HELENA_V2_TELEGRAM_BROKER_URL", "")
        self._worker_secret = os.environ.get("HELENA_V2_TELEGRAM_WORKER_SECRET", "")
        self._client = client
        self._owns_client = client is None
        self._worker_task: asyncio.Task | None = None
        self._active_job: dict | None = None
        self._drafts: list[str] = []

    async def connect(self) -> bool:
        # A bot token in the same Hermes process defeats the server-only
        # boundary; this adapter does not initialize PTB or call getUpdates.
        if (not TELEGRAM_AVAILABLE or self.config.token or os.environ.get("TELEGRAM_BOT_TOKEN") or
                not _valid_url(self._broker_url) or not _SECRET.fullmatch(self._worker_secret)):
            return False
        if self._client is None:
            self._client = httpx.AsyncClient(timeout=10.0, follow_redirects=False)
        self._mark_connected()
        self._worker_task = asyncio.create_task(self._loop())
        return True

    async def disconnect(self) -> None:
        if self._worker_task:
            self._worker_task.cancel()
            with suppress(asyncio.CancelledError):
                await self._worker_task
            self._worker_task = None
        if self._owns_client and self._client:
            await self._client.aclose()
            self._client = None
        self._mark_disconnected()

    async def _post(self, path: str, payload: dict | None = None) -> dict:
        if self._client is None:
            raise RuntimeError("Worker disconnected")
        response = await self._client.post(
            self._broker_url + path,
            json=payload or {},
            headers={"X-Helena-Telegram-Worker-Secret": self._worker_secret},
        )
        response.raise_for_status()
        data = response.json()
        if not isinstance(data, dict) or data.get("ok") is not True:
            raise ValueError("Invalid Edge response")
        return data

    async def _loop(self) -> None:
        while True:
            try:
                # Runs even when inbox is empty so Bot API failures retry.
                await self._post("/drain")
                job = (await self._post("/worker/claim")).get("job")
                if isinstance(job, dict):
                    await self._dispatch_job(job)
                else:
                    await asyncio.sleep(2)
            except asyncio.CancelledError:
                raise
            except Exception:
                await asyncio.sleep(3)

    async def _heartbeat(self, update_id: str, token: str) -> None:
        while True:
            await asyncio.sleep(45)
            await self._post("/worker/renew", {"update_id": update_id, "lease_token": token})

    async def _dispatch_job(self, job: dict) -> None:
        update_id = job.get("update_id")
        token = job.get("lease_token")
        raw = job.get("update")
        kind = job.get("tipo")
        if (not isinstance(update_id, str) or not update_id.isdecimal() or
                not isinstance(token, str) or not isinstance(raw, dict) or
                raw.get("update_id") != int(update_id)):
            raise ValueError("Invalid inbox job")
        self._active_job = job
        self._drafts = []
        heartbeat = asyncio.create_task(self._heartbeat(update_id, token))
        try:
            reply = None
            if kind == "CONVERSA":
                reply = await self._dispatch_conversation(raw)
            elif kind == "MIDIA":
                reply = ("Anexo recebido. Ainda não consigo ler o conteúdo aqui; "
                         "descreva o que precisa em texto para eu ajudar.")
            elif kind != "PEDIDO":
                raise ValueError("Unsupported inbox job")
            await self._post("/worker/complete", {
                "update_id": update_id, "lease_token": token,
                "resposta": reply, "proposta": None,
            })
        finally:
            heartbeat.cancel()
            with suppress(asyncio.CancelledError):
                await heartbeat
            self._active_job = None
            self._drafts = []

    async def _dispatch_conversation(self, raw: dict) -> str | None:
        from telegram import Message

        body = raw.get("message")
        if not isinstance(body, dict):
            raise ValueError("Missing message")
        chat = body.get("chat")
        user = body.get("from")
        if (not isinstance(chat, dict) or not isinstance(user, dict) or
                chat.get("type") != "private" or user.get("is_bot") is not False or
                not _positive_id(chat.get("id")) or chat.get("id") != user.get("id") or
                not _positive_id(body.get("message_id")) or
                not isinstance(body.get("text"), str) or not body["text"].strip()):
            raise ValueError("Invalid conversation")
        # PTB requires first_name even when the transport has already
        # authenticated and stored a minimally shaped private message.
        parsed = copy.deepcopy(body)
        parsed["from"].setdefault("first_name", "")
        parsed.setdefault("date", 0)
        message = Message.de_json(parsed, None)
        if message is None:
            raise ValueError("Invalid Telegram message")
        msg_type = MessageType.COMMAND if body["text"].startswith("/") else MessageType.TEXT
        event = self._build_message_event(message, msg_type, update_id=raw["update_id"])
        event.text = self._clean_bot_trigger_text(event.text)
        event = self._apply_telegram_group_observe_attribution(event)
        session_key = build_session_key(
            event.source,
            group_sessions_per_user=self.config.extra.get("group_sessions_per_user", True),
            thread_sessions_per_user=self.config.extra.get("thread_sessions_per_user", False),
        )
        # BasePlatformAdapter spawns the same task that upstream Telegram uses.
        await self.handle_message(event)
        task = self._session_tasks.get(session_key)
        if task:
            await task
        return "\n".join(self._drafts).strip()[:4096] or None

    async def send(self, chat_id: str, content: str, reply_to=None, metadata=None) -> SendResult:
        job = self._active_job
        chat = ((job or {}).get("update") or {}).get("message", {}).get("chat", {})
        if not job or str(chat.get("id")) != str(chat_id):
            return SendResult(success=False, error="No matching inbox job")
        if content and content.strip():
            self._drafts.append(content.strip())
        return SendResult(success=True, message_id=f"inbox:{job['update_id']}")

    async def edit_message(self, chat_id: str, message_id: str, content: str, *,
                           finalize: bool = False) -> SendResult:
        job = self._active_job
        if not job or message_id != f"inbox:{job['update_id']}":
            return SendResult(success=False, error="No matching inbox draft")
        chat = (job.get("update") or {}).get("message", {}).get("chat", {})
        if str(chat.get("id")) != str(chat_id):
            return SendResult(success=False, error="No matching inbox chat")
        if self._drafts:
            self._drafts[-1] = content.strip()
        elif content.strip():
            self._drafts.append(content.strip())
        return SendResult(success=True, message_id=message_id)

    async def get_chat_info(self, chat_id: str) -> dict:
        job = self._active_job or {}
        chat = (job.get("update") or {}).get("message", {}).get("chat", {})
        if str(chat.get("id")) != str(chat_id):
            raise ValueError("Unknown chat")
        return {"name": chat.get("first_name") or str(chat_id), "type": "dm"}
