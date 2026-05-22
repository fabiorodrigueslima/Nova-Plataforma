# Checklist para Deploy no Vercel - Postfan

## ✅ O que foi corrigido

- [x] Rota POST `/posts` duplicada - REMOVIDA
- [x] GET `/posts` - ADICIONADA para listar posts
- [x] `EditarPerfil.jsx` usando `fetch` hardcoded - CORRIGIDO para usar `api`
- [x] Endpoints consistentes com axios baseURL

---

## 🔴 CRÍTICO - Antes de fazer deploy

### 1. **Upload de Arquivos (BLOQUEADOR)**

⚠️ **Problema**: Vercel tem filesystem efêmero (temporário). Arquivos salvos em `/uploads` desaparecem após requisição.

**Solução obrigatória**: Use um serviço de armazenamento externo:

- **Cloudinary** (recomendado - fácil)
  ```bash
  npm install cloudinary next-cloudinary
  ```
  Após setup, altere `server.js` para usar Cloudinary SDK em vez de multer local.

- **AWS S3** (mais robusto)
- **Firebase Storage**

### 2. **Variáveis de Ambiente (.env)**

Crie `.env` na raiz do projeto `/backend`:

```env
DATABASE_URL=postgresql://user:password@host:port/database
JWT_SECRET=uma_chave_super_secreta_aleatorios
FRONTEND_URL=https://seu-front-vercel.vercel.app
BACKEND_URL=https://seu-back-vercel.vercel.app
EMAIL_USER=seu-email@gmail.com
EMAIL_PASS=seu-app-password-google
PORT=5000
```

⚠️ **EMAIL**: Se usar Gmail, gere uma **App Password** (não a senha normal):
- https://myaccount.google.com/apppasswords

### 3. **Banco de Dados PostgreSQL**

O app usa PostgreSQL. Opções:

- **Render.com** (gratuito com limite)
- **Railway.app** (mais rápido)
- **Neon.tech** (serverless, excelente)
- **AWS RDS**

**Copie o `DATABASE_URL` e adicione em `.env`**

### 4. **Arquivo `.env.local` (Frontend)**

Crie `.env.local` na raiz do projeto `/` (pasta raiz, não em `src`):

```env
VITE_API_URL=https://seu-backend-vercel.vercel.app
```

Se o frontend for em Netlify:
```env
VITE_API_URL=https://seu-backend-vercel.vercel.app
```

### 5. **CORS Já Configurado** ✅

O servidor tem suporte para:
- `localhost:5173-5177` (dev)
- `*.netlify.app` (Netlify)
- `postfan-novo-7opc.vercel.app` (Vercel exemplo)

Se mudar domínios, adicione em `server.js` (linhas 30-40).

---

## 🟡 IMPORTANTE - Recomendações

### Rate Limiting (Proteção contra abuso)

Instale e configure:
```bash
npm install express-rate-limit
```

Adicione no `server.js` após `app.use(cors(...))`:

```javascript
const rateLimit = require("express-rate-limit");

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutos
  max: 100, // 100 requisições por IP
});

app.use("/", limiter);
app.use("/api/", limiter);
```

### Security Headers

Instale:
```bash
npm install helmet
```

No início de `server.js`:
```javascript
const helmet = require("helmet");
app.use(helmet());
```

### Logging (Monitorar erros)

Adicione serviço de logging:
- **Sentry.io** (recomendado - free tier)
- **LogRocket**

---

## 📋 Passo-a-Passo de Deploy

### Backend (Vercel)

1. Faça push do código para GitHub
2. Conecte repositório no Vercel
3. Selecione pasta raiz: `/backend`
4. Adicione variáveis de ambiente em **Settings > Environment Variables**
5. Deploy

### Frontend (Netlify ou Vercel)

1. Crie `.env.local` com `VITE_API_URL`
2. Push para GitHub
3. Conecte em Netlify/Vercel
4. Deploy

---

## ✅ Verificação Pós-Deploy

- [ ] GET `/` retorna status online
- [ ] Login funciona
- [ ] Cadastro funciona
- [ ] Posts podem ser criados
- [ ] Imagens/uploads salvam corretamente
- [ ] Editar perfil funciona
- [ ] Grupos criam e entram
- [ ] CORS não bloqueia requisições

Teste com cURL:
```bash
curl https://seu-backend.vercel.app/
```

---

## 🆘 Troubleshooting

**"CORS error"**: 
- Verificar origem no `allowedOrigins` do `server.js`
- Verificar se `FRONTEND_URL` está correto em `.env`

**"Upload não funciona"**:
- Implementar Cloudinary/S3 (não use filesystem local)

**"Banco não conecta"**:
- Verificar `DATABASE_URL` em `.env`
- Testar conexão com pgAdmin

**"Email não envia"**:
- Usar Google App Password (não senha normal)
- Ativar "Less secure apps" se necessário

---

## 📦 Dependências Instaladas

Backend (`package.json`):
- express
- pg (PostgreSQL)
- bcrypt (senhas)
- jsonwebtoken (JWT)
- multer (uploads local - TROCAR por Cloudinary!)
- nodemailer (email)
- cors
- dotenv
- uuid

Frontend (`package.json`):
- react
- react-router-dom
- axios
- react-icons

---

**Última atualização**: 18/05/2026  
**Status**: Pronto para Vercel com correções aplicadas
