import { useEffect, useRef, useState } from 'react';
import { repositorioPareamentoTelegramV2DoApp } from '@/integrations/telegram-v2/runtime';
import type { CodigoPareamentoTelegramV2, RepositorioPareamentoTelegramV2, StatusPareamentoTelegramV2 } from '@/integrations/telegram-v2/repository';

type Props = { identidade: string; repositorio?: RepositorioPareamentoTelegramV2 };
const BOT = 'https://t.me/hermes_helena_oficial_bot';

export function PareamentoTelegramV2(props: Props) { return <Pareamento key={props.identidade} {...props} />; }

function Pareamento({ repositorio }: Props) {
  const [repo, setRepo] = useState<RepositorioPareamentoTelegramV2 | null>(repositorio ?? null);
  const [status, setStatus] = useState<StatusPareamentoTelegramV2 | null>(null);
  const [codigo, setCodigo] = useState<CodigoPareamentoTelegramV2 | null>(null);
  const [agora, setAgora] = useState(Date.now());
  const [consultando, setConsultando] = useState(true);
  const [acao, setAcao] = useState<'gerando' | 'revogando' | null>(null);
  const [confirmarRevogacao, setConfirmarRevogacao] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);
  const [tentativaConexao, setTentativaConexao] = useState(0);
  const [tentativaConsulta, setTentativaConsulta] = useState(0);
  const vivo = useRef(true);
  const trava = useRef(false);
  const consultaAtual = useRef(0);

  useEffect(() => { vivo.current = true; return () => { vivo.current = false; }; }, []);
  useEffect(() => {
    if (repositorio) { setRepo(repositorio); return; }
    let ativo = true;
    setErro(null);
    repositorioPareamentoTelegramV2DoApp().then(valor => { if (ativo) setRepo(valor); }).catch(() => {
      if (ativo) { setConsultando(false); setErro('Não foi possível conectar o pareamento Telegram. Tente novamente.'); }
    });
    return () => { ativo = false; };
  }, [repositorio, tentativaConexao]);

  useEffect(() => {
    if (!repo) return;
    let ativo = true;
    const numero = ++consultaAtual.current;
    setConsultando(true);
    setStatus(null);
    repo.consultar().then(valor => {
      if (!ativo || !vivo.current || consultaAtual.current !== numero) return;
      setStatus(valor);
      if (valor.vinculado || !valor.codigo_pendente) setCodigo(null);
      if (valor.vinculado) setConfirmarRevogacao(false);
      setErro(null);
    }).catch(() => {
      if (ativo && vivo.current && consultaAtual.current === numero) setErro('Não foi possível confirmar a situação do Telegram no banco. Consulte novamente.');
    }).finally(() => {
      if (ativo && vivo.current && consultaAtual.current === numero) setConsultando(false);
    });
    return () => { ativo = false; };
  }, [repo, tentativaConsulta]);

  useEffect(() => {
    if (!codigo) return;
    setAgora(Date.now());
    const timer = window.setInterval(() => setAgora(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, [codigo]);
  useEffect(() => {
    if (codigo && agora >= Date.parse(codigo.expira_em)) {
      setCodigo(null);
      setAviso('O código expirou. Consulte o vínculo e gere outro código para tentar novamente.');
    }
  }, [agora, codigo]);

  async function gerar() {
    if (!repo || !status || status.vinculado || trava.current || consultando) return;
    trava.current = true;
    ++consultaAtual.current;
    setAcao('gerando');
    setCodigo(null);
    setErro(null);
    setAviso(null);
    try {
      const resposta = await repo.gerar();
      if (vivo.current) { setCodigo(resposta); setAgora(Date.now()); }
    } catch {
      if (vivo.current) {
        setStatus(null);
        setErro('Não foi possível confirmar a geração do código. Consulte o vínculo antes de tentar novamente.');
        setTentativaConsulta(n => n + 1);
      }
    } finally {
      if (vivo.current) { trava.current = false; setAcao(null); }
    }
  }

  async function revogar() {
    if (!repo || !status?.vinculado || !confirmarRevogacao || trava.current || consultando) return;
    trava.current = true;
    ++consultaAtual.current;
    setAcao('revogando');
    setStatus(null);
    setCodigo(null);
    setConfirmarRevogacao(false);
    setErro(null);
    try {
      const resposta = await repo.revogar();
      if (vivo.current) { setStatus(resposta); setAviso('Vínculo revogado conforme confirmação do banco.'); }
    } catch {
      if (vivo.current) {
        setErro('Não foi possível confirmar a revogação. A situação será consultada novamente antes de mostrar o vínculo.');
        setTentativaConsulta(n => n + 1);
      }
    } finally {
      if (vivo.current) { trava.current = false; setAcao(null); }
    }
  }

  const segundos = codigo ? Math.max(0, Math.ceil((Date.parse(codigo.expira_em) - agora) / 1000)) : 0;
  const tempo = `${Math.floor(segundos / 60)}:${String(segundos % 60).padStart(2, '0')}`;
  return <section aria-label="Pareamento Telegram" className="rounded-xl border border-border bg-card p-5 sm:p-6">
    <h2 className="text-xl font-semibold">Telegram da Helena</h2>
    <p className="mt-2 max-w-3xl text-sm text-muted-foreground">Vincule sua conta ao bot para identificar seu chat. O vínculo, por si só, não registra pedidos nem inicia trabalhos.</p>
    {erro && <p role="alert" className="mt-3 text-sm text-destructive">{erro}</p>}
    {aviso && <p role="status" className="mt-3 text-sm">{aviso}</p>}
    {(consultando || acao) && <p role="status" className="mt-3 text-sm text-muted-foreground">{acao === 'gerando' ? 'Gerando código…' : acao === 'revogando' ? 'Conferindo revogação…' : 'Consultando vínculo…'}</p>}
    {!repo && <button type="button" onClick={() => setTentativaConexao(n => n + 1)} className="min-h-11 mt-2 text-sm font-semibold underline">Tentar conectar Telegram</button>}
    {repo && <button type="button" disabled={consultando || !!acao} onClick={() => { setErro(null); setTentativaConsulta(n => n + 1); }}
      className="min-h-11 mt-2 text-sm font-semibold underline disabled:opacity-50">Consultar vínculo</button>}

    {!consultando && !acao && status?.vinculado && <div className="mt-4 rounded-lg border border-emerald-700/30 bg-emerald-50 p-4 text-sm dark:bg-emerald-950/30">
      <p className="font-semibold">Telegram vinculado conforme consulta ao banco</p>
      <p className="mt-2 break-all">Chat: {status.chat_id}</p>
      <p className="mt-1 break-all">Usuário Telegram: {status.usuario_id}</p>
      <p className="mt-1">Vinculado em: {new Date(status.vinculado_em!).toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' })}</p>
      {!confirmarRevogacao ? <button type="button" onClick={() => setConfirmarRevogacao(true)} className="min-h-11 mt-3 font-semibold text-destructive underline">Revogar vínculo</button>
        : <div className="mt-3 rounded-lg border border-destructive/40 p-3">
          <p>Revogar este vínculo impedirá que este chat seja reconhecido como sua conta até um novo pareamento. Confirme somente se deseja desvincular o chat {status.chat_id}.</p>
          <div className="mt-2 flex flex-wrap gap-3">
            <button type="button" onClick={() => void revogar()} className="min-h-11 rounded-lg bg-destructive px-4 py-2 font-semibold text-destructive-foreground">Confirmar revogação</button>
            <button type="button" onClick={() => setConfirmarRevogacao(false)} className="min-h-11 font-semibold underline">Manter vínculo</button>
          </div>
        </div>}
    </div>}

    {!consultando && !acao && status && !status.vinculado && <div className="mt-4 space-y-3 text-sm">
      <p className="font-semibold">Nenhum Telegram vinculado nesta conta.</p>
      {codigo ? <div role="status" className="rounded-lg border border-amber-500/40 bg-amber-50 p-4 dark:bg-amber-950/30">
        <p className="font-semibold">Código de uso único: expira em {tempo}</p>
        <p className="mt-2 break-all font-mono select-all" aria-label="Código de pareamento">{codigo.codigo}</p>
        <p className="mt-2">Abra uma conversa privada com <a href={BOT} target="_blank" rel="noopener noreferrer" className="min-h-11 inline-flex items-center font-semibold text-emerald-800 underline dark:text-emerald-400">@hermes_helena_oficial_bot</a> e envie ao bot a mensagem <code>/vincular &lt;código acima&gt;</code>.</p>
        <p className="mt-2 text-muted-foreground">O código aparece apenas nesta tela e não é colocado no link. Depois de enviar, use “Consultar vínculo”.</p>
      </div> : <>
        {status.codigo_pendente && <p>Há um código pendente emitido anteriormente. Ele não pode ser mostrado novamente; gere outro se precisar.</p>}
        <button type="button" onClick={() => void gerar()} className="min-h-11 rounded-lg bg-emerald-800 px-4 py-2 font-semibold text-white hover:bg-emerald-900">Gerar código de pareamento</button>
      </>}
    </div>}
  </section>;
}
