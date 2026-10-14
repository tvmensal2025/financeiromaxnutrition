"""Leitura da ficha do agente (helena-v2/agents/*.yaml) e do catálogo de modelos (models.yaml).

Entrega um `FichaDoServico`: tudo que UMA execução precisa, já resolvido para um papel:
  AUTOR         um serviço da ficha (orçamento, ferramentas e ações do serviço)
  REVISOR       a revisão do agente (sem ferramenta, modelo.revisao)
  COORDENACAO   só a Helena: LER_DE_VOLTA ou RECOMENDAR (sem ferramenta, modelo.coordenacao)

Dois formatos de ficha são aceitos (o mapa de campos está no README):
  3.1      o formato novo (schemas/agent.schema.json): servicos[], revisao, coordenacao, modelo{}
  antigo   o formato da fase 1 (caio.yaml, clara.yaml...): ferramentas, orcamento{tempo_s,passos,buscas}
           no topo. É CONVERTIDO e a conversão aparece em `avisos`.

Regras que a leitura impõe (qualquer quebra vira ErroDeFicha):
  - só existem as ferramentas ler_pagina e buscar, e as duas só LEEM (efeito LER);
  - o modelo vem de um apelido de models.yaml, nunca de um nome escrito na ficha;
  - o catálogo de modelos não pode ter reserva (reserva, fallback ou segundo provedor);
  - o orçamento tem de caber: chamadas_total >= buscas + partes_de_pagina + 1.
"""

import unicodedata
from pathlib import Path
from typing import Any, Dict, Mapping, Optional, Tuple

import yaml

from .tipos import ErroDeFicha, FichaDoServico, Orcamento

FERRAMENTAS_QUE_EXISTEM = ("ler_pagina", "buscar")
# Nomes da ficha antiga -> nomes novos (servicos.yaml, ferramentas_nossas).
NOMES_ANTIGOS = {"web_extract": "ler_pagina", "web_search": "buscar"}
FASES = {"v2.0": 0, "fase 3": 1, "fase 4": 2}
ACOES_COM_FERRAMENTA = ("ENTREGAR", "REGISTRAR_FALHA")          # quem lê a internet só entrega
ACOES_SEM_FERRAMENTA = ("ENTREGAR", "PERGUNTAR", "DEVOLVER_A_QUEM_PEDIU", "REGISTRAR_FALHA")
CAMPOS_PROIBIDOS_NO_MODELO = ("reserva", "fallback", "fallback_model", "fallback_providers", "modelos_alternativos")
PAPEL_DO_APELIDO = {"AUTOR": "AUTOR", "REVISOR": "REVISAO", "COORDENACAO": "COORDENACAO"}


def _ler_yaml(caminho: Path) -> dict:
    try:
        dados = yaml.safe_load(Path(caminho).read_text(encoding="utf-8"))
    except (OSError, yaml.YAMLError) as erro:
        raise ErroDeFicha(f"não consegui ler {caminho}: {erro}") from erro
    if not isinstance(dados, dict):
        raise ErroDeFicha(f"{caminho} não é um mapa YAML.")
    return dados


def _sem_acento(texto: str) -> str:
    return "".join(c for c in unicodedata.normalize("NFD", texto) if unicodedata.category(c) != "Mn")


def _inteiro(valor: Any, campo: str, minimo: int = 0) -> int:
    if isinstance(valor, bool) or not isinstance(valor, int) or valor < minimo:
        raise ErroDeFicha(f"{campo} precisa ser um número inteiro >= {minimo} (veio {valor!r}).")
    return valor


def _texto_obrigatorio(ficha: Mapping, campo: str) -> str:
    valor = ficha.get(campo)
    if not isinstance(valor, str) or not valor.strip():
        raise ErroDeFicha(f"a ficha não tem o campo de texto '{campo}'.")
    return " ".join(valor.split())


def _lista_de_textos(ficha: Mapping, campo: str) -> Tuple[str, ...]:
    valor = ficha.get(campo)
    if not isinstance(valor, list) or not valor or not all(isinstance(t, str) and t.strip() for t in valor):
        raise ErroDeFicha(f"a ficha precisa de '{campo}' como lista de textos.")
    return tuple(" ".join(t.split()) for t in valor)


