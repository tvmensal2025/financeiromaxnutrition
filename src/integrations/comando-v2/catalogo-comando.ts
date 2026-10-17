/**
 * O que é: o catálogo que a Sala de comando usa (empresas, agentes com identidade e serviços) lido da revisão ATIVA e
 * VALIDADA da configuração (helena-v2/organograma.yaml e servicos.yaml dentro de `conteudo`).
 * Como mudar: formato inesperado lança erro claro; a tela mostra o erro, nunca um catálogo vazio falso.
 * Não altera operacao-v2/catalogo.ts: só reaproveita `catalogoDaConfig` para validar e extrair os serviços.
 */
import type { ConfigDetail, RepositorioConfigV2 } from '@/integrations/config-v2/repository';
import { catalogoDaConfig } from '@/integrations/operacao-v2/catalogo';
import type { AgenteComando, CatalogoComando, EmpresaComando } from './tipos';

function objeto(valor: unknown): Record<string, unknown> | null {
  return valor !== null && typeof valor === 'object' && !Array.isArray(valor) ? valor as Record<string, unknown> : null;
}
const txt = (valor: unknown): string => (typeof valor === 'string' ? valor.trim() : '');

export function catalogoComando(detalhe: ConfigDetail): CatalogoComando {
  // Valida organograma (lista de agentes) e servicos (lança erro claro) e entrega os serviços no formato do contrato.
  const base = catalogoDaConfig(detalhe);
  const organograma = objeto(detalhe.conteudo['helena-v2/organograma.yaml']);
  if (!organograma) throw new Error('A revisão ativa não contém helena-v2/organograma.yaml em formato consultável.');
  const mapaEmpresas = objeto(organograma.empresas);
  if (!mapaEmpresas) throw new Error('A revisão ativa não contém o mapa de empresas.');
  const empresas: EmpresaComando[] = Object.entries(mapaEmpresas).map(([id, valor]) => {
    const empresa = objeto(valor);
    if (!empresa || !txt(empresa.nome)) throw new Error(`A empresa ${id} da revisão ativa não tem nome.`);
    return { id, nome: txt(empresa.nome), pacote: txt(objeto(empresa.pacote)?.estado) || 'NÃO INFORMADO' };
  });
  if (empresas.length === 0) throw new Error('A revisão ativa não lista nenhuma empresa.');
  const agentes: AgenteComando[] = (organograma.agentes as unknown[]).map((valor, indice) => {
    const agente = objeto(valor);
    const identidade = txt(agente?.identidade);
    if (!agente || !identidade) throw new Error(`O agente ${indice + 1} da revisão ativa não tem identidade.`);
    const fase = txt(agente.fase_de_ativacao);
    return {
      id: txt(agente.id) || `agente-${indice + 1}`, identidade, nome: txt(agente.nome) || identidade,
      cargo: txt(agente.cargo), grupo: txt(agente.grupo), estado: txt(agente.estado) || 'NÃO INFORMADO',
      ...(fase ? { fase } : {}),
    };
  });
  if (agentes.length === 0) throw new Error('A revisão ativa não lista nenhum agente.');
  return { revisao: base.revisao, empresas, agentes, servicos: base.servicos };
}

/** Exatamente 1 revisão ativa e VALIDADA, conferida de novo no detalhe para detectar troca no meio da leitura. */
export async function lerCatalogoComandoAtivo(repo: RepositorioConfigV2): Promise<CatalogoComando> {
  const ativas = (await repo.listar()).filter(revisao => revisao.ativa);
  if (ativas.length !== 1 || ativas[0].estado !== 'VALIDADA') throw new Error('Não há exatamente uma revisão ativa e validada.');
  const ativa = ativas[0];
  const detalhe = await repo.ler(ativa.id);
  if (detalhe.id !== ativa.id || detalhe.versao !== ativa.versao || !detalhe.ativa || detalhe.estado !== 'VALIDADA' || detalhe.hash_sha256 !== ativa.hash_sha256) {
    throw new Error('A revisão ativa mudou durante a leitura. Atualize a página.');
  }
  return catalogoComando(detalhe);
}
