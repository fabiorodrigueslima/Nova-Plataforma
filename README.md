# PostFan

Plataforma social de debates feita com React, Vite, Node.js, Express e PostgreSQL.

## Requisitos

- Node.js 20+
- PostgreSQL
- Conta Google Cloud para login com Google
- Conta Cloudinary para uploads em producao

## Configuracao

1. Copie `.env.example` para `.env.local` na raiz.
2. Copie `backend/.env.example` para `backend/.env`.
3. Preencha `DATABASE_URL`, `JWT_SECRET`, `FRONTEND_URL` e `BACKEND_URL`.
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

## Observacoes de producao

- O backend usa Cloudinary quando `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY` e `CLOUDINARY_API_SECRET` estao preenchidos.
- Sem Cloudinary, uploads ficam em `backend/uploads`, indicado apenas para desenvolvimento local.
- O login Google depende de `GOOGLE_CLIENT_ID` no backend e `VITE_GOOGLE_CLIENT_ID` no frontend.
- Nunca publique arquivos `.env` reais no Git.
