"""Transporte Telegram v2 no PostgreSQL descartável, sem Bot API nem Supabase real."""

import asyncio
import importlib.util
import os
from pathlib import Path
import shutil
import sys
import tempfile
from types import SimpleNamespace

import pytest
from psycopg import errors as E
from psycopg.types.json import Jsonb

from integral import banco_integral


@pytest.fixture()
def integral(servidor):
    with banco_integral(servidor) as banco:
        yield banco


def update(numero=101, texto="/pedido Organizar lançamento", chat=123456789):
    return {"update_id": numero, "message": {"message_id": numero + 100,
            "chat": {"id": chat, "type": "private"},
            "from": {"id": chat, "is_bot": False}, "text": texto}}


def registrar(con, value):
    return con.execute("select helena_v2.registrar_update_telegram(%s)",
                       (Jsonb(value),)).fetchone()[0]


def vincular(integral, chat=123456789, numero=10):
    with integral.conectar("authenticated") as founder:
        codigo = founder.execute("select helena_v2.gerar_pareamento_telegram()").fetchone()[0]["codigo"]
    with integral.conectar("service_role") as service:
        result = registrar(service, update(numero, "/vincular " + codigo, chat))
        assert result["tipo"] == "VINCULAR"
    return codigo


def test_link_receipt_replay_atomic_order_and_worker_acl(integral):
    codigo = vincular(integral)
    with integral.conectar() as owner:
        raw, digest = owner.execute(
            "select bruto,bruto_hash from helena_v2.telegram_inbox where update_id=10").fetchone()
        assert codigo not in str(raw)
        assert raw["message"]["text"] == "/vincular [redigido]"
        assert len(digest) == 32
    with integral.conectar("service_role") as service:
        assert registrar(service, update(10, "/vincular " + codigo))["novo"] is False
        with pytest.raises(E.UniqueViolation, match="TELEGRAM_UPDATE_DIVERGENTE"):
            registrar(service, update(10, "/vincular " + "0" * 48))
        link_out = service.execute("select helena_v2.reivindicar_saida_telegram()").fetchone()[0]
        assert link_out["chat_id"] == "123456789"
        service.execute("select helena_v2.concluir_saida_telegram(%s,%s,%s)",
                        (link_out["id"], link_out["lease_token"], 501))
        first = registrar(service, update())
        assert first["tipo"] == "PEDIDO" and first["request_id"]
        replay = registrar(service, update())
        assert replay == {**first, "novo": False}
        with pytest.raises(E.UniqueViolation, match="TELEGRAM_UPDATE_DIVERGENTE"):
            registrar(service, update(texto="/pedido Outra coisa"))
        receipt = service.execute("select helena_v2.reivindicar_saida_telegram()").fetchone()[0]
        assert first["request_id"] in receipt["texto"]
        job = service.execute("select helena_v2.reivindicar_trabalho_telegram()").fetchone()[0]
        assert job["update_id"] == "101" and job["request_id"] == first["request_id"]
        assert job["update"] == update()
        renewed = service.execute("select helena_v2.renovar_trabalho_telegram(%s,%s)",
                                  (101, job["lease_token"])).fetchone()[0]
        assert renewed["ok"] is True
        completed = service.execute("select helena_v2.concluir_trabalho_telegram(%s,%s,%s,%s)",
                                    (101, job["lease_token"], "Plano para revisão", Jsonb({"rascunho": True}))).fetchone()[0]
        assert completed["ok"] is True
        assert service.execute("select helena_v2.reivindicar_saida_telegram()").fetchone()[0] == {}
        service.execute("select helena_v2.concluir_saida_telegram(%s,%s,%s)",
                        (receipt["id"], receipt["lease_token"], 502))
        response = service.execute("select helena_v2.reivindicar_saida_telegram()").fetchone()[0]
        assert response["texto"] == "Plano para revisão"
        service.execute("select helena_v2.reagendar_saida_telegram(%s,%s)",
                        (response["id"], response["lease_token"]))
    with integral.conectar() as owner:
        assert owner.execute("select count(*) from helena_v2.pedido_entrada_evento where origem='TELEGRAM'").fetchone()[0] == 1
    with integral.conectar("authenticated") as founder:
        with pytest.raises(E.InsufficientPrivilege):
            registrar(founder, update(999))
        with pytest.raises(E.InsufficientPrivilege):
            founder.execute("select helena_v2.reivindicar_trabalho_telegram()")


