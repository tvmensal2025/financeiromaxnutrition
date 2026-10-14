"""Cliente HTTP mínimo e seguro: só endereços públicos, sem surpresa.

Como a segurança funciona (anti-rebinding):
1. O nome do site é resolvido UMA vez (DNS), com prazo.
2. TODOS os IPs devolvidos são conferidos (enderecos.ip_e_publico). Se algum não for
   público, a leitura é recusada inteira.
3. A conexão é aberta direto no IP conferido. O nome nunca é resolvido de novo, então um
   DNS que muda de resposta no meio (rebinding) não leva a lugar nenhum.
4. Em https, o certificado é conferido contra o NOME do site (SNI), mesmo conectando por IP.
5. Cada redirecionamento repete tudo isso desde o início (esquema, porta, nome, DNS, IP),
   no máximo 3, e por padrão só dentro do mesmo site.
6. Um prazo único vale para a leitura inteira (DNS, conexão, redirecionamentos e corpo),
   e o corpo nunca passa de max_bytes (também depois de descomprimir).

Só existe GET, sem cookie, sem login, sem formulário, sem executar nada da página.

Os dois "encaixes" (resolvedor e conector) existem para os testes trocarem a rede por um
servidor falso SEM desligar nenhuma conferência: elas rodam antes deles.
"""

import re
import socket
import ssl
import threading
import time
import zlib
from dataclasses import dataclass
from typing import Callable, List, Optional, Tuple
from urllib.parse import urljoin

from .enderecos import Endereco, analisar_url, ip_e_publico, mesmo_dominio
from .erros import ErroFerramenta
from .parametros import Parametros

Resolvedor = Callable[[str, int], List[str]]
Conector = Callable[[str, int, float], socket.socket]

STATUS_DE_REDIRECIONAMENTO = (301, 302, 303, 307, 308)
MAXIMO_DO_CABECALHO = 32_768
USER_AGENT = "HelenaFerramentas/1.0 (leitura publica; sem cookies)"


def resolver_do_sistema(host: str, porta: int) -> List[str]:
    """DNS do sistema operacional. Devolve os IPs, IPv4 primeiro, sem repetir."""
    informacoes = socket.getaddrinfo(host, porta, type=socket.SOCK_STREAM)
    ips: List[str] = []
    for _familia, _tipo, _proto, _nome, destino in informacoes:
        if destino[0] not in ips:
            ips.append(destino[0])
    ips.sort(key=lambda ip: ":" in ip)
    return ips


def conectar_do_sistema(ip: str, porta: int, tempo_s: float) -> socket.socket:
    return socket.create_connection((ip, porta), timeout=tempo_s)


@dataclass(frozen=True)
class Pagina:
    url_final: Endereco
    status: int
    tipo: str            # content-type sem parâmetros, minúsculo ("" se não veio)
    charset: str         # "" se não veio
    corpo: bytes         # já descomprimido
    saltos: Tuple[str, ...]  # endereços percorridos, do pedido ao final


def _com_prazo(funcao, prazo_s: float):
    """Roda `funcao` numa thread e desiste depois do prazo (DNS pode travar sem aviso)."""
    caixa = {}

    def alvo():
        try:
            caixa["ok"] = funcao()
        except BaseException as erro:  # repassado para quem chamou
            caixa["erro"] = erro

    fio = threading.Thread(target=alvo, daemon=True)
    fio.start()
    fio.join(max(prazo_s, 0.0))
    if fio.is_alive():
        raise ErroFerramenta("tempo_esgotado", "O site demorou demais para responder.")
    if "erro" in caixa:
        raise caixa["erro"]
    return caixa["ok"]


