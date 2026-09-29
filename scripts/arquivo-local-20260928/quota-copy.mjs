import fs from 'node:fs';
const path='src/components/executive/SupervisionPanel.tsx';
let s=fs.readFileSync(path,'utf8');
for(const [a,b] of [
 ['Gastar quando há<br/>trabalho que justifique.','Preservar a cota.<br/>Cobrar entregas claras.'],
 ['O consumo da conta Grok ainda não está conectado a esta página.','A cota semanal de tarefas do Grok Bot é separada de tokens e da cota do Codex/Cursor. O saldo ainda não está conectado a esta página.'],
 ['Cota e custo do Grok','Cota semanal · Grok Bot'],
 ['PROTEÇÃO FINANCEIRA','ORÇAMENTO DE TAREFAS'],
 ['Limite diário não confirmado','Saldo semanal não conectado'],
 ['Não há medição de tokens ou custo nos registros de execução consultados. Quantidade de tarefas não equivale a consumo de cota.','Os registros mostram trabalhos e tentativas, mas não o percentual consumido no Grok Bot. Não é possível converter essas contagens em cota semanal.'],
 ['Para bloquear excesso, o executor precisa reservar orçamento antes de cada chamada, por empresa e agente, e conciliar o uso real depois.','Cada pedido deve ter escopo fechado e critério de aceite. Comparar o saldo antes e depois permite avaliar o consumo; o bloqueio automático depende de acesso e controle no Grok Bot.'],
 ['Orçamento antes da chamada','Cota antes de iniciar'],
 ['Teto por empresa e agente, reserva atômica, alerta e bloqueio quando o limite for atingido.','Registrar saldo semanal, definir quanto pode ser usado por entrega e exigir revisão antes de ampliar o escopo. Conectar a medição ao Grok Bot.'],
 ['Nenhum limite financeiro ou agendamento de produção foi ativado por esta página.','Nenhum limite de cota ou agendamento do Grok Bot foi alterado por esta página.'],
 ['zero execuções ou zero gasto','zero execuções ou zero consumo de cota'],
 ]) s=s.replace(a,b);
fs.writeFileSync(path,s);
const p='src/pages/HelenaInboxPage.tsx';
fs.writeFileSync(p,'import React from "react";\nimport ComandoPage from "./ComandoPage";\n\n// The executive inbox uses live exceptions, never a fixed sample or local approval.\nexport default function HelenaInboxPage() {\n  return <ComandoPage inicial="Supervisão"/>;\n}\n');
