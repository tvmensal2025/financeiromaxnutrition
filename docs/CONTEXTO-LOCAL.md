# Helena-HUB

Espaço local de trabalho e continuidade do Sistema Helena.

## Local

`C:\Users\USUARIO\Documents\Codex\Helena-HUB`

Esta pasta contém o repositório `tvmensal2025/financeiromaxnutrition`, baixado em 26/09/2026, e os documentos locais de continuidade. A branch `main` acompanha `origin/main`; commit importado: `1560fff6837e02d54c658ea3fa9435e82d6a4209`. O banco canônico continua no Supabase; não foi criada uma réplica local.

O README da raiz e o .gitignore agora são os originais do repositório. Os anteriores foram preservados em `work/base-inicial/`. Os documentos locais adicionais estão excluídos do versionamento por `.git/info/exclude`, mantendo o código baixado intacto.

## Fonte oficial

- Projeto Supabase: `ecosistemadossonhos`
- Project Ref: `wxkgrykduqtsgmjkzlou`
- Entrada obrigatória: `public.checkpoint_mestre_atual`
- Comando de leitura: **Helena, carregue o Checkpoint Mestre.**
- Comando de atualização: **Helena, sincronize o Checkpoint Mestre.**

O carregamento apenas consulta e valida. A sincronização exige mudança material e autorização explícita para escrita. Documentos locais são registros históricos; confirme sempre o estado atual no Supabase.

## Organização

- `AGENTS.md`: orientações para as próximas sessões.
- `docs/COMANDO-MESTRE.txt`: cópia integral do procedimento enviado pelo fundador.
- `docs/AUDITORIA-INICIAL.md`: resultado da verificação inicial, quando finalizada.
- `helena-hub.json`: identificação do projeto, sem credenciais.
- `work/`: arquivos temporários locais, fora do versionamento.

## Abrir como projeto local

Na área de projetos do Codex, adicione um projeto local e selecione a pasta acima. Use o nome **Helena-HUB**. O cadastro na barra lateral ainda depende dessa seleção pela interface.

## Continuidade

Leia `AGENTS.md` e o comando mestre antes de atuar. Reutilize os sistemas existentes. Não declare integrações operacionais ou tarefas concluídas sem evidência. Preserve WIP executivo = 1.

Preparado em 26/09/2026. Nenhuma alteração no Supabase foi autorizada por esta preparação local.

## Ambiente instalado

Atualizado em 26/09/2026 para `main`, commit `7a205311161867cf71c01f719f77475443f8b842`.

- Dependências instaladas com `npm ci` (492 pacotes; arquivo de versões preservado).
- Node 22.22.0 e npm 10.9.4 já disponíveis na máquina.
- `npm run build`: aprovado.
- `npm test`: 41 testes aprovados em 4 arquivos.
- Endereço desta cópia: http://localhost:8082/ — tela de login verificada.
- As portas 8080 e 8081 estavam ocupadas por outras cópias; nenhuma foi encerrada.

O servidor está em segundo plano, limitado a 127.0.0.1. Seus dados de processo e logs estão em `work/local-server.json` e `work/local-server.*.log`.

Para reiniciar depois de desligar o servidor, abra um terminal nesta pasta e use:

```sh
npm run dev -- --host 127.0.0.1 --port 8082 --strictPort
```

A tela exige a conta já autorizada no Sistema Helena. Nesta preparação não foi efetuado login nem alterado o banco.
