#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Gerador do SQL das passagens da v2 (banco local).

O QUE É: lê a tabela de passagens (helena-v2/maquina/passagens.yaml) e o vocabulário
(helena-v2/maquina/vocabulario.yaml) e escreve o arquivo 0002_passagens_geradas.sql: as
tabelas de regras, os tetos, as colunas dos contadores, as guardas traduzidas para SQL, os
efeitos, as ligações entre máquinas, os automáticos e a impressão digital da tabela.

DE ONDE VEM: a lógica da máquina é a de provar.py (Maquina, montar, impressao_digital). Este
script importa provar.py e usa as mesmas linhas, os mesmos efeitos e a mesma impressão digital.
Nada da tabela é copiado à mão para o banco.

COMO MUDAR: nunca edite o 0002 à mão. Mudou o YAML? Rode

    python gerar_passagens.py            # reescreve o 0002
    python gerar_passagens.py --conferir # só confere (sai com erro se o arquivo guardado estiver velho)

O teste testes/test_02_gerador.py falha se o SQL guardado no git for diferente do que este
script produz hoje. Se o YAML ganhar uma coisa que o banco ainda não sabe fazer, este script
PARA com uma mensagem clara (ErroDoGerador) em vez de gerar um banco pela metade.

As guardas são expressões Python restritas. Aqui elas são traduzidas para SQL com o módulo
ast. Não existe eval no banco: cada guarda vira um ramo de CASE na função helena_v2.guarda.
"""
import argparse
import ast
import json
import re
import sys
from pathlib import Path

AQUI = Path(__file__).resolve().parent
RAIZ = AQUI.parents[1]
PASTA_MAQUINA = RAIZ / "helena-v2" / "maquina"
if str(PASTA_MAQUINA) not in sys.path:
    sys.path.insert(0, str(PASTA_MAQUINA))

import provar as P  # noqa: E402  (a especificação executável da máquina)

ARQUIVO_SQL = AQUI / "0002_passagens_geradas.sql"
ESQUEMA = "helena_v2"
TABELA_DA_MAQUINA = {"card": "card", "etapa": "etapa", "acao_externa": "acao_externa"}

# ----------------------------------------------------------------------------- o que o banco sabe fazer
# Nomes que o YAML pode usar e que têm um comportamento escrito em código SQL (0003_funcao_unica.sql).
# Se o YAML trouxer um nome fora destas listas o gerador para: alguém precisa ensinar o banco.
ACOES_NO_CARD = {"marcar_falhas_como_puladas", "nova_versao_das_falhas", "criar_acao_externa", "criar_card_ligado"}
ALVOS_DE_SINAL = {"etapas_abertas", "acoes_abertas", "etapas_aprovadas", "etapas_abertas_que_usam_decisao",
                  "dependentes_diretos_abertos", "julgadas_abertas", "julgadas_de_nao_pode", "card"}
PREDICADOS_IMPLEMENTADOS = {"etapa": {"revisor_valido", "anteriores_satisfeitas"},
                            "card": {"todas_prontas", "falha_sem_decisao", "nao_pode_sem_decisao", "falhas_pulaveis"},
                            "acao_externa": set()}
# A ficha de cada máquina que criar_card e a ação externa preenchem (provar.CONFIG_NOMES precisa dizer o mesmo).
CONFIG_QUE_O_BANCO_PREENCHE = {
    "etapa": {"tem_internet", "julgadora", "julgada", "pulavel", "permite_perguntar", "permite_devolver", "usa_decisao", "prazo_de_terceiro"},
    "card": {"pedido_grande"}, "acao_externa": {"tem_ferramenta"}}
# Eventos e variáveis com significado fixo na função única (o YAML tem de continuar tendo todos).
EVENTOS_COM_SIGNIFICADO = [("AUTOR", "ENTREGAR"), ("MOTOR", "INICIAR_EXECUCAO"), ("MOTOR", "INICIAR_REVISAO"),
                           ("MOTOR", "PORTAO1_OK"), ("MOTOR", "PORTAO1_RECUSOU"), ("MOTOR", "FALHA")]
VARIAVEIS_COM_SIGNIFICADO = {"etapa": ["exec_viva", "revisor", "semaforo", "fim", "motivo"],
                             "card": ["fim", "motivo"], "acao_externa": ["ok_registrado", "tentativas", "fim"]}
# Fica velha a entrega quando chega um destes eventos (P.EVENTOS_QUE_ENVELHECEM) ou o seu pedido de ajuste.
TOQUES_QUE_ENVELHECEM = [("FUNDADOR", "PEDIR_AJUSTE")]
# Prazos que vêm da ficha do agente: o nome do prazo no YAML -> a chave no roteiro da etapa.
CAMPO_DA_FICHA = {"tempo_maximo_da_ficha": "tempo_maximo_s", "prazo_da_revisao": "prazo_revisao_s"}


class ErroDoGerador(Exception):
    pass


# ----------------------------------------------------------------------------- literais SQL
def texto(s):
    return "'" + str(s).replace("'", "''") + "'"


def valor(v):
    if v is None:
        return "null"
    if isinstance(v, bool):
        return "true" if v else "false"
    if isinstance(v, int):
        return str(v)
    if isinstance(v, str):
        return texto(v)
    raise ErroDoGerador(f"valor sem tradução para SQL: {v!r}")


def lista(itens):
    itens = list(itens)
    if not itens:
        return "'{}'::text[]"
    return "array[" + ", ".join(texto(x) for x in itens) + "]::text[]"


def json_sql(obj):
    return texto(json.dumps(obj, sort_keys=True, ensure_ascii=False, separators=(",", ":"))) + "::jsonb"


def insere(tabela, colunas, linhas):
    if not linhas:
        return f"-- (sem linhas para {tabela})\n"
    corpo = ",\n".join("  (" + ", ".join(l) + ")" for l in linhas)
    return f"insert into {ESQUEMA}.{tabela} ({', '.join(colunas)}) values\n{corpo};\n"


# ----------------------------------------------------------------------------- guardas: Python restrito -> SQL
class TradutorDeGuarda:
    """Traduz a guarda (expressão Python restrita) para uma expressão SQL.

    v = jsonb com o estado da máquina (variáveis); q = jsonb com a configuração da ficha, os
    predicados calculados pelo banco e os parâmetros do evento. Mesmo critério de nomes de
    provar.compilar_expr: primeiro variável, depois teto, depois nome de q."""

    OPS = {ast.Eq: "=", ast.NotEq: "<>", ast.Lt: "<", ast.LtE: "<=", ast.Gt: ">", ast.GtE: ">="}

    def __init__(self, maq, bools, textos, onde):
        self.maq, self.bools, self.textos, self.onde = maq, set(bools), set(textos), onde

    def traduzir(self, fonte):
        try:
            arv = ast.parse(fonte, mode="eval")
        except SyntaxError as e:
            raise ErroDoGerador(f"{self.onde}: guarda com erro de sintaxe {fonte!r} ({e})")
        for no in ast.walk(arv):
            if not isinstance(no, P._NOS):
                raise ErroDoGerador(f"{self.onde}: construção não permitida na guarda: {type(no).__name__}")
        return self._no(arv.body)

    def _no(self, no):
        if isinstance(no, ast.BoolOp):
            junta = " AND " if isinstance(no.op, ast.And) else " OR "
            return "(" + junta.join(self._no(v) for v in no.values) + ")"
        if isinstance(no, ast.UnaryOp):
            if isinstance(no.op, ast.Not):
                return f"(NOT {self._no(no.operand)})"
            return f"(-{self._no(no.operand)})"
        if isinstance(no, ast.Compare):
            if len(no.ops) != 1:
                raise ErroDoGerador(f"{self.onde}: comparação encadeada não é traduzida")
            op, esq, dir_ = no.ops[0], self._no(no.left), no.comparators[0]
            if isinstance(op, (ast.In, ast.NotIn)):
                if not isinstance(dir_, ast.Tuple):
                    raise ErroDoGerador(f"{self.onde}: 'in' só aceita uma lista entre parênteses")
                itens = ", ".join(self._no(x) for x in dir_.elts)
                return f"({esq} {'NOT IN' if isinstance(op, ast.NotIn) else 'IN'} ({itens}))"
            return f"({esq} {self.OPS[type(op)]} {self._no(dir_)})"
        if isinstance(no, ast.BinOp):
            sinal = "+" if isinstance(no.op, ast.Add) else "-"
            return f"({self._no(no.left)} {sinal} {self._no(no.right)})"
        if isinstance(no, ast.Constant):
            return valor(no.value)
        if isinstance(no, ast.Name):
            n = no.id
            if n in self.maq.idx:
                if n in self.maq.teto_var:
                    return f"(v->>'{n}')::integer"
                return f"(v->>'{n}')"
            if n in self.maq.tetos:
                return str(self.maq.tetos[n])
            if n in self.bools:
                return f"(q->>'{n}')::boolean"
            if n in self.textos:
                return f"(q->>'{n}')"
            raise ErroDoGerador(f"{self.onde}: nome desconhecido na guarda: {n}")
        raise ErroDoGerador(f"{self.onde}: construção sem tradução: {type(no).__name__}")


# ----------------------------------------------------------------------------- prazos
def classificar_prazo(nome, d):
    """De onde vem a hora do prazo de um estado. 'card' = o prazo do card (só o fundador muda);
    'duracao' = tempo fixo escrito no YAML (ex.: '15 min'); 'ficha' = vem da ficha do agente, no
    roteiro da etapa; 'espera' = quem chama diz, e na falta dele vale o prazo do card."""
    if d.get("tratado_em") == "card":
        return "card", None, None
    if nome in CAMPO_DA_FICHA:
        return "ficha", CAMPO_DA_FICHA[nome], None
    quanto = str(d.get("quanto", ""))
    achou = re.match(r"^\s*(?:até\s+)?(\d+)\s*(s|min|h)\b", quanto)
    if achou:
        n, un = int(achou.group(1)), achou.group(2)
        return "duracao", None, n * {"s": 1, "min": 60, "h": 3600}[un]
    if quanto.startswith("interna:"):
        return "espera", None, None
    raise ErroDoGerador(f"prazo {nome!r}: não sei de onde vem a hora ({quanto!r}). "
                        f"Escreva a duração no começo ('15 min'), ou ensine o gerador (CAMPO_DA_FICHA).")


# ----------------------------------------------------------------------------- conferências do gerador
def conferir_o_que_o_banco_sabe(vocab, tab, maqs):
    erros = []
    for papel, ev in EVENTOS_COM_SIGNIFICADO:
        if ev not in (vocab["acoes"].get(papel) or {}):
            erros.append(f"o evento {papel} {ev} sumiu do vocabulário e a função única depende dele")
    for nome, vs in VARIAVEIS_COM_SIGNIFICADO.items():
        for v in vs:
            if v not in maqs[nome].idx:
                erros.append(f"a variável {nome}.{v} sumiu e a função única depende dela")
    for nome in maqs:
        extra = (set(P.PREDICADOS_NOMES[nome]) - PREDICADOS_IMPLEMENTADOS[nome]) | (PREDICADOS_IMPLEMENTADOS[nome] - set(P.PREDICADOS_NOMES[nome]))
        if extra:
            erros.append(f"predicados de {nome} que o banco não calcula (ou calcula a mais): {sorted(extra)}")
        if set(P.CONFIG_NOMES[nome]) != CONFIG_QUE_O_BANCO_PREENCHE[nome]:
            erros.append(f"ficha de {nome}: o provar lê {sorted(P.CONFIG_NOMES[nome])} e o banco preenche {sorted(CONFIG_QUE_O_BANCO_PREENCHE[nome])}")
        choque = set(P.CONFIG_NOMES[nome]) & set(maqs[nome].idx)
        if choque:
            erros.append(f"{nome}: nome de configuração igual ao de variável: {sorted(choque)}")
    for nome, lig in tab.get("ligacoes", {}).items():
        if "no_card" in lig and lig["no_card"] not in ACOES_NO_CARD:
            erros.append(f"ligação {nome}: a ação no_card {lig['no_card']!r} não existe no banco")
        for a in lig.get("para") or []:
            if a not in ALVOS_DE_SINAL:
                erros.append(f"ligação {nome}: o alvo {a!r} não existe no banco")
    ids = {}
    for nome, m in maqs.items():
        for ln in m.linhas:
            base = ln.bruta["id"]
            if ids.setdefault(base, nome) != nome:
                erros.append(f"o id {base} aparece em duas máquinas")
            if any(not isinstance(s, str) for s in ln.bruta.get("sinais") or []):
                erros.append(f"{ln.id}: sinal condicional ainda não existe no banco")
    for r in tab.get("reacoes", []):
        if r["estados"] not in ("TODOS", "ABERTOS") and not isinstance(r["estados"], list):
            erros.append(f"reação {r['papel']}.{r['evento']}: forma de 'estados' desconhecida")
    if erros:
        raise ErroDoGerador("o YAML pede o que o banco ainda não sabe fazer:\n  - " + "\n  - ".join(erros))


# ----------------------------------------------------------------------------- geração
def _definicao_das_tabelas_de_regras():
    return f"""-- Tabelas de regras (preenchidas abaixo, só por este arquivo).
