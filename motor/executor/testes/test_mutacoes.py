"""Testes de mutação: para cada trava, planta o defeito e prova que o cenário correspondente o percebe.

Para cada defeito:
  1. com o código bom, o cenário PASSA (a trava segura o ataque);
  2. com o defeito plantado, o MESMO cenário FALHA (o teste percebe a falta da trava).
     Se o defeito passasse sem o cenário reparar, o cenário seria inútil.
  3. quando existe a conferência de ANTES de lançar (perfil fora do gabarito não roda), prova também que ela
     recusa o defeito sozinha, antes de gastar uma chamada ao modelo.

As travas que têm duas camadas (antes de lançar e depois de rodar) são testadas camada por camada:
no passo 2 a conferência de antes de lançar é desligada, para a camada seguinte aparecer.
"""

import dataclasses
import os
import signal
import sys
from dataclasses import dataclass
from typing import Callable, Optional

import pytest
import yaml

import cenarios
from executor_helena import arvore, conferencia, decisao, executor as modulo_executor, perfil as modulo_perfil
from executor_helena.executor import ExecutorHermes, VigiaDeLimite
from executor_helena.provedor_falso import Cenario, Simulacao
from executor_helena.tipos import COTA, ErroDePerfil, Falha, Conferencia


def defendido(cenario, *args, **kw) -> bool:
    """True se o cenário passou (o ataque foi barrado); False se o defeito passou despercebido."""
    try:
        cenario(*args, **kw)
    except AssertionError:
        return False
    return True


# --- defeitos plantados no código (cada um é um monkeypatch) ---------------------------------------------------------
def mexer_na_config(mp, mexer):
    original = modulo_perfil.montar_config

    def estragada(*a, **kw):
        config = original(*a, **kw)
        mexer(config)
        return config
    mp.setattr(modulo_perfil, "montar_config", estragada)


def servidor_com_ferramenta_a_mais(config):
    servidor = config["mcp_servers"]["ferramentas_helena"]
    servidor["args"] = [a for a in servidor["args"] if a != "--servidor-vazio"] + [
        "--ferramentas", "buscar", "--max-buscas", "1", "--qualquer-endereco-publico"]


def defeito_ferramenta_a_mais(mp, ctx):
    mexer_na_config(mp, servidor_com_ferramenta_a_mais)


def defeito_lista_vazia_libera_tudo(mp, ctx):
    """Config com a lista de ferramentas do Hermes padrão E linha de comando sem --toolsets."""
    mexer_na_config(mp, lambda config: config.__setitem__("toolsets", ["hermes-cli"]))
    original = modulo_executor.montar_comando

    def sem_toolsets(cfg, perfil, pacote):
        comando = list(original(cfg, perfil, pacote))
        i = comando.index("--toolsets")
        del comando[i:i + 2]
        return tuple(comando)
    mp.setattr(modulo_executor, "montar_comando", sem_toolsets)


def defeito_memoria_ligada(mp, ctx):
    mexer_na_config(mp, lambda config: config["memory"].__setitem__("memory_enabled", True))


def defeito_curadoria_e_titulo_ligados(mp, ctx):
    def ligar(config):
        config["curator"]["enabled"] = True
        config["auxiliary"]["title_generation"]["enabled"] = True
    mexer_na_config(mp, ligar)


def defeito_reserva_escondida(mp, ctx):
    segundo = ctx["segundo"]
    mexer_na_config(mp, lambda config: config.__setitem__("fallback_providers", [
        {"provider": "custom", "model": "gpt-reserva", "base_url": segundo.endereco}]))


def defeito_trabalho_na_pasta_da_execucao(mp, ctx):
    """O agente trabalha na pasta da execução (que não é vazia nem nossa) e não na pasta vazia."""
    original = modulo_executor.gerar_perfil

    def gerar_trocado(*a, **kw):
        perfil = original(*a, **kw)
        return dataclasses.replace(perfil, trabalho=perfil.pasta)
    mp.setattr(modulo_executor, "gerar_perfil", gerar_trocado)


def defeito_ambiente_herdado_do_motor(mp, ctx):
    original = modulo_perfil.construir_ambiente
    mp.setattr(modulo_perfil, "construir_ambiente", lambda **kw: {**os.environ, **original(**kw)})


def defeito_home_e_login_do_codex_herdados(mp, ctx):
    original = modulo_perfil.construir_ambiente

    def herdado(**kw):
        ambiente = original(**kw)
        ambiente["HOME"] = os.environ["HOME"]
        ambiente["CODEX_HOME"] = os.environ["CODEX_HOME"]
        return ambiente
    mp.setattr(modulo_perfil, "construir_ambiente", herdado)


def defeito_repositorio_liberado(mp, ctx):
    mp.setattr(modulo_perfil, "_repositorio_acima", lambda pasta: None)


def defeito_mata_so_o_processo_principal(mp, ctx):
    def so_o_principal(*, raiz_pid, **kw):
        os.kill(raiz_pid, signal.SIGKILL)
        return ()                                  # e ainda afirma que não sobrou nada
    mp.setattr(arvore, "encerrar_tudo", so_o_principal)


