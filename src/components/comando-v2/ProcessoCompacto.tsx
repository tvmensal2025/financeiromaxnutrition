/**
 * O que é: o quadro de cards em miniatura (somente leitura): quantos cards há em cada coluna. Cada coluna leva à aba Cards.
 * Como mudar: as colunas e os estados de cada uma ficam em COLUNAS_PROCESSO (derivar-visao-geral.ts); mantenha iguais ao Kanban.
 */
import { Link } from 'react-router-dom';
import { cardsDaEmpresa, contagemPorColuna } from '@/integrations/comando-v2/derivar-visao-geral';
import { PorLeitura, type PropsVisao } from './KpisComando';
import { amostraDe } from '@/integrations/comando-v2/derivar-cards';

export default function ProcessoCompacto({ dados, empresa }: PropsVisao) {
  return <section aria-labelledby="processo-titulo" className="rounded-xl border border-border bg-card p-4 sm:p-5">
    <h2 id="processo-titulo" className="text-base font-semibold tracking-tight text-foreground">Processo</h2>
    <p className="mt-0.5 text-xs text-muted-foreground">Onde cada card está no quadro. Só leitura: toque numa coluna para abrir os cards.</p>
    <div className="mt-4">
      <PorLeitura estados={[dados.estado.cards]} oQue="o processo" linhas={2}>
        <ul className="grid grid-cols-2 gap-2">
          {contagemPorColuna(cardsDaEmpresa(dados.cards, empresa)).map(col => (
            <li key={col.id} className={col.id === 'encerrado' ? 'col-span-2' : ''}>
              <Link to="/comando?aba=cards" aria-label={`${col.titulo}: ${col.quantidade} ${col.quantidade === 1 ? 'card' : 'cards'}${amostraDe(dados, ['cards']) ? ' na amostra' : ''}. Abrir a aba Cards`}
                className={`flex min-h-11 flex-col rounded-lg border p-3 transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${col.id === 'fundador' && col.quantidade > 0 ? 'border-warning/50 bg-warning/10' : 'border-border bg-background/50'}`}>
                <span className="break-words text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{col.titulo}</span>
                <span className="mt-1 text-2xl font-semibold tracking-tight text-foreground">{col.quantidade}</span>
              </Link>
            </li>
          ))}
        </ul>
      </PorLeitura>
    </div>
  </section>;
}
