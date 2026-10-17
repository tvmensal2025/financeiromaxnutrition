/**
 * O que é: a casca da Sala de comando v2. Mostra o cabeçalho (atualizar, hora da leitura, empresa), a barra de abas e carrega
 * a aba escolhida (`?aba=<id>`). Cada aba é um arquivo `src/pages/comando-v2/abas/<Nome>Aba.tsx` com `export default`,
 * descoberto por `import.meta.glob`; se o arquivo ainda não existe, a tela diz que a aba está em construção.
 * Lê SÓ o que `useDadosComando` entrega (esquema helena_v2). Não usa o BusinessContext nem dados da v1.
 * Como mudar: para uma nova aba, acrescente-a em ABAS (src/integrations/comando-v2/tipos.ts) e crie o arquivo dela.
 * A empresa escolhida fica no navegador (localStorage `helena_v2_comando_empresa`); sem localStorage a tela funciona igual.
 */
import { Component, Suspense, lazy, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { ComponentType, KeyboardEvent, LazyExoticComponent, ReactNode } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { AlertTriangle, ChevronDown, Construction, Info, RefreshCw } from 'lucide-react';
import { ExecutiveEmptyState } from '@/components/executive/ExecutiveEmptyState';
import { ExecutiveLoadingState } from '@/components/executive/ExecutiveLoadingState';
import { ExecutivePageHeader } from '@/components/executive/ExecutivePageHeader';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuRadioGroup, DropdownMenuRadioItem, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useDadosComando } from '@/integrations/comando-v2/useDadosComando';
import { ABAS, type AbaId, type PropsAba, type UsarDadosComando } from '@/integrations/comando-v2/tipos';

export type CarregadoresAbas = Record<string, () => Promise<{ default: ComponentType<PropsAba> }>>;

/** Descobre os arquivos das abas que já existem; um arquivo ausente simplesmente não aparece aqui. */
const CARREGADORES_PADRAO = import.meta.glob<{ default: ComponentType<PropsAba> }>('./comando-v2/abas/*Aba.tsx');

const CHAVE_EMPRESA_COMANDO = 'helena_v2_comando_empresa';
const INTERVALO_ATUALIZACAO_MS = 30_000;
const GRUPO = 'GRUPO';
const ABA_PADRAO: AbaId = 'visao-geral';
const ID_PAINEL = 'painel-sala-de-comando';
const idAba = (id: AbaId) => `aba-sala-de-comando-${id}`;
const ABAS_VISIVEIS = ABAS.filter(aba => aba.visivel);
const ABAS_MENU = ABAS.filter(aba => !aba.visivel);

const FORMATO_HORA = new Intl.DateTimeFormat('pt-BR', { timeZone: 'America/Sao_Paulo', hour: '2-digit', minute: '2-digit', hour12: false });
function horaDeSaoPaulo(data: Date): string { return FORMATO_HORA.format(data); }

function lerEmpresaSalva(): string {
  try {
    const valor = window.localStorage.getItem(CHAVE_EMPRESA_COMANDO);
    return valor && valor.length <= 60 ? valor : GRUPO;
  } catch { return GRUPO; }
}
function salvarEmpresa(valor: string) {
  try { window.localStorage.setItem(CHAVE_EMPRESA_COMANDO, valor); } catch { /* sem armazenamento: a escolha vale só nesta tela */ }
}

type AbaCarregavel = LazyExoticComponent<ComponentType<PropsAba>>;
/** Uma aba por entrada de ABAS; `null` quando o arquivo dela ainda não existe. */
function montarAbas(carregadores: CarregadoresAbas): Map<AbaId, AbaCarregavel | null> {
  const chaves = Object.keys(carregadores);
  const mapa = new Map<AbaId, AbaCarregavel | null>();
  for (const aba of ABAS) {
    const chave = chaves.find(item => item.endsWith(`/${aba.arquivo}.tsx`));
    mapa.set(aba.id, chave ? lazy(carregadores[chave]) : null);
  }
  return mapa;
}

