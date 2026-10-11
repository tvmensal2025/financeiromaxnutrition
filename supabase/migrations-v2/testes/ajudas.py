# -*- coding: utf-8 -*-
"""Ajudas dos testes: leva uma jornada (a mesma do provar.replay) para a função única do banco.

O QUE É: o `Mundo` cria o card no banco a partir do roteiro da jornada, manda cada evento para
helena_v2.aplicar_evento (traduzindo "chave atual/antiga" e "versão vista atual/antiga" para os números
de verdade do banco) e tira uma fotografia do card, comparável à do provar.replay.

DE ONDE VEM: espelha o que provar.replay faz em `um_evento` (preencher parâmetros e ator, achar o alvo).
Nenhuma regra mora aqui: quem decide é o banco.

COMO MUDAR: se o formato da jornada mudar (jornada.schema.json), ajuste só `evento`.
"""
import sys
from datetime import datetime, timedelta, timezone
from pathlib import Path

from psycopg.rows import dict_row
from psycopg.types.json import Jsonb

RAIZ = Path(__file__).resolve().parents[3]
sys.path.insert(0, str(RAIZ / "helena-v2" / "maquina"))
import provar as P  # noqa: E402

AGORA = datetime(2026, 10, 11, 12, 0, tzinfo=timezone.utc)
PRAZO_DO_CARD = AGORA + timedelta(days=7)


def carregar_yaml():
    return P.carregar()


def roteiro_da_jornada(jornada):
    return jornada.get("roteiro") or P.ROTEIRO_DE_PROVA


