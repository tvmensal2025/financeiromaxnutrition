/**
 * O que é: transforma o conteúdo de uma entrega aprovada (JSON do banco) em linhas legíveis e prepara o texto para copiar.
 * ATENÇÃO, DUPLICAÇÃO CONSCIENTE: `linhasDaEntrega` é cópia da função privada de src/pages/CardV2Page.tsx. A cópia existe para
 * a Sala de comando não depender de arquivos que outro trabalho edita. Se a regra mudar lá, mude aqui também (ou
 * exporte a original e apague esta cópia).
 * Como mudar: mantenha o laço iterativo (sem recursão) para suportar JSON profundo.
 */
export type LinhaEntrega = { rotulo: string; valor: string };

export function linhasDaEntrega(conteudo: unknown): LinhaEntrega[] {
  const pendentes = [{ valor: conteudo, caminho: '' }];
  const linhas: LinhaEntrega[] = [];
  while (pendentes.length) {
    const { valor, caminho } = pendentes.pop()!;
    if (Array.isArray(valor) && valor.length) {
      for (let i = valor.length - 1; i >= 0; i--) pendentes.push({ valor: valor[i], caminho: `${caminho} ${i + 1}`.trim() });
    } else if (valor && typeof valor === 'object' && Object.keys(valor).length) {
      const campos = Object.entries(valor);
      for (let i = campos.length - 1; i >= 0; i--) {
        const [chave, item] = campos[i];
        pendentes.push({ valor: item, caminho: `${caminho} ${chave.replace(/_/g, ' ')}`.trim() });
      }
    } else {
      linhas.push({ rotulo: caminho || 'Texto', valor: valor === null ? 'nulo' : Array.isArray(valor) || typeof valor === 'object' ? 'vazio' : String(valor) });
    }
  }
  return linhas;
}

/** Texto para a área de transferência: "rótulo: valor" por linha; texto simples sai sem rótulo. */
export function textoParaCopiar(linhas: LinhaEntrega[]): string {
  if (linhas.length === 1 && linhas[0].rotulo === 'Texto') return linhas[0].valor;
  return linhas.map(l => `${l.rotulo}: ${l.valor}`).join('\n');
}

/**
 * Copia o texto. Tenta a API moderna e, se ela não existir ou for recusada, usa o método antigo com um campo oculto.
 * Devolve true só quando alguma das duas formas funcionou.
 */
export async function copiarTexto(texto: string): Promise<boolean> {
  try {
    if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(texto);
      return true;
    }
  } catch { /* cai para o método antigo */ }
  if (typeof document === 'undefined' || typeof document.execCommand !== 'function') return false;
  const campo = document.createElement('textarea');
  campo.value = texto;
  campo.setAttribute('readonly', '');
  campo.setAttribute('aria-hidden', 'true');
  campo.style.position = 'fixed';
  campo.style.opacity = '0';
  campo.style.pointerEvents = 'none';
  document.body.appendChild(campo);
  try {
    campo.select();
    return document.execCommand('copy');
  } catch {
    return false;
  } finally {
    document.body.removeChild(campo);
  }
}
