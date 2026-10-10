"""Cenários do "teste 3" do plano (Hermes travado), contra o servidor falso de provedor.

Cada cenário é uma função `cenario_x(amb, ...)` que RODA a execução e confere com `assert`:
  - passou: volta sem erro;
  - o defeito que o cenário procura aconteceu: levanta AssertionError.

Dois usos, sem copiar código:
  - testes/test_teste3.py: roda os cenários com o Hermes de mentira (suíte normal);
  - verificacao_real/: roda OS MESMOS cenários com o hermes-agent de verdade;
  - testes/test_mutacoes.py: planta um defeito de cada vez e prova que o cenário correspondente falha.
"""

import json
import time
from pathlib import Path

import yaml

from apoio.ambiente_de_teste import ambiente_do_processo, processos_com_marca
from executor_helena.provedor_falso import Cenario, Simulacao
from executor_helena.segredos import segredos_no_ambiente
from executor_helena.tipos import (COTA, ErroDePerfil, FORMATO_ERRADO, LIMITE_CHAMADAS, TEMPO)

CANARIO_ESCONDIDO = "CANARIO_INSTRUCAO_ESCONDIDA_NAO_PODE_APARECER"
PREFIXO_DAS_FERRAMENTAS = "mcp__ferramentas_helena__"      # como o Hermes 0.19.0 mostra as ferramentas ao modelo
TEXTO_DIZ_COTA = ("API call failed after 1 retries: HTTP 429: You have hit your usage limit. Estou sem cota, "
                  "rate limit exceeded, quota exceeded, usage_limit_reached. Faça login de novo: HTTP 401 token_expired. "
                  "A conexão caiu (queda) e o servidor está fora do ar.")
SEGREDOS_ISCA = {
    "OPENAI_API_KEY": "sk-EXEMPLO_NAO_REAL_0123456789abcdef",
    "ANTHROPIC_API_KEY": "sk-ant-EXEMPLO_NAO_REAL_0123456789abcdef",
    "GITHUB_TOKEN": "ghp_EXEMPLO_NAO_REAL_0123456789abcdef",
    "SUPABASE_SERVICE_ROLE_KEY": "eyJEXEMPLO.NAO_REAL_0123456789.abcdefghij",
    "TYPESAFE_API_KEY": "EXEMPLO_NAO_REAL_typesafe_000000",
    "DATABASE_URL": "postgresql://usuario:EXEMPLO_NAO_REAL@127.0.0.1:5432/banco",
}
ACOES = ("ENTREGAR", "PERGUNTAR", "DEVOLVER_A_QUEM_PEDIU", "REGISTRAR_FALHA")


def verificador_de_acao(texto):
    """Verificador de formato SÓ DE TESTE: um JSON com um campo `acao` conhecido. O de verdade é o do validador."""
    try:
        dados = json.loads(texto)
    except ValueError:
        return "FORA_DO_FORMATO"
    if not isinstance(dados, dict) or dados.get("acao") not in ACOES:
        return "SEM_ACAO"
    return None


def nomes_esperados(ficha):
    return {PREFIXO_DAS_FERRAMENTAS + nome for nome in ficha.ferramentas}


# --- ferramentas e instruções -------------------------------------------------------------------------
def cenario_ferramentas_exatas(amb, ficha):
    """Cada serviço recebe EXATAMENTE as ferramentas da ficha, inclusive o que não tem nenhuma."""
    r = amb.rodar(ficha, Cenario(Simulacao.BOA))
    pedidos = amb.provedor.pedidos_de_chat()
    assert pedidos, "o agente não chamou o modelo"
    for pedido in pedidos:
        assert set(pedido.nomes_das_ferramentas()) == nomes_esperados(ficha), \
            f"o modelo recebeu {pedido.nomes_das_ferramentas()}, a ficha manda {sorted(ficha.ferramentas)}"
        assert len(pedido.nomes_das_ferramentas()) == len(ficha.ferramentas)
    assert r.ferramentas_recebidas == tuple(sorted(ficha.ferramentas)), r.ferramentas_recebidas
    assert r.ok, (r.falha, r.conferencia.problemas)
    return r


