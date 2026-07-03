# Deploy do PostFan no Render

Este projeto foi preparado para subir no Render como um unico Web Service Node:

- O Render executa o build do React com Vite.
- O Express sobe o backend.
- O Express tambem serve a pasta `dist` do frontend.
- O PostgreSQL fica como banco gerenciado do Render.

## 1. Arquivos importantes

- `render.yaml`: blueprint do Render com Web Service e PostgreSQL.
- `package.json`: contem `render-build` e `start`.
- `backend/server.js`: serve API e frontend em producao.
- `src/services/api.js`: em producao chama a API no mesmo dominio.

## 2. Como criar no Render

1. Suba o projeto para o GitHub.
2. Entre em https://dashboard.render.com.
3. Escolha **New +**.
4. Escolha **Blueprint**.
5. Conecte o repositorio do PostFan.
6. O Render vai ler o arquivo `render.yaml`.
7. Preencha as variaveis marcadas como `sync: false`.

## 3. Variaveis que voce precisa preencher

Obrigatorias:

```env
GOOGLE_CLIENT_ID=seu-client-id.apps.googleusercontent.com
VITE_GOOGLE_CLIENT_ID=seu-client-id.apps.googleusercontent.com
```

Para recuperacao de senha por email, adicione depois no painel do Render:

```env
EMAIL_USER=seu-email@gmail.com
EMAIL_PASS=sua-senha-de-app-google
```

Recomendadas para uploads em producao:

```env
CLOUDINARY_CLOUD_NAME=seu-cloud-name
CLOUDINARY_API_KEY=sua-api-key
CLOUDINARY_API_SECRET=seu-api-secret
```

O `DATABASE_URL` vem automaticamente do banco `postfan-db`.

O `JWT_SECRET` e gerado automaticamente pelo Render porque esta com `generateValue: true`.

## 4. Google OAuth

Depois que o Render criar o servico, ele vai gerar uma URL parecida com:

```txt
https://postfan.onrender.com
```

No Google Cloud Console, adicione essa URL em:

```txt
Origens JavaScript autorizadas
```

Exemplo:

```txt
https://postfan.onrender.com
```

Para desenvolvimento local, mantenha tambem:

```txt
http://localhost:5173
http://127.0.0.1:5173
```

## 5. Comandos usados pelo Render

Build:

```bash
npm run render-build
```

Start:

```bash
npm start
```

## 6. Observacoes

- Em producao, nao defina `VITE_API_URL` se frontend e backend estiverem no mesmo servico.
- O frontend chamara o backend no mesmo dominio.
- Para uploads persistentes, use Cloudinary. Sem Cloudinary, arquivos locais podem sumir quando o servico reiniciar.
- Depois de mudar variaveis de ambiente, faca novo deploy no Render.
