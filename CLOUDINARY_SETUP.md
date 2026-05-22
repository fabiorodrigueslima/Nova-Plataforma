# Guia: Implementar Upload com Cloudinary

## ❌ Problema Atual

Seu servidor usa `multer` para salvar arquivos localmente em `/uploads/`. 

**Isso NÃO funciona no Vercel** porque:
- Vercel tem filesystem efêmero (arquivos deletados após requisição)
- Arquivos não persistem entre deploys

## ✅ Solução: Cloudinary

Cloudinary é um CDN grátis para imagens/vídeos com 25GB/mês de armazenamento.

---

## 🚀 Passo 1: Criar conta Cloudinary

1. Acesse https://cloudinary.com/
2. Clique em **Sign Up Free**
3. Complete o cadastro
4. Vá para **Dashboard** e copie:
   - **Cloud Name**
   - **API Key**
   - **API Secret**

---

## 📦 Passo 2: Instalar dependência

```bash
cd backend
npm install cloudinary
```

---

## 🔧 Passo 3: Adicionar ao `.env`

Adicione em `/backend/.env`:

```env
CLOUDINARY_CLOUD_NAME=seu-cloud-name
CLOUDINARY_API_KEY=sua-api-key
CLOUDINARY_API_SECRET=seu-api-secret
```

---

## 💻 Passo 4: Implementar no server.js

Substitua a configuração de `multer` no início do arquivo:

**REMOVA esta parte** (linhas ~15-25):
```javascript
const multer = require("multer");
const path = require("path");

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, path.join(__dirname, "uploads"));
  },
  filename: (req, file, cb) => {
    cb(
      null,
      `${Date.now()}-${Math.random().toString(36).substring(2)}.${file.mimetype.split("/")[1]}`
    );
  },
});

const upload = multer({ storage });
```

**ADICIONE isto**:
```javascript
const cloudinary = require("cloudinary").v2;

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

// Middleware para upload em memória (sem salvar em disk)
const multer = require("multer");
const upload = multer({ storage: multer.memoryStorage() });
```

---

## 📝 Passo 5: Modificar endpoint POST /posts

Encontre o endpoint POST `/posts` e substitua:

**ANTES** (linhas ~655-690):
```javascript
app.post("/posts", autenticar, upload.single("imagem"), async (req, res) => {
  try {
    const { conteudo, tema, sentimento } = req.body;

    let imagem = null;

    if (req.file) {
      imagem = `${BACKEND_URL}/uploads/${req.file.filename}`;
    }

    // ... resto do código
```

**DEPOIS**:
```javascript
app.post("/posts", autenticar, upload.single("imagem"), async (req, res) => {
  try {
    const { conteudo, tema, sentimento } = req.body;

    let imagem = null;

    if (req.file) {
      // Upload para Cloudinary
      const result = await new Promise((resolve, reject) => {
        const uploadStream = cloudinary.uploader.upload_stream(
          {
            folder: "postfan/posts",
            resource_type: "auto",
          },
          (error, result) => {
            if (error) reject(error);
            else resolve(result);
          }
        );

        uploadStream.end(req.file.buffer);
      });

      imagem = result.secure_url;
    }

    if (!conteudo && !imagem) {
      return res.status(400).json({
        erro: "Escreva algo ou envie uma imagem.",
      });
    }

    const novo = await pool.query(
      `
      INSERT INTO posts (usuario_id, conteudo, tema, sentimento, imagem)
      VALUES ($1, $2, $3, $4, $5)
      RETURNING *
      `,
      [req.usuario.id, conteudo, tema, sentimento, imagem],
    );

    // ... resto do código
```

---

## 📸 Passo 6: Modificar endpoint PUT /perfil (foto de perfil)

Encontre `PUT /perfil` e aplique mesma lógica:

```javascript
app.put("/perfil", autenticar, upload.single("foto"), async (req, res) => {
  try {
    const { nome, bio, essencia_representa, essencia_tema, essencia_frase, aberto_para } = req.body;

    let foto = null;

    if (req.file) {
      const result = await new Promise((resolve, reject) => {
        const uploadStream = cloudinary.uploader.upload_stream(
          {
            folder: "postfan/perfis",
            resource_type: "auto",
          },
          (error, result) => {
            if (error) reject(error);
            else resolve(result);
          }
        );

        uploadStream.end(req.file.buffer);
      });

      foto = result.secure_url;
    }

    // ... resto do código
```

---

## 🎨 Passo 7: Modificar endpoint PUT /cadastro (foto de cadastro)

Mesma lógica para `POST /cadastro`:

```javascript
app.post("/cadastro", upload.single("foto"), async (req, res) => {
  // ...
  if (req.file) {
    const result = await new Promise((resolve, reject) => {
      const uploadStream = cloudinary.uploader.upload_stream(
        {
          folder: "postfan/cadastros",
        },
        (error, result) => {
          if (error) reject(error);
          else resolve(result);
        }
      );

      uploadStream.end(req.file.buffer);
    });

    foto = result.secure_url;
  }
```

---

## 🗑️ Passo 8: Remover pasta `/uploads`

Após implementar Cloudinary:

```bash
rm -rf backend/uploads/
```

---

## ✅ Testar Localmente

1. Configure `.env` com credenciais Cloudinary
2. Faça upload de um arquivo no Cadastro ou Feed
3. Verifique se a imagem aparece
4. Acesse https://cloudinary.com/console/media_library para ver arquivos salvos

---

## 🚀 Deploy no Vercel

1. Adicione as 3 variáveis Cloudinary em **Vercel Settings > Environment Variables**:
   - `CLOUDINARY_CLOUD_NAME`
   - `CLOUDINARY_API_KEY`
   - `CLOUDINARY_API_SECRET`

2. Faça push do código atualizado

3. Vercel auto-fará deploy

4. Teste uploads novamente

---

## 🔒 Segurança

⚠️ **Não commite `.env` no Git!**

Adicione em `.gitignore`:
```
.env
.env.local
```

---

## 💰 Limites Grátis Cloudinary

- 25 GB de armazenamento/mês
- Imagens ilimitadas
- Transformações ilimitadas
- ~$0.035 por GB adicional após limite

Para Postfan, o plano grátis deve ser suficiente!

---

**Pronto?** Implemente os passos acima e seu app funcionará perfeitamente no Vercel! 🎉
