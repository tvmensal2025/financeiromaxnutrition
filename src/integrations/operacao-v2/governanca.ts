import type { RepositorioConfigV2 } from '@/integrations/config-v2/repository';
import { lerCatalogoAtivo, type CatalogoV2 } from './catalogo';

export type CheckpointResumo = { id: string; versao: string; estado: string; atualizadoEm: string | null };
export type DecisaoResumo = { id: string; estado: string; data: string | null; escopo: string | null };
export interface RepositorioGovernancaV2 {
  checkpoint(): Promise<CheckpointResumo | null>;
  decisoes(): Promise<DecisaoResumo[]>;
}

type Resposta = { data: unknown; error: { message: string } | null };
type Consulta = PromiseLike<Resposta> & { limit(numero: number): Consulta; order(campo: string, opcoes?: { ascending: boolean }): Consulta };
type Cliente = { from(tabela: string): { select(colunas: string): Consulta } };
function texto(valor: unknown): string { return typeof valor === 'string' ? valor : typeof valor === 'number' ? String(valor) : ''; }
function objeto(valor: unknown): Record<string, unknown> | null { return valor && typeof valor === 'object' && !Array.isArray(valor) ? valor as Record<string, unknown> : null; }
async function ler(consulta: Consulta): Promise<unknown> { const { data, error } = await consulta; if (error) throw new Error('Leitura de governança indisponível.'); return data; }

export function criarRepositorioGovernancaV2(cliente: Cliente): RepositorioGovernancaV2 {
  return {
    async checkpoint() {
      // Projeção explícita: jamais consulta o snapshot integral ou contexto de memória.
      const dados = await ler(cliente.from('checkpoint_mestre_atual').select('checkpoint_id,versao,status,atualizado_em').limit(2));
      if (!Array.isArray(dados) || dados.length > 1) throw new Error('Checkpoint atual ambíguo.');
      if (!dados.length) return null;
      const linha = objeto(dados[0]);
      if (!linha || !texto(linha.checkpoint_id)) throw new Error('Checkpoint atual inválido.');
      return { id: texto(linha.checkpoint_id), versao: texto(linha.versao), estado: texto(linha.status), atualizadoEm: texto(linha.atualizado_em) || null };
    },
    async decisoes() {
      // Só metadados necessários para localização e estado. Texto/motivo/evidência não saem do banco.
      const dados = await ler(cliente.from('decisoes').select('decision_id,status,data_hora,escopo').order('data_hora', { ascending: false }).limit(30));
      if (!Array.isArray(dados)) throw new Error('Lista de decisões inválida.');
      return dados.map(valor => {
        const linha = objeto(valor);
        if (!linha || !texto(linha.decision_id)) throw new Error('Decisão inválida.');
        return { id: texto(linha.decision_id), estado: texto(linha.status) || 'NÃO INFORMADO', data: texto(linha.data_hora) || null, escopo: texto(linha.escopo) || null };
      });
    },
  };
}

export async function repositorioGovernancaV2DoApp(): Promise<RepositorioGovernancaV2> {
  const { supabase } = await import('@/lib/supabase');
  return criarRepositorioGovernancaV2(supabase as unknown as Cliente);
}

export async function lerRevisaoGovernanca(repo: RepositorioConfigV2): Promise<CatalogoV2> {
  return lerCatalogoAtivo(repo);
}
