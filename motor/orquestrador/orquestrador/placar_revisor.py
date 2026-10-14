"""Placar do revisor: o teste 9 do plano (docs/plano/PLANO-HELENA-V3.md, linha do teste 9; furo C-12).

O que é: pontua um revisor (uma função `revisor(caso) -> dict`) contra 30 entregas com defeito plantado, de 7 tipos, e
10 entregas limpas, tudo tirado dos casos da especificação (helena-v2/casos/). Nada é inventado: o texto de cada entrega
é o `resposta.entrega` do caso, o gabarito é o `deve_falhar_em` / `veredito_esperado*` do próprio caso.
Por que existe: o portão 2 do motor (`conferir_rubrica`, motor.py) só confere a FORMA da resposta do revisor (todos os
critérios, PASSOU, prova não vazia). Um revisor que sempre aprova, com prova genérica, passa nele. Este placar mede o
JULGAMENTO: quantos defeitos o revisor acha e quantas entregas limpas ele recusa por engano.
Não usa banco, rede, modelo de IA nem segredo; só LÊ os YAML da especificação (via spec_helena). Quem chama o revisor
real (e paga por isso) é quem chama `pontuar`.

A regra (plano, teste 9):
  achados >= 27 de 30 defeitos  E  falsos positivos <= 2 das 10 limpas  ->  aprovado.
  Com outro número de casos a regra vale em proporção, com contas inteiras (sem arredondar para o lado fácil):
    mínimo de achados          = teto(9/10 dos defeitos)      30 -> 27   (ACHADOS_MIN)
    máximo de falsos positivos = piso(2/10 das limpas)        10 -> 2    (FALSOS_POSITIVOS_MAX)
  Sem nenhum defeito, ou sem nenhuma limpa, o placar não prova nada (o "aprova tudo" ou o "recusa tudo" passaria):
  `pontuar` recusa com ValueError.
  O resultado sai por tipo de defeito (`placar_por_tipo`), mas o `aprovado` só depende dos dois números acima.
  `tipos_sem_achado` mostra os tipos em que o revisor não achou NENHUM defeito (cego para a classe inteira), mesmo
  quando o total passa: é aviso, não entra no `aprovado`.

Decisão do revisor: a resposta tem o formato do portão 2, {"criterios": [{"id", "resultado", "prova"}, ...]}, com
exatamente os critérios da rubrica do tipo de entrega (deliverables/<tipo>.yaml, criterio_de_pronto.rubrica) e prova
não vazia em todos. Se todos forem PASSOU, o revisor APROVA. Se algum for FALHOU ou NAO_CONSIGO_CONFERIR, ele RECUSA.
Resposta fora desse formato é INVALIDA: não é aprovação nem recusa válida. Conta contra o revisor nos dois lados
(defeito não achado = escape; entrega limpa = falso positivo), porque o motor também não a aceita.
Quando a resposta recusa mas não reprova o critério que o caso planta, o defeito conta como achado (o plano pede a
recusa), e o caso entra em `achados_pelo_criterio_errado` para olhar com cuidado.

Os 7 tipos de defeito (escolhidos entre os 46 defeitos da especificação que só o revisor pega, isto é, os casos RUIM
cujo `deve_falhar_em` é só RUB-..., `so_o_revisor_pega` em spec_helena/caso.py; cada critério de rubrica cai em um tipo
pelo que o revisor tem de perceber):
  ALEM_DA_FONTE                 afirma mais, ou com mais certeza, do que a fonte, a base ou a conta sustenta
                                (estimativa ou previsão dita como fato, conclusão esticada, "já foi aprovado").
  CONTA_OU_DADO_TROCADO         número, unidade, período ou data que não diz o mesmo que o trecho ou o pedido.
  RISCO_OMITIDO_OU_SUAVIZADO    risco, tema ou condição que a entrega toca e foi deixado sem tratamento, dado como
                                "não se aplica", suavizado ou genérico.
  ORDEM_OU_DEPENDENCIA_QUEBRADA passo ou marco fora da ordem de que depende, ou que depende de outra pessoa.
  VAGO_OU_NAO_VERIFICAVEL       ajuste, pronto ou critério que ninguém consegue conferir ou executar; jargão.
  FORA_DO_PAPEL_OU_DA_REGRA     age ou manda agir fora, contraria o posicionamento, diagnostica ou rotula, mesmo sem
                                usar o termo da lista que o código conhece.
  NAO_FECHA_COM_O_PEDIDO        recomendação, medida ou resumo que não segue da comparação ou não responde ao pedido.
Os outros 16 defeitos do revisor ficam de reserva (CALC-RUIM-22/23/26, PARECER-RUIM-35/36, ESTRAT-RUIM-17/19/23,
PROJETO-RUIM-22/23/25, PRATICA-RUIM-12/14/18/19, REL-DEF-17); entram em DEFEITOS se o banco precisar crescer.
Os 3 tipos de entrega que ainda não têm defeito só do revisor (copy, dossie, perfil_de_funcao) ficam de fora até terem.
Os "7 tipos" são de DEFEITO, não de entrega; por coincidência os defeitos escolhidos vêm de 7 tipos de entrega.

Um defeito que escapa vira regra: `Placar.escapes` e `Placar.registro_de_escapes()` devolvem os casos que o revisor
deixou passar, com o critério que devia falhar, a seção, o trecho e o que o revisor respondeu. O que fazer com cada um
(CHK nova no código, se o código consegue conferir; ou critério novo ou mais duro na rubrica) é decisão de quem lê o
registro; este módulo não escreve em lugar nenhum.

Como mudar: o conjunto de casos é só a lista DEFEITOS (id do caso -> tipo) e a tupla LIMPAS. `carregar_casos` confere
cada id na especificação e falha alto (ErroDoPlacar) se um caso sumiu ou deixou de ser só do revisor.
CUIDADO ao ligar um revisor real: passe a ele só `caso.para_o_revisor()` (sem id, sem tipo, sem gabarito). O id do caso
("...-RUIM-..." / "...-BOA-...") e o `tipo_do_defeito` entregam a resposta.
"""
from __future__ import annotations