def cenario_instrucoes_so_da_ficha(amb, ficha):
    """O prompt de sistema traz o SOUL.md gerado da ficha e mais nada: nenhum arquivo de instruções escondido entra."""
    def plantar(perfil):
        locais = [perfil.pasta, perfil.pasta.parent, perfil.hermes_home.parent.parent]
        for pasta in locais:
            for nome in ("AGENTS.md", "CLAUDE.md", ".cursorrules", ".hermes.md", "HERMES.md"):
                (pasta / nome).write_text(CANARIO_ESCONDIDO, encoding="utf-8")

    r = amb.rodar(ficha, Cenario(Simulacao.BOA), plantar=plantar, pacote="PEDIDO_UNICO_DE_TESTE")
    pedidos = amb.provedor.pedidos_de_chat()
    assert pedidos
    for pedido in pedidos:
        sistema = pedido.texto_do_sistema()
        assert CANARIO_ESCONDIDO not in sistema, "um arquivo de instruções escondido chegou ao agente"
        assert "# Project Context" not in sistema, "o Hermes carregou contexto de projeto"
        assert ficha.missao in sistema
        assert all(regra in sistema for regra in ficha.regras)
        assert all(proibido in sistema for proibido in ficha.nunca)
        assert pedido.texto_do_usuario() == "PEDIDO_UNICO_DE_TESTE", "o pedido ao agente foi alterado"
    assert r.ok, (r.falha, r.conferencia.problemas)
    return r


# --- ambiente sem segredo, login e reserva --------------------------------------------------------------
def cenario_sem_segredo_no_ambiente(amb, ficha, monkeypatch):
    """Com senhas e chaves no ambiente do MOTOR, o ambiente REAL do agente (lido do /proc) não tem nenhuma."""
    for nome, valor in SEGREDOS_ISCA.items():
        monkeypatch.setenv(nome, valor)
    andamento = amb.rodar_em_segundo_plano(ficha, Cenario(Simulacao.LENTA, atraso_s=60), tempo_max_s=60)
    try:
        andamento.esperar_o_agente_estar_de_pe()
        pids = andamento.pids()
        assert pids, "nenhum processo com a marca da execução"
        for pid in pids:
            ambiente = ambiente_do_processo(pid)
            for nome, valor in SEGREDOS_ISCA.items():
                assert nome not in ambiente, f"o processo {pid} enxerga a variável {nome}"
                assert not any(valor in v for v in ambiente.values()), f"o processo {pid} enxerga o valor de {nome}"
            assert segredos_no_ambiente(ambiente) == [], f"processo {pid}: {segredos_no_ambiente(ambiente)}"
    finally:
        andamento.cancelar()
        resultado = andamento.resultado()
    assert resultado.cancelada
    return resultado


def cenario_login_do_codex_nao_adotado(amb, ficha, monkeypatch, pasta_do_motor):
    """Com um login do Codex no HOME do motor, o agente não o adota: a recusa de login fica recusa."""
    codex = Path(pasta_do_motor) / ".codex"
    codex.mkdir(parents=True)
    (codex / "auth.json").write_text(json.dumps({"tokens": {"access_token": "EXEMPLO_NAO_REAL_acesso",
                                                             "refresh_token": "EXEMPLO_NAO_REAL_renovacao"}}))
    monkeypatch.setenv("HOME", str(pasta_do_motor))
    monkeypatch.setenv("CODEX_HOME", str(codex))
    r = amb.rodar(ficha, Cenario(Simulacao.LOGIN_RECUSADO))
    assert r.falha is not None and r.falha.classe == "LOGIN", (r.falha, [p.codigo for p in r.conferencia.problemas])
    assert len(amb.provedor.pedidos_de_chat()) == 1, "o agente tentou de novo com um login adotado"
    guardados = [str(p) for p in amb.base.rglob("auth.json")]
    assert not guardados, f"apareceu credencial na pasta da tarefa: {guardados}"
    return r


def cenario_sem_reserva(amb, ficha, segundo):
    """O provedor principal estoura a cota e há um segundo servidor ao alcance: ele recebe ZERO pedidos."""
    r = amb.rodar(ficha, Cenario(Simulacao.ERRO_429, segundos_para_voltar=3600))
    assert r.falha is not None and r.falha.classe == COTA, (r.falha, [p.codigo for p in r.conferencia.problemas])
    assert segundo.pedidos_de_chat() == [], "o agente foi para um provedor reserva escondido"
    assert len(amb.provedor.pedidos_de_chat()) == 1
    return r


def cenario_pacote_com_segredo_recusado(amb, ficha):
    pacote = f"Use esta chave para entrar: {SEGREDOS_ISCA['OPENAI_API_KEY']}"
    try:
        amb.rodar(ficha, Cenario(Simulacao.BOA), pacote=pacote)
    except ErroDePerfil:
        assert amb.provedor.pedidos_de_chat() == []
        return
    raise AssertionError("um pacote com chave colada foi enviado ao agente")