def defeito_cancelamento_ignorado(mp, ctx):
    mp.setattr(ExecutorHermes, "cancelar", lambda self, id_da_execucao: True)


def defeito_sem_vigia_de_limite(mp, ctx):
    mp.setattr(VigiaDeLimite, "__call__", lambda self: None)


def defeito_tempo_ignorado(mp, ctx):
    from executor_helena.tipos import Execucao
    mp.setattr(Execucao, "tempo_efetivo_s", property(lambda self: 10 ** 6))


def defeito_classifica_pelo_texto(mp, ctx):
    original = modulo_executor.decidir

    def ingenuo(execucao, ev, conferido, texto_impresso):
        if texto_impresso and ("429" in texto_impresso or "cota" in texto_impresso.lower()):
            return decisao.Decisao(False, Falha(COTA, "TEXTO_DIZ_COTA"), None, False)
        return original(execucao, ev, conferido, texto_impresso)
    mp.setattr(modulo_executor, "decidir", ingenuo)


def defeito_texto_incompleto_vira_resposta(mp, ctx):
    mp.setattr(decisao, "terminou_inteira", lambda ev: ev.codigo_de_saida == 0)


def defeito_conferencia_desligada(mp, ctx):
    mp.setattr(conferencia, "conferir_depois", lambda perfil, ev, sobras: Conferencia())


def defeito_perfil_alterado_nao_percebido(mp, ctx):
    mp.setattr(conferencia, "_perfil_igual_ao_gerado", lambda perfil: [])
    mp.setattr(conferencia, "_instrucoes", lambda perfil, ev: [])


def defeito_pacote_com_segredo_aceito(mp, ctx):
    mp.setattr(modulo_perfil, "segredos_no_texto", lambda texto: [])


def sem_a_conferencia_de_antes_de_lancar(mp):
    mp.setattr(conferencia, "antes_de_lancar", lambda perfil: [])


@dataclass
class Caso:
    nome: str
    defeito: Callable
    cenario: Callable                       # (amb, mp, tmp_path_factory, ctx) -> None
    ficha: str = "sem_ferramenta"
    antes_de_lancar: Optional[str] = None   # código que a conferência de ANTES de lançar dá ao defeito (None = ela não vê)
    precisa_segundo_provedor: bool = False


def _exatas(amb, mp, fabrica, ctx):
    cenarios.cenario_ferramentas_exatas(amb, amb.ficha(ctx["ficha"]))


CASOS = [
    Caso("ferramenta_a_mais_no_servidor", defeito_ferramenta_a_mais, _exatas, antes_de_lancar="SERVIDOR_NAO_ESTA_VAZIO"),
    Caso("lista_vazia_libera_tudo_no_hermes", defeito_lista_vazia_libera_tudo, _exatas, antes_de_lancar="LISTA_DE_FERRAMENTAS_DIFERENTE"),
    Caso("memoria_ligada", defeito_memoria_ligada, _exatas, antes_de_lancar="MEMORIA_LIGADA"),
    Caso("curadoria_e_titulo_ligados", defeito_curadoria_e_titulo_ligados, _exatas, antes_de_lancar="CURADORIA_LIGADA"),
    Caso("reserva_escondida", defeito_reserva_escondida,
         lambda amb, mp, fabrica, ctx: cenarios.cenario_sem_reserva(amb, amb.ficha(ctx["ficha"]), ctx["segundo"]),
         antes_de_lancar="RESERVA_CONFIGURADA", precisa_segundo_provedor=True),
    Caso("agente_trabalha_na_pasta_da_execucao", defeito_trabalho_na_pasta_da_execucao,
         lambda amb, mp, fabrica, ctx: cenarios.cenario_instrucoes_so_da_ficha(amb, amb.ficha(ctx["ficha"]))),
    Caso("ambiente_herdado_do_motor", defeito_ambiente_herdado_do_motor,
         lambda amb, mp, fabrica, ctx: cenarios.cenario_sem_segredo_no_ambiente(amb, amb.ficha(ctx["ficha"]), mp)),
    Caso("home_e_login_do_codex_herdados", defeito_home_e_login_do_codex_herdados,
         lambda amb, mp, fabrica, ctx: cenarios.cenario_login_do_codex_nao_adotado(
             amb, amb.ficha(ctx["ficha"]), mp, fabrica.mktemp("home_do_motor"))),
    Caso("pasta_dentro_de_repositorio_liberada", defeito_repositorio_liberado,
         lambda amb, mp, fabrica, ctx: cenarios.cenario_repositorio_recusado(amb, amb.ficha(ctx["ficha"]), fabrica.mktemp("repo"))),
    Caso("tempo_mata_so_o_processo_principal", defeito_mata_so_o_processo_principal,
         lambda amb, mp, fabrica, ctx: cenarios.cenario_tempo_mata_o_grupo(amb, amb.ficha(ctx["ficha"]), tempo_max_s=1.5)),
    Caso("tempo_maximo_ignorado", defeito_tempo_ignorado,
         lambda amb, mp, fabrica, ctx: cenarios.cenario_tempo_mata_o_grupo(amb, amb.ficha(ctx["ficha"]), tempo_max_s=1.5, espera_max_s=6)),
    Caso("cancelamento_ignorado", defeito_cancelamento_ignorado,
         lambda amb, mp, fabrica, ctx: cenarios.cenario_cancelamento(amb, amb.ficha(ctx["ficha"]), limite_s=5, tempo_max_s=9, espera_max_s=20)),
    Caso("laco_sem_vigia_de_limite", defeito_sem_vigia_de_limite,
         lambda amb, mp, fabrica, ctx: cenarios.cenario_laco_cortado(amb, amb.ficha(ctx["ficha"])), ficha="com_ferramentas"),
    Caso("classifica_pelo_texto_do_agente", defeito_classifica_pelo_texto,
         lambda amb, mp, fabrica, ctx: cenarios.cenario_agente_diz_cota_com_provedor_saudavel(amb, amb.ficha(ctx["ficha"]))),
    Caso("texto_de_execucao_incompleta_vira_resposta", defeito_texto_incompleto_vira_resposta,
         lambda amb, mp, fabrica, ctx: cenarios.cenario_texto_so_se_terminou_inteira(amb, amb.ficha(ctx["ficha"]))),
    Caso("conferencia_depois_desligada_ferramentas", defeito_conferencia_desligada,
         lambda amb, mp, fabrica, ctx: cenarios.cenario_ferramentas_diferentes_sao_recusadas(amb, amb.ficha(ctx["ficha"]))),
    Caso("conferencia_depois_desligada_perfil", defeito_conferencia_desligada,
         lambda amb, mp, fabrica, ctx: cenarios.cenario_perfil_alterado_e_recusado(amb, amb.ficha(ctx["ficha"]))),
    Caso("perfil_alterado_nao_percebido", defeito_perfil_alterado_nao_percebido,
         lambda amb, mp, fabrica, ctx: cenarios.cenario_perfil_alterado_e_recusado(amb, amb.ficha(ctx["ficha"]))),
    Caso("pacote_com_segredo_aceito", defeito_pacote_com_segredo_aceito,
         lambda amb, mp, fabrica, ctx: cenarios.cenario_pacote_com_segredo_recusado(amb, amb.ficha(ctx["ficha"]))),
]
IDS = [c.nome for c in CASOS]