class _Canal:
    """Leitura de um socket com prazo único e buffer."""

    def __init__(self, sock: socket.socket, fim: float):
        self.sock = sock
        self.fim = fim
        self.buffer = bytearray()
        self.acabou = False

    def _receber(self) -> bytes:
        restante = self.fim - time.monotonic()
        if restante <= 0:
            raise ErroFerramenta("tempo_esgotado", "O site demorou demais para responder.")
        self.sock.settimeout(restante)
        try:
            return self.sock.recv(65536)
        except (socket.timeout, TimeoutError):
            raise ErroFerramenta("tempo_esgotado", "O site demorou demais para responder.")
        except ssl.SSLError as erro:
            raise ErroFerramenta("falha_tls", "Falha na conexão segura com o site.", str(erro))
        except OSError as erro:
            raise ErroFerramenta("falha_de_rede", "A conexão com o site caiu.", str(erro))

    def _encher(self) -> bool:
        if self.acabou:
            return False
        dados = self._receber()
        if not dados:
            self.acabou = True
            return False
        self.buffer += dados
        return True

    def ler_linha(self, limite: int) -> bytes:
        while True:
            posicao = self.buffer.find(b"\n")
            if posicao != -1:
                linha = bytes(self.buffer[:posicao]).rstrip(b"\r")
                del self.buffer[:posicao + 1]
                return linha
            if len(self.buffer) > limite:
                raise ErroFerramenta("resposta_invalida", "Resposta do site fora do padrão.")
            if not self._encher():
                raise ErroFerramenta("resposta_incompleta", "O site fechou a conexão no meio da resposta.")

    def ler_exato(self, quantidade: int) -> bytes:
        while len(self.buffer) < quantidade:
            if not self._encher():
                raise ErroFerramenta("resposta_incompleta", "O site fechou a conexão no meio da resposta.")
        dados = bytes(self.buffer[:quantidade])
        del self.buffer[:quantidade]
        return dados

    def ler_ate_fechar(self, limite: int) -> bytes:
        while len(self.buffer) <= limite and self._encher():
            pass
        if len(self.buffer) > limite:
            raise _grande_demais()
        dados = bytes(self.buffer)
        self.buffer.clear()
        return dados


def _grande_demais() -> ErroFerramenta:
    return ErroFerramenta("pagina_grande_demais", "A página é grande demais para ser lida.")


def _ler_cabecalhos(canal: _Canal) -> Tuple[int, dict]:
    linha = canal.ler_linha(MAXIMO_DO_CABECALHO)
    achado = re.match(rb"^HTTP/1\.[01] (\d{3})\b", linha)
    if not achado:
        raise ErroFerramenta("resposta_invalida", "Resposta do site fora do padrão.")
    status = int(achado.group(1))
    cabecalhos: dict = {}
    total = len(linha)
    for _ in range(101):
        linha = canal.ler_linha(MAXIMO_DO_CABECALHO)
        total += len(linha)
        if total > MAXIMO_DO_CABECALHO:
            raise ErroFerramenta("resposta_invalida", "Cabeçalho da resposta grande demais.")
        if not linha:
            return status, cabecalhos
        nome, separador, valor = linha.partition(b":")
        if not separador:
            continue
        chave = nome.strip().lower().decode("latin-1")
        texto = valor.strip().decode("latin-1")
        cabecalhos[chave] = f"{cabecalhos[chave]}, {texto}" if chave in cabecalhos else texto
    raise ErroFerramenta("resposta_invalida", "Cabeçalhos demais na resposta.")


def _ler_corpo(canal: _Canal, cabecalhos: dict, limite: int) -> bytes:
    if "chunked" in cabecalhos.get("transfer-encoding", "").lower():
        corpo = bytearray()
        while True:
            tamanho_texto = canal.ler_linha(200).split(b";", 1)[0].strip()
            try:
                tamanho = int(tamanho_texto, 16)
            except ValueError:
                raise ErroFerramenta("resposta_invalida", "Resposta do site fora do padrão.")
            if tamanho == 0:
                for _ in range(101):  # cabeçalhos finais, se houver
                    if not canal.ler_linha(MAXIMO_DO_CABECALHO):
                        break
                return bytes(corpo)
            if len(corpo) + tamanho > limite:
                raise _grande_demais()
            corpo += canal.ler_exato(tamanho)
            canal.ler_linha(10)  # fim da linha depois do pedaço
    if "content-length" in cabecalhos:
        texto = cabecalhos["content-length"].strip()
        if not texto.isdigit():
            raise ErroFerramenta("resposta_invalida", "Resposta do site fora do padrão.")
        tamanho = int(texto)
        if tamanho > limite:
            raise _grande_demais()
        return canal.ler_exato(tamanho)
    return canal.ler_ate_fechar(limite)


