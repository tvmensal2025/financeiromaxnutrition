import React, { createContext, useContext, useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

export type Empresa = {
  id: string;
  nome: string;
  sigla: string;
  cor: string;
};

const CORES: Record<string, string> = {
  "BIZ-001": "#007A3D",
  "BIZ-002": "#2563EB",
  "BIZ-003": "#B45309",
};

const CORES_EXTRA = ["#0F766E", "#7C3AED", "#BE123C", "#0369A1"];
const CHAVE = "helena_empresas_ligadas";

const TABELAS_COM_EMPRESA: Array<[string, string]> = [
  ["ideias", "business_id"],
  ["crm", "business_id"],
  ["financeiro", "business_id"],
  ["clientes", "business_id"],
  ["contratos", "business_id"],
  ["calendario", "business_id"],
  ["tarefas", "business_id"],
  ["memoria_mestre", "business_id_area"],
  ["atendimento", "business_id"],
  ["marketing", "business_id"],
  ["recorrencias", "business_id"],
  ["handoffs", "business_id"],
  ["projetos", "business_id"],
  ["contas_financeiras", "business_id"],
];

function siglaDe(nome: string) {
  const texto = nome.trim();
  if (/igreen/i.test(texto)) return "iGreen Energy";
  if (/sa[uú]de|max|nutrition|refit/i.test(texto)) return "Max Nutrition & Refit";
  if (/humano/i.test(texto)) return "Humano Digital";
  if (texto.length <= 25) return texto;
  return `${texto.slice(0, 22)}…`;
}

function corDe(id: string, indice: number) {
  return CORES[id] || CORES_EXTRA[indice % CORES_EXTRA.length];
}

function rotuloDe(empresas: Empresa[], selecionadas: string[]) {
  const nomes = empresas.filter((empresa) => selecionadas.includes(empresa.id)).map((empresa) => empresa.sigla);
  if (nomes.length === 0) return "Nenhuma empresa";
  if (nomes.length === empresas.length && empresas.length > 1) return "Todas as empresas";
  if (nomes.length === 1) return nomes[0];
  if (nomes.length === 2) return `${nomes[0]} e ${nomes[1]}`;
  return `${nomes.slice(0, -1).join(", ")} e ${nomes[nomes.length - 1]}`;
}

function lerSalvas(ids: string[]) {
  try {
    const bruto = JSON.parse(localStorage.getItem(CHAVE) || "null");
    if (!Array.isArray(bruto)) return ids;
    const validas = bruto.filter((id) => ids.includes(String(id)));
    return validas.length ? validas : ids;
  } catch {
    return ids;
  }
}

type Contexto = {
  empresas: Empresa[];
  selecionadas: string[];
  todasLigadas: boolean;
  rotulo: string;
  carregandoEmpresas: boolean;
  alternar: (id: string) => void;
  ligarTodas: () => void;
  incluirEmpresa: (nome: string) => Promise<string>;
  tirarEmpresa: (id: string) => Promise<string>;
  pertence: (businessId?: string | null) => boolean;
  nomeDe: (id?: string | null) => string;
};

const BusinessContext = createContext<Contexto | undefined>(undefined);

export function BusinessProvider({ children }: { children: React.ReactNode }) {
  const [empresas, setEmpresas] = useState<Empresa[]>([]);
  const [selecionadas, setSelecionadas] = useState<string[]>([]);
  const [carregandoEmpresas, setCarregandoEmpresas] = useState(true);

  const gravar = (ids: string[]) => {
    setSelecionadas(ids);
    localStorage.setItem(CHAVE, JSON.stringify(ids));
  };

  const carregar = async (ligarId?: string) => {
    const { data, error } = await supabase
      .from("portfolio")
      .select("business_id,negocio")
      .order("business_id");
    if (error) {
      setCarregandoEmpresas(false);
      return;
    }
    const lista = ((data || []) as Array<{ business_id: string; negocio: string | null }>)
      .filter((item) => item.business_id && item.business_id !== "GRUPO")
      .map((item, indice) => ({
        id: item.business_id,
        nome: (item.negocio || item.business_id).trim(),
        sigla: siglaDe(item.negocio || item.business_id),
        cor: corDe(item.business_id, indice),
      }));
    setEmpresas(lista);
    const ids = lista.map((item) => item.id);
    setSelecionadas((atual) => {
      const base = atual.length ? atual.filter((item) => ids.includes(item)) : lerSalvas(ids);
      const comNova = ligarId && ids.includes(ligarId) && !base.includes(ligarId) ? [...base, ligarId] : base;
      const proximas = comNova.length ? comNova : ids;
      localStorage.setItem(CHAVE, JSON.stringify(proximas));
      return proximas;
    });
    setCarregandoEmpresas(false);
  };

  useEffect(() => {
    carregar();
  }, []);

  const todasLigadas = empresas.length > 0 && selecionadas.length === empresas.length;
  const rotulo = rotuloDe(empresas, selecionadas);

  const alternar = (id: string) => {
    if (!empresas.some((empresa) => empresa.id === id)) return;
    if (selecionadas.includes(id)) {
      if (selecionadas.length === 1) return;
      gravar(selecionadas.filter((item) => item !== id));
      return;
    }
    gravar([...selecionadas, id]);
  };

  const ligarTodas = () => gravar(empresas.map((empresa) => empresa.id));

  const incluirEmpresa = async (nome: string) => {
    const negocio = nome.trim();
    if (negocio.length < 2) return "Diga o nome da empresa.";
    const numeros = empresas
      .map((empresa) => Number(empresa.id.replace(/\D/g, "")))
      .filter((numero) => Number.isFinite(numero) && numero > 0);
    const proximo = Math.max(0, ...numeros) + 1;
    const id = `BIZ-${String(proximo).padStart(3, "0")}`;
    const { error } = await supabase.from("portfolio").insert({
      business_id: id,
      negocio,
      estagio: "DADO A COLETAR",
      source_system: "HELENA",
    });
    if (error) return error.message;
    await carregar(id);
    return "";
  };

  const tirarEmpresa = async (id: string) => {
    if (empresas.length <= 1) return "Deixe ao menos uma empresa no cadastro.";
    for (const [tabela, coluna] of TABELAS_COM_EMPRESA) {
      const { count, error } = await supabase
        .from(tabela)
        .select(coluna, { count: "exact", head: true })
        .eq(coluna, id);
      if (error) continue;
      if ((count || 0) > 0) {
        return "Esta empresa já tem registros. Ela sai da visão se você desligar o botão, e o cadastro fica.";
      }
    }
    const { error } = await supabase.from("portfolio").delete().eq("business_id", id);
    if (error) return error.message;
    const restantes = empresas.filter((empresa) => empresa.id !== id).map((empresa) => empresa.id);
    const proximas = selecionadas.filter((item) => item !== id);
    gravar(proximas.length ? proximas : restantes.slice(0, 1));
    await carregar();
    return "";
  };

  const pertence = (businessId?: string | null) => {
    if (!businessId || businessId === "GRUPO") return todasLigadas;
    return selecionadas.includes(businessId);
  };

  const nomeDe = (id?: string | null) => {
    if (!id || id === "GRUPO") return "Todas as Empresas";
    const encontrada = empresas.find((empresa) => empresa.id === id);
    if (encontrada) return encontrada.sigla || encontrada.nome;
    if (id === "BIZ-001") return "iGreen Energy";
    if (id === "BIZ-002") return "Max Nutrition & Refit";
    if (id === "BIZ-003") return "Humano Digital";
    return id || "Geral";
  };

  return (
    <BusinessContext.Provider
      value={{
        empresas,
        selecionadas,
        todasLigadas,
        rotulo,
        carregandoEmpresas,
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
