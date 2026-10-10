"""Regras de endereço: só público, só http/https, só portas 80/443, sem ação."""

import pytest

from ferramentas_helena.enderecos import analisar_url, ip_e_publico, mesmo_dominio
from ferramentas_helena.erros import ErroFerramenta

INTERNO = "bloqueado_endereco_interno"

# (endereço, código de recusa esperado)
RECUSADOS = [
    # loopback, rede privada, link-local, metadata de nuvem (IPv4)
    ("http://127.0.0.1/", INTERNO),
    ("http://127.0.0.1:80/", INTERNO),
    ("http://127.255.255.254/", INTERNO),
    ("http://0.0.0.0/", INTERNO),
    ("http://10.0.0.5/", INTERNO),
    ("http://172.16.0.1/", INTERNO),
    ("http://172.31.255.255/", INTERNO),
    ("http://192.168.1.1/", INTERNO),
    ("http://100.64.0.1/", INTERNO),               # CGNAT
    ("http://100.100.100.200/", INTERNO),          # metadata da Alibaba
    ("http://169.254.169.254/latest/meta-data/", INTERNO),   # metadata AWS/Azure/GCP
    ("http://169.254.170.2/", INTERNO),            # credenciais de tarefa (ECS)
    ("http://192.0.0.192/", INTERNO),              # metadata Oracle
    ("http://224.0.0.1/", INTERNO),                # multicast
    ("http://255.255.255.255/", INTERNO),
    # IPv6 equivalentes
    ("http://[::1]/", INTERNO),
    ("http://[::]/", INTERNO),
    ("http://[fe80::1]/", INTERNO),
    ("http://[fd00:ec2::254]/", INTERNO),          # metadata AWS em IPv6
    ("http://[fc00::1]/", INTERNO),
    ("http://[fec0::1]/", INTERNO),
    ("http://[ff02::1]/", INTERNO),
    ("http://[::ffff:127.0.0.1]/", INTERNO),       # IPv4 disfarçado de IPv6
    ("http://[::ffff:169.254.169.254]/", INTERNO),
    ("http://[::ffff:10.0.0.1]/", INTERNO),
    ("http://[64:ff9b::7f00:1]/", INTERNO),        # NAT64 apontando para 127.0.0.1
    ("http://[::7f00:1]/", INTERNO),                # formato antigo ::127.0.0.1
    ("http://[2002:7f00:1::]/", INTERNO),          # 6to4
    ("http://[2001:0:4136:e378:8000:63bf:3fff:fdd2]/", INTERNO),  # Teredo
    ("http://[2001:db8::1]/", INTERNO),            # documentação
    # nomes internos
    ("http://localhost/", INTERNO),
    ("http://LOCALHOST./", INTERNO),
    ("http://app.localhost/", INTERNO),
    ("http://metadata.google.internal/computeMetadata/v1/", INTERNO),
    ("http://metadata/", INTERNO),
    ("http://servico.internal/", INTERNO),
    ("http://impressora.local/", INTERNO),
    ("http://roteador.lan/", INTERNO),
    ("http://host.docker.internal/", INTERNO),
    ("http://intranet/", INTERNO),                  # nome sem ponto
    ("http://db/", INTERNO),
    # IP escrito de jeito torto (o navegador entenderia como 127.0.0.1)
    ("http://2130706433/", "endereco_invalido"),
    ("http://0x7f.0.0.1/", "endereco_invalido"),
    ("http://0x7f000001/", "endereco_invalido"),
    ("http://0177.0.0.1/", "endereco_invalido"),
    ("http://127.1/", "endereco_invalido"),
    ("http://1.2.3/", "endereco_invalido"),
    ("http://127。0。0。1/", "endereco_invalido"),            # ponto "largo": o IDNA o transforma em ponto comum
    ("http://０.０.０.０/", "endereco_invalido"),              # algarismos "largos"
    ("http://%31%32%37.0.0.1/", "endereco_invalido"),         # nome codificado com %
    ("http://127.0.0.1./", "endereco_invalido"),              # ponto final depois do IP
    # esquemas
    ("file:///etc/passwd", "esquema_nao_permitido"),
    ("ftp://exemplo.com/arquivo", "esquema_nao_permitido"),
    ("gopher://exemplo.com/", "esquema_nao_permitido"),
    ("javascript:alert(1)", "esquema_nao_permitido"),
    ("data:text/html,<script>1</script>", "esquema_nao_permitido"),
    ("//exemplo.com/x", "esquema_nao_permitido"),
    ("exemplo.com/x", "esquema_nao_permitido"),
    ("ws://exemplo.com/", "esquema_nao_permitido"),
    # portas
    ("http://exemplo.com:8080/", "porta_nao_permitida"),
    ("https://exemplo.com:8443/", "porta_nao_permitida"),
    ("http://exemplo.com:22/", "porta_nao_permitida"),
    ("http://exemplo.com:6379/", "porta_nao_permitida"),
    ("http://exemplo.com:5432/", "porta_nao_permitida"),
    ("http://exemplo.com:0/", "porta_nao_permitida"),
    ("http://exemplo.com:99999/", "endereco_invalido"),
    ("http://exemplo.com:abc/", "endereco_invalido"),
    # usuário e senha dentro do endereço
    ("http://usuario:senha@exemplo.com/", "credenciais_na_url"),
    ("http://usuario@exemplo.com/", "credenciais_na_url"),
    ("http://exemplo.com@127.0.0.1/", "credenciais_na_url"),
    ("http://exemplo.com:80@127.0.0.1/", "credenciais_na_url"),
    # caminho de ação
    ("https://exemplo.com/confirmar", "caminho_de_acao"),
    ("https://exemplo.com/usuario/confirm/abc123", "caminho_de_acao"),
    ("https://exemplo.com/verificar-email", "caminho_de_acao"),
    ("https://exemplo.com/verify_email", "caminho_de_acao"),
    ("https://exemplo.com/aceitar", "caminho_de_acao"),
    ("https://exemplo.com/convite/xyz", "caminho_de_acao"),
    ("https://exemplo.com/invite", "caminho_de_acao"),
    ("https://exemplo.com/indicação/abc", "caminho_de_acao"),   # com acento
    ("https://exemplo.com/INDICACAO", "caminho_de_acao"),
    ("https://exemplo.com/ref", "caminho_de_acao"),
    ("https://exemplo.com/descadastrar", "caminho_de_acao"),
    ("https://exemplo.com/unsubscribe", "caminho_de_acao"),
    ("https://exemplo.com/a/token/b", "caminho_de_acao"),
    ("https://exemplo.com/login", "caminho_de_acao"),
    ("https://exemplo.com/signin", "caminho_de_acao"),
    ("https://exemplo.com/signup", "caminho_de_acao"),
    ("https://exemplo.com/cadastro", "caminho_de_acao"),
    ("https://exemplo.com/register", "caminho_de_acao"),
    ("https://exemplo.com/checkout", "caminho_de_acao"),
    ("https://exemplo.com/pagar", "caminho_de_acao"),
    ("https://exemplo.com/pay", "caminho_de_acao"),
    ("https://exemplo.com/conf%69rm", "caminho_de_acao"),        # %69 = "i"
    ("https://exemplo.com/%2563onfirm", "caminho_de_acao"),     # codificado duas vezes
    ("https://exemplo.com/user.login.html", "caminho_de_acao"),
    # texto torto
    ("", "endereco_invalido"),
    ("   ", "endereco_invalido"),
    (None, "endereco_invalido"),
    (123, "endereco_invalido"),
    ("https://", "endereco_invalido"),
    ("https:///caminho", "endereco_invalido"),
    ("https://exemplo.com/a b", "endereco_invalido"),
    ("https://exemplo.com/a\r\nHost: interno", "endereco_invalido"),
    ("https://exemplo.com/\x00", "endereco_invalido"),
    ("https://exemplo.com\\@127.0.0.1/", "endereco_invalido"),
    ("https://[::1%25eth0]/", "endereco_invalido"),
    ("https://-ruim.exemplo.com/", "endereco_invalido"),
    ("https://exemplo..com/", "endereco_invalido"),
    ("https://exemplo.com/" + "a" * 2100, "endereco_invalido"),
]


