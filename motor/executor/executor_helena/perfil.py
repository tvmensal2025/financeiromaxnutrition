"""Gerador de perfil: transforma a ficha do agente numa pasta de perfil do Hermes, pronta para uma execução.

Uma execução = duas pastas novas:

  <raiz_hermes>/profiles/exec-<id>/      HERMES_HOME do Hermes (config.yaml e SOUL.md gerados da ficha)
  <pasta_das_execucoes>/<id>/            a pasta da execução:
      trabalho/        pasta VAZIA onde o agente trabalha (fora de qualquer repositório)
      home/            HOME vazio (o Hermes não acha ~/.codex nem ~/.hermes)
      codex_vazio/     CODEX_HOME vazio (adoção automática do login do Codex desligada)
      tmp/             TMPDIR
      ferramentas/     pasta do nosso servidor de ferramentas (estado.json, registro.jsonl, leituras/)
      uso.json         registro de uso que o Hermes grava (--usage-file)
      saida.txt        o que o Hermes imprimiu (a "resposta"; só vale se a execução terminou inteira)
      erros.txt        erros do Hermes
      processo.json    quem foi lançado (para matar sobras se o motor cair)

O que o perfil liga e desliga (cada chave foi conferida no código do Hermes 0.19.0):
  memória, perfil do usuário, revisão em segundo plano, curadoria, título automático, resumo
  automático da conversa e instalação de dependências: DESLIGADOS. Nova tentativa interna: 1 (= nenhuma).
  Sem provedor/modelo reserva. Ferramentas: só o nosso servidor, sempre por extenso.
"""

import hashlib
import json
import os
import sys
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any, Dict, Mapping, Optional, Tuple

import yaml

from .ambiente import MARCADOR, construir_ambiente
from .segredos import segredos_no_texto
from .tipos import ErroDePerfil, Execucao, FichaDoServico

SERVIDOR = "ferramentas_helena"          # nome do servidor de ferramentas no config.yaml do Hermes
PASTA_IRMA_FERRAMENTAS = Path(__file__).resolve().parents[2] / "ferramentas"
TEMPO_DE_PARTIDA_DO_SERVIDOR_S = 45      # o Hermes espera o nosso servidor até 45 s (padrão dele: 15)
TEMPO_DE_CADA_CHAMADA_S = 60
INSISTENCIAS_DO_SERVIDOR = 3             # depois do limite, o servidor deixa o agente insistir 3 vezes
MARGEM_DE_CHAMADAS = 2                   # folga do vigia de chamadas (veja executor.py)


@dataclass(frozen=True)
class ConfigDoExecutor:
    """Tudo que muda de um lugar para outro (VPS, máquina de teste). Nada aqui é segredo."""
    comando_hermes: Tuple[str, ...]                  # ex.: ("/opt/hermes/bin/hermes",)
    raiz_hermes: Path                                # raiz do Hermes da v2 (guarda o login único)
    pasta_das_execucoes: Path
    comando_do_servidor_de_ferramentas: Tuple[str, ...] = (sys.executable, "-m", "ferramentas_helena")
    pythonpath_das_ferramentas: Tuple[Path, ...] = (PASTA_IRMA_FERRAMENTAS,)
    endereco_do_provedor: Optional[str] = None       # SÓ PARA TESTE: servidor falso em 127.0.0.1
    provedor_de_teste: str = "custom"
    extras_do_ambiente: Mapping[str, str] = field(default_factory=dict)   # veja ambiente.py
    graca_ao_encerrar_s: float = 3.0                 # do pedido de parada até a morte forçada
    limite_para_encerrar_s: float = 15.0             # prazo do plano: encerrar tudo em até 15 s
    intervalo_do_vigia_s: float = 0.2
    guardar_conversa_ate_bytes: int = 2_000_000

    def __post_init__(self):
        if not self.comando_hermes:
            raise ErroDePerfil("comando_hermes vazio.")
        for campo in ("raiz_hermes", "pasta_das_execucoes"):
            if not Path(getattr(self, campo)).is_absolute():
                raise ErroDePerfil(f"{campo} precisa ser um caminho absoluto.")
        if self.endereco_do_provedor is not None and not (
                self.endereco_do_provedor.startswith("http://127.0.0.1:")
                or self.endereco_do_provedor.startswith("http://localhost:")):
            raise ErroDePerfil("endereco_do_provedor só aceita servidor local (127.0.0.1): é só para teste.")
        if self.limite_para_encerrar_s <= self.graca_ao_encerrar_s:
            raise ErroDePerfil("limite_para_encerrar_s precisa ser maior que a graça.")


@dataclass(frozen=True)
class Perfil:
    id_execucao: str
    ficha: FichaDoServico
    hermes_home: Path
    pasta: Path
    trabalho: Path
    home: Path
    codex_vazio: Path
    tmp: Path
    ferramentas: Path
    arquivo_de_uso: Path
    arquivo_de_saida: Path
    arquivo_de_erros: Path
    arquivo_do_processo: Path
    config: Dict[str, Any]
    provedor_efetivo: str
    modelo: str
    de_teste: bool
    ambiente: Dict[str, str]
    hashes: Dict[str, str]              # config.yaml e SOUL.md como foram gerados
    max_de_chamadas_vistas: int         # vigia de chamadas (veja executor.py)


