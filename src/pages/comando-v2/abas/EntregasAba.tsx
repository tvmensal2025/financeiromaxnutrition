/**
 * O que é: aba "Entregas" da Sala de comando v2: galeria das entregas aprovadas, com busca, agrupamento e leitura do texto
 * sob demanda. Só leitura.
 * Como mudar: a lista e o carregamento do texto ficam em src/components/comando-v2/EntregaGaleria.tsx.
 */
import { EntregaGaleria } from '@/components/comando-v2/EntregaGaleria';
import { nomeEmpresa } from '@/integrations/comando-v2/derivar-execucao';
import type { PropsAba } from '@/integrations/comando-v2/tipos';

export default function EntregasAba({ dados, empresa, abrirCard }: PropsAba) {
  return (
    <div className="space-y-4" data-aba="entregas">
      <header>
        <h2 className="text-lg font-semibold tracking-tight text-foreground">Entregas aprovadas</h2>
        <p className="mt-0.5 max-w-2xl text-sm text-muted-foreground">
          Resultados que passaram no portão 1{empresa !== 'GRUPO' ? `, de ${nomeEmpresa(dados.catalogo, empresa)}` : ', de todas as empresas'}.
          Abra uma entrega para ler o texto e copiá-lo. Aprovada no portão 1 não quer dizer publicada.
        </p>
      </header>
      <EntregaGaleria dados={dados} empresa={empresa} abrirCard={abrirCard} />
    </div>
  );
}