def test_media_callback_durable_without_fake_read_and_revocation_epoch(integral):
    vincular(integral)
    media = update(200, "")
    del media["message"]["text"]
    media["message"]["photo"] = [{"file_id": "opaque-test-id"}]
    callback = {"update_id": 201, "callback_query": {"id": "callback-1", "data": "approve"}}
    with integral.conectar("service_role") as service:
        result = registrar(service, media)
        assert result["tipo"] == "MIDIA" and result.get("request_id") is None
        assert registrar(service, callback)["tipo"] == "CALLBACK"
        job = service.execute("select helena_v2.reivindicar_trabalho_telegram()").fetchone()[0]
        assert job["tipo"] == "MIDIA"
    with integral.conectar() as owner:
        assert owner.execute("select bruto from helena_v2.telegram_inbox where update_id=200").fetchone()[0] == media
        assert owner.execute("select bruto from helena_v2.telegram_inbox where update_id=201").fetchone()[0] == callback
        assert owner.execute("select count(*) from helena_v2.pedido_entrada_evento where origem='TELEGRAM'").fetchone()[0] == 0
    with integral.conectar("authenticated") as founder:
        founder.execute("select helena_v2.revogar_pareamento_telegram()")
    vincular(integral, numero=300)
    with integral.conectar("service_role") as service:
        with pytest.raises(E.InsufficientPrivilege, match="TELEGRAM_VINCULO_REVOGADO"):
            service.execute("select helena_v2.concluir_trabalho_telegram(%s,%s,%s,%s)",
                            (200, job["lease_token"], "Mensagem indevida", None))
        # The old receipt/job cannot be resurrected by pairing the same chat.
        claimed = service.execute("select helena_v2.reivindicar_saida_telegram()").fetchone()[0]
        assert claimed["update_id"] == "300"


def test_invalid_link_text_is_redacted_without_revealing_code(integral):
    secret = "b" * 48
    with integral.conectar("service_role") as service:
        result = registrar(service, update(400, "/vincular " + secret))
        assert result["tipo"] == "IGNORADO"
        assert service.execute("select helena_v2.reivindicar_saida_telegram()").fetchone()[0] == {}
    with integral.conectar() as owner:
        raw = owner.execute("select bruto from helena_v2.telegram_inbox where update_id=400").fetchone()[0]
        assert secret not in str(raw)


def test_nested_link_codes_and_pedido_text_are_redacted_before_any_persistence(integral):
    vincular(integral)
    secret = "a" * 48
    payload = update(410, "/pedido Organizar campanha /vincular " + secret)
    payload["message"]["reply_to_message"] = {"text": "citação /vincular " + secret}
    payload["message"]["pinned_message"] = {"caption": "fixado /vincular " + secret}
    payload["extra"] = [{"nested": ["/vincular " + secret, "texto normal"]}]
    callback = {"update_id": 411, "callback_query": {
        "id": "teste", "message": {"text": "/vincular " + secret}}}
    edited = {"update_id": 412, "edited_message": {"text": "/vincular " + secret}}
    with integral.conectar("service_role") as service:
        assert registrar(service, payload)["tipo"] == "PEDIDO"
        assert registrar(service, callback)["tipo"] == "CALLBACK"
        assert registrar(service, edited)["tipo"] == "IGNORADO"
        assert registrar(service, payload)["novo"] is False
        changed = update(410, "/pedido Organizar campanha /vincular " + "c" * 48)
        with pytest.raises(E.UniqueViolation, match="TELEGRAM_UPDATE_DIVERGENTE"):
            registrar(service, changed)
    with integral.conectar() as owner:
        rows = owner.execute("select update_id, bruto from helena_v2.telegram_inbox "
                             "where update_id between 410 and 412 order by update_id").fetchall()
        assert len(rows) == 3
        assert all(secret not in str(raw) for _, raw in rows)
        assert rows[0][1]["message"]["text"] == "/pedido Organizar campanha /vincular [redigido]"
        assert rows[0][1]["extra"][0]["nested"][1] == "texto normal"
        texto_0022 = owner.execute(
            "select texto from helena_v2.telegram_update_recebido where update_id=410"
        ).fetchone()[0]
        assert texto_0022 == "Organizar campanha /vincular [redigido]"
        assert secret not in str(owner.execute(
            "select * from helena_v2.pedido_entrada_evento where origem='TELEGRAM'"
        ).fetchall())