create table if not exists {ESQUEMA}.teto (
  nome text primary key,
  valor integer not null check (valor >= 1),
  por_que text not null
);
create table if not exists {ESQUEMA}.variavel (
  maquina text not null,
  nome text not null,
  ordem integer not null,
  tipo text not null check (tipo in ('inteiro', 'texto')),
  teto integer,
  dominio text[],
  inicial jsonb not null,
  compartilhada boolean not null default false,
  primary key (maquina, nome)
);
create table if not exists {ESQUEMA}.config_nome (
  maquina text not null,
  nome text not null,
  primary key (maquina, nome)
);
create table if not exists {ESQUEMA}.estado_def (
  maquina text not null,
  estado text not null,
  ordem integer not null,
  final boolean not null,
  inicial boolean not null,
  dono text,
  prazo text,
  nota text,
  primary key (maquina, estado)
);
create table if not exists {ESQUEMA}.prazo_def (
  nome text primary key,
  quanto text not null,
  papel text not null,
  evento text not null,
  tratado_em text,
  avisos text[] not null,
  origem text not null check (origem in ('card', 'duracao', 'ficha', 'espera')),
  campo_da_ficha text,
  segundos integer
);
create table if not exists {ESQUEMA}.macro (
  nome text primary key,
  efeitos jsonb not null
);
create table if not exists {ESQUEMA}.passagem (
  maquina text not null,
  linha_id text not null,
  base_id text not null,
  ordem integer not null,
  de text not null,
  evento text not null,
  papel text not null,
  guarda text,
  para text not null,
  efeitos jsonb not null,
  checa_param jsonb not null,
  sinais text[] not null,
  sobe_versao boolean not null,
  nota text,
  primary key (maquina, linha_id)
);
create index if not exists passagem_busca on {ESQUEMA}.passagem (maquina, de, evento, papel);
create table if not exists {ESQUEMA}.ligacao (
  nome text primary key,
  papel text,
  evento text,
  alvos text[] not null,
  no_card text,
  nota text
);
create table if not exists {ESQUEMA}.automatico (
  maquina text not null,
  ordem integer not null,
  evento text not null,
  primary key (maquina, ordem)
);
create table if not exists {ESQUEMA}.reacao (
  ordem integer primary key,
  papel text not null,
  evento text not null,
  maquina text not null,
  estados_tipo text not null check (estados_tipo in ('TODOS', 'ABERTOS', 'LISTA')),
  estados text[] not null,
  guarda_id text,
  guarda text,
  muda_campo text,
  abre_card_ligado boolean not null,
  efeito_fora text
);
create table if not exists {ESQUEMA}.regra_geral (
  chave text primary key,
  valor jsonb not null
);
create table if not exists {ESQUEMA}.vocab_evento (
  papel text not null,
  evento text not null,
  parametros jsonb not null,
  efeito text not null,
  desligado text,
  muda_campo text,
  primary key (papel, evento)
);
create table if not exists {ESQUEMA}.predicado_lista (
  nome text not null,
  situacao text not null,
  primary key (nome, situacao)
);
create table if not exists {ESQUEMA}.entrada (
  maquina text not null,
  evento text not null,
  primary key (maquina, evento)
);
create table if not exists {ESQUEMA}.identidade (
  nome text primary key,
  tipo text not null check (tipo in ('agente', 'fundador')),
  ordem integer not null
);
create table if not exists {ESQUEMA}.meta_tabela (
  id boolean primary key default true check (id),
  versao text not null,
  impressao_digital text not null,
  hash_das_linhas text,
  gerado_de text not null
);
"""


def _dados(vocab, tab, maqs, impressao):
    saida = []
    # --- tetos
    saida.append(insere("teto", ["nome", "valor", "por_que"],
                        [[texto(k), valor(int(v["valor"])), texto(v.get("por_que", ""))] for k, v in tab["tetos"].items()]))
    # --- variáveis e configuração
    linhas, cfg = [], []
    for nome, m in maqs.items():
        for i, var in enumerate(m.vars):
            tipo = "inteiro" if var in m.teto_var else "texto"
            inicial = m._inicial[m.idx[var]]
            linhas.append([texto(nome), texto(var), valor(i + 1), texto(tipo), valor(m.teto_var.get(var)),
                           lista(m.dominio[var]) if var in m.dominio else "null", json_sql(inicial),
                           valor(var in m.compartilhadas)])
        for c in P.CONFIG_NOMES[nome]:
            cfg.append([texto(nome), texto(c)])
    saida.append(insere("variavel", ["maquina", "nome", "ordem", "tipo", "teto", "dominio", "inicial", "compartilhada"], linhas))
    saida.append(insere("config_nome", ["maquina", "nome"], cfg))
    # --- estados
    linhas = []
    for nome, m in maqs.items():
        for i, (est, d) in enumerate(tab["estados"][nome].items()):
            d = d or {}
            final = est in m.finais
            linhas.append([texto(nome), texto(est), valor(i + 1), valor(final), valor(bool(d.get("inicial"))),
                           valor(d.get("dono")), valor(d.get("prazo")), valor(d.get("nota"))])
    saida.append(insere("estado_def", ["maquina", "estado", "ordem", "final", "inicial", "dono", "prazo", "nota"], linhas))
    # --- prazos
    linhas = []
    usados = {(d or {}).get("prazo") for nome in maqs for d in tab["estados"][nome].values()} - {None}
    for nome, d in tab["prazos"].items():
        origem, campo, segundos = classificar_prazo(nome, d)
        np_ = d["no_prazo"]
        linhas.append([texto(nome), texto(d["quanto"]), texto(np_["papel"]), texto(np_["evento"]), valor(d.get("tratado_em")),
                       lista(d.get("avisos") or []), texto(origem), valor(campo), valor(segundos)])
    for u in usados:
        if u not in tab["prazos"]:
            raise ErroDoGerador(f"estado com prazo desconhecido: {u}")
    saida.append(insere("prazo_def", ["nome", "quanto", "papel", "evento", "tratado_em", "avisos", "origem", "campo_da_ficha", "segundos"], linhas))
    # --- macros
    saida.append(insere("macro", ["nome", "efeitos"], [[texto(k), json_sql(v)] for k, v in tab.get("macros", {}).items()]))
    # --- passagens (as linhas expandidas, uma por estado de origem)
    linhas = []
    macros_usadas = {}
    for nome, m in maqs.items():
        for ordem, ln in enumerate(m.linhas):
            bruto = ln.bruta.get("efeito") or {}
            macro = bruto.get("_macro")
            ops = []
            for pos, tipo, val in ln.efeitos:
                var = m.vars[pos - 1]
                if tipo == "set":
                    ops.append({"v": var, "op": "set", "val": val})
                elif tipo == "add":
                    ops.append({"v": var, "op": "add", "n": val})
                else:
                    ops.append({"v": var, "op": "param", "p": val})
            checa = {p: sorted(dom) for p, dom in ln.checa_param}
            sinais = [s for s, _c in ln.sinais]
            sobe = _sobe_versao(nome, ln, macro, tab)
            linhas.append([texto(nome), texto(ln.id), texto(ln.bruta["id"]), valor(ordem + 1), texto(ln.de), texto(ln.evento),
                           texto(ln.papel), valor(ln.guarda_txt or None), texto(ln.para), json_sql(ops), json_sql(checa),
                           lista(sinais), valor(sobe), valor(ln.nota or None)])
    saida.append(insere("passagem", ["maquina", "linha_id", "base_id", "ordem", "de", "evento", "papel", "guarda", "para",
                                     "efeitos", "checa_param", "sinais", "sobe_versao", "nota"], linhas))
    # --- ligações
    linhas = []
    for nome, lig in tab.get("ligacoes", {}).items():
        ent = lig.get("entrega") or {}
        linhas.append([texto(nome), valor(ent.get("papel")), valor(ent.get("evento")), lista(lig.get("para") or []),
                       valor(lig.get("no_card")), valor(lig.get("nota"))])
    saida.append(insere("ligacao", ["nome", "papel", "evento", "alvos", "no_card", "nota"], linhas))
    # --- automáticos
    linhas = []
    for nome, evs in (tab.get("automaticos") or {}).items():
        for i, ev in enumerate(evs):
            linhas.append([texto(nome), valor(i + 1), texto(ev)])
    saida.append(insere("automatico", ["maquina", "ordem", "evento"], linhas))
    # --- reações
    linhas = []
    for i, r in enumerate(tab.get("reacoes", [])):
        est = r["estados"]
        tipo, lst = ("LISTA", est) if isinstance(est, list) else (est, [])
        gid = f"reacao_{i + 1}" if r.get("guarda") else None
        linhas.append([valor(i + 1), texto(r["papel"]), texto(r["evento"]), texto(r["maquina"]), texto(tipo), lista(lst), valor(gid),
                       valor(r.get("guarda")), valor(r.get("muda_campo")), valor(bool(r.get("abre_card_ligado"))), valor(r.get("efeito_fora"))])
    saida.append(insere("reacao", ["ordem", "papel", "evento", "maquina", "estados_tipo", "estados", "guarda_id", "guarda",
                                   "muda_campo", "abre_card_ligado", "efeito_fora"], linhas))
    # --- regras gerais (as do YAML, uma chave cada) e as constantes que a prova usa
    rg = dict(tab.get("regras_gerais", {}))
    rg["recusa_do_fundador"] = tab.get("recusa_do_fundador") or {}
    rg["designacao_de_revisor"] = tab.get("designacao_de_revisor") or {}
    rg["eventos_que_envelhecem"] = list(P.EVENTOS_QUE_ENVELHECEM)
    rg["toques_que_envelhecem"] = [{"papel": p, "evento": e} for p, e in TOQUES_QUE_ENVELHECEM]
    saida.append(insere("regra_geral", ["chave", "valor"], [[texto(k), json_sql(v)] for k, v in rg.items()]))
    # --- vocabulário dos eventos (parâmetros com domínio fechado)
    linhas = []
    me = maqs["etapa"]
    for papel, evs in vocab["acoes"].items():
        for ev, d in evs.items():
            d = d or {}
            params = {k: list(v) for k, v in me.parametros.get((papel, ev), {}).items()}
            linhas.append([texto(papel), texto(ev), json_sql(params), texto(d.get("efeito", "interno")),
                           valor(d.get("desligado")), valor(d.get("muda_campo"))])
    saida.append(insere("vocab_evento", ["papel", "evento", "parametros", "efeito", "desligado", "muda_campo"], linhas))
    # --- predicados (listas de situações), entradas e identidades
    linhas = [[texto(n), texto(s)] for n, ss in tab["predicados"].items() for s in ss]
    saida.append(insere("predicado_lista", ["nome", "situacao"], linhas))
    linhas = [[texto(n), texto(e)] for n, evs in tab.get("entradas", {}).items() for e in evs]
    saida.append(insere("entrada", ["maquina", "evento"], linhas))
    ids = vocab["identidades"]
    linhas = [[texto(a), texto("agente"), valor(i + 1)] for i, a in enumerate(ids["agentes"])]
    linhas.append([texto(ids["fundador"]), texto("fundador"), valor(len(ids["agentes"]) + 1)])
    saida.append(insere("identidade", ["nome", "tipo", "ordem"], linhas))
    # --- meta
    saida.append(insere("meta_tabela", ["id", "versao", "impressao_digital", "hash_das_linhas", "gerado_de"],
                        [["true", texto(tab["versao"]), texto(impressao), "null",
                          texto("helena-v2/maquina/passagens.yaml + vocabulario.yaml")]]))
    return saida


def _sobe_versao(maquina, ln, macro, tab):
    """Quando a 'versão vista' do alvo sobe (A-6, MEL-25): cada toque seu leva a versão que você viu.
    Etapa: a cada entrega, a cada rodada nova e quando ela passa a esperar você. Card: a cada pergunta nova
    (entrar num estado em que o dono é você). Ação: nasce com a versão 1 e não muda."""
    if maquina == "acao_externa":
        return False
    espera = (tab["estados"][maquina].get(ln.para) or {}).get("dono") == "FUNDADOR" and ln.para != ln.de
    if maquina == "etapa":
        return ln.evento == "ENTREGAR" or macro == "NOVA_RODADA" or espera
    return espera


def _colunas(vocab, tab, maqs):
    """Colunas dos contadores, da configuração e do estado de cada máquina, com os tetos e domínios."""
    saida = []
    agentes = vocab["identidades"]["agentes"]
    for nome, m in maqs.items():
        t = f"{ESQUEMA}.{TABELA_DA_MAQUINA[nome]}"
        saida.append(f"-- {nome}")
        est_inicial = m.estado_inicial
        ordem_estados = list(tab["estados"][nome])
        saida.append(f"alter table {t} alter column estado set default {texto(est_inicial)};")
        saida.append(f"alter table {t} drop constraint if exists ck_{nome}_estado;")
        saida.append(f"alter table {t} add constraint ck_{nome}_estado check (estado in ({', '.join(texto(e) for e in ordem_estados)}));")
        finais = sorted(m.finais)
        saida.append(f"alter table {t} drop constraint if exists ck_{nome}_regra01_dono_e_prazo;")
        saida.append(f"alter table {t} add constraint ck_{nome}_regra01_dono_e_prazo check "
                     f"(estado in ({', '.join(texto(e) for e in finais)}) or (dono is not null and prazo_ate is not null));")
        for c in P.CONFIG_NOMES[nome]:
            saida.append(f"alter table {t} add column if not exists {c} boolean not null default false;")
        for var in m.vars:
            if nome == "etapa" and var in m.compartilhadas:
                continue   # contador do card: a etapa lê e grava o do card
            ini = m._inicial[m.idx[var]]
            saida.append(f"alter table {t} drop constraint if exists ck_{nome}_{var};")
            if var in m.teto_var:
                saida.append(f"alter table {t} add column if not exists {var} integer not null default {ini};")
                saida.append(f"alter table {t} add constraint ck_{nome}_{var} check ({var} between 0 and {m.teto_var[var]});")
            else:
                saida.append(f"alter table {t} add column if not exists {var} text not null default {texto(ini)};")
                saida.append(f"alter table {t} add constraint ck_{nome}_{var} check ({var} in ({', '.join(texto(x) for x in m.dominio[var])}));")
        if nome == "etapa":
            saida.append(f"alter table {t} drop constraint if exists ck_etapa_autor;")
            saida.append(f"alter table {t} add constraint ck_etapa_autor check (autor in ({', '.join(texto(a) for a in agentes)}));")
        saida.append("")
    return "\n".join(saida)


def _funcao_guarda(vocab, tab, maqs):
    ramos = []
    for nome, m in maqs.items():
        vistos = set()
        for ln in m.linhas:
            base = ln.bruta["id"]
            if base in vistos or not ln.guarda_txt:
                continue
            vistos.add(base)
            params = m.parametros.get((ln.papel, ln.evento), {})
            trad = TradutorDeGuarda(m, P.CONFIG_NOMES[nome] + P.PREDICADOS_NOMES[nome], list(params), ln.id)
            ramos.append((base, trad.traduzir(ln.guarda_txt), ln.guarda_txt))
    for i, r in enumerate(tab.get("reacoes", [])):
        if r.get("guarda"):
            m = maqs[r["maquina"]]
            trad = TradutorDeGuarda(m, [], [], f"reação {i + 1}")
            ramos.append((f"reacao_{i + 1}", trad.traduzir(r["guarda"]), r["guarda"]))
    corpo = []
    for rid, sql, original in ramos:
        corpo.append(f"    -- {original}\n    when {texto(rid)} then return coalesce({sql}, false);")
    return f"""create or replace function {ESQUEMA}.guarda(p_id text, v jsonb, q jsonb)
