"""Cliente HTTP seguro, contra servidores falsos locais.

Cada caso de recusa confere DUAS coisas: o erro certo e que o conector (a conexão de
rede) NÃO foi chamado para o destino proibido.
"""

import time

import pytest

import falsos
from falsos import IP_A, IP_B, ConectorFalso, DnsFalso, PaginasFalsas, Sequencia
from ferramentas_helena.enderecos import analisar_url, ip_e_publico
from ferramentas_helena.erros import ErroFerramenta
from ferramentas_helena.rede import ClienteHttp


def baixar(mundo, url, **mudancas):
    return mundo.cliente(**mudancas).baixar(analisar_url(url))


def recusado(mundo, url, **mudancas):
    with pytest.raises(ErroFerramenta) as erro:
        baixar(mundo, url, **mudancas)
    return erro.value


# --- caminho feliz -----------------------------------------------------------------------
def test_baixa_pagina_simples_conectando_no_ip_conferido(mundo):
    mundo.paginas.rotas["/p"] = falsos.pagina("<p>olá</p>")
    pagina = baixar(mundo, "http://site.exemplo/p?token=SEGREDO_NAO_REAL#x")
    assert pagina.status == 200 and pagina.corpo == b"<p>ol\xc3\xa1</p>"
    assert pagina.tipo == "text/html" and pagina.charset == "utf-8"
    assert mundo.dns.consultas == ["site.exemplo"]                   # resolveu uma vez
    assert mundo.conector.conexoes == [(IP_A, 80)]                    # e conectou no IP conferido
    assert mundo.paginas.requisicoes == [("site.exemplo", "/p")]     # Host certo; consulta não foi enviada


def test_resposta_em_pedacos_e_sem_content_length(mundo):
    mundo.paginas.rotas["/c"] = falsos.em_pedacos(["<p>um ", "dois ", "três</p>"])
    mundo.paginas.rotas["/f"] = falsos.ate_fechar("<p>até fechar</p>")
    assert baixar(mundo, "http://site.exemplo/c").corpo.decode() == "<p>um dois três</p>"
    assert baixar(mundo, "http://site.exemplo/f").corpo.decode() == "<p>até fechar</p>"


def test_gzip_normal_e_descomprimido(mundo):
    mundo.paginas.rotas["/g"] = falsos.gzip_de("<p>comprimido</p>")
    assert baixar(mundo, "http://site.exemplo/g").corpo == b"<p>comprimido</p>"


# --- DNS devolve endereço interno ---------------------------------------------------------
RESOLVEM_PARA_INTERNO = [
    ["127.0.0.1"], ["127.1.2.3"], ["10.0.0.5"], ["172.16.9.9"], ["192.168.0.10"],
    ["169.254.169.254"], ["100.100.100.200"], ["0.0.0.0"],
    ["::1"], ["fd00:ec2::254"], ["fe80::1"], ["::ffff:127.0.0.1"], ["64:ff9b::7f00:1"],
    [IP_A, "10.0.0.5"],              # uma resposta pública e outra interna: recusa tudo
    ["10.0.0.5", IP_A],
]


@pytest.mark.parametrize("ips", RESOLVEM_PARA_INTERNO, ids=[",".join(i) for i in RESOLVEM_PARA_INTERNO])
def test_nome_que_resolve_para_interno_e_recusado_sem_conectar(mundo, ips):
    mundo.dns.tabela["armadilha.exemplo"] = ips
    erro = recusado(mundo, "http://armadilha.exemplo/")
    assert erro.codigo == "bloqueado_endereco_interno"
    assert mundo.conector.conexoes == []


def test_nome_cloud_metadata_que_resolve_para_169_254(mundo):
    mundo.dns.tabela["metadados.exemplo"] = ["169.254.169.254"]
    assert recusado(mundo, "http://metadados.exemplo/latest/meta-data/").codigo == "bloqueado_endereco_interno"
    assert mundo.conector.conexoes == []