def test_inbox_to_real_hermes_dispatcher_to_outbox_synthetic(integral):
    """One local trajectory through SQL, Hermes Base dispatch and durable outbox."""
    source = Path(os.environ.get("HERMES_015_SOURCE", "/tmp/helena-hermes-015-source"))
    if not (source / "gateway/run.py").exists():
        pytest.skip("pinned Hermes source unavailable")
    patch_file = Path(__file__).resolve().parents[3] / "motor/hermes-vps/telegram-v2/patch-hermes-telegram.py"
    spec = importlib.util.spec_from_file_location("hpatch_test_31", patch_file)
    patcher = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(patcher)
    vincular(integral)
    with tempfile.TemporaryDirectory(prefix="helena-v2-e2e-") as temporary:
        tree = Path(temporary)
        shutil.copytree(source / "gateway", tree / "gateway")
        patcher.patch_tree(tree, apply=True, require_git=False)
        sys.path.insert(0, str(tree))
        sys.path.insert(1, str(source))
        previous = {name: os.environ.get(name) for name in (
            "HELENA_V2_TELEGRAM_MODE", "HELENA_V2_TELEGRAM_BROKER_URL",
            "HELENA_V2_TELEGRAM_WORKER_SECRET")}
        os.environ["HELENA_V2_TELEGRAM_MODE"] = "inbox-worker"
        os.environ["HELENA_V2_TELEGRAM_BROKER_URL"] = (
            "https://wxkgrykduqtsgmjkzlou.supabase.co/functions/v1/helena-v2-telegram")
        os.environ["HELENA_V2_TELEGRAM_WORKER_SECRET"] = "synthetic_worker_secret_32_characters_long"
        try:
            from gateway.run import GatewayRunner
            from gateway.config import Platform, PlatformConfig

            with integral.conectar("service_role") as service:
                registrar(service, update(501, "Olá, Hermes"))
                job = service.execute("select helena_v2.reivindicar_trabalho_telegram()").fetchone()[0]
                runner = object.__new__(GatewayRunner)
                runner.config = SimpleNamespace(group_sessions_per_user=True,
                                                thread_sessions_per_user=False)
                adapter = runner._create_adapter(Platform.TELEGRAM,
                                                 PlatformConfig(enabled=True, token=None))
                received = []

                async def fake_model(event):
                    received.append(event)
                    return "Resposta local do Hermes"

                async def edge_scoped(path, payload=None):
                    if path == "/worker/complete":
                        service.execute("select helena_v2.concluir_trabalho_telegram(%s,%s,%s,%s)",
                                        (int(payload["update_id"]), payload["lease_token"],
                                         payload["resposta"], None))
                    elif path == "/worker/renew":
                        service.execute("select helena_v2.renovar_trabalho_telegram(%s,%s)",
                                        (int(payload["update_id"]), payload["lease_token"]))
                    else:
                        raise AssertionError("Unexpected worker operation")
                    return {"ok": True}

                adapter.set_message_handler(fake_model)
                adapter._post = edge_scoped
                asyncio.run(adapter._dispatch_job(job))
                assert len(received) == 1
                assert received[0].source.platform == Platform.TELEGRAM
                assert received[0].source.chat_id == "123456789"
                first = service.execute("select helena_v2.reivindicar_saida_telegram()").fetchone()[0]
                assert first["update_id"] == "10" and "Vínculo" in first["texto"]
                service.execute("select helena_v2.concluir_saida_telegram(%s,%s,%s)",
                                (first["id"], first["lease_token"], 800))
                response = service.execute("select helena_v2.reivindicar_saida_telegram()").fetchone()[0]
                assert response["update_id"] == "501"
                assert response["chat_id"] == "123456789"
                assert response["texto"] == "Resposta local do Hermes"
        finally:
            for name, value in previous.items():
                if value is None:
                    os.environ.pop(name, None)
                else:
                    os.environ[name] = value
            sys.path.remove(str(tree))
            sys.path.remove(str(source))
