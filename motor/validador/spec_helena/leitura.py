"""Lê a especificação da Helena v2 (a pasta helena-v2/) para o validador.

O que é: a única porta de entrada para os arquivos YAML da especificação. Ninguém mais abre esses arquivos.
De onde vem: helena-v2/deliverables/<tipo>.yaml, helena-v2/servicos.yaml e helena-v2/casos/. Nada é copiado:
cada consulta lê o arquivo na hora (guardando só durante a vida do objeto Spec).
Como mudar: se a pasta mudar de lugar, troque RAIZ_PADRAO aqui. Para testar com uma especificação de mentira,
crie Spec(pasta_de_teste).

Este pacote usa PyYAML (só para testes e para o quadro de cobertura). O validador de produção (validador/) não usa.
"""
from pathlib import Path

import yaml

# motor/validador/spec_helena/leitura.py  ->  parents[3] é a raiz do repositório
RAIZ_PADRAO = Path(__file__).resolve().parents[3] / "helena-v2"


class _Leitor(yaml.SafeLoader):
    """YAML seguro que NÃO transforma datas em objetos de data: 2026-10-10 continua sendo o texto "2026-10-10".

    O validador recebe texto e números simples (JSON); uma data convertida quebraria a conversão para JSON.
    """


_Leitor.yaml_implicit_resolvers = {
    chave: [(tag, rx) for tag, rx in regras if tag != "tag:yaml.org,2002:timestamp"]
    for chave, regras in yaml.SafeLoader.yaml_implicit_resolvers.items()
}


def ler_yaml(caminho):
    """Lê um arquivo YAML (UTF-8) e devolve os dados."""
    return yaml.load(Path(caminho).read_text(encoding="utf-8"), Loader=_Leitor)  # noqa: S506 (leitor seguro, ver acima)


class Spec:
    """A especificação lida do disco: serviços, tipos de entrega e checagens de código de cada tipo."""

    def __init__(self, raiz=None):
        self.raiz = Path(raiz) if raiz else RAIZ_PADRAO
        self._cache = {}

    def _ler(self, relativo):
        if relativo not in self._cache:
            self._cache[relativo] = ler_yaml(self.raiz / relativo)
        return self._cache[relativo]

    # ---- serviços
    @property
    def servicos(self) -> dict:
        """id do serviço (SRV-...) -> dados do serviço, como estão em servicos.yaml."""
        return {s["id"]: s for s in self._ler("servicos.yaml")["servicos"]}

    @property
    def checagens_comuns(self) -> list:
        """As checagens que valem para todo tipo (servicos.yaml, portao1_comum: CHK-COMUM-01 a 10)."""
        return list(self._ler("servicos.yaml")["portao1_comum"])

    # ---- tipos de entrega
    def tipos_existentes(self) -> list:
        return sorted(p.stem for p in (self.raiz / "deliverables").glob("*.yaml"))

    def tipo(self, nome):
        """Dados de deliverables/<nome>.yaml, ou None se o arquivo ainda não existe."""
        if not (self.raiz / "deliverables" / f"{nome}.yaml").exists():
            return None
        return self._ler(f"deliverables/{nome}.yaml")

    def tipo_do_servico(self, servico_id):
        return self.servicos[servico_id]["tipo_de_entrega"]

    # ---- checagens
    def checagens_do_tipo(self, nome) -> list:
        """checagens_codigo do tipo (cada uma com id, descricao, gravidade, fecha_furos, fase e, se houver, parametros)."""
        dados = self.tipo(nome)
        return list(dados["checagens_codigo"]) if dados else []

    def todas_as_checagens(self) -> dict:
        """id -> dados da checagem, de todos os tipos e das comuns. Cada item ganha 'tipo' (None para as comuns)."""
        if "todas" not in self._cache:
            saida = {c["id"]: {**c, "tipo": None} for c in self.checagens_comuns}
            for nome in self.tipos_existentes():
                for c in self.checagens_do_tipo(nome):
                    saida[c["id"]] = {**c, "tipo": nome}
            self._cache["todas"] = saida
        return self._cache["todas"]

    def gravidade(self, id_da_checagem):
        """RECUSA ou MARCA, como a especificação escreve; None se o id não está na especificação."""
        c = self.todas_as_checagens().get(id_da_checagem)
        return c["gravidade"] if c else None

    def casos_dir(self) -> Path:
        return self.raiz / "casos"
