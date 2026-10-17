/**
 * O que é: gancho que entrega `DadosComando` às abas da Sala de comando v2.
 * Como mudar: ESTE É UM ESQUELETO. O pedaço 2 (camada de dados) substitui o arquivo inteiro, mantendo o nome do export
 * `useDadosComando` e o tipo `UsarDadosComando` de ./tipos.
 */
import { dadosVazios, type UsarDadosComando } from './tipos';

export const useDadosComando: UsarDadosComando = () => ({
  dados: dadosVazios(), carregando: true, atualizadoEm: null, recarregar: () => undefined,
});
