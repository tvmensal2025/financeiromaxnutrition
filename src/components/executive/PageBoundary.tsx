import React, { Component, Suspense } from 'react';
import { useLocation } from 'react-router-dom';
import { RefreshCw } from 'lucide-react';

class PageErrorBoundary extends Component<{ children: React.ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  render() {
    if (this.state.failed) return <section className="he-page-recovery" role="alert">
      <RefreshCw size={26} aria-hidden="true"/>
      <h1>Vamos recuperar esta página.</h1>
      <p>Não foi possível abrir esta área. Recarregue para tentar novamente. Alterações que ainda não foram salvas podem ser perdidas.</p>
      <button onClick={() => window.location.reload()}>Recarregar página</button>
      <a href="/">Ir para o início</a>
    </section>;
    return this.props.children;
  }
}

export function PageBoundary({ children }: { children: React.ReactNode }) {
  const location = useLocation();
  return <PageErrorBoundary key={location.pathname}>
    <Suspense fallback={<div className="he-page-skeleton" role="status" aria-label="Abrindo página"><span/><span/><div><i/><i/><i/></div><p>Preparando seu espaço…</p></div>}>
      {children}
    </Suspense>
  </PageErrorBoundary>;
}
