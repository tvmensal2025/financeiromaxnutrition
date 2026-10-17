/**
 * O que é: a saudação do topo da Visão geral (bom dia/boa tarde/boa noite pela hora de São Paulo) e a frase com quantos
 * cards esperam o fundador e quantos estão atrasados, com atalho para a lista "O que decidir agora".
 * Como mudar: o nome vem de `useAuth()`; a frase vem de `kpis()`. Sem leitura de cards pronta, não mostramos número.
 */
import { ArrowDown } from 'lucide-react';
import { useAuth } from '@/auth';
import { cardsDaEmpresa, fraseBoasVindas, ID_PRIORIDADES, kpis, nomeDeExibicao, saudacaoPorHora } from '@/integrations/comando-v2/derivar-visao-geral';
import type { PropsVisao } from './KpisComando';

export default function BoasVindas({ dados, empresa }: PropsVisao) {
  const { user } = useAuth();
  const nome = nomeDeExibicao(user as Parameters<typeof nomeDeExibicao>[0]);
  const pronto = dados.estado.cards === 'pronta';
  const k = pronto ? kpis(cardsDaEmpresa(dados.cards, empresa), dados.agora) : null;
  const saudacao = saudacaoPorHora(dados.agora);

  function irParaPrioridades() {
    const alvo = document.getElementById(ID_PRIORIDADES);
    if (!alvo) return;
    alvo.scrollIntoView?.({ behavior: 'smooth', block: 'start' });
    alvo.focus({ preventScroll: true });
  }

  return <section aria-labelledby="boas-vindas-titulo"
    className="rounded-xl border border-primary/20 bg-primary/5 p-5 sm:p-6">
    <h2 id="boas-vindas-titulo" className="text-xl font-semibold tracking-tight text-foreground sm:text-2xl">
      {saudacao}{nome ? `, ${nome}` : ''}.
    </h2>
    <p className="mt-1 text-sm text-muted-foreground">
      {fraseBoasVindas(dados.estado.cards, k?.esperando ?? 0, k?.atrasados ?? 0, dados.amostra)}
    </p>
    {pronto && k && (k.esperando > 0 || k.atrasados > 0) && (
      <button type="button" onClick={irParaPrioridades}
        className="mt-3 inline-flex min-h-11 items-center gap-2 rounded-md border border-primary/40 bg-card px-4 text-sm font-semibold text-primary transition-colors hover:bg-primary/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
        Ver o que decidir <ArrowDown className="h-4 w-4" aria-hidden="true" />
      </button>
    )}
  </section>;
}
