import { useId, useState } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import type { JsonValue } from './repository';

const control = 'w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary';

type Props = { label: string; value: JsonValue; onChange(value: JsonValue): void; onRemove?: () => void; depth?: number };

export function DocumentEditor({ label, value, onChange, onRemove, depth = 0 }: Props) {
  const id = useId();
  const [novaChave, setNovaChave] = useState('');
  const [tipoNovo, setTipoNovo] = useState('texto');
  const [aberto, setAberto] = useState(depth < 2);
  const tipo = value === null ? 'null' : Array.isArray(value) ? 'lista' : typeof value === 'object' ? 'objeto' : typeof value;
  const novoValor = (): JsonValue => ({ texto: '', numero: 0, booleano: false, lista: [], objeto: {} } as Record<string, JsonValue>)[tipoNovo];

  if (value === null || typeof value !== 'object') {
    return <div className="grid min-w-0 gap-2 border-b border-border/60 py-3 sm:grid-cols-[minmax(10rem,0.36fr)_minmax(0,1fr)_auto] sm:items-center">
      <label className="min-w-0 break-words text-sm font-medium" htmlFor={id}>{label}</label>
      {typeof value === 'boolean' ? <select id={id} className={control} value={String(value)} onChange={e => onChange(e.target.value === 'true')}><option value="true">Sim</option><option value="false">Não</option></select>
        : typeof value === 'number' ? <input id={id} className={control} type="number" value={value} onChange={e => { const n = Number(e.target.value); if (Number.isFinite(n)) onChange(n); }} />
          : value === null ? <select id={id} className={control} value="null" onChange={e => onChange(e.target.value)}><option value="null">Sem valor</option><option value="">Texto vazio</option></select>
            : <textarea id={id} className={`${control} min-h-10 resize-y`} rows={value.length > 90 ? 3 : 1} value={value} onChange={e => onChange(e.target.value)} />}
      {onRemove && <button type="button" className="min-h-11 rounded-lg p-2 text-muted-foreground hover:bg-destructive/10 hover:text-destructive" onClick={onRemove} aria-label={`Retirar ${label} do rascunho`}><Trash2 size={16}/></button>}
    </div>;
  }

  const lista = Array.isArray(value);
  const entradas = lista ? value.map((item, i) => [String(i), item] as const) : Object.entries(value);
  return <section className="min-w-0 border-b border-border/60 py-3">
    <div className="flex flex-wrap items-center gap-2">
      <button type="button" className="min-h-11 flex min-w-0 items-center gap-2 text-left text-sm font-semibold hover:text-primary" onClick={() => setAberto(v => !v)} aria-expanded={aberto}>
        <span className="break-all">{label}</span><span className="rounded-md bg-muted px-2 py-0.5 text-xs font-normal text-muted-foreground">{tipo} · {entradas.length}</span>
      </button>
      {onRemove && <button type="button" className="min-h-11 ml-auto rounded-lg p-2 text-muted-foreground hover:bg-destructive/10 hover:text-destructive" onClick={onRemove} aria-label={`Retirar ${label} do rascunho`}><Trash2 size={16}/></button>}
    </div>
    {aberto && <div className="ml-2 border-l border-border pl-3 sm:ml-4 sm:pl-5">
      {entradas.map(([key, child]) => <DocumentEditor key={key} label={lista ? `Item ${Number(key) + 1}` : key} value={child}
        depth={depth + 1} onChange={next => {
          if (lista) onChange(value.map((item, i) => i === Number(key) ? next : item));
          else onChange({ ...value, [key]: next });
        }} onRemove={() => {
          if (lista) onChange(value.filter((_, i) => i !== Number(key)));
          else { const next = { ...value }; delete next[key]; onChange(next); }
        }} />)}
      <div className="mt-3 flex flex-wrap gap-2">{!lista && <input aria-label={`Novo campo em ${label}`} className={`${control} max-w-xs`} value={novaChave} onChange={e => setNovaChave(e.target.value)} placeholder="Nome do campo" />}
        <select aria-label={`Tipo do novo ${lista ? 'item' : 'campo'} em ${label}`} className={`${control} max-w-40`} value={tipoNovo} onChange={e => setTipoNovo(e.target.value)}><option value="texto">Texto</option><option value="numero">Número</option><option value="booleano">Sim/não</option><option value="lista">Lista</option><option value="objeto">Objeto</option></select>
        <button type="button" className="min-h-11 inline-flex items-center gap-2 rounded-lg border border-border px-3 py-2 text-sm hover:bg-muted" disabled={!lista && (!novaChave.trim() || Object.prototype.hasOwnProperty.call(value, novaChave.trim()))} onClick={() => { if (lista) onChange([...value, novoValor()]); else { onChange({ ...value, [novaChave.trim()]: novoValor() }); setNovaChave(''); } }}><Plus size={15}/>{lista ? 'Adicionar item' : 'Adicionar campo'}</button></div>
    </div>}
  </section>;
}