@pytest.mark.parametrize("url,codigo", RECUSADOS, ids=[str(u)[:60] for u, _ in RECUSADOS])
def test_endereco_recusado(url, codigo):
    with pytest.raises(ErroFerramenta) as erro:
        analisar_url(url)
    assert erro.value.codigo == codigo


def test_recusa_de_endereco_interno_nao_revela_o_ip_ao_agente():
    with pytest.raises(ErroFerramenta) as erro:
        analisar_url("http://10.1.2.3/")
    assert "10.1.2.3" not in erro.value.mensagem          # o agente não recebe o detalhe
    assert "10.1.2.3" in erro.value.detalhe               # o registro recebe


ACEITOS = [
    ("https://exemplo.com/termos", "https://exemplo.com/termos"),
    ("http://exemplo.com:80/x", "http://exemplo.com/x"),
    ("https://exemplo.com:443/x", "https://exemplo.com/x"),
    ("https://exemplo.com", "https://exemplo.com/"),
    ("HTTPS://EXEMPLO.COM/Termos", "https://exemplo.com/Termos"),    # nome minúsculo, caminho intacto
    ("https://exemplo.com/politica?x=1&y=2#topo", "https://exemplo.com/politica"),   # sem consulta e fragmento
    ("https://exemplo.com/a/b/c.html", "https://exemplo.com/a/b/c.html"),
    ("https://bücher.exemplo/", "https://xn--bcher-kva.exemplo/"),
    ("https://exemplo.com/são-paulo", "https://exemplo.com/s%C3%A3o-paulo"),
    ("https://exemplo.com:80/x", "https://exemplo.com:80/x"),         # porta 80 em https: aceita pela regra 80/443
    ("https://8.8.8.8/", "https://8.8.8.8/"),
    ("https://[2606:4700:4700::1111]/x", "https://[2606:4700:4700::1111]/x"),
    ("https://exemplo.com/payment-terms", "https://exemplo.com/payment-terms"),   # "payment" não é "pay"
    ("https://exemplo.com/referral-program", "https://exemplo.com/referral-program"),
    ("https://exemplo.com/termos-de-uso", "https://exemplo.com/termos-de-uso"),
    ("https://exemplo.com./termos", "https://exemplo.com/termos"),     # ponto final do nome
    ("  https://exemplo.com/x  ", "https://exemplo.com/x"),
]