def _descomprimir(corpo: bytes, codificacao: str, limite: int) -> bytes:
    codificacao = codificacao.strip().lower()
    if codificacao in ("", "identity"):
        return corpo
    if codificacao in ("gzip", "x-gzip"):
        descompressor = zlib.decompressobj(16 + zlib.MAX_WBITS)
    elif codificacao == "deflate":
        descompressor = zlib.decompressobj(zlib.MAX_WBITS)
    else:
        raise ErroFerramenta("codificacao_nao_suportada", "O site respondeu num formato comprimido que não aceito.")
    try:
        saida = descompressor.decompress(corpo, limite + 1)
    except zlib.error:
        raise ErroFerramenta("resposta_invalida", "Resposta comprimida inválida.")
    if len(saida) > limite or descompressor.unconsumed_tail:
        raise _grande_demais()
    return saida


class ClienteHttp:
    def __init__(self, params: Parametros, resolvedor: Optional[Resolvedor] = None,
                 conector: Optional[Conector] = None,
                 contexto_ssl: Optional[ssl.SSLContext] = None):
        self.params = params
        self.resolvedor = resolvedor or resolver_do_sistema
        self.conector = conector or conectar_do_sistema
        self.contexto_ssl = contexto_ssl

    # --- API ---------------------------------------------------------------------------
    def baixar(self, endereco: Endereco) -> Pagina:
        fim = time.monotonic() + self.params.tempo_leitura_s
        atual = endereco
        saltos = [endereco.url]
        for numero in range(self.params.max_redirecionamentos + 1):
            ips = self._ips_publicos(atual, fim)
            status, cabecalhos, corpo = self._requisitar(atual, ips, fim)
            if status in STATUS_DE_REDIRECIONAMENTO:
                if numero == self.params.max_redirecionamentos:
                    raise ErroFerramenta("redirecionamentos_demais", "O site redirecionou vezes demais.")
                atual = self._proximo_destino(atual, cabecalhos, saltos)
                saltos.append(atual.url)
                continue
            if not 200 <= status < 300:
                raise ErroFerramenta("erro_do_site", f"O site respondeu com erro {status}.", f"status={status}")
            tipo, _, parametros = cabecalhos.get("content-type", "").partition(";")
            achado = re.search(r"charset\s*=\s*\"?([A-Za-z0-9_.:-]+)", parametros)
            return Pagina(
                url_final=atual, status=status, tipo=tipo.strip().lower(),
                charset=achado.group(1) if achado else "", corpo=corpo, saltos=tuple(saltos),
            )
        raise ErroFerramenta("redirecionamentos_demais", "O site redirecionou vezes demais.")  # inalcançável

    # --- passos ------------------------------------------------------------------------
    def _proximo_destino(self, atual: Endereco, cabecalhos: dict, vistos: List[str]) -> Endereco:
        localizacao = cabecalhos.get("location", "").strip()
        if not localizacao:
            raise ErroFerramenta("redirecionamento_invalido", "O site mandou redirecionar sem dizer para onde.")
        # Mesma conferência do pedido original: esquema, porta, nome, caminho de ação.
        destino = analisar_url(urljoin(atual.url, localizacao))
        if not self.params.redirecionar_para_outro_dominio and not mesmo_dominio(atual.host, destino.host):
            raise ErroFerramenta(
                "redirecionamento_outro_dominio",
                "O site redirecionou para outro site; não sigo.",
                f"de={atual.host} para={destino.host}",
            )
        if destino.url in vistos:
            raise ErroFerramenta("redirecionamento_em_laco", "O site redirecionou em círculo.")
        return destino

    def _ips_publicos(self, endereco: Endereco, fim: float) -> List[str]:
        if endereco.ip_literal:
            ips = [endereco.ip_literal]
        else:
            try:
                ips = _com_prazo(lambda: self.resolvedor(endereco.host, endereco.porta),
                                 fim - time.monotonic())
            except OSError as erro:
                raise ErroFerramenta("dns_falhou", "Não consegui encontrar esse site.", str(erro))
        if not ips:
            raise ErroFerramenta("dns_falhou", "Não consegui encontrar esse site.")
        for ip in ips:
            if not ip_e_publico(ip):
                raise ErroFerramenta(
                    "bloqueado_endereco_interno",
                    "Só leio endereços públicos da internet. Este endereço é interno ou reservado.",
                    f"host={endereco.host} ip={ip}",
                )
        return list(ips)

    def _requisitar(self, endereco: Endereco, ips: List[str], fim: float):
        bruto: Optional[socket.socket] = None
        ultimo_erro = ""
        for ip in ips:  # só IPs já conferidos; o nome nunca é resolvido de novo
            restante = fim - time.monotonic()
            if restante <= 0:
                raise ErroFerramenta("tempo_esgotado", "O site demorou demais para responder.")
            try:
                bruto = self.conector(ip, endereco.porta, restante)
                break
            except OSError as erro:
                ultimo_erro = str(erro)
        if bruto is None:
            raise ErroFerramenta("conexao_falhou", "Não consegui conectar ao site.", ultimo_erro)
        sock = bruto
        try:
            if endereco.esquema == "https":
                contexto = self.contexto_ssl or ssl.create_default_context()
                bruto.settimeout(max(fim - time.monotonic(), 0.001))
                try:
                    sock = contexto.wrap_socket(bruto, server_hostname=endereco.host)
                except ssl.SSLCertVerificationError as erro:
                    raise ErroFerramenta("certificado_invalido", "O certificado do site não é confiável.", str(erro))
                except ssl.SSLError as erro:
                    raise ErroFerramenta("falha_tls", "Falha na conexão segura com o site.", str(erro))
                except (socket.timeout, TimeoutError):
                    raise ErroFerramenta("tempo_esgotado", "O site demorou demais para responder.")
                except OSError as erro:
                    raise ErroFerramenta("falha_de_rede", "A conexão com o site caiu.", str(erro))
            pedido = (
                f"GET {endereco.caminho} HTTP/1.1\r\n"
                f"Host: {endereco.cabecalho_host}\r\n"
                f"User-Agent: {USER_AGENT}\r\n"
                "Accept: text/html,text/plain;q=0.9,*/*;q=0.1\r\n"
                "Accept-Encoding: gzip, identity\r\n"
                "Connection: close\r\n\r\n"
            ).encode("ascii")
            try:
                sock.settimeout(max(fim - time.monotonic(), 0.001))
                sock.sendall(pedido)
            except (socket.timeout, TimeoutError):
                raise ErroFerramenta("tempo_esgotado", "O site demorou demais para responder.")
            except OSError as erro:
                raise ErroFerramenta("falha_de_rede", "A conexão com o site caiu.", str(erro))
            canal = _Canal(sock, fim)
            status, cabecalhos = _ler_cabecalhos(canal)
            if status in STATUS_DE_REDIRECIONAMENTO or not 200 <= status < 300:
                return status, cabecalhos, b""
            corpo = _ler_corpo(canal, cabecalhos, self.params.max_bytes)
            corpo = _descomprimir(corpo, cabecalhos.get("content-encoding", ""), self.params.max_bytes)
            return status, cabecalhos, corpo
        finally:
            for conexao in {id(sock): sock, id(bruto): bruto}.values():
                try:
                    conexao.close()
                except OSError:
                    pass