def preparar_contexto(amb, caso):
    contexto = {"ficha": caso.ficha}
    if caso.precisa_segundo_provedor:
        contexto["segundo"] = amb.segundo_provedor(Cenario(Simulacao.BOA))
    return contexto


@pytest.mark.parametrize("caso", CASOS, ids=IDS)
def test_o_cenario_passa_com_o_codigo_bom_e_falha_com_o_defeito_plantado(caso, amb, monkeypatch, tmp_path_factory):
    contexto = preparar_contexto(amb, caso)
    assert defendido(caso.cenario, amb, monkeypatch, tmp_path_factory, contexto), \
        f"{caso.nome}: o cenário já falha com o código bom"
    caso.defeito(monkeypatch, contexto)
    sem_a_conferencia_de_antes_de_lancar(monkeypatch)        # para a camada de depois aparecer
    assert not defendido(caso.cenario, amb, monkeypatch, tmp_path_factory, contexto), \
        f"{caso.nome}: o defeito foi plantado e o cenário não percebeu"


@pytest.mark.parametrize("caso", [c for c in CASOS if c.antes_de_lancar], ids=[c.nome for c in CASOS if c.antes_de_lancar])
def test_a_conferencia_de_antes_de_lancar_recusa_o_defeito_sozinha(caso, amb, monkeypatch):
    contexto = preparar_contexto(amb, caso)
    caso.defeito(monkeypatch, contexto)
    ficha = amb.ficha(caso.ficha)
    with pytest.raises(ErroDePerfil, match=caso.antes_de_lancar):
        amb.executor().preparar(amb.execucao(ficha))
    assert amb.provedor.pedidos_de_chat() == [], "o agente nem devia ter sido lançado"


def test_sem_defeito_a_conferencia_de_antes_de_lancar_deixa_passar(amb):
    perfil = amb.executor().preparar(amb.execucao(amb.ficha("sem_ferramenta")))
    assert perfil.hermes_home.is_dir()


def test_o_defeito_do_pacote_so_e_barrado_pela_trava_do_pacote(amb, monkeypatch):
    """Sem a trava, a chave colada chega inteira ao modelo: é isso que o cenário procura."""
    defeito_pacote_com_segredo_aceito(monkeypatch, {})
    amb.rodar(amb.ficha("sem_ferramenta"), Cenario(Simulacao.BOA), pacote=f"chave {cenarios.SEGREDOS_ISCA['OPENAI_API_KEY']}")
    assert cenarios.SEGREDOS_ISCA["OPENAI_API_KEY"] in amb.provedor.pedidos_de_chat()[0].texto_do_usuario()