returns boolean language plpgsql immutable
set search_path = {ESQUEMA}, pg_catalog, pg_temp
as $guarda$
begin
  -- Gerada de passagens.yaml (guardas Python restritas traduzidas com ast). v = variáveis, q = ficha, predicados e parâmetros.
  case p_id
{chr(10).join(corpo)}
    else raise exception 'guarda desconhecida: %', p_id using errcode = 'P0001';
  end case;
end;
$guarda$;
"""


def _funcao_situacao(tab, maqs):
    me = maqs["etapa"]
    ramos = []
    for r in tab["situacao_da_etapa"]:
        est = r["estado"] if isinstance(r["estado"], list) else [r["estado"]]
        conds = [f"p_estado in ({', '.join(texto(e) for e in est)})"]
        for k, val in r.items():
            if k in ("estado", "situacao"):
                continue
            if k not in me.idx:
                raise ErroDoGerador(f"situacao_da_etapa usa variável desconhecida {k}")
            conds.append(f"(v->>'{k}') = {texto(val)}" if k not in me.teto_var else f"(v->>'{k}')::integer = {int(val)}")
        ramos.append(f"    when {' and '.join(conds)} then {texto(r['situacao'])}")
    return f"""create or replace function {ESQUEMA}.situacao_da_etapa(p_estado text, v jsonb)
