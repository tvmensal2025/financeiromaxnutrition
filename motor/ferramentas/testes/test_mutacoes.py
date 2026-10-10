"""Testes de mutação: para cada trava de segurança, provar que o teste enxerga a falta dela.

Como funciona, para cada caso (cenário + defeito):
  1. com o código bom, o cenário de ataque é DEFENDIDO (volta True);
  2. com o defeito plantado (a trava desligada ou enfraquecida), o MESMO cenário NÃO é
     defendido (volta False). Se o defeito passasse sem o teste reparar, o teste seria inútil.

Um cenário devolve True quando o ataque foi barrado e False quando o ataque deu certo.
"""

import re
import socket
import time

import pytest

import falsos
from conftest import chamar, texto_de
from falsos import IP_A, Sequencia
from ferramentas_helena import enderecos, limpeza, rede
from ferramentas_helena import servidor as modulo_servidor
from ferramentas_helena.busca import AdaptadorFalso, ResultadoBusca
from ferramentas_helena.contador import Contador
from ferramentas_helena.enderecos import analisar_url
from ferramentas_helena.erros import ErroFerramenta
from ferramentas_helena.ferramentas import DEFINICOES
from ferramentas_helena.leitor import Leitor
from ferramentas_helena.rede import ClienteHttp

SEGREDO = "SEGREDO_INTERNO_NAO_REAL"


class ConectorAberto:
    """Aceita qualquer destino e liga no servidor local. Guarda para onde o código quis ir.

    Se o código pedir uma conexão por NOME (e não por IP), resolve o nome de novo no DNS
    falso, como o sistema faria: é assim que o ataque de rebinding acontece.
    """

    def __init__(self, mundo):
        self.mundo = mundo
        self.destinos = []

    def __call__(self, alvo, porta, tempo_s):
        try:
            socket.inet_pton(socket.AF_INET6 if ":" in alvo else socket.AF_INET, alvo)
            ip = alvo
        except OSError:
            ip = self.mundo.dns(alvo, porta)[0]
        self.destinos.append(ip)
        return socket.create_connection(("127.0.0.1", self.mundo.paginas.porta), timeout=tempo_s)


def cliente_aberto(mundo, **mudancas):
    conector = ConectorAberto(mundo)
    return ClienteHttp(mundo.params(**mudancas), resolvedor=mundo.dns, conector=conector), conector


def barrado(funcao) -> bool:
    try:
        funcao()
    except ErroFerramenta:
        return True
    return False


def ler_url(mundo, url, **mudancas):
    cliente, conector = cliente_aberto(mundo, **mudancas)
    return barrado(lambda: cliente.baixar(analisar_url(url)))


def leitor_aberto(mundo, **mudancas):
    params = mundo.params(**mudancas)
    cliente = ClienteHttp(params, resolvedor=mundo.dns, conector=ConectorAberto(mundo))
    from ferramentas_helena.copias import Copias
    return Leitor(params, cliente, Copias(params.diretorio))


# --- cenários de ataque (True = barrado) ---------------------------------------------------------
def servir_segredo(mundo):
    mundo.paginas.rotas["/"] = falsos.pagina(f"<p>{SEGREDO}</p>")


def cenario_dns_interno(mundo):
    servir_segredo(mundo)
    mundo.dns.tabela["armadilha.exemplo"] = ["127.0.0.1"]
    return ler_url(mundo, "http://armadilha.exemplo/")


def cenario_ip_literal_interno(mundo):
    servir_segredo(mundo)
    return barrado(lambda: leitor_aberto(mundo).ler("http://127.0.0.1/", 1))


def cenario_metadata_da_nuvem(mundo):
    servir_segredo(mundo)
    mundo.paginas.rotas["/latest/meta-data/"] = falsos.pagina(f"<p>{SEGREDO}</p>")
    return barrado(lambda: leitor_aberto(mundo).ler("http://169.254.169.254/latest/meta-data/", 1))


def cenario_ipv6_mapeado_para_loopback(mundo):
    servir_segredo(mundo)
    return barrado(lambda: leitor_aberto(mundo).ler("http://[::ffff:127.0.0.1]/", 1))


def cenario_ip_interno_em_redirecionamento(mundo):
    servir_segredo(mundo)
    mundo.dns.tabela["salto.exemplo"] = ["10.0.0.9"]
    mundo.paginas.rotas["/a"] = falsos.redirecionar("http://salto.exemplo/")
    return ler_url(mundo, "http://site.exemplo/a", redirecionar_para_outro_dominio=True)


