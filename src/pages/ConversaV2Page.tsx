import { Link } from 'react-router-dom';
import { useAuth } from '@/auth';
import { EntradaPedidosV2 } from './EntradaPedidosV2';

export default function ConversaV2Page() {
  const { user, isFounder } = useAuth();
  if (!user || !isFounder) return <main className="mx-auto max-w-4xl p-6"><h1 className="text-3xl font-semibold">Conversa</h1><p className="mt-3">A entrada de pedidos está disponível somente para o fundador.</p></main>;
  return <main className="mx-auto max-w-5xl space-y-6 px-4 py-7 sm:px-8">
    <header className="rounded-3xl bg-emerald-950 p-7 text-white"><p className="text-xs uppercase tracking-widest text-emerald-200">Sistema Helena · pedido v2</p><h1 className="mt-2 text-3xl font-semibold">Conversa com a Helena</h1><p className="mt-3 max-w-3xl text-emerald-50/90">Escreva um pedido para receber acompanhamento, perguntas e uma proposta versionada na esteira v2. As respostas aparecem conforme o motor processar o pedido; esta tela não é um chat instantâneo.</p></header>
    <EntradaPedidosV2 identidade={user.id} />
    <p className="text-sm text-muted-foreground">Depois da confirmação, acompanhe o card e suas etapas no <Link to="/cards" className="font-semibold text-emerald-800 underline dark:text-emerald-400">quadro de cards</Link>.</p>
  </main>;
}