@pytest.mark.parametrize("url,esperado", ACEITOS)
def test_endereco_aceito_e_normalizado(url, esperado):
    assert analisar_url(url).url == esperado


def test_consulta_com_token_nao_chega_ao_servidor():
    # a consulta some do endereço normalizado: o que é enviado não carrega token
    endereco = analisar_url("https://exemplo.com/termos?token=SEGREDO_NAO_REAL#frag")
    assert "SEGREDO" not in endereco.url and "?" not in endereco.caminho


def test_ip_literal_publico_fica_marcado():
    assert analisar_url("https://8.8.8.8/").ip_literal == "8.8.8.8"
    assert analisar_url("https://exemplo.com/").ip_literal is None


IPS_PUBLICOS = ["8.8.8.8", "93.184.216.34", "151.101.1.1", "2606:4700:4700::1111", "::ffff:8.8.8.8"]
IPS_NAO_PUBLICOS = [
    "127.0.0.1", "10.0.0.1", "172.16.5.5", "192.168.0.1", "169.254.169.254", "100.64.0.1",
    "0.0.0.0", "224.0.0.1", "240.0.0.1", "255.255.255.255", "::1", "::", "fe80::1", "fd00:ec2::254",
    "::ffff:127.0.0.1", "64:ff9b::7f00:1", "::7f00:1", "2002:808:808::", "fec0::1", "ff02::1",
    "nao-sou-ip", "", "1.2.3", "fe80::1%eth0",
]


@pytest.mark.parametrize("ip", IPS_PUBLICOS)
def test_ip_publico(ip):
    assert ip_e_publico(ip) is True


@pytest.mark.parametrize("ip", IPS_NAO_PUBLICOS)
def test_ip_nao_publico(ip):
    assert ip_e_publico(ip) is False


def test_mesmo_dominio_aceita_so_a_diferenca_do_www():
    assert mesmo_dominio("exemplo.com", "www.exemplo.com")
    assert mesmo_dominio("www.exemplo.com", "exemplo.com")
    assert mesmo_dominio("exemplo.com", "exemplo.com")
    assert not mesmo_dominio("exemplo.com", "exemplo.com.malvado.com")
    assert not mesmo_dominio("exemplo.com", "malvado-exemplo.com")
    assert not mesmo_dominio("exemplo.com", "outro.exemplo.com")
