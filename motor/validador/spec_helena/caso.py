"""Lê os casos de prova da especificação (helena-v2/casos/) e os converte para o que o validador recebe.

O que é: a ponte entre o formato dos casos (YAML escrito pelos agentes da v2) e o formato do validador (resposta + contexto).
De onde vem: helena-v2/casos/<SRV-...>/pedido.yaml, boas/*.yaml, defeitos/*.yaml e fitas/*.yaml. Nada é copiado.
Como mudar: cada diferença entre os dois formatos é tratada em UMA função abaixo, com a explicação no começo dela.
Se um pedido novo trouxer um desenho diferente, ajuste só a função que o lê (_ordem, _plano, _texto_do_pacote...).

Resumo das conversões (o README do validador repete em uma linha cada):
  resposta   -> o campo `resposta` do caso, escrito como JSON (o validador lê texto JSON; assim números decimais ficam exatos).
  contexto   -> hoje, execucao_id, usou_internet, links_do_pedido, decisoes_vigentes, paginas_lidas (das fitas que o caso
                diz ter lido), fontes_importadas (pedido, pacote da empresa e tabela de leis do pedido) e o modelo do tipo.
  variantes  -> um caso pode dizer `variante: NOME`; as mudanças da variante entram no pedido antes de tudo (ver aplicar_variante).
"""
import copy
import json
import re
from dataclasses import dataclass, field
from pathlib import Path

from .leitura import ler_yaml
from .modelo import montar_modelo

# Campos de uma variante que só explicam (não mudam o pedido).
CAMPOS_SO_DE_EXPLICACAO = {"usada_por", "o_que_muda", "o_que_falta", "fita"}
# Campos de uma variante que se juntam, UM nível, ao que o pedido já tem. Os outros campos são trocados por inteiro
# (ex.: o pacote de OUTRA empresa não pode herdar o slogan da primeira).
MESCLAR_UM_NIVEL = ("ordem_de_servico", "plano", "pacote_do_parecer")


class ErroDoAdaptador(Exception):
    """O caso ou o pedido não tem o que a conversão precisa (diz o que falta)."""


@dataclass
class Caso:
    id: str
    servico: str
    bom: bool
    arquivo: Path
    dados: dict

    @property
    def pasta_do_servico(self) -> Path:
        return self.arquivo.parent.parent

    @property
    def variante(self):
        """Nome de uma variante do pedido.yaml (texto) ou uma variante escrita dentro do próprio caso (dicionário)."""
        return self.dados.get("variante") or self.dados.get("variante_do_pedido")

    @property
    def deve_falhar_em(self) -> list:
        """Ids que o caso RUIM diz que têm de pegá-lo (CHK-... do código ou RUB-... do revisor). Sempre uma lista."""
        v = self.dados.get("deve_falhar_em")
        return [] if v is None else ([v] if isinstance(v, str) else list(v))

    @property
    def deve_passar_em(self) -> list:
        return list(self.dados.get("deve_passar_em") or [])

    @property
    def so_o_revisor_pega(self) -> bool:
        """O defeito é do portão 2 (revisor): o código deve deixá-lo passar."""
        return not self.bom and not any(i.startswith("CHK-") for i in self.deve_falhar_em)


@dataclass
class Pedido:
    dados: dict                                  # o pedido já com a variante aplicada (JSON puro)
    pedido_original: str | None = None
    fontes: dict = field(default_factory=dict)   # id da fonte importada -> texto


# ---------------------------------------------------------------------------------------
# Listar os casos
# ---------------------------------------------------------------------------------------
def listar_casos(spec) -> list:
    """Todos os casos de helena-v2/casos/ (boas e defeitos), em ordem estável. Serviço sem casos simplesmente não aparece."""
    casos = []
    for pasta in sorted(p for p in spec.casos_dir().glob("SRV-*") if p.is_dir()):
        for sub, bom in (("boas", True), ("defeitos", False)):
            for arq in sorted((pasta / sub).glob("*.yaml")):
                dados = ler_yaml(arq)
                casos.append(Caso(dados["id"], dados.get("servico") or pasta.name, bom, arq, dados))
    return casos


# ---------------------------------------------------------------------------------------
# O pedido
# ---------------------------------------------------------------------------------------
def _ordem(p: dict) -> dict:
    """A ordem de serviço: no topo do pedido (cálculo, análise, prática) ou dentro de `card` (parecer, relatório, projeto)."""
    return p.get("ordem_de_servico") or (p.get("card") or {}).get("ordem_de_servico") or {}


