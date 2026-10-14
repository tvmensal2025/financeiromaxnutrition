"""O "teste 3" do plano (Hermes travado), contra o servidor falso de provedor e o Hermes de mentira.

Cada teste roda um cenário de testes/cenarios.py. Os mesmos cenários rodam no Hermes de verdade em
verificacao_real/ (veja o README). Os defeitos que cada cenário pega estão provados em test_mutacoes.py.
"""

from pathlib import Path

import pytest
import yaml

import cenarios
from cenarios import (TEXTO_DIZ_COTA, verificador_de_acao)
from executor_helena.provedor_falso import Cenario, Simulacao
from executor_helena.tipos import (COTA, DESCONHECIDA, FERRAMENTA, FORMATO_ERRADO, GRANDE_DEMAIS, LIMITE_CHAMADAS, LOGIN, PROVEDOR,
                                   QUEDA, TEMPO)

V2 = Path(__file__).resolve().parents[3] / "helena-v2"
FICHAS_DE_TESTE = ["sem_ferramenta", "com_ferramentas", "antiga_sem_ferramenta", "antiga_com_busca"]


def fichas_reais():
    """Toda ficha de helena-v2/agents, em todos os papéis que ela tem (alerta se a spec mudar)."""
    casos = []
    for caminho in sorted((V2 / "agents").glob("*.yaml")):
        ficha = yaml.safe_load(caminho.read_text(encoding="utf-8")) or {}
        servicos = ficha.get("servicos")
        # A fase em curso é a da ativação do agente: o Ravi liga na "fase 3" e só ali a ferramenta "buscar" (da "fase 4")
        # ainda NÃO existe para ele; testar na "fase 4" daria à ficha uma ferramenta com orçamento de 0 buscas.
        fase = ficha.get("fase_de_ativacao")
        base = dict(fase_em_curso=fase) if fase else {}
        if isinstance(servicos, list) and len(servicos) > 1:          # ficha com 2+ serviços: um caso por serviço
            for item in servicos:
                casos.append((f"{caminho.stem}-{item['servico']}", caminho, dict(papel="AUTOR", servico=item["servico"], **base)))
        else:
            casos.append((caminho.stem, caminho, dict(papel="AUTOR", **base)))
        if caminho.stem == "helena":
            casos.append(("helena-revisor", caminho, dict(papel="REVISOR", **base)))
            casos.append(("helena-le-de-volta", caminho, dict(papel="COORDENACAO", evento="LER_DE_VOLTA", **base)))
            casos.append(("helena-recomenda", caminho, dict(papel="COORDENACAO", evento="RECOMENDAR", **base)))
    return casos


# --- 1. cada serviço recebe exatamente as ferramentas da ficha -----------------------------------------------------
@pytest.mark.parametrize("nome", FICHAS_DE_TESTE)
def test_cada_servico_recebe_exatamente_as_ferramentas_da_ficha(amb, nome):
    cenarios.cenario_ferramentas_exatas(amb, amb.ficha(nome))


@pytest.mark.parametrize("nome,caminho,kw", fichas_reais(), ids=[c[0] for c in fichas_reais()])
def test_fichas_reais_da_v2_recebem_exatamente_as_ferramentas(amb, nome, caminho, kw):
    ficha = amb.ficha(str(caminho), modelos=V2 / "models.yaml", **kw)
    cenarios.cenario_ferramentas_exatas(amb, ficha)


def test_o_servico_sem_ferramenta_recebe_o_servidor_vazio_e_nenhuma_ferramenta(amb, ficha_sem_ferramenta):
    r = cenarios.cenario_ferramentas_exatas(amb, ficha_sem_ferramenta)
    assert r.ferramentas_recebidas == () and r.conferencia.ok
    assert amb.provedor.pedidos_de_chat()[0].nomes_das_ferramentas() == ()        # nada, nem as embutidas do Hermes


# --- 2. instruções só as da ficha -----------------------------------------------------------------------------------------
@pytest.mark.parametrize("nome", ["sem_ferramenta", "com_ferramentas"])
def test_instrucoes_so_as_da_ficha(amb, nome):
    cenarios.cenario_instrucoes_so_da_ficha(amb, amb.ficha(nome))


# --- 3. nenhuma senha no ambiente ------------------------------------------------------------------------------------------------
@pytest.mark.parametrize("nome", ["sem_ferramenta", "com_ferramentas"])
def test_nenhuma_senha_no_ambiente_do_agente_nem_do_servidor_de_ferramentas(amb, nome, monkeypatch):
    cenarios.cenario_sem_segredo_no_ambiente(amb, amb.ficha(nome), monkeypatch)