def test_dns_sem_resposta_ou_nome_inexistente(mundo):
    mundo.dns.tabela["vazio.exemplo"] = []
    assert recusado(mundo, "http://vazio.exemplo/").codigo == "dns_falhou"
    assert recusado(mundo, "http://nao-existe.exemplo/").codigo == "dns_falhou"
    assert mundo.conector.conexoes == []


# --- anti-rebinding ------------------------------------------------------------------------
def test_ataque_de_rebinding_e_real_contra_quem_resolve_duas_vezes():
    """Documenta o ataque: validar o nome e conectar pelo nome vê dois IPs diferentes."""
    dns = DnsFalso({"rebind.exemplo": Sequencia([IP_A], ["127.0.0.1"])})
    na_validacao = dns("rebind.exemplo", 80)
    na_conexao = dns("rebind.exemplo", 80)
    assert all(ip_e_publico(ip) for ip in na_validacao) and na_conexao == ["127.0.0.1"]


@pytest.mark.parametrize("segunda_resposta", [["127.0.0.1"], ["169.254.169.254"], ["10.0.0.1"], ["::1"]])
def test_rebinding_nao_pega_o_nosso_cliente(mundo, segunda_resposta):
    mundo.dns.tabela["rebind.exemplo"] = Sequencia([IP_A], segunda_resposta)
    mundo.paginas.rotas["/"] = falsos.pagina("<p>pública</p>")
    pagina = baixar(mundo, "http://rebind.exemplo/")
    assert pagina.corpo == b"<p>p\xc3\xbablica</p>"
    assert mundo.dns.consultas.count("rebind.exemplo") == 1          # nunca resolveu de novo
    assert mundo.conector.conexoes == [(IP_A, 80)]                    # só o IP que foi conferido


def test_rebinding_em_redirecionamento_tambem_e_conferido(mundo):
    # o redirecionamento aponta para outro nome (permitido nesta política), que muda de IP
    mundo.dns.tabela["salto.exemplo"] = Sequencia(["10.0.0.9"], [IP_A])
    mundo.paginas.rotas["/a"] = falsos.redirecionar("http://salto.exemplo/b")
    erro = recusado(mundo, "http://site.exemplo/a", redirecionar_para_outro_dominio=True)
    assert erro.codigo == "bloqueado_endereco_interno"
    assert mundo.conector.conexoes == [(IP_A, 80)]                    # só o primeiro salto conectou


# --- redirecionamentos ---------------------------------------------------------------------
def test_redirecionamentos_no_mesmo_site_sao_seguidos_e_cada_um_e_resolvido(mundo):
    mundo.paginas.rotas["/a"] = falsos.redirecionar("/b", 301)
    mundo.paginas.rotas["/b"] = falsos.redirecionar("http://www.site.exemplo/c", 307)
    mundo.paginas.rotas["/c"] = falsos.pagina("<p>fim</p>")
    pagina = baixar(mundo, "http://site.exemplo/a")
    assert pagina.corpo == b"<p>fim</p>"
    assert pagina.saltos == ("http://site.exemplo/a", "http://site.exemplo/b", "http://www.site.exemplo/c")
    assert mundo.dns.consultas == ["site.exemplo", "site.exemplo", "www.site.exemplo"]
    assert len(mundo.conector.conexoes) == 3


def test_exatamente_tres_redirecionamentos_passam_e_o_quarto_nao(mundo):
    for i in range(4):
        mundo.paginas.rotas[f"/r{i}"] = falsos.redirecionar(f"/r{i + 1}")
    mundo.paginas.rotas["/r3"] = falsos.pagina("<p>chegou</p>")      # r0 -> r1 -> r2 -> r3: 3 saltos
    assert baixar(mundo, "http://site.exemplo/r0").corpo == b"<p>chegou</p>"
    mundo.paginas.rotas["/r3"] = falsos.redirecionar("/r4")           # agora seriam 4
    mundo.paginas.rotas["/r4"] = falsos.pagina("<p>longe demais</p>")
    assert recusado(mundo, "http://site.exemplo/r0").codigo == "redirecionamentos_demais"


def test_redirecionamento_para_outro_site_e_recusado_por_padrao(mundo):
    mundo.paginas.rotas["/a"] = falsos.redirecionar("http://outro.exemplo/p")
    erro = recusado(mundo, "http://site.exemplo/a")
    assert erro.codigo == "redirecionamento_outro_dominio"
    assert mundo.conector.conexoes == [(IP_A, 80)]


