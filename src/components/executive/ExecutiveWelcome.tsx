import { ArrowUpRight, Check, Layers3, Sparkles, Users } from 'lucide-react';
import { Link } from 'react-router-dom';

/** Navigation only; operational metrics remain in their owning pages. */
export function ExecutiveWelcome({ company, part = 'intro' }: { company: string; part?: 'intro' | 'navigation' }) {
  return <section className="he-workspace" aria-label="Seu espaço de trabalho">
    {part === 'intro' && <div className="he-workspace-intro">
      <div><span className="he-workspace-kicker"><span /> SEU NEGÓCIO, EM MOVIMENTO</span>
        <h2>Tudo conectado.<br /><em>Você no comando.</em></h2></div>
      <p>Um espaço para transformar planos em entregas.<br /><strong>{company}</strong>, com clareza em cada próximo passo.</p>
    </div>}
    {part === 'navigation' && <nav className="he-workspace-cards" aria-label="Acessos rápidos">
      <Link to="/entregas" className="he-destination he-destination-deliveries">
        <div className="he-destination-top"><span>01 / ENTREGAS</span><ArrowUpRight /></div>
        <div className="he-folder-scene" aria-hidden="true"><span className="he-folder-back"/><span className="he-folder-front"><Check size={26}/></span><span className="he-folder-label">FEITO PARA VOCÊ</span></div>
        <div className="he-destination-copy"><h3>Do plano ao pronto.</h3><p>Suas imagens, textos e materiais finais.</p></div>
      </Link>
      <Link to="/identidade" className="he-destination he-destination-brand">
        <div className="he-destination-top"><span>02 / SUA MARCA</span><ArrowUpRight /></div>
        <div className="he-brand-scene" aria-hidden="true"><span>Aa</span><i/><i/><i/></div>
        <div className="he-destination-copy"><h3>Uma identidade. Sua.</h3><p>Essência, cores e referências da empresa.</p></div>
      </Link>
      <Link to="/equipe" className="he-destination he-destination-team">
        <div className="he-destination-top"><span>03 / EQUIPE DIGITAL</span><ArrowUpRight /></div>
        <div className="he-team-scene" aria-hidden="true"><span><Layers3/></span><span><Users/></span><span><Sparkles/></span></div>
        <div className="he-destination-copy"><h3>Talentos conectados.</h3><p>Conheça quem transforma suas ideias.</p></div>
      </Link>
    </nav>}
  </section>;
}
