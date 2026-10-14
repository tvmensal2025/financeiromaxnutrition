import React from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, within, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import "@testing-library/jest-dom/vitest";
import { MemoryRouter } from "react-router-dom";

vi.stubGlobal('ResizeObserver', class { observe() {} unobserve() {} disconnect() {} });

const mock = vi.hoisted(() => ({ from: vi.fn(), business: "BIZ-001", failTasks: false, sources: {} as Record<string, unknown[]> }));
vi.mock("@/lib/supabase", () => ({ supabase: { from: mock.from } }));
vi.mock("@/contexts/BusinessContext", () => ({ useBusiness: () => ({ currentBusinessId: mock.business, isConsolidated: mock.business === "GRUPO", rotulo: mock.business }) }));
import ComandoPage from "./ComandoPage";

beforeEach(() => {
  mock.business = "BIZ-001"; mock.failTasks = false; mock.sources = {};
  mock.from.mockImplementation((tabela: string) => ({ select: () => ({ order: () => ({ range: () => ({ abortSignal: () => Promise.resolve({
    data: mock.sources[tabela] ?? (tabela === "tarefas" ? [{task_id:"T1",tarefa:"Entrega empresa um",business_id:"BIZ-001",status:"NÃO INICIADA",responsavel:"Helena"},{task_id:"T2",tarefa:"Entrega empresa dois",business_id:"BIZ-002",status:"BLOQUEADA",responsavel:"Theo"}] : []),
    error: tabela === "tarefas" && mock.failTasks ? {message:"Leitura negada"} : null,
    count: mock.sources[tabela]?.length ?? (tabela === "tarefas" ? 2 : 0),
  }) }) }) }) }));
});

