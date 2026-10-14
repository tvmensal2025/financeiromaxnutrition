import { useEffect, useState } from 'react';
import type { EtapaV2, PerguntaEtapaFundadorV2, RepositorioCardsV2 } from '@/integrations/cards-v2/repository';
import { alvoEtapa } from '@/integrations/cards-v2/acoes-fundador';
import { AcoesFundadorV2 } from './AcoesFundadorV2';

type Props = { etapa: EtapaV2; cardId: string; identidade: string; repositorio: RepositorioCardsV2; onAtualizar: () => Promise<void> };

export function PerguntaFundadorV2({ etapa, cardId, identidade, repositorio, onAtualizar }: Props) {
  const [pergunta, setPergunta] = useState<PerguntaEtapaFundadorV2 | null>(null);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);
  const [tentativa, setTentativa] = useState(0);
  useEffect(() => {
    let ativo = true;
    setCarregando(true);
    setPergunta(null);
    setErro(null);
    repositorio.lerPerguntaEtapaFundador(etapa.id).then(dado => {
      if (!ativo) return;
      if (!dado || dado.card_id !== cardId || dado.etapa_id !== etapa.id || dado.versao !== etapa.versao
          || typeof dado.pergunta !== 'string' || !dado.pergunta.trim() || !Array.isArray(dado.opcoes)
          || dado.opcoes.length < 2 || dado.opcoes.length > 3
          || dado.opcoes.some((opcao, indice) => opcao.letra !== ['A', 'B', 'C'][indice]
            || !opcao.texto?.trim() || !opcao.consequencia?.trim())) {
        setErro('A pergunta atual não está disponível com contexto completo. Nenhuma resposta pode ser enviada.');
      } else setPergunta(dado);
    }).catch(() => { if (ativo) setErro('Não foi possível ler a pergunta atual. Nenhuma resposta pode ser enviada.'); })
      .finally(() => { if (ativo) setCarregando(false); });
    return () => { ativo = false; };
  }, [repositorio, etapa.id, etapa.versao, cardId, tentativa]);
  return <section aria-label={`Pergunta da etapa ${etapa.codigo}`} className="mt-4 rounded-lg border border-border p-4 text-sm">
    {carregando && <p role="status">Consultando pergunta atual…</p>}
    {erro && <div role="alert"><p>{erro}</p><button type="button" onClick={() => setTentativa(n => n + 1)} className="mt-2 min-h-11 font-semibold underline">Consultar pergunta novamente</button></div>}
    {pergunta && <>
      <h4 className="font-semibold">Pergunta atual da etapa</h4>
      <p className="mt-2 whitespace-pre-wrap break-words">{pergunta.pergunta}</p>
      <ul className="mt-3 space-y-2">{pergunta.opcoes.map(opcao => <li key={opcao.letra} className="rounded-lg bg-muted/40 p-3">
        <strong>{opcao.letra} · {opcao.texto}</strong><p className="mt-1 text-muted-foreground">Consequência: {opcao.consequencia}</p>
      </li>)}</ul>
      <AcoesFundadorV2 alvo={alvoEtapa(etapa)} identidade={identidade} cardId={cardId} repositorio={repositorio}
        onAtualizar={onAtualizar} opcoesPermitidas={pergunta.opcoes.map(opcao => `RESPOSTA_${opcao.letra}`)} />
    </>}
  </section>;
}