def _plano(p: dict) -> dict:
    return p.get("plano") or (p.get("card") or {}).get("plano") or {}


def _onde_fica(p: dict, chave: str) -> dict:
    """O dicionário em que `chave` mora: o topo do pedido ou o `card` dele."""
    if chave not in p and isinstance(p.get("card"), dict) and chave in p["card"]:
        return p["card"]
    return p


def _json_puro(x):
    """Passa por JSON para as chaves virarem texto (versoes: {1: ...} -> "1") e nada ficar de fora do formato do contexto."""
    return json.loads(json.dumps(x, ensure_ascii=False, default=str))


def _remover_do_pacote(pedido: dict, caminho: str):
    """Aplica uma linha de `remover_do_pacote`: "a.b.lista[id=X]" tira da lista a.b.lista o item cujo id é X."""
    m = re.fullmatch(r"([\w.]+)\[(\w+)=([^\]]+)\]", caminho)
    if not m:
        raise ErroDoAdaptador(f"remover_do_pacote: não entendi {caminho!r} (esperado: caminho.da.lista[campo=valor]).")
    no = pedido
    for parte in m.group(1).split("."):
        no = no.get(parte) if isinstance(no, dict) else None
    if not isinstance(no, list):
        raise ErroDoAdaptador(f"remover_do_pacote: {m.group(1)!r} não é uma lista no pedido.")
    no[:] = [x for x in no if not (isinstance(x, dict) and str(x.get(m.group(2))) == m.group(3))]


def aplicar_variante(pedido: dict, nome) -> tuple:
    """Devolve (pedido com a variante aplicada, texto novo do pedido original ou None, fonte importada nova ou None).

    As variantes dos pedidos não têm um desenho único; as regras abaixo cobrem os que existem hoje:
      - `pedido_original` na variante troca o texto do pedido original (cálculo, análise, parecer/adolescentes);
      - `fonte_importada_id` na variante é o id que a fonte do pedido original da variante recebe (cálculo);
      - `pecas_julgadas` na raiz da variante vale como pacote_do_parecer.pecas_julgadas, trocado por inteiro (parecer/adolescentes);
      - ordem_de_servico, plano e pacote_do_parecer se juntam ao que o pedido já tem, um nível;
      - qualquer outro campo troca o do pedido por inteiro; os campos de explicação são ignorados;
      - `variante_do_pedido` escrita DENTRO do caso (relatório final) só pode ter `remover_do_pacote`: caminho.da.lista[id=X].
    """
    novo = copy.deepcopy({k: x for k, x in pedido.items() if k != "variantes"})
    if isinstance(nome, dict):  # variante escrita dentro do caso: só sabemos tirar itens do pacote (relatório final)
        desconhecidos = set(nome) - {"descricao", "remover_do_pacote"}
        if desconhecidos:
            raise ErroDoAdaptador(f"variante_do_pedido do caso tem campo que o adaptador não conhece: {sorted(desconhecidos)}.")
        for caminho in nome.get("remover_do_pacote") or []:
            _remover_do_pacote(novo, caminho)
        return novo, None, None
    variantes = pedido.get("variantes") or {}
    if nome not in variantes:
        raise ErroDoAdaptador(f"O caso pede a variante {nome!r}, mas o pedido só tem: {', '.join(variantes) or 'nenhuma'}.")
    v = copy.deepcopy(variantes[nome])
    texto_novo = v.pop("pedido_original", None)
    fonte_nova = v.pop("fonte_importada_id", None)
    if "pecas_julgadas" in v:
        novo.setdefault("pacote_do_parecer", {})["pecas_julgadas"] = v.pop("pecas_julgadas")
    for chave, valor in v.items():
        if chave in CAMPOS_SO_DE_EXPLICACAO:
            continue
        alvo = _onde_fica(novo, chave)
        if chave in MESCLAR_UM_NIVEL and isinstance(valor, dict) and isinstance(alvo.get(chave), dict):
            alvo[chave].update(valor)
        else:
            alvo[chave] = valor
    if texto_novo is not None:
        _ordem(novo)["pedido_original"] = texto_novo
    return novo, texto_novo, fonte_nova


