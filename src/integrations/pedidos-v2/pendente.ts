import { uuidValido, validarEnvioPedido, type EnvioPedido } from './repository';

const prefixo = 'helena-v2-entrada:';
function chave(identidade: string) { return `${prefixo}${identidade}`; }
export function lerPedidoPendente(identidade: string, storage: Storage): EnvioPedido | null {
  const texto = storage.getItem(chave(identidade));
  if (texto === null) return null;
  const valor: unknown = JSON.parse(texto);
  if (!valor || typeof valor !== 'object' || Array.isArray(valor)) throw new Error('Recibo local inválido.');
  const dado = valor as Record<string, unknown>;
  if (typeof dado.requestId !== 'string' || typeof dado.eventoId !== 'string' || typeof dado.texto !== 'string') {
    throw new Error('Recibo local inválido.');
  }
  const envio = { requestId: dado.requestId, eventoId: dado.eventoId, texto: dado.texto };
  validarEnvioPedido(envio);
  return envio;
}
export function salvarPedidoPendente(identidade: string, envio: EnvioPedido, storage: Storage) {
  validarEnvioPedido(envio);
  storage.setItem(chave(identidade), JSON.stringify(envio));
}
export function apagarPedidoPendente(identidade: string, storage: Storage) { storage.removeItem(chave(identidade)); }
export function guardarUltimoPedido(identidade: string, requestId: string, storage: Storage) {
  if (!uuidValido(requestId)) throw new Error('Identificador inválido.');
  storage.setItem(`helena-v2-ultimo-pedido:${identidade}`, requestId);
}
export function lerUltimoPedido(identidade: string, storage: Storage) {
  const valor = storage.getItem(`helena-v2-ultimo-pedido:${identidade}`);
  return valor && uuidValido(valor) ? valor : '';
}

function chaveEsclarecimento(identidade: string, requestId: string) {
  if (!uuidValido(requestId)) throw new Error('Identificador inválido.');
  return `helena-v2-esclarecimento:${identidade}:${requestId}`;
}
export function lerEsclarecimentoPendente(identidade: string, requestId: string, storage: Storage): EnvioPedido | null {
  const texto = storage.getItem(chaveEsclarecimento(identidade, requestId));
  if (texto === null) return null;
  const valor: unknown = JSON.parse(texto);
  if (!valor || typeof valor !== 'object' || Array.isArray(valor)) throw new Error('Esclarecimento local inválido.');
  const dado = valor as Record<string, unknown>;
  if (dado.requestId !== requestId || typeof dado.eventoId !== 'string'
      || !dado.eventoId.startsWith('site:esclarecimento:') || typeof dado.texto !== 'string') {
    throw new Error('Esclarecimento local inválido.');
  }
  const envio = { requestId, eventoId: dado.eventoId, texto: dado.texto };
  validarEnvioPedido(envio);
  return envio;
}
export function salvarEsclarecimentoPendente(identidade: string, envio: EnvioPedido, storage: Storage) {
  validarEnvioPedido(envio);
  if (!envio.eventoId.startsWith('site:esclarecimento:')) throw new Error('Identificador de esclarecimento inválido.');
  storage.setItem(chaveEsclarecimento(identidade, envio.requestId), JSON.stringify(envio));
}
export function apagarEsclarecimentoPendente(identidade: string, requestId: string, storage: Storage) {
  storage.removeItem(chaveEsclarecimento(identidade, requestId));
}