def cenario_porta_fora_de_80_443(mundo):
    servir_segredo(mundo)
    return barrado(lambda: leitor_aberto(mundo).ler("http://site.exemplo:8080/", 1))


def cenario_esquema_que_nao_e_http(mundo):
    servir_segredo(mundo)
    return barrado(lambda: leitor_aberto(mundo).ler("ftp://site.exemplo/", 1))


def cenario_usuario_e_senha_no_endereco(mundo):
    servir_segredo(mundo)
    return barrado(lambda: leitor_aberto(mundo).ler("http://usuario:senha@site.exemplo/", 1))


def cenario_caminho_de_acao(mundo):
    mundo.paginas.rotas["/confirmar"] = falsos.pagina("<p>conta confirmada</p>")
    return barrado(lambda: leitor_aberto(mundo).ler("http://site.exemplo/confirmar", 1))


def cenario_redirecionamento_para_outro_site(mundo):
    mundo.paginas.rotas["/a"] = falsos.redirecionar("http://outro.exemplo/")
    servir_segredo(mundo)
    return ler_url(mundo, "http://site.exemplo/a")


def cenario_rebinding(mundo):
    servir_segredo(mundo)
    mundo.dns.tabela["rebind.exemplo"] = Sequencia([IP_A], ["127.0.0.1"])
    cliente, conector = cliente_aberto(mundo)
    try:
        cliente.baixar(analisar_url("http://rebind.exemplo/"))
    except ErroFerramenta:
        pass
    return "127.0.0.1" not in conector.destinos           # barrado = nunca foi parar no loopback


def cenario_content_length_gigante(mundo):
    mundo.paginas.rotas["/g"] = falsos.resposta_gigante(mundo.paginas, 3_000_000, com_content_length=True)
    return ler_url(mundo, "http://site.exemplo/g", max_bytes=100_000)


def cenario_corpo_em_pedacos_gigante(mundo):
    mundo.paginas.rotas["/g"] = falsos.em_pedacos(["x" * 60_000] * 50)
    return ler_url(mundo, "http://site.exemplo/g", max_bytes=100_000)


def cenario_bomba_gzip(mundo):
    mundo.paginas.rotas["/b"] = falsos.bomba_gzip(20_000_000)
    return ler_url(mundo, "http://site.exemplo/b", max_bytes=100_000)


def cenario_resposta_lenta(mundo):
    mundo.paginas.rotas["/lento"] = falsos.gotejando("x" * 25, 0.1)              # levaria 2,5 s
    inicio = time.monotonic()
    cortou = ler_url(mundo, "http://site.exemplo/lento", tempo_leitura_s=0.5)
    return cortou and time.monotonic() - inicio < 1.5


PAGINA_COM_ARMADILHAS = f"""<html><head><script>var a = "{SEGREDO}-script";</script></head><body>
<!-- {SEGREDO}-comentario -->
<p>texto visível​{''.join(chr(0xE0000 + ord(c)) for c in SEGREDO)}</p>
<div style="display:none">{SEGREDO}-estilo</div><div hidden>{SEGREDO}-hidden</div>
</body></html>"""


def pagina_armadilha_limpa(mundo, procurado):
    mundo.paginas.rotas["/t"] = falsos.pagina(PAGINA_COM_ARMADILHAS)
    saida = leitor_aberto(mundo).ler("http://site.exemplo/t", 1).texto
    return procurado not in saida and "texto visível" in saida


def cenario_caracteres_invisiveis(mundo):
    mundo.paginas.rotas["/t"] = falsos.pagina(PAGINA_COM_ARMADILHAS)
    saida = leitor_aberto(mundo).ler("http://site.exemplo/t", 1).texto
    return "​" not in saida and all(ord(c) < 0xE0000 for c in saida)


def cenario_comentario_html(mundo):
    return pagina_armadilha_limpa(mundo, f"{SEGREDO}-comentario")


def cenario_script(mundo):
    return pagina_armadilha_limpa(mundo, f"{SEGREDO}-script")


def cenario_escondido_por_estilo(mundo):
    return pagina_armadilha_limpa(mundo, f"{SEGREDO}-estilo")


def cenario_laco_de_200_chamadas(mundo):
    mundo.paginas.rotas["/t"] = falsos.pagina("<p>oi</p>")
    servidor = mundo.servidor(adaptador=AdaptadorFalso({}), ferramentas=("buscar",), max_total=10,
                              max_buscas=10, max_partes=0)
    for i in range(200):
        chamar(servidor, "buscar", {"consulta": f"q{i}"}, id_=i)
    return len(servidor.adaptador.chamadas) == 10 and servidor.deve_sair