import copy
from dataclasses import dataclass, field

from spec_helena import Spec, listar_casos
from spec_helena.caso import carregar_pedido

VEREDITOS = ("PASSOU", "FALHOU", "NAO_CONSIGO_CONFERIR")

# A regra do plano, em fração inteira (numerador, denominador). Ver o topo do arquivo.
ACHADOS_MIN = (9, 10)
FALSOS_POSITIVOS_MAX = (2, 10)

TIPOS_DE_DEFEITO = {
    "ALEM_DA_FONTE": "afirma mais, ou com mais certeza, do que a fonte, a base ou a conta sustenta",
    "CONTA_OU_DADO_TROCADO": "número, unidade, período ou data que não diz o mesmo que o trecho ou o pedido",
    "RISCO_OMITIDO_OU_SUAVIZADO": "risco, tema ou condição tocado pela entrega e sem tratamento, suavizado ou genérico",
    "ORDEM_OU_DEPENDENCIA_QUEBRADA": "passo ou marco fora da ordem de que depende, ou que depende de outra pessoa",
    "VAGO_OU_NAO_VERIFICAVEL": "ajuste, pronto ou critério que ninguém consegue conferir ou executar; jargão",
    "FORA_DO_PAPEL_OU_DA_REGRA": "age ou manda agir fora, contraria o posicionamento, diagnostica ou rotula",
    "NAO_FECHA_COM_O_PEDIDO": "recomendação, medida ou resumo que não segue da comparação ou não responde ao pedido",
}

