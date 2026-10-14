"""Molde de adaptador para um runtime NOVO (EVE, OpenClaw ou outro). FALHA FECHADO e nunca roda nada.

O que é: o ponto de partida de quem vai escrever o adaptador de um runtime que ainda não tem um. Ele já cumpre
a forma do contrato `Executor` (rodar, cancelar, limpar e capacidades), mas não fala com runtime nenhum:
  - `rodar` devolve SEMPRE um Resultado de falha DESCONHECIDA, código ADAPTADOR_NAO_IMPLEMENTADO, sem texto;
  - `cancelar` devolve False (não há execução nenhuma para cancelar);
  - `limpar` não faz nada (não apaga arquivo nenhum);
  - `capacidades` declara TODAS as garantias como não cumpridas; por isso o registro (registro.py) o recusa.

Segurança: esta classe NÃO está em `registro.APROVADOS` e nunca deve ser acrescentada lá (um teste confere).
Este módulo não importa nada de rede nem de processo por conta própria, não lê variável de ambiente e não toca em disco.

Como usar como molde (resumo; o passo a passo está em motor/executor/README.md):
  1. copie este arquivo para um módulo novo e troque `AdaptadorNaoConfirmado` pelo nome do runtime;
  2. leia a documentação oficial ATUAL do runtime e responda, uma a uma, as perguntas de PERGUNTAS_POR_GARANTIA;
     o que não estiver confirmado continua False e fica marcado NÃO CONFIRMADO no código e nos testes;
  3. só passe uma garantia para True quando houver teste de conformidade provando (testes/test_conformidade.py);
  4. só então acrescente um `Adaptador` a `registro.APROVADOS`, com revisão e "dia de prova" (README).
"""

from typing import Mapping

from .executor import Executor
from .tipos import (DESCONHECIDA, Capacidades, Conferencia, Execucao, Falha, Problema, RegistroDeUso,
                    Resultado)

CODIGO_ADAPTADOR_NAO_IMPLEMENTADO = "ADAPTADOR_NAO_IMPLEMENTADO"
NOME_DO_MOLDE = "nao-confirmado"

# O que o autor de um adaptador precisa responder (com a fonte oficial) para cada campo de `Capacidades`.
# Um teste confere que há uma pergunta para cada campo, nem mais nem menos: se `Capacidades` ganhar um campo
# novo, o teste obriga a escrever a pergunta aqui.
PERGUNTAS_POR_GARANTIA: Mapping[str, str] = {
    "nome": "Qual nome curto e estável (minúsculas, até 32 caracteres) vai em HELENA_V2_EXECUTOR?",
    "cancela_em_ate_s": "Como se encerra uma execução em andamento e a documentação (ou o nosso teste) garante "
                        "que termina em até 15 s, sem processo sobrando?",
    "ferramentas_por_extenso": "Como passar a lista EXATA de ferramentas (lista vazia = nenhuma) e como provar, "
                               "depois, quais ferramentas o modelo realmente recebeu?",
    "confere_modelo_e_provedor": "Qual registro gravado pelo PRÓPRIO runtime diz qual modelo e qual provedor "
                                 "rodaram em cada chamada?",
    "sem_reserva_escondida": "Como garantir que o runtime nunca troca de modelo, de provedor nem de conta "
                             "sozinho (fallback, rotação de credencial, roteador)?",
    "limita_chamadas": "Como cortar o laço de chamadas pelo orçamento da ficha: o runtime tem limite próprio "
                       "de chamadas ou o adaptador conta no registro e cancela?",
    "falha_vem_do_registro": "Em que registro do runtime está o motivo da falha (cota, login, queda, tempo...) "
                             "para classificá-la sem ler o texto do agente?",
    "guarda_conversa": "De onde sai a conversa completa (mensagens e chamadas de ferramenta) para o motor "
                       "guardar antes de limpar?",
}


class AdaptadorNaoConfirmado(Executor):
    """Executor que não executa: serve de molde e de teste de que a porta falha fechada."""

    capacidades = Capacidades(
        nome=NOME_DO_MOLDE, cancela_em_ate_s=0.0, ferramentas_por_extenso=False, confere_modelo_e_provedor=False,
        sem_reserva_escondida=False, limita_chamadas=False, falha_vem_do_registro=False, guarda_conversa=False)

    def __init__(self, runtime: str = "runtime"):
        """`runtime`: nome do runtime que o molde ainda não implementa; só aparece na frase do aviso."""
        if not isinstance(runtime, str) or not runtime.replace("-", "").replace("_", "").isalnum() or len(runtime) > 32:
            raise ValueError("nome do runtime inválido: use letras, números, hífen ou sublinhado (até 32).")
        self.runtime = runtime

    def rodar(self, execucao: Execucao) -> Resultado:
        """Não lança nada e não lê a execução. Devolve falha DESCONHECIDA, sem texto, para qualquer entrada."""
        detalhe = f"o adaptador de {self.runtime} ainda não foi implementado; nada foi executado"
        problema = Problema(DESCONHECIDA, CODIGO_ADAPTADOR_NAO_IMPLEMENTADO, detalhe)
        return Resultado(
            texto=None, terminou_inteira=False, uso=RegistroDeUso(), codigo_de_saida=None, ferramentas_recebidas=(),
            modelo_usado=None, provedor_usado=None, tempo_s=0.0,
            falha=Falha(DESCONHECIDA, CODIGO_ADAPTADOR_NAO_IMPLEMENTADO, detalhe),
            conferencia=Conferencia((problema,)), pasta=None)

    def cancelar(self, id_da_execucao: str) -> bool:
        """Nunca há execução em andamento neste molde."""
        return False

    def limpar(self, resultado: Resultado) -> None:
        """Nada a apagar: o molde não cria pasta nem arquivo. Idempotente."""
        return None
