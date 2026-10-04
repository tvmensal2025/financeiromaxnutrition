import { useEffect, useMemo, useRef, useState } from 'react';
import * as Dialog from '@radix-ui/react-dialog';
import { ArrowUpRight, ImageOff, Maximize2, RefreshCw, X } from 'lucide-react';
import { deliveryArtifacts } from '@/lib/entrega-artefatos';
import { signedMedia } from '@/lib/media-client';

type Props = { businessId: string; jobId: string; references: unknown; title: string; compact?: boolean };

/** Signed links are fetched only for visible cards. A failed image never looks like an empty delivered artwork. */
export function DeliveryGallery({ businessId, jobId, references, title, compact = false }: Props) {
  const assets = useMemo(() => deliveryArtifacts(references, businessId, jobId), [references, businessId, jobId]);
  const host = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(!compact);
  const [attempt, setAttempt] = useState(0);
  const [urls, setUrls] = useState<Record<string, string>>({});
  const [failed, setFailed] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState<string | null>(null);
  const visibleAssets = compact ? assets.slice(0, 1) : assets;
  const requestKey = visibleAssets.map(asset => asset.reference).join('|');

  useEffect(() => {
    if (!compact || !host.current) return;
    if (!('IntersectionObserver' in window)) { setVisible(true); return; }
    const observer = new IntersectionObserver(entries => {
      if (entries.some(entry => entry.isIntersecting)) { setVisible(true); observer.disconnect(); }
    }, { rootMargin: '150px' });
    observer.observe(host.current);
    return () => observer.disconnect();
  }, [compact]);

  useEffect(() => {
    if (!visible || !requestKey) return;
    let active = true;
    setLoading(true); setUrls({}); setFailed([]);
    const timer = window.setTimeout(() => { active = false; setLoading(false); }, 20000);
    void signedMedia(businessId, requestKey.split('|'), jobId).then(items => {
      if (!active) return;
      const next: Record<string, string> = {};
      for (const item of items || []) if (!item.error && item.url && requestKey.split('|').includes(item.reference)) next[item.reference] = item.url;
      setUrls(next);
    }).catch(() => { /* Explicit unavailable state below, with manual retry. */ }).finally(() => {
      if (active) { window.clearTimeout(timer); setLoading(false); }
    });
    return () => { active = false; window.clearTimeout(timer); };
  }, [visible, requestKey, businessId, jobId, attempt]);

  useEffect(() => {
    if (compact || !requestKey) return;
    let refreshed = Date.now();
    const renew = () => {
      if (!document.hidden && Date.now() - refreshed >= 240000) {
        refreshed = Date.now(); setAttempt(value => value + 1);
      }
    };
    const timer = window.setInterval(renew, 240000);
    document.addEventListener('visibilitychange', renew);
    return () => { window.clearInterval(timer); document.removeEventListener('visibilitychange', renew); };
  }, [compact, requestKey]);

  if (!assets.length) return null;
  const unavailable = visibleAssets.some(asset => !urls[asset.reference] || failed.includes(asset.reference));
  const fail = (reference: string) => setFailed(previous => previous.includes(reference) ? previous : [...previous, reference]);
  const label = (slot: string) => slot === 'post' ? 'Post' : `Story ${slot.slice(-1)}`;

  return <div ref={host} className={compact ? 'he-delivery-cover' : 'he-artwork-gallery'}>
    {!compact && <div className="he-gallery-heading"><div><p className="he-eyebrow">SEU MATERIAL VISUAL</p><h3>As artes, em detalhe.</h3><p>Abra uma peça para conferir o texto e a composição em tamanho maior.</p></div><span>{assets.length} {assets.length === 1 ? 'arquivo' : 'arquivos'}</span></div>}
    <div className={compact ? '' : 'he-artwork-grid'}>{visibleAssets.map(asset => <div key={asset.reference} className="he-artwork-item">
      {urls[asset.reference] && !failed.includes(asset.reference) ? compact
        ? <img src={urls[asset.reference]} alt={`Prévia de ${title}`} loading="lazy" onError={() => fail(asset.reference)} />
        : <button className="he-artwork-preview" aria-label={`Ampliar ${label(asset.slot)}, versão ${asset.version}`} onClick={() => setExpanded(asset.reference)}><img src={urls[asset.reference]} alt={`${label(asset.slot)}: ${title}`} onError={() => fail(asset.reference)} /><span><Maximize2 size={16} /> Ampliar arte</span></button>
        : <div className="he-artwork-placeholder" role="status">{loading ? <><RefreshCw className="animate-spin" size={24} /><span>Preparando a imagem…</span></> : <><ImageOff size={26} /><span>Não foi possível abrir esta imagem.</span>{compact && <small>Abra a entrega para tentar novamente.</small>}</>}</div>}
      {!compact && <div className="he-artwork-caption"><span>{label(asset.slot)} <small>Versão {asset.version}</small></span>{urls[asset.reference] && !failed.includes(asset.reference) && <a href={urls[asset.reference]} target="_blank" rel="noopener noreferrer">Abrir original <ArrowUpRight size={15} /></a>}</div>}
    </div>)}</div>
    {compact && <span className="he-cover-count">{assets.length} {assets.length === 1 ? 'arte' : 'artes'}</span>}
    {!compact && !loading && unavailable && <div className="he-gallery-retry" role="status"><p>A imagem pode estar temporariamente indisponível ou o acesso ter expirado. O arquivo registrado permanece preservado.</p><button onClick={() => setAttempt(value => value + 1)}><RefreshCw size={16} /> Tentar abrir novamente</button></div>}
    {!compact && <Dialog.Root open={!!expanded} onOpenChange={open => { if (!open) setExpanded(null); }}><Dialog.Portal><Dialog.Overlay className="he-artwork-backdrop" /><Dialog.Content className="he-artwork-lightbox" aria-describedby={undefined}><Dialog.Title className="sr-only">Arte ampliada: {title}</Dialog.Title><Dialog.Close className="he-artwork-close" aria-label="Fechar ampliação"><X /></Dialog.Close>{expanded && urls[expanded] && !failed.includes(expanded) ? <img src={urls[expanded]} alt={title} onError={() => fail(expanded)} /> : <p>A imagem expirou. Feche a ampliação e tente abrir novamente.</p>}</Dialog.Content></Dialog.Portal></Dialog.Root>}
  </div>;
}
