import { expect, it } from 'vitest';
import { fonteHttpsPublica, lerPreparacaoCardReal, montarSolicitacaoCardReal, validarRevisaoPedidoReal } from './preparacao-real';

// Dados sintéticos exclusivos destes testes; nenhum valor é exibido no produto.
function arquivoDeTeste() {
  const hash = 'a'.repeat(64);
  const plano = { id: 'plano-local', empresas: ['BIZ-TESTE'] };
  const ordem = { empresa: 'BIZ-TESTE', pedido_original: 'Pedido de teste obtido da tarefa.', prazo: null,
    definicao_de_pronto_na_fonte: 'Critério original de teste.', como_e_o_pronto: [], nao_pode: [], fontes_que_pode_ler: [] };
  const captura = { fonte: 'management_read_only', projeto: { ref: 'ref-local' }, business_id: 'BIZ-TESTE',
    tarefa: { task_id: 'TSK-TESTE', business_id: 'BIZ-TESTE', tarefa: ordem.pedido_original },
    empresa: { business_id: 'BIZ-TESTE' }, proveniencia: { hash_sha256: hash } };
  return { estado: 'AGUARDANDO_CONFIRMACAO', tarefa_id: 'TSK-TESTE', business_id: 'BIZ-TESTE',
    pendencias: [{ campo: 'prazo', motivo: 'Prazo depende de confirmação no teste.' }],
    dados_reais: { decisoes: [], entradas_externas: {}, fontes_importadas: { 'FON-PEDIDO-TSK-TESTE': ordem.pedido_original }, pedido: { empresa: 'BIZ-TESTE', ordem_de_servico: ordem, plano,
      pacote_da_empresa: { estado: 'CONFIRMADO' } }, captura,
      proveniencia: { tarefa_id: 'TSK-TESTE', business_id: 'BIZ-TESTE', project_ref: 'ref-local', hash_sha256: hash } } };
}

it('recusa arquivo inválido ou de outra empresa e conserva o pedido original', () => {
  expect(() => lerPreparacaoCardReal('{')).toThrow('JSON válido');
  expect(() => lerPreparacaoCardReal('{}')).toThrow('aguardando confirmação');
  const arquivo = arquivoDeTeste();
  expect(lerPreparacaoCardReal(JSON.stringify(arquivo)).pedidoOriginal).toBe('Pedido de teste obtido da tarefa.');
  arquivo.dados_reais.captura.tarefa.business_id = 'BIZ-OUTRA';
  expect(() => lerPreparacaoCardReal(JSON.stringify(arquivo))).toThrow('não conferem');
});

it('exige confirmação explícita de prazo, critério, risco, restrições e fontes', () => {
  const preparacao = lerPreparacaoCardReal(JSON.stringify(arquivoDeTeste()));
  const agora = Date.parse('2026-10-13T12:00:00Z');
  const revisao = { prazo: '2026-10-20T15:00:00-03:00', criterios: [{ texto: 'Entrega verificável em teste', quem_confere: '' as const, risco: '' as const }],
    restricoes: '', semRestricoes: false, fontes: '', semFontes: false, conferido: false };
  expect(validarRevisaoPedidoReal(preparacao, revisao, agora)).toHaveLength(4);
  const confirmada = { ...revisao, criterios: [{ texto: 'Entrega verificável em teste', quem_confere: 'IA' as const, risco: 'ALTO' as const }],
    semRestricoes: true, semFontes: true, conferido: true };
  expect(validarRevisaoPedidoReal(preparacao, confirmada, agora)).toEqual([]);
  expect(validarRevisaoPedidoReal(preparacao, { ...confirmada, prazo: '2026-10-01T15:00:00-03:00' }, agora)).toContain('Informe prazo futuro em ISO 8601 no horário de Brasília (UTC−03:00), dentro de dez anos.');
  expect(validarRevisaoPedidoReal(preparacao, { ...confirmada, prazo: '2026-10-20T18:00:00Z' }, agora)).toContain('Informe prazo futuro em ISO 8601 no horário de Brasília (UTC−03:00), dentro de dez anos.');
  expect(validarRevisaoPedidoReal(preparacao, { ...confirmada, prazo: '2026-10-20T00:00:00-03:00' }, agora)).toEqual([]);
  const comRestricao = { ...confirmada, semRestricoes: false, restricoes: 'Entrega verificável em teste' };
  expect(validarRevisaoPedidoReal(preparacao, comRestricao, agora)).toEqual([]);
  expect(validarRevisaoPedidoReal(preparacao, { ...comRestricao, criterios: [{ ...confirmada.criterios[0], risco: 'BAIXO' as const }] }, agora))
    .toContain('Cada restrição deve aparecer também como critério com o mesmo texto, conferência por IA e risco alto.');
  const solicitacao = montarSolicitacaoCardReal(preparacao, confirmada, 'uuid-local');
  expect(solicitacao.configRevisionId).toBeNull();
  expect(solicitacao.plano).toEqual(arquivoDeTeste().dados_reais.pedido.plano);
  expect((solicitacao.dadosReais.pedido as { ordem_de_servico: { como_e_o_pronto: unknown[] } }).ordem_de_servico.como_e_o_pronto)
    .toEqual([{ id: 'CARD-1', texto: 'Entrega verificável em teste', quem_confere: 'IA', risco: 'ALTO' }]);
  expect((solicitacao.dadosReais.captura as { tarefa: { tarefa: string } }).tarefa.tarefa).toBe('Pedido de teste obtido da tarefa.');
});

it('aceita somente URL HTTPS pública sem credenciais, consulta ou fragmento', () => {
  expect(fonteHttpsPublica('https://www.gov.br/assunto')).toBe(true);
  for (const fonte of ['http://www.gov.br', 'https://localhost/arquivo', 'https://192.168.1.1/fato',
    'https://usuario:senha@site.com', 'https://site.com/fato?q=segredo', 'https://site.com/fato#secao',
    'https://site.com/invite', 'https://site.com/ref', 'https://site.com/verificar-email', 'https://kubernetes.default/']) {
    expect(fonteHttpsPublica(fonte)).toBe(false);
  }
});