def _folhas_de_texto(x) -> list:
    if isinstance(x, str):
        return [x]
    if isinstance(x, dict):
        return [t for v in x.values() for t in _folhas_de_texto(v)]
    if isinstance(x, list):
        return [t for v in x for t in _folhas_de_texto(v)]
    return []


def _texto_do_pacote(pacote) -> str:
    """O texto do pacote da empresa como fonte importada: todos os textos do pacote, um por linha."""
    return "\n".join(_folhas_de_texto(pacote))


def _texto_da_tabela_de_leis(tabela) -> str:
    """A tabela de leis do parecer como fonte importada: o texto de cada linha, um por linha."""
    return "\n".join(l["texto"] for l in (tabela or {}).get("linhas", []) if isinstance(l, dict) and isinstance(l.get("texto"), str))


def carregar_pedido(caso: Caso) -> Pedido:
    """Lê o pedido.yaml da pasta do serviço, aplica a variante do caso e reúne as fontes importadas.

    Fontes importadas que o código guardaria antes de qualquer IA (copy.yaml, "De onde vêm os fatos"):
      FON-PEDIDO-<card> = o pedido original; FON-PACOTE-<empresa> = o pacote da empresa;
      a tabela de leis do parecer tem o id que o próprio pedido dá. Os ids que o pedido declara também valem.
    """
    arq = caso.pasta_do_servico / "pedido.yaml"
    if not arq.exists():
        raise ErroDoAdaptador(f"{caso.pasta_do_servico.name}: não há pedido.yaml.")
    pedido = ler_yaml(arq)
    texto_variante = fonte_da_variante = None
    if caso.variante:
        pedido, texto_variante, fonte_da_variante = aplicar_variante(pedido, caso.variante)
    pedido.pop("variantes", None)
    pedido = _json_puro(pedido)

    original = _ordem(pedido).get("pedido_original")
    pacote = pedido.get("pacote_da_empresa")
    texto_pacote = _texto_do_pacote(pacote) if pacote else None
    card_id = pedido.get("card_id") or (pedido.get("card") or {}).get("card_id")
    empresa = pedido.get("empresa") or _ordem(pedido).get("empresa")

    fontes = {}
    if original is not None:
        if card_id:
            fontes[f"FON-PEDIDO-{card_id}"] = original
        for f in pedido.get("fontes_importadas") or []:
            if str(f.get("id", "")).startswith("FON-PEDIDO"):
                fontes[f["id"]] = original
        if (pedido.get("material") or {}).get("fonte_importada_id"):
            fontes[pedido["material"]["fonte_importada_id"]] = original
        if fonte_da_variante:
            fontes[fonte_da_variante] = texto_variante if texto_variante is not None else original
    if texto_pacote:
        if empresa:
            fontes[f"FON-PACOTE-{empresa}"] = texto_pacote
        if pacote.get("fonte_importada_id"):
            fontes[pacote["fonte_importada_id"]] = texto_pacote
        for f in pedido.get("fontes_importadas") or []:
            if str(f.get("id", "")).startswith("FON-PACOTE"):
                fontes[f["id"]] = texto_pacote
    tabela = (pedido.get("pacote_do_parecer") or {}).get("tabela_de_leis")
    if tabela and tabela.get("fonte_importada_id"):
        fontes[tabela["fonte_importada_id"]] = _texto_da_tabela_de_leis(tabela)
    return Pedido(pedido, original, fontes)


# ---------------------------------------------------------------------------------------
# O contexto
# ---------------------------------------------------------------------------------------
_URL = re.compile(r"https?://[^\s<>\"')\]]+")


def _links(pedido: Pedido) -> list:
    """Links que o fundador colou no pedido ou ligou como 'pode ler' (ordem de serviço)."""
    achados = [u.rstrip(".,;:") for u in _URL.findall(pedido.pedido_original or "")]
    achados += list(_ordem(pedido.dados).get("fontes_que_pode_ler") or [])
    return list(dict.fromkeys(achados))


def _hoje(pedido: dict):
    """A data do pedido (criação do card; senão a montagem do plano). Sem data no pedido, o validador usa a data do computador."""
    for texto in (pedido.get("criado_em"), (pedido.get("card") or {}).get("criado_em"), _plano(pedido).get("montado_em")):
        if isinstance(texto, str) and re.match(r"\d{4}-\d{2}-\d{2}", texto):
            return texto[:10]
    return None


