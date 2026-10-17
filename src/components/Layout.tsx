import { useEffect, useRef, useState } from 'react';
import { NavLink, Outlet, useLocation } from 'react-router-dom';
import { ChevronDown, LogOut, Menu, Search, X } from 'lucide-react';
import { PageBoundary } from '@/components/executive/PageBoundary';
import { ExecutiveLogo } from '@/components/executive/ExecutiveLogo';
import { ExecutiveBusinessSwitcher } from '@/components/executive/ExecutiveBusinessSwitcher';
import { gruposNavegacao } from '@/lib/navegacao';
import { useAuth } from '@/auth';

export function Layout() {
  const { isFounder, user, sair } = useAuth();
  const { pathname } = useLocation();
  const [mobile, setMobile] = useState(false);
  const [busca, setBusca] = useState('');
  const [abertos, setAbertos] = useState<Record<string, boolean>>({ Central: true, Negócios: true, 'Operação da Helena': true, 'Configuração e conexões': true });
  const menuButton = useRef<HTMLButtonElement>(null);
  const sidebar = useRef<HTMLElement>(null);
  const fechar = () => { setMobile(false); menuButton.current?.focus(); };
  useEffect(() => { setMobile(false); }, [pathname, user?.id, isFounder]);
  useEffect(() => {
    if (!mobile) return;
    sidebar.current?.querySelector<HTMLInputElement>('input')?.focus();
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') { event.preventDefault(); fechar(); }
      if (event.key !== 'Tab') return;
      const elementos = Array.from(sidebar.current?.querySelectorAll<HTMLElement>('a,button,input') ?? []).filter(el => el.offsetParent !== null);
      const first = elementos[0], last = elementos[elementos.length - 1];
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
      if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [mobile]);
  const normalizar = (texto: string) => texto.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
  const termo = normalizar(busca.trim());
  const grupos = gruposNavegacao(isFounder).map(grupo => ({ ...grupo, itens: grupo.itens.filter(item => !termo || normalizar(`${grupo.titulo} ${item.label}`).includes(termo)) })).filter(grupo => grupo.itens.length);
  const negocio = /^\/(financeiro|crm|calendario|portfolio|empresas|identidade|indicadores|modulo)(\/|$)/.test(pathname);
  return <div className="he-app he-workspace min-h-[100dvh] bg-background text-foreground">
    <a className="he-skip-link" href="#conteudo-principal">Ir para o conteúdo</a>
    {mobile && <button type="button" className="he-menu-overlay" aria-label="Fechar menu" onClick={fechar} />}
    <aside ref={sidebar} id="menu-sistema" className={`he-workspace-sidebar ${mobile ? 'is-open' : ''}`} aria-label="Menu principal">
      <div className="flex items-center justify-between gap-2 p-5"><ExecutiveLogo size="md" /><button type="button" className="min-h-11 min-w-11 lg:hidden" aria-label="Fechar navegação" onClick={fechar}><X className="mx-auto h-5 w-5" /></button></div>
      <label className="mx-4 mb-4 flex min-h-11 items-center gap-2 rounded-lg border border-border bg-background px-3"><Search aria-hidden="true" className="h-4 w-4 shrink-0" /><input aria-label="Buscar página ou módulo" placeholder="Buscar página ou módulo" value={busca} onChange={e => setBusca(e.target.value)} className="w-full min-w-0 bg-transparent py-3 text-xs outline-none" /></label>
      <nav aria-label="Seções do Sistema Helena" className="min-w-0 flex-1 space-y-2 overflow-y-auto px-3 pb-6">
        {grupos.map(grupo => {
          const ativa = grupo.itens.some(item => item.to === pathname);
          const aberto = Boolean(termo) || (abertos[grupo.titulo] ?? ativa);
          return <section key={grupo.titulo}>
            <button type="button" className="flex min-h-11 w-full items-center justify-between gap-2 px-2 text-left text-xs font-semibold text-muted-foreground" aria-expanded={aberto} onClick={() => setAbertos(estado => ({ ...estado, [grupo.titulo]: !aberto }))}>{grupo.titulo}<ChevronDown aria-hidden="true" className={`h-4 w-4 ${aberto ? 'rotate-180' : ''}`} /></button>
            {aberto && <div className="space-y-1">{grupo.itens.map(item => <NavLink key={item.to} to={item.to} end onClick={() => setMobile(false)} className={({ isActive }) => `he-nav-link flex min-h-11 min-w-0 w-full ${isActive ? 'is-active' : ''}`}>{item.label}</NavLink>)}</div>}
          </section>;
        })}
        {!grupos.length && <p role="status" className="p-3 text-sm text-muted-foreground">Nenhuma página encontrada.</p>}
      </nav>
    </aside>
    <div className="min-w-0">
      <header className="sticky top-0 z-30 flex min-h-16 flex-wrap items-center gap-3 border-b border-border bg-card/95 px-4 py-2 backdrop-blur sm:px-6">
        <button type="button" ref={menuButton} className="min-h-11 min-w-11 rounded-lg border border-border lg:hidden" aria-label="Abrir menu" aria-controls="menu-sistema" aria-expanded={mobile} onClick={() => setMobile(true)}><Menu className="mx-auto h-5 w-5" /></button>
        <span className="text-sm font-semibold">Central Executiva</span>
        {isFounder && negocio && <div className="order-3 w-full min-w-0 sm:order-none sm:w-auto"><ExecutiveBusinessSwitcher /></div>}
        <div className="ml-auto flex items-center gap-3">{user?.email && <span className="hidden max-w-[22ch] truncate text-xs text-muted-foreground sm:inline" title={user.email}>{user.email}</span>}<button type="button" onClick={() => void sair()} className="inline-flex min-h-11 items-center gap-2 rounded-lg border border-border px-3 text-xs font-semibold"><LogOut className="h-4 w-4" aria-hidden="true" />Sair</button></div>
      </header>
      <main id="conteudo-principal" tabIndex={-1} className="mx-auto w-full max-w-[1500px] min-w-0 px-4 py-6 sm:px-6"><PageBoundary><Outlet /></PageBoundary></main>
    </div>
  </div>;
}
