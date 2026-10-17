import type { ConfigBundle, ConfigDetail, RepositorioConfigV2 } from '@/integrations/config-v2/repository';

export type AgenteCatalogo = { id: string; nome: string; cargo: string; grupo: string; escopo: string; estado: string; fase: string };
export type ServicoCatalogo = { id: string; nome: string; dono: string; revisor: string; estado: string; empresas: string[] };
export type CatalogoV2 = { revisao: string; versao: number; hash: string | null; agentes: AgenteCatalogo[]; servicos: ServicoCatalogo[] };

function objeto(valor: unknown): Record<string, unknown> | null {
  return valor !== null && typeof valor === 'object' && !Array.isArray(valor) ? valor as Record<string, unknown> : null;
}
function txt(valor: unknown): string { return typeof valor === 'string' ? valor.trim() : ''; }
function lista(valor: unknown): Record<string, unknown>[] {
  return Array.isArray(valor) ? valor.map(objeto).filter((item): item is Record<string, unknown> => item !== null) : [];
}
function documento(conteudo: ConfigBundle, caminho: string): Record<string, unknown> {
  const valor = objeto(conteudo[caminho]);
  if (!valor) throw new Error(`A revisão ativa não contém ${caminho} em formato consultável.`);
  return valor;
}

export function catalogoDaConfig(detalhe: ConfigDetail): CatalogoV2 {
  const organograma = documento(detalhe.conteudo, 'helena-v2/organograma.yaml');
  const servicosDocumento = documento(detalhe.conteudo, 'helena-v2/servicos.yaml');
  const agentes = lista(organograma.agentes).map((agente, indice) => ({
    id: txt(agente.id) || `agente-${indice + 1}`, nome: txt(agente.nome) || txt(agente.identidade) || 'Sem nome',
    cargo: txt(agente.cargo), grupo: txt(agente.grupo), escopo: txt(agente.escopo),
    estado: txt(agente.estado) || 'NÃO INFORMADO', fase: txt(agente.fase_de_ativacao),
  }));
  if (!Array.isArray(organograma.agentes)) throw new Error('A revisão ativa não contém a lista de agentes.');
  const servicos = lista(servicosDocumento.servicos).map((servico, indice) => ({
    id: txt(servico.id) || `servico-${indice + 1}`, nome: txt(servico.nome) || 'Sem nome',
    dono: txt(servico.dono), revisor: txt(servico.revisor), estado: txt(servico.estado) || 'NÃO INFORMADO',
    empresas: Array.isArray(servico.empresas) ? servico.empresas.map(txt).filter(Boolean) : [],
  }));
  if (!Array.isArray(servicosDocumento.servicos)) throw new Error('A revisão ativa não contém a lista de serviços.');
  return { revisao: detalhe.nome, versao: detalhe.versao, hash: detalhe.hash_sha256, agentes, servicos };
}

export async function lerCatalogoAtivo(repo: RepositorioConfigV2): Promise<CatalogoV2> {
  const revisoes = await repo.listar();
  const ativas = revisoes.filter(revisao => revisao.ativa);
  if (ativas.length !== 1 || ativas[0].estado !== 'VALIDADA') throw new Error('Não há exatamente uma revisão ativa e validada.');
  const ativa = ativas[0];
  const detalhe = await repo.ler(ativa.id);
  if (detalhe.id !== ativa.id || detalhe.versao !== ativa.versao || !detalhe.ativa || detalhe.estado !== 'VALIDADA' || detalhe.hash_sha256 !== ativa.hash_sha256) {
    throw new Error('A revisão ativa mudou durante a leitura. Atualize a página.');
  }
  return catalogoDaConfig(detalhe);
}