def sha256_do_arquivo(caminho: Path) -> str:
    return hashlib.sha256(Path(caminho).read_bytes()).hexdigest()


def montar_instrucoes(ficha: FichaDoServico) -> str:
    """Texto do SOUL.md (a identidade do agente no Hermes). Só o que está na ficha; sempre igual para a mesma ficha."""
    quem = f"Você é {ficha.nome}, {ficha.funcao}."
    papel = f"Papel nesta execução: {ficha.papel}" + (f" ({ficha.servico})" if ficha.servico else "") + "."
    linhas = [quem, papel, "", "## Missão", ficha.missao, "", "## Regras"]
    linhas += [f"- {r}" for r in ficha.regras]
    linhas += ["", "## Nunca"] + [f"- {n}" for n in ficha.nunca]
    return "\n".join(linhas) + "\n"


def nomes_visiveis_das_ferramentas(ficha: FichaDoServico) -> Tuple[str, ...]:
    """Como o Hermes 0.19.0 mostra as ferramentas do servidor ao modelo: mcp__<servidor>__<ferramenta>."""
    return tuple(f"mcp__{SERVIDOR}__{nome}" for nome in ficha.ferramentas)


def limite_de_chamadas_vistas(ficha: FichaDoServico) -> int:
    """Quantos resultados de ferramenta o vigia aceita antes de cortar a execução como LIMITE_CHAMADAS.

    O servidor de ferramentas recusa depois de chamadas_total, deixa o agente insistir mais
    INSISTENCIAS_DO_SERVIDOR vezes e então encerra. O vigia só age DEPOIS disso (mais uma margem),
    para cobrir o que o servidor não vê: ferramenta que não existe e chamadas que o próprio Hermes
    barra. O Hermes em modo -z não deixa mudar o próprio teto (90 voltas): é por isso que existe o vigia.
    """
    return ficha.orcamento.chamadas_total + 1 + INSISTENCIAS_DO_SERVIDOR + MARGEM_DE_CHAMADAS


def _repositorio_acima(pasta: Path) -> Optional[Path]:
    for candidata in [pasta, *pasta.parents]:
        if (candidata / ".git").exists():
            return candidata
    return None


def _criar(pasta: Path):
    pasta.mkdir(parents=True, exist_ok=True, mode=0o700)


def _argumentos_do_servidor(config: ConfigDoExecutor, execucao: Execucao, ferramentas_dir: Path,
                            arquivo_de_fontes: Optional[Path]) -> list:
    ficha = execucao.ficha
    args = [*config.comando_do_servidor_de_ferramentas[1:], "--execucao", execucao.id,
            "--diretorio", str(ferramentas_dir), "--max-total", str(ficha.orcamento.chamadas_total)]
    if ficha.ferramentas:
        args += ["--ferramentas", ",".join(ficha.ferramentas),
                 "--max-buscas", str(ficha.orcamento.buscas), "--max-partes", str(ficha.orcamento.partes_de_pagina),
                 "--lista-de-enderecos", str(arquivo_de_fontes)]
    else:
        args += ["--servidor-vazio"]
    return args


def montar_config(config: ConfigDoExecutor, execucao: Execucao, ferramentas_dir: Path,
                  arquivo_de_fontes: Optional[Path]) -> Dict[str, Any]:
    """O config.yaml do perfil, como dicionário. É a única fonte do que o Hermes vai ler."""
    ficha = execucao.ficha
    modelo_do_hermes: Dict[str, Any] = {"default": ficha.modelo, "provider": ficha.provedor}
    if config.endereco_do_provedor:
        modelo_do_hermes = {"default": ficha.modelo, "provider": config.provedor_de_teste,
                            "base_url": config.endereco_do_provedor}
    servidor: Dict[str, Any] = {
        "command": config.comando_do_servidor_de_ferramentas[0],
        "args": _argumentos_do_servidor(config, execucao, ferramentas_dir, arquivo_de_fontes),
        "env": {"PYTHONPATH": os.pathsep.join(str(p) for p in config.pythonpath_das_ferramentas),
                "PYTHONDONTWRITEBYTECODE": "1", MARCADOR: execucao.id},
        "enabled": True,
        "connect_timeout": TEMPO_DE_PARTIDA_DO_SERVIDOR_S,
        "timeout": TEMPO_DE_CADA_CHAMADA_S,
        "sampling": {"enabled": False},          # o servidor não pode pedir resposta ao modelo
    }
    if ficha.ferramentas:
        servidor["tools"] = {"include": list(ficha.ferramentas)}
    return {
        "model": modelo_do_hermes,
        "fallback_providers": [],                 # sem reserva: no Hermes, reserva configurada já está ligada
        "toolsets": [SERVIDOR],
        "agent": {"api_max_retries": 1},          # 1 = uma tentativa só; quem tenta de novo é o motor
        "memory": {"memory_enabled": False, "user_profile_enabled": False, "nudge_interval": 0, "provider": ""},
        "skills": {"creation_nudge_interval": 0},
        "curator": {"enabled": False},
        "compression": {"enabled": False},        # sem resumo automático: conversa grande vira GRANDE_DEMAIS
        "auxiliary": {"title_generation": {"enabled": False}},
        "security": {"allow_lazy_installs": False},
        "mcp": {"auto_reload_on_config_change": False},
        "mcp_discovery_timeout": TEMPO_DE_PARTIDA_DO_SERVIDOR_S,   # a 1ª volta espera o nosso servidor
        "mcp_servers": {SERVIDOR: servidor},
    }


