"""A interface do alvo: aquilo que o simulador testa.

Hoje há dois alvos: a Referencia (referencia.py, própria e pequena) e a máquina de passagens
real via replay (adaptador_maquina.py). Para ligar o motor real depois, escreva uma classe
com estes três métodos e passe para execucao.rodar(). O resto não muda.
"""


class Alvo:
    nome = "alvo"

    def iniciar(self, roteiro, pedido_grande=True):
        """Começa um card novo (estado RASCUNHO) com este roteiro."""
        raise NotImplementedError

    def aplicar(self, evento):
        """Aplica UM evento e devolve uma Resposta. Eventos do motor que andam sozinhos
        (iniciar execução, plano válido, card pronto...) o alvo dispara por conta própria
        e conta na Resposta.automaticos."""
        raise NotImplementedError

    def foto(self):
        """O estado atual, como uma Foto."""
        raise NotImplementedError

    def encerrar(self):
        """Conferências finais do próprio alvo. Devolve ((regra, mensagem), ...). Pode ser vazio."""
        return ()