# id do caso RUIM da especificação -> tipo do defeito. 30 casos, todos "só o revisor pega".
DEFEITOS = {
    # ALEM_DA_FONTE (5)
    "ESTRAT-RUIM-16": "ALEM_DA_FONTE",             # RUB-ESTRATEGIA-03  estimativa dita como fato
    "PARECER-RUIM-31": "ALEM_DA_FONTE",            # RUB-PARECER-01     "proíbe qualquer transferência" onde o trecho permite com condição
    "REL-DEF-16": "ALEM_DA_FONTE",                 # RUB-REL-01         conclusão que a conta não tem
    "PROJETO-RUIM-21": "ALEM_DA_FONTE",            # RUB-PROJETO-05     "as telas já foram aprovadas"
    "CALC-RUIM-24": "ALEM_DA_FONTE",               # RUB-CALCULO-06     previsão dita como dinheiro em caixa
    # CONTA_OU_DADO_TROCADO (4)
    "CALC-RUIM-19": "CONTA_OU_DADO_TROCADO",       # RUB-CALCULO-01     "por mês" com conta por semana
    "CALC-RUIM-20": "CONTA_OU_DADO_TROCADO",       # RUB-CALCULO-02     responde por semana o que foi pedido por mês
    "CALC-RUIM-21": "CONTA_OU_DADO_TROCADO",       # RUB-CALCULO-03     "por semana" virou "por mês"
    "PROJETO-RUIM-20": "CONTA_OU_DADO_TROCADO",    # RUB-PROJETO-04     data final diferente do pedido
    # RISCO_OMITIDO_OU_SUAVIZADO (4)
    "PARECER-RUIM-32": "RISCO_OMITIDO_OU_SUAVIZADO",   # RUB-PARECER-02 frase de risco de saúde sem linha
    "PARECER-RUIM-34": "RISCO_OMITIDO_OU_SUAVIZADO",   # RUB-PARECER-04 tema "não se aplica" que o roteiro toca
    "REL-DEF-02": "RISCO_OMITIDO_OU_SUAVIZADO",        # RUB-REL-02     condição do parecer tratada como detalhe
    "CALC-RUIM-25": "RISCO_OMITIDO_OU_SUAVIZADO",      # RUB-CALCULO-07 riscos genéricos, sem sinal
    # ORDEM_OU_DEPENDENCIA_QUEBRADA (4)
    "PARECER-RUIM-37": "ORDEM_OU_DEPENDENCIA_QUEBRADA",    # RUB-PARECER-07  convite antes do cadastro
    "REL-DEF-10": "ORDEM_OU_DEPENDENCIA_QUEBRADA",         # RUB-REL-03      convite antes do cadastro, contra o parecer
    "PROJETO-RUIM-19": "ORDEM_OU_DEPENDENCIA_QUEBRADA",    # RUB-PROJETO-03  envio sem depender das contas
    "PRATICA-RUIM-17": "ORDEM_OU_DEPENDENCIA_QUEBRADA",    # RUB-PRATICA-03  exercício que depende de outra pessoa
    # VAGO_OU_NAO_VERIFICAVEL (5)
    "PARECER-RUIM-33": "VAGO_OU_NAO_VERIFICAVEL",   # RUB-PARECER-03   ajuste "para evitar problemas"
    "PARECER-RUIM-38": "VAGO_OU_NAO_VERIFICAVEL",   # RUB-PARECER-08   jargão jurídico
    "PROJETO-RUIM-18": "VAGO_OU_NAO_VERIFICAVEL",   # RUB-PROJETO-02   pronto = "App bem encaminhado."
    "PRATICA-RUIM-13": "VAGO_OU_NAO_VERIFICAVEL",   # RUB-PRATICA-04   critério que depende de sensação
    "TREINO-RUIM-01": "VAGO_OU_NAO_VERIFICAVEL",    # RUB-TREINO-01    passo técnico que o leigo não faz
    # FORA_DO_PAPEL_OU_DA_REGRA (4)
    "ESTRAT-RUIM-21": "FORA_DO_PAPEL_OU_DA_REGRA",  # RUB-ESTRATEGIA-07 contato de fora escondido em SEM_ACAO_EXTERNA
    "ESTRAT-RUIM-22": "FORA_DO_PAPEL_OU_DA_REGRA",  # RUB-ESTRATEGIA-08 eLiving como app de treino, sem termo da lista
    "PROJETO-RUIM-24": "FORA_DO_PAPEL_OU_DA_REGRA", # RUB-PROJETO-08    "meta de calorias" contra o posicionamento
    "PRATICA-RUIM-15": "FORA_DO_PAPEL_OU_DA_REGRA", # RUB-PRATICA-08    causa emocional sugerida com palavras comuns
    # NAO_FECHA_COM_O_PEDIDO (4)
    "ESTRAT-RUIM-18": "NAO_FECHA_COM_O_PEDIDO",     # RUB-ESTRATEGIA-04 recomenda a opção que perde na própria comparação
    "ESTRAT-RUIM-20": "NAO_FECHA_COM_O_PEDIDO",     # RUB-ESTRATEGIA-06 validação mede outra coisa
    "REL-DEF-18": "NAO_FECHA_COM_O_PEDIDO",         # RUB-REL-05        resumo não diz o que ficou pronto
    "PRATICA-RUIM-16": "NAO_FECHA_COM_O_PEDIDO",    # RUB-PRATICA-02    padrões menores no lugar dos que atrapalham
}