def test_outro_site_so_vale_com_a_politica_ligada_e_continua_conferido(mundo):
    mundo.paginas.rotas["/a"] = falsos.redirecionar("http://outro.exemplo/p")
    mundo.paginas.rotas["/p"] = falsos.pagina("<p>de outro site</p>")
    pagina = baixar(mundo, "http://site.exemplo/a", redirecionar_para_outro_dominio=True)
    assert pagina.url_final.host == "outro.exemplo" and mundo.conector.conexoes[-1] == (IP_B, 80)


DESTINOS_PROIBIDOS = [
    "http://127.0.0.1/", "http://127.0.0.1:80/segredo", "http://localhost/admin", "http://[::1]/",
    "http://169.254.169.254/latest/meta-data/", "http://[fd00:ec2::254]/",
    "http://metadata.google.internal/computeMetadata/v1/", "http://10.0.0.1/", "//127.0.0.1/x",
    "file:///etc/passwd", "ftp://site.exemplo/x", "gopher://site.exemplo/",
    "http://site.exemplo:8080/", "http://site.exemplo:22/", "http://user:senha@site.exemplo/",
    "/login", "/confirmar?token=1", "http://2130706433/",
]


@pytest.mark.parametrize("destino", DESTINOS_PROIBIDOS)
@pytest.mark.parametrize("politica_liberal", [False, True], ids=["mesmo-site", "qualquer-site"])
def test_redirecionamento_para_destino_proibido_nunca_conecta(mundo, destino, politica_liberal):
    mundo.paginas.rotas["/a"] = falsos.redirecionar(destino)
    with pytest.raises(ErroFerramenta):
        baixar(mundo, "http://site.exemplo/a", redirecionar_para_outro_dominio=politica_liberal)
    assert mundo.conector.conexoes == [(IP_A, 80)]        # só a primeira conexão, a do pedido


def test_redirecionamento_para_nome_que_resolve_para_interno(mundo):
    mundo.dns.tabela["interno.exemplo"] = ["10.1.1.1"]
    mundo.paginas.rotas["/a"] = falsos.redirecionar("http://interno.exemplo/")
    erro = recusado(mundo, "http://site.exemplo/a", redirecionar_para_outro_dominio=True)
    assert erro.codigo == "bloqueado_endereco_interno" and mundo.conector.conexoes == [(IP_A, 80)]


def test_redirecionamento_em_circulo(mundo):
    mundo.paginas.rotas["/x"] = falsos.redirecionar("/y")
    mundo.paginas.rotas["/y"] = falsos.redirecionar("/x")
    assert recusado(mundo, "http://site.exemplo/x").codigo == "redirecionamento_em_laco"


def test_redirecionamento_sem_destino(mundo):
    mundo.paginas.rotas["/x"] = falsos.redirecionar_sem_destino()
    assert recusado(mundo, "http://site.exemplo/x").codigo == "redirecionamento_invalido"


def test_destino_relativo_e_resolvido_contra_o_endereco_atual(mundo):
    mundo.paginas.rotas["/dir/a"] = falsos.redirecionar("b")
    mundo.paginas.rotas["/dir/b"] = falsos.redirecionar("../fim")
    mundo.paginas.rotas["/fim"] = falsos.pagina("<p>ok</p>")
    assert baixar(mundo, "http://site.exemplo/dir/a").url_final.caminho == "/fim"


# --- resposta gigante ------------------------------------------------------------------------
def test_content_length_gigante_e_recusado_sem_ler_o_corpo(mundo):
    mundo.paginas.rotas["/g"] = falsos.resposta_gigante(mundo.paginas, 50_000_000, com_content_length=True)
    inicio = time.monotonic()
    assert recusado(mundo, "http://site.exemplo/g", max_bytes=100_000).codigo == "pagina_grande_demais"
    assert time.monotonic() - inicio < 3
    assert mundo.paginas.bytes_enviados < 10_000_000          # o cliente desistiu cedo


