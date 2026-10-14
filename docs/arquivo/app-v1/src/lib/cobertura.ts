export type ColunaCobertura = { nome: string; tipo: string; mapeado: boolean };
export type FonteCobertura = {
  tabela: string; tipo: "tabela" | "view"; rls: boolean; security_invoker: boolean;
  registros: number | null; erro: string | null; politicas_leitura: number; colunas: ColunaCobertura[];
};
export type AuditoriaCobertura = {
  verificado_em: string; fontes: FonteCobertura[]; campos_obsoletos: number;
  checkpoint: { id: string; versao: number; atualizado_em: string } | null;
  divergencias_checkpoint: { tabela: string; checkpoint: number; atual: number }[];
  integridade: Record<string, number>;
};

export function fonteLegivel(fonte: FonteCobertura) {
  return !fonte.erro && fonte.registros !== null &&
    (fonte.tipo === "view" ? fonte.security_invoker : fonte.rls && fonte.politicas_leitura > 0);
}

export function resumoCobertura(auditoria: AuditoriaCobertura) {
  const colunas = auditoria.fontes.flatMap(f => f.colunas);
  const mapeadas = colunas.filter(c => c.mapeado).length;
  return {
    fontes: auditoria.fontes.length,
    legiveis: auditoria.fontes.filter(fonteLegivel).length,
    campos: colunas.length, mapeados: mapeadas,
    percentual: colunas.length ? Math.floor(mapeadas / colunas.length * 100) : null,
    falhasVinculos: Object.values(auditoria.integridade).reduce((s, n) => s + n, 0),
  };
}

export const NOMES_VINCULOS: Record<string, string> = {
  jobs_sem_tarefa: "Jobs que referenciam tarefa inexistente",
  jobs_sem_agente: "Jobs com agente cadastrado",
  eventos_sem_job: "Eventos vinculados a jobs existentes",
  tarefas_sem_projeto: "Projetos referenciados pelas tarefas",
  tarefas_sem_empresa: "Empresas referenciadas pelas tarefas",
  jobs_empresa_divergente: "Mesma empresa na tarefa e no job",
  eventos_empresa_divergente: "Mesma empresa no job e no evento",
};