# Casos BOM da especificação (acao ENTREGAR): a versão sem o defeito das entregas acima, dos 7 tipos de entrega.
LIMPAS = (
    "ESTRAT-BOA-01", "CALC-BOA-01", "CALC-BOA-02", "PARECER-BOA-01", "PARECER-BOA-02",
    "PARECER-BOA-05", "PRATICA-BOA-01", "PROJETO-BOA-01", "REL-BOA-01", "TREINO-BOA-01",
)


class ErroDoPlacar(Exception):
    """O banco de casos não bate mais com a especificação (diz qual caso e por quê)."""


@dataclass(frozen=True, eq=False)
class Caso:
    """Uma entrega para o revisor julgar. `tipo_do_defeito` é None quando a entrega é limpa."""
    id: str
    tipo_do_defeito: str | None
    entrega: dict
    rubrica: tuple
    servico: str = ""
    pedido: dict = field(default_factory=dict)
    # gabarito (nunca vai ao revisor):
    criterio_esperado: str | None = None
    secao: str | None = None
    trecho: str | None = None
    defeito_plantado: str | None = None
    origem: str = ""

    @property
    def limpa(self) -> bool:
        return self.tipo_do_defeito is None

    def para_o_revisor(self) -> dict:
        """TUDO o que um revisor real pode ver deste caso. Sem id, tipo nem gabarito (o id diz RUIM ou BOA)."""
        return copy.deepcopy({"servico": self.servico, "rubrica": list(self.rubrica),
                              "entrega": self.entrega, "pedido": self.pedido})


@dataclass(frozen=True)
class Leitura:
    """O que `ler_resposta` entendeu da resposta de um revisor."""
    decisao: str                    # "aprova", "recusa" ou "invalida"
    reprovados: tuple = ()          # ids dos critérios que não foram PASSOU (só em "recusa")
    problema: str | None = None     # por que é inválida
    resposta: object = None         # a resposta como veio


def ler_resposta(resposta, rubrica) -> Leitura:
    """Aplica as regras do topo do arquivo. Aprova == o que `conferir_rubrica` aceita (há um teste que prova)."""
    esperados = list(rubrica)
    criterios = resposta.get("criterios") if isinstance(resposta, dict) else None
    if not isinstance(criterios, list):
        return Leitura("invalida", problema="a resposta não é um dicionário com a lista 'criterios'", resposta=resposta)
    if len(criterios) != len(esperados):
        return Leitura("invalida", problema=f"vieram {len(criterios)} critérios; a rubrica tem {len(esperados)}", resposta=resposta)
    reprovados = []
    vistos = []
    for c in criterios:
        if not isinstance(c, dict):
            return Leitura("invalida", problema="um critério não é um dicionário", resposta=resposta)
        id_ = c.get("id")
        if not isinstance(id_, str) or id_ not in esperados or id_ in vistos:
            return Leitura("invalida", problema=f"critério fora da rubrica ou repetido: {id_!r}", resposta=resposta)
        vistos.append(id_)
        if c.get("resultado") not in VEREDITOS:
            return Leitura("invalida", problema=f"{id_}: resultado {c.get('resultado')!r} não é um dos vereditos", resposta=resposta)
        if not isinstance(c.get("prova"), str) or not c["prova"].strip():
            return Leitura("invalida", problema=f"{id_}: prova vazia", resposta=resposta)
        if c["resultado"] != "PASSOU":
            reprovados.append(id_)
    return Leitura("recusa" if reprovados else "aprova", tuple(reprovados), resposta=resposta)


