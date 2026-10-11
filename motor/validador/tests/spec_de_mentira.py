"""Uma especificação em miniatura, escrita numa pasta de teste, para provar o adaptador sem depender dos arquivos reais.

O que é: cria servicos.yaml, deliverables/teste.yaml e casos/SRV-TESTE/ no formato de helena-v2/, com um tipo, uma
checagem de código (CHK-TESTE-01, com `parametros`), um caso bom, dois defeitos, duas fitas e uma variante.
Como mudar: acrescente o que o teste novo precisar em `criar(...)` (todos os textos são de mentira).
"""
from contextlib import contextmanager
from pathlib import Path

import yaml

from spec_helena import Spec
from validador.registro import CHECAGENS, checagem

PEDIDO_ORIGINAL = ("Quero um convite curto para o grupo. Veja a política em https://politica.exemplo.invalid/privacidade "
                   "e use no máximo 2 parágrafos.")
TEXTO_DAS_REGRAS = "Cada gravação dura de 5 a 15 minutos.\nO celular fica deitado."
TEXTO_DA_POLITICA_1 = "Política de testes, parte um. Os dados ficam guardados no Brasil."
TEXTO_DA_POLITICA_2 = "Política de testes, parte dois. Os dados podem ir para o exterior."


def _escrever(caminho: Path, dados):
    caminho.parent.mkdir(parents=True, exist_ok=True)
    caminho.write_text(yaml.safe_dump(dados, allow_unicode=True, sort_keys=False), encoding="utf-8")


def _resposta(texto):
    return {"acao": "ENTREGAR", "parecer": "OK", "acao_externa": {"tipo": "NENHUMA"}, "entrega": {"texto": texto}}


def _fita(parte, texto, situacao="LIDA"):
    r = {"situacao": situacao}
    if situacao == "LIDA":
        r.update({"leitura_id": "LEI-T-1", "parte": parte, "partes_total": 2, "url_final": "https://politica.exemplo.invalid/privacidade", "texto": texto})
    return {"id": f"FITA-T-{parte}", "chamada": {"url": "https://politica.exemplo.invalid/privacidade", "parte": parte}, "resposta": r}


