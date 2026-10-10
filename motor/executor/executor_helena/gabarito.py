"""Gabarito do perfil: a lista do que o config.yaml TEM de dizer. Lê o arquivo que está no disco.

É conferido duas vezes: ANTES de lançar o Hermes (perfil fora do gabarito nem roda) e DEPOIS (o arquivo
continua igual). Cada linha é uma trava do plano v3 ("O agente: uma função com 5 ações"):

  memória, perfil do usuário, revisão em segundo plano, curadoria, título automático, resumo automático
  da conversa e instalação sozinha: desligados; nova tentativa interna: nenhuma; sem reserva;
  lista de ferramentas por extenso (vazia = servidor vazio); espera de 45 s pelo nosso servidor.
"""

from typing import Any, List, Mapping

from .perfil import SERVIDOR, TEMPO_DE_PARTIDA_DO_SERVIDOR_S
from .tipos import DESCONHECIDA, FERRAMENTA, PROVEDOR, FichaDoServico, Problema


def _opcao(config: Mapping, *caminho: str) -> Any:
    atual: Any = config
    for chave in caminho:
        if not isinstance(atual, Mapping) or chave not in atual:
            return None
        atual = atual[chave]
    return atual


def _chaves_de_reserva(valor: Any, caminho: str = "") -> List[str]:
    """Qualquer chave com 'fallback' no nome (menos fallback_providers vazio) é reserva escondida."""
    achados = []
    if isinstance(valor, Mapping):
        for chave, item in valor.items():
            onde = f"{caminho}.{chave}" if caminho else str(chave)
            if "fallback" in str(chave).lower() and not (onde == "fallback_providers" and item == []):
                achados.append(onde)
            achados += _chaves_de_reserva(item, onde)
    elif isinstance(valor, list):
        for i, item in enumerate(valor):
            achados += _chaves_de_reserva(item, f"{caminho}[{i}]")
    return achados


def _valor_da_opcao(args: List[str], nome: str):
    return args[args.index(nome) + 1] if nome in args and args.index(nome) + 1 < len(args) else None


def violacoes_do_perfil(config: Mapping, ficha: FichaDoServico, provedor_efetivo: str, de_teste: bool) -> List[Problema]:
    achados: List[Problema] = []

    def ruim(codigo: str, detalhe: str, classe: str = DESCONHECIDA):
        achados.append(Problema(classe, codigo, detalhe))

    modelo = config.get("model") if isinstance(config.get("model"), Mapping) else {}
    if modelo.get("default") != ficha.modelo:
        ruim("MODELO_FORA_DA_FICHA", f"esperado {ficha.modelo!r}", PROVEDOR)
    if modelo.get("provider") != provedor_efetivo:
        ruim("PROVEDOR_FORA_DA_FICHA", f"esperado {provedor_efetivo!r}", PROVEDOR)
    if not de_teste and "base_url" in modelo:
        ruim("ENDERECO_DE_PROVEDOR_NAO_PREVISTO", "só o servidor de teste pode ter base_url")
    for onde in _chaves_de_reserva(config):
        ruim("RESERVA_CONFIGURADA", f"{onde}: no Hermes, reserva configurada já está ligada")

    desligados = (
        ("MEMORIA_LIGADA", ("memory", "memory_enabled"), False),
        ("PERFIL_DO_USUARIO_LIGADO", ("memory", "user_profile_enabled"), False),
        ("MEMORIA_COM_REVISAO_EM_SEGUNDO_PLANO", ("memory", "nudge_interval"), 0),
        ("MEMORIA_EXTERNA", ("memory", "provider"), ""),
        ("REVISAO_DE_HABILIDADES_LIGADA", ("skills", "creation_nudge_interval"), 0),
        ("CURADORIA_LIGADA", ("curator", "enabled"), False),
        ("RESUMO_AUTOMATICO_LIGADO", ("compression", "enabled"), False),
        ("TITULO_AUTOMATICO_LIGADO", ("auxiliary", "title_generation", "enabled"), False),
        ("INSTALACAO_AUTOMATICA_LIGADA", ("security", "allow_lazy_installs"), False),
        ("NOVA_TENTATIVA_INTERNA_LIGADA", ("agent", "api_max_retries"), 1),
    )
    for codigo, caminho, esperado in desligados:
        valor = _opcao(config, *caminho)
        if valor is None or type(valor) is not type(esperado) or valor != esperado:
            ruim(codigo, f"{'.'.join(caminho)} deveria ser {esperado!r}, está {valor!r}")

    if config.get("toolsets") != [SERVIDOR]:
        ruim("LISTA_DE_FERRAMENTAS_DIFERENTE", f"toolsets deveria ser [{SERVIDOR!r}]", FERRAMENTA)
    servidores = config.get("mcp_servers")
    if not isinstance(servidores, Mapping) or set(servidores) != {SERVIDOR}:
        ruim("SERVIDORES_DIFERENTES", f"mcp_servers deveria ter só {SERVIDOR!r}", FERRAMENTA)
        return achados
    servidor = servidores[SERVIDOR]
    args = [str(a) for a in servidor.get("args", [])]
    if ficha.ferramentas:
        lista = (_valor_da_opcao(args, "--ferramentas") or "").split(",")
        if sorted(lista) != sorted(ficha.ferramentas) or "--servidor-vazio" in args:
            ruim("FERRAMENTAS_DO_SERVIDOR_DIFERENTES_DA_FICHA", f"esperado {sorted(ficha.ferramentas)}", FERRAMENTA)
        incluidas = _opcao(servidor, "tools", "include")
        if not isinstance(incluidas, list) or sorted(incluidas) != sorted(ficha.ferramentas):
            ruim("FILTRO_DE_FERRAMENTAS_DIFERENTE_DA_FICHA", "tools.include deveria repetir a ficha", FERRAMENTA)
    elif "--servidor-vazio" not in args or "--ferramentas" in args:
        ruim("SERVIDOR_NAO_ESTA_VAZIO", "serviço sem ferramenta precisa do servidor vazio", FERRAMENTA)
    if _valor_da_opcao(args, "--max-total") != str(ficha.orcamento.chamadas_total):
        ruim("LIMITE_DE_CHAMADAS_FORA_DA_FICHA", f"--max-total deveria ser {ficha.orcamento.chamadas_total}", FERRAMENTA)
    if _opcao(servidor, "sampling", "enabled") is not False:
        ruim("SERVIDOR_PODE_PEDIR_RESPOSTA_AO_MODELO", "sampling.enabled deveria ser false", FERRAMENTA)
    if not isinstance(servidor.get("connect_timeout"), (int, float)) \
            or servidor["connect_timeout"] < TEMPO_DE_PARTIDA_DO_SERVIDOR_S:
        ruim("ESPERA_PELO_SERVIDOR_CURTA", f"connect_timeout deveria ser >= {TEMPO_DE_PARTIDA_DO_SERVIDOR_S}", FERRAMENTA)
    descoberta = config.get("mcp_discovery_timeout")
    if not isinstance(descoberta, (int, float)) or descoberta < TEMPO_DE_PARTIDA_DO_SERVIDOR_S:
        ruim("ESPERA_DA_PRIMEIRA_VOLTA_CURTA", f"mcp_discovery_timeout deveria ser >= {TEMPO_DE_PARTIDA_DO_SERVIDOR_S}",
             FERRAMENTA)
    return achados