def cenario_insistencia_encerra(mundo):
    servidor = mundo.servidor(adaptador=AdaptadorFalso({}), ferramentas=("buscar",), max_total=2,
                              max_buscas=2, max_partes=0)
    for i in range(20):
        chamar(servidor, "buscar", {"consulta": f"q{i}"}, id_=i)
    return servidor.deve_sair


def cenario_lista_vazia_executa_ferramenta(mundo):
    mundo.paginas.rotas["/t"] = falsos.pagina(f"<p>{SEGREDO}</p>")
    servidor = mundo.servidor(ferramentas=(), max_buscas=0, max_partes=0, max_total=5)
    resposta = chamar(servidor, "ler_pagina", {"url": "http://site.exemplo/t"})
    return "error" in resposta and mundo.paginas.requisicoes == []


def cenario_lista_vazia_lista_ferramentas(mundo):
    servidor = mundo.servidor(ferramentas=(), max_buscas=0, max_partes=0, max_total=5)
    resposta = servidor.tratar({"jsonrpc": "2.0", "id": 1, "method": "tools/list"})
    return resposta["result"]["tools"] == []


def cenario_fora_da_lista_de_fontes(mundo):
    mundo.paginas.rotas["/outra"] = falsos.pagina(f"<p>{SEGREDO}</p>")
    leitor = leitor_aberto(mundo, lista_de_enderecos=("http://site.exemplo/termos",))
    return barrado(lambda: leitor.ler("http://site.exemplo/outra", 1))


def cenario_busca_com_resultado_interno(mundo):
    falso = AdaptadorFalso({"x": [ResultadoBusca("meta", "http://169.254.169.254/latest/meta-data/")]})
    servidor = mundo.servidor(adaptador=falso)
    return "169.254.169.254" not in texto_de(chamar(servidor, "buscar", {"consulta": "x"}))


# --- defeitos plantados -------------------------------------------------------------------------------
def sempre_publico(mp):
    mp.setattr(rede, "ip_e_publico", lambda ip: True)
    mp.setattr(enderecos, "ip_e_publico", lambda ip: True)


def so_o_dns_confia(mp):
    mp.setattr(rede, "ip_e_publico", lambda ip: True)


def aceitar_porta_8080(mp):
    mp.setattr(enderecos, "PORTAS_PERMITIDAS", (80, 443, 8080))


def aceitar_ftp(mp):
    mp.setattr(enderecos, "ESQUEMAS_PERMITIDOS", ("http", "https", "ftp"))


def ignorar_usuario_e_senha(mp):
    original = enderecos.urlsplit
    mp.setattr(enderecos, "urlsplit", lambda texto: (lambda r: r._replace(netloc=r.netloc.rsplit("@", 1)[-1]))(original(texto)))


def esquecer_palavras_de_acao(mp):
    mp.setattr(enderecos, "PALAVRAS_DE_ACAO", frozenset())


def aceitar_qualquer_dominio_no_redirecionamento(mp):
    mp.setattr(rede, "mesmo_dominio", lambda a, b: True)


def conectar_pelo_nome_em_vez_do_ip(mp):
    original = ClienteHttp._ips_publicos

    def confere_mas_devolve_o_nome(self, endereco, fim):
        original(self, endereco, fim)
        return [endereco.host]
    mp.setattr(ClienteHttp, "_ips_publicos", confere_mas_devolve_o_nome)


def ignorar_limite_do_corpo(mp):
    original = rede._ler_corpo
    mp.setattr(rede, "_ler_corpo", lambda canal, cabecalhos, limite: original(canal, cabecalhos, limite * 1000))


def ignorar_limite_da_descompressao(mp):
    original = rede._descomprimir
    mp.setattr(rede, "_descomprimir", lambda corpo, cod, limite: original(corpo, cod, limite * 1000))


def esquecer_o_prazo_total(mp):
    def receber_sem_prazo(self):
        self.sock.settimeout(10)
        return self.sock.recv(65536)
    mp.setattr(rede._Canal, "_receber", receber_sem_prazo)


def nao_limpar_caracteres(mp):
    mp.setattr(limpeza, "limpar_caracteres", lambda texto: texto)


def deixar_comentario_vazar(mp):
    mp.setattr(limpeza, "_COMENTARIO", re.compile(r"(?!x)x"))
    mp.setattr(limpeza._Extrator, "handle_comment", lambda self, dados: self.pedacos.append(dados))