def _decisoes(pedido: dict) -> list:
    """Decisões vigentes citadas pelo pedido: [{"id": "DEC-024", "versao": 1}]. A especificação só traz o id (e a versão);
    o VALOR de cada decisão o motor lê na hora, então não há como entregá-lo aqui."""
    achadas = {}
    fontes = [(pedido.get("pacote_da_empresa") or {}).get("decisoes"), (pedido.get("pacote_do_parecer") or {}).get("decisoes"),
              [x.strip() for x in str((pedido.get("card") or {}).get("decisoes_versao", "")).split(",") if x.strip()]]
    for lista in fontes:
        for item in lista or []:
            m = re.match(r"(DEC-\d+)(?:\s+v(\d+))?$", str(item).strip())
            if m:
                achadas.setdefault(m.group(1), {"id": m.group(1)})
                if m.group(2):
                    achadas[m.group(1)]["versao"] = int(m.group(2))
    return list(achadas.values())


def _paginas_lidas(caso: Caso, execucao_id: str) -> list:
    """As páginas que a ferramenta ler_pagina devolveu NESTA execução: as fitas listadas em `leituras_feitas` do caso.

    Cada fita é uma parte de uma página (leitura_id, parte, partes_total, texto). Partes da mesma leitura_id se juntam.
    Fita com situação diferente de LIDA (ex.: FONTE_INSUFICIENTE) não entrega página.
    """
    paginas = {}
    for rel in caso.dados.get("leituras_feitas") or []:
        arq = caso.pasta_do_servico / rel
        if not arq.exists():
            raise ErroDoAdaptador(f"{caso.id}: a fita {rel} não existe em {caso.pasta_do_servico.name}.")
        fita = ler_yaml(arq)
        r = fita.get("resposta") or {}
        if r.get("situacao") != "LIDA":
            continue
        p = paginas.setdefault(r["leitura_id"], {
            "leitura_id": r["leitura_id"], "url": r.get("url_final") or (fita.get("chamada") or {}).get("url"),
            "execucao": execucao_id, "partes_total": r.get("partes_total") or 1, "partes": {}})
        p["partes"][str(r.get("parte") or 1)] = r.get("texto", "")
    return list(paginas.values())


def montar_contexto(spec, caso: Caso, pedido: Pedido | None = None) -> dict:
    """O contexto do validador para este caso (ver README do validador, "O que o validador recebe").

    Além dos campos do README, leva dois extras para as checagens da especificação:
      pacote_da_empresa  o pacote da empresa do card (ou None no card pessoal), como está no pedido;
      pedido             o pedido inteiro, já com a variante aplicada (os pacotes do parecer e do relatório estão aí dentro).
    """
    pedido = pedido or carregar_pedido(caso)
    p = pedido.dados
    tipo = spec.tipo_do_servico(caso.servico)
    execucao_id = f"EXE-{caso.id}"
    leituras = caso.dados.get("leituras_feitas") or []
    plano = _plano(p).get("etapas") or []
    acao_do_plano = next((e.get("acao_do_fundador") for e in plano if e.get("servico") == caso.servico and e.get("acao_do_fundador")), None)
    contexto = {
        "execucao_id": execucao_id,
        "usou_internet": caso.dados.get("usou_internet") or ("SIM" if leituras else "NAO"),
        "links_do_pedido": _links(pedido),
        "decisoes_vigentes": _decisoes(p),
        "paginas_lidas": _paginas_lidas(caso, execucao_id),
        "fontes_importadas": [{"fonte_importada_id": i, "texto": t} for i, t in pedido.fontes.items()],
        "modelo": montar_modelo(spec, tipo, acao_do_plano),
        "pacote_da_empresa": p.get("pacote_da_empresa"),
        "pedido": p,
    }
    hoje = _hoje(p)
    if hoje:
        contexto["hoje"] = hoje
    return contexto


def montar_resposta(caso: Caso) -> str:
    """A resposta do agente como TEXTO JSON (é assim que o validador a recebe do motor)."""
    if "resposta" not in caso.dados:
        raise ErroDoAdaptador(f"{caso.id}: o caso não tem o campo 'resposta'.")
    return json.dumps(caso.dados["resposta"], ensure_ascii=False, default=str)


def montar_entrada(spec, caso: Caso) -> tuple:
    """(resposta, contexto) prontos para `validador.validar(resposta, contexto)`."""
    return montar_resposta(caso), montar_contexto(spec, caso)