# --- 4. laço cortado no limite --------------------------------------------------------------------------------------------------------
@pytest.mark.parametrize("nome", ["sem_ferramenta", "com_ferramentas"])
def test_laco_de_200_chamadas_e_cortado_e_termina_como_limite_de_chamadas(amb, nome):
    cenarios.cenario_laco_cortado(amb, amb.ficha(nome))


# --- 5. tempo mata o grupo inteiro; cancelamento em até 15 s -------------------------------------------------------------------------------
@pytest.mark.parametrize("nome", ["sem_ferramenta", "com_ferramentas"])
def test_tempo_mata_o_grupo_inteiro_e_nada_sobra(amb, nome):
    cenarios.cenario_tempo_mata_o_grupo(amb, amb.ficha(nome))


@pytest.mark.parametrize("nome", ["sem_ferramenta", "com_ferramentas"])
def test_cancelamento_em_ate_15_segundos(amb, nome):
    r = cenarios.cenario_cancelamento(amb, amb.ficha(nome))
    assert r.tempo_para_encerrar_s < 5          # na prática leva poucos segundos


# --- 6. classificação da falha de cada simulação --------------------------------------------------------------------------------------------
CLASSES = [
    (Cenario(Simulacao.ERRO_429, segundos_para_voltar=1800), COTA, "HTTP_429"),
    (Cenario(Simulacao.LOGIN_RECUSADO), LOGIN, "HTTP_401"),
    (Cenario(Simulacao.ERRO_500), PROVEDOR, "HTTP_503"),
    (Cenario(Simulacao.RESPOSTA_INVALIDA), PROVEDOR, "EmptyStreamError"),
    (Cenario(Simulacao.QUEDA_NO_MEIO), QUEDA, "CORTE_NO_MEIO_DA_RESPOSTA"),
    (Cenario(Simulacao.CONTEXTO_GRANDE), GRANDE_DEMAIS, "CONTEXTO_MAIOR_QUE_O_MODELO"),
    (Cenario(Simulacao.SAIDA_CORTADA), GRANDE_DEMAIS, "SAIDA_CORTADA_NO_LIMITE"),
    (Cenario(Simulacao.RESPOSTA_VAZIA), FORMATO_ERRADO, "RESPOSTA_VAZIA"),
    (Cenario(Simulacao.ERRO_ESTRANHO), DESCONHECIDA, "HTTP_418"),
    (Cenario(Simulacao.LACO_DE_FERRAMENTA, voltas_do_laco=200, atraso_s=0.01), LIMITE_CHAMADAS, None),
]


@pytest.mark.parametrize("cenario,classe,codigo", CLASSES, ids=[c[0].simulacao.name for c in CLASSES])
def test_classificacao_da_falha_de_cada_simulacao(amb, ficha_sem_ferramenta, cenario, classe, codigo):
    r = cenarios.cenario_classe_da_falha(amb, ficha_sem_ferramenta, cenario, classe, codigo=codigo)
    assert not r.terminou_inteira and r.texto is None


def test_cota_informa_a_hora_de_volta_quando_o_provedor_informa(amb, ficha_sem_ferramenta):
    r = cenarios.cenario_classe_da_falha(amb, ficha_sem_ferramenta, Cenario(Simulacao.ERRO_429, segundos_para_voltar=1800), COTA)
    assert r.falha.voltar_em_s == 1800 and not r.falha.gasta_tentativa


def test_tempo_esgotado_e_classe_tempo_e_gasta_tentativa(amb, ficha_sem_ferramenta):
    r = cenarios.cenario_classe_da_falha(amb, ficha_sem_ferramenta, Cenario(Simulacao.LENTA, atraso_s=60), TEMPO,
                                         codigo="TEMPO_ESGOTADO", tempo_max_s=1.5)
    assert r.falha.gasta_tentativa and r.encerrado_por == "TEMPO"


def test_formato_errado_vem_do_verificador_do_motor_e_a_resposta_fica_disponivel(amb, ficha_sem_ferramenta):
    r = cenarios.cenario_classe_da_falha(amb, ficha_sem_ferramenta, Cenario(Simulacao.FORMATO_ERRADO), FORMATO_ERRADO,
                                         codigo="FORA_DO_FORMATO", verificador=verificador_de_acao)
    assert r.terminou_inteira and r.texto and not r.ok          # o motor pode mostrar a resposta torta com o motivo