class Mundo:
    """Um card no banco, dirigido como o provar.replay dirige o dele."""

    def __init__(self, con, jornada, vocab=None, tabela=None, canal=None, numero=None):
        self.con = con
        self.vocab, self.tabela = (vocab, tabela) if vocab is not None else carregar_yaml()
        self.jornada = jornada
        self.roteiro = roteiro_da_jornada(jornada)
        self.perfis = {p["id"]: p for p in P.perfis_do_roteiro(self.roteiro, self.tabela, self.vocab)}
        self.me = P.montar(self.vocab, self.tabela)["etapa"]
        cfg = jornada.get("card") or {}
        self.auto = bool(jornada.get("automatico", True))
        self.nao_disparar = [] if bool(cfg.get("plano_valido", True)) else ["PLANO_VALIDO"]
        numero = numero or f"{jornada.get('id', 'j')}-{id(self)}-{datetime.now().timestamp()}"
        self.card = self.criar(canal or "teste", numero, bool(cfg.get("pedido_grande", True)))
        if self.auto:
            self.chamar("select helena_v2.disparar_automaticos(%s, %s)", (self.card, self.nao_disparar))
        self.contador_prazo = 0

    # ------------------------------------------------------------------ chamadas
    def chamar(self, comando, args=()):
        return self.con.execute(comando, args).fetchone()[0]

    def linhas(self, comando, args=()):
        with self.con.cursor(row_factory=dict_row) as cur:
            cur.execute(comando, args)
            return cur.fetchall()

    def criar(self, canal, numero, pedido_grande):
        r = self.chamar("select helena_v2.criar_card(%s, %s, %s, %s, %s, %s, %s, %s, %s, %s)",
                        (canal, numero, "mensagem de teste", "card de teste", PRAZO_DO_CARD, Jsonb(self.roteiro), "eLiving™",
                         Jsonb({}), 0, pedido_grande))
        return r["card_id"]

    # ------------------------------------------------------------------ alvos
    def etapa_id(self, codigo):
        return self.chamar("select id from helena_v2.etapa where card_id = %s and codigo = %s and atual", (self.card, codigo))

    def acao_id(self, codigo):
        return self.chamar("select id from helena_v2.acao_externa where card_id = %s and codigo = %s", (self.card, codigo))

    def maquina_do_alvo(self, alvo):
        if alvo == "card":
            return "card", self.card
        if alvo in self.perfis:
            return "etapa", self.etapa_id(alvo)
        achou = self.linhas("select id from helena_v2.acao_externa where card_id = %s and codigo = %s", (self.card, alvo))
        if achou:
            return "acao_externa", achou[0]["id"]
        return None, None

    def versao_do_alvo(self, maquina, alvo_id):
        return self.chamar(f"select versao from helena_v2.{maquina} where id = %s", (alvo_id,))

    # ------------------------------------------------------------------ parâmetros (espelha replay.params_de)
    def params_de(self, papel, evento, dados, i_etapa):
        dom = self.me.parametros.get((papel, evento), {})
        p = dict(dados or {})
        for nome, valores in dom.items():
            if nome in p:
                continue
            if evento == "PORTAO1_OK" and nome == "escolhido" and i_etapa is not None:
                p[nome] = self.perfis[i_etapa]["revisores_validos"][0]
            elif evento in ("RESPONDER", "RECOMENDAR"):
                return None
            else:
                p[nome] = valores[0]
        return p

    # ------------------------------------------------------------------ um evento
    def evento(self, e, nao_disparar=None):
        """Manda um evento da jornada ao banco. Devolve o dicionário de resposta, ou None se o replay também não o mandaria."""
        papel, evento, alvo = e["papel"], e["evento"], e.get("alvo", "card")
        if alvo.startswith("acao:"):
            alvo = alvo[5:]
        if evento not in (self.vocab["acoes"].get(papel) or {}):
            return None
        i_etapa = alvo if alvo in self.perfis else None
        params = self.params_de(papel, evento, e.get("params"), i_etapa)
        if params is None:
            return None
        maquina, alvo_id = self.maquina_do_alvo(alvo)
        if maquina is None:
            return None
        ator = e.get("ator")
        if ator is None and i_etapa:
            if papel == "AUTOR":
                ator = self.perfis[i_etapa]["autor"]
            elif papel == "REVISOR":
                ator = self.chamar("select revisor from helena_v2.etapa where id = %s", (alvo_id,))
        chave, versao_vista, conteudo = None, None, None
        if papel == "FUNDADOR":
            v = self.versao_do_alvo(maquina, alvo_id)
            versao_vista = v if e.get("versao_vista", "atual") == "atual" else v - 1
            if evento == "MUDAR_PRAZO":
                self.contador_prazo += 1
                conteudo = {"prazo": (AGORA + timedelta(days=7 + self.contador_prazo)).isoformat()}
            elif evento == "MUDAR_PRIORIDADE":
                conteudo = {"prioridade": self.contador_prazo + 1}
        elif papel in ("AUTOR", "REVISOR") and maquina == "etapa":
            atual = self.chamar("select execucao_atual from helena_v2.etapa where id = %s", (alvo_id,))
            chave = (atual if atual is not None else 0) if e.get("chave", "atual") == "atual" else (atual if atual is not None else 0) - 1
        elif papel == "HELENA" and maquina in ("card", "etapa"):
            n = self.chamar("select helena_v2.abrir_chamada_helena(%s, %s)", (maquina, alvo_id))
            if e.get("chave", "atual") != "atual":
                self.chamar("select helena_v2.abrir_chamada_helena(%s, %s)", (maquina, alvo_id))
            chave = n
        if evento == "ENTREGAR":
            conteudo = {"resposta": "texto de teste"}
        r = self.chamar("select helena_v2.aplicar_evento(%s, %s, %s, %s, %s, %s, %s, %s, %s, null, %s, %s)",
                        (maquina, alvo_id, papel, evento, Jsonb(params), ator, chave, versao_vista,
                         Jsonb(conteudo) if conteudo is not None else None, self.auto,
                         self.nao_disparar if nao_disparar is None else nao_disparar))
        return r

    # ------------------------------------------------------------------ atalhos para montar situações nos testes das regras
    def passos(self, lista):
        """Cada item: (papel, evento, alvo) ou (papel, evento, alvo, params) ou (papel, evento, alvo, params, extras)."""
        saidas = []
        for t in lista:
            e = {"papel": t[0], "evento": t[1], "alvo": t[2]}
            if len(t) > 3 and t[3]:
                e["params"] = t[3]
            if len(t) > 4:
                e.update(t[4])
            saidas.append(self.evento(e))
        return saidas

    def um(self, papel, evento, alvo="card", params=None, **extras):
        return self.passos([(papel, evento, alvo, params, extras)])[0]

    def em_andamento(self):
        """Pedido pequeno: leitura de volta e plano válido. O card fica EM_ANDAMENTO e as etapas esperando as anteriores."""
        return self.passos([("HELENA", "LER_DE_VOLTA", "card"), ("MOTOR", "PLANO_VALIDO", "card")])

    def executando(self, e="E1"):
        return self.passos([("MOTOR", "DEPENDENCIAS_PRONTAS", e), ("MOTOR", "INICIAR_EXECUCAO", e)])

    def entregar(self, e="E1", acao="NENHUMA", parecer="OK"):
        return self.um("AUTOR", "ENTREGAR", e, {"parecer": parecer, "acao_externa": acao, "usou_internet": "NAO"})

    def revisao(self, e="E1", revisor=None):
        revisor = revisor or self.perfis[e]["revisores_validos"][0]
        return self.passos([("MOTOR", "PORTAO1_OK", e, {"escolhido": revisor}), ("MOTOR", "INICIAR_REVISAO", e)])

    def aprovar(self, e="E1"):
        return self.um("REVISOR", "APROVAR", e)

    def ate_aprovada(self, e="E1", acao="NENHUMA"):
        self.executando(e)
        self.entregar(e, acao)
        self.revisao(e)
        return self.aprovar(e)

    def estado_da(self, alvo="card"):
        if alvo == "card":
            return self.chamar("select estado from helena_v2.card where id = %s", (self.card,))
        return self.chamar("select estado from helena_v2.etapa where card_id = %s and codigo = %s and atual", (self.card, alvo))

    def linha_da_etapa(self, e="E1"):
        return self.linhas("select * from helena_v2.etapa where card_id = %s and codigo = %s and atual", (self.card, e))[0]

    def rodar(self, jornada=None):
        """Roda todos os eventos da jornada. Devolve a lista de respostas (uma por evento mandado)."""
        respostas = []
        for e in (jornada or self.jornada)["eventos"]:
            respostas.append(self.evento(e))
        return respostas

    # ------------------------------------------------------------------ fotografia
    def foto(self):
        """O card no banco, no formato da fotografia do provar.replay (sem os contadores compartilhados repetidos na etapa)."""
        compart = {r["nome"] for r in self.linhas("select nome from helena_v2.variavel where maquina = 'card' and compartilhada")}
        vars_ = {m: [r["nome"] for r in self.linhas("select nome from helena_v2.variavel where maquina = %s order by ordem", (m,))]
                 for m in ("card", "etapa", "acao_externa")}
        c = self.linhas("select * from helena_v2.card where id = %s", (self.card,))[0]
        foto = {"card": {"estado": c["estado"], **{k: c[k] for k in vars_["card"]}}, "etapas": {}, "acoes": {}}
        pulas = []
        for e in self.linhas("select e.*, helena_v2.situacao_efetiva(e) as situacao from helena_v2.etapa e "
                             "where card_id = %s and atual order by ordem", (self.card,)):
            foto["etapas"][e["codigo"]] = {
                "estado": e["estado"], **{k: e[k] for k in vars_["etapa"] if k not in compart},
                "versao": e["geracao"] - 1, "situacao": e["situacao"],
                "respostas_guardadas": list(e["respostas_guardadas"]), "respostas_da_versao": list(e["respostas_da_versao"])}
            if e["pulada"]:
                pulas.append(e["codigo"])
        foto["puladas"] = sorted(pulas)
        for a in self.linhas("select * from helena_v2.acao_externa where card_id = %s order by substring(codigo from 2)::int", (self.card,)):
            foto["acoes"][a["codigo"]] = {"estado": a["estado"], **{k: a[k] for k in vars_["acao_externa"]},
                                          "tem_ferramenta": a["tem_ferramenta"], "origem": a["etapa_codigo"], "tipo": a["tipo"]}
        foto["cards_ligados"] = self.chamar("select count(*) from helena_v2.card where card_pai_id = %s", (self.card,))
        return foto