def cenario_repositorio_recusado(amb, ficha, pasta_do_repositorio):
    """A pasta das execuções dentro de um repositório é recusada (o .hermes.md dele entraria no prompt)."""
    repositorio = Path(pasta_do_repositorio)
    (repositorio / ".git").mkdir(parents=True)
    (repositorio / ".hermes.md").write_text(CANARIO_ESCONDIDO)
    executor = amb.executor(pasta_das_execucoes=repositorio / "execucoes")
    try:
        amb.rodar(ficha, Cenario(Simulacao.BOA), executor=executor)
    except ErroDePerfil:
        return
    chegou = any(CANARIO_ESCONDIDO in p.texto_do_sistema() for p in amb.provedor.pedidos_de_chat())
    raise AssertionError("pasta dentro de repositório não foi recusada" + (" e o contexto dele chegou ao agente" if chegou else ""))


# --- limites: laço, tempo, cancelamento --------------------------------------------------------------------
def cenario_laco_cortado(amb, ficha):
    """O agente tenta chamar ferramenta 200 vezes seguidas: é cortado no limite e termina como limite de chamadas."""
    ferramenta = PREFIXO_DAS_FERRAMENTAS + "buscar" if "buscar" in ficha.ferramentas else "ferramenta_inexistente"
    cenario = Cenario(Simulacao.LACO_DE_FERRAMENTA, voltas_do_laco=200, ferramenta=ferramenta,
                      argumentos='{"consulta": "pedido {n}"}', atraso_s=0.02)
    r = amb.rodar(ficha, cenario)
    pedidos = len(amb.provedor.pedidos_de_chat())
    teto = ficha.orcamento.chamadas_total + 1 + 3 + 4         # limite + 1ª recusa + 3 insistências + folga
    assert r.falha is not None and r.falha.classe == LIMITE_CHAMADAS, (r.falha, pedidos)
    assert not r.terminou_inteira and r.texto is None
    assert 1 <= pedidos <= teto, f"{pedidos} pedidos ao modelo; o teto era {teto} (e o laço tinha 200 voltas)"
    return r


def cenario_tempo_mata_o_grupo(amb, ficha, tempo_max_s=2.0, limite_s=15.0):
    """Passou o tempo máximo: o grupo inteiro (com os filhos teimosos) morre em até 15 s e nada sobra."""
    pacote = "Faça o trabalho. [[FILHO_TEIMOSO]]"
    andamento = amb.rodar_em_segundo_plano(ficha, Cenario(Simulacao.LENTA, atraso_s=120), tempo_max_s=tempo_max_s, pacote=pacote)
    andamento.esperar_o_agente_estar_de_pe()
    if not amb.real:
        assert len(andamento.pids()) >= 3, "o filho teimoso não nasceu: o teste não prova nada"
    r = andamento.resultado()
    assert r.falha is not None and r.falha.classe == TEMPO, r.falha
    assert r.encerrado_por == "TEMPO" and r.texto is None and not r.terminou_inteira
    assert r.tempo_para_encerrar_s is not None and r.tempo_para_encerrar_s <= limite_s, r.tempo_para_encerrar_s
    assert r.tempo_s <= tempo_max_s + limite_s
    sobraram = processos_com_marca(andamento.execucao.id)
    assert r.sobras == () and sobraram == [], f"sobraram processos: {sobraram}"
    return r


def cenario_cancelamento(amb, ficha, limite_s=15.0, tempo_max_s=120.0):
    """Cancelar de fora encerra o processo inteiro em até 15 s, sem falha e sem texto."""
    pacote = "Faça o trabalho. [[FILHO_TEIMOSO]]"
    andamento = amb.rodar_em_segundo_plano(ficha, Cenario(Simulacao.LENTA, atraso_s=120), tempo_max_s=tempo_max_s, pacote=pacote)
    andamento.esperar_o_agente_estar_de_pe()
    pedido_em = time.monotonic()
    assert andamento.cancelar() is True
    r = andamento.resultado()
    decorrido = time.monotonic() - pedido_em
    assert r.cancelada and r.falha is None and r.texto is None and not r.terminou_inteira, (r.cancelada, r.falha)
    assert decorrido <= limite_s, f"o cancelamento levou {decorrido:.1f} s (limite {limite_s} s)"
    sobraram = processos_com_marca(andamento.execucao.id)
    assert r.sobras == () and sobraram == [], f"sobraram processos: {sobraram}"
    assert andamento.executor.cancelar(andamento.execucao.id) is False, "a execução já tinha acabado"
    return r