def limiares(total_defeitos: int, total_limpas: int) -> tuple:
    """(mínimo de achados, máximo de falsos positivos) para esse tamanho de banco. 30 e 10 dão (27, 2)."""
    achados = -(-total_defeitos * ACHADOS_MIN[0] // ACHADOS_MIN[1])        # teto
    falsos = total_limpas * FALSOS_POSITIVOS_MAX[0] // FALSOS_POSITIVOS_MAX[1]  # piso
    return achados, falsos


@dataclass(frozen=True)
class Placar:
    total_defeitos: int
    total_limpas: int
    achados: tuple                  # Caso com defeito que o revisor recusou
    escapes: tuple                  # Caso com defeito que o revisor deixou passar (ou respondeu em formato inválido)
    falsos_positivos: tuple         # Caso limpo que o revisor recusou (ou respondeu em formato inválido)
    placar_por_tipo: dict           # tipo -> {"total", "achados", "escapes"}
    minimo_de_achados: int
    maximo_de_falsos_positivos: int
    aprovado: bool
    motivos: tuple                  # por que reprovou (vazio se aprovado)
    leituras: dict = field(default_factory=dict)        # id do caso -> Leitura
    invalidas: dict = field(default_factory=dict)       # id do caso -> problema (respostas fora do formato)
    achados_pelo_criterio_errado: tuple = ()            # achados em que o critério plantado não foi reprovado
    tipos_sem_achado: tuple = ()                        # tipos em que o revisor não achou nenhum defeito

    def registro_de_escapes(self) -> list:
        """Um registro (dicionário JSON) por defeito que escapou: a matéria-prima de uma regra ou critério novo."""
        return [{
            "caso": c.id, "tipo_do_defeito": c.tipo_do_defeito, "servico": c.servico,
            "criterio_que_devia_falhar": c.criterio_esperado, "secao": c.secao, "trecho": c.trecho,
            "defeito_plantado": c.defeito_plantado,
            "o_revisor": self.leituras[c.id].decisao,
            "criterios_que_o_revisor_reprovou": list(self.leituras[c.id].reprovados),
            "como_o_revisor_respondeu": copy.deepcopy(self.leituras[c.id].resposta),
            "o_que_fazer": "virar checagem de código (CHK) se o código consegue conferir; senão, criterio novo ou mais "
                           "duro na rubrica deste tipo de entrega; depois rodar o placar de novo",
        } for c in self.escapes]

    def resumo(self) -> str:
        linhas = [f"{'APROVADO' if self.aprovado else 'REPROVADO'}: achou {len(self.achados)} de {self.total_defeitos} "
                  f"defeitos (mínimo {self.minimo_de_achados}); {len(self.falsos_positivos)} falsos positivos em "
                  f"{self.total_limpas} limpas (máximo {self.maximo_de_falsos_positivos})"]
        linhas += [f"  {t}: {p['achados']} de {p['total']}" for t, p in self.placar_por_tipo.items()]
        linhas += [f"  motivo: {m}" for m in self.motivos]
        return "\n".join(linhas)


def pontuar(revisor, casos) -> Placar:
    """Roda `revisor(caso)` em cada caso e conta. Exceção do revisor sobe (falha de infraestrutura não é erro de julgamento)."""
    casos = list(casos)
    ids = [c.id for c in casos]
    if len(set(ids)) != len(ids):
        raise ValueError("há casos repetidos no placar")
    defeitos = [c for c in casos if not c.limpa]
    limpas = [c for c in casos if c.limpa]
    if not defeitos or not limpas:
        raise ValueError("o placar precisa de pelo menos um caso com defeito e um limpo; sem os dois ele não prova nada")
    leituras = {c.id: ler_resposta(revisor(c), c.rubrica) for c in casos}

    achados = tuple(c for c in defeitos if leituras[c.id].decisao == "recusa")
    escapes = tuple(c for c in defeitos if leituras[c.id].decisao != "recusa")
    falsos = tuple(c for c in limpas if leituras[c.id].decisao != "aprova")
    por_tipo = {}
    for c in defeitos:
        p = por_tipo.setdefault(c.tipo_do_defeito, {"total": 0, "achados": 0, "escapes": 0})
        p["total"] += 1
        p["achados" if leituras[c.id].decisao == "recusa" else "escapes"] += 1
    ordem = {t: i for i, t in enumerate(TIPOS_DE_DEFEITO)}
    por_tipo = dict(sorted(por_tipo.items(), key=lambda kv: ordem.get(kv[0], len(ordem))))

    minimo, maximo = limiares(len(defeitos), len(limpas))
    motivos = []
    if len(achados) < minimo:
        motivos.append(f"achou {len(achados)} de {len(defeitos)} defeitos; o mínimo é {minimo}")
    if len(falsos) > maximo:
        motivos.append(f"{len(falsos)} falsos positivos em {len(limpas)} limpas; o máximo é {maximo}")
    return Placar(
        total_defeitos=len(defeitos), total_limpas=len(limpas), achados=achados, escapes=escapes,
        falsos_positivos=falsos, placar_por_tipo=por_tipo, minimo_de_achados=minimo, maximo_de_falsos_positivos=maximo,
        aprovado=not motivos, motivos=tuple(motivos), leituras=leituras,
        invalidas={i: l.problema for i, l in leituras.items() if l.decisao == "invalida"},
        achados_pelo_criterio_errado=tuple(c for c in achados if c.criterio_esperado not in leituras[c.id].reprovados),
        tipos_sem_achado=tuple(t for t, p in por_tipo.items() if p["achados"] == 0))


# ---------------------------------------------------------------------------------------
# O banco de casos, tirado da especificação
# ---------------------------------------------------------------------------------------
def _gabarito(dados: dict) -> dict:
    v = dados.get("veredito_esperado_do_revisor") or dados.get("veredito_esperado")
    return v if isinstance(v, dict) else {}


def _rubrica_do_servico(spec, servico: str) -> tuple:
    return tuple(spec.tipo(spec.tipo_do_servico(servico))["criterio_de_pronto"]["rubrica"])


def carregar_casos(spec=None, defeitos=None, limpas=None, da_spec=None) -> list:
    """Os casos do placar: primeiro os defeitos (na ordem de DEFEITOS), depois as limpas (na ordem de LIMPAS).

    Falha com ErroDoPlacar se um id não existe na especificação, se um defeito deixou de ser só do revisor (ou passou a
    apontar mais de um critério, ou um critério fora da rubrica), se uma limpa não é um caso BOM que entrega, ou se a
    entrega está vazia. `defeitos`, `limpas` e `da_spec` (o que `listar_casos(spec)` devolve, para não reler os ~260
    arquivos a cada chamada, uns 3 s) existem para os testes; o uso normal é sem argumentos.
    """
    spec = spec or Spec()
    defeitos = DEFEITOS if defeitos is None else defeitos
    limpas = LIMPAS if limpas is None else limpas
    por_id = {c.id: c for c in (listar_casos(spec) if da_spec is None else da_spec)}
    casos = []
    for id_, tipo in defeitos.items():
        c = por_id.get(id_)
        if c is None:
            raise ErroDoPlacar(f"{id_}: o caso não existe mais em helena-v2/casos/")
        if c.bom or not c.so_o_revisor_pega:
            raise ErroDoPlacar(f"{id_}: não é um defeito só do revisor (deve_falhar_em={c.deve_falhar_em}); o placar mede o revisor")
        rubrica = _rubrica_do_servico(spec, c.servico)
        if len(c.deve_falhar_em) != 1 or c.deve_falhar_em[0] not in rubrica:
            raise ErroDoPlacar(f"{id_}: deve_falhar_em={c.deve_falhar_em} não é um único critério da rubrica de {c.servico}")
        casos.append(_montar(c, tipo, rubrica))
    for id_ in limpas:
        c = por_id.get(id_)
        if c is None:
            raise ErroDoPlacar(f"{id_}: o caso não existe mais em helena-v2/casos/")
        resposta = c.dados.get("resposta") or {}
        if not c.bom or resposta.get("acao") != "ENTREGAR":
            raise ErroDoPlacar(f"{id_}: a limpa tem de ser um caso BOM que entrega (acao ENTREGAR)")
        casos.append(_montar(c, None, _rubrica_do_servico(spec, c.servico)))
    return casos


def _montar(c, tipo, rubrica) -> Caso:
    entrega = (c.dados.get("resposta") or {}).get("entrega")
    if not isinstance(entrega, dict) or not entrega:
        raise ErroDoPlacar(f"{c.id}: o caso não traz resposta.entrega para o revisor julgar")
    g = _gabarito(c.dados)
    return Caso(
        id=c.id, tipo_do_defeito=tipo, entrega=copy.deepcopy(entrega), rubrica=rubrica, servico=c.servico,
        pedido=copy.deepcopy(carregar_pedido(c).dados),
        criterio_esperado=c.deve_falhar_em[0] if tipo else None,
        secao=g.get("secao") if tipo else None, trecho=g.get("trecho") if tipo else None,
        defeito_plantado=c.dados.get("defeito_plantado") if tipo else None,
        origem=f"{c.pasta_do_servico.name}/{c.arquivo.parent.name}/{c.arquivo.name}")