returns text language sql immutable
set search_path = {ESQUEMA}, pg_catalog, pg_temp
as $situacao$
  -- Gerada de passagens.yaml (situacao_da_etapa): como o card enxerga cada etapa. A primeira regra que casa vale.
  select case
{chr(10).join(ramos)}
    else null end;
$situacao$;
"""


def gerar(vocab=None, tabela=None, estrita=True):
    """Devolve {nome_do_arquivo: texto}. Aceita dicionários prontos (os testes plantam defeitos neles).
    estrita=False pula a conferência de estrutura do provar: só os testes de defeito plantado usam, para ver o banco recusar
    o que a tabela deixaria passar."""
    vocab, tab = P.carregar(vocab, tabela)
    try:
        maqs = P.montar(vocab, tab)
    except P.ErroTabela as e:
        raise ErroDoGerador(f"a tabela não monta: {e}")
    if estrita:
        rel = P.Relatorio()
        P.conferir_estrutura(vocab, tab, maqs, rel)
        if not rel.vazio():
            raise ErroDoGerador("a tabela falha na estrutura (rode provar.py):\n  - " + "\n  - ".join(
                f"[{i['regra']}] {i['mensagem']}" for i in rel.lista()))
    conferir_o_que_o_banco_sabe(vocab, tab, maqs)
    impressao = P.impressao_digital(vocab, tab)
    partes = [
        f"""-- ARQUIVO GERADO. NÃO EDITE À MÃO.