def foto_do_replay(resultado, mundo_compart):
    """A fotografia do provar.replay, sem os contadores compartilhados que ficam velhos dentro de cada etapa."""
    f = resultado["final"]
    etapas = {i: {k: v for k, v in d.items() if k not in mundo_compart} for i, d in f["etapas"].items()}
    return {"card": dict(f["card"]), "etapas": etapas, "puladas": list(f["puladas"]),
            "acoes": {a: dict(d) for a, d in f["acoes"].items()}, "cards_ligados": f["cards_ligados"]}


def comparar(foto_py, foto_db):
    """Lista de diferenças entre as duas fotografias (vazia = iguais)."""
    difs = []

    def cmp(onde, a, b):
        if isinstance(a, dict) and isinstance(b, dict):
            for k in sorted(set(a) | set(b)):
                cmp(f"{onde}.{k}", a.get(k, "<falta>"), b.get(k, "<falta>"))
        elif a != b:
            difs.append(f"{onde}: provar={a!r} banco={b!r}")

    cmp("foto", foto_py, foto_db)
    return difs


def destino_do_replay(resultado, indice):
    """Como o provar.replay tratou o evento de número `indice`: APLICADO, CONVERTIDO, REACAO, RECUSADO ou o destino do toque."""
    for r in resultado["recusados"]:
        if r["indice"] == indice:
            d = r["destino"]
            return "RECUSADO" if d.startswith("recusado") else d
    if any(r["indice"] == indice for r in resultado["reacoes"]):
        return "REACAO"
    if any(r["indice"] == indice for r in resultado["conversoes"]):
        return "CONVERTIDO"
    return "APLICADO"


class ReplayRapido:
    """Faz o provar.replay rodar em ~2 ms em vez de ~40 ms: guarda as máquinas montadas e valida o esquema da jornada uma vez só
    (o teste valida a sequência inteira contra jornada.schema.json no fim). Não muda nenhuma regra do provar."""

    def __enter__(self):
        self._montar, self._schema = P.montar, P._schema_jornada
        cache = {}
        original = self._montar

        def montar_com_cache(v, t):
            k = (id(v), id(t))
            if k not in cache:
                cache[k] = original(v, t)
            return cache[k]

        P.montar = montar_com_cache
        P._schema_jornada = lambda: {}
        return self

    def __exit__(self, *a):
        P.montar, P._schema_jornada = self._montar, self._schema
