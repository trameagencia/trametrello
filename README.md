# TRAME – quadros de tarefas

Sistema da agência TRAME no estilo Trello: um quadro por cliente, colunas e cartões que a equipe e o cliente movem, comentam e anexam arquivos.

- **Coluna só da equipe:** qualquer coluna pode ser marcada como "só equipe". O cliente não vê essa coluna nem os cartões dela (nem por link, busca ou tempo real). A regra fica no banco de dados (Row Level Security), não só na tela.
- **Checklist de peças:** cada cartão tem a lista de peças a entregar, com responsável, prazo e anexo da peça pronta. A equipe e o cliente veem o progresso (ex.: 3/5).
- **Ver como cliente:** a equipe pode ver o quadro exatamente como o cliente enxerga.

Stack: Next.js 16 + TypeScript + Tailwind, Supabase (Postgres, Auth, Storage, Realtime), dnd-kit. Hospedagem: Vercel + Supabase.

## Papéis

| Papel | Vê | Pode |
| --- | --- | --- |
| Admin (a primeira pessoa a entrar no sistema) | Todos os quadros | Tudo, inclusive criar quadros |
| Equipe TRAME (no quadro) | Tudo do quadro, inclusive colunas só da equipe | Editar tudo, gerenciar colunas e membros |
| Cliente – pode editar | Tudo, menos colunas só da equipe | Criar e editar cartões e peças, comentar, anexar, mover |
| Cliente – comenta e move (padrão) | Tudo, menos colunas só da equipe | Comentar, anexar, mover cartões, marcar peças |
| Cliente – só vê | Tudo, menos colunas só da equipe | Apenas ver |

## Colocar no ar

1. **Supabase:** crie um projeto em [supabase.com](https://supabase.com). Em *SQL Editor*, cole e rode o arquivo `supabase/migrations/0001_init.sql`.
   (Ou, com a CLI: `npx supabase link --project-ref SEU_REF && npx supabase db push`.)
2. **Supabase > Authentication > URL Configuration:** em *Site URL* coloque o endereço do sistema (ex.: `https://app.trameagencia.com.br`) e em *Redirect URLs* adicione `https://app.trameagencia.com.br/auth/callback` (e o endereço `*.vercel.app` enquanto testar).
3. **Vercel:** importe o repositório `trameagencia/trametrello` e configure as variáveis do `.env.example`:
   - `NEXT_PUBLIC_SUPABASE_URL` e `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` (Supabase > Project Settings > API)
   - `SUPABASE_SERVICE_ROLE_KEY` (opcional, para mandar convite por e-mail a quem ainda não tem conta)
   - `NEXT_PUBLIC_SITE_URL`
4. Acesse o sistema e entre com o seu e-mail **antes de qualquer outra pessoa**: o primeiro login vira o admin.

## Desenvolvimento

```bash
cp .env.example .env.local   # preencha com os dados do Supabase
npm install
npm run dev
```

Testes das regras de permissão direto no Postgres (sem precisar do Supabase):

```bash
PGHOST=localhost PGUSER=postgres scripts/test-rls.sh
```
