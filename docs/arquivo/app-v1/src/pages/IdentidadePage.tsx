import { useEffect, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { ArrowLeft, Check, Palette, Save, Upload } from 'lucide-react';
import { useAuth } from '@/auth';
import { useBusiness } from '@/contexts/BusinessContext';
import { supabase } from '@/lib/supabase';
import { brandPreview, uploadBrand } from '@/lib/media-client';
import { escreverRegistro, ehConflitoDeVersao } from '@/lib/escrita-protegida';
import { BRAND_FIELDS, brandMissing, brandSchema, emptyBrand, safeBrandAsset, type BrandIdentity } from '@/lib/brand-identity';
import humano from '@/data/humano-digital-brand.json';
import eliving from '@/data/eliving-brand.json';

const control = 'w-full rounded-xl border border-border bg-background px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-primary/30';

function BrandImage({ path, alt, className }: { path: string; alt: string; className?: string }) {
  const [url, setUrl] = useState('');
  useEffect(() => {
    let active = true;
    setUrl('');
    if (!safeBrandAsset(path)) return;
    if (path.startsWith('storage://helena-brand-assets/')) {
      brandPreview(path)
        .then(preview => { if (active) setUrl(preview); }).catch(() => { if (active) setUrl(''); });
    } else setUrl(path);
    return () => { active = false; };
  }, [path]);
  return url ? <img src={url} alt={alt} className={className} referrerPolicy="no-referrer" /> : <p className="text-sm text-muted-foreground">Imagem ainda não disponível.</p>;
}

export default function IdentidadePage() {
  const { businesses, currentBusinessId } = useBusiness();
  const { isFounder } = useAuth();
  const [params, setParams] = useSearchParams();
  const selected = params.get('empresa') || currentBusinessId;
  const [brand, setBrand] = useState<BrandIdentity | null>(null);
  const [version, setVersion] = useState<number | string | null>(null);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const generation = useRef(0);
  useEffect(() => {
    const run = ++generation.current;
    setBrand(null); setVersion(null); setError(''); setMessage(''); setDirty(false);
    if (!/^BIZ-\d{3}$/.test(selected)) { setLoading(false); return; }
    setLoading(true);
    Promise.resolve(supabase.from('portfolio').select('*').eq('business_id', selected).single()).then(({ data, error: readError }) => {
      if (run !== generation.current) return;
      setLoading(false);
      if (readError || !data) { setError('Não foi possível carregar a identidade desta empresa. Tente abrir novamente.'); return; }
      const saved = data.brand_identity;
      const candidate = saved || (selected === 'BIZ-003' ? humano : selected === 'BIZ-004' ? eliving : emptyBrand(selected, data.negocio || selected));
      if (saved && (!brandSchema.safeParse(saved).success || saved.business_id !== selected)) {
        setError('O cadastro da marca precisa de conferência antes de ser editado. Nenhum dado foi substituído.'); return;
      }
      setBrand(structuredClone(candidate)); setVersion(data.row_version);
      if (!saved) setMessage('Proposta inicial. Confira os campos e salve a identidade para disponibilizá-la à equipe.');
    }).catch(() => { if (run === generation.current) { setLoading(false); setError('Não foi possível carregar a empresa. Tente novamente.'); } });
    return () => { generation.current++; };
  }, [selected]);

  function change(patch: Partial<BrandIdentity>) {
    setBrand(current => current ? { ...current, ...patch, status: 'DRAFT' } : current);
    setDirty(true); setMessage(''); setError('');
  }
  async function save(approve: boolean) {
    if (!brand || !isFounder || busy) return;
    setError(''); setMessage('');
    const result = brandSchema.safeParse({ ...brand, status: approve ? 'APPROVED' : 'DRAFT' });
    if (!result.success) { setError('Confira os campos: ' + result.error.issues.map(i => `${i.path.join(' / ')}: ${i.message}`).join('; ')); return; }
    const missing = brandMissing(result.data);
    if (approve && missing.length) { setError('Antes de aprovar, complete: ' + missing.join(', ') + '.'); return; }
    setBusy(true);
    try {
      const response = await escreverRegistro('portfolio', selected, version, { brand_identity: result.data });
      if (response.error || !response.data) throw new Error(ehConflitoDeVersao(response.error?.code) ? response.error.message : 'Não foi possível salvar a identidade. Seu rascunho foi preservado; confira a conexão e a disponibilidade do cadastro.');
      setBrand(result.data); setVersion(response.data.row_version as number | string); setDirty(false);
      setMessage(approve ? 'Identidade aprovada e salva para a equipe.' : 'Rascunho salvo. A produção visual aguarda aprovação da identidade.');
    } catch (e) { setError(e instanceof Error ? e.message : 'Não foi possível salvar. Seu rascunho foi mantido.'); }
    finally { setBusy(false); }
  }
  async function upload(file?: File) {
    if (!file || !brand || !isFounder || busy) return;
    if (!['image/png', 'image/jpeg', 'image/webp'].includes(file.type) || file.size > 5 * 1024 * 1024) {
      setError('Escolha um logo PNG, JPG ou WebP de até 5 MB. Prefira PNG com fundo transparente.'); return;
    }
    setBusy(true); setError('');
    try {
      const reference = await uploadBrand(selected, file);
      change({ logo_url: reference, logo_approved: false });
      setMessage('Logo enviado. Confira a imagem, confirme seu uso e salve a identidade.');
    } catch { setError('Não foi possível enviar o logo. O arquivo anterior foi preservado.'); }
    finally { setBusy(false); }
  }
  const missing = brand ? brandMissing(brand) : [];
  return <div className="he-brandbook mx-auto max-w-6xl space-y-6 pb-16">
    <Link to="/portfolio" className="inline-flex items-center gap-2 text-sm text-muted-foreground"><ArrowLeft size={16} /> Empresas</Link>
    <header className="flex flex-wrap items-end justify-between gap-5">
      <div><p className="text-xs font-semibold uppercase tracking-[.22em] text-primary">A essência de cada negócio</p><h1 className="mt-2 text-3xl font-semibold tracking-tight">Identidade da empresa</h1><p className="mt-2 max-w-xl text-muted-foreground">Tudo o que a equipe precisa para criar com a sua marca, a sua voz e o seu propósito.</p></div>
      <label className="min-w-52 text-sm">Empresa<select aria-label="Empresa da identidade" className={`${control} mt-1`} value={selected} disabled={busy} onChange={event => {
        if (dirty && !window.confirm('Há alterações não salvas. Deseja trocar de empresa e descartar este rascunho?')) return;
        setParams({ empresa: event.target.value });
      }}><option value="GRUPO">Selecione uma empresa</option>{businesses.filter(b => /^BIZ-\d{3}$/.test(b.business_id)).map(b => <option key={b.business_id} value={b.business_id}>{b.nome}</option>)}</select></label>
    </header>
    {error && <div role="alert" className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">{error}</div>}
    {message && <div role="status" className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-900">{message}</div>}
    {loading && <p>Carregando a marca…</p>}
    {!loading && !brand && !error && <div className="rounded-2xl border bg-card p-8">Escolha uma empresa para conhecer ou preparar sua identidade.</div>}
    {brand && <>
      <section className="grid gap-5 lg:grid-cols-[1.2fr_1fr]">
        <div className="overflow-hidden rounded-3xl border bg-card">
          <div className="flex min-h-56 items-center justify-center bg-[#F4F5EB] p-10"><BrandImage path={brand.logo_url} alt={`Logo de ${brand.name}`} className="max-h-36 w-full object-contain" /></div>
          <div className="space-y-4 p-6"><div className="flex items-center justify-between gap-3"><h2 className="text-xl font-semibold">{brand.name}</h2><span className="rounded-full bg-muted px-3 py-1 text-xs">{brand.status === 'APPROVED' ? 'Aprovada' : 'Em preparação'}</span></div>
            <p className="text-sm text-muted-foreground">{brand.logo_approved ? 'Assinatura escolhida para representar a empresa.' : 'Proposta de logo. Confira antes de liberar seu uso.'}</p>
            {isFounder && <><label className="block text-sm">Arquivo ou endereço do logo<input className={`${control} mt-1`} value={brand.logo_url} disabled={busy} onChange={e => change({ logo_url: e.target.value, logo_approved: false })} /></label>
              <label className="inline-flex cursor-pointer items-center gap-2 rounded-xl border px-4 py-2 text-sm"><Upload size={16} /> Enviar logo<input className="sr-only" type="file" accept="image/png,image/jpeg,image/webp" disabled={busy} onChange={e => void upload(e.target.files?.[0])} /></label>
              <label className="flex items-start gap-2 text-sm"><input type="checkbox" checked={brand.logo_approved} disabled={busy || !brand.logo_url} onChange={e => change({ logo_approved: e.target.checked })} />Este é o logo autorizado para a empresa.</label></>}
          </div>
        </div>
        <div className="rounded-3xl border bg-card p-6"><div className="flex items-center gap-2"><Palette size={20} /><h2 className="text-xl font-semibold">Cores e tipografia</h2></div><p className="mt-2 text-sm text-muted-foreground">Uma linguagem visual consistente em cada entrega.</p>
          <div className="mt-6 grid grid-cols-2 gap-3">{brand.colors.map((color, i) => <div key={i} className="overflow-hidden rounded-xl border"><div className="h-16" style={{ backgroundColor: color.hex }} /><div className="space-y-1 p-3"><p className="text-sm font-medium">{color.name}</p>{isFounder ? <input aria-label={`Cor ${color.name}`} type="color" value={color.hex} disabled={busy} onChange={e => change({ colors: brand.colors.map((c, n) => n === i ? { ...c, hex: e.target.value } : c) })} /> : <p className="text-xs">{color.hex}</p>}<p className="text-xs text-muted-foreground">{color.use}</p></div></div>)}</div>
          {isFounder && brand.colors.length < 8 && <button className="mt-3 text-sm text-primary" disabled={busy} onClick={() => change({ colors: [...brand.colors, { name: `Cor ${brand.colors.length + 1}`, hex: '#075E47', use: 'Defina a finalidade desta cor.' }] })}>+ Adicionar cor</button>}
          <div className="mt-5 space-y-3">{(['heading_font', 'body_font'] as const).map((key, i) => <label key={key} className="block text-sm">{i ? 'Fonte dos textos' : 'Fonte dos títulos'}<input className={`${control} mt-1`} readOnly={!isFounder} disabled={busy} value={brand[key]} onChange={e => change({ [key]: e.target.value })} /></label>)}</div>
        </div>
      </section>
      {brand.reference_image && <section className="grid items-center gap-6 rounded-3xl border bg-card p-6 sm:grid-cols-[220px_1fr]"><BrandImage path={brand.reference_image} alt={`Referência visual de ${brand.name}`} className="w-full rounded-2xl" /><div><p className="text-xs font-semibold uppercase tracking-widest text-primary">Direção visual</p><h2 className="mt-2 text-2xl font-semibold">Este é o universo da marca.</h2><p className="mt-3 max-w-lg text-sm leading-relaxed text-muted-foreground">Uma referência de atmosfera, cores e composição. Cada nova peça deve ter sua própria mensagem, imagem e objetivo, mantendo a identidade da empresa.</p></div></section>}
      <fieldset disabled={busy} className="grid min-w-0 gap-5 md:grid-cols-2">{BRAND_FIELDS.map(([key, title, hint]) => <label key={key} className="block min-w-0 rounded-2xl border bg-card p-5"><span className="text-base font-semibold">{title}</span><span className="mb-3 mt-1 block text-xs text-muted-foreground">{hint}</span><textarea className={`${control} min-h-36 resize-y leading-relaxed`} maxLength={1600} readOnly={!isFounder} value={brand[key]} onChange={e => change({ [key]: e.target.value })} /></label>)}</fieldset>
      <section className="rounded-2xl border bg-card p-5"><h2 className="font-semibold">Pronta para orientar a equipe?</h2><p className="mt-2 text-sm text-muted-foreground">{missing.length ? `Falta conferir: ${missing.join(', ')}.` : 'Os campos essenciais estão preenchidos. A aprovação confirma que a equipe pode seguir esta identidade.'}</p><p className="mt-2 text-xs text-muted-foreground">Qualquer alteração salva como rascunho exige nova aprovação antes de liberar outra arte.</p></section>
      {isFounder && <div className="sticky bottom-4 flex flex-wrap items-center justify-end gap-3 rounded-2xl border bg-card/95 p-4 shadow-lg backdrop-blur"><span className="mr-auto text-sm text-muted-foreground">{dirty ? 'Alterações ainda não salvas' : brand.status === 'APPROVED' ? 'Identidade aprovada' : 'Confira e aprove a identidade'}</span><button disabled={busy} onClick={() => void save(false)} className="inline-flex items-center gap-2 rounded-xl border px-4 py-3 text-sm disabled:opacity-50"><Save size={16} />Salvar rascunho</button><button disabled={busy} onClick={() => void save(true)} className="inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-3 text-sm text-primary-foreground disabled:opacity-50"><Check size={16} />Aprovar identidade</button></div>}
    </>}
  </div>;
}