/** Se uma aba quebrar, só ela cai: as outras abas e o cabeçalho continuam utilizáveis. */
class FalhaDaAba extends Component<{ children: ReactNode; rotulo: string }, { falhou: boolean }> {
  state = { falhou: false };
  static getDerivedStateFromError() { return { falhou: true }; }
  render() {
    if (!this.state.falhou) return this.props.children;
    return (
      <div role="alert" className="flex flex-col items-center gap-3 rounded-xl border border-destructive/40 bg-destructive/10 p-8 text-center">
        <AlertTriangle aria-hidden="true" className="h-6 w-6 text-destructive" />
        <h2 className="text-sm font-semibold text-foreground">Não foi possível abrir a aba {this.props.rotulo}</h2>
        <p className="max-w-md text-xs text-muted-foreground">Escolha outra aba ou tente abrir esta de novo.</p>
        <button type="button" onClick={() => this.setState({ falhou: false })}
          className="inline-flex min-h-11 items-center justify-center rounded-md border border-border bg-card px-4 text-sm font-semibold text-foreground hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
          Tentar de novo
        </button>
      </div>
    );
  }
}

const NOMES_DAS_LEITURAS = {
  cards: 'os cards', etapas: 'as etapas dos cards', entregas: 'as entregas', pedidos: 'os pedidos', catalogo: 'o catálogo de empresas e agentes',
} as const;
type ChaveLeitura = keyof typeof NOMES_DAS_LEITURAS;

type Props = { usarDados?: UsarDadosComando; carregadoresAbas?: CarregadoresAbas };