def nao_ignorar_script(mp):
    mp.setattr(limpeza, "ELEMENTOS_IGNORADOS", frozenset())


def nao_detectar_estilo_escondido(mp):
    mp.setattr(limpeza, "_esta_escondido", lambda atributos: False)


def nunca_estourar_o_limite(mp):
    mp.setattr(Contador, "_estouraria", lambda self, ferramenta, liberada: False)


def nunca_encerrar_por_insistencia(mp):
    mp.setattr(Contador, "insistencias", property(lambda self: 0))


def liberar_qualquer_ferramenta(mp):
    mp.setattr(modulo_servidor.Servidor, "_liberada", lambda self, nome: True)


def listar_todas_as_ferramentas(mp):
    mp.setattr(modulo_servidor, "listar_ferramentas",
               lambda nomes: [{"name": n, **DEFINICOES[n]} for n in DEFINICOES])


def ignorar_a_lista_de_fontes(mp):
    mp.setattr(Leitor, "_na_lista", lambda self, url: True)


def aceitar_qualquer_resultado_de_busca(mp):
    mp.setattr(Leitor, "endereco_aceito", lambda self, url: True)


CASOS = [
    ("ip interno vindo do DNS", cenario_dns_interno, so_o_dns_confia),
    ("IP interno escrito no endereço", cenario_ip_literal_interno, sempre_publico),
    ("metadata de nuvem 169.254.169.254", cenario_metadata_da_nuvem, sempre_publico),
    ("IPv6 mapeado para 127.0.0.1", cenario_ipv6_mapeado_para_loopback, sempre_publico),
    ("IP interno depois de redirecionamento", cenario_ip_interno_em_redirecionamento, so_o_dns_confia),
    ("porta fora de 80/443", cenario_porta_fora_de_80_443, aceitar_porta_8080),
    ("esquema que não é http", cenario_esquema_que_nao_e_http, aceitar_ftp),
    ("usuário e senha no endereço", cenario_usuario_e_senha_no_endereco, ignorar_usuario_e_senha),
    ("caminho de ação", cenario_caminho_de_acao, esquecer_palavras_de_acao),
    ("redirecionamento para outro site", cenario_redirecionamento_para_outro_site,
     aceitar_qualquer_dominio_no_redirecionamento),
    ("rebinding de DNS", cenario_rebinding, conectar_pelo_nome_em_vez_do_ip),
    ("resposta gigante com Content-Length", cenario_content_length_gigante, ignorar_limite_do_corpo),
    ("resposta gigante em pedaços", cenario_corpo_em_pedacos_gigante, ignorar_limite_do_corpo),
    ("bomba gzip", cenario_bomba_gzip, ignorar_limite_da_descompressao),
    ("resposta lenta", cenario_resposta_lenta, esquecer_o_prazo_total),
    ("caracteres invisíveis", cenario_caracteres_invisiveis, nao_limpar_caracteres),
    ("comentário HTML", cenario_comentario_html, deixar_comentario_vazar),
    ("script", cenario_script, nao_ignorar_script),
    ("texto escondido por estilo", cenario_escondido_por_estilo, nao_detectar_estilo_escondido),
    ("laço de 200 chamadas", cenario_laco_de_200_chamadas, nunca_estourar_o_limite),
    ("insistência encerra a execução", cenario_insistencia_encerra, nunca_encerrar_por_insistencia),
    ("lista vazia executa ferramenta", cenario_lista_vazia_executa_ferramenta, liberar_qualquer_ferramenta),
    ("lista vazia mostra ferramentas", cenario_lista_vazia_lista_ferramentas, listar_todas_as_ferramentas),
    ("endereço fora da lista de fontes", cenario_fora_da_lista_de_fontes, ignorar_a_lista_de_fontes),
    ("busca devolve endereço interno", cenario_busca_com_resultado_interno, aceitar_qualquer_resultado_de_busca),
]
IDS = [c[0] for c in CASOS]


@pytest.mark.parametrize("nome,cenario,defeito", CASOS, ids=IDS)
def test_com_o_codigo_bom_o_ataque_e_barrado(mundo, nome, cenario, defeito):
    assert cenario(mundo) is True, nome


@pytest.mark.parametrize("nome,cenario,defeito", CASOS, ids=IDS)
def test_com_a_trava_desligada_o_ataque_passa_e_o_teste_percebe(mundo, monkeypatch, nome, cenario, defeito):
    defeito(monkeypatch)
    assert cenario(mundo) is False, f"o defeito '{defeito.__name__}' passou despercebido em '{nome}'"