# --- catálogo de modelos ---------------------------------------------------------------------------
def ler_modelos(caminho_dos_modelos: Path) -> Dict[str, Dict[str, str]]:
    """Lê models.yaml e devolve {apelido: {modelo, provedor, papel}}. Recusa reserva escondida."""
    dados = _ler_yaml(caminho_dos_modelos)
    apelidos = dados.get("apelidos")
    papeis = dados.get("papel_do_apelido") or {}
    if not isinstance(apelidos, dict) or not apelidos:
        raise ErroDeFicha("models.yaml sem 'apelidos'.")
    for proibido in CAMPOS_PROIBIDOS_NO_MODELO:
        if proibido in dados:
            raise ErroDeFicha(f"models.yaml tem '{proibido}': modelo reserva é proibido (o Hermes liga a reserva sozinho).")
    saida = {}
    for apelido, item in apelidos.items():
        if not isinstance(item, dict):
            raise ErroDeFicha(f"apelido {apelido}: esperava um mapa.")
        for proibido in CAMPOS_PROIBIDOS_NO_MODELO:
            if proibido in item:
                raise ErroDeFicha(f"apelido {apelido} tem '{proibido}': modelo reserva é proibido.")
        modelo, provedor = item.get("modelo"), item.get("provedor")
        if not isinstance(modelo, str) or not modelo.strip() or not isinstance(provedor, str) or not provedor.strip():
            raise ErroDeFicha(f"apelido {apelido}: precisa de modelo e provedor.")
        saida[apelido] = {"modelo": modelo.strip(), "provedor": provedor.strip(), "papel": papeis.get(apelido, "")}
    return saida


def _apelido_para(modelos: Mapping, apelido: Any, papel: str) -> Tuple[str, str]:
    if not isinstance(apelido, str) or apelido not in modelos:
        raise ErroDeFicha(f"o apelido de modelo {apelido!r} não existe em models.yaml.")
    esperado = PAPEL_DO_APELIDO[papel]
    declarado = modelos[apelido]["papel"]
    if declarado and declarado != esperado:
        raise ErroDeFicha(f"o apelido {apelido} é do papel {declarado}, não de {esperado}.")
    return modelos[apelido]["modelo"], modelos[apelido]["provedor"]


# --- ferramentas e orçamento -----------------------------------------------------------------------
def _ferramentas_3_1(itens: Any, fase_em_curso: str) -> Tuple[Tuple[str, ...], Tuple[str, ...]]:
    """Devolve (ferramentas liberadas na fase, avisos)."""
    if not isinstance(itens, list):
        raise ErroDeFicha("'ferramentas' precisa ser uma lista (pode ser vazia).")
    liberadas, avisos = [], []
    for item in itens:
        if not isinstance(item, dict):
            raise ErroDeFicha(f"ferramenta {item!r}: esperava um mapa com nome, efeito e desde.")
        nome, efeito, desde = item.get("nome"), item.get("efeito"), item.get("desde")
        if nome not in FERRAMENTAS_QUE_EXISTEM:
            raise ErroDeFicha(f"ferramenta desconhecida: {nome!r}. Só existem {FERRAMENTAS_QUE_EXISTEM}.")
        if efeito != "LER":
            raise ErroDeFicha(f"ferramenta {nome} com efeito {efeito!r}: agente só pode usar ferramenta que LÊ.")
        if desde not in FASES:
            raise ErroDeFicha(f"ferramenta {nome}: 'desde' {desde!r} não é uma fase conhecida.")
        if nome in liberadas:
            raise ErroDeFicha(f"ferramenta repetida na ficha: {nome}.")
        if FASES[desde] <= FASES[fase_em_curso]:
            liberadas.append(nome)
        else:
            avisos.append(f"ferramenta {nome} só entra a partir de '{desde}' (fase em curso: '{fase_em_curso}'): fora do perfil.")
    return tuple(liberadas), tuple(avisos)


def _ferramentas_antigas(itens: Any) -> Tuple[str, ...]:
    if not isinstance(itens, list):
        raise ErroDeFicha("'ferramentas' da ficha antiga precisa ser uma lista.")
    saida = []
    for item in itens:
        nome = NOMES_ANTIGOS.get(item) if isinstance(item, str) else None
        if nome is None:
            raise ErroDeFicha(f"ferramenta {item!r} da ficha antiga não é de leitura (só web_search e web_extract).")
        if nome not in saida:
            saida.append(nome)
    return tuple(saida)