def gerar_perfil(config: ConfigDoExecutor, execucao: Execucao) -> Perfil:
    """Cria as pastas e escreve config.yaml e SOUL.md. Recusa o que não for seguro."""
    ficha = execucao.ficha
    if ficha.ferramentas and execucao.fontes_permitidas is None:
        raise ErroDePerfil("a ficha tem ferramenta de leitura: diga as fontes permitidas (fontes_permitidas=...).")
    if segredos_no_texto(execucao.pacote):
        raise ErroDePerfil("o pacote da execução traz algo com cara de segredo: nada de chave no pedido ao agente.")
    for pasta in (config.pasta_das_execucoes, config.raiz_hermes):
        repositorio = _repositorio_acima(Path(pasta))
        if repositorio is not None:
            raise ErroDePerfil(f"{pasta} está dentro de um repositório ({repositorio}): "
                               "o agente tem de trabalhar fora de qualquer repositório.")
    pasta = Path(config.pasta_das_execucoes) / execucao.id
    hermes_home = Path(config.raiz_hermes) / "profiles" / f"exec-{execucao.id}"
    if pasta.exists() or hermes_home.exists():
        raise ErroDePerfil(f"a execução {execucao.id} já tem pasta: cada execução usa um id novo.")

    trabalho, home, codex_vazio, tmp, ferramentas = (pasta / n for n in ("trabalho", "home", "codex_vazio", "tmp", "ferramentas"))
    for p in (pasta, trabalho, home, codex_vazio, tmp, ferramentas, hermes_home):
        _criar(p)

    arquivo_de_fontes = None
    if ficha.ferramentas:
        arquivo_de_fontes = ferramentas / "fontes.txt"
        arquivo_de_fontes.write_text("\n".join(execucao.fontes_permitidas or ()) + "\n", encoding="utf-8")

    configuracao = montar_config(config, execucao, ferramentas, arquivo_de_fontes)
    arquivo_config, arquivo_soul = hermes_home / "config.yaml", hermes_home / "SOUL.md"
    arquivo_config.write_text(yaml.safe_dump(configuracao, sort_keys=True, allow_unicode=True), encoding="utf-8")
    arquivo_soul.write_text(montar_instrucoes(ficha), encoding="utf-8")

    de_teste = config.endereco_do_provedor is not None
    provedor_efetivo = config.provedor_de_teste if de_teste else ficha.provedor
    ambiente = construir_ambiente(
        hermes_home=hermes_home, home=home, codex_home=codex_vazio, tmp=tmp, id_execucao=execucao.id,
        pasta_do_hermes=Path(config.comando_hermes[0]).parent if os.path.isabs(config.comando_hermes[0]) else None,
        extras=config.extras_do_ambiente)
    return Perfil(
        id_execucao=execucao.id, ficha=ficha, hermes_home=hermes_home, pasta=pasta, trabalho=trabalho, home=home,
        codex_vazio=codex_vazio, tmp=tmp, ferramentas=ferramentas, arquivo_de_uso=pasta / "uso.json",
        arquivo_de_saida=pasta / "saida.txt", arquivo_de_erros=pasta / "erros.txt",
        arquivo_do_processo=pasta / "processo.json", config=configuracao, provedor_efetivo=provedor_efetivo,
        modelo=ficha.modelo, de_teste=de_teste, ambiente=ambiente,
        hashes={"config.yaml": sha256_do_arquivo(arquivo_config), "SOUL.md": sha256_do_arquivo(arquivo_soul)},
        max_de_chamadas_vistas=limite_de_chamadas_vistas(ficha))


def montar_comando(config: ConfigDoExecutor, perfil: Perfil, pacote: str) -> Tuple[str, ...]:
    """O comando exato: hermes -z <pacote> --model M --provider P --toolsets <servidor> --usage-file F.

    `--toolsets` vai SEMPRE: sem ele o Hermes usa a lista do config, e lista vazia liberaria tudo.
    """
    return (*config.comando_hermes, "-z", pacote, "--model", perfil.modelo, "--provider", perfil.provedor_efetivo,
            "--toolsets", SERVIDOR, "--usage-file", str(perfil.arquivo_de_uso))


def resumo_do_comando(comando: Tuple[str, ...]) -> Tuple[str, ...]:
    """O comando sem o texto do pacote (que pode ser grande e não deve ir para log)."""
    saida = list(comando)
    if "-z" in saida:
        i = saida.index("-z")
        if i + 1 < len(saida):
            saida[i + 1] = f"<pacote de {len(comando[i + 1])} caracteres>"
    return tuple(saida)