def test_sem_verificador_a_resposta_torta_passa_porque_o_formato_e_do_motor(amb, ficha_sem_ferramenta):
    r = amb.rodar(ficha_sem_ferramenta, Cenario(Simulacao.FORMATO_ERRADO))
    assert r.ok and r.falha is None


def test_verificador_que_quebra_vira_desconhecida_e_nao_some(amb, ficha_sem_ferramenta):
    def quebrado(texto):
        raise RuntimeError("defeito no verificador")
    r = amb.rodar(ficha_sem_ferramenta, Cenario(Simulacao.BOA), verificador_de_formato=quebrado)
    assert r.falha.classe == DESCONHECIDA and r.falha.codigo == "VERIFICADOR_DE_FORMATO_FALHOU" and not r.ok


def test_ferramenta_ausente_o_servidor_nao_sobe_e_a_execucao_nao_conta(amb, ficha_com_ferramentas):
    """O servidor de ferramentas morre ao nascer: o Hermes segue sem ele, e a conferência recusa a execução."""
    executor = amb.executor(comando_do_servidor_de_ferramentas=(__import__("sys").executable, "-c", "raise SystemExit(3)"))
    r = amb.rodar(ficha_com_ferramentas, Cenario(Simulacao.BOA), executor=executor)
    assert r.falha is not None and r.falha.classe == FERRAMENTA, r.falha
    assert r.texto is None and not r.ok and not r.falha.gasta_tentativa
    assert amb.provedor.pedidos_de_chat()[0].nomes_das_ferramentas() == ()      # o modelo ficou sem as ferramentas da ficha


# --- 7. "agente diz cota" com provedor saudável NÃO é cota -----------------------------------------------------------------------------------
@pytest.mark.parametrize("nome", ["sem_ferramenta", "com_ferramentas"])
def test_agente_que_diz_cota_com_provedor_saudavel_nao_vira_cota(amb, nome):
    cenarios.cenario_agente_diz_cota_com_provedor_saudavel(amb, amb.ficha(nome))


def test_texto_que_parece_cota_nao_muda_uma_falha_de_outro_tipo(amb, ficha_sem_ferramenta):
    r = amb.rodar(ficha_sem_ferramenta, Cenario(Simulacao.LENTA, atraso_s=60, texto=TEXTO_DIZ_COTA), tempo_max_s=1.5)
    assert r.falha.classe == TEMPO


def test_execucao_que_nao_terminou_inteira_nunca_entrega_texto(amb, ficha_sem_ferramenta):
    cenarios.cenario_texto_so_se_terminou_inteira(amb, ficha_sem_ferramenta)


# --- 8. sem reserva, sem login adotado, sem segredo no pacote, fora de repositório -----------------------------------------------------------------
def test_provedor_principal_estoura_a_cota_e_o_segundo_servidor_recebe_zero_pedidos(amb, ficha_sem_ferramenta):
    cenarios.cenario_sem_reserva(amb, ficha_sem_ferramenta, amb.segundo_provedor(Cenario(Simulacao.BOA)))


def test_login_do_codex_do_motor_nao_e_adotado(amb, ficha_sem_ferramenta, monkeypatch, tmp_path_factory):
    cenarios.cenario_login_do_codex_nao_adotado(amb, ficha_sem_ferramenta, monkeypatch, tmp_path_factory.mktemp("home_do_motor"))


def test_pacote_com_chave_colada_nem_chega_ao_agente(amb, ficha_sem_ferramenta):
    cenarios.cenario_pacote_com_segredo_recusado(amb, ficha_sem_ferramenta)


def test_pasta_das_execucoes_dentro_de_repositorio_e_recusada(amb, ficha_sem_ferramenta, tmp_path_factory):
    cenarios.cenario_repositorio_recusado(amb, ficha_sem_ferramenta, tmp_path_factory.mktemp("repositorio"))


# --- 9. a conferência depois da execução -------------------------------------------------------------------------------------------------------------
def test_ferramentas_a_mais_que_a_ficha_sao_recusadas_depois(amb, ficha_sem_ferramenta):
    cenarios.cenario_ferramentas_diferentes_sao_recusadas(amb, ficha_sem_ferramenta)


def test_instrucoes_ou_config_alteradas_sao_recusadas_depois(amb, ficha_sem_ferramenta):
    cenarios.cenario_perfil_alterado_e_recusado(amb, ficha_sem_ferramenta)