def _orcamento(valores: Mapping, ferramentas: Tuple[str, ...], nome: str) -> Orcamento:
    buscas = _inteiro(valores.get("buscas", 0), f"{nome}.buscas")
    partes = _inteiro(valores.get("partes_de_pagina", 0), f"{nome}.partes_de_pagina")
    total = _inteiro(valores.get("chamadas_total"), f"{nome}.chamadas_total", 1)
    tempo = _inteiro(valores.get("tempo_s"), f"{nome}.tempo_s", 1)
    if "buscar" not in ferramentas:
        buscas = 0
    if "ler_pagina" not in ferramentas:
        partes = 0
    if total < buscas + partes + 1:
        raise ErroDeFicha(f"{nome}: orçamento impossível (chamadas_total {total} < buscas {buscas} + partes {partes} + 1).")
    return Orcamento(buscas=buscas, partes_de_pagina=partes, chamadas_total=total, tempo_s=tempo)


def _orcamento_antigo(valores: Any, ferramentas: Tuple[str, ...], nome: str) -> Tuple[Orcamento, str]:
    """{tempo_s, passos, buscas} -> Orcamento. Veja a tabela do README (mapa de campos)."""
    if not isinstance(valores, dict):
        raise ErroDeFicha(f"{nome}: esperava um mapa com tempo_s, passos e buscas.")
    passos = _inteiro(valores.get("passos"), f"{nome}.passos", 1)
    buscas = _inteiro(valores.get("buscas", 0), f"{nome}.buscas") if "buscar" in ferramentas else 0
    partes = max(0, passos - buscas - 1) if "ler_pagina" in ferramentas else 0
    convertido = {"buscas": buscas, "partes_de_pagina": partes, "chamadas_total": max(passos, buscas + partes + 1),
                  "tempo_s": valores.get("tempo_s")}
    aviso = (f"{nome} convertido da ficha antiga: passos {passos} -> chamadas_total {convertido['chamadas_total']}; "
             f"partes_de_pagina = passos - buscas - 1 = {partes}.")
    return _orcamento(convertido, ferramentas, nome), aviso


# --- as leituras por formato -----------------------------------------------------------------------
def _escolher_servico(ficha: Mapping, servico: Optional[str]) -> Mapping:
    servicos = ficha.get("servicos")
    if not isinstance(servicos, list) or not servicos:
        raise ErroDeFicha("a ficha 3.1 não tem 'servicos'.")
    if servico is None:
        if len(servicos) != 1:
            raise ErroDeFicha("a ficha tem mais de um serviço: diga qual (servico=...).")
        return servicos[0]
    for item in servicos:
        if isinstance(item, dict) and item.get("servico") == servico:
            return item
    raise ErroDeFicha(f"a ficha não tem o serviço {servico!r}.")


def _ler_3_1(ficha: Mapping, modelos: Mapping, papel: str, servico: Optional[str],
             evento: Optional[str], fase_em_curso: str) -> Dict[str, Any]:
    modelo_da_ficha = ficha.get("modelo")
    if not isinstance(modelo_da_ficha, dict):
        raise ErroDeFicha("a ficha 3.1 não tem o bloco 'modelo'.")
    avisos: Tuple[str, ...] = ()
    if papel == "AUTOR":
        item = _escolher_servico(ficha, servico)
        ferramentas, avisos = _ferramentas_3_1(item.get("ferramentas"), fase_em_curso)
        orcamento = _orcamento(item.get("orcamento") or {}, ferramentas, f"servico {item.get('servico')}")
        acoes = tuple(item.get("acoes_permitidas") or ())
        if not acoes:
            raise ErroDeFicha(f"serviço {item.get('servico')}: sem acoes_permitidas.")
        if ferramentas and not set(acoes) <= set(ACOES_COM_FERRAMENTA):
            raise ErroDeFicha("serviço com ferramenta de leitura só pode ENTREGAR ou REGISTRAR_FALHA.")
        rotulo, apelido = item.get("servico"), modelo_da_ficha.get("autor")
    elif papel == "REVISOR":
        revisao = ficha.get("revisao")
        if not isinstance(revisao, dict) or revisao.get("ferramentas") not in ([], ()):
            raise ErroDeFicha("a revisão roda sempre sem ferramenta ('revisao.ferramentas' deve ser lista vazia).")
        ferramentas, acoes = (), ()
        orcamento = _orcamento(revisao.get("orcamento") or {}, ferramentas, "revisao")
        rotulo, apelido = None, modelo_da_ficha.get("revisao")
    else:
        coordenacao = ficha.get("coordenacao")
        if not isinstance(coordenacao, dict) or evento not in ("LER_DE_VOLTA", "RECOMENDAR"):
            raise ErroDeFicha("COORDENACAO precisa de evento LER_DE_VOLTA ou RECOMENDAR e de 'coordenacao' na ficha.")
        bloco = coordenacao.get(evento) or {}
        if bloco.get("ferramentas") not in ([], ()):
            raise ErroDeFicha("a coordenação roda sempre sem ferramenta.")
        ferramentas, acoes = (), ()
        orcamento = _orcamento(bloco.get("orcamento") or {}, ferramentas, f"coordenacao.{evento}")
        rotulo, apelido = evento, modelo_da_ficha.get("coordenacao")
    nome_do_modelo, provedor = _apelido_para(modelos, apelido, papel)
    return dict(servico=rotulo, ferramentas=ferramentas, orcamento=orcamento, acoes_permitidas=acoes,
                apelido=apelido, modelo=nome_do_modelo, provedor=provedor, avisos=avisos,
                agente_id=_texto_obrigatorio(ficha, "id"), identidade=_texto_obrigatorio(ficha, "identidade"),
                formato="3.1", versao=_texto_obrigatorio(ficha, "versao"))


