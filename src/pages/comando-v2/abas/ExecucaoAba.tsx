/**
 * O que é: aba "Central de execução" da Sala de comando v2. Só leitura: mostra o que espera você, o que está em
 * trabalho e em revisão, pedidos em preparo, falhas e travas e atrasos, em blocos com até 5 itens e "ver todos".
 * Como mudar: as regras de cada bloco ficam em src/integrations/comando-v2/derivar-execucao.ts; o desenho do bloco em
 * src/components/comando-v2/BlocoExecucao.tsx. Esta aba só liga os dois ao filtro de agente.
 */
import { useId, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { AlertTriangle, ArrowRight, ClipboardList, Clock3, Cog, Eye, Hourglass, Inbox, Rocket } from 'lucide-react';
import { BlocoExecucao } from '@/components/comando-v2/BlocoExecucao';
import { ExecutiveMetricCard } from '@/components/executive/ExecutiveMetricCard';
import { derivarExecucao, estadoCombinado, nomeEmpresa } from '@/integrations/comando-v2/derivar-execucao';
import type { PropsAba } from '@/integrations/comando-v2/tipos';

export default function ExecucaoAba({ dados, empresa, abrirCard }: PropsAba) {
  const [agente, setAgente] = useState('');
  const idSelect = useId();
  const { estado, catalogo } = dados;
  const exec = useMemo(() => derivarExecucao(dados, empresa, agente), [dados, empresa, agente]);

  const fonteCards = estado.cards;
  const fonteEtapas = estadoCombinado(estado.etapas, estado.cards);
  const fonteFalhas = estadoCombinado(estado.cards, estado.etapas);
  const agentes = [...catalogo.agentes].sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'));
  const agenteExiste = agentes.some(a => a.identidade === agente);
  const aviso = dados.amostra ? 'Leitura limitada a uma amostra recente: pode haver mais itens no banco.' : undefined;
  const notaPedidos = [
    agente ? 'Pedidos ainda não têm agente: o filtro de agente não muda este bloco.' : null,
    exec.pedidosSemEmpresa > 0 ? `${exec.pedidosSemEmpresa} ${exec.pedidosSemEmpresa === 1 ? 'pedido ainda sem empresa fica' : 'pedidos ainda sem empresa ficam'} fora do filtro de empresa.` : null,
    aviso ?? null,
  ].filter(Boolean).join(' ');
  const metrica = (fonte: ReturnType<typeof estadoCombinado>, total: number) => ({
    hasData: fonte === 'pronta', value: fonte === 'pronta' ? total : null,
  });

  return (
    <div className="space-y-5" data-aba="execucao">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div className="min-w-0">
          <h2 className="text-lg font-semibold tracking-tight text-foreground">Central de execução</h2>
          <p className="mt-0.5 max-w-2xl text-sm text-muted-foreground">
            O que está acontecendo agora nos cards{empresa !== 'GRUPO' ? ` de ${nomeEmpresa(catalogo, empresa)}` : ' de todas as empresas'}.
            Esta tela só mostra; as decisões são tomadas dentro de cada card.
          </p>
        </div>
        <div className="flex flex-col gap-1">
          <label htmlFor={idSelect} className="text-xs font-medium text-muted-foreground">Agente</label>
          <select id={idSelect} value={agenteExiste ? agente : ''} onChange={e => setAgente(e.target.value)}
            disabled={agentes.length === 0} aria-label="Filtrar por agente"
            className="min-h-11 w-full min-w-[12rem] rounded-md border border-input bg-background px-3 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-60 sm:w-auto">
            <option value="">Todos os agentes</option>
            {agentes.map(a => <option key={a.id} value={a.identidade}>{a.nome}</option>)}
          </select>
        </div>
      </header>

      {dados.amostra && (
        <p role="note" className="rounded-lg border border-warning/40 bg-warning/10 px-3 py-2 text-xs text-foreground">
          Amostra: a leitura foi cortada por limite. As contagens abaixo valem para o que foi lido, não para o banco inteiro.
        </p>
      )}
      {estado.catalogo === 'erro' && (
        <p role="note" className="rounded-lg border border-border bg-muted/20 px-3 py-2 text-xs text-muted-foreground">
          Não foi possível ler o catálogo de agentes e empresas: os nomes aparecem como códigos e o filtro de agente fica indisponível.
        </p>
      )}

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-5" aria-label="Resumo da execução">
        <ExecutiveMetricCard label="Esperando você" icon={Hourglass} subtext="Cards com decisão sua" {...metrica(fonteCards, exec.esperando.total)} />
        <ExecutiveMetricCard label="Em trabalho" icon={Cog} subtext="Etapas sendo feitas" {...metrica(fonteEtapas, exec.trabalho.total)} />
        <ExecutiveMetricCard label="Em revisão" icon={Eye} subtext="Etapas com revisor" {...metrica(fonteEtapas, exec.revisao.total)} />
        <ExecutiveMetricCard label="Falhas e travas" icon={AlertTriangle} subtext="Pedem atenção" {...metrica(fonteFalhas, exec.falhas.total)} />
        <ExecutiveMetricCard label="Atrasados" icon={Clock3} subtext="Prazo já passou" className="col-span-2 lg:col-span-1" {...metrica(fonteCards, exec.atrasados.total)} />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <BlocoExecucao id="esperando" titulo="Esperando você" icone={Hourglass} tom="atencao" estado={fonteCards}
          descricao="Cards parados até você confirmar ou decidir." itens={exec.esperando.itens} total={exec.esperando.total}
          vazio="Nada esperando por você agora." nota={aviso} abrirCard={abrirCard} />
        <BlocoExecucao id="atrasados" titulo="Atrasados" icone={Clock3} tom="perigo" estado={fonteCards}
          descricao="Cards abertos cujo prazo já passou." itens={exec.atrasados.itens} total={exec.atrasados.total}
          vazio="Nenhum card aberto está com o prazo vencido." nota={aviso} abrirCard={abrirCard} />
        <BlocoExecucao id="trabalho" titulo="Em trabalho" icone={Cog} estado={fonteEtapas}
          descricao="Etapas que um agente está executando agora." itens={exec.trabalho.itens} total={exec.trabalho.total}
          vazio="Nenhuma etapa em execução neste momento." nota={aviso} abrirCard={abrirCard} />
        <BlocoExecucao id="revisao" titulo="Em revisão" icone={Eye} estado={fonteEtapas}
          descricao="Etapas entregues que aguardam o revisor." itens={exec.revisao.itens} total={exec.revisao.total}
          vazio="Nenhuma etapa em revisão neste momento." nota={aviso} abrirCard={abrirCard} />
        <BlocoExecucao id="pedidos" titulo="Pedidos em preparo" icone={Inbox} estado={estado.pedidos}
          descricao="Pedidos recebidos que ainda não viraram card." itens={exec.pedidos.itens} total={exec.pedidos.total}
          vazio="Nenhum pedido em preparo." nota={notaPedidos || undefined} abrirCard={abrirCard} />
        <BlocoExecucao id="falhas" titulo="Falhas e travas" icone={AlertTriangle} tom="perigo" estado={fonteFalhas}
          descricao="Cards encerrados com falha, com motivo de trava, ou etapas que não passaram no portão 1."
          itens={exec.falhas.itens} total={exec.falhas.total} vazio="Nenhuma falha ou trava registrada." nota={aviso} abrirCard={abrirCard} />
      </div>

      <BlocoExecucao id="externas" titulo="Ações externas e publicação" icone={Rocket}
        descricao="Aqui não há números: esta tela não lê ações externas nem publicação.">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm text-muted-foreground">
            Ações externas (como enviar ou publicar algo fora do sistema) e o estado da publicação são vistos dentro de cada card.
            Abra o card para conferir o que foi proposto, autorizado ou feito.
          </p>
          <Link to="/cards" aria-label="Ver cards para conferir ações externas e publicação"
            className="inline-flex min-h-11 shrink-0 items-center justify-center gap-2 rounded-md border border-input bg-background px-4 text-sm font-medium text-foreground hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
            <ClipboardList className="h-4 w-4" aria-hidden="true" />Ver cards<ArrowRight className="h-4 w-4" aria-hidden="true" />
          </Link>
        </div>
      </BlocoExecucao>
    </div>
  );
}
