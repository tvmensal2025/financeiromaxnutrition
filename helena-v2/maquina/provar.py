#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Prova exaustiva limitada da máquina de passagens do Sistema Helena (v2.0).

Uso:
  python maquina/provar.py                     # roda a prova e imprime o tamanho
  python maquina/provar.py --tabela            # tabela expandida: cada linha com dono e prazo do próximo estado
  python maquina/provar.py --replay j.json     # reproduz uma jornada e mostra estado final e violações

Camadas (MEL-23), todas com o tamanho impresso:
  1. ETAPA: busca em largura de TODOS os estados alcançáveis de uma etapa, para cada
     perfil do roteiro de prova, com todos os contadores até o teto e todos os eventos
     de todos os papéis. Eventos que vêm de outra etapa ou do card chegam a qualquer
     momento. A máquina da ação externa é percorrida inteira do mesmo jeito.
  2. CARD: busca sobre o roteiro de prova (E1 paralela; E2 -> EJ em cadeia; EJ jurídica
     que julga E2; ER relatório que depende de todas), com cada etapa resumida na sua
     situação (derivada da camada 1, nunca escrita à mão), os contadores do card e as ações
     externas criadas por etapa. As etapas andam em TODO estado do card: quem recusa é a
     regra da tabela, nunca uma constante da prova. Termina com a vivacidade: de todo card
     com tudo aprovado, PRONTO é alcançável só por passos do sistema.
  3. LIGAÇÃO: todo estado concreto cai em exatamente uma situação; toda passagem
     concreta é passo parado ou passo da camada 2; todo sinal que o card manda é aceito
     por TODO estado concreto daquela situação.

As regras de ferro são conferidas por uma ESPECIFICAÇÃO escrita aqui (variáveis
fantasma que a tabela não controla), não pela própria tabela: é isso que permite os
testes de mutação provarem que a prova pega o defeito.

