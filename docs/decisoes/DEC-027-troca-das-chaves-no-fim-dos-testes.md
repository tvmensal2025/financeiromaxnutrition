# DEC-027 — Troca das chaves de acesso ao banco: no fim dos testes

- **Data:** 10/10/2026
- **Número:** PROVISÓRIO. O Supabase é a fonte dos números; antes de usar este número, conferir lá (só leitura) que ele está livre.
- **Quem decidiu:** o fundador, respondendo na sessão do Claude Code de 10/10/2026.

## O que foi decidido
A troca das chaves de acesso ao banco fica para **o fim dos testes**, como já estava combinado (a DEC-019 já adiava a rotação). A fase 0a não inclui essa troca.

## Por quê
Escolha do fundador: manter o combinado antigo.

## Risco aceito
Até a troca, a chave de acesso total continua valendo, e ela está escrita em 9 arquivos rastreados do repositório (mais 2 com a chave pública). Medidas enquanto isso:
- o repositório continua privado;
- nenhum arquivo novo pode ter chave (varredura a cada envio);
- os arquivos com chave devem passar a ler de variável de ambiente, sem trocar o valor (**ainda não feito**);
- a troca é item do portão final dos testes.

O roteiro de troca está em `docs/manual/troca-de-chaves.md`.

## Fonte
`docs/arquivo/sessao-20261010/DECISOES-DO-FUNDADOR-20261010.md`
