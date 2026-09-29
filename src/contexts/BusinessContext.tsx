import React, { createContext, useContext, useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "@/lib/supabase";
import { escreverRegistro } from '@/lib/escrita-protegida';
import { useAuth } from "@/auth";

export type Empresa = {
  row_version?: number | string;
  id: string; // chave canônica business_id: BIZ-001, BIZ-002, BIZ-003, etc.
  business_id: string;
  nome: string;
  negocio: string;
  sigla: string;
  cor: string;
  estagio?: string;
  principal_gargalo?: string;
  ativo?: string;
  publico?: string;
};

const CORES: Record<string, string> = {
  "BIZ-001": "#007A3D",
  "BIZ-002": "#2563EB",
  "BIZ-003": "#B45309",
  "GRUPO": "#4F46E5",
};

const CORES_EXTRA = ["#0F766E", "#7C3AED", "#BE123C", "#0369A1", "#D97706"];
const CHAVE_STORAGE = "helena_active_business_id";
const CHAVE_LEGADA = "helena_empresas_ligadas";

export const TABELAS_COM_BUSINESS_ID: Array<[string, string]> = [
  ["atendimento", "business_id"],
  ["ativos", "business_id"],
  ["automacoes", "business_id"],
  ["calendario", "business_id"],
  ["clientes", "business_id"],
  ["comunicacoes", "business_id"],
  ["consentimentos", "business_id"],
  ["contas_financeiras", "business_id"],
  ["contratos", "business_id"],
  ["crm", "business_id"],
  ["decisoes", "business_id"],
  ["documentos", "business_id"],
  ["dre_mensal", "business_id"],
  ["financeiro", "business_id"],
  ["fluxo_caixa", "business_id"],
  ["fornecedores", "business_id"],
  ["ideias", "business_id"],
  ["incidentes", "business_id"],
  ["integracoes", "business_id"],
  ["marcos", "business_id"],
  ["marketing", "business_id"],
  ["metas_kpis", "business_id"],
  ["obrigacoes", "business_id"],
  ["orcamento", "business_id"],
  ["portfolio", "business_id"],
  ["processos", "business_id"],
  ["produto", "business_id"],
  ["projetos", "business_id"],
  ["recorrencias", "business_id"],
  ["riscos", "business_id"],
  ["sync_log", "business_id"],
  ["tarefas", "business_id"],
  ["task_activity", "business_id"],
  ["memoria_mestre", "business_id_area"],
  ["handoffs", "business_id"],
];

export const EMPRESAS_BASE: Empresa[] = [
  {
    id: "BIZ-001",
    business_id: "BIZ-001",
    nome: "iGreen Energy",
    negocio: "iGreen Energy",
    sigla: "iGreen",
    cor: "#007A3D",
    estagio: "VENDAS",
    principal_gargalo: "Comercial / conseguir clientes.",
  },
  {
    id: "BIZ-002",
    business_id: "BIZ-002",
    nome: "Ecossistema de Saúde",
    negocio: "Ecossistema de Saúde",
    sigla: "Saúde & Nutrição",
    cor: "#2563EB",
    estagio: "PRODUTO",
    principal_gargalo: "Escopo amplo ainda não consolidado.",
  },
  {
    id: "BIZ-003",
    business_id: "BIZ-003",
    nome: "Humano Digital",
    negocio: "Humano Digital",
    sigla: "Humano Digital",
    cor: "#B45309",
    estagio: "VALIDAÇÃO",
    principal_gargalo: "Aquisição e ativação de pessoas com rastreamento confiável até a comissão recebida.",
  },
];

function siglaDe(nome: string) {
  const texto = nome.trim();
  if (/igreen/i.test(texto)) return "iGreen";
  if (/sa[uú]de|max|nutrition|refit/i.test(texto)) return "Saúde & Nutrição";
  if (/humano/i.test(texto)) return "Humano Digital";
  if (texto.length <= 25) return texto;
  return `${texto.slice(0, 22)}…`;
}

function corDe(id: string, indice: number) {
  return CORES[id] || CORES_EXTRA[indice % CORES_EXTRA.length];
}

export type BusinessContextType = {
  // Canônico conforme especificação Helena
  currentBusiness: Empresa | null;
  currentBusinessId: string;
  businesses: Empresa[];
  empresas: Empresa[]; // alias retrocompatível
  setCurrentBusiness: (businessId: string) => void;
  selecionarEmpresa: (businessId: string) => void; // alias
  loading: boolean;
  carregandoEmpresas: boolean; // alias retrocompatível
  error: string | null;
  isConsolidated: boolean;

  // Propriedades retrocompatíveis para componentes existentes
  selecionadas: string[];
  todasLigadas: boolean;
  rotulo: string;
  alternar: (id: string) => void;
  ligarTodas: () => void;
  incluirEmpresa: (nome: string) => Promise<string>;
  tirarEmpresa: (id: string) => Promise<string>;
  pertence: (businessId?: string | null) => boolean;
  nomeDe: (id?: string | null) => string;
};

const BusinessContext = createContext<BusinessContextType | undefined>(undefined);

export function BusinessProvider({ children }: { children: React.ReactNode }) {
  const { user, loading: authLoading } = useAuth();
  const [empresas, setEmpresas] = useState<Empresa[]>([]);
  const [currentBusinessId, setCurrentBusinessIdState] = useState<string>("GRUPO");
  const versaoConsulta = useRef(0);
  const [carregandoEmpresas, setCarregandoEmpresas] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Valida o id salvo no localStorage contra a lista permitida
  const validarSalva = (idCandidato: string | null, lista: Empresa[]): string => {
    if (!idCandidato) return "GRUPO";
    if (idCandidato === "GRUPO") return "GRUPO";
    const existe = lista.some((e) => e.id === idCandidato || e.business_id === idCandidato);
    return existe ? idCandidato : "GRUPO";
  };

  const carregarEmpresas = async (selecionarAposCarga?: string) => {
    const versao = ++versaoConsulta.current;
    setCarregandoEmpresas(true);
    setError(null);

    try {
      const { data, error: err } = await supabase
        .from("portfolio")
        .select("business_id,negocio,estagio,principal_gargalo,ativo,publico,row_version")
        .order("business_id");
      if (versao !== versaoConsulta.current) return;

      let listaMapeada: Empresa[] = [];

      if (!err && data && data.length > 0) {
        listaMapeada = (data as Array<{
          business_id: string;
          row_version?: number | string;
          negocio: string | null;
          estagio?: string | null;
          principal_gargalo?: string | null;
          ativo?: string | null;
          publico?: string | null;
        }>)
          .filter((item) => item.business_id && item.business_id !== "GRUPO")
          .map((item, indice) => ({
            id: item.business_id,
            row_version: item.row_version,
            business_id: item.business_id,
            nome: (item.negocio || item.business_id).trim(),
            negocio: (item.negocio || item.business_id).trim(),
            sigla: siglaDe(item.negocio || item.business_id),
            cor: corDe(item.business_id, indice),
            estagio: item.estagio || undefined,
            principal_gargalo: item.principal_gargalo || undefined,
            ativo: item.ativo || undefined,
            publico: item.publico || undefined,
          }));
      }

      // Falha de leitura nunca deve apresentar empresas de exemplo como dados reais.
      if (err) throw err;
      const listaFinal = listaMapeada;
      setEmpresas(listaFinal);

      // Recuperar última empresa selecionada válida
      let idInicial: string | null = selecionarAposCarga || null;
      if (!idInicial) {
        try {
          idInicial = localStorage.getItem(CHAVE_STORAGE);
          if (!idInicial) {
            // Tenta migrar do formato antigo se existir
            const antigo = JSON.parse(localStorage.getItem(CHAVE_LEGADA) || "null");
            if (Array.isArray(antigo) && antigo.length === 1) {
              idInicial = antigo[0];
            } else if (Array.isArray(antigo) && antigo.length > 1) {
              idInicial = "GRUPO";
            }
          }
        } catch {
          idInicial = null;
        }
      }

      const idValidado = validarSalva(idInicial, listaFinal);
      setCurrentBusinessIdState(idValidado);
      try { localStorage.setItem(CHAVE_STORAGE, idValidado); } catch { /* Preferência opcional. */ }
    } catch (e: any) {
      if (versao !== versaoConsulta.current) return;
      setError(e?.message || "Erro ao carregar empresas");
      setEmpresas([]);
      setCurrentBusinessIdState("GRUPO");
    } finally {
      if (versao === versaoConsulta.current) setCarregandoEmpresas(false);
    }
  };

  useEffect(() => {
    if (authLoading) return;
    if (user) void carregarEmpresas();
    else { setEmpresas([]); setCurrentBusinessIdState("GRUPO"); setCarregandoEmpresas(false); }
    return () => { versaoConsulta.current++; };
  }, [user?.id, authLoading]);

  const setCurrentBusiness = (id: string) => {
    const idValidado = validarSalva(id, empresas);
    setCurrentBusinessIdState(idValidado);
    try {
      localStorage.setItem(CHAVE_STORAGE, idValidado);
      // Mantém retrocompatibilidade para componentes que leiam CHAVE_LEGADA
      if (idValidado === "GRUPO") {
        localStorage.setItem(CHAVE_LEGADA, JSON.stringify(empresas.map((e) => e.id)));
      } else {
        localStorage.setItem(CHAVE_LEGADA, JSON.stringify([idValidado]));
      }
    } catch {
      // Ignora erro de storage restrito
    }
  };

  const isConsolidated = currentBusinessId === "GRUPO";
  const todasLigadas = isConsolidated;

  const currentBusiness = useMemo(() => {
    if (isConsolidated) {
      return {
        id: "GRUPO",
        business_id: "GRUPO",
        nome: "Todas as Empresas (Grupo)",
        negocio: "Todas as Empresas (Grupo)",
        sigla: "Grupo Consolidado",
        cor: "#4F46E5",
        estagio: "CONSOLIDADO",
        principal_gargalo: "Alinhamento e sinergia entre operações",
      };
    }
    return empresas.find((e) => e.id === currentBusinessId) || empresas[0] || null;
  }, [currentBusinessId, empresas, isConsolidated]);

  const selecionadas = useMemo(() => {
    if (isConsolidated) {
      return empresas.map((e) => e.id);
    }
    return [currentBusinessId];
  }, [isConsolidated, currentBusinessId, empresas]);

  const rotulo = useMemo(() => {
    if (isConsolidated) return "Todas as empresas (Grupo)";
    return currentBusiness?.sigla || currentBusiness?.nome || "Empresa selecionada";
  }, [isConsolidated, currentBusiness]);

  const alternar = (id: string) => {
    // Ao alternar em modelo multiempresa, define a empresa clicada como ativa
    if (currentBusinessId === id) {
      // Já está selecionada, não faz nada
      return;
    }
    setCurrentBusiness(id);
  };

  const ligarTodas = () => {
    setCurrentBusiness("GRUPO");
  };

  const incluirEmpresa = async (nome: string) => {
    const negocio = nome.trim();
    if (negocio.length < 2) return "Diga o nome da empresa.";
    const numeros = empresas
      .map((empresa) => Number(empresa.id.replace(/\D/g, "")))
      .filter((numero) => Number.isFinite(numero) && numero > 0);
    const proximo = Math.max(0, ...numeros) + 1;
    const id = `BIZ-${String(proximo).padStart(3, "0")}`;
    const { error: insertError } = await supabase.from("portfolio").insert({
      business_id: id,
      negocio,
      estagio: "VALIDAÇÃO",
      source_system: "HELENA",
    });
    if (insertError) return insertError.message;
    await carregarEmpresas(id);
    return "";
  };

  const tirarEmpresa = async (id: string) => {
    if (empresas.length <= 1) return "Deixe ao menos uma empresa no cadastro.";
    for (const [tabela, coluna] of TABELAS_COM_BUSINESS_ID) {
      const { count, error: countErr } = await supabase
        .from(tabela)
        .select(coluna, { count: "exact", head: true })
        .eq(coluna, id);
      if (countErr) continue;
      if ((count || 0) > 0) {
        return "Esta empresa já possui registros associados. Exclusão bloqueada para proteção de dados.";
      }
    }
    const { error: delErr } = await escreverRegistro('portfolio', id, empresas.find(e => e.id === id)?.row_version, {}, true);
    if (delErr) return delErr.message;
    const restantes = empresas.filter((empresa) => empresa.id !== id).map((empresa) => empresa.id);
    setCurrentBusiness(restantes[0] || "BIZ-001");
    await carregarEmpresas();
    return "";
  };

  const pertence = (businessId?: string | null) => {
    if (!businessId || businessId === "GRUPO") return isConsolidated;
    if (isConsolidated) return true;
    return businessId === currentBusinessId;
  };

  const nomeDe = (id?: string | null) => {
    if (!id || id === "GRUPO") return "Todas as Empresas";
    const encontrada = empresas.find((empresa) => empresa.id === id);
    if (encontrada) return encontrada.sigla || encontrada.nome;
    if (id === "BIZ-001") return "iGreen Energy";
    if (id === "BIZ-002") return "Ecossistema de Saúde";
    if (id === "BIZ-003") return "Humano Digital";
    return id || "Geral";
  };

  return (
    <BusinessContext.Provider
      value={{
        currentBusiness,
        currentBusinessId,
        businesses: empresas,
        empresas,
        setCurrentBusiness,
        selecionarEmpresa: setCurrentBusiness,
        loading: carregandoEmpresas,
        carregandoEmpresas,
        error,
        isConsolidated,
        selecionadas,
        todasLigadas,
        rotulo,
        alternar,
        ligarTodas,
        incluirEmpresa,
        tirarEmpresa,
        pertence,
        nomeDe,
      }}
    >
      {children}
    </BusinessContext.Provider>
  );
}

export function useBusiness() {
  const context = useContext(BusinessContext);
  if (!context) {
    throw new Error("useBusiness deve ser usado dentro de um BusinessProvider");
  }
  return context;
}