export default function ComandoV2Page({ usarDados = useDadosComando, carregadoresAbas = CARREGADORES_PADRAO }: Props) {
  const { dados, carregando, atualizadoEm, recarregar } = usarDados();
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const [empresaEscolhida, setEmpresaEscolhida] = useState(lerEmpresaSalva);
  const abasCarregaveis = useMemo(() => montarAbas(carregadoresAbas), [carregadoresAbas]);
  const refsAbas = useRef<Partial<Record<AbaId, HTMLButtonElement | null>>>({});

  const pedido = params.get('aba');
  const ativa = ABAS.find(aba => aba.id === pedido) ?? ABAS.find(aba => aba.id === ABA_PADRAO)!;
  const ativaNoMenu = !ativa.visivel;

  // Empresa: depois que o catálogo carregou, uma empresa que não existe mais volta para o grupo (sem apagar o que foi salvo).
  const empresasDoCatalogo = dados.catalogo.empresas;
  const catalogoPronto = dados.estado.catalogo === 'pronta';
  const empresa = empresaEscolhida === GRUPO || !catalogoPronto || empresasDoCatalogo.some(item => item.id === empresaEscolhida)
    ? empresaEscolhida : GRUPO;
  const empresaForaDaLista = empresa !== GRUPO && !empresasDoCatalogo.some(item => item.id === empresa);

  const escolherEmpresa = (valor: string) => { setEmpresaEscolhida(valor); salvarEmpresa(valor); };
  const escolherAba = useCallback((id: AbaId) => {
    setParams(anterior => { const novo = new URLSearchParams(anterior); novo.set('aba', id); return novo; });
  }, [setParams]);
  const abrirCard = useCallback((id: string) => navigate(`/cards?card=${encodeURIComponent(id)}`), [navigate]);

  // Atualização automática a cada 30 s, pausada com a aba do navegador oculta.
  const recarregarRef = useRef(recarregar);
  const carregandoRef = useRef(carregando);
  const ultimaRef = useRef(Date.now());
  recarregarRef.current = recarregar;
  carregandoRef.current = carregando;
  useEffect(() => {
    let intervalo: ReturnType<typeof setInterval> | undefined;
    const atualizar = () => { ultimaRef.current = Date.now(); recarregarRef.current(); };
    const parar = () => { if (intervalo !== undefined) { clearInterval(intervalo); intervalo = undefined; } };
    const iniciar = () => {
      parar();
      intervalo = setInterval(() => { if (!document.hidden && !carregandoRef.current) atualizar(); }, INTERVALO_ATUALIZACAO_MS);
    };
    const aoMudarVisibilidade = () => {
      if (document.hidden) { parar(); return; }
      if (Date.now() - ultimaRef.current >= INTERVALO_ATUALIZACAO_MS && !carregandoRef.current) atualizar();
      iniciar();
    };
    if (!document.hidden) iniciar();
    document.addEventListener('visibilitychange', aoMudarVisibilidade);
    return () => { parar(); document.removeEventListener('visibilitychange', aoMudarVisibilidade); };
  }, []);

  const atualizarAgora = () => { if (carregandoRef.current) return; ultimaRef.current = Date.now(); recarregar(); };

  const aoTeclarNaAba = (evento: KeyboardEvent<HTMLButtonElement>, indice: number) => {
    const total = ABAS_VISIVEIS.length;
    let destino = -1;
    if (evento.key === 'ArrowRight') destino = (indice + 1) % total;
    else if (evento.key === 'ArrowLeft') destino = (indice - 1 + total) % total;
    else if (evento.key === 'Home') destino = 0;
    else if (evento.key === 'End') destino = total - 1;
    if (destino < 0) return;
    evento.preventDefault();
    const aba = ABAS_VISIVEIS[destino];
    escolherAba(aba.id);
    refsAbas.current[aba.id]?.focus();
  };

  const falhas = (Object.keys(NOMES_DAS_LEITURAS) as ChaveLeitura[]).filter(chave => dados.estado[chave] === 'erro');
  const falhaPrincipal = dados.estado.catalogo === 'erro' || dados.estado.cards === 'erro';

  const Aba = abasCarregaveis.get(ativa.id) ?? null;
  const propsAba: PropsAba = { dados, empresa, abrirCard };
  const rotuloHora = atualizadoEm ? `Atualizado às ${horaDeSaoPaulo(atualizadoEm)}` : carregando ? 'Carregando dados…' : 'Ainda sem leitura';

  return (
    <div className="space-y-5">
      <ExecutivePageHeader
        title="Sala de comando"
        breadcrumb="CENTRAL EXECUTIVA"
        description="O que a Helena está fazendo agora: cards, etapas, entregas, empresas e agentes."
        actions={
          <>
            <label className="flex min-w-0 flex-col gap-0.5 text-[11px] font-semibold text-muted-foreground">
              Empresa
              <select
                value={empresa}
                onChange={evento => escolherEmpresa(evento.target.value)}
                className="min-h-11 w-full min-w-0 rounded-md border border-border bg-background px-3 text-sm font-normal text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring sm:w-auto sm:max-w-[16rem]"
              >
                <option value={GRUPO}>Grupo consolidado</option>
                {empresaForaDaLista && <option value={empresa}>{empresa}</option>}
                {empresasDoCatalogo.map(item => <option key={item.id} value={item.id}>{item.nome}</option>)}
              </select>
            </label>
            <div className="flex items-center gap-3 self-end">
              <p className="text-xs text-muted-foreground">
                {atualizadoEm ? <time dateTime={atualizadoEm.toISOString()}>{rotuloHora}</time> : rotuloHora}
              </p>
              <button
                type="button"
                onClick={atualizarAgora}
                disabled={carregando}
                className="inline-flex min-h-11 items-center justify-center gap-2 rounded-md border border-border bg-card px-4 text-sm font-semibold text-foreground transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-60"
              >
                <RefreshCw aria-hidden="true" className={`h-4 w-4 ${carregando ? 'animate-spin' : ''}`} />
                Atualizar
              </button>
            </div>
          </>
        }
      />

      {falhas.length > 0 && (
        <div
          role="alert"
          className={`flex flex-col gap-3 rounded-xl border p-4 sm:flex-row sm:items-center sm:justify-between ${falhaPrincipal ? 'border-destructive/40 bg-destructive/10' : 'border-warning/40 bg-warning/10'}`}
        >
          <div className="flex min-w-0 items-start gap-3">
            <AlertTriangle aria-hidden="true" className={`mt-0.5 h-5 w-5 shrink-0 ${falhaPrincipal ? 'text-destructive' : 'text-warning'}`} />
            <div className="min-w-0 space-y-1 text-sm text-foreground">
              <p>
                Não foi possível ler {falhas.map(chave => NOMES_DAS_LEITURAS[chave]).join(', ')}. Os números dessas partes não são zero: estão indisponíveis.
              </p>
              {falhas.some(chave => dados.erros?.[chave]) && (
                <ul className="list-disc space-y-0.5 pl-5 text-xs text-muted-foreground">
                  {falhas.filter(chave => dados.erros?.[chave]).map(chave => (
                    <li key={chave} className="break-words">{NOMES_DAS_LEITURAS[chave]}: {dados.erros?.[chave]}</li>
                  ))}
                </ul>
              )}
            </div>
          </div>
          <button
            type="button"
            onClick={atualizarAgora}
            disabled={carregando}
            className="inline-flex min-h-11 shrink-0 items-center justify-center gap-2 rounded-md border border-border bg-card px-4 text-sm font-semibold text-foreground hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-60"
          >
            <RefreshCw aria-hidden="true" className="h-4 w-4" />
            Tentar de novo
          </button>
        </div>
      )}

      {dados.amostra && (
        <p role="status" className="flex items-start gap-2 rounded-xl border border-border bg-muted/40 p-3 text-xs text-muted-foreground">
          <Info aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0" />
          <span>Amostra: a leitura foi cortada por limite, então os números abaixo podem ser menores que o total real.</span>
        </p>
      )}

      <div className="flex items-stretch gap-2 border-b border-border">
        <div role="tablist" aria-label="Abas da Sala de comando" className="flex min-w-0 flex-1 gap-1 overflow-x-auto">
          {ABAS_VISIVEIS.map((aba, indice) => {
            const selecionada = aba.id === ativa.id;
            // Com uma aba do menu "Mais" aberta, a primeira aba visível segura o foco do teclado.
            const focavel = selecionada || (ativaNoMenu && indice === 0);
            return (
              <button
                key={aba.id}
                ref={elemento => { refsAbas.current[aba.id] = elemento; }}
                type="button"
                role="tab"
                id={idAba(aba.id)}
                aria-selected={selecionada}
                aria-controls={ID_PAINEL}
                tabIndex={focavel ? 0 : -1}
                onClick={() => escolherAba(aba.id)}
                onKeyDown={evento => aoTeclarNaAba(evento, indice)}
                className={`inline-flex min-h-11 shrink-0 items-center whitespace-nowrap border-b-2 px-3 text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${selecionada ? 'border-primary text-primary' : 'border-transparent text-muted-foreground hover:text-foreground'}`}
              >
                {aba.rotulo}
              </button>
            );
          })}
        </div>
        {ABAS_MENU.length > 0 && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                type="button"
                aria-label={ativaNoMenu ? `Mais abas (aberta: ${ativa.rotulo})` : 'Mais abas'}
                className={`inline-flex min-h-11 shrink-0 items-center gap-1 border-b-2 px-3 text-sm font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${ativaNoMenu ? 'border-primary text-primary' : 'border-transparent text-muted-foreground hover:text-foreground'}`}
              >
                {ativaNoMenu ? ativa.rotulo : 'Mais'}
                <ChevronDown aria-hidden="true" className="h-4 w-4" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" aria-label="Mais abas">
              <DropdownMenuRadioGroup value={ativa.id} onValueChange={valor => escolherAba(valor as AbaId)}>
                {ABAS_MENU.map(aba => (
                  <DropdownMenuRadioItem key={aba.id} value={aba.id} className="min-h-11 pr-4 text-sm">{aba.rotulo}</DropdownMenuRadioItem>
                ))}
              </DropdownMenuRadioGroup>
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </div>

      <div
        role="tabpanel"
        id={ID_PAINEL}
        aria-label={ativa.rotulo}
        aria-labelledby={ativaNoMenu ? undefined : idAba(ativa.id)}
        tabIndex={-1}
        className="min-w-0"
      >
        {Aba ? (
          <FalhaDaAba key={ativa.id} rotulo={ativa.rotulo}>
            <Suspense fallback={<ExecutiveLoadingState message={`Abrindo ${ativa.rotulo}`} />}>
              <Aba {...propsAba} />
            </Suspense>
          </FalhaDaAba>
        ) : (
          <ExecutiveEmptyState
            icon={Construction}
            title="Esta aba está em construção"
            description={`A aba ${ativa.rotulo} ainda não está disponível nesta versão. Use as outras abas por enquanto.`}
          />
        )}
      </div>
    </div>
  );
}