Nunca prometemos "zero furo": o resultado diz "nenhuma violação conhecida nesta
configuração de prova", com o tamanho do que foi percorrido.
"""
import ast
import hashlib
import itertools
import json
import sys
import time
from collections import defaultdict, deque
from pathlib import Path

import yaml

AQUI = Path(__file__).resolve().parent

REGRAS = {
    "R01": "Todo estado aberto tem dono e prazo, e o prazo tem saída pelo relógio ou pelo motor",
    "R02": "Todo caminho termina num final; nenhum final volta a andar",
    "R03": "Uma execução viva por etapa; só a chave da execução atual grava",
    "R04": "O revisor nunca é o autor nem quem julga a mesma peça depois",
    "R05": "Ajuste volta ao autor; no máximo 6 execuções por rodada; todo contador dentro do teto",
    "R06": "Sem ciclo de dependência; ninguém trabalha sem a anterior aprovada; falha para quem depende e pergunta a você; sub-card desligado",
    "R07": "Só o fundador muda prioridade e prazo",
    "R08": "Nada externo sem o seu ok registrado, só pelo motor e no máximo uma vez",
    "R09": "Aprovada só com os portões passados, por revisor ou por você; nenhum padrão aprova",
    "R10": "Nenhuma entrega aprovada ou pronta com informação velha",
    "R11": "Todo toque seu tem destino: passagem, reação, comentário ou card novo",
    "R12": "Falha de infraestrutura não gasta tentativa, tem teto e no teto chama você",
    "R13": "O histórico reconstrói o card: uma linha por evento e reprodução igual",
    "INTERNET": "Quem leu a internet só entrega ou registra falha",
    "LIGACAO": "Todo sinal entre máquinas é aceito por todo estado concreto da situação",
    "ESTRUTURA": "Tabela malformada ou nome fora do vocabulário",
}

# Nomes de configuração e de predicados que as guardas podem ler (além das variáveis,
# dos tetos e dos parâmetros do evento). Qualquer outro nome é recusado.
CONFIG_NOMES = {
    "etapa": ["tem_internet", "julgadora", "julgada", "pulavel", "permite_perguntar", "permite_devolver", "usa_decisao",
              "prazo_de_terceiro"],
    "card": ["pedido_grande"],
    "acao_externa": ["tem_ferramenta"],
}
PREDICADOS_NOMES = {
    "etapa": ["revisor_valido", "anteriores_satisfeitas"],
    "card": ["todas_prontas", "falha_sem_decisao", "nao_pode_sem_decisao", "falhas_pulaveis"],
    "acao_externa": [],
}
# Predicados que o banco calcula olhando OUTRAS máquinas. Na camada 1 (etapa sozinha) a busca
# tenta os dois valores; a camada 2 só usa o passo quando o valor calculado das outras etapas casa.
EXTERNOS = {"etapa": ["anteriores_satisfeitas"], "card": [], "acao_externa": []}
ESTADOS_DE_EXECUCAO = ("EXECUTANDO", "REVISAO")
EVENTOS_DE_INFRA = ("FALHA_INFRA", "SEM_EXECUCAO_VIVA", "SEM_CAPACIDADE")
EVENTOS_QUE_ENVELHECEM = ("DECISAO_MUDOU", "DEPENDENCIA_MUDOU", "AJUSTE_DO_JULGADOR", "REABRIR_POR_ORDEM")
OPCOES_QUE_SAO_ORDEM = ("REFAZER", "ESPERAR", "MODELO_MENOR")
# Especificação (independente do YAML). A prova confere a tabela contra ESTES valores; a tabela
# nunca é usada como especificação de si mesma.
ESPEC_SATISFAZ = ("APROVADA", "PULADA")                     # o que pode liberar dependente e fechar o card
ESPEC_CARD_ATIVO = ("EM_ANDAMENTO", "ESPERANDO_FUNDADOR")    # regra 6: só aqui uma etapa pode sair da espera
ESPEC_BOTOES_COM_VERSAO = ("APROVAR", "PEDIR_AJUSTE", "RESPONDER")   # A-6: toque sobre versão antiga nunca muda estado
ESPEC_NIVEIS_PRAZO = {"PRAZO_80": 1, "PRAZO_VENCIDO": 2, "PRAZO_MAIS_1H": 3}   # regra 1: cada aviso vale até disparar
ESPEC_VARS_DE_ESPERA = ("espera",)                          # regime da sua espera: só o código decide, nunca a IA
# Parâmetros que a ESPECIFICAÇÃO lê (None = em todo evento). Um parâmetro que nem a tabela nem a
# especificação leem não muda nada: a busca usa um valor só dele (simetria, ver eventos_da_maquina).
ESPEC_PARAMS_LIDOS = {"usou_internet": {"PERGUNTAR", "DEVOLVER_A_QUEM_PEDIU", "PEDIR_SUBCARD"},
                      "classe": {"FALHA"}, "opcao": None, "escolhido": None}
SITUACOES_FINAIS = ("PRONTA", "FIM_PAI", "FALHOU", "PULADA", "ENCERROU")
MAX_ESTADOS = 3_000_000   # se passar disso a prova FALHA de forma visível (contador sem teto)


def revisores_possiveis(vocab):
    """Fonte única do domínio do revisor (MEL-22): os agentes do organograma mais você."""
    ids = vocab["identidades"]
    return list(ids["agentes"]) + [ids["fundador"]]


def expandir_dominio(valores, vocab, onde):
    """Domínio fechado; 'revisores_possiveis' é derivado de vocabulario.identidades."""
    if isinstance(valores, str):
        if valores == "revisores_possiveis":
            return revisores_possiveis(vocab)
        raise ErroTabela(f"{onde}: domínio por nome desconhecido {valores!r}")
    return list(valores)


class ErroTabela(Exception):
    pass


class BuscaSemFim(Exception):
    pass


# ----------------------------------------------------------------------------- relatório
class Relatorio:
    """Junta violações por (regra, mensagem), com até 3 exemplos cada."""

    def __init__(self):
        self.itens = {}
        self.parar_em = None
        self.parou = False

    def add(self, regra, msg, exemplo=None):
        chave = (regra, msg)
        it = self.itens.get(chave)
        if it is None:
            it = self.itens[chave] = {"regra": regra, "mensagem": msg, "vezes": 0, "exemplos": []}
        it["vezes"] += 1
        if exemplo is not None and len(it["exemplos"]) < 3:
            it["exemplos"].append(exemplo)
        if self.parar_em is not None and regra in self.parar_em:
            self.parou = True

    def juntar(self, outro):
        for (regra, msg), it in outro.itens.items():
            meu = self.itens.setdefault((regra, msg), {"regra": regra, "mensagem": msg, "vezes": 0, "exemplos": []})
            meu["vezes"] += it["vezes"]
            meu["exemplos"] = (meu["exemplos"] + it["exemplos"])[:3]
        self.parou = self.parou or outro.parou

    def regras(self):
        return sorted({r for (r, _m) in self.itens})

    def lista(self):
        return sorted(self.itens.values(), key=lambda x: (x["regra"], x["mensagem"]))

    def vazio(self):
        return not self.itens


# ----------------------------------------------------------------------------- carga
def carregar(vocab=None, tabela=None):
    """Lê vocabulario.yaml e passagens.yaml (ou usa os dicionários dados, para mutação)."""
    if vocab is None:
        vocab = yaml.safe_load((AQUI / "vocabulario.yaml").read_text(encoding="utf-8"))
    if tabela is None:
        tabela = yaml.safe_load((AQUI / "passagens.yaml").read_text(encoding="utf-8"))
    return vocab, tabela


def impressao_digital(vocab, tabela):
    """Hash canônico (independe de comentário e de ordem de chave). O banco calcula o mesmo
    hash a partir das linhas gravadas, então uma edição à mão no banco é pega (A-19, MEL-22)."""
    texto = json.dumps({"v": vocab, "t": tabela}, sort_keys=True, ensure_ascii=False, separators=(",", ":"))
    return hashlib.sha256(texto.encode("utf-8")).hexdigest()[:16]


# ----------------------------------------------------------------------------- guardas
_NOS = (ast.Expression, ast.BoolOp, ast.And, ast.Or, ast.UnaryOp, ast.Not, ast.USub, ast.Compare,
        ast.Eq, ast.NotEq, ast.Lt, ast.LtE, ast.Gt, ast.GtE, ast.In, ast.NotIn, ast.Name, ast.Load,
        ast.Constant, ast.Tuple, ast.BinOp, ast.Add, ast.Sub)


def compilar_expr(texto, idx_vars, tetos, nomes_q, onde):
    """Compila uma guarda restrita para `lambda s, q: ...` (s = tupla do estado, q = contexto)."""
    try:
        arv = ast.parse(texto, mode="eval")
    except SyntaxError as e:
        raise ErroTabela(f"{onde}: guarda com erro de sintaxe: {texto!r} ({e})")
    for no in ast.walk(arv):
        if not isinstance(no, _NOS):
            raise ErroTabela(f"{onde}: construção não permitida na guarda: {type(no).__name__}")
        if isinstance(no, ast.Constant) and not isinstance(no.value, (int, str, bool)):
            raise ErroTabela(f"{onde}: constante não permitida: {no.value!r}")

    class Troca(ast.NodeTransformer):
        def visit_Name(self, no):
            n = no.id
            if n in idx_vars:
                return ast.Subscript(value=ast.Name("s", ast.Load()), slice=ast.Constant(idx_vars[n]), ctx=ast.Load())
            if n in tetos:
                return ast.Constant(tetos[n])
            if n in nomes_q:
                return ast.Subscript(value=ast.Name("q", ast.Load()), slice=ast.Constant(n), ctx=ast.Load())
            raise ErroTabela(f"{onde}: nome desconhecido na guarda: {n}")

    novo = ast.fix_missing_locations(Troca().visit(arv))
    fonte = ast.unparse(novo.body)
    return eval(compile(f"lambda s, q: ({fonte})", f"<{onde}>", "eval"), {"__builtins__": {}})


# ----------------------------------------------------------------------------- máquina
class _EvSimples:
    __slots__ = ("papel", "q", "ator", "chave")

    def __init__(self, papel, q, ator, chave):
        self.papel, self.q, self.ator, self.chave = papel, q, ator, chave


class Linha:
    __slots__ = ("id", "de", "evento", "papel", "guarda", "guarda_txt", "efeitos", "para", "sinais", "nota", "bruta", "delta",
                 "usa_comp", "usa_ext", "checa_param")


class Maquina:
    """Uma das três máquinas da tabela. Estado = (estado, *variáveis)."""

    def __init__(self, nome, vocab, tab):
        self.nome = nome
        self.vocab = vocab
        self.tab = tab
        self.tetos = {k: int(v["valor"]) for k, v in tab["tetos"].items()}
        vdef = tab["variaveis"][nome]
        self.vars = list(vdef)
        self.idx = {v: i + 1 for i, v in enumerate(self.vars)}
        self.n = 1 + len(self.vars)
        self.teto_var, self.dominio, self.compartilhadas = {}, {}, []
        ini = []
        for v, d in vdef.items():
            if "teto" in d:
                t = d["teto"]
                self.teto_var[v] = self.tetos[t] if isinstance(t, str) else int(t)
            elif "dominio" in d:
                self.dominio[v] = expandir_dominio(d["dominio"], vocab, f"{nome}.{v}")
                if d.get("mais"):
                    self.dominio[v] += [x for x in expandir_dominio(d["mais"], vocab, f"{nome}.{v}") if x not in self.dominio[v]]
            else:
                raise ErroTabela(f"{nome}.{v}: variável sem teto nem domínio (todo contador tem teto)")
            if d.get("compartilhada"):
                self.compartilhadas.append(v)
            ini.append(d.get("inicial", 0))
        self._comp = [(self.idx[v], self.teto_var[v]) for v in self.compartilhadas]
        self.estados = tab["estados"][nome]
        vm = vocab["maquinas"][nome]
        self.finais = set(vm["finais"])
        self.abertos = set(vm["abertos"])
        iniciais = [e for e, d in self.estados.items() if (d or {}).get("inicial")]
        self.estado_inicial = iniciais[0] if iniciais else vm["abertos"][0]
        self._inicial = tuple([self.estado_inicial] + ini)
        self.entradas = set(tab.get("entradas", {}).get(nome, []))
        self.macros = tab.get("macros", {})
        self.parametros = {}
        for papel, acoes in vocab["acoes"].items():
            for ev, d in acoes.items():
                ps = dict((d or {}).get("parametros") or {})
                self.parametros[(papel, ev)] = {k: expandir_dominio(v, vocab, f"{papel}.{ev}.{k}") for k, v in ps.items()}
        self.linhas, self.por_chave = [], defaultdict(list)
        for bruta in tab["linhas"][nome]:
            des = bruta["de"] if isinstance(bruta["de"], list) else [bruta["de"]]
            for de in des:
                self.linhas.append(self._compilar(bruta, de, len(des) > 1))
        for ln in self.linhas:
            self.por_chave[(ln.de, ln.evento)].append(ln)
        rg = tab.get("regras_gerais", {})
        chave = rg.get("respostas_de_agente_exigem_chave_atual") or []
        self._papeis_chave = set(chave) if isinstance(chave, list) else set()
        self._exige_revisor = rg.get("respostas_de_revisor_exigem_revisor_designado", True)
        self._botoes_versao = set(rg.get("toques_do_fundador_exigem_versao_vista") or [])
        ca = rg.get("etapa_so_anda_com_card_ativo") if nome == "etapa" else None
        self._card_ativo = set(ca.get("card_ativo") or []) if ca else None
        self._exceto_card = set(ca.get("exceto") or []) if ca else set()
        self._i_revisor = self.idx.get("revisor", 0)

    def _compilar(self, b, de, varias):
        ln = Linha()
        ln.bruta = b
        ln.id = f"{b['id']}@{de}" if varias else b["id"]
        ln.de, ln.evento, ln.papel = de, b["evento"], b["papel"]
        ln.para = de if b.get("para") == "MESMO" else b["para"]
        ln.nota = b.get("nota", "")
        params = self.parametros.get((ln.papel, ln.evento), {})
        nomes_q = set(CONFIG_NOMES[self.nome]) | set(PREDICADOS_NOMES[self.nome]) | set(params)
        ln.guarda_txt = b.get("guarda") or ""
        ln.guarda = compilar_expr(ln.guarda_txt, self.idx, self.tetos, nomes_q, ln.id) if ln.guarda_txt else None
        efeitos = []
        checa = []
        bruto = dict(b.get("efeito") or {})
        if "_macro" in bruto:
            nome_macro = bruto.pop("_macro")
            if nome_macro not in self.macros:
                raise ErroTabela(f"{ln.id}: macro desconhecida {nome_macro}")
            bruto = {**self.macros[nome_macro], **bruto}
        for var, val in bruto.items():
            if var not in self.idx:
                raise ErroTabela(f"{ln.id}: efeito em variável desconhecida {var}")
            pos = self.idx[var]
            if isinstance(val, bool):
                val = int(val)
            if isinstance(val, int):
                efeitos.append((pos, "set", val))
            elif isinstance(val, str) and var in self.teto_var and val in self.tetos:
                efeitos.append((pos, "set", self.tetos[val]))   # fica no teto, nunca passa dele
            elif isinstance(val, str) and val.startswith("+"):
                efeitos.append((pos, "add", int(val[1:])))
            elif isinstance(val, str) and val.startswith("$"):
                if val[1:] not in params:
                    raise ErroTabela(f"{ln.id}: efeito copia parâmetro inexistente {val}")
                efeitos.append((pos, "param", val[1:]))
                if var in self.dominio:   # o banco recusa gravar valor fora do domínio da variável
                    checa.append((val[1:], frozenset(self.dominio[var])))
            else:
                if var in self.dominio and val not in self.dominio[var]:
                    raise ErroTabela(f"{ln.id}: valor {val!r} fora do domínio de {var}")
                efeitos.append((pos, "set", val))
        ln.efeitos = tuple(efeitos)
        ln.checa_param = tuple(checa)
        comp = [self.idx[v] for v in self.compartilhadas]
        ln.delta = tuple(sum(v for (p_, t_, v) in efeitos if p_ == c and t_ == "add") for c in comp)
        import re as _re
        ln.usa_comp = tuple(v for v in self.compartilhadas if _re.search(r"\b%s\b" % v, ln.guarda_txt))
        ln.usa_ext = tuple(v for v in EXTERNOS[self.nome] if _re.search(r"\b%s\b" % v, ln.guarda_txt))
        sinais = []
        for s in b.get("sinais") or []:
            if isinstance(s, str):
                sinais.append((s, None))
            else:
                cond = compilar_expr(s["se"], self.idx, self.tetos, nomes_q, ln.id + ":sinal")
                sinais.append((s["sinal"], cond))
        ln.sinais = tuple(sinais)
        return ln

    def inicial(self):
        return self._inicial

    def canon(self, pos, fantasma_ini):
        """Num final só importam o estado e o motivo do fim (finais não têm saída; o resto
        fica no histórico). Reduz o número de estados sem esconder nada: qualquer saída de
        um final é violação da regra 2, venha de onde vier."""
        if pos[0] not in self.finais:
            return pos
        base = list(self._inicial)
        base[0] = pos[0]
        if "fim" in self.idx:
            base[self.idx["fim"]] = pos[self.idx["fim"]]
        return tuple(base) + tuple(fantasma_ini)

    def atribuicoes(self, cands):
        """Camada 1: os contadores do card (ordens, perguntas, voltas) só aparecem em guardas
        '< teto' / '>= teto' e só sobem de 1 em 1. Na etapa sozinha eles não fazem parte do
        estado: a cada evento que os lê, a busca tenta 'abaixo do teto' (0) e 'no teto'. Isso
        inclui todo comportamento real; o teto real é contado na camada 2, no card."""
        livres = sorted({v for ln in cands for v in ln.usa_comp})
        if not livres:
            return ((),)
        doms = [[(self.idx[v], 0), (self.idx[v], self.teto_var[v])] for v in livres]
        return tuple(itertools.product(*doms))

    def com(self, s, atrib):
        if not atrib:
            return s
        lst = list(s)
        for i, val in atrib:
            lst[i] = val
        return tuple(lst)

    def sem_comp(self, pos):
        if not self._comp:
            return pos
        lst = list(pos)
        for i, _t in self._comp:
            lst[i] = 0
        return tuple(lst)

    def dono(self, estado):
        return (self.estados.get(estado) or {}).get("dono")

    def casar(self, s, papel, evento, q, ator=None, chave="atual", autor=None):
        """Linhas que aceitam o evento no estado s. Aplica as regras gerais (chave e revisor)."""
        cands = [ln for ln in self.por_chave.get((s[0], evento), ()) if ln.papel == papel]
        if not cands:
            return []
        return self.casar_cands(s, cands, _EvSimples(papel, q, ator, chave), autor)

    def permite_com_card(self, evento, estado_card):
        """Regra geral da tabela (regras_gerais.etapa_so_anda_com_card_ativo)."""
        if self._card_ativo is None or evento in self._exceto_card:
            return True
        return estado_card in self._card_ativo

    def recusa_por_regra(self, ev, evento, autor=None):
        """Regras gerais da tabela que dependem só do evento (não do estado): chave antiga,
        versão antiga, card não ativo, ator que não é o autor. A busca as decide uma vez por evento."""
        papel = ev.papel
        if papel in self._papeis_chave and ev.chave != "atual":
            return True
        if papel == "FUNDADOR" and evento in self._botoes_versao and ev.chave != "atual":
            return True
        if self._card_ativo is not None and not self.permite_com_card(evento, ev.q.get("estado_card")):
            return True
        if papel == "AUTOR" and autor is not None and ev.ator not in (None, autor):
            return True
        return False

    def casar_cands(self, s, cands, ev, autor=None, sem_regra_estatica=False):
        """Aplica as regras gerais da tabela e depois as guardas. ev.chave é a chave da chamada
        (AUTOR, REVISOR, HELENA) ou a versão vista (FUNDADOR)."""
        if not sem_regra_estatica and self.recusa_por_regra(ev, cands[0].evento, autor):
            return []
        if ev.papel == "REVISOR" and self._exige_revisor and self._i_revisor and ev.ator != s[self._i_revisor]:
            return []
        q = ev.q
        return [ln for ln in cands if (ln.guarda is None or ln.guarda(s, q))
                and all(q.get(p) in dom for p, dom in ln.checa_param)]

    def aplicar(self, s, ln, params):
        lst = list(s)
        lst[0] = ln.para
        for pos, tipo, val in ln.efeitos:
            if tipo == "set":
                lst[pos] = val
            elif tipo == "add":
                lst[pos] += val
            else:
                lst[pos] = params[val]
        return tuple(lst)

    def sinais_de(self, ln, s, q):
        return tuple(nome for nome, cond in ln.sinais if cond is None or cond(s, q))


def montar(vocab, tab):
    return {nome: Maquina(nome, vocab, tab) for nome in ("card", "etapa", "acao_externa")}


# ----------------------------------------------------------------------------- estrutura
def conferir_estrutura(vocab, tab, maqs, rel):
    """Conferências que não dependem de percorrer estados (MEL-22: uma definição por regra)."""
    papeis = vocab["papeis"]
    acoes = vocab["acoes"]
    for nome, m in maqs.items():
        vm = vocab["maquinas"][nome]
        declarados = set(vm["abertos"]) | set(vm["finais"])
        if set(m.estados) != declarados:
            rel.add("ESTRUTURA", f"{nome}: estados da tabela diferentes do vocabulário: {sorted(set(m.estados) ^ declarados)}")
        for e in vm["abertos"]:
            d = m.estados.get(e) or {}
            if not d.get("dono") or d.get("dono") not in papeis:
                rel.add("R01", f"{nome}.{e}: estado aberto sem dono válido")
            if not d.get("prazo") or d.get("prazo") not in tab.get("prazos", {}):
                rel.add("R01", f"{nome}.{e}: estado aberto sem prazo válido")
                continue
            pz = tab["prazos"][d["prazo"]]
            np_ = pz["no_prazo"]
            if not np_.get("evento") or np_.get("papel") not in vocab.get("papeis_do_sistema", []):
                rel.add("R01", f"{nome}.{e}: o prazo '{d['prazo']}' não diz qual evento do sistema dispara no prazo")
                continue
            if pz.get("tratado_em") == "card":
                # o prazo do card vale para o card e para as etapas que esperam dentro dele: cada aviso
                # tem que existir em TODO estado aberto do card (um aviso que falta num estado se perde)
                evs = [np_["evento"]] + list(pz.get("avisos") or [])
                for ec in vocab["maquinas"]["card"]["abertos"]:
                    for evp in evs:
                        if not any(ln.de == ec and ln.evento == evp and ln.papel == np_["papel"] for ln in maqs["card"].linhas):
                            rel.add("R01", f"card.{ec}: o aviso {evp} do prazo '{d['prazo']}' não existe neste estado")
            else:
                ok = any(ln.de == e and ln.papel == np_["papel"] and ln.evento == np_["evento"] for ln in m.linhas)
                if not ok:
                    rel.add("R01", f"{nome}.{e}: o prazo '{d['prazo']}' não tem saída ({np_['papel']} {np_['evento']})")
        for e in vm["finais"]:
            if not (m.estados.get(e) or {}).get("final"):
                rel.add("R02", f"{nome}.{e}: final não marcado como final")
        for ln in m.linhas:
            if ln.de in m.finais:
                rel.add("R02", f"{nome}: o final {ln.de} tem saída ({ln.id} {ln.evento})")
            if ln.papel not in papeis:
                rel.add("ESTRUTURA", f"{ln.id}: papel desconhecido {ln.papel}")
            elif ln.evento not in (acoes.get(ln.papel) or {}):
                rel.add("ESTRUTURA", f"{ln.id}: o papel {ln.papel} não tem o evento {ln.evento} no vocabulário")
            if ln.para not in m.estados:
                rel.add("ESTRUTURA", f"{ln.id}: próximo estado desconhecido {ln.para}")
            d = (acoes.get(ln.papel) or {}).get(ln.evento) or {}
            if d.get("desligado"):
                rel.add("R06" if ln.evento == "PEDIR_SUBCARD" else "ESTRUTURA",
                        f"{ln.id}: linha para ação desligada {ln.evento} ({d['desligado']})")
            if d.get("efeito") == "externo" and (nome != "acao_externa" or ln.papel != "MOTOR"):
                rel.add("R08", f"{ln.id}: efeito externo fora da máquina da ação externa ou por quem não é o motor")
            if ln.papel in papeis and papeis[ln.papel].get("e_ia") and ln.para == "EXECUTANDO_ACAO":
                rel.add("R08", f"{ln.id}: IA ({ln.papel}) leva a ação externa à execução")
            for s, _c in ln.sinais:
                if s not in tab.get("ligacoes", {}):
                    rel.add("LIGACAO", f"{ln.id}: sinal desconhecido {s}")
    # ações de IA nunca têm efeito externo; só o fundador muda prioridade/prazo
    for papel, evs in acoes.items():
        for ev, d in evs.items():
            d = d or {}
            if papeis.get(papel, {}).get("e_ia") and d.get("efeito") != "interno":
                rel.add("R08", f"ação de IA com efeito externo: {papel}.{ev}")
            if d.get("efeito") == "externo" and not papeis.get(papel, {}).get("pode_agir_fora"):
                rel.add("R08", f"{papel}.{ev}: efeito externo para papel que não pode agir fora")
            if d.get("muda_campo") and papel != "FUNDADOR":
                rel.add("R07", f"{papel}.{ev} muda {d['muda_campo']} e não é o fundador")
    for r in tab.get("reacoes", []):
        if r.get("guarda"):
            try:
                compilar_expr(r["guarda"], maqs[r["maquina"]].idx, maqs[r["maquina"]].tetos, set(), "reação")
            except ErroTabela as e:
                rel.add("ESTRUTURA", f"reação {r['papel']}.{r['evento']}: {e}")
        if r.get("muda_campo") and r["papel"] != "FUNDADOR":
            rel.add("R07", f"reação {r['papel']}.{r['evento']} muda {r['muda_campo']} e não é o fundador")
        if r["evento"] not in (acoes.get(r["papel"]) or {}):
            rel.add("ESTRUTURA", f"reação {r['papel']}.{r['evento']} fora do vocabulário")
    if tab.get("regras_gerais", {}).get("subcards_desligados") is not True:
        rel.add("R06", "sub-card não está desligado na v2.0 (MEL-24)")
    # tetos
    for k, v in tab["tetos"].items():
        if not isinstance(v.get("valor"), int) or v["valor"] < 1:
            rel.add("R05", f"teto {k} sem valor inteiro positivo")
    # ligações
    for nome, lig in tab.get("ligacoes", {}).items():
        if "entrega" in lig:
            ev = lig["entrega"]["evento"]
            alvos = lig.get("para") or []
            if any(a.startswith("etapas") or a.startswith("dependentes") or a.startswith("julgadas") for a in alvos):
                if ev not in maqs["etapa"].entradas:
                    rel.add("LIGACAO", f"ligação {nome}: {ev} não é entrada declarada da etapa")
            if "card" in alvos and ev not in maqs["card"].entradas:
                rel.add("LIGACAO", f"ligação {nome}: {ev} não é entrada declarada do card")
    # automáticos nunca aprovam entrega (regra 9)
    for nome, evs in (tab.get("automaticos") or {}).items():
        for ev in evs:
            for ln in maqs[nome].linhas:
                if ln.evento == ev and ln.para == "APROVADA":
                    rel.add("R09", f"evento automático {ev} aprova entrega ({ln.id})")
    rec = tab.get("recusa_do_fundador") or {}
    if not rec.get("aberto") or not rec.get("final"):
        rel.add("R11", "recusa do fundador sem destino para estado aberto ou final")
    rg = tab.get("regras_gerais", {})
    # regra 13: o histórico nunca registra como sua uma decisão que você não tomou
    emissores = defaultdict(set)   # evento de entrada -> papéis das linhas que emitem o sinal
    for nome, m in maqs.items():
        for ln in m.linhas:
            for s, _c in ln.sinais:
                lig = tab.get("ligacoes", {}).get(s) or {}
                if "entrega" in lig:
                    emissores[lig["entrega"]["evento"]].add(ln.papel)
    for nome, m in maqs.items():
        i_fim = m.idx.get("fim")
        for ln in m.linhas:
            if i_fim and any(p == i_fim and t == "set" and v == "FUNDADOR" for p, t, v in ln.efeitos) and ln.papel != "FUNDADOR":
                if not (ln.evento in m.entradas and rg.get("entradas_so_por_sinal") and emissores[ln.evento] == {"FUNDADOR"}):
                    rel.add("R13", f"{ln.id}: grava fim FUNDADOR sem vir só de um toque seu ({ln.papel} {ln.evento})")
    # entradas: só por sinal, e toda entrada tem quem a emita
    for nome, m in maqs.items():
        for ev in m.entradas:
            if ev not in emissores:
                rel.add("LIGACAO", f"{nome}: a entrada {ev} não é entregue por nenhuma ligação")
        for ev in (tab.get("automaticos") or {}).get(nome, []):
            if ev in m.entradas:
                rel.add("LIGACAO", f"{nome}: o automático {ev} é entrada (só pode chegar por sinal)")
    # a cascata de cancelamento alcança a ação em todo estado aberto dela
    for nome_l, lig in tab.get("ligacoes", {}).items():
        if "acoes_abertas" in (lig.get("para") or []):
            ma = maqs["acao_externa"]
            for e in ma.abertos:
                if not any(ln.de == e and ln.evento == lig["entrega"]["evento"] and ln.papel == lig["entrega"]["papel"]
                           and ln.guarda is None for ln in ma.linhas):
                    rel.add("LIGACAO", f"ligação {nome_l}: a ação em {e} não aceita {lig['entrega']['evento']}")
    # o regime da sua espera (interna/externa) nunca vem de parâmetro escrito por IA (regra 7)
    for nome, m in maqs.items():
        for ln in m.linhas:
            if not papeis.get(ln.papel, {}).get("e_ia"):
                continue
            for p, t, v in ln.efeitos:
                if t == "param" and m.vars[p - 1] in ESPEC_VARS_DE_ESPERA:
                    rel.add("R07", f"{ln.id}: a IA ({ln.papel}) escolhe o regime da sua espera (parâmetro {v})")
    # domínio do revisor e do escolhido: fonte única = identidades (MEL-22)
    rp = set(revisores_possiveis(vocab))
    me = maqs["etapa"]
    if "revisor" in me.dominio and set(me.dominio["revisor"]) - {"NENHUM"} != rp:
        rel.add("ESTRUTURA", "domínio de etapa.revisor diferente de vocabulario.identidades (fonte única)")
    esc = me.parametros.get(("MOTOR", "PORTAO1_OK"), {}).get("escolhido")
    if esc is not None and set(esc) != rp:
        rel.add("ESTRUTURA", "PORTAO1_OK.escolhido diferente de vocabulario.identidades (fonte única)")


# ----------------------------------------------------------------------------- roteiro de prova
# Configuração pequena mas representativa (MEL-23): uma etapa paralela (E1), uma cadeia
# (E2 -> EJ), uma etapa jurídica que julga outra (EJ julga E2) e o relatório final (ER),
# que depende de todas. A CLARA (autora do jurídico) e a HELENA (revisora possível do
# jurídico) estão na lista de revisores da E2 de propósito: as duas julgam a E2 depois, e a
# designação precisa pular as duas (regra 4). A E2 tem prazo de terceiro (espera externa).
# Os 21 agentes são intercambiáveis na tabela (ela só compara identidades): a prova cobre
# todos por simetria (ver eventos_da_maquina) e o teste de cada agente de ponta a ponta.
ROTEIRO_DE_PROVA = {
    "etapas": [
        {"id": "E1", "nome": "conta (paralela)", "autor": "CAIO", "revisores": ["CLARA", "HELENA"],
         "depende_de": [], "julga": [], "internet": False, "pulavel": True, "usa_decisao": True,
         "acoes_permitidas": ["ENTREGAR", "PERGUNTAR", "DEVOLVER_A_QUEM_PEDIU", "REGISTRAR_FALHA"]},
        {"id": "E2", "nome": "convite (cadeia, julgada)", "autor": "ISABELA", "revisores": ["CLARA", "HELENA", "RAVI", "FUNDADOR"],
         "depende_de": [], "julga": [], "internet": True, "pulavel": False, "usa_decisao": True, "prazo_de_terceiro": True,
         "acoes_permitidas": ["ENTREGAR", "PERGUNTAR", "DEVOLVER_A_QUEM_PEDIU", "REGISTRAR_FALHA"]},
        {"id": "EJ", "nome": "jurídico (julga E2)", "autor": "CLARA", "revisores": ["HELENA", "FUNDADOR"],
         "depende_de": ["E2"], "julga": ["E2"], "internet": True, "pulavel": False, "usa_decisao": True,
         "acoes_permitidas": ["ENTREGAR", "PERGUNTAR", "DEVOLVER_A_QUEM_PEDIU", "REGISTRAR_FALHA"]},
        {"id": "ER", "nome": "relatório final", "autor": "HELENA", "revisores": ["HELENA", "CLARA", "CAIO"],
         "depende_de": ["E1", "E2", "EJ"], "julga": [], "internet": False, "pulavel": False, "usa_decisao": True,
         "acoes_permitidas": ["ENTREGAR", "PERGUNTAR", "DEVOLVER_A_QUEM_PEDIU", "REGISTRAR_FALHA"]},
    ]
}


def perfis_do_roteiro(roteiro, tab, vocab=None):
    """Transforma o roteiro em perfis de etapa (config que as guardas leem).

    pf['julgadores'] é a ESPECIFICAÇÃO da regra 4 ("quem julga a mesma peça depois"),
    calculada aqui sem olhar a tabela: o autor de cada etapa que julga esta E quem pode
    revisar essa julgadora (a ficha dela, menos o autor dela e você). Os revisores válidos
    (o que a tabela permite) saem de designacao_de_revisor.excluir."""
    if vocab is None:
        vocab, _t = carregar()
    agentes = set(vocab["identidades"]["agentes"])
    fundador = vocab["identidades"]["fundador"]
    etapas = roteiro["etapas"]
    ids = [e["id"] for e in etapas]
    if len(set(ids)) != len(ids):
        raise ErroTabela("roteiro com etapa repetida")
    for e in etapas:
        if e["autor"] not in agentes:
            raise ErroTabela(f"roteiro: {e['id']} tem autor fora de vocabulario.identidades.agentes ({e['autor']})")
        for r in e.get("revisores", []):
            if r not in agentes and r != fundador:
                raise ErroTabela(f"roteiro: {e['id']} tem revisor fora de vocabulario.identidades ({r})")
    autores_julg, revisores_julg = defaultdict(list), defaultdict(list)
    for e in etapas:
        for j in e.get("julga", []):
            autores_julg[j].append(e["autor"])
            revisores_julg[j].extend(r for r in e.get("revisores", []) if r not in (e["autor"], fundador))
    excluir = (tab.get("designacao_de_revisor") or {}).get("excluir", [])
    perfis = []
    for e in etapas:
        for d in e.get("depende_de", []):
            if d not in ids:
                raise ErroTabela(f"roteiro: {e['id']} depende de etapa inexistente {d}")
        for j in e.get("julga", []):
            if j not in e.get("depende_de", []):
                raise ErroTabela(f"roteiro: {e['id']} julga {j} sem depender dela")
        perm = set(e.get("acoes_permitidas", ["ENTREGAR", "REGISTRAR_FALHA"]))
        julgada = e["id"] in autores_julg
        cfg = {
            "tem_internet": bool(e.get("internet")),
            "julgadora": bool(e.get("julga")),
            "julgada": julgada,
            "pulavel": bool(e.get("pulavel")) and not julgada and not e.get("julga"),
            "permite_perguntar": "PERGUNTAR" in perm,
            "permite_devolver": "DEVOLVER_A_QUEM_PEDIU" in perm,
            "usa_decisao": bool(e.get("usa_decisao", True)),
            "prazo_de_terceiro": bool(e.get("prazo_de_terceiro", False)),
        }
        validos = []
        for r in e.get("revisores", []):
            fora = (("AUTOR_DA_ETAPA" in excluir and r == e["autor"]) or
                    ("AUTORES_DOS_JULGADORES" in excluir and r in autores_julg[e["id"]]) or
                    ("REVISORES_DOS_JULGADORES" in excluir and r in revisores_julg[e["id"]]))
            if not fora and r not in validos:
                validos.append(r)
        ultima = (tab.get("designacao_de_revisor") or {}).get("ultima_reserva")
        if ultima and ultima not in validos:
            validos.append(ultima)   # você é sempre a última reserva (nunca é autor)
        julgadores = sorted(set(autores_julg[e["id"]]) | set(revisores_julg[e["id"]]))
        perfis.append({"id": e["id"], "nome": e.get("nome", e["id"]), "autor": e["autor"],
                       "revisores": list(e.get("revisores", [])), "revisores_validos": validos,
                       "julgadores": julgadores, "depende_de": list(e.get("depende_de", [])),
                       "julga": list(e.get("julga", [])), "cfg": cfg})
    # regra 6: nenhum ciclo de dependência (busca topológica)
    grau = {p["id"]: len(p["depende_de"]) for p in perfis}
    filhos = defaultdict(list)
    for p in perfis:
        for d in p["depende_de"]:
            filhos[d].append(p["id"])
    fila = deque(i for i, g in grau.items() if g == 0)
    vistos = 0
    while fila:
        i = fila.popleft()
        vistos += 1
        for f in filhos[i]:
            grau[f] -= 1
            if grau[f] == 0:
                fila.append(f)
    if vistos != len(perfis):
        raise ErroTabela("roteiro com ciclo de dependência (regra 6)")
    return perfis


# ----------------------------------------------------------------------------- eventos
class Ev:
    __slots__ = ("papel", "evento", "params", "ator", "chave", "q", "rotulo")

    def __init__(self, papel, evento, params, ator, chave, q):
        self.papel, self.evento, self.params, self.ator, self.chave, self.q = papel, evento, params, ator, chave, q
        ps = ",".join(f"{k}={v}" for k, v in sorted(params.items()))
        extra = (f" ator={ator}" if ator else "") + ("" if chave == "atual" else
                                                      (" versão=antiga" if papel == "FUNDADOR" else f" chave={chave}"))
        self.rotulo = f"{papel} {evento}" + (f"({ps})" if ps else "") + extra


def combinacoes(params):
    nomes = sorted(params)
    for vals in itertools.product(*[params[n] for n in nomes]):
        yield dict(zip(nomes, vals))


def agentes_representativos(vocab, pf):
    """Simetria (sound): a tabela só compara identidades com o autor, os julgadores, a ficha e o
    revisor designado. Todo agente fora desses grupos se comporta igual a qualquer outro de fora,
    na tabela e na especificação; basta UM representativo deles. Os de dentro entram todos."""
    agentes = list(vocab["identidades"]["agentes"])
    if pf is None:
        return agentes
    dentro = {pf["autor"]} | set(pf["julgadores"]) | set(pf["revisores"]) | set(pf["revisores_validos"])
    fora = [a for a in agentes if a not in dentro]
    return [a for a in agentes if a in dentro] + fora[:1]


def parametros_lidos(maq, papel, evento):
    """Parâmetros do evento que alguma linha da máquina lê (guarda, efeito '$' ou condição de sinal)."""
    import re as _re
    nomes = set(maq.parametros.get((papel, evento), {}))
    lidos = set()
    for ln in maq.linhas:
        if ln.papel != papel or ln.evento != evento:
            continue
        textos = [ln.guarda_txt] + [s.get("se", "") for s in (ln.bruta.get("sinais") or []) if isinstance(s, dict)]
        for nome in nomes:
            if any(_re.search(r"\b%s\b" % nome, tx) for tx in textos):
                lidos.add(nome)
        lidos |= {v for _p, tp, v in ln.efeitos if tp == "param"}
    return lidos


def eventos_da_maquina(maq, vocab, cfg, autor=None, predicados=None, pf=None):
    """Todos os eventos de todos os papéis que a máquina conhece, com todos os parâmetros.
    Respostas de IA vêm com a chave atual e a antiga; seus toques que exigem versão vêm com a
    versão atual e a antiga; predicados externos (de outras máquinas) vêm com os dois valores."""
    usados = {(ln.papel, ln.evento) for ln in maq.linhas}
    if maq.nome == "etapa":   # o autor pode tentar qualquer ação, inclusive as desligadas
        usados |= {("AUTOR", a) for a in vocab["acoes"]["AUTOR"]}
        usados |= {("REVISOR", a) for a in vocab["acoes"]["REVISOR"]}
    usados |= {("FUNDADOR", b) for b in vocab["botoes_do_fundador"]}
    atores = agentes_representativos(vocab, pf)
    evs = []
    for papel, evento in sorted(usados):
        params = dict(maq.parametros.get((papel, evento), {}))
        lidos = parametros_lidos(maq, papel, evento)
        for nome in list(params):
            espec = ESPEC_PARAMS_LIDOS.get(nome, ())
            if nome not in lidos and not (espec is None or evento in espec):
                params[nome] = params[nome][:1]   # ninguém lê: todos os valores dão o mesmo passo
        if "escolhido" in params and pf is not None:   # mesma simetria para o revisor escolhido
            params["escolhido"] = [x for x in params["escolhido"] if x in set(atores) | {vocab["identidades"]["fundador"]}]
        externos = sorted({x for ln in maq.linhas if ln.papel == papel and ln.evento == evento for x in ln.usa_ext})
        for p in combinacoes(params):
            for valores_ext in itertools.product((True, False), repeat=len(externos)):
                q = dict(cfg)
                q.update(p)
                q.update(zip(externos, valores_ext))
                if predicados:
                    q.update(predicados(p))
                if papel == "AUTOR":
                    for chave in ("atual", "antiga"):
                        evs.append(Ev(papel, evento, p, autor, chave, q))
                elif papel == "REVISOR":
                    for ator in atores:
                        for chave in ("atual", "antiga"):
                            evs.append(Ev(papel, evento, p, ator, chave, q))
                elif papel == "HELENA":
                    for chave in ("atual", "antiga"):
                        evs.append(Ev(papel, evento, p, None, chave, q))
                elif papel == "FUNDADOR" and evento in ESPEC_BOTOES_COM_VERSAO:
                    for chave in ("atual", "antiga"):   # 'antiga' = versão que você viu já mudou
                        evs.append(Ev(papel, evento, p, None, chave, q))
                else:
                    evs.append(Ev(papel, evento, p, None, "atual", q))
    return evs


# ----------------------------------------------------------------------------- especificação
# Variáveis fantasma da etapa (a tabela não as controla):
#   g_viva  execução viva conhecida pelo motor (0/1)
#   g_exec  execuções gastas desde a última ordem sua (autor + revisor; infra devolve)
#   g_infra falhas de infraestrutura desde a última ordem sua
#   g_fresca a última execução do autor leu a informação atual (regra 10)
#   g_portao a entrega atual passou no portão 1
#   g_leu   a tentativa atual é a nova tentativa de FORMATO, sobre o texto de uma execução que
#           pode ter lido a internet (etapa com internet). O uso da execução atual vem DENTRO da
#           resposta (usou_internet, lido pelo motor no registro de uso), nunca de outro evento.
#   g_lemb  um lembrete já foi entregue nesta espera por você (MEL-37)
FANTASMA_ETAPA_INICIAL = (0, 0, 0, 1, 0, 0, 0)
FANTASMA_ACAO_INICIAL = (0, 0, 0)   # g_ok (seu ok registrado), g_n (execuções externas), g_lemb


def conferir_etapa(m, pre, ev, ln, pos, pf, tetos):
    """Confere UMA passagem da etapa contra a especificação. Devolve (fantasma novo, violações)."""
    n = m.n
    gv, ge, gi, gf, gp, gl, glb = pre[n:n + 7]
    V = []
    e, p = ev.evento, ev.papel
    de, para = pre[0], pos[0]
    I = m.idx
    cfg = pf["cfg"]
    ordem = ((p == "FUNDADOR" and (e == "PEDIR_AJUSTE" or (e == "RESPONDER" and ev.params.get("opcao") in OPCOES_QUE_SAO_ORDEM)))
             or e in ("DECISAO_MUDOU", "REABRIR_POR_ORDEM"))
    if de in m.finais:
        V.append(("R02", "um final voltou a andar"))
    # A-6 / regra 9: um toque seu sobre uma versão que você não viu nunca muda a etapa
    if p == "FUNDADOR" and e in ESPEC_BOTOES_COM_VERSAO and ev.chave != "atual":
        V.append(("R09", f"toque seu ({e}) sobre uma versão que você não viu foi aceito"))
    # regra 3: execução viva e chave (autor, revisor e Helena)
    if p == "HELENA" and ev.chave != "atual":
        V.append(("R03", "resposta de chamada antiga da Helena gravou"))
    infra_ev = e in EVENTOS_DE_INFRA or (de == "VALIDACAO" and e == "TEMPO_ESGOTADO")   # o validador é código nosso
    if e in ("INICIAR_EXECUCAO", "INICIAR_REVISAO"):
        if gv:
            V.append(("R03", "segunda execução viva na mesma etapa"))
        gv, ge = 1, ge + 1
        if e == "INICIAR_EXECUCAO":
            gf, gp = 1, 0
    elif p in ("AUTOR", "REVISOR"):
        if not gv:
            V.append(("R03", "resposta de agente aceita sem execução viva"))
        if ev.chave != "atual":
            V.append(("R03", "resposta de execução antiga gravou"))
        gv = 0
        if e == "ENTREGAR":
            gp = 0
    elif infra_ev:
        if gv and e != "SEM_CAPACIDADE":
            ge, gv = ge - 1, 0
        gi = min(gi + 1, tetos["TETO_INFRA"])
        if pos[I["execucoes"]] > pre[I["execucoes"]]:
            V.append(("R12", "falha de infraestrutura gastou tentativa"))
    elif e in ("FALHA", "TEMPO_ESGOTADO") and gv and de in ESTADOS_DE_EXECUCAO:
        gv = 0
    elif e in EVENTOS_QUE_ENVELHECEM + ("CANCELADO_PAI",) and gv:
        ge, gv = ge - 1, 0
    if de == "VALIDACAO" and p in ("MOTOR", "RELOGIO", "VIGIA") and pos[I["execucoes"]] > pre[I["execucoes"]]:
        V.append(("R12", f"o validador ({e}) gastou tentativa do autor"))
    if gv and para not in ESTADOS_DE_EXECUCAO:
        gv = 0
    if para == "EXECUTANDO" and not gv:
        V.append(("R03", "etapa executando sem execução viva com chave nova"))
    if ordem:
        ge, gi = 0, 0
    ge = max(ge, 0)
    # regra 10: informação nova envelhece o que estava feito
    if e in EVENTOS_QUE_ENVELHECEM or (p == "FUNDADOR" and e == "PEDIR_AJUSTE"):
        gf, gp = 0, 0
    if e == "PORTAO1_OK":
        gp = 1
    elif e in ("PORTAO1_RECUSOU", "REPROVAR"):
        gp = 0
    if para in ("NA_FILA", "AGUARDANDO_ANTERIORES", "EXECUTANDO", "VALIDACAO", "EM_RESOLUCAO"):
        gp = 0   # voltou ao trabalho: não existe entrega atual conferida
    # quem leu a internet só entrega ou registra falha, em qualquer ordem de eventos
    usou = ev.params.get("usou_internet") == "SIM"
    if p == "AUTOR" and e in ("PERGUNTAR", "DEVOLVER_A_QUEM_PEDIU", "PEDIR_SUBCARD") and (usou or gl):
        V.append(("INTERNET", f"autor que leu a internet conseguiu {e}"))
    if e == "FALHA" and ev.params.get("classe") == "FORMATO_ERRADO" and de == "EXECUTANDO" and para in ("NA_FILA", "EXECUTANDO"):
        gl = 1 if cfg["tem_internet"] else 0   # a nova tentativa de formato trabalha sobre o mesmo texto
    elif (ordem or e in EVENTOS_QUE_ENVELHECEM or p not in ("MOTOR", "RELOGIO", "VIGIA")
          or para not in ("NA_FILA", "EXECUTANDO") or (de == "EXECUTANDO" and para != "EXECUTANDO")):
        gl = 0   # qualquer outra tentativa é execução nova, com o uso dela dentro da resposta
    # MEL-37: o padrão só corre depois de um lembrete entregue nesta espera
    lemb_antes = glb
    if para == "ESPERANDO_FUNDADOR" and de != "ESPERANDO_FUNDADOR":
        glb = 0
    if p == "RELOGIO" and e == "LEMBRETE_24H":
        glb = 1
    if p == "RELOGIO" and e == "PRAZO_ESPERA_VENCIDO" and not lemb_antes:
        V.append(("R01", "o padrão correu sem nenhum lembrete entregue (MEL-37)"))
    if para != "ESPERANDO_FUNDADOR":
        glb = 0
    # regra 4
    if p == "REVISOR":
        if ev.ator == pf["autor"]:
            V.append(("R04", "o autor respondeu como revisor da própria entrega"))
        if ev.ator in pf["julgadores"]:
            V.append(("R04", "quem julga a peça depois respondeu como revisor"))
        if ev.ator != pre[I["revisor"]]:
            V.append(("R04", "resposta de revisor que não é o designado"))
    if para == "REVISAO" and de != "REVISAO":
        r = pos[I["revisor"]]
        if r == pf["autor"] or r in pf["julgadores"] or r not in pf["revisores"]:
            V.append(("R04", f"revisor designado inválido ({r})"))
    # regra 5: ajuste volta ao autor (ou, no teto das suas ordens, a peça é descartada e o card substituído)
    if e in ("REPROVAR", "AJUSTE_DO_JULGADOR") or (p == "FUNDADOR" and e == "PEDIR_AJUSTE"):
        descartada = p == "FUNDADOR" and para in m.finais and para != "PRONTA"
        if not (m.dono(para) == "AUTOR" or para == "EM_RESOLUCAO" or descartada):
            V.append(("R05", f"ajuste não voltou ao autor ({e} -> {para})"))
    if ge > tetos["TETO_EXECUCOES"]:
        V.append(("R05", "mais execuções que o teto na mesma rodada"))
        ge = tetos["TETO_EXECUCOES"] + 1
    # regras 9 e 10: aprovação e pronta
    if para == "APROVADA" and de != "APROVADA":
        if not ((p == "REVISOR" and e == "APROVAR") or (p == "FUNDADOR" and e == "APROVAR")):
            V.append(("R09", f"aprovada sem aprovação de revisor ou sua ({p} {e})"))
        if not gp:
            V.append(("R09", "aprovada sem passar pelo portão 1"))
        if not gf:
            V.append(("R10", "aprovada com informação velha"))
        if cfg["julgadora"] and not (p == "FUNDADOR" and e == "APROVAR"):
            V.append(("R09", "parecer jurídico aprovado sem o seu Aprovar (você é o segundo revisor)"))
    if cfg["julgadora"] and p == "REVISOR" and e == "APROVAR" and para != "ESPERANDO_FUNDADOR":
        V.append(("R09", f"parecer jurídico valeu só com o revisor de IA (-> {para})"))
    if para == "PRONTA" and de != "PRONTA":
        if de != "APROVADA":
            V.append(("R09", f"pronta sem estar aprovada (veio de {de})"))
        if not gf:
            V.append(("R10", "pronta com informação velha"))
    # regra 12
    if infra_ev:
        if gi >= tetos["TETO_INFRA"] and para != "ESPERANDO_FUNDADOR" and para not in m.finais:
            V.append(("R12", "no teto de falhas de infraestrutura não chamou você"))
    # todo contador dentro do teto
    for var, teto in m.teto_var.items():
        if pos[I[var]] > teto:
            V.append(("R05", f"contador {var} passou do teto {teto}"))
    return (gv, ge, gi, gf, gp, gl, glb), V


def conferir_acao(m, pre, ev, ln, pos):
    n = m.n
    gok, gn, glb = pre[n:n + 3]
    V = []
    de, para = pre[0], pos[0]
    if de in m.finais:
        V.append(("R02", "um final da ação externa voltou a andar"))
    if ev.papel == "FUNDADOR" and ev.evento in ESPEC_BOTOES_COM_VERSAO and ev.chave != "atual":
        V.append(("R08", f"toque seu ({ev.evento}) sobre uma versão da ação que você não viu foi aceito"))
    if ev.papel == "FUNDADOR" and ev.evento == "APROVAR":
        gok = 1
    if para == "EXECUTANDO_ACAO" and de != "EXECUTANDO_ACAO":
        if ev.papel != "MOTOR":
            V.append(("R08", f"ação externa executada por {ev.papel}"))
        if not gok:
            V.append(("R08", "ação externa executada sem o seu ok registrado"))
        if gn >= 1:
            V.append(("R08", "ação externa executada mais de uma vez"))
        gn = min(gn + 1, 2)
    if para == "EXECUTADA" and gn == 0:
        V.append(("R08", "ação marcada executada sem execução pelo motor"))
    if de == "INCERTA" and para == "FALHOU" and not (ev.papel == "FUNDADOR" and ev.evento == "RESPONDER"
                                                      and ev.params.get("opcao") == "NAO_ACONTECEU"):
        V.append(("R08", "ação que pode ter acontecido marcada como falha sem a sua confirmação (poderia ser feita duas vezes)"))
    lemb_antes = glb
    if para != de:
        glb = 0
    if ev.papel == "RELOGIO" and ev.evento == "LEMBRETE_24H":
        glb = 1
    if ev.papel == "RELOGIO" and ev.evento == "PRAZO_ESPERA_VENCIDO" and not lemb_antes:
        V.append(("R01", "o padrão da ação correu sem nenhum lembrete entregue (MEL-37)"))
    i_fim = m.idx.get("fim")
    if i_fim and pos[i_fim] == "FUNDADOR" and pre[i_fim] != "FUNDADOR" and ev.papel != "FUNDADOR":
        V.append(("R13", f"fim registrado como seu sem toque seu ({ev.papel} {ev.evento})"))
    for var, teto in m.teto_var.items():
        if pos[m.idx[var]] > teto:
            V.append(("R05", f"contador {var} passou do teto {teto}"))
    return (gok, gn, glb), V


def situacao_fn(tab, m):
    """Função α: estado concreto da etapa -> situação (primeira regra que casa)."""
    regras = []
    for r in tab["situacao_da_etapa"]:
        est = r["estado"] if isinstance(r["estado"], list) else [r["estado"]]
        conds = [(m.idx[k], v) for k, v in r.items() if k not in ("estado", "situacao")]
        regras.append((set(est), conds, r["situacao"]))

    chaves = sorted({i for _e, conds, _s in regras for i, _v in conds})
    memo = {}

    def alfa(s):
        k = (s[0],) + tuple(s[i] for i in chaves)
        r = memo.get(k, 0)
        if r != 0:
            return r
        r = None
        for est, conds, sit in regras:
            if s[0] in est and all(s[i] == v for i, v in conds):
                r = sit
                break
        memo[k] = r
        return r
    return alfa


# ----------------------------------------------------------------------------- camada 1
def caminho(pais, evs, i):
    passos = []
    while pais[i] is not None:
        j, k, lid, _nv = pais[i]
        passos.append(f"{evs[k].rotulo} [{lid}]")
        i = j
    return list(reversed(passos))


def acha_ciclo(n, adj):
    """DFS iterativa; devolve um ciclo (lista de nós) ou None."""
    cor = bytearray(n)   # 0 branco, 1 cinza, 2 preto
    pai = [-1] * n
    for raiz in range(n):
        if cor[raiz]:
            continue
        pilha = [(raiz, iter(adj[raiz]))]
        cor[raiz] = 1
        while pilha:
            u, it = pilha[-1]
            avancou = False
            for v in it:
                if cor[v] == 0:
                    cor[v] = 1
                    pai[v] = u
                    pilha.append((v, iter(adj[v])))
                    avancou = True
                    break
                if cor[v] == 1:
                    ciclo = [v]
                    w = u
                    while w != v and w != -1:
                        ciclo.append(w)
                        w = pai[w]
                    return list(reversed(ciclo))
            if not avancou:
                cor[u] = 2
                pilha.pop()
    return None


def ordem_do_fundador(ev):
    return ev.papel == "FUNDADOR" and (ev.evento == "PEDIR_AJUSTE" or
                                       (ev.evento == "RESPONDER" and ev.params.get("opcao") in OPCOES_QUE_SAO_ORDEM))


def explorar(m, evs, conferir, fantasma_ini, rel, tetos, papeis_sistema, alfa=None, pf=None, rotulo=""):
    """Busca em largura exaustiva. Devolve medidas e, para a etapa, os passos abstratos.

    Cada passo abstrato leva a condição sob a qual vale: o contador do card que a guarda lê
    ('abaixo' ou 'teto') e o valor do predicado externo (ex.: anteriores_satisfeitas). A camada 2
    só usa o passo quando a condição casa com o card e com as outras etapas."""
    n = m.n
    ini = m.inicial() + fantasma_ini
    vistos = {ini: 0}
    estados = [ini]
    pais = [None]
    adj = [[]]
    autor = pf["autor"] if pf else None
    # regra geral que só depende do evento: decidida uma vez (o evento recusado nunca anda)
    recusado = [m.recusa_por_regra(ev, ev.evento, autor) for ev in evs]
    ordem_f = [ordem_do_fundador(ev) for ev in evs]
    eventos_por_estado = {}
    for est in m.estados:
        lst = []
        for k, ev in enumerate(evs):
            cands = [ln for ln in m.por_chave.get((est, ev.evento), ()) if ln.papel == ev.papel]
            if cands and not recusado[k]:
                lst.append((k, ev, cands, m.atribuicoes(cands)))
            elif (est, ev.evento) in m.por_chave or ev.evento in m.entradas:
                lst.append((k, ev, [], ((),)))
        eventos_por_estado[est] = lst
    sistema = set(papeis_sistema)
    abs_mov = defaultdict(set)     # situação -> {(papel, evento, situação', Δ, sinais, condição)}
    abs_inp = defaultdict(set)     # (situação, evento de entrada) -> {(situação', sinais, Δ)}
    abs_ref = defaultdict(int)     # (situação, evento de entrada) -> nº de estados que recusam
    entradas_unicas = {}
    for k, ev in enumerate(evs):
        if ev.evento in m.entradas and ev.evento not in entradas_unicas:
            entradas_unicas[ev.evento] = k
    transicoes = paradas = 0
    i_ord = m.idx.get("ordens")
    teto_ord = m.teto_var.get("ordens")
    i = 0
    while i < len(estados):
        if rel.parou:
            break
        s = estados[i]
        est = s[0]
        tem_alguma = tem_sistema = tem_sistema_interna = False
        a_s = (alfa(s), s[n + 3]) if alfa else None
        if alfa and a_s[0] is None:
            rel.add("LIGACAO", f"{rotulo}: estado concreto sem situação ({est})", caminho(pais, evs, i))
        for k, ev, cands, atribs in eventos_por_estado.get(est, ()):
            aceitos = {} if (i_ord and len(atribs) > 1 and ordem_f[k]) else None
            for na, atrib in enumerate(atribs):
                s2 = m.com(s, atrib)
                lns = m.casar_cands(s2, cands, ev, autor, sem_regra_estatica=True) if cands else cands
                if aceitos is not None:
                    aceitos[atrib] = bool(lns)
                if not lns:
                    if alfa and k == entradas_unicas.get(ev.evento):
                        abs_ref[(a_s, ev.evento)] += 1
                    continue
                if len(lns) > 1:
                    rel.add("R13", f"{rotulo}: duas linhas para o mesmo evento ({', '.join(l.id for l in lns)})",
                            caminho(pais, evs, i) + [ev.rotulo])
                entrada = ev.evento in m.entradas
                for ln in lns:
                    pos_t = m.aplicar(s2, ln, ev.params)
                    g, V = conferir(m, s2, ev, ln, pos_t, pf, tetos) if pf is not None else conferir(m, s2, ev, ln, pos_t)
                    for regra, msg in V:
                        rel.add(regra, f"{rotulo}: {msg}", caminho(pais, evs, i) + [f"{ev.rotulo} [{ln.id}]"])
                    transicoes += 1
                    tem_alguma = True
                    if ev.papel in sistema:
                        tem_sistema = True
                        if not entrada:
                            tem_sistema_interna = True
                    # passos que gastam contador do card só terminam provados na camada 2
                    conta_no_card = any(ln.delta)
                    sin = m.sinais_de(ln, s2, ev.q) if alfa else ()
                    pos = m.canon(m.sem_comp(pos_t[:n]) + g, fantasma_ini)
                    j = vistos.get(pos)
                    if j is None:
                        j = len(estados)
                        if j >= MAX_ESTADOS:
                            raise BuscaSemFim(f"{rotulo}: mais de {MAX_ESTADOS} estados (contador sem teto?)")
                        vistos[pos] = j
                        estados.append(pos)
                        pais.append((i, k, ln.id, na))
                        adj.append([])
                    if not entrada and not conta_no_card:
                        adj[i].append(j)
                    if alfa:
                        a_p = (alfa(pos), pos[n + 3])
                        cond = tuple(sorted([(v, "teto" if s2[m.idx[v]] >= m.teto_var[v] else "abaixo") for v in ln.usa_comp]
                                            + [(x, bool(ev.q.get(x))) for x in ln.usa_ext]))
                        if entrada:
                            if k == entradas_unicas.get(ev.evento):
                                abs_inp[(a_s, ev.evento)].add((a_p, sin, ln.delta))
                        elif a_p != a_s or conta_no_card or sin:
                            abs_mov[a_s].add((ev.papel, ev.evento, a_p, ln.delta, sin, cond))
                        else:
                            paradas += 1
            if aceitos:
                # uma ordem sua aceita abaixo do teto tem passagem também NO teto (card novo ligado):
                # nunca vira comentário, e o padrão não corre por cima da sua resposta
                for a, ok in aceitos.items():
                    if ok and dict(a).get(i_ord) == 0:
                        a2 = tuple((x, teto_ord if x == i_ord else v) for x, v in a)
                        if not aceitos.get(a2):
                            regra = "R10" if ev.evento == "PEDIR_AJUSTE" else "R11"
                            rel.add(regra, f"{rotulo}: no teto de ordens, {ev.rotulo} vira comentário em {est} "
                                           "(sem passagem: o card seguiria como está)", caminho(pais, evs, i))
        if est in m.abertos:
            if not tem_alguma:
                rel.add("R02", f"{rotulo}: estado aberto sem saída ({est})", caminho(pais, evs, i))
            elif not tem_sistema:
                rel.add("R01", f"{rotulo}: estado aberto que só sai por IA ou por você ({est})", caminho(pais, evs, i))
            elif alfa and a_s[0] == "TRABALHO" and not tem_sistema_interna:
                rel.add("R01", f"{rotulo}: trabalho sem saída própria pelo relógio ou motor ({est})", caminho(pais, evs, i))
        i += 1
    ciclo = None if rel.parou else acha_ciclo(len(estados), adj)
    if ciclo:
        rel.add("R02", f"{rotulo}: ciclo sem teto (passos que se repetem sem gastar contador)",
                [estados[c][0] for c in ciclo[:12]])
    return {"estados": len(estados), "transicoes": transicoes, "paradas": paradas,
            "mov": abs_mov, "inp": abs_inp, "ref": abs_ref, "lista": estados, "pais": pais, "evs": evs}


def reproduzir_amostra(m, med, conferir, fantasma_ini, rel, tetos, pf=None, rotulo="", amostra=300):
    """Regra 13: refaz, só a partir do histórico (caminho de eventos), uma amostra de estados."""
    n = m.n
    lista, pais, evs = med["lista"], med["pais"], med["evs"]
    passo = max(1, len(lista) // amostra)
    conferidos = 0
    for i in range(0, len(lista), passo):
        eventos = []
        j = i
        while pais[j] is not None:
            a, k, _lid, nv = pais[j]
            eventos.append((k, nv))
            j = a
        s = m.inicial() + fantasma_ini
        for k, nv in reversed(eventos):
            ev = evs[k]
            cands = [ln for ln in m.por_chave.get((s[0], ev.evento), ()) if ln.papel == ev.papel]
            s2 = m.com(s, m.atribuicoes(cands)[nv])
            lns = m.casar_cands(s2, cands, ev, pf["autor"] if pf else None)
            if len(lns) != 1:
                break   # ambiguidade já é acusada pela busca
            pos_t = m.aplicar(s2, lns[0], ev.params)
            g, _ = conferir(m, s2, ev, lns[0], pos_t, pf, tetos) if pf is not None else conferir(m, s2, ev, lns[0], pos_t)
            s = m.canon(m.sem_comp(pos_t[:n]) + g, fantasma_ini)
        if s != lista[i]:
            rel.add("R13", f"{rotulo}: o histórico não reconstrói o estado", [lista[i][0]])
        conferidos += 1
    return conferidos


def conferir_cobertura_de_revisores(m, med, pf, vocab, rel, rot):
    """Regra 4 sem garantia falsa: todo revisor válido da ficha tem que aparecer de fato numa
    revisão percorrida (o FUNDADOR, na espera por você com motivo REVISAO). Um revisor que a
    prova nunca alcançou é revisão que rodaria em produção sem ter sido conferida."""
    i_rev, i_mot = m.idx["revisor"], m.idx["motivo"]
    fundador = vocab["identidades"]["fundador"]
    vistos = set()
    for s in med["lista"]:
        if s[0] == "REVISAO":
            vistos.add(s[i_rev])
        elif s[0] == "ESPERANDO_FUNDADOR" and s[i_mot] == "REVISAO" and s[i_rev] == fundador:
            vistos.add(fundador)
    for r in pf["revisores_validos"]:
        if r not in vistos:
            rel.add("R04", f"{rot}: o revisor válido {r} nunca chega a revisar na prova (revisão sem conferência)")


def camada1(vocab, tab, maqs, rel, perfis):
    tetos = maqs["etapa"].tetos
    sistema = vocab["papeis_do_sistema"]
    m = maqs["etapa"]
    alfa = situacao_fn(tab, m)
    resultados = {}
    for pf in perfis:
        validos = set(pf["revisores_validos"])

        def pred(p, validos=validos):
            return {"revisor_valido": p.get("escolhido") in validos} if "escolhido" in p else {}
        # a camada 1 percorre a etapa com o card ativo; a camada 2 percorre todos os estados do card
        # e deixa a regra da tabela (etapa_so_anda_com_card_ativo) recusar
        cfg = dict(pf["cfg"], estado_card="EM_ANDAMENTO")
        evs = eventos_da_maquina(m, vocab, cfg, autor=pf["autor"], predicados=pred, pf=pf)
        rot = f"etapa {pf['id']}"
        med = explorar(m, evs, conferir_etapa, FANTASMA_ETAPA_INICIAL, rel, tetos, sistema, alfa=alfa, pf=pf, rotulo=rot)
        med["reproduzidos"] = 0 if rel.parou else reproduzir_amostra(m, med, conferir_etapa, FANTASMA_ETAPA_INICIAL, rel, tetos, pf=pf, rotulo=rot)
        if not rel.parou:
            conferir_cobertura_de_revisores(m, med, pf, vocab, rel, rot)
        resultados[pf["id"]] = med
    ma = maqs["acao_externa"]
    for tem in (True, False):
        evs = eventos_da_maquina(ma, vocab, {"tem_ferramenta": tem})
        rot = f"ação externa ({'com' if tem else 'sem'} ferramenta)"
        med = explorar(ma, evs, conferir_acao, FANTASMA_ACAO_INICIAL, rel, tetos, sistema, rotulo=rot)
        med["reproduzidos"] = 0 if rel.parou else reproduzir_amostra(ma, med, conferir_acao, FANTASMA_ACAO_INICIAL, rel, tetos, rotulo=rot)
        resultados[rot] = med
    return resultados


# ----------------------------------------------------------------------------- camada 2
def _nomes_lidos(m, ln):
    """Variáveis da máquina que a linha lê (guarda e condição dos sinais)."""
    import re as _re
    textos = [ln.guarda_txt] + [s.get("se", "") for s in (ln.bruta.get("sinais") or []) if isinstance(s, dict)]
    return {v for v in m.vars for tx in textos if _re.search(r"\b%s\b" % v, tx)}


def grupos_independentes(m):
    """Grupos de variáveis do card que só aparecem em linhas 'para: MESMO', sem sinais, que só
    leem e escrevem o próprio grupo (ex.: nível do prazo e mudanças de prazo). Eles não mudam
    nenhum outro caminho: são conferidos à parte e a camada 2 os deixa fora do estado."""
    escreve = {id(ln): {m.vars[p - 1] for p, _t, _v in ln.efeitos} for ln in m.linhas}
    le = {id(ln): _nomes_lidos(m, ln) for ln in m.linhas}
    cand = {v for v in m.vars if v in m.teto_var and v not in m.compartilhadas}
    grupos, feitos = [], set()
    for v0 in sorted(cand):
        if v0 in feitos:
            continue
        g, mudou = {v0}, True
        while mudou:
            mudou = False
            for ln in m.linhas:
                toca = escreve[id(ln)] | le[id(ln)]
                if toca & g and not toca <= g:
                    g |= toca
                    mudou = True
        feitos |= g
        if not g <= cand:
            continue
        linhas = [ln for ln in m.linhas if (escreve[id(ln)] | le[id(ln)]) & g]
        if linhas and all(ln.para == ln.de and not ln.sinais for ln in linhas):
            grupos.append((tuple(sorted(g)), linhas))
    return grupos


def conferir_grupo(m, g, linhas, rel):
    """Percorre sozinho o grupo: todo valor dentro do teto e nenhum ciclo (cada passo gasta
    um contador com teto). As guardas do grupo só leem o grupo, então os estados de origem
    não mudam o resultado."""
    idx = [m.idx[v] for v in g]
    base = list(m.inicial())
    ini = tuple(base[i] for i in idx)
    vistos, fila, adj = {ini: 0}, [ini], [[]]
    lista = [ini]
    while fila:
        x = fila.pop()
        ix = vistos[x]
        s = list(base)
        for i, val in zip(idx, x):
            s[i] = val
        for ln in linhas:
            s[0] = ln.de
            st = tuple(s)
            if ln.guarda is None or ln.guarda(st, defaultdict(lambda: False)):
                y = tuple(m.aplicar(st, ln, {})[i] for i in idx)
                for v, val in zip(g, y):
                    if val > m.teto_var[v]:
                        rel.add("R05", f"card: {v} passou do teto {m.teto_var[v]} ({ln.id})")
                if y == x:
                    continue
                j = vistos.get(y)
                if j is None:
                    j = vistos[y] = len(lista)
                    lista.append(y)
                    adj.append([])
                    fila.append(y)
                adj[ix].append(j)
    ciclo = acha_ciclo(len(lista), adj)
    if ciclo:
        rel.add("R02", f"card: {', '.join(g)} anda em círculo sem teto")
    return len(lista)


def conferir_prazo_do_card(mc, tab, rel):
    """Especificação do prazo do card (regra 1), conferida em TODO estado aberto:
    cada aviso (80%, vencido, +1h) vale enquanto o card não passou dele, mesmo que um aviso
    anterior se tenha perdido; e a sua mudança de prazo rearma os avisos (até o teto declarado)."""
    if "nivel_prazo" not in mc.idx:
        rel.add("R01", "card sem nível de prazo")
        return 0
    i_n = mc.idx["nivel_prazo"]
    i_m = mc.idx.get("mudancas_prazo")
    tetos_m = range(0, (mc.teto_var.get("mudancas_prazo", 0)) + 1) if i_m else [None]
    conferidos = 0
    for est in sorted(mc.abertos):
        for nivel in range(0, max(ESPEC_NIVEIS_PRAZO.values()) + 1):
            for mud in tetos_m:
                s = list(mc.inicial())
                s[0], s[i_n] = est, nivel
                if i_m:
                    s[i_m] = mud
                s = tuple(s)
                conferidos += 1
                for evento, alvo in ESPEC_NIVEIS_PRAZO.items():
                    lns = mc.casar(s, "RELOGIO", evento, {})
                    if nivel < alvo:
                        if not lns or mc.aplicar(s, lns[0], {})[i_n] != alvo:
                            rel.add("R01", f"card.{est}: o aviso {evento} se perde com o nível em {nivel}")
                    elif lns and mc.aplicar(s, lns[0], {})[i_n] < nivel:
                        rel.add("R01", f"card.{est}: o aviso {evento} rebaixa o nível do prazo")
                lns = mc.casar(s, "FUNDADOR", "MUDAR_PRAZO", {}, chave="atual")
                for ln in lns:
                    if mc.aplicar(s, ln, {})[i_n] != 0:
                        rel.add("R01", f"card.{est}: mudar o prazo não rearma os avisos ({ln.id})")
                if nivel == 0 and (mud in (None, 0)) and not lns:
                    rel.add("R01", f"card.{est}: mudar o prazo não rearma os avisos (o seu toque não chega à máquina)")
    return conferidos


def camada2(vocab, tab, maqs, rel, perfis, c1):
    mc, me = maqs["card"], maqs["etapa"]
    tetos = mc.tetos
    sistema = set(vocab["papeis_do_sistema"])
    pr = tab["predicados"]
    satisfaz, pronta = set(pr["satisfaz_dependencia"]), set(pr["conta_como_pronta"])
    falha, aberta = set(pr["falha_que_pergunta"]), set(pr["aberta"])
    N = len(perfis)
    pos_id = {p["id"]: k for k, p in enumerate(perfis)}
    deps = [[pos_id[d] for d in p["depende_de"]] for p in perfis]
    dependentes = [[k for k, p in enumerate(perfis) if perfis[j]["id"] in p["depende_de"]] for j in range(N)]
    julgadas = [[pos_id[x] for x in p["julga"]] for p in perfis]
    usa_dec = [p["cfg"]["usa_decisao"] for p in perfis]
    pulavel = [p["cfg"]["pulavel"] for p in perfis]
    MOV = [c1[p["id"]]["mov"] for p in perfis]
    INP = [c1[p["id"]]["inp"] for p in perfis]
    REF = [c1[p["id"]]["ref"] for p in perfis]
    nomes_comp = ("ordens", "perguntas", "voltas")
    comp = [mc.idx[v] for v in nomes_comp]
    teto_comp = [mc.teto_var[v] for v in nomes_comp]
    grupos = grupos_independentes(mc)
    fora = {ln.id for _g, lns in grupos for ln in lns}
    ligs = tab["ligacoes"]
    so_por_sinal = bool(tab.get("regras_gerais", {}).get("entradas_so_por_sinal"))
    entradas_etapa = sorted(me.entradas)
    i_ord, teto_ord = mc.idx["ordens"], mc.teto_var["ordens"]
    i_fim = mc.idx["fim"]
    rotulo = "card"
    # pedido grande e pequeno numa busca só: o evento que lê 'pedido_grande' vem nas duas versões
    eventos = []
    for grande in (True, False):
        for ev in eventos_da_maquina(mc, vocab, {"pedido_grande": grande}):
            if ev.evento in mc.entradas and so_por_sinal:
                continue
            le = any("pedido_grande" in ln.guarda_txt for ln in mc.linhas if ln.evento == ev.evento and ln.papel == ev.papel)
            if grande or le:
                eventos.append(ev)
    por_estado = {}
    for est in mc.estados:
        lst = []
        for ev in eventos:
            cands = [ln for ln in mc.por_chave.get((est, ev.evento), ()) if ln.papel == ev.papel and ln.id not in fora]
            if cands:
                lst.append((ev, cands))
        por_estado[est] = lst

    def preds(slots):
        sits = [sl[0] for sl in slots]
        fs = [s in falha for s in sits]
        return {"todas_prontas": all(s in pronta for s in sits),
                "falha_sem_decisao": any(fs),
                "nao_pode_sem_decisao": any(s == "APROVADA_NAO_PODE" for s in sits),
                "falhas_pulaveis": all(pulavel[k] for k, f in enumerate(fs) if f)}

    def soma(card, delta, V):
        if not any(delta):
            return card
        lst = list(card)
        for c, d, t in zip(comp, delta, teto_comp):
            lst[c] += d
            if lst[c] > t:
                V.append(("R05", f"contador do card passou do teto ({mc.vars[c - 1]})"))
                return None
        return tuple(lst)

    def casa_cond(cond, card, sat):
        for nome, val in cond:
            if nome in nomes_comp:
                if (card[mc.idx[nome]] >= mc.teto_var[nome]) != (val == "teto"):
                    return False
            elif nome == "anteriores_satisfeitas":
                if sat != val:
                    return False
            else:
                raise ErroTabela(f"condição desconhecida num passo da etapa: {nome}")
        return True

    def entregar_etapa(card, slots, acoes, k, evento, V):
        sit, f = slots[k]
        chave = ((sit, f), evento)
        if not me.permite_com_card(evento, card[0]):
            V.append(("LIGACAO", f"{perfis[k]['id']}: {evento} chega com o card em {card[0]} e a tabela o recusa"))
            return [(card, slots, acoes)]
        if REF[k].get(chave, 0):
            V.append(("LIGACAO", f"{perfis[k]['id']}: {evento} recusado por estado concreto da situação {sit}"))
        res = INP[k].get(chave)
        if not res:
            V.append(("LIGACAO", f"{perfis[k]['id']}: nenhum estado da situação {sit} aceita {evento}"))
            return [(card, slots, acoes)]
        out = []
        for a2, sin2, d2 in sorted(res):
            c2 = soma(card, d2, V)
            if c2 is None:
                continue
            sl2 = list(slots)
            sl2[k] = a2
            out.extend(entregar(c2, tuple(sl2), acoes, k, sin2, V))
        return out

    def entregar(card, slots, acoes, origem, sinais, V):
        estados = [(card, slots, acoes)]
        for nome in sinais:
            lig = ligs[nome]
            novos = []
            for c, sl, ac in estados:
                if "no_card" in lig:
                    acao = lig["no_card"]
                    lst, la = list(sl), list(ac)
                    for k, (s_, f_) in enumerate(lst):
                        if acao == "marcar_falhas_como_puladas" and s_ in falha:
                            lst[k] = ("PULADA", f_)
                        elif acao == "nova_versao_das_falhas" and s_ in falha:
                            lst[k] = ("ESPERA", 1)   # versão nova; a antiga continua final no histórico
                    if acao == "criar_acao_externa":
                        # regra 8 e 10, conferidas aqui pela especificação: a ação externa só nasce de
                        # entrega final aprovada e fresca, com o card pronto, e uma vez por etapa
                        s_o, f_o = lst[origem] if origem is not None else (None, 0)
                        if origem is None or s_o != "PRONTA" or c[0] != "PRONTO":
                            V.append(("R08", f"ação externa nasceu antes dos portões e do card pronto "
                                             f"({perfis[origem]['id'] if origem is not None else 'card'} em {s_o}, card {c[0]})"))
                        elif not f_o:
                            V.append(("R10", f"ação externa nasceu de entrega velha ({perfis[origem]['id']})"))
                        if origem is not None:
                            if la[origem] >= 1:
                                V.append(("R08", f"segunda ação externa para a mesma etapa ({perfis[origem]['id']}): "
                                                 "a mesma ação poderia ser executada duas vezes"))
                            la[origem] = min(la[origem] + 1, 2)
                    novos.append((c, tuple(lst), tuple(la)))
                    continue
                ev = lig["entrega"]["evento"]
                atuais = [(c, sl, ac)]
                for alvo in lig.get("para", []):
                    if alvo == "acoes_abertas":
                        # a ação só existe depois do card pronto (conferido em criar_acao_externa) e todo
                        # estado aberto dela aceita o cancelamento (conferido na estrutura, LIGACAO)
                        continue
                    if alvo == "card":
                        prox = []
                        for c_, s_, a_ in atuais:
                            q = dict(preds(s_))
                            lns = mc.casar(c_, lig["entrega"]["papel"], ev, q)
                            if not lns:
                                V.append(("LIGACAO", f"card no estado {c_[0]} não aceita o sinal {ev}"))
                                prox.append((c_, s_, a_))
                                continue
                            for ln in lns:
                                c2 = mc.aplicar(c_, ln, {})
                                prox.extend(entregar(c2, s_, a_, None, mc.sinais_de(ln, c_, q), V))
                        atuais = prox
                        continue
                    prox = []
                    for c_, s_, a_ in atuais:
                        if alvo == "etapas_abertas":
                            ks = [k for k in range(N) if s_[k][0] in aberta]
                        elif alvo == "etapas_aprovadas":
                            ks = [k for k in range(N) if s_[k][0] in ("APROVADA", "APROVADA_NAO_PODE")]
                        elif alvo == "etapas_abertas_que_usam_decisao":
                            ks = [k for k in range(N) if s_[k][0] in aberta and usa_dec[k]]
                        elif alvo == "dependentes_diretos_abertos":
                            ks = [k for k in dependentes[origem] if s_[k][0] in aberta]
                        elif alvo == "julgadas_abertas":
                            ks = [k for k in julgadas[origem] if s_[k][0] in aberta]
                        elif alvo == "julgadas_de_nao_pode":
                            ks = sorted({x for i in range(N) if s_[i][0] == "APROVADA_NAO_PODE" for x in julgadas[i]
                                         if s_[x][0] in aberta})
                        else:
                            raise ErroTabela(f"alvo de ligação desconhecido: {alvo}")
                        parcial = [(c_, s_, a_)]
                        for k in ks:
                            parcial = [r for (cc, ss, aa) in parcial for r in entregar_etapa(cc, ss, aa, k, ev, V)]
                        prox.extend(parcial)
                    atuais = prox
                novos.extend(atuais)
            estados = novos
        return estados

    def sucessores(cfg_):
        card, slots, g_plano, acoes = cfg_
        out = []
        q_pred = preds(slots)
        for ev, cands in por_estado.get(card[0], ()):
            q = dict(ev.q)
            q.update(q_pred)
            lns = mc.casar_cands(card, cands, _EvSimples(ev.papel, q, ev.ator, ev.chave))
            if len(lns) > 1:
                rel.add("R13", f"{rotulo}: duas linhas para o mesmo evento ({', '.join(l.id for l in lns)})")
            if lns and ev.papel == "HELENA" and ev.chave != "atual":
                rel.add("R03", f"{rotulo}: resposta de chamada antiga da Helena mudou o card ({ev.rotulo})")
            if lns and ev.papel == "FUNDADOR" and ev.evento in ESPEC_BOTOES_COM_VERSAO and ev.chave != "atual":
                rel.add("R09", f"{rotulo}: toque seu sobre uma versão que você não viu mudou o card ({ev.rotulo})")
            if lns and ev.papel == "FUNDADOR" and card[i_ord] < teto_ord and any("ordens" in ln.usa_comp for ln in lns):
                c_t = list(card)
                c_t[i_ord] = teto_ord
                if not mc.casar_cands(tuple(c_t), cands, _EvSimples(ev.papel, q, ev.ator, ev.chave)):
                    rel.add("R11", f"{rotulo}: no teto de ordens, {ev.rotulo} vira comentário em {card[0]} "
                                   "(sem passagem: o padrão correria por cima da sua resposta)")
            for ln in lns:
                V = []
                c2 = mc.aplicar(card, ln, ev.params)
                for var, teto in mc.teto_var.items():
                    if c2[mc.idx[var]] > teto:
                        V.append(("R05", f"contador {var} do card passou do teto"))
                sin = mc.sinais_de(ln, card, q)
                gp2 = 1 if (g_plano or ev.evento == "PLANO_VALIDO") else 0
                for c3, s3, a3 in entregar(c2, slots, acoes, None, sin, V):
                    out.append((ev.papel, ev.evento, ln.id, (c3, s3, gp2, a3), V, "REFAZER_FALHAS" in sin))
        if card[0] in mc.finais:
            return out
        # passos das etapas em TODO estado aberto do card: quem recusa é a regra da tabela
        # (regras_gerais.etapa_so_anda_com_card_ativo), nunca uma constante da prova
        for j, (sit, f) in enumerate(slots):
            if sit not in aberta:
                continue
            sat = all(slots[d][0] in satisfaz for d in deps[j])
            for papel, evento, a2, delta, sin, cond in sorted(MOV[j].get((sit, f), ())):
                if not me.permite_com_card(evento, card[0]) or not casa_cond(cond, card, sat):
                    continue
                V = []
                c2 = soma(card, delta, V)
                if c2 is None:
                    rel.add("R05", f"{rotulo}: {papel} {evento}({perfis[j]['id']}) passa um contador do card do teto")
                    continue
                sl2 = list(slots)
                sl2[j] = a2
                for c3, s3, a3 in entregar(c2, tuple(sl2), acoes, j, sin, V):
                    out.append((papel, f"{evento}({perfis[j]['id']})", "etapa", (c3, s3, g_plano, a3), V, False))
            if not so_por_sinal:   # sem a regra, o motor conseguiria mandar a entrada direto
                for evento in entradas_etapa:
                    V = []
                    for c3, s3, a3 in entregar_etapa(card, slots, acoes, j, evento, V):
                        out.append(("MOTOR", f"{evento}({perfis[j]['id']}) direto", "entrada", (c3, s3, g_plano, a3), V, False))
        return out

    def conferir_passo(pre, pos, papel, evento, V, nova_versao):
        (c0, s0, _g0, _a0), (c1_, s1, _g1, _a1) = pre, pos
        if c0[0] in mc.finais:
            V.append(("R02", "card final voltou a andar"))
        if c1_[0] == "PRONTO" and c0[0] != "PRONTO":
            for k, (sit, f) in enumerate(s0):
                if sit not in ESPEC_SATISFAZ:
                    V.append(("R09", f"card pronto com {perfis[k]['id']} em {sit}"))
                elif sit == "APROVADA" and not f:
                    V.append(("R10", f"card pronto com {perfis[k]['id']} aprovada sobre informação velha"))
        if c1_[i_fim] == "FUNDADOR" and c0[i_fim] != "FUNDADOR" and papel != "FUNDADOR":
            V.append(("R13", f"o card ficou registrado como decisão sua sem toque seu ({papel} {evento})"))
        for k in range(N):
            (a, fa), (b, fb) = s0[k], s1[k]
            if a in SITUACOES_FINAIS and (a, fa) != (b, fb):
                # só vale a versão nova pedida por você (refazer) ou marcar a falha como pulada
                if not ((nova_versao and a in falha and b == "ESPERA") or (a in falha and b == "PULADA")):
                    V.append(("R02", f"{perfis[k]['id']}: final {a} voltou a andar ({evento})"))

    def conferir_config(cfg_, succ):
        card, slots, g_plano, _acoes = cfg_
        est = card[0]
        if not g_plano:
            for k, (sit, _f) in enumerate(slots):
                if sit not in ("ESPERA", "FIM_PAI"):
                    rel.add("R06", f"{rotulo}: {perfis[k]['id']} em {sit} antes de o plano valer")
        if est in mc.finais:
            for k, (sit, _f) in enumerate(slots):
                if sit not in SITUACOES_FINAIS:
                    rel.add("R02", f"{rotulo}: {perfis[k]['id']} continua em {sit} com o card {est}")
            return
        if est not in ESPEC_CARD_ATIVO:
            for k, (sit, _f) in enumerate(slots):
                if sit != "ESPERA":
                    rel.add("R06", f"{rotulo}: {perfis[k]['id']} em {sit} com o card em {est} (só anda com o card ativo)")
        for k, (sit, _f) in enumerate(slots):
            if sit == "PRONTA":
                rel.add("R02", f"{rotulo}: {perfis[k]['id']} ficou pronta com o card aberto ({est})")
            if sit == "FIM_PAI":
                rel.add("R02", f"{rotulo}: {perfis[k]['id']} terminou junto com o card, mas o card continua aberto ({est})")
            if sit in ("TRABALHO", "APROVADA", "APROVADA_NAO_PODE"):
                for d in deps[k]:
                    if slots[d][0] not in ESPEC_SATISFAZ:
                        rel.add("R06", f"{rotulo}: {perfis[k]['id']} em {sit} com a anterior {perfis[d]['id']} em {slots[d][0]}")
        if est == "EM_ANDAMENTO" and any(sl[0] in ("FALHOU",) for sl in slots):
            if not any(ev == "PERGUNTAR_AO_FUNDADOR" for _p, ev, _l, _c, _V, _n in succ):
                rel.add("R06", f"{rotulo}: etapa com falha e o card não pergunta a você")
        if not succ:
            rel.add("R02", f"{rotulo}: card aberto sem saída ({est}, {[s[0] for s in slots]})")
        elif not any(p in sistema for p, *_r in succ):
            rel.add("R01", f"{rotulo}: card aberto que só anda por IA ou por você ({est})")

    ini = (mc.inicial(), tuple(("ESPERA", 1) for _ in perfis), 0, tuple(0 for _ in perfis))
    vistos = {ini: 0}
    lista = [ini]
    adj = [[]]
    adj_sis = [[]]
    transicoes = paradas = 0
    i = 0
    while i < len(lista):
        if rel.parou:
            break
        atual = lista[i]
        succ = sucessores(atual)
        conferir_config(atual, succ)
        for papel, evento, lid, prox, V, nova in succ:
            if prox == atual and lid == "etapa" and not V:
                paradas += 1   # passo interno da etapa que não muda o card: provado na camada 1
                continue
            conferir_passo(atual, prox, papel, evento, V, nova)
            for regra, msg in V:
                rel.add(regra, f"{rotulo}: {msg}", [atual[0][0], [s[0] for s in atual[1]], f"{papel} {evento} [{lid}]"])
            j = vistos.get(prox)
            if j is None:
                j = len(lista)
                if j >= MAX_ESTADOS:
                    erro = BuscaSemFim(f"{rotulo}: mais de {MAX_ESTADOS} estados")
                    erro.lista = lista
                    raise erro
                vistos[prox] = j
                lista.append(prox)
                adj.append([])
                adj_sis.append([])
            adj[i].append(j)
            if papel in sistema:
                adj_sis[i].append(j)
            transicoes += 1
        i += 1
    ciclo = None if rel.parou else acha_ciclo(len(lista), adj)
    if ciclo:
        rel.add("R02", f"{rotulo}: ciclo sem teto no card",
                [(lista[c][0][0], [s[0] for s in lista[c][1]]) for c in ciclo[:10]])
    vivos = 0 if rel.parou else conferir_vivacidade(lista, adj_sis, mc, rel, rotulo)
    finais = contar_finais(lista, mc)
    return {"estados": len(lista), "transicoes": transicoes, "paradas": paradas, "finais": finais,
            "vivacidade": vivos,
            "independentes": [(", ".join(g), conferir_grupo(mc, g, lns, rel)) for g, lns in grupos],
            "prazo": conferir_prazo_do_card(mc, tab, rel)}


def conferir_vivacidade(lista, adj_sis, mc, rel, rotulo):
    """Regra 2 (vivacidade): de todo card aberto com TODAS as etapas aprovadas e frescas (ou
    puladas), o card chega a PRONTO só com passos do sistema (motor, relógio, vigia), sem
    precisar de toque seu nem de IA. Uma pergunta que perdeu o objeto não pode prender o card."""
    n = len(lista)
    rev = [[] for _ in range(n)]
    for i, viz in enumerate(adj_sis):
        for j in viz:
            rev[j].append(i)
    chega = bytearray(n)
    fila = deque(i for i, (c, _s, _g, _a) in enumerate(lista) if c[0] == "PRONTO")
    for i in fila:
        chega[i] = 1
    while fila:
        j = fila.popleft()
        for i in rev[j]:
            if not chega[i]:
                chega[i] = 1
                fila.append(i)
    conferidos = 0
    for i, (c, s, _g, _a) in enumerate(lista):
        if c[0] in mc.finais:
            continue
        if all((sit == "APROVADA" and f) or sit == "PULADA" for sit, f in s):
            conferidos += 1
            if not chega[i]:
                rel.add("R02", f"{rotulo}: todas as etapas aprovadas e o card não chega a PRONTO sem você "
                               f"({c[0]}, motivo {c[mc.idx['motivo']]})")
    return conferidos


def contar_finais(lista, mc):
    c = defaultdict(int)
    for card, _s, _g, _a in lista:
        if card[0] in mc.finais:
            c[card[0]] += 1
    return dict(c)


# ----------------------------------------------------------------------------- camada 3
def camada3(c1, perfis):
    """Ligação: resumo do refinamento (passos parados x passos da camada 2)."""
    out = {}
    for p in perfis:
        r = c1[p["id"]]
        out[p["id"]] = {"passos_parados": r["paradas"],
                        "passos_abstratos": sum(len(x) for x in r["mov"].values()),
                        "entradas": sum(len(x) for x in r["inp"].values()),
                        "situacoes": sorted({a[0] for a in r["mov"]} | {a[0][0] for a in r["inp"]})}
    return out


# ----------------------------------------------------------------------------- prova completa
_CACHE_C1 = {}


def _chave_camada1(vocab, tabela, roteiro):
    """A camada 1 só depende destas partes; os testes de mutação do card reaproveitam o resultado."""
    partes = {k: tabela.get(k) for k in ("tetos", "designacao_de_revisor", "macros", "entradas", "regras_gerais", "situacao_da_etapa")}
    partes["variaveis"] = {k: tabela["variaveis"].get(k) for k in ("etapa", "acao_externa")}
    partes["estados"] = {k: tabela["estados"].get(k) for k in ("etapa", "acao_externa")}
    partes["linhas"] = {k: tabela["linhas"].get(k) for k in ("etapa", "acao_externa")}
    texto = json.dumps([vocab, partes, roteiro], sort_keys=True, ensure_ascii=False, default=str)
    return hashlib.sha256(texto.encode("utf-8")).hexdigest()


def provar(vocab=None, tabela=None, roteiro=None, parar_em=None, usar_cache=False):
    """Roda as três camadas. Devolve (relatório, medidas). parar_em: regras que encerram cedo
    (usado pelos testes de mutação para não percorrer tudo depois de achar o defeito)."""
    t0 = time.time()
    vocab, tabela = carregar(vocab, tabela)
    rel = Relatorio()
    rel.parar_em = set(parar_em) if parar_em else None
    medidas = {"impressao_digital": impressao_digital(vocab, tabela)}
    try:
        maqs = montar(vocab, tabela)
    except ErroTabela as e:
        rel.add("ESTRUTURA", str(e))
        return rel, medidas
    conferir_estrutura(vocab, tabela, maqs, rel)
    if rel.parou:
        return rel, medidas
    try:
        perfis = perfis_do_roteiro(roteiro or ROTEIRO_DE_PROVA, tabela, vocab)
    except ErroTabela as e:
        rel.add("R06" if "ciclo" in str(e) else "ESTRUTURA", str(e))
        return rel, medidas
    t1 = time.time()
    chave = _chave_camada1(vocab, tabela, roteiro or ROTEIRO_DE_PROVA) if usar_cache else None
    if chave and chave in _CACHE_C1:
        c1, rel1 = _CACHE_C1[chave]
        rel.juntar(rel1)
        medidas["camada1_do_cache"] = True
    else:
        rel1 = Relatorio()
        rel1.parar_em = rel.parar_em
        try:
            c1 = camada1(vocab, tabela, maqs, rel1, perfis)
        except BuscaSemFim as e:
            rel.juntar(rel1)
            rel.add("R02", f"busca não terminou: {e}")
            return rel, medidas
        rel.juntar(rel1)
        if chave and not rel1.parou:
            _CACHE_C1[chave] = (c1, rel1)
    medidas["camada1"] = {k: {"estados": v["estados"], "transicoes": v["transicoes"], "reproduzidos": v.get("reproduzidos", 0)}
                          for k, v in c1.items()}
    medidas["tempo_camada1"] = time.time() - t1
    if rel.parou:
        return rel, medidas
    t2 = time.time()
    try:
        medidas["camada2"] = camada2(vocab, tabela, maqs, rel, perfis, c1)
    except BuscaSemFim as e:
        rel.add("R02", f"busca não terminou: {e}")
        return rel, medidas
    if rel.parou:
        return rel, medidas
    medidas["tempo_camada2"] = time.time() - t2
    medidas["camada3"] = camada3(c1, perfis)
    medidas["tempo_total"] = time.time() - t0
    return rel, medidas


# ----------------------------------------------------------------------------- jornadas (replay)
COBERTURA = {
    "R01": ("prova", "Todo estado aberto tem dono, prazo e saída pelo relógio/motor; nenhum prazo sem evento ('na hora' tem TEMPO_ESGOTADO); "
                     "os 3 avisos do prazo do card existem em todo estado aberto, um aviso perdido não trava os seguintes e mudar o prazo os rearma; "
                     "nenhum padrão corre sem lembrete entregue (MEL-37).",
            "O disparo no horário certo é do relógio dentro do banco (teste 7)."),
    "R02": ("prova", "Finais sem saída; nenhum estado aberto sem saída; nenhum ciclo sem contador com teto; nenhuma etapa pronta ou encerrada "
                     "com o card aberto; de todo card com as etapas aprovadas e frescas, PRONTO é alcançável só pelo sistema (vivacidade).",
            "Vale enquanto você não passar do teto de ordens (3 por card; a 4ª ordem substitui o card por um card novo ligado)."),
    "R03": ("prova", "Uma execução viva por etapa; resposta de chave antiga (autor, revisor e Helena) ou sem execução viva nunca grava.",
            "Número de execução monotônico do banco (sequência, nunca reaproveitada) e trava única do motor (teste 4)."),
    "R04": ("prova", "Designação nunca escolhe o autor, o autor do jurídico nem quem pode revisar o jurídico; só o designado responde; "
                     "todo revisor válido da ficha é de fato percorrido; autor e revisor só dos 21 agentes do vocabulário.",
            "Que o processo é mesmo o do revisor designado: motor confere o perfil no registro de uso (teste 3)."),
    "R05": ("prova", "Ajuste volta ao autor (ou, no teto das suas ordens, substitui o card); no máximo 6 execuções por rodada; todo contador no teto.", ""),
    "R06": ("prova", "Roteiro sem ciclo; nenhuma etapa anda com o card fora de EM_ANDAMENTO/ESPERANDO_FUNDADOR (trava na tabela); "
                     "ninguém trabalha sem a anterior aprovada (guarda calculada pelo banco); falha faz o card perguntar; sub-card desligado.", ""),
    "R07": ("estrutura", "Só o fundador tem ação ou reação que muda prioridade ou prazo; o regime da sua espera nunca vem de parâmetro de IA.",
            "'Continuar um card nunca fura a fila de outro' é entre cards: fila única do motor por prioridade e chegada (teste 4)."),
    "R08": ("prova", "Só o motor executa, só com o seu ok registrado, no máximo uma vez; a ação nasce só do card pronto, uma por etapa; "
                     "ação incerta nunca vira falha sem a sua confirmação; nenhuma ação de IA tem efeito externo.",
            "Idempotência no serviço de fora, índice único (card, etapa) da ação no banco e o código do autenticador no app (fase 4)."),
    "R09": ("prova", "Aprovada só por revisor ou por você, depois do portão 1; no jurídico, só com o seu Aprovar; toque sobre versão que você "
                     "não viu nunca muda estado; nenhum padrão nem automático aprova; card pronto só com todas aprovadas.",
            "O conteúdo do portão 1 (citação, conta, lei) é do validador (teste 5); a qualidade da rubrica é do teste 9."),
    "R10": ("prova", "Decisão nova, dependência reaberta ou ajuste tornam a entrega velha; nada velho fica aprovado, pronto ou vira ação externa; "
                     "seu ajuste no teto de ordens nunca deixa o card fechar com a peça marcada.",
            "Saber quais decisões cada execução usou: motor registra na execução."),
    "R11": ("prova", "Todo botão em todo estado tem destino; uma ordem sua aceita abaixo do teto tem passagem também no teto (nunca vira comentário).",
            "'Gravada uma vez': índice único (canal, número da mensagem) no banco (teste 11)."),
    "R12": ("prova", "Falha de infraestrutura (inclusive do validador) não gasta tentativa; na 3ª da rodada chama você; capacidade que volta "
                     "desfaz a espera uma vez por rodada.",
            "A origem da falha é lida pelo motor no registro de uso do Hermes, nunca no texto do agente."),
    "R13": ("prova", "No máximo uma linha por evento (determinismo); reprodução do histórico igual, com todo toque seu e o destino dele; "
                     "fim registrado como seu só com toque seu; entradas só por sinal.",
            "Histórico só de acréscimo: o banco recusa UPDATE/DELETE nos eventos; backup semanal restaurado (teste 8)."),
}


def _schema_jornada():
    return json.loads((AQUI / "jornada.schema.json").read_text(encoding="utf-8"))


def replay(jornada, vocab=None, tabela=None, conferir_historico=True):
    """Reproduz uma jornada (lista de eventos com papel) sobre a tabela real.
    Devolve o estado final, as violações (mesma especificação da prova), os eventos
    recusados com o destino de cada um e o histórico que reconstrói o card (regra 13).
    Nenhuma trava mora aqui: quem recusa é a tabela (regras gerais e guardas)."""
    import jsonschema
    if isinstance(jornada, (str, Path)):
        jornada = json.loads(Path(jornada).read_text(encoding="utf-8"))
    jsonschema.validate(jornada, _schema_jornada())
    vocab, tabela = carregar(vocab, tabela)
    maqs = montar(vocab, tabela)
    mc, me, ma = maqs["card"], maqs["etapa"], maqs["acao_externa"]
    tetos = me.tetos
    perfis = perfis_do_roteiro(jornada.get("roteiro") or ROTEIRO_DE_PROVA, tabela, vocab)
    pf = {p["id"]: p for p in perfis}
    ordem = [p["id"] for p in perfis]
    alfa = situacao_fn(tabela, me)
    pr = tabela["predicados"]
    rg = tabela.get("regras_gerais", {})
    so_por_sinal = bool(rg.get("entradas_so_por_sinal"))
    cfg_card = {"pedido_grande": bool((jornada.get("card") or {}).get("pedido_grande", True))}
    plano_valido = bool((jornada.get("card") or {}).get("plano_valido", True))
    auto = bool(jornada.get("automatico", True))
    rec = tabela.get("recusa_do_fundador") or {}
    E = {"card": mc.inicial(), "g_plano": 0, "etapas": {i: me.inicial() + FANTASMA_ETAPA_INICIAL for i in ordem},
         "versao": {i: 0 for i in ordem}, "puladas": set(), "acoes": {}, "acoes_cfg": {}, "acoes_por_etapa": defaultdict(int),
         "cards_ligados": 0, "guardadas": {i: [] for i in ordem}, "da_versao": {i: [] for i in ordem},
         "proposta": {i: "NENHUMA" for i in ordem}}
    raiz = {"papel": None}
    violacoes, recusados, historico, reacoes, conversoes = [], [], [], [], []

    def sit(i):
        s = alfa(E["etapas"][i])
        if s in pr["falha_que_pergunta"] and i in E["puladas"]:
            return "PULADA"
        return s

    def preds():
        sits = [sit(i) for i in ordem]
        fs = [s in pr["falha_que_pergunta"] for s in sits]
        return {"todas_prontas": all(s in pr["conta_como_pronta"] for s in sits),
                "falha_sem_decisao": any(fs),
                "nao_pode_sem_decisao": any(s == "APROVADA_NAO_PODE" for s in sits),
                "falhas_pulaveis": all(pf[ordem[k]]["cfg"]["pulavel"] for k, f in enumerate(fs) if f)}

    def q_etapa(i, params):
        """O que o banco calcula na mesma transação: config da ficha, estado do card e anteriores."""
        q = dict(pf[i]["cfg"])
        q.update(params)
        q["estado_card"] = E["card"][0]
        q["anteriores_satisfeitas"] = all(sit(d) in pr["satisfaz_dependencia"] for d in pf[i]["depende_de"])
        if "escolhido" in params:
            q["revisor_valido"] = params["escolhido"] in pf[i]["revisores_validos"]
        return q

    def viol(idx, regra, msg):
        violacoes.append({"indice": idx, "regra": regra, "mensagem": msg})

    def com_card(s):
        lst = list(s)
        for v in me.compartilhadas:
            lst[me.idx[v]] = E["card"][mc.idx[v]]
        return tuple(lst)

    def devolve_card(pos):
        c = list(E["card"])
        for v in me.compartilhadas:
            c[mc.idx[v]] = pos[me.idx[v]]
        E["card"] = tuple(c)

    def params_de(papel, evento, dados, i=None):
        dom = me.parametros.get((papel, evento), {})
        p = dict(dados or {})
        for nome, valores in dom.items():
            if nome in p:
                continue
            if evento == "PORTAO1_OK" and nome == "escolhido" and i is not None:
                p[nome] = pf[i]["revisores_validos"][0]
            elif evento in ("RESPONDER", "RECOMENDAR"):
                return None
            else:
                p[nome] = valores[0]
        return p

    def maquina_do_alvo(alvo):
        if alvo == "card":
            return mc
        if alvo in E["etapas"]:
            return me
        if alvo in E["acoes"]:
            return ma
        return None

    def aplicar(alvo, papel, evento, params, ator, chave, idx, efeitos):
        """Aplica um evento a uma máquina. Devolve 'aceito' ou 'recusado'."""
        if alvo == "card":
            m, s = mc, E["card"]
            q = dict(cfg_card)
            q.update(params)
            q.update(preds())
            autor = None
        elif alvo in E["etapas"]:
            m, s = me, com_card(E["etapas"][alvo])
            q = q_etapa(alvo, params)
            autor = pf[alvo]["autor"]
        elif alvo in E["acoes"]:
            m, s = ma, E["acoes"][alvo]
            q = {"tem_ferramenta": E["acoes_cfg"][alvo]["tem_ferramenta"]}
            q.update(params)
            autor = None
        else:
            return "recusado"
        lns = m.casar(s, papel, evento, q, ator, chave, autor)
        if not lns:
            return "recusado"
        if len(lns) > 1:
            viol(idx, "R13", f"duas linhas para {evento} em {s[0]} ({', '.join(l.id for l in lns)})")
        ln = lns[0]
        pos = m.aplicar(s, ln, params)
        ev = Ev(papel, evento, params, ator, chave, q)
        if m is me:
            g, V = conferir_etapa(me, s, ev, ln, pos, pf[alvo], tetos)
            E["etapas"][alvo] = pos[:me.n] + g
            devolve_card(pos)
            if evento == "ENTREGAR":   # campo da entrega (dado): a ação externa que ela propõe
                E["proposta"][alvo] = params.get("acao_externa", "NENHUMA")
        elif m is ma:
            g, V = conferir_acao(ma, s, ev, ln, pos)
            E["acoes"][alvo] = pos[:ma.n] + g
        else:
            V = [("R02", "card final voltou a andar")] if s[0] in mc.finais else []
            for var, teto in mc.teto_var.items():
                if pos[mc.idx[var]] > teto:
                    V.append(("R05", f"contador {var} do card passou do teto"))
            if papel == "HELENA" and chave != "atual":
                V.append(("R03", "resposta de chamada antiga da Helena mudou o card"))
            if papel == "FUNDADOR" and evento in ESPEC_BOTOES_COM_VERSAO and chave != "atual":
                V.append(("R09", "toque seu sobre uma versão que você não viu mudou o card"))
            i_fim = mc.idx["fim"]
            if pos[i_fim] == "FUNDADOR" and s[i_fim] != "FUNDADOR" and raiz["papel"] != "FUNDADOR":
                V.append(("R13", f"o card ficou registrado como decisão sua sem toque seu (origem {raiz['papel']})"))
            if evento == "PLANO_VALIDO":
                E["g_plano"] = 1
            if pos[0] == "PRONTO" and s[0] != "PRONTO":
                for i in ordem:
                    st = sit(i)
                    if st not in ESPEC_SATISFAZ:
                        V.append(("R09", f"card pronto com {i} em {st}"))
                    elif st == "APROVADA" and not E["etapas"][i][me.n + 3]:
                        V.append(("R10", f"card pronto com {i} sobre informação velha"))
            E["card"] = pos
        for regra, msg in V:
            viol(idx, regra, f"{alvo}: {msg}")
        efeitos.append(f"{alvo}: {s[0]} -> {pos[0]} [{ln.id}]")
        entregar(alvo, m.sinais_de(ln, s, q), params, idx, efeitos)
        return "aceito"

    def entregar(origem, sinais, params, idx, efeitos):
        for nome in sinais:
            lig = tabela["ligacoes"][nome]
            if "no_card" in lig:
                acao = lig["no_card"]
                if acao == "marcar_falhas_como_puladas":
                    for i in ordem:
                        if alfa(E["etapas"][i]) in pr["falha_que_pergunta"]:
                            E["puladas"].add(i)
                elif acao == "nova_versao_das_falhas":
                    for i in ordem:
                        if alfa(E["etapas"][i]) in pr["falha_que_pergunta"] and i not in E["puladas"]:
                            E["versao"][i] += 1
                            E["etapas"][i] = me.inicial() + FANTASMA_ETAPA_INICIAL
                            E["da_versao"][i] = list(E["guardadas"][i])
                            E["guardadas"][i] = []
                            efeitos.append(f"{i}: versão nova {E['versao'][i]}" +
                                           (f", com as suas respostas guardadas {E['da_versao'][i]}" if E["da_versao"][i] else ""))
                elif acao == "criar_acao_externa":
                    st = E["etapas"].get(origem)
                    if st is None or st[0] != "PRONTA" or E["card"][0] != "PRONTO":
                        viol(idx, "R08", f"ação externa nasceu antes dos portões e do card pronto ({origem})")
                    elif not st[me.n + 3]:
                        viol(idx, "R10", f"ação externa nasceu de entrega velha ({origem})")
                    if E["acoes_por_etapa"][origem] >= 1:
                        viol(idx, "R08", f"segunda ação externa para a mesma etapa ({origem})")
                    E["acoes_por_etapa"][origem] += 1
                    tipo = E["proposta"].get(origem, "NENHUMA")
                    if tipo != "NENHUMA":
                        aid = f"A{len(E['acoes']) + 1}"
                        E["acoes"][aid] = ma.inicial() + FANTASMA_ACAO_INICIAL
                        E["acoes_cfg"][aid] = {"tem_ferramenta": tipo == "PELO_MOTOR", "origem": origem, "tipo": tipo}
                        efeitos.append(f"{aid}: ação externa proposta na sua lista ({origem}, {tipo})")
                elif acao == "criar_card_ligado":
                    E["cards_ligados"] += 1
                    efeitos.append("card novo ligado")
                continue
            papel, evento = lig["entrega"]["papel"], lig["entrega"]["evento"]
            for alvo in lig.get("para", []):
                if alvo == "card":
                    alvos = ["card"]
                elif alvo == "acoes_abertas":
                    alvos = [a for a, s in E["acoes"].items() if s[0] not in ma.finais]
                elif alvo == "etapas_abertas":
                    alvos = [i for i in ordem if sit(i) in pr["aberta"]]
                elif alvo == "etapas_aprovadas":
                    alvos = [i for i in ordem if sit(i) in ("APROVADA", "APROVADA_NAO_PODE")]
                elif alvo == "etapas_abertas_que_usam_decisao":
                    alvos = [i for i in ordem if sit(i) in pr["aberta"] and pf[i]["cfg"]["usa_decisao"]]
                elif alvo == "dependentes_diretos_abertos":
                    alvos = [i for i in ordem if origem in pf[i]["depende_de"] and sit(i) in pr["aberta"]]
                elif alvo == "julgadas_abertas":
                    alvos = [i for i in pf[origem]["julga"] if sit(i) in pr["aberta"]]
                elif alvo == "julgadas_de_nao_pode":
                    alvos = sorted({x for i in ordem if sit(i) == "APROVADA_NAO_PODE" for x in pf[i]["julga"] if sit(x) in pr["aberta"]})
                else:
                    raise ErroTabela(f"alvo de ligação desconhecido: {alvo}")
                for a in alvos:
                    if aplicar(a, papel, evento, {}, None, "atual", idx, efeitos) != "aceito":
                        viol(idx, "LIGACAO", f"sinal {evento} perdido em {a}")

    def conferir_config(idx):
        est = E["card"][0]
        if not E["g_plano"]:
            for i in ordem:
                if sit(i) not in ("ESPERA", "FIM_PAI"):
                    viol(idx, "R06", f"{i} andou antes de o plano valer")
        if est in mc.finais:
            for i in ordem:
                if sit(i) not in SITUACOES_FINAIS:
                    viol(idx, "R02", f"{i} continua em {sit(i)} com o card {est}")
            return
        for i in ordem:
            if est not in ESPEC_CARD_ATIVO and sit(i) != "ESPERA":
                viol(idx, "R06", f"{i} em {sit(i)} com o card em {est} (só anda com o card ativo)")
            if sit(i) in ("PRONTA", "FIM_PAI"):
                viol(idx, "R02", f"{i} em {sit(i)} com o card aberto")
            if sit(i) in ("TRABALHO", "APROVADA", "APROVADA_NAO_PODE"):
                for d in pf[i]["depende_de"]:
                    if sit(d) not in ESPEC_SATISFAZ:
                        viol(idx, "R06", f"{i} em {sit(i)} com a anterior {d} em {sit(d)}")

    def reacao(alvo, papel, evento):
        if alvo == "card":
            maq, est = "card", E["card"][0]
        elif alvo in E["etapas"]:
            maq, est = "etapa", E["etapas"][alvo][0]
        else:
            return None
        m = maqs[maq]
        for r in tabela.get("reacoes", []):
            if r["papel"] != papel or r["evento"] != evento or r["maquina"] != maq:
                continue
            ests = r["estados"]
            if ests == "TODOS" or (ests == "ABERTOS" and est in m.abertos) or (isinstance(ests, list) and est in ests):
                if r.get("guarda"):
                    g = compilar_expr(r["guarda"], m.idx, m.tetos, set(), "reação")
                    s_ = E["card"] if maq == "card" else com_card(E["etapas"][alvo])
                    if not g(s_, {}):
                        continue
                return r
        return None

    def um_evento(e, idx, via):
        papel, evento, alvo = e["papel"], e["evento"], e.get("alvo", "card")
        if alvo.startswith("acao:"):
            alvo = alvo[5:]
        if evento not in (vocab["acoes"].get(papel) or {}):
            recusados.append({"indice": idx, "evento": f"{papel} {evento}", "motivo": "fora do vocabulário", "destino": "recusado"})
            return
        i_etapa = alvo if alvo in E["etapas"] else None
        params = params_de(papel, evento, e.get("params"), i_etapa)
        if params is None:
            recusados.append({"indice": idx, "evento": f"{papel} {evento}", "motivo": "falta a opção", "destino": "recusado"})
            return
        ator = e.get("ator")
        if ator is None and i_etapa:
            if papel == "AUTOR":
                ator = pf[i_etapa]["autor"]
            elif papel == "REVISOR":
                ator = E["etapas"][i_etapa][me.idx["revisor"]]
        chave = e.get("versao_vista", "atual") if papel == "FUNDADOR" else e.get("chave", "atual")
        efeitos = []
        m_alvo = maquina_do_alvo(alvo)
        motivo = "sem passagem neste estado"
        raiz["papel"] = papel
        if so_por_sinal and m_alvo is not None and evento in m_alvo.entradas:
            res, motivo = "recusado", "entrada só por sinal (regras_gerais.entradas_so_por_sinal)"
        else:
            res = aplicar(alvo, papel, evento, params, ator, chave, idx, efeitos)
        registro = {"papel": papel, "evento": evento, "alvo": e.get("alvo", "card"), "params": params}
        if ator:
            registro["ator"] = ator
        if chave != "atual":
            registro["versao_vista" if papel == "FUNDADOR" else "chave"] = chave
        if res == "recusado" and i_etapa and papel in ("AUTOR", "REVISOR") and chave == "atual":
            s = E["etapas"][i_etapa]
            dono_ok = (ator == pf[i_etapa]["autor"]) if papel == "AUTOR" else (ator == s[me.idx["revisor"]])
            if s[0] in ESTADOS_DE_EXECUCAO and s[me.idx["exec_viva"]] == 1 and dono_ok:
                conv = tabela["regras_gerais"]["resposta_de_agente_sem_linha"]
                res = aplicar(i_etapa, conv["papel"], conv["evento"], dict(conv.get("parametros") or {}), None, "atual", idx, efeitos)
                if res == "aceito":
                    conversoes.append({"indice": idx, "de": f"{papel} {evento}", "para": f"{conv['papel']} {conv['evento']}"})
                    registro["convertido_em"] = f"{conv['papel']} {conv['evento']}"
        if res == "recusado":
            r = reacao(alvo, papel, evento)
            if r is not None:
                reacoes.append({"indice": idx, "evento": f"{papel} {evento}", "efeito": r.get("efeito_fora", "")})
                if r.get("muda_campo") and papel != "FUNDADOR":
                    viol(idx, "R07", f"{papel} mudou {r['muda_campo']}")
                if r.get("abre_card_ligado"):
                    E["cards_ligados"] += 1
                registro["destino"] = "REACAO"
                registro["via"] = via
                historico.append(registro)   # regra 13: todo toque com destino fica no histórico
                return
            if papel == "FUNDADOR":
                # o destino é decidido pelo estado do ALVO do toque
                card_final = E["card"][0] in mc.finais
                abre = rec.get("final_abre_card_para")
                final_dest = rec.get("final") if (abre is None or evento in abre) else (rec.get("final_outros_botoes") or rec.get("final"))
                if alvo == "card":
                    destino = final_dest if card_final else rec.get("aberto")
                elif alvo in E["etapas"]:
                    if card_final:
                        destino = final_dest
                    elif E["etapas"][alvo][0] in me.finais and evento == "RESPONDER" and rec.get("resposta_tardia_com_card_aberto"):
                        destino = rec["resposta_tardia_com_card_aberto"]
                        E["guardadas"][alvo].append(params.get("opcao"))
                    elif chave != "atual" and evento in ESPEC_BOTOES_COM_VERSAO:
                        destino = rec.get("versao_antiga") or rec.get("aberto")
                    else:
                        destino = rec.get("aberto")
                elif alvo in E["acoes"]:
                    destino = rec.get("final" if E["acoes"][alvo][0] in ma.finais else
                                      ("versao_antiga" if chave != "atual" else "aberto")) or rec.get("aberto")
                else:
                    destino = final_dest if card_final else rec.get("aberto")
                if not destino:
                    viol(idx, "R11", f"toque {evento} sem destino")
                if destino == "CARD_NOVO_LIGADO":
                    E["cards_ligados"] += 1
                recusados.append({"indice": idx, "evento": f"{papel} {evento}", "motivo": motivo, "destino": destino})
                registro["destino"] = destino
                registro["via"] = via
                historico.append(registro)   # regra 11 e 13: o seu toque é gravado uma vez, com o destino
            else:
                recusados.append({"indice": idx, "evento": f"{papel} {evento}", "motivo": motivo, "destino": "recusado pelo banco"})
            return
        registro["efeitos"] = efeitos
        registro["via"] = via
        historico.append(registro)
        conferir_config(idx)

    def automaticos(idx):
        for _ in range(1000):
            feito = False
            for ev in (tabela.get("automaticos") or {}).get("card", []):
                if ev == "PLANO_VALIDO" and not plano_valido:
                    continue
                if not _cabe("card", "MOTOR", ev):
                    continue
                antes = len(historico)
                um_evento({"papel": "MOTOR", "evento": ev, "alvo": "card"}, idx, "automatico")
                if len(historico) > antes:
                    feito = True
                    break
            if not feito:
                for i in ordem:
                    for ev in (tabela.get("automaticos") or {}).get("etapa", []):
                        if not _cabe(i, "MOTOR", ev):
                            continue
                        antes = len(historico)
                        um_evento({"papel": "MOTOR", "evento": ev, "alvo": i}, idx, "automatico")
                        if len(historico) > antes:
                            feito = True
                            break
                    if feito:
                        break
            if not feito:
                for a in list(E["acoes"]):
                    for ev in (tabela.get("automaticos") or {}).get("acao_externa", []):
                        if _cabe(a, "MOTOR", ev):
                            antes = len(historico)
                            um_evento({"papel": "MOTOR", "evento": ev, "alvo": "acao:" + a}, idx, "automatico")
                            if len(historico) > antes:
                                feito = True
                                break
                    if feito:
                        break
            if not feito:
                return
        viol(idx, "R02", "eventos automáticos não pararam (laço)")

    def _cabe(alvo, papel, evento):
        if alvo == "card":
            m, s, q = mc, E["card"], dict(cfg_card, **preds())
        elif alvo in E["etapas"]:
            m, s, q = me, com_card(E["etapas"][alvo]), q_etapa(alvo, {})
        else:
            m, s = ma, E["acoes"][alvo]
            q = {"tem_ferramenta": E["acoes_cfg"][alvo]["tem_ferramenta"]}
        return bool(m.casar(s, papel, evento, q))

    if auto:
        automaticos(-1)
    for idx, e in enumerate(jornada["eventos"]):
        um_evento(e, idx, "jornada")
        if auto:
            automaticos(idx)

    def foto():
        return {"card": dict(zip(["estado"] + mc.vars, E["card"])),
                "etapas": {i: dict(zip(["estado"] + me.vars, E["etapas"][i][:me.n]), versao=E["versao"][i], situacao=sit(i),
                                   respostas_guardadas=list(E["guardadas"][i]), respostas_da_versao=list(E["da_versao"][i]))
                           for i in ordem},
                "puladas": sorted(E["puladas"]),
                "acoes": {a: dict(zip(["estado"] + ma.vars, s[:ma.n]), **{k: v for k, v in E["acoes_cfg"][a].items()})
                          for a, s in E["acoes"].items()},
                "cards_ligados": E["cards_ligados"]}

    final = foto()
    if conferir_historico:
        j2 = {"id": jornada.get("id", "jornada") + ":historico", "roteiro": jornada.get("roteiro") or ROTEIRO_DE_PROVA,
              "card": jornada.get("card") or {}, "automatico": False,
              "eventos": [{k: v for k, v in h.items() if k in ("papel", "evento", "alvo", "params", "ator", "chave", "versao_vista")}
                          for h in historico]}
        r2 = replay(j2, vocab, tabela, conferir_historico=False)
        if r2["final"] != final:
            viol(len(jornada["eventos"]), "R13", "o histórico não reconstrói o card")
    resultado = {"id": jornada.get("id"), "estado_card": final["card"]["estado"],
                 "etapas": {i: final["etapas"][i]["estado"] for i in ordem}, "acoes": {a: v["estado"] for a, v in final["acoes"].items()},
                 "final": final, "violacoes": violacoes, "recusados": recusados, "reacoes": reacoes,
                 "conversoes": conversoes, "historico": historico}
    esp = jornada.get("esperado")
    divergencias = []
    if esp:
        if "estado_card" in esp and esp["estado_card"] != resultado["estado_card"]:
            divergencias.append(f"card: esperado {esp['estado_card']}, deu {resultado['estado_card']}")
        for i, st in (esp.get("etapas") or {}).items():
            if resultado["etapas"].get(i) != st:
                divergencias.append(f"{i}: esperado {st}, deu {resultado['etapas'].get(i)}")
        for a, st in (esp.get("acoes") or {}).items():
            if resultado["acoes"].get(a) != st:
                divergencias.append(f"{a}: esperado {st}, deu {resultado['acoes'].get(a)}")
        if "violacoes" in esp and esp["violacoes"] != len(violacoes):
            divergencias.append(f"violações: esperado {esp['violacoes']}, deu {len(violacoes)}")
        if "recusados" in esp and esp["recusados"] != len(recusados):
            divergencias.append(f"recusados: esperado {esp['recusados']}, deu {len(recusados)}")
    resultado["divergencias"] = divergencias
    resultado["confere"] = not divergencias and not violacoes if esp is None else not divergencias
    return resultado


# ----------------------------------------------------------------------------- impressão
def imprimir_tabela(vocab=None, tabela=None):
    vocab, tabela = carregar(vocab, tabela)
    maqs = montar(vocab, tabela)
    for nome, m in maqs.items():
        print(f"\n=== {nome} ===")
        for ln in m.linhas:
            d = m.estados.get(ln.para) or {}
            dono = "FINAL" if d.get("final") else f"dono {d.get('dono')}, prazo {d.get('prazo')}"
            ef = ", ".join(f"{m.vars[p - 1]}={'+' if t == 'add' else ''}{v}" for p, t, v in ln.efeitos)
            sin = ", ".join(s for s, _c in ln.sinais)
            print(f"{ln.id:10} {ln.de:22} {ln.papel:8} {ln.evento:22} se [{ln.guarda_txt or 'sempre'}] -> {ln.para:22} "
                  f"({dono}) {{{ef}}}" + (f" sinais: {sin}" if sin else ""))


def main(argv):
    if "--tabela" in argv:
        imprimir_tabela()
        return 0
    if "--replay" in argv:
        caminho_j = argv[argv.index("--replay") + 1]
        r = replay(caminho_j)
        print(json.dumps({k: r[k] for k in ("id", "estado_card", "etapas", "acoes", "violacoes", "recusados", "divergencias", "confere")},
                         ensure_ascii=False, indent=2))
        return 0 if r["confere"] else 1
    print("Prova da máquina de passagens do Sistema Helena (v2.0)")
    rel, med = provar()
    print(f"Impressão digital da tabela: {med['impressao_digital']}")
    if "camada1" in med:
        tot_e = sum(v["estados"] for v in med["camada1"].values())
        tot_t = sum(v["transicoes"] for v in med["camada1"].values())
        print(f"Camada 1 (cada etapa sozinha, todos os estados alcançáveis): {tot_e} estados, {tot_t} passagens, "
              f"{med.get('tempo_camada1', 0):.1f} s")
        for k, v in med["camada1"].items():
            print(f"  - {k}: {v['estados']} estados, {v['transicoes']} passagens, {v['reproduzidos']} históricos reproduzidos")
    if "camada2" in med:
        c2 = med["camada2"]
        print(f"Camada 2 (card sobre o roteiro E1 | E2 -> EJ -> ER, EJ julga E2): {c2['estados']} estados, "
              f"{c2['transicoes']} passagens ({c2['paradas']} passos parados), {med.get('tempo_camada2', 0):.1f} s")
        print(f"  finais alcançados: {c2['finais']}")
        print(f"  vivacidade: {c2['vivacidade']} estados com todas as etapas aprovadas, todos chegam a PRONTO sem você")
        for v, nvals in c2["independentes"]:
            print(f"  variáveis independentes conferidas à parte: {v} ({nvals} valores, sem ciclo, até o teto)")
        print(f"  prazo do card: {c2['prazo']} combinações (estado aberto x nível x mudanças) conferidas")
    if "camada3" in med:
        print("Camada 3 (ligação): todo estado concreto tem situação; todo sinal é aceito por todo estado da situação")
        for k, v in med["camada3"].items():
            print(f"  - {k}: {v['passos_abstratos']} passos de card, {v['entradas']} entradas, {v['passos_parados']} passos parados; "
                  f"situações {', '.join(v['situacoes'])}")
    total = med.get("tempo_total", 0)
    print(f"Tempo total: {total:.1f} s")
    if rel.vazio():
        print("Violações: 0. Nenhuma violação conhecida nesta configuração de prova.")
    else:
        print(f"VIOLAÇÕES: {sum(it['vezes'] for it in rel.lista())} em {len(rel.lista())} tipos")
        for it in rel.lista():
            print(f"  [{it['regra']}] {it['mensagem']} (x{it['vezes']})")
            for ex in it["exemplos"][:1]:
                print(f"      caminho: {' > '.join(map(str, ex))}")
    print("Regras conferidas:")
    for r, (onde, o_que, fora) in COBERTURA.items():
        print(f"  {r} ({onde}): {o_que}" + (f" Fora da tabela: {fora}" if fora else ""))
    if total > 60:
        print("FALHA: a prova passou de 60 s.")
        return 1
    return 0 if rel.vazio() else 1


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