def _ler_antiga(ficha: Mapping, modelos: Mapping, papel: str) -> Dict[str, Any]:
    if papel == "COORDENACAO":
        raise ErroDeFicha("a ficha antiga não tem coordenação.")
    ferramentas = _ferramentas_antigas(ficha.get("ferramentas", []))
    if papel == "REVISOR":
        ferramentas_do_papel = ()
        orcamento, aviso = _orcamento_antigo(ficha.get("orcamento_revisao"), ferramentas_do_papel, "orcamento_revisao")
        acoes = ()
        apelido, nome_do_modelo, provedor = "revisao-padrao", *_apelido_para(modelos, "revisao-padrao", papel)
    else:
        ferramentas_do_papel = ferramentas
        orcamento, aviso = _orcamento_antigo(ficha.get("orcamento"), ferramentas_do_papel, "orcamento")
        acoes = ACOES_COM_FERRAMENTA if ferramentas_do_papel else ACOES_SEM_FERRAMENTA
        apelido = ficha.get("modelo")
        nome_do_modelo, provedor = _apelido_para(modelos, apelido, papel)
    produz = ficha.get("produz")
    rotulo = f"ENTREGA-{produz[0]}" if papel == "AUTOR" and isinstance(produz, list) and produz else None
    aviso_geral = "ficha antiga (fase 1): campos convertidos para o formato 3.1; revisar quando a ficha 3.1 existir."
    return dict(servico=rotulo, ferramentas=ferramentas_do_papel, orcamento=orcamento, acoes_permitidas=acoes,
                apelido=apelido, modelo=nome_do_modelo, provedor=provedor, avisos=(aviso_geral, aviso),
                agente_id=_texto_obrigatorio(ficha, "id"),
                identidade=_sem_acento(_texto_obrigatorio(ficha, "nome")).upper(),
                formato="antigo", versao="antiga")


def ler_ficha(caminho_da_ficha: Path, *, caminho_dos_modelos: Path, fase_em_curso: str,
              papel: str = "AUTOR", servico: Optional[str] = None, evento: Optional[str] = None) -> FichaDoServico:
    """Lê a ficha e devolve o que a execução precisa. `fase_em_curso` não tem valor padrão de propósito."""
    if papel not in ("AUTOR", "REVISOR", "COORDENACAO"):
        raise ErroDeFicha(f"papel desconhecido: {papel!r}.")
    if fase_em_curso not in FASES:
        raise ErroDeFicha(f"fase_em_curso desconhecida: {fase_em_curso!r}. Use uma de {tuple(FASES)}.")
    ficha = _ler_yaml(caminho_da_ficha)
    modelos = ler_modelos(caminho_dos_modelos)
    versao = ficha.get("versao")
    if isinstance(versao, str) and versao.startswith("3.1") and "servicos" in ficha:
        achados = _ler_3_1(ficha, modelos, papel, servico, evento, fase_em_curso)
    else:
        achados = _ler_antiga(ficha, modelos, papel)
    return FichaDoServico(
        agente_id=achados["agente_id"], identidade=achados["identidade"],
        nome=_texto_obrigatorio(ficha, "nome"), funcao=_texto_obrigatorio(ficha, "funcao"),
        papel=papel, servico=achados["servico"], ferramentas=achados["ferramentas"],
        orcamento=achados["orcamento"], acoes_permitidas=achados["acoes_permitidas"],
        apelido_do_modelo=achados["apelido"], modelo=achados["modelo"], provedor=achados["provedor"],
        missao=_texto_obrigatorio(ficha, "missao"), regras=_lista_de_textos(ficha, "regras"),
        nunca=_lista_de_textos(ficha, "nunca"), versao_da_ficha=achados["versao"],
        formato_da_ficha=achados["formato"], avisos=achados["avisos"])