def test_corpo_sem_tamanho_para_de_ser_lido_no_limite(mundo):
    mundo.paginas.rotas["/g"] = falsos.resposta_gigante(mundo.paginas, 300_000_000)
    inicio = time.monotonic()
    assert recusado(mundo, "http://site.exemplo/g", max_bytes=100_000).codigo == "pagina_grande_demais"
    assert time.monotonic() - inicio < 3
    assert mundo.paginas.bytes_enviados < 30_000_000          # nem perto dos 300 MB


def test_corpo_em_pedacos_acima_do_limite_e_recusado(mundo):
    mundo.paginas.rotas["/c"] = falsos.em_pedacos(["x" * 60_000, "y" * 60_000])
    assert recusado(mundo, "http://site.exemplo/c", max_bytes=100_000).codigo == "pagina_grande_demais"


def test_limite_e_inclusivo_no_byte_exato(mundo):
    mundo.paginas.rotas["/ok"] = falsos.pagina(b"x" * 100_000, tipo="text/plain")
    mundo.paginas.rotas["/mais"] = falsos.pagina(b"x" * 100_001, tipo="text/plain")
    assert len(baixar(mundo, "http://site.exemplo/ok", max_bytes=100_000).corpo) == 100_000
    assert recusado(mundo, "http://site.exemplo/mais", max_bytes=100_000).codigo == "pagina_grande_demais"


def test_bomba_gzip_e_recusada_depois_de_descomprimir(mundo):
    mundo.paginas.rotas["/b"] = falsos.bomba_gzip(20_000_000)         # ~20 KB no fio, 20 MB aberto
    assert recusado(mundo, "http://site.exemplo/b", max_bytes=100_000).codigo == "pagina_grande_demais"


def test_codificacao_desconhecida_e_recusada(mundo):
    mundo.paginas.rotas["/br"] = falsos.pagina(b"\x00\x01", cabecalhos={"Content-Encoding": "br"})
    assert recusado(mundo, "http://site.exemplo/br").codigo == "codificacao_nao_suportada"


# --- resposta lenta -------------------------------------------------------------------------------
def test_corpo_que_pinga_devagar_estoura_o_prazo_total(mundo):
    mundo.paginas.rotas["/lento"] = falsos.gotejando("x" * 60, 0.1)   # levaria 6 s
    inicio = time.monotonic()
    assert recusado(mundo, "http://site.exemplo/lento", tempo_leitura_s=1.0).codigo == "tempo_esgotado"
    assert time.monotonic() - inicio < 2.5


def test_site_que_demora_para_responder(mundo):
    mundo.paginas.rotas["/tarde"] = falsos.lenta_para_responder(3.0)
    inicio = time.monotonic()
    assert recusado(mundo, "http://site.exemplo/tarde", tempo_leitura_s=0.5).codigo == "tempo_esgotado"
    assert time.monotonic() - inicio < 2.0


def test_dns_que_trava_estoura_o_prazo(mundo):
    mundo.dns.tabela["trava.exemplo"] = lambda: (time.sleep(3), [IP_A])[1]
    inicio = time.monotonic()
    assert recusado(mundo, "http://trava.exemplo/", tempo_leitura_s=0.5).codigo == "tempo_esgotado"
    assert time.monotonic() - inicio < 1.5


def test_o_prazo_vale_para_a_leitura_inteira_e_nao_por_salto(mundo):
    def salto_lento(destino):
        def rota(h):
            time.sleep(0.4)
            falsos.redirecionar(destino)(h)
        return rota
    mundo.paginas.rotas["/a"] = salto_lento("/b")
    mundo.paginas.rotas["/b"] = salto_lento("/c")
    mundo.paginas.rotas["/c"] = falsos.pagina("<p>fim</p>")
    assert baixar(mundo, "http://site.exemplo/a", tempo_leitura_s=5.0).corpo == b"<p>fim</p>"
    assert recusado(mundo, "http://site.exemplo/a", tempo_leitura_s=0.6).codigo == "tempo_esgotado"


