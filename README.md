# PostFan

Plataforma social de debates feita com React, Vite, Node.js, Express e PostgreSQL.

Recursos principais: cadastro e login por sessão segura, recuperação de senha, feed paginado, perfis, seguidores, curtidas, comentários, compartilhamentos, pesquisa, mensagens, grupos e notificações.

## Requisitos

- Node.js 20+
- PostgreSQL
- Conta Google Cloud para login com Google
- Conta Cloudinary para uploads em producao

## Configuracao

1. Copie `.env.example` para `.env.local` na raiz.
2. Copie `backend/.env.example` para `backend/.env`.
3. Preencha `DATABASE_URL`, `SESSION_SECRET`, `FRONTEND_URL` e `BACKEND_URL`.
4. Para login com Google, crie um OAuth Client ID no Google Cloud Console:
   - Tipo: Web application
   - JavaScript origins: `http://localhost:5173` e seu dominio de producao
   - Authorized redirect URIs: nao e necessario para o fluxo usado pelo botao Google
   - Use o mesmo Client ID em `VITE_GOOGLE_CLIENT_ID` e `GOOGLE_CLIENT_ID`
   - O Client ID deve terminar com `.apps.googleusercontent.com`; valores que comecam com `GOCSPX-` sao Client Secret e nao funcionam no botao
5. Para uploads persistentes em producao, preencha as variaveis `CLOUDINARY_*`.

## Rodar localmente

Frontend:

```bash
npm install
npm run dev
```

Backend:

```bash
cd backend
npm install
npm run dev
```

## Scripts

- `npm run dev`: inicia o frontend Vite
- `npm run build`: gera build de producao
- `npm run lint`: executa ESLint
- `cd backend && npm run dev`: inicia o backend com Nodemon
- `cd backend && npm test`: prepara o banco exclusivo de testes e executa a suíte
- `cd backend && npm run prisma:validate`: valida o schema Prisma

## Banco de dados e migrations

- `postfan_dev` e o unico banco autorizado para comandos locais de desenvolvimento.
- `postfan_test` fica reservado para a futura suite automatizada.
- `postfan_prod` nao deve ser criado ou usado por scripts de desenvolvimento.
- Em desenvolvimento, crie migrations com `cd backend && npm run prisma:migrate:dev`.
- Em producao, aplique migrations versionadas com `cd backend && npm run prisma:migrate:deploy` como etapa separada do startup.
- O servidor nunca cria tabelas, colunas ou indices ao iniciar. A autoridade do schema e `prisma/schema.prisma` junto do Prisma Migrate.

## Testes automatizados do backend

Os testes de integracao usam PostgreSQL real e aceitam exclusivamente o banco `postfan_test`.
Nunca aponte `DATABASE_URL_TEST` para desenvolvimento ou producao: a suite valida o nome real do banco e aborta antes de limpar ou criar dados.

```bash
cd backend
npm run test:db:prepare
npm test
```

Na primeira execucao local, `test:db:prepare` deriva com seguranca a conexao local de `postfan_dev`, cria `postfan_test`, grava um `.env.test` ignorado pelo Git e aplica somente as migrations versionadas. Em CI, forneca `DATABASE_URL_TEST` apontando para um PostgreSQL exclusivo cujo banco se chame exatamente `postfan_test`.

- `npm test`: prepara o banco e executa toda a suite uma vez.
- `npm run test:integration`: executa somente testes de integracao.
- `npm run test:watch`: modo interativo local.
- Para recriar a estrutura, remova e recrie apenas `postfan_test` com uma conta administrativa local e execute `npm run test:db:prepare`; nunca faça isso com `postfan_dev` ou producao.
- Em caso de falha, confira se o PostgreSQL esta ativo, se `DATABASE_URL_TEST` termina em `/postfan_test`, e execute `npx prisma migrate status` usando a URL de teste.

Cada teste de banco limpa e recria apenas suas proprias fixtures ficticias (`@test.local`). Nenhum dado de `postfan_dev` e copiado.

## Observacoes de producao

- O backend usa Cloudinary quando `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY` e `CLOUDINARY_API_SECRET` estao preenchidos.
- Sem Cloudinary, uploads ficam em `backend/uploads`, indicado apenas para desenvolvimento local.
- O login Google depende de `GOOGLE_CLIENT_ID` no backend e `VITE_GOOGLE_CLIENT_ID` no frontend.
- Nunca publique arquivos `.env` reais no Git.

## Publicação

O repositório inclui `render.yaml` para a aplicação completa e `vercel.json` para o frontend. Antes de iniciar uma versão nova no Render, aplique `cd backend && npm run prisma:migrate:deploy` com a `DATABASE_URL` de produção. Configure também `SESSION_SECRET`, `FRONTEND_URL`, credenciais opcionais de Google/SMTP e Cloudinary. O endpoint de saúde é `/healthz`; o processo de inicialização não altera a estrutura do banco.