-- O que é: as passagens da máquina do card, da etapa e da ação externa, com tetos, guardas, efeitos,
--          ligações, automáticos e a impressão digital da tabela que passou na prova.
-- De onde vem: helena-v2/maquina/passagens.yaml + vocabulario.yaml, pelo script gerar_passagens.py.
-- Como mudar: edite o YAML, rode a prova (python helena-v2/maquina/provar.py) e depois
--             `python supabase/migrations-v2/gerar_passagens.py`. O teste test_02_gerador.py falha se este
--             arquivo guardado for diferente do que o gerador produz hoje.
-- Impressão digital da tabela (provar.impressao_digital): {impressao}
select set_config('helena_v2.migrando', 'sim', false);
""",
        _definicao_das_tabelas_de_regras(),
        "-- Limpa as tabelas de regras e grava de novo (este arquivo pode ser aplicado outra vez).\n" +
        "\n".join(f"delete from {ESQUEMA}.{t};" for t in
                  ["passagem", "ligacao", "automatico", "reacao", "regra_geral", "vocab_evento", "predicado_lista", "entrada", "identidade",
                   "estado_def", "prazo_def", "macro", "variavel", "config_nome", "teto", "meta_tabela"]) + "\n",
    ]
    partes += _dados(vocab, tab, maqs, impressao)
    partes.append("-- Colunas dos contadores, da configuração e do estado (os tetos e domínios vêm do YAML).\n" + _colunas(vocab, tab, maqs))
    partes.append(_funcao_guarda(vocab, tab, maqs))
    partes.append(_funcao_situacao(tab, maqs))
    partes.append(f"""-- Sela a tabela: o banco calcula o hash das linhas gravadas (a função existe depois do 0003).