# --- respostas defeituosas ---------------------------------------------------------------------------
@pytest.mark.parametrize("status", [400, 403, 404, 410, 429, 500, 503])
def test_erro_do_site_vira_erro_claro(mundo, status):
    mundo.paginas.rotas["/e"] = falsos.pagina("erro", status=status)
    erro = recusado(mundo, "http://site.exemplo/e")
    assert erro.codigo == "erro_do_site" and str(status) in erro.mensagem


def test_resposta_que_nao_e_http(mundo):
    mundo.paginas.rotas["/x"] = falsos.nao_e_http()
    assert recusado(mundo, "http://site.exemplo/x").codigo == "resposta_invalida"


def test_corpo_cortado_no_meio(mundo):
    mundo.paginas.rotas["/x"] = falsos.corpo_truncado()
    assert recusado(mundo, "http://site.exemplo/x").codigo == "resposta_incompleta"


def test_conexao_recusada_pelo_destino(mundo):
    mundo.dns.tabela["fechado.exemplo"] = ["8.8.4.4"]                # IP público sem destino falso
    assert recusado(mundo, "http://fechado.exemplo/").codigo == "conexao_falhou"


def test_tenta_o_proximo_ip_quando_o_primeiro_nao_conecta(mundo):
    mundo.dns.tabela["dois.exemplo"] = ["8.8.4.4", IP_A]
    mundo.paginas.rotas["/"] = falsos.pagina("<p>ok</p>")
    assert baixar(mundo, "http://dois.exemplo/").corpo == b"<p>ok</p>"
    assert mundo.conector.conexoes == [("8.8.4.4", 80), (IP_A, 80)]


# --- https: certificado conferido contra o NOME, mesmo conectando por IP --------------------------------
@pytest.fixture
def mundo_https(tmp_path):
    contexto_servidor, contexto_cliente = falsos.gerar_certificado(tmp_path, "seguro.exemplo")
    servidor = PaginasFalsas(contexto_ssl=contexto_servidor)
    servidor.iniciar()
    servidor.rotas["/"] = falsos.pagina("<p>página segura</p>")
    dns = DnsFalso({"seguro.exemplo": [IP_B], "falso.exemplo": [IP_B]})
    conector = ConectorFalso({(IP_B, 443): ("127.0.0.1", servidor.porta)})
    yield servidor, dns, conector, contexto_cliente
    servidor.parar()


def cliente_https(mundo, mundo_https, **mudancas):
    _, dns, conector, contexto = mundo_https
    return ClienteHttp(mundo.params(**mudancas), resolvedor=dns, conector=conector, contexto_ssl=contexto)


def test_https_com_certificado_do_nome_certo(mundo, mundo_https):
    pagina = cliente_https(mundo, mundo_https).baixar(analisar_url("https://seguro.exemplo/"))
    assert pagina.corpo == b"<p>p\xc3\xa1gina segura</p>"
    assert mundo_https[2].conexoes == [(IP_B, 443)]


def test_https_com_nome_diferente_do_certificado_e_recusado(mundo, mundo_https):
    cliente = cliente_https(mundo, mundo_https)
    with pytest.raises(ErroFerramenta) as erro:
        cliente.baixar(analisar_url("https://falso.exemplo/"))      # mesmo IP, nome que o certificado não cobre
    assert erro.value.codigo == "certificado_invalido"


def test_https_com_certificado_nao_confiavel_pelo_sistema_e_recusado(mundo, mundo_https):
    _, dns, conector, _ = mundo_https
    cliente = ClienteHttp(mundo.params(), resolvedor=dns, conector=conector)   # confiança padrão do sistema
    with pytest.raises(ErroFerramenta) as erro:
        cliente.baixar(analisar_url("https://seguro.exemplo/"))
    assert erro.value.codigo == "certificado_invalido"


def test_https_na_porta_de_um_servidor_que_fala_http_puro(mundo):
    mundo.conector.destinos[(IP_B, 443)] = ("127.0.0.1", mundo.paginas.porta)   # servidor sem TLS
    erro = recusado(mundo, "https://outro.exemplo/", tempo_leitura_s=2.0)
    assert erro.codigo in ("falha_tls", "tempo_esgotado", "falha_de_rede")