def criar(pasta, limite=500, parametros=None) -> Spec:
    pasta = Path(pasta)
    _escrever(pasta / "servicos.yaml", {
        "portao1_comum": [{"id": "CHK-COMUM-01", "descricao": "x" * 12, "gravidade": "RECUSA", "fecha_furos": ["K-13"], "fase": "fase 1"}],
        "servicos": [{"id": "SRV-TESTE", "tipo_de_entrega": "teste", "acoes_permitidas": ["ENTREGAR", "REGISTRAR_FALHA"],
                      "acao_externa_permitida": ["NENHUMA", "SO_FUNDADOR"],
                      "acoes_do_fundador": [{"id": "AF-TESTE-ENVIAR", "categorias": ["CONTATO"], "descricao": "Enviar."}]}],
    })
    _escrever(pasta / "deliverables" / "teste.yaml", {
        "tipo": "teste", "servico": "SRV-TESTE", "limite": limite,
        "secoes": [{"id": "texto", "titulo": "Texto", "tipo_de_campo": "texto", "obrigatoria": True, "descricao": "não vai para o modelo",
                    "limite_caracteres": 300}],
        "checagens_codigo": [
            {"id": "CHK-TESTE-01", "descricao": "Sem a palavra proibida.", "fecha_furos": ["C-11"], "gravidade": "RECUSA", "fase": "fase 1",
             "parametros": parametros or {"termos": ["proibida"]}},
            {"id": "CHK-TESTE-02", "descricao": "Ainda não existe no código.", "fecha_furos": ["C-11"], "gravidade": "MARCA", "fase": "fase 1"},
        ],
        "criterio_de_pronto": {"codigo": ["CHK-TESTE-01", "CHK-TESTE-02"], "rubrica": [], "fundador": {"quando": "NUNCA"}},
    })
    caso = pasta / "casos" / "SRV-TESTE"
    _escrever(caso / "pedido.yaml", {
        "id": "PEDIDO-T-01", "servico": "SRV-TESTE", "card_id": "CARD-T-01", "empresa": "BIZ-T", "criado_em": "2026-10-10T09:00:00-03:00",
        "pacote_da_empresa": {"empresa": "BIZ-T", "nome": "Empresa de Teste", "grafia": "Empresa de Teste", "decisoes": ["DEC-901"],
                              "termos_proibidos_em_todo_texto": ["jamais"]},
        "ordem_de_servico": {"empresa": "BIZ-T", "pedido_original": PEDIDO_ORIGINAL, "fontes_que_pode_ler": ["https://politica.exemplo.invalid/privacidade"]},
        "plano": {"etapas": [{"id": "E1", "servico": "SRV-TESTE", "autor": "TESTE", "revisores": ["FUNDADOR"], "depende_de": [],
                              "acao_do_fundador": "AF-TESTE-ENVIAR"}]},
        "fontes_importadas": [{"id": "FON-PEDIDO-T-01", "o_que": "pedido"},
                              {"id": "FON-REGRAS-T-01", "o_que": "regras importadas", "texto": TEXTO_DAS_REGRAS}],
        "variantes": {
            "SEM-LINK": {"pedido_original": "Quero um convite curto, sem link nenhum.", "fonte_importada_id": "FON-PEDIDO-T-02",
                         "o_que_falta": "nada", "usada_por": "boas/boa-02.yaml"},
        },
    })
    _escrever(caso / "fitas" / "01.yaml", _fita(1, TEXTO_DA_POLITICA_1))
    _escrever(caso / "fitas" / "02.yaml", _fita(2, TEXTO_DA_POLITICA_2))
    _escrever(caso / "fitas" / "03-recusa.yaml", _fita(1, "", situacao="FONTE_INSUFICIENTE"))
    _escrever(caso / "boas" / "boa-01.yaml", {
        "id": "T-BOA-01", "servico": "SRV-TESTE", "pedido": "../pedido.yaml", "deve_passar_em": ["CHK-TESTE-01"],
        "usou_internet": "SIM", "leituras_feitas": ["fitas/01.yaml", "fitas/02.yaml", "fitas/03-recusa.yaml"],
        "resposta": _resposta("Convite curto e simpático para o grupo.")})
    _escrever(caso / "boas" / "boa-02.yaml", {
        "id": "T-BOA-02", "servico": "SRV-TESTE", "pedido": "../pedido.yaml", "variante": "SEM-LINK",
        "resposta": _resposta("Outro convite curto.")})
    _escrever(caso / "defeitos" / "defeito-01.yaml", {
        "id": "T-RUIM-01", "servico": "SRV-TESTE", "pedido": "../pedido.yaml", "deve_falhar_em": "CHK-TESTE-01", "portao": "1 (código)",
        "resposta": _resposta("Convite com a palavra proibida no meio.")})
    _escrever(caso / "defeitos" / "defeito-02.yaml", {
        "id": "T-RUIM-02", "servico": "SRV-TESTE", "pedido": "../pedido.yaml", "deve_falhar_em": ["CHK-TESTE-02"], "portao": "1 (marca)",
        "resposta": _resposta("Convite que a CHK-TESTE-02 deveria marcar.")})
    _escrever(caso / "defeitos" / "defeito-03.yaml", {
        "id": "T-RUIM-03", "servico": "SRV-TESTE", "pedido": "../pedido.yaml", "deve_falhar_em": "RUB-TESTE-01", "portao": "2 (revisor)",
        "passa_no_codigo": True, "resposta": _resposta("Convite com tom errado, que só o revisor percebe.")})
    return Spec(pasta)


def chk_teste_01(exe):
    """Uma checagem de mentira que LÊ os termos de `parametros` (exemplo do que o README ensina)."""
    if exe.acao != "ENTREGAR":
        return None
    from validador.resultado import Falha
    termos = exe.parametros("CHK-TESTE-01").get("termos", [])
    return [Falha("CHK-TESTE-01", "TERMO_PROIBIDO", i.caminho, "Tire o termo proibido.", t)
            for i in exe.itens if i.tipo == "livre" for t in termos if t in i.texto]


@contextmanager
def registrada(id_, funcao, gravidade="RECUSA"):
    """Registra `funcao` como checagem `id_` só durante o bloco; no fim o registro volta ao que era."""
    assert id_ not in CHECAGENS
    try:
        checagem(id_, "Checagem de mentira para teste", "Prova o adaptador sem mexer nas checagens de verdade.", ["C-11"], gravidade)(funcao)
        yield
    finally:
        CHECAGENS.pop(id_, None)