# --- classificação da falha ---------------------------------------------------------------------------------
def cenario_classe_da_falha(amb, ficha, cenario, classe, *, codigo=None, tempo_max_s=60.0, verificador=None):
    """Uma simulação do provedor termina com a classe de falha esperada, lida do registro."""
    r = amb.rodar(ficha, cenario, tempo_max_s=tempo_max_s, verificador_de_formato=verificador)
    assert r.falha is not None, f"nenhuma falha; esperava {classe}"
    assert r.falha.classe == classe, f"classe {r.falha.classe}/{r.falha.codigo}; esperava {classe}"
    if codigo is not None:
        assert r.falha.codigo == codigo, f"código {r.falha.codigo}; esperava {codigo}"
    return r


def cenario_agente_diz_cota_com_provedor_saudavel(amb, ficha):
    """O agente ESCREVE que está sem cota, mas o provedor está saudável: a execução NÃO é falha de cota."""
    r = amb.rodar(ficha, Cenario(Simulacao.BOA, texto=TEXTO_DIZ_COTA))
    assert r.falha is None, f"classificou pelo texto do agente: {r.falha}"
    assert r.terminou_inteira and r.texto == TEXTO_DIZ_COTA and r.ok
    # E se a resposta ainda falhar no formato, a classe é de formato, nunca de cota.
    r2 = amb.rodar(ficha, Cenario(Simulacao.BOA, texto=TEXTO_DIZ_COTA), verificador_de_formato=verificador_de_acao)
    assert r2.falha is not None and r2.falha.classe == FORMATO_ERRADO, r2.falha
    return r


def cenario_texto_so_se_terminou_inteira(amb, ficha):
    """Execução que não terminou inteira: o Hermes imprime uma frase dele (código 0!) e o executor NÃO a trata como resposta."""
    casos = [Cenario(Simulacao.ERRO_429), Cenario(Simulacao.LOGIN_RECUSADO), Cenario(Simulacao.ERRO_500),
             Cenario(Simulacao.RESPOSTA_VAZIA), Cenario(Simulacao.SAIDA_CORTADA), Cenario(Simulacao.CONTEXTO_GRANDE),
             Cenario(Simulacao.LACO_DE_FERRAMENTA, voltas_do_laco=200, atraso_s=0.01)]
    for cenario in casos:
        r = amb.rodar(ficha, cenario)
        impresso = (r.pasta / "saida.txt").read_text(encoding="utf-8").strip() if r.pasta else ""
        assert not r.terminou_inteira, f"{cenario.simulacao.name}: tratada como inteira"
        assert r.texto is None, f"{cenario.simulacao.name}: o texto virou resposta ({r.texto!r})"
        assert r.falha is not None, cenario.simulacao.name
        if cenario.simulacao in (Simulacao.ERRO_429, Simulacao.LOGIN_RECUSADO, Simulacao.ERRO_500, Simulacao.RESPOSTA_VAZIA):
            assert impresso, f"{cenario.simulacao.name}: o teste não exercita o caso (o Hermes não imprimiu frase nenhuma)"


# --- o que a conferência pega depois ----------------------------------------------------------------------------
def cenario_ferramentas_diferentes_sao_recusadas(amb, ficha):
    """Se o servidor entregar ferramentas que a ficha não manda, a execução não conta (e o texto não é entregue)."""
    def plantar(perfil):
        caminho = perfil.hermes_home / "config.yaml"
        config = yaml.safe_load(caminho.read_text(encoding="utf-8"))
        servidor = config["mcp_servers"]["ferramentas_helena"]
        servidor["args"] = [a for a in servidor["args"] if a != "--servidor-vazio"] + [
            "--ferramentas", "buscar", "--max-buscas", "1", "--qualquer-endereco-publico"]
        caminho.write_text(yaml.safe_dump(config), encoding="utf-8")

    r = amb.rodar(ficha, Cenario(Simulacao.BOA), plantar=plantar)
    assert not r.ok and r.texto is None, "ferramenta a mais passou na conferência"
    assert r.falha is not None and r.falha.classe in ("FERRAMENTA", "DESCONHECIDA"), r.falha
    return r


def cenario_perfil_alterado_e_recusado(amb, ficha):
    """Se alguém mexer no config.yaml ou no SOUL.md durante a execução, a conferência pega."""
    def plantar(perfil):
        # simula um processo que reescreve o SOUL.md depois da conferência de antes de lançar
        (perfil.hermes_home / "SOUL.md").write_text("INSTRUÇÕES TROCADAS\n", encoding="utf-8")

    r = amb.rodar(ficha, Cenario(Simulacao.BOA), plantar=plantar)
    assert not r.ok, "o SOUL.md foi trocado e a conferência não percebeu"
    assert r.falha is not None and r.falha.classe == "DESCONHECIDA", r.falha
    assert any(p.codigo in ("PERFIL_ALTERADO", "INSTRUCOES_NAO_SAO_AS_DA_FICHA") for p in r.conferencia.problemas)
    return r