describe("Sala de comando", () => {
  it("mostra a agenda pausada sem anunciar execução automática", async () => {
    mock.sources.recorrencias = [{recurrence_id:'REC-0001',nome:'Revisão diária',business_id:'GRUPO',status:'PAUSADA'}];
    render(<MemoryRouter><ComandoPage inicial="Supervisão"/></MemoryRouter>);
    expect(await screen.findByText(/Agenda anterior pausada/)).toHaveTextContent('precisa ser configurada e testada');
    expect(screen.queryByText(/Agenda no Codex: 18h/)).not.toBeInTheDocument();
  });
  it("não presume agenda ativa quando o registro não está disponível", async () => {
    render(<MemoryRouter><ComandoPage inicial="Supervisão"/></MemoryRouter>);
    await screen.findByRole('button',{name:/T1 · BIZ-001/});
    expect(screen.getByText(/Agenda não confirmada nesta leitura/)).toBeInTheDocument();
  });
  it("coloca bloqueios primeiro e abre a fila filtrada sem alterar os registros", async () => {
    mock.business='GRUPO';
    const user=userEvent.setup();
    render(<MemoryRouter><ComandoPage/></MemoryRouter>);
    await user.click(await screen.findByRole('button',{name:'Ver o que está travado'}));
    expect(screen.getByRole('combobox')).toHaveValue('BLOQUEADA');
    expect(screen.queryByRole('button',{name:/T1 · BIZ-001/})).not.toBeInTheDocument();
    await user.click(screen.getByRole('button',{name:/T2 · BIZ-002/}));
    expect(screen.getByRole('dialog')).toHaveTextContent('Theo');
  });
  it("mostra exceções da empresa e abre a entrega na supervisão", async () => {
    const user = userEvent.setup();
    render(<MemoryRouter><ComandoPage inicial="Supervisão"/></MemoryRouter>);
    const alerta = await screen.findByRole('button',{name:/T1 · BIZ-001/});
    expect(screen.queryByText('Entrega empresa dois')).not.toBeInTheDocument();
    await user.click(alerta);
    expect(screen.getByRole('dialog')).toHaveTextContent('Entrega empresa um');
  });
  it("não confunde fila vazia com consumo zero do Grok Bot", async () => {
    render(<MemoryRouter><ComandoPage inicial="Consumo"/></MemoryRouter>);
    expect(await screen.findByText(/Nenhum job visível neste recorte/)).toBeInTheDocument();
    expect(screen.getByText('Saldo semanal não conectado')).toBeInTheDocument();
    expect(screen.getByText(/cota semanal de tarefas do Grok Bot é separada/)).toBeInTheDocument();
  });
  it("abre o resumo da pendência e mantém a navegação dentro da busca", async () => {
    mock.business = "GRUPO";
    const user = userEvent.setup();
    render(<MemoryRouter><ComandoPage/></MemoryRouter>);
    await within(screen.getByRole("region", {name:"Fluxo visual das tarefas"})).findByRole("button", {name:/T1.*Entrega empresa um/});
    await user.click(screen.getByRole("button",{name:"Tarefas"}));
    await user.type(screen.getByRole("textbox",{name:"Buscar tarefa ou responsável"}),"empresa dois");
    expect(screen.queryByRole("button",{name:/T1 · BIZ-001/})).not.toBeInTheDocument();
    await user.click(screen.getByRole("button",{name:/T2 · BIZ-002/}));
    const dialog = screen.getByRole("dialog");
    expect(dialog).toHaveTextContent("Theo");
    expect(dialog).toHaveTextContent("Destravar a dependência");
    expect(dialog).toHaveTextContent("motivo não foi informado");
    expect(dialog).toHaveTextContent("Informações a completar");
    expect(within(dialog).getByRole("button",{name:"Próxima tarefa"})).toBeDisabled();
    expect(within(dialog).getByRole("button",{name:"Tarefa anterior"})).toBeDisabled();
  });
  it("uma falha de leitura não vira contagem zero ou sucesso", async () => {
    mock.failTasks = true;
    render(<MemoryRouter><ComandoPage/></MemoryRouter>);
    expect(await screen.findByRole("alert")).toHaveTextContent("Leitura incompleta: tarefas");
    const metrica = screen.getByText("Tarefas abertas").closest("article")!;
    expect(within(metrica).getByText("—")).toBeInTheDocument();
    expect(screen.queryByText("Entrega empresa um")).not.toBeInTheDocument();
  });
  it("troca de empresa atualiza o recorte e fecha detalhes antigos", async () => {
    const user = userEvent.setup();
    const view = render(<MemoryRouter><ComandoPage/></MemoryRouter>);
    const card = await within(screen.getByRole("region", {name:"Fluxo visual das tarefas"})).findByRole("button", {name:/T1.*Entrega empresa um/});
    expect(screen.queryByText("Entrega empresa dois")).not.toBeInTheDocument();
    await user.click(card);
    expect(await screen.findByRole("dialog")).toHaveTextContent("Entrega empresa um");
    await user.keyboard("{Escape}");
    await waitFor(() => expect(card).toHaveFocus());
    await user.click(card);
    mock.business = "BIZ-002";
    view.rerender(<MemoryRouter><ComandoPage/></MemoryRouter>);
    expect(await within(screen.getByRole("region", {name:"Fluxo visual das tarefas"})).findByRole("button",{name:/T2.*Entrega empresa dois/})).toBeInTheDocument();
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(screen.queryByText("Entrega empresa um")).not.toBeInTheDocument();
  });
  it("mostra o fluxo por etapa e filtra os cartões por empresa", async () => {
    mock.business = "GRUPO";
    const user = userEvent.setup();
    render(<MemoryRouter><ComandoPage/></MemoryRouter>);
    const fluxo = await screen.findByRole("region", {name:"Fluxo visual das tarefas"});
    expect(within(fluxo).getByText("A fazer")).toBeInTheDocument();
    expect(within(fluxo).getByText("Travadas")).toBeInTheDocument();
    expect(within(fluxo).getByText("Entrega empresa um")).toBeInTheDocument();
    expect(within(fluxo).getByText("Entrega empresa dois")).toBeInTheDocument();
    await user.selectOptions(within(fluxo).getByRole("combobox", {name:"Empresa no fluxo"}), "BIZ-001");
    expect(within(fluxo).getByText("Entrega empresa um")).toBeInTheDocument();
    expect(within(fluxo).queryByText("Entrega empresa dois")).not.toBeInTheDocument();
  });
  it("separa execução sem vínculo e mostra decisões do escopo autorizado", async () => {
    mock.sources.agent_jobs = [{job_id:"J1",task_id:null,agent_id:"AGT-01",business_id:"BIZ-001",objective:"Executar rotina A",status:"COMPLETED",attempt_count:1,max_attempts:3,evidence_refs:["relatorio-1"],approval_required:false,approval_status:"NOT_REQUIRED",result_summary:"Resultado A",created_at:"2026-09-25T10:00:00Z",updated_at:"2026-09-25T11:00:00Z"}];
    mock.sources.agent_job_events = [
      {event_id:"E0",job_id:"J1",agent_id:"AGT-01",business_id:"BIZ-001",event_type:"PROGRESS",message:"Diagnóstico concluído",payload:{reason:"Evitar retrabalho",next_step:"Validar entrega",evidence_refs:["AUD-001"]},created_at:"2026-09-25T10:30:00Z"},
      {event_id:"E1",job_id:"J1",agent_id:"AGT-01",business_id:"BIZ-001",event_type:"COMPLETED",message:"Encerrado",created_at:"2026-09-25T11:00:00Z"}
    ];
    mock.sources.decisoes = [{decision_id:"D1",business_id:"BIZ-001",decisao:"Direção A",decisor:"Fundador",status:"ATIVA"},{decision_id:"D2",business_id:"BIZ-002",decisao:"Direção B",decisor:"Fundador",status:"ATIVA"}];
    const user = userEvent.setup();
    render(<MemoryRouter><ComandoPage/></MemoryRouter>);
    await user.click(await screen.findByRole("button", {name:"Acompanhamento"}));
    expect(screen.getByText("Vínculos ainda ausentes")).toBeInTheDocument();
    await user.click(screen.getByText("Executar rotina A"));
    expect(screen.getByText("Resultado A")).toBeInTheDocument();
    expect(screen.getByText(/Evitar retrabalho/)).toBeInTheDocument();
    expect(screen.getByText(/Validar entrega/)).toBeInTheDocument();
    await user.click(screen.getByRole("button", {name:"Decisões registradas"}));
    expect(screen.getByText("Direção A")).toBeInTheDocument();
    expect(screen.queryByText("Direção B")).not.toBeInTheDocument();
  });
  it("explica jobs criados, testes globais e testes de WhatsApp encerrados sem resposta", async () => {
    mock.business = "GRUPO";
    mock.sources.agentes = [{agent_id:"AGT-09",agente:"Theo"},{agent_id:"AGT-20",agente:"Victor"}];
    mock.sources.agent_jobs = [
      {job_id:"JOB-GATEWAY-1",task_id:null,agent_id:"AGT-09",business_id:null,objective:"Homologar conexão individual com o Helena Gateway MCP",correlation_id:"HOMOLOG-GATEWAY-ALL20-20260925",status:"READY",attempt_count:0,max_attempts:3,approval_required:false,approval_status:"NOT_REQUIRED",created_at:"2026-09-25T11:00:00Z",updated_at:"2026-09-25T11:00:00Z"},
      {job_id:"JOB-WPP-PENDENTE",task_id:null,agent_id:"AGT-20",business_id:"BIZ-001",objective:"Atendimento WhatsApp: mensagem pendente",correlation_id:null,status:"READY",attempt_count:0,max_attempts:3,approval_required:false,approval_status:"NOT_REQUIRED",created_at:"2026-09-26T01:00:00Z",updated_at:"2026-09-26T01:00:00Z"},
      {job_id:"JOB-WPP-TESTE",task_id:null,agent_id:"AGT-20",business_id:"BIZ-001",objective:"Atendimento WhatsApp: teste",correlation_id:null,status:"COMPLETED",attempt_count:1,max_attempts:3,approval_required:false,approval_status:"NOT_REQUIRED",result_summary:"TESTE DO FUNDADOR — encerrado sem resposta ao cliente",started_at:"2026-09-26T02:00:00Z",completed_at:"2026-09-26T02:01:00Z",created_at:"2026-09-26T01:00:00Z",updated_at:"2026-09-26T02:01:00Z"},
    ];
    mock.sources.agent_job_events = [{event_id:"E1",job_id:"JOB-WPP-TESTE",agent_id:"AGT-20",business_id:"BIZ-001",event_type:"STARTED",created_at:"2026-09-26T02:00:00Z"}];
    const user = userEvent.setup();
    render(<MemoryRouter><ComandoPage/></MemoryRouter>);
    await user.click(await screen.findByRole("button", {name:"Acompanhamento"}));
    expect(screen.getByText("2 ainda na fila")).toBeInTheDocument();
    expect(screen.getByText(/1 teste de WhatsApp encerrado sem resposta ao cliente/)).toBeInTheDocument();
    expect(screen.getByRole("button", {name:/TESTES DE CONEXÃO DOS AGENTES/})).toHaveTextContent("1");
    const lote = screen.getByText("Testes de conexão dos agentes").closest("details")!;
    expect(lote.open).toBe(false);
    await user.click(screen.getByText("Testes de conexão dos agentes"));
    expect(lote.open).toBe(true);
    await user.click(screen.getByText("Testes de conexão dos agentes"));
    expect(lote.open).toBe(false);
    await user.click(screen.getByRole("button", {name:/MENSAGENS DO WHATSAPP/}));
    expect(screen.getByText(/2 de 3 jobs neste recorte/)).toBeInTheDocument();
    await user.click(screen.getByRole("button", {name:/Na fila/}));
    expect(screen.getByText(/1 de 3 jobs neste recorte/)).toBeInTheDocument();
    expect(screen.getByText("Atendimento WhatsApp: mensagem pendente")).toBeInTheDocument();
    expect(screen.queryByText("Atendimento WhatsApp: teste")).not.toBeInTheDocument();
  });
  it("liga somente execuções e auditorias com identificador explícito à tarefa", async () => {
    mock.sources.agent_jobs = [{job_id:"J1",task_id:"T1",agent_id:"AGT-01",business_id:"BIZ-001",objective:"Executar entrega um",status:"COMPLETED",attempt_count:1,max_attempts:2,evidence_refs:[],approval_required:false,approval_status:"NOT_REQUIRED",created_at:"2026-09-25T10:00:00Z",updated_at:"2026-09-25T11:00:00Z"}];
    mock.sources.auditoria = [{audit_id:"A1",sheet:"tarefas",object_id:"T1 (BIZ-001)",acao:"ALTERAÇÃO",campo:"status",agente_usuario:"Marina",data_hora:"25/09 11:00"},{audit_id:"A2",sheet:"tarefas",object_id:"T2 (BIZ-002)",acao:"ALTERAÇÃO",campo:"evidencia",agente_usuario:"Theo",data_hora:"25/09 11:10"}];
    mock.sources.task_activity = [{event_id:1,task_id:"T1",business_id:"BIZ-001",event_type:"UPDATE",changed_fields:["status"],status_before:"NÃO INICIADA",status_after:"EM EXECUÇÃO",actor_uid:null,actor_role:"service_role",occurred_at:"2026-09-25T10:30:00Z"}];
    const user = userEvent.setup();
    render(<MemoryRouter><ComandoPage/></MemoryRouter>);
    await user.click(await within(screen.getByRole("region", {name:"Fluxo visual das tarefas"})).findByRole("button", {name:/T1.*Entrega empresa um/}));
    const dialog = screen.getByRole("dialog");
    expect(within(dialog).getByText("Executar entrega um")).toBeInTheDocument();
    expect(within(dialog).getByText("NÃO INICIADA → EM EXECUÇÃO")).toBeInTheDocument();
    expect(within(dialog).getByText("ALTERAÇÃO · status")).toBeInTheDocument();
    expect(within(dialog).queryByText("ALTERAÇÃO · evidencia")).not.toBeInTheDocument();
  });
});
