import { fireEvent, render, screen, within } from '@testing-library/react';
import { expect, it } from 'vitest';
import AgentesAba from './AgentesAba';
import { dadosVazios, type CardComando, type DadosComando, type EtapaComando } from '@/integrations/comando-v2/tipos';

const AGORA = new Date('2026-10-17T15:00:00Z');
const h = (horas: number) => new Date(AGORA.getTime() - horas * 3_600_000).toISOString();
const card = (id: string, empresa = 'BIZ-003'): CardComando => ({
  id, titulo: `Card ${id}`, empresa, estado: 'EM_ANDAMENTO', dono: 'HELENA', prazo: h(-48), criado_em: h(5),
  atualizado_em: h(0.2), prazo_ate: h(-48), prioridade: 1,
});
const etapa = (id: string, cardId: string, extra: Partial<EtapaComando> = {}): EtapaComando => ({
  id, codigo: `E-${id}`, nome: `Etapa ${id}`, estado: 'EXECUTANDO', autor: 'BIANCA', dono: 'BIANCA', prazo_ate: h(-5), revisores: [],
  versao: 1, portao1_ok: false, entrega_fresca: true, card_id: cardId, ordem: 1, atualizado_em: h(0.1), execucoes: 0, ...extra,
});
function dados(extra: Partial<DadosComando> = {}): DadosComando {
  return {
    ...dadosVazios(AGORA),
    catalogo: {
      revisao: 'rev-9',
      empresas: [{ id: 'BIZ-003', nome: 'Humano Digital', pacote: 'CONFIRMADO' }, { id: 'BIZ-001', nome: 'iGreen', pacote: 'CONFIRMADO' }],
      agentes: [
        { id: 'AGT-01', identidade: 'HELENA', nome: 'Helena', cargo: 'Coordenadora', grupo: 'Coordenação', estado: 'ESTAGIO', fase: 'Fase 1' },
        { id: 'AGT-02', identidade: 'BIANCA', nome: 'Bianca', cargo: 'Pessoas e funções', grupo: 'Execução', estado: 'ATIVO' },
        { id: 'AGT-03', identidade: 'LEO', nome: 'Léo', cargo: 'Finanças', grupo: 'Execução', estado: 'PAUSADO' },
      ],
      servicos: [{ id: 'SRV-1', nome: 'Perfil de função', dono: 'BIANCA', revisor: 'HELENA', estado: 'ATIVO', empresas: ['BIZ-003'] }],
    },
    estado: { cards: 'pronta', etapas: 'pronta', entregas: 'pronta', pedidos: 'pronta', catalogo: 'pronta' },
    cards: [card('a'), card('b', 'BIZ-001')],
    etapas: [
      etapa('1', 'a'), etapa('2', 'b'), etapa('3', 'a', { estado: 'APROVADA' }),
      etapa('4', 'a', { autor: 'HELENA', estado: 'REVISAO', revisores: ['BIANCA'] }),
    ],
    ...extra,
  };
}
const montar = (d: DadosComando, empresa = 'GRUPO') => render(<AgentesAba dados={d} empresa={empresa} abrirCard={() => undefined} />);
const cartao = (nome: string) => within(screen.getByRole('listitem', { name: `Agente ${nome}` }));

it('agrupa por grupo, traduz o estado e mostra a carga atual e os serviços do dono', () => {
  montar(dados());
  expect(screen.getByRole('region', { name: 'Grupo Coordenação' })).toBeTruthy();
  expect(screen.getByRole('region', { name: 'Grupo Execução' })).toBeTruthy();
  const bianca = cartao('Bianca');
  expect(bianca.getByText('Configuração: Ativo')).toBeTruthy();
  expect(bianca.getByText('etapas abertas como autor').parentElement!.textContent).toContain('2');
  expect(bianca.getByText('revisões pendentes').parentElement!.textContent).toContain('1');
  expect(bianca.getByText('Perfil de função')).toBeTruthy();
  const helena = cartao('Helena');
  expect(helena.getByText('Configuração: Em estágio')).toBeTruthy();
  expect(helena.getByText('Fase: Fase 1')).toBeTruthy();
  expect(helena.getByText('Nenhum serviço no cadastro ativo.')).toBeTruthy();
});

it('mostra o aviso de que o estado não prova operação', () => {
  montar(dados());
  expect(screen.getByText('O estado vem da configuração ativa e não prova que o agente esteja operando.')).toBeTruthy();
});

it('busca por nome e filtra por estado', () => {
  montar(dados());
  fireEvent.change(screen.getByRole('searchbox', { name: /Buscar agente/ }), { target: { value: 'leo' } });
  expect(screen.getAllByRole('listitem', { name: /^Agente / })).toHaveLength(1);
  expect(screen.getByRole('listitem', { name: 'Agente Léo' })).toBeTruthy();
  fireEvent.change(screen.getByRole('searchbox', { name: /Buscar agente/ }), { target: { value: '' } });
  fireEvent.click(screen.getByRole('button', { name: /Ativo/ }));
  expect(screen.getAllByRole('listitem', { name: /^Agente / })).toHaveLength(1);
  expect(screen.getByRole('listitem', { name: 'Agente Bianca' })).toBeTruthy();
  fireEvent.change(screen.getByRole('searchbox', { name: /Buscar agente/ }), { target: { value: 'zzz' } });
  expect(screen.getByText('Nenhum agente neste filtro')).toBeTruthy();
});

it('respeita o filtro de empresa na carga', () => {
  montar(dados(), 'BIZ-001');
  expect(cartao('Bianca').getByText('etapas abertas como autor').parentElement!.textContent).toContain('1');
  expect(cartao('Bianca').getByText('revisões pendentes').parentElement!.textContent).toContain('0');
  expect(screen.getAllByText(/Carga contada só em iGreen/).length).toBeGreaterThan(0);
});

it('carga com erro de leitura aparece como indisponível, nunca como zero', () => {
  montar(dados({ estado: { ...dados().estado, etapas: 'erro' } }));
  expect(screen.getByText('Não foi possível ler a carga dos agentes')).toBeTruthy();
  const bianca = cartao('Bianca');
  expect(bianca.getAllByLabelText('indisponível')).toHaveLength(2);
  expect(bianca.getByText('Configuração: Ativo')).toBeTruthy();
});

it('erro na configuração mostra erro; carregando mostra carregando; vazio verdadeiro é honesto', () => {
  const { unmount } = montar(dados({ estado: { ...dados().estado, catalogo: 'erro' } }));
  expect(screen.getByText('Não foi possível ler os agentes')).toBeTruthy();
  unmount();
  const { unmount: u2 } = montar(dados({ estado: { ...dados().estado, catalogo: 'carregando' } }));
  expect(screen.getByRole('status', { name: 'Carregando os agentes' })).toBeTruthy();
  u2();
  montar(dados({ catalogo: { revisao: 'r', empresas: [], agentes: [], servicos: [] } }));
  expect(screen.getByText('Nenhum agente na configuração ativa')).toBeTruthy();
});