do $selar$
begin
  if to_regprocedure('{ESQUEMA}.selar_tabela()') is not null then
    perform {ESQUEMA}.selar_tabela();
  end if;
end;
$selar$;
select set_config('helena_v2.migrando', 'nao', false);
""")
    texto_final = "\n".join(p.rstrip("\n") + "\n" for p in partes)
    return {ARQUIVO_SQL.name: texto_final}


def main(argv=None):
    ap = argparse.ArgumentParser(description="Gera o SQL das passagens da v2 a partir do YAML.")
    ap.add_argument("--conferir", action="store_true", help="não escreve; sai com erro se o arquivo guardado estiver velho")
    ap.add_argument("--stdout", action="store_true", help="imprime em vez de escrever")
    args = ap.parse_args(argv)
    try:
        arquivos = gerar()
    except ErroDoGerador as e:
        print(f"ERRO: {e}", file=sys.stderr)
        return 2
    for nome, conteudo in arquivos.items():
        caminho = AQUI / nome
        if args.stdout:
            sys.stdout.write(conteudo)
        elif args.conferir:
            atual = caminho.read_text(encoding="utf-8") if caminho.exists() else ""
            if atual != conteudo:
                print(f"VELHO: {nome} é diferente do que o gerador produz hoje. Rode: python gerar_passagens.py", file=sys.stderr)
                return 1
            print(f"OK: {nome} confere com o YAML (impressão digital {P.impressao_digital(*P.carregar())}).")
        else:
            caminho.write_text(conteudo, encoding="utf-8", newline="\n")
            print(f"Escrito: {caminho.relative_to(RAIZ)} ({len(conteudo.splitlines())} linhas)")
    return 0


if __name__ == "__main__":
    sys.exit(main())
