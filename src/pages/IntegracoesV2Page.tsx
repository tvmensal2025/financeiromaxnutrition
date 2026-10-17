import { Link } from 'react-router-dom';
import { useAuth } from '@/auth';
import { PareamentoTelegramV2 } from './PareamentoTelegramV2';

export default function IntegracoesV2Page() {
  const { user, isFounder } = useAuth();
  if (!user || !isFounder) return <main className="mx-auto max-w-4xl p-6"><h1 className="text-3xl font-semibold">Integrações</h1><p className="mt-3">O pareamento está disponível somente para o fundador.</p></main>;
  return <main className="mx-auto max-w-5xl space-y-6 px-4 py-7 sm:px-8">
    <header className="rounded-3xl bg-emerald-950 p-7 text-white"><p className="text-xs uppercase tracking-widest text-emerald-200">Sistema Helena · canais</p><h1 className="mt-2 text-3xl font-semibold">Integrações</h1><p className="mt-3 max-w-3xl text-emerald-50/90">Gerencie o vínculo da sua conta com o Telegram. O vínculo é consultado no banco; ele não comprova webhook, Edge, transporte ou resposta do bot em funcionamento.</p></header>
    <PareamentoTelegramV2 identidade={user.id} />
    <section className="rounded-xl border border-border bg-card p-5"><h2 className="text-xl font-semibold">Entrada de pedidos</h2><p className="mt-2 text-sm text-muted-foreground">Pedidos feitos no site usam a esteira v2. A operação do canal Telegram exige verificação própria de ponta a ponta.</p><Link to="/conversa" className="mt-3 inline-flex min-h-11 items-center font-semibold text-emerald-800 underline dark:text-emerald-400">Abrir entrada de pedidos</Link></section>
  </main>;
}
