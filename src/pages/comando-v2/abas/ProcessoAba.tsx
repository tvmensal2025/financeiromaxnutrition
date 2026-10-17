/**
 * O que é: aba "Processo" da Sala de comando v2: o quadro das etapas por estado (ProcessoBoard) e um texto fixo e simples
 * que explica o ciclo de um pedido na v2.
 * Como mudar: o agrupamento e os rótulos ficam em derivar-cards.ts; o quadro em components/comando-v2/ProcessoBoard.tsx.
 * Honestidade: precisa de cards e etapas; se uma das leituras falhou mostra erro (nunca zero), e `dados.amostra` avisa.
 * Etapas "em resolução", canceladas ou encerradas com falha não têm coluna no quadro e ficam fora da contagem das colunas.
 */
import { ExecutiveEmptyState } from '@/components/executive/ExecutiveEmptyState';
import { ExecutiveErrorState } from '@/components/executive/ExecutiveErrorState';
import { ExecutiveLoadingState } from '@/components/executive/ExecutiveLoadingState';
import { AvisoAmostra } from '@/components/comando-v2/ListaCards';
import { ProcessoBoard } from '@/components/comando-v2/ProcessoBoard';
import type { PropsAba } from '@/integrations/comando-v2/tipos';
import {
  combinarLeituras, EMPRESA_GRUPO, ESTADOS_ETAPA_PROCESSO, etapasDaEmpresa, mensagemFalha, nomeEmpresa,
} from '@/integrations/comando-v2/derivar-cards';

const CICLO = [
  { titulo: 'Pedido', texto: 'Você escreve o que quer, do seu jeito.' },
  { titulo: 'Leitura de volta', texto: 'A Helena conta o que entendeu e como será o "pronto".' },
  { titulo: 'Sua confirmação', texto: 'Nada começa sem o seu ok.' },
  { titulo: 'Validação do plano', texto: 'O sistema confere o plano antes de qualquer trabalho.' },
  { titulo: 'Etapas', texto: 'Cada etapa tem um autor e um revisor diferente.' },
  { titulo: 'Card pronto', texto: 'Todas as etapas aprovadas. "Pronto" não significa publicado.' },
];

export default function ProcessoAba({ dados, empresa, abrirCard }: PropsAba) {
  const leitura = combinarLeituras(dados.estado, ['cards', 'etapas']);
  const ciclo = (
    <section aria-label="Como funciona o ciclo" className="rounded-xl border border-border bg-card p-4">
      <h2 className="text-sm font-semibold text-foreground">Como um pedido vira card pronto</h2>
      <ol className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {CICLO.map((passo, indice) => (
          <li key={passo.titulo} className="flex min-w-0 gap-3">
            <span aria-hidden="true" className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-primary/10 text-xs font-semibold text-primary">{indice + 1}</span>
            <span className="min-w-0">
              <strong className="block text-sm text-foreground">{passo.titulo}</strong>
              <span className="block text-xs text-muted-foreground">{passo.texto}</span>
            </span>
          </li>
        ))}
      </ol>
    </section>
  );

  let corpo;
  if (leitura.estado === 'erro') {
    corpo = <ExecutiveErrorState title="Não foi possível carregar o processo" message={mensagemFalha(leitura.falhas)} />;
  } else if (leitura.estado === 'carregando') {
    corpo = <ExecutiveLoadingState message="Carregando o processo" type="cards" rows={4} />;
  } else {
    const etapas = etapasDaEmpresa(dados.etapas, dados.cards, empresa);
    const noQuadro = etapas.filter(etapa => (ESTADOS_ETAPA_PROCESSO as readonly string[]).includes(etapa.estado)).length;
    corpo = etapas.length === 0 ? (
      <ExecutiveEmptyState
        title="Nenhuma etapa por enquanto"
        description={empresa === EMPRESA_GRUPO
          ? 'As etapas aparecem depois que um card tem o plano validado.'
          : `Ainda não há etapas para ${nomeEmpresa(dados.catalogo, empresa)}.`}
      />
    ) : (
      <>
        <p className="text-xs text-muted-foreground">
          {noQuadro} {noQuadro === 1 ? 'etapa no quadro' : 'etapas no quadro'}{dados.amostra ? ' (na amostra lida)' : ''}. Toque em uma etapa para abrir o card.
        </p>
        <ProcessoBoard etapas={etapas} cards={dados.cards} catalogo={dados.catalogo} agora={dados.agora} onAbrirCard={abrirCard} />
      </>
    );
  }

  return (
    <div className="min-w-0 space-y-4">
      {dados.amostra && <AvisoAmostra />}
      {ciclo}
      {corpo}
    </div>
  );
}
