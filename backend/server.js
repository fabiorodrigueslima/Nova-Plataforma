const path = require("path");

require("dotenv").config({
  path: path.resolve(__dirname, "../.env.local"),
  override: false,
  quiet: true,
});

require("dotenv").config({
  path: path.resolve(__dirname, "../.env"),
  override: false,
  quiet: true,
});

require("dotenv").config({ quiet: true });

const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const rateLimit = require("express-rate-limit");
const bcrypt = require("bcrypt");
const nodemailer = require("nodemailer");
const { v4: uuidv4 } = require("uuid");
const jwt = require("jsonwebtoken");
const multer = require("multer");
const fs = require("fs");
const { OAuth2Client } = require("google-auth-library");
const cloudinary = require("cloudinary").v2;
const pool = require("./db");
const { bloquearSeNecessario } = require("./moderacao");

const app = express();

/* ================= CONFIG ================= */

const PORT = process.env.PORT || 5000;
const JWT_SECRET = process.env.JWT_SECRET;

if (!JWT_SECRET) {
  throw new Error("JWT_SECRET precisa estar configurado no ambiente.");
}

const FRONTEND_URL =
  process.env.FRONTEND_URL ||
  process.env.RENDER_EXTERNAL_URL ||
  "http://localhost:5173";

const BACKEND_URL =
  process.env.BACKEND_URL || process.env.RENDER_EXTERNAL_URL || `http://localhost:${PORT}`;
const frontendDistDir = path.resolve(__dirname, "../dist");
const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID?.trim();
const GOOGLE_CLIENT_ID_VALIDO = /^[0-9]+-[a-zA-Z0-9_-]+\.apps\.googleusercontent\.com$/.test(
  GOOGLE_CLIENT_ID || "",
);
const googleClient = GOOGLE_CLIENT_ID_VALIDO
  ? new OAuth2Client(GOOGLE_CLIENT_ID)
  : null;
const usaCloudinary = Boolean(
  process.env.CLOUDINARY_CLOUD_NAME &&
    process.env.CLOUDINARY_API_KEY &&
    process.env.CLOUDINARY_API_SECRET,
);

if (usaCloudinary) {
  cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET,
  });
}

if (GOOGLE_CLIENT_ID && !GOOGLE_CLIENT_ID_VALIDO) {
  console.warn(
    "GOOGLE_CLIENT_ID invalido. Use o Client ID que termina com .apps.googleusercontent.com, nao o Client Secret.",
  );
}

const allowedOrigins = [
  "http://localhost:5173",
  "http://localhost:5174",
  "http://localhost:5175",
  "http://localhost:5176",
  "http://localhost:5177",

  "https://postfan-novo.netlify.app",
  "https://5a06890e--postfan-novo.netlify.app",

  "https://postfan-novo-7opc.vercel.app",
];

if (process.env.FRONTEND_URL) {
  allowedOrigins.push(process.env.FRONTEND_URL);
}

if (process.env.RENDER_EXTERNAL_URL) {
  allowedOrigins.push(process.env.RENDER_EXTERNAL_URL);
}

function validarOrigem(origin, callback) {
  const origemLocal =
    /^https?:\/\/(localhost|127\.0\.0\.1):\d+$/.test(origin || "");

  if (!origin || origemLocal || allowedOrigins.includes(origin)) {
    return callback(null, true);
  }

  console.log("Origem bloqueada pelo CORS:", origin);
  return callback(new Error("Origem não permitida pelo CORS."));
}

app.use(
  cors({
    origin: validarOrigem,
    credentials: true,
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
  }),
);

app.use(
  helmet({
    crossOriginResourcePolicy: false,
  }),
);

app.use(
  rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 300,
    standardHeaders: true,
    legacyHeaders: false,
  }),
);

app.options(
  /.*/,
  cors({
    origin: validarOrigem,
    credentials: true,
  }),
);

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.get("/healthz", (req, res) => {
  res.json({ status: "ok" });
});

/* ================= UPLOADS ================= */

const uploadsDir = path.join(__dirname, "uploads");
const MAX_UPLOAD_SIZE = 10 * 1024 * 1024;
const allowedUploadTypes = new Map([
  ["image/jpeg", [".jpg", ".jpeg"]],
  ["image/png", [".png"]],
  ["image/webp", [".webp"]],
  ["image/gif", [".gif"]],
  ["video/mp4", [".mp4"]],
  ["video/webm", [".webm"]],
  ["application/pdf", [".pdf"]],
  ["text/plain", [".txt"]],
  ["application/msword", [".doc"]],
  [
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    [".docx"],
  ],
]);

if (!usaCloudinary && !fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir);
}

if (!usaCloudinary) {
  app.use("/uploads", express.static(uploadsDir));
}

const diskStorage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, uploadsDir);
  },

  filename: function (req, file, cb) {
    const ext = path.extname(file.originalname).toLowerCase();
    const nomeArquivo =
      Date.now() + "-" + Math.round(Math.random() * 1e9) + ext;

    cb(null, nomeArquivo);
  },
});

const upload = multer({
  storage: usaCloudinary ? multer.memoryStorage() : diskStorage,
  limits: {
    fileSize: MAX_UPLOAD_SIZE,
    files: 1,
  },
  fileFilter: function (req, file, cb) {
    const ext = path.extname(file.originalname).toLowerCase();
    const allowedExtensions = allowedUploadTypes.get(file.mimetype);

    if (!allowedExtensions || !allowedExtensions.includes(ext)) {
      return cb(new Error("Tipo de arquivo não permitido."));
    }

    cb(null, true);
  },
});

function uploadCloudinary(file, folder) {
  return new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      {
        folder,
        resource_type: "auto",
      },
      (error, result) => {
        if (error) return reject(error);
        return resolve(result);
      },
    );

    stream.end(file.buffer);
  });
}

async function salvarArquivoEnviado(file, folder = "postfan/uploads") {
  if (!file) return null;

  if (usaCloudinary) {
    const result = await uploadCloudinary(file, folder);

    return {
      url: result.secure_url,
      tipo: file.mimetype,
      nome: file.originalname,
    };
  }

  return {
    url: `${BACKEND_URL}/uploads/${file.filename}`,
    tipo: file.mimetype,
    nome: file.originalname,
  };
}

/* ================= BANCO ================= */

pool
  .connect()
  .then((client) => {
    console.log("✅ Banco de dados conectado com sucesso!");
    client.release();
  })
  .catch((error) => {
    console.error("❌ Erro ao conectar no banco:");
    console.error(error.message);
  });

/* ================= CRIAR TABELAS ================= */

async function criarTabelas() {
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS usuarios (
        id SERIAL PRIMARY KEY,
        nome VARCHAR(150) NOT NULL,
        email VARCHAR(150) UNIQUE NOT NULL,
        senha TEXT,
        google_id TEXT UNIQUE,
        provider VARCHAR(30) DEFAULT 'local',
        foto TEXT,
        bio TEXT,
        essencia_representa TEXT,
        essencia_tema TEXT,
        essencia_frase TEXT,
        aberto_para TEXT,
        ultimo_acesso TIMESTAMP,
        token_recuperacao TEXT,
        token_expira TIMESTAMP,
        criado_em TIMESTAMP DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS exclusoes_conta (
        id SERIAL PRIMARY KEY,
        usuario_id INTEGER,
        nome VARCHAR(150),
        email VARCHAR(150),
        motivo TEXT,
        status VARCHAR(50) DEFAULT 'concluida',
        solicitado_em TIMESTAMP DEFAULT NOW(),
        concluido_em TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS posts (
        id SERIAL PRIMARY KEY,
        usuario_id INTEGER REFERENCES usuarios(id) ON DELETE CASCADE,
        conteudo TEXT,
        tema VARCHAR(100),
        sentimento VARCHAR(100),
        imagem TEXT,
        tipo_arquivo VARCHAR(50),
        nome_arquivo TEXT,
        criado_em TIMESTAMP DEFAULT NOW(),
        atualizado_em TIMESTAMP DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS curtidas (
        id SERIAL PRIMARY KEY,
        usuario_id INTEGER REFERENCES usuarios(id) ON DELETE CASCADE,
        post_id INTEGER REFERENCES posts(id) ON DELETE CASCADE,
        criado_em TIMESTAMP DEFAULT NOW(),
        UNIQUE(usuario_id, post_id)
      );

      CREATE TABLE IF NOT EXISTS comentarios (
        id SERIAL PRIMARY KEY,
        usuario_id INTEGER REFERENCES usuarios(id) ON DELETE CASCADE,
        post_id INTEGER REFERENCES posts(id) ON DELETE CASCADE,
        conteudo TEXT NOT NULL,
        criado_em TIMESTAMP DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS seguidores (
        id SERIAL PRIMARY KEY,
        seguidor_id INTEGER REFERENCES usuarios(id) ON DELETE CASCADE,
        seguindo_id INTEGER REFERENCES usuarios(id) ON DELETE CASCADE,
        criado_em TIMESTAMP DEFAULT NOW(),
        UNIQUE(seguidor_id, seguindo_id)
      );

      CREATE TABLE IF NOT EXISTS compartilhamentos (
        id SERIAL PRIMARY KEY,
        usuario_id INTEGER REFERENCES usuarios(id) ON DELETE CASCADE,
        post_id INTEGER REFERENCES posts(id) ON DELETE CASCADE,
        criado_em TIMESTAMP DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS denuncias (
        id SERIAL PRIMARY KEY,
        denunciante_id INTEGER REFERENCES usuarios(id) ON DELETE SET NULL,
        usuario_id INTEGER REFERENCES usuarios(id) ON DELETE CASCADE,
        post_id INTEGER REFERENCES posts(id) ON DELETE CASCADE,
        motivo TEXT NOT NULL,
        status VARCHAR(50) DEFAULT 'pendente',
        criado_em TIMESTAMP DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS mensagens_privadas (
        id SERIAL PRIMARY KEY,
        remetente_id INTEGER REFERENCES usuarios(id) ON DELETE CASCADE,
        destinatario_id INTEGER REFERENCES usuarios(id) ON DELETE CASCADE,
        mensagem TEXT NOT NULL,
        lida BOOLEAN DEFAULT false,
        criado_em TIMESTAMP DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS grupos (
        id SERIAL PRIMARY KEY,
        dono_id INTEGER REFERENCES usuarios(id) ON DELETE CASCADE,
        nome VARCHAR(150) NOT NULL,
        descricao TEXT NOT NULL,
        categoria VARCHAR(100) DEFAULT 'Geral',
        codigo_convite VARCHAR(20) UNIQUE NOT NULL,
        tipo VARCHAR(30) DEFAULT 'publico',
        teste_expira_em TIMESTAMP,
        acesso_pago BOOLEAN DEFAULT false,
        criado_em TIMESTAMP DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS grupo_membros (
        id SERIAL PRIMARY KEY,
        grupo_id INTEGER REFERENCES grupos(id) ON DELETE CASCADE,
        usuario_id INTEGER REFERENCES usuarios(id) ON DELETE CASCADE,
        papel VARCHAR(50) DEFAULT 'membro',
        criado_em TIMESTAMP DEFAULT NOW(),
        UNIQUE(grupo_id, usuario_id)
      );

      CREATE TABLE IF NOT EXISTS grupo_mensagens (
        id SERIAL PRIMARY KEY,
        grupo_id INTEGER REFERENCES grupos(id) ON DELETE CASCADE,
        usuario_id INTEGER REFERENCES usuarios(id) ON DELETE CASCADE,
        mensagem TEXT NOT NULL,
        criado_em TIMESTAMP DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS grupo_solicitacoes (
        id SERIAL PRIMARY KEY,
        grupo_id INTEGER REFERENCES grupos(id) ON DELETE CASCADE,
        usuario_id INTEGER REFERENCES usuarios(id) ON DELETE CASCADE,
        status VARCHAR(30) DEFAULT 'pendente',
        criado_em TIMESTAMP DEFAULT NOW(),
        atualizado_em TIMESTAMP DEFAULT NOW(),
        UNIQUE(grupo_id, usuario_id)
      );

      ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS foto TEXT;
      ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS bio TEXT;
      ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS essencia_representa TEXT;
      ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS essencia_tema TEXT;
      ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS essencia_frase TEXT;
      ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS aberto_para TEXT;
      ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS ultimo_acesso TIMESTAMP;
      ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS token_recuperacao TEXT;
      ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS token_expira TIMESTAMP;
      ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS google_id TEXT UNIQUE;
      ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS provider VARCHAR(30) DEFAULT 'local';
      ALTER TABLE usuarios ALTER COLUMN senha DROP NOT NULL;

      ALTER TABLE posts ADD COLUMN IF NOT EXISTS conteudo TEXT;
      ALTER TABLE posts ADD COLUMN IF NOT EXISTS tema VARCHAR(100);
      ALTER TABLE posts ADD COLUMN IF NOT EXISTS sentimento VARCHAR(100);
      ALTER TABLE posts ADD COLUMN IF NOT EXISTS imagem TEXT;
      ALTER TABLE posts ADD COLUMN IF NOT EXISTS tipo_arquivo VARCHAR(50);
      ALTER TABLE posts ADD COLUMN IF NOT EXISTS nome_arquivo TEXT;
      ALTER TABLE posts ADD COLUMN IF NOT EXISTS atualizado_em TIMESTAMP DEFAULT NOW();

      ALTER TABLE comentarios ADD COLUMN IF NOT EXISTS conteudo TEXT;
      ALTER TABLE comentarios ADD COLUMN IF NOT EXISTS texto TEXT;
      UPDATE comentarios
      SET conteudo = texto
      WHERE conteudo IS NULL AND texto IS NOT NULL;
      UPDATE comentarios
      SET texto = conteudo
      WHERE texto IS NULL AND conteudo IS NOT NULL;

      ALTER TABLE denuncias ADD COLUMN IF NOT EXISTS usuario_id INTEGER REFERENCES usuarios(id) ON DELETE CASCADE;
      ALTER TABLE denuncias ADD COLUMN IF NOT EXISTS post_id INTEGER REFERENCES posts(id) ON DELETE CASCADE;
      ALTER TABLE denuncias ADD COLUMN IF NOT EXISTS status VARCHAR(50) DEFAULT 'pendente';

      ALTER TABLE mensagens_privadas ADD COLUMN IF NOT EXISTS lida BOOLEAN DEFAULT false;

      ALTER TABLE grupos ADD COLUMN IF NOT EXISTS tipo VARCHAR(30) DEFAULT 'publico';
      ALTER TABLE grupos ADD COLUMN IF NOT EXISTS teste_expira_em TIMESTAMP;
      ALTER TABLE grupos ADD COLUMN IF NOT EXISTS acesso_pago BOOLEAN DEFAULT false;

      UPDATE grupos SET tipo = 'publico' WHERE tipo IS NULL;

      CREATE INDEX IF NOT EXISTS idx_posts_usuario_id ON posts(usuario_id);
      CREATE INDEX IF NOT EXISTS idx_posts_criado_em ON posts(criado_em DESC);
      CREATE INDEX IF NOT EXISTS idx_comentarios_post_id ON comentarios(post_id);
      CREATE INDEX IF NOT EXISTS idx_seguidores_seguidor_id ON seguidores(seguidor_id);
      CREATE INDEX IF NOT EXISTS idx_seguidores_seguindo_id ON seguidores(seguindo_id);
      CREATE INDEX IF NOT EXISTS idx_mensagens_privadas_destinatario_id ON mensagens_privadas(destinatario_id);
      CREATE INDEX IF NOT EXISTS idx_grupo_membros_usuario_id ON grupo_membros(usuario_id);
      CREATE INDEX IF NOT EXISTS idx_grupo_mensagens_grupo_id ON grupo_mensagens(grupo_id);
    `);

    console.log("✅ Tabelas verificadas/atualizadas com sucesso!");
  } catch (error) {
    console.error("❌ Erro ao criar/atualizar tabelas:", error.message);
  }
}

criarTabelas();

/* ================= FUNÇÕES ================= */

function gerarCodigoGrupo() {
  return Math.random().toString(36).substring(2, 8).toUpperCase();
}

function obterFrontendUrl(req) {
  const origin = req.get("origin");
  const host = req.get("host");
  const forwardedProto = req.get("x-forwarded-proto");

  if (origin && allowedOrigins.includes(origin)) {
    return origin;
  }

  if (origin && host) {
    try {
      if (new URL(origin).host === host) {
        return origin;
      }
    } catch {
      // Se origin vier malformado, usa o fallback abaixo.
    }
  }

  if (host) {
    const protocol = forwardedProto || req.protocol || "https";
    return `${protocol}://${host}`;
  }

  return FRONTEND_URL;
}

function montarUsuarioPublico(usuario) {
  return {
    id: usuario.id,
    nome: usuario.nome,
    email: usuario.email,
    foto: usuario.foto,
    bio: usuario.bio,
    essencia_representa: usuario.essencia_representa,
    essencia_tema: usuario.essencia_tema,
    essencia_frase: usuario.essencia_frase,
    aberto_para: usuario.aberto_para,
    provider: usuario.provider || "local",
  };
}

function gerarTokenUsuario(usuario) {
  return jwt.sign(
    {
      id: usuario.id,
      nome: usuario.nome,
      email: usuario.email,
    },
    JWT_SECRET,
    { expiresIn: "7d" },
  );
}

function autenticar(req, res, next) {
  const authHeader = req.headers.authorization;

  if (!authHeader) {
    return res.status(401).json({ erro: "Token não enviado." });
  }

  const token = authHeader.split(" ")[1];

  if (!token) {
    return res.status(401).json({ erro: "Token inválido." });
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.usuario = decoded;

    pool
      .query("UPDATE usuarios SET ultimo_acesso = NOW() WHERE id = $1", [
        decoded.id,
      ])
      .catch(() => {});

    next();
  } catch {
    return res.status(401).json({ erro: "Token expirado ou inválido." });
  }
}

/* ================= TESTE ================= */

app.get("/", (req, res) => {
  res.json({
    mensagem: "Servidor Postfan rodando!",
    status: "online",
  });
});

/* ================= CADASTRO ================= */

app.post("/cadastro", upload.single("foto"), async (req, res) => {
  try {
    const { nome, email, senha } = req.body;

    if (!nome || !email || !senha) {
      return res.status(400).json({
        erro: "Preencha todos os os campos.",
      });
    }

    if (senha.length < 6) {
      return res.status(400).json({
        erro: "A senha precisa ter pelo menos 6 caracteres.",
      });
    }

    const existe = await pool.query(
      "SELECT id FROM usuarios WHERE email = $1",
      [email],
    );

    if (existe.rows.length > 0) {
      return res.status(400).json({
        erro: "Este email já está cadastrado.",
      });
    }

    let fotoUrl = null;

    if (req.file) {
      const arquivo = await salvarArquivoEnviado(req.file, "postfan/perfis");
      fotoUrl = arquivo.url;
    }

    const senhaHash = await bcrypt.hash(senha, 10);

    const novo = await pool.query(
      `
      INSERT INTO usuarios (
        nome,
        email,
        senha,
        foto
      )
      VALUES ($1, $2, $3, $4)

      RETURNING
        id,
        nome,
        email,
        foto,
        bio,
        criado_em
      `,
      [nome, email, senhaHash, fotoUrl],
    );

    const usuario = novo.rows[0];

    const token = gerarTokenUsuario(usuario);

    res.status(201).json({
      mensagem: "Cadastro realizado com sucesso!",
      token,
      usuario: montarUsuarioPublico(usuario),
    });
  } catch (error) {
    console.error("❌ Erro no cadastro:", error.message);

    res.status(500).json({
      erro: "Erro interno no servidor.",
    });
  }
});

/* ================= LOGIN ================= */

app.post("/login", async (req, res) => {
  try {
    const { email, senha } = req.body;

    if (!email || !senha) {
      return res.status(400).json({ erro: "Digite email e senha." });
    }

    const resultado = await pool.query(
      "SELECT * FROM usuarios WHERE email = $1",
      [email],
    );

    if (resultado.rows.length === 0) {
      return res.json({
        autenticado: false,
        erro: "Email ou senha inválidos.",
      });
    }

    const usuario = resultado.rows[0];

    if (!usuario.senha) {
      return res.status(400).json({
        autenticado: false,
        erro: "Esta conta foi criada com Google. Use o botão Entrar com Google.",
      });
    }

    const senhaCorreta = await bcrypt.compare(senha, usuario.senha);

    if (!senhaCorreta) {
      return res.json({
        autenticado: false,
        erro: "Email ou senha inválidos.",
      });
    }

    const token = gerarTokenUsuario(usuario);

    res.json({
      autenticado: true,
      mensagem: "Login realizado com sucesso!",
      token,
      usuario: montarUsuarioPublico(usuario),
    });
  } catch (error) {
    console.error("❌ Erro no login:", error.message);
    res.status(500).json({ erro: "Erro interno no servidor." });
  }
});

/* ================= LOGIN COM GOOGLE ================= */

app.post("/auth/google", async (req, res) => {
  try {
    const { credential } = req.body;

    if (!GOOGLE_CLIENT_ID) {
      return res.status(503).json({
        erro: "Login com Google não configurado no servidor.",
      });
    }

    if (!googleClient || !GOOGLE_CLIENT_ID_VALIDO) {
      return res.status(503).json({
        erro:
          "Google Client ID inválido. Use o ID que termina com .apps.googleusercontent.com.",
      });
    }

    if (!credential) {
      return res.status(400).json({ erro: "Credencial do Google não enviada." });
    }

    const ticket = await googleClient.verifyIdToken({
      idToken: credential,
      audience: GOOGLE_CLIENT_ID,
    });

    const payload = ticket.getPayload();

    if (!payload?.email || !payload?.sub) {
      return res.status(400).json({ erro: "Conta Google inválida." });
    }

    const email = payload.email.toLowerCase();
    const nome = payload.name || email.split("@")[0];
    const foto = payload.picture || null;

    const existente = await pool.query("SELECT * FROM usuarios WHERE email = $1", [
      email,
    ]);

    let usuario;

    if (existente.rows.length > 0) {
      const atual = existente.rows[0];

      const atualizado = await pool.query(
        `
        UPDATE usuarios
        SET google_id = COALESCE(google_id, $1),
            provider = CASE WHEN senha IS NULL THEN 'google' ELSE provider END,
            foto = COALESCE(foto, $2)
        WHERE id = $3
        RETURNING *
        `,
        [payload.sub, foto, atual.id],
      );

      usuario = atualizado.rows[0];
    } else {
      const novo = await pool.query(
        `
        INSERT INTO usuarios (
          nome,
          email,
          senha,
          foto,
          google_id,
          provider
        )
        VALUES ($1, $2, NULL, $3, $4, 'google')
        RETURNING *
        `,
        [nome, email, foto, payload.sub],
      );

      usuario = novo.rows[0];
    }

    const token = gerarTokenUsuario(usuario);

    res.json({
      autenticado: true,
      mensagem: "Login com Google realizado com sucesso!",
      token,
      usuario: montarUsuarioPublico(usuario),
    });
  } catch (error) {
    console.error("Erro no login com Google:", error.message);
    res.status(401).json({ erro: "Não foi possível validar sua conta Google." });
  }
});

/* ================= RECUPERAR SENHA ================= */

app.post("/recuperar", async (req, res) => {
  try {
    const { email } = req.body;
    const emailUser = process.env.EMAIL_USER;
    const emailPass = process.env.EMAIL_PASS;
    const emailHost = process.env.EMAIL_HOST || "smtp.gmail.com";
    const emailPort = Number(process.env.EMAIL_PORT || 587);
    const emailSecure =
      process.env.EMAIL_SECURE === "true" || emailPort === 465;

    if (!email) {
      return res.status(400).json({ erro: "Digite seu email." });
    }

    if (!emailUser || !emailPass) {
      console.error("EMAIL_USER ou EMAIL_PASS não configurado.");
      return res.status(503).json({
        erro:
          "Recuperação de senha indisponível no momento. Configure o email do servidor.",
      });
    }

    const resultado = await pool.query(
      "SELECT * FROM usuarios WHERE email = $1",
      [email],
    );

    if (resultado.rows.length === 0) {
      return res.json({
        mensagem:
          "Se este email estiver cadastrado, enviaremos um link de recuperação.",
      });
    }

    const token = uuidv4();

    const expira = new Date();
    expira.setHours(expira.getHours() + 1);

    await pool.query(
      `
      UPDATE usuarios
      SET token_recuperacao = $1, token_expira = $2
      WHERE email = $3
      `,
      [token, expira, email],
    );

    const link = `${obterFrontendUrl(req)}/resetar-senha?token=${encodeURIComponent(
      token,
    )}`;

    const transporter = nodemailer.createTransport({
      host: emailHost,
      port: emailPort,
      secure: emailSecure,
      requireTLS: !emailSecure,
      connectionTimeout: 20000,
      greetingTimeout: 20000,
      socketTimeout: 30000,
      auth: {
        user: emailUser,
        pass: emailPass,
      },
    });

    await transporter.sendMail({
      from: `"Postfan" <${emailUser}>`,
      to: email,
      subject: "Recuperação de senha - Postfan",
      html: `
        <div style="font-family: Arial; padding: 20px;">
          <h2>Recuperar senha</h2>
          <p>Clique no botão abaixo para criar uma nova senha:</p>
          <a href="${link}" style="background:#4f46ff;color:white;padding:12px 18px;border-radius:8px;text-decoration:none;">
            Criar nova senha
          </a>
          <p>Este link expira em 1 hora.</p>
        </div>
      `,
    });

    res.json({ mensagem: "Link de recuperação enviado para seu email." });
  } catch (error) {
    console.error("❌ Erro ao recuperar senha:", error.message);

    if (
      ["ETIMEDOUT", "ESOCKET", "ECONNECTION"].includes(error.code) ||
      error.message?.includes("Timeout")
    ) {
      return res.status(504).json({
        erro:
          "O servidor de email demorou para responder. Tente novamente em alguns minutos.",
      });
    }

    res.status(500).json({ erro: "Erro ao enviar email de recuperação." });
  }
});

/* ================= RESETAR SENHA ================= */

app.post("/resetar", async (req, res) => {
  try {
    const tokenRecebido = req.body.token || req.query.token;
    const tokenLimpo = String(tokenRecebido || "").trim();
    const { novaSenha } = req.body;

    if (!tokenLimpo || !novaSenha) {
      return res.status(400).json({
        erro: "Token e nova senha são obrigatórios.",
      });
    }

    if (novaSenha.length < 6) {
      return res.status(400).json({
        erro: "A senha precisa ter pelo menos 6 caracteres.",
      });
    }

    const resultado = await pool.query(
      "SELECT * FROM usuarios WHERE token_recuperacao = $1",
      [tokenLimpo],
    );

    if (resultado.rows.length === 0) {
      return res.status(400).json({
        erro:
          "Token inválido. Solicite um novo link de recuperação e use o link mais recente enviado por email.",
      });
    }

    const usuario = resultado.rows[0];

    if (usuario.token_expira && new Date() > usuario.token_expira) {
      return res.status(400).json({
        erro: "Token expirado. Solicite outro link.",
      });
    }

    const senhaHash = await bcrypt.hash(novaSenha, 10);

    await pool.query(
      `
      UPDATE usuarios
      SET senha = $1, token_recuperacao = NULL, token_expira = NULL
      WHERE id = $2
      `,
      [senhaHash, usuario.id],
    );

    res.json({ mensagem: "Senha alterada com sucesso!" });
  } catch (error) {
    console.error("❌ Erro ao resetar senha:", error.message);
    res.status(500).json({ erro: "Erro interno no servidor." });
  }
});

/* ================= USUÁRIO LOGADO ================= */

app.get("/me", autenticar, async (req, res) => {
  try {
    const usuario = await pool.query(
      `
      SELECT 
        id, nome, email, foto, bio, criado_em,
        essencia_representa,
        essencia_tema,
        essencia_frase,
        aberto_para
      FROM usuarios
      WHERE id = $1
      `,
      [req.usuario.id],
    );

    if (usuario.rows.length === 0) {
      return res.status(404).json({ erro: "Usuário não encontrado." });
    }

    res.json(usuario.rows[0]);
  } catch {
    res.status(500).json({ erro: "Erro ao buscar usuário." });
  }
});

/* ================= EXCLUIR CONTA ================= */

app.delete("/conta", autenticar, async (req, res) => {
  const client = await pool.connect();

  try {
    const { motivo } = req.body || {};

    await client.query("BEGIN");

    const usuario = await client.query(
      "SELECT id, nome, email FROM usuarios WHERE id = $1",
      [req.usuario.id],
    );

    if (usuario.rows.length === 0) {
      await client.query("ROLLBACK");
      return res.status(404).json({ erro: "Usuário não encontrado." });
    }

    await client.query(
      `
      INSERT INTO exclusoes_conta (
        usuario_id,
        nome,
        email,
        motivo,
        status,
        concluido_em
      )
      VALUES ($1, $2, $3, $4, 'concluida', NOW())
      `,
      [
        usuario.rows[0].id,
        usuario.rows[0].nome,
        usuario.rows[0].email,
        motivo?.trim() || null,
      ],
    );

    await client.query("DELETE FROM usuarios WHERE id = $1", [req.usuario.id]);

    await client.query("COMMIT");

    res.json({ mensagem: "Conta excluída com sucesso." });
  } catch (error) {
    await client.query("ROLLBACK");
    console.error("Erro ao excluir conta:", error.message);
    res.status(500).json({ erro: "Erro ao excluir conta." });
  } finally {
    client.release();
  }
});

/* ================= EDITAR PERFIL ================= */

app.put("/perfil", autenticar, upload.single("foto"), async (req, res) => {
  try {
    const {
      nome,
      bio,
      essencia_representa,
      essencia_tema,
      essencia_frase,
      aberto_para,
    } = req.body;

    let fotoUrl = null;

    if (req.file) {
      const arquivo = await salvarArquivoEnviado(req.file, "postfan/perfis");
      fotoUrl = arquivo.url;
    }

    const atual = await pool.query("SELECT * FROM usuarios WHERE id = $1", [
      req.usuario.id,
    ]);

    if (atual.rows.length === 0) {
      return res.status(404).json({ erro: "Usuário não encontrado." });
    }

    const usuarioAtual = atual.rows[0];

    const resultado = await pool.query(
      `
      UPDATE usuarios
      SET 
        nome = $1,
        bio = $2,
        foto = $3,
        essencia_representa = $4,
        essencia_tema = $5,
        essencia_frase = $6,
        aberto_para = $7
      WHERE id = $8
      RETURNING 
        id, nome, email, foto, bio,
        essencia_representa,
        essencia_tema,
        essencia_frase,
        aberto_para
      `,
      [
        nome || usuarioAtual.nome,
        bio || usuarioAtual.bio,
        fotoUrl || usuarioAtual.foto,
        essencia_representa || usuarioAtual.essencia_representa,
        essencia_tema || usuarioAtual.essencia_tema,
        essencia_frase || usuarioAtual.essencia_frase,
        aberto_para || usuarioAtual.aberto_para,
        req.usuario.id,
      ],
    );

    res.json({
      mensagem: "Perfil atualizado com sucesso!",
      usuario: resultado.rows[0],
    });
  } catch (error) {
    console.error("❌ Erro ao editar perfil:", error.message);
    res.status(500).json({ erro: "Erro ao editar perfil." });
  }
});

/* ================= UPLOAD AVULSO ================= */

app.post("/upload", autenticar, upload.single("imagem"), async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ erro: "Nenhuma imagem enviada." });
  }

  const arquivo = await salvarArquivoEnviado(req.file, "postfan/uploads");

  res.json({ url: arquivo.url });
});

/* ================= LISTAR POSTS ================= */
app.get("/posts", autenticar, async (req, res) => {
  try {
    const posts = await pool.query(
      `
      SELECT 
        p.*,
        u.nome,
        u.email,
        u.foto,
        COALESCE((SELECT COUNT(*) FROM curtidas WHERE post_id = p.id), 0) AS total_curtidas,
        COALESCE((SELECT COUNT(*) FROM comentarios WHERE post_id = p.id), 0) AS total_comentarios,
        COALESCE((SELECT COUNT(*) FROM compartilhamentos WHERE post_id = p.id), 0) AS total_compartilhamentos,
        EXISTS (
          SELECT 1 FROM curtidas 
          WHERE curtidas.post_id = p.id 
          AND curtidas.usuario_id = $1
        ) AS curtiu
      FROM posts p
      JOIN usuarios u ON u.id = p.usuario_id
      ORDER BY p.criado_em DESC
      LIMIT 50
      `,
      [req.usuario.id],
    );

    res.json(posts.rows);
  } catch (error) {
    console.error("❌ Erro ao buscar posts:", error.message);
    res.status(500).json({ erro: "Erro ao buscar posts." });
  }
});

/* ================= CRIAR POST ================= */
app.post("/posts", autenticar, upload.single("imagem"), async (req, res) => {
  try {
    const { conteudo, tema, sentimento } = req.body;

    let imagem = null;
    let tipoArquivo = null;
    let nomeArquivo = null;

    if (req.file) {
      const arquivo = await salvarArquivoEnviado(req.file, "postfan/posts");
      imagem = arquivo.url;
      tipoArquivo = arquivo.tipo;
      nomeArquivo = arquivo.nome;
    }

    if (!conteudo && !imagem) {
      return res.status(400).json({
        erro: "Para publicar no PostFan, compartilhe uma ideia ou adicione uma foto, vídeo ou documento.",
      });
    }

    if (bloquearSeNecessario(conteudo, res)) {
      return;
    }

    const novo = await pool.query(
      `
      INSERT INTO posts (
        usuario_id,
        conteudo,
        tema,
        sentimento,
        imagem,
        tipo_arquivo,
        nome_arquivo
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7)
      RETURNING *
      `,
      [
        req.usuario.id,
        conteudo || "",
        tema || "Geral",
        sentimento || "",
        imagem,
        tipoArquivo,
        nomeArquivo,
      ],
    );

    const postCompleto = await pool.query(
      `
      SELECT 
        p.*,
        u.nome,
        u.email,
        u.foto,
        0 AS total_curtidas,
        0 AS total_comentarios,
        0 AS total_compartilhamentos,
        false AS curtiu
      FROM posts p
      JOIN usuarios u ON u.id = p.usuario_id
      WHERE p.id = $1
      `,
      [novo.rows[0].id],
    );

    res.status(201).json({
      mensagem: "Post criado com sucesso!",
      post: postCompleto.rows[0],
    });
  } catch (error) {
    console.error("❌ Erro ao criar post:", error.message);

    res.status(500).json({
      erro: "Erro ao criar post.",
      detalhe: error.message,
    });
  }
});

/* ================= EDITAR POST ================= */

app.put("/posts/:id", autenticar, async (req, res) => {
  try {
    const { id } = req.params;
    const { conteudo, tema, sentimento } = req.body;

    const post = await pool.query("SELECT * FROM posts WHERE id = $1", [id]);

    if (post.rows.length === 0) {
      return res.status(404).json({ erro: "Post não encontrado." });
    }

    if (Number(post.rows[0].usuario_id) !== Number(req.usuario.id)) {
      return res.status(403).json({ erro: "Você não pode editar este post." });
    }

    if (conteudo !== undefined && bloquearSeNecessario(conteudo, res)) {
      return;
    }

    const atualizado = await pool.query(
      `
      UPDATE posts
      SET conteudo = $1, tema = $2, sentimento = $3, atualizado_em = NOW()
      WHERE id = $4
      RETURNING *
      `,
      [
        conteudo ?? post.rows[0].conteudo,
        tema ?? post.rows[0].tema,
        sentimento ?? post.rows[0].sentimento,
        id,
      ],
    );

    res.json({
      mensagem: "Post editado com sucesso!",
      post: atualizado.rows[0],
    });
  } catch (error) {
    console.error("❌ Erro ao editar post:", error.message);
    res.status(500).json({ erro: "Erro ao editar post." });
  }
});

/* ================= EXCLUIR POST ================= */

app.delete("/posts/:id", autenticar, async (req, res) => {
  try {
    const { id } = req.params;

    const post = await pool.query("SELECT * FROM posts WHERE id = $1", [id]);

    if (post.rows.length === 0) {
      return res.status(404).json({ erro: "Post não encontrado." });
    }

    if (Number(post.rows[0].usuario_id) !== Number(req.usuario.id)) {
      return res.status(403).json({ erro: "Você não pode excluir este post." });
    }

    await pool.query("DELETE FROM posts WHERE id = $1", [id]);

    res.json({ mensagem: "Post excluído com sucesso!" });
  } catch (error) {
    console.error("❌ Erro ao excluir post:", error.message);
    res.status(500).json({ erro: "Erro ao excluir post." });
  }
});

/* ================= CURTIR / DESCURTIR ================= */

app.post("/curtir", autenticar, async (req, res) => {
  try {
    const { post_id } = req.body;

    if (!post_id) {
      return res.status(400).json({ erro: "post_id é obrigatório." });
    }

    const existe = await pool.query(
      `
      SELECT * FROM curtidas 
      WHERE usuario_id = $1 AND post_id = $2
      `,
      [req.usuario.id, post_id],
    );

    if (existe.rows.length > 0) {
      await pool.query(
        `
        DELETE FROM curtidas 
        WHERE usuario_id = $1 AND post_id = $2
        `,
        [req.usuario.id, post_id],
      );

      return res.json({ mensagem: "Curtida removida.", curtiu: false });
    }

    await pool.query(
      `
      INSERT INTO curtidas (usuario_id, post_id)
      VALUES ($1, $2)
      `,
      [req.usuario.id, post_id],
    );

    res.json({ mensagem: "Post curtido.", curtiu: true });
  } catch (error) {
    console.error("❌ Erro ao curtir:", error.message);
    res.status(500).json({ erro: "Erro ao curtir post." });
  }
});

/* ================= COMENTÁRIOS ================= */

app.get("/comentarios", autenticar, async (req, res) => {
  try {
    const { post_id } = req.query;

    if (!post_id) {
      return res.status(400).json({ erro: "post_id é obrigatório." });
    }

    const comentarios = await pool.query(
      `
      SELECT 
        cm.*,
        COALESCE(cm.conteudo, cm.texto) AS conteudo,
        u.nome,
        u.foto
      FROM comentarios cm
      JOIN usuarios u ON u.id = cm.usuario_id
      WHERE cm.post_id = $1
      ORDER BY cm.criado_em ASC
      `,
      [post_id],
    );

    res.json(comentarios.rows);
  } catch (error) {
    console.error("❌ Erro ao buscar comentários:", error.message);
    res.status(500).json({ erro: "Erro ao buscar comentários." });
  }
});

app.post("/comentarios", autenticar, async (req, res) => {
  try {
    const { post_id, conteudo } = req.body;

    if (!post_id || !conteudo) {
      return res.status(400).json({
        erro: "post_id e conteudo são obrigatórios.",
      });
    }

    if (bloquearSeNecessario(conteudo, res)) {
      return;
    }

    const novo = await pool.query(
      `
      INSERT INTO comentarios (usuario_id, post_id, conteudo, texto)
      VALUES ($1, $2, $3, $3)
      RETURNING *
      `,
      [req.usuario.id, post_id, conteudo],
    );

    const comentarioCompleto = await pool.query(
      `
      SELECT 
        cm.*,
        COALESCE(cm.conteudo, cm.texto) AS conteudo,
        u.nome,
        u.foto
      FROM comentarios cm
      JOIN usuarios u ON u.id = cm.usuario_id
      WHERE cm.id = $1
      `,
      [novo.rows[0].id],
    );

    res.status(201).json({
      mensagem: "Comentário criado com sucesso!",
      comentario: comentarioCompleto.rows[0],
    });
  } catch (error) {
    console.error("❌ Erro ao comentar:", error.message);
    res.status(500).json({ erro: "Erro ao comentar." });
  }
});

app.put("/comentarios/:id", autenticar, async (req, res) => {
  try {
    const comentarioId = Number(req.params.id);
    const { conteudo } = req.body;
    const textoComentario = conteudo?.trim();

    if (!Number.isInteger(comentarioId) || comentarioId <= 0) {
      return res.status(400).json({ erro: "Comentário inválido." });
    }

    if (!textoComentario) {
      return res.status(400).json({ erro: "Digite o novo comentário." });
    }

    if (bloquearSeNecessario(textoComentario, res)) {
      return;
    }

    const comentario = await pool.query(
      "SELECT * FROM comentarios WHERE id = $1",
      [comentarioId],
    );

    if (comentario.rows.length === 0) {
      return res.status(404).json({ erro: "Comentário não encontrado." });
    }

    if (Number(comentario.rows[0].usuario_id) !== Number(req.usuario.id)) {
      return res.status(403).json({
        erro: "Você só pode editar seus próprios comentários.",
      });
    }

    const atualizado = await pool.query(
      `
      UPDATE comentarios
      SET conteudo = $1, texto = $1
      WHERE id = $2
      RETURNING *
      `,
      [textoComentario, comentarioId],
    );

    res.json({
      mensagem: "Comentário atualizado com sucesso!",
      comentario: atualizado.rows[0],
    });
  } catch (error) {
    console.error("Erro ao editar comentário:", error.message);
    res.status(500).json({ erro: "Erro ao editar comentário." });
  }
});

app.delete("/comentarios/:id", autenticar, async (req, res) => {
  try {
    const comentarioId = Number(req.params.id);

    if (!Number.isInteger(comentarioId) || comentarioId <= 0) {
      return res.status(400).json({ erro: "Comentário inválido." });
    }

    const comentario = await pool.query(
      "SELECT * FROM comentarios WHERE id = $1",
      [comentarioId],
    );

    if (comentario.rows.length === 0) {
      return res.status(404).json({ erro: "Comentário não encontrado." });
    }

    if (Number(comentario.rows[0].usuario_id) !== Number(req.usuario.id)) {
      return res.status(403).json({
        erro: "Você só pode excluir seus próprios comentários.",
      });
    }

    await pool.query("DELETE FROM comentarios WHERE id = $1", [comentarioId]);

    res.json({
      mensagem: "Comentário excluído com sucesso!",
      post_id: comentario.rows[0].post_id,
    });
  } catch (error) {
    console.error("Erro ao excluir comentário:", error.message);
    res.status(500).json({
      erro: "Não foi possível excluir o comentário agora. Tente novamente em instantes.",
    });
  }
});

/* ================= COMPARTILHAR ================= */

app.post("/compartilhar", autenticar, async (req, res) => {
  try {
    const { post_id } = req.body;

    if (!post_id) {
      return res.status(400).json({ erro: "post_id é obrigatório." });
    }

    await pool.query(
      `
      INSERT INTO compartilhamentos (usuario_id, post_id)
      VALUES ($1, $2)
      `,
      [req.usuario.id, post_id],
    );

    res.json({ mensagem: "Compartilhamento registrado com sucesso!" });
  } catch (error) {
    console.error("❌ Erro ao compartilhar:", error.message);
    res.status(500).json({ erro: "Erro ao compartilhar." });
  }
});

/* ================= DENUNCIAR ================= */

app.post("/denuncias", autenticar, async (req, res) => {
  try {
    const { post_id, usuario_id, motivo } = req.body;
    const postId = post_id ? Number(post_id) : null;
    const usuarioId = usuario_id ? Number(usuario_id) : null;
    const motivoDenuncia = motivo?.trim();

    if (!postId && !usuarioId) {
      return res.status(400).json({
        erro: "Informe um post ou usuário para denunciar.",
      });
    }

    if (!motivoDenuncia) {
      return res.status(400).json({ erro: "Informe o motivo da denúncia." });
    }

    if (bloquearSeNecessario(motivoDenuncia, res)) {
      return;
    }

    if (postId) {
      const post = await pool.query("SELECT id FROM posts WHERE id = $1", [
        postId,
      ]);

      if (post.rows.length === 0) {
        return res.status(404).json({ erro: "Post não encontrado." });
      }
    }

    if (usuarioId) {
      if (usuarioId === Number(req.usuario.id)) {
        return res.status(400).json({
          erro: "Você não pode denunciar seu próprio perfil.",
        });
      }

      const usuario = await pool.query("SELECT id FROM usuarios WHERE id = $1", [
        usuarioId,
      ]);

      if (usuario.rows.length === 0) {
        return res.status(404).json({ erro: "Usuário não encontrado." });
      }
    }

    const denuncia = await pool.query(
      `
      INSERT INTO denuncias (denunciante_id, usuario_id, post_id, motivo)
      VALUES ($1, $2, $3, $4)
      RETURNING *
      `,
      [req.usuario.id, usuarioId, postId, motivoDenuncia],
    );

    res.status(201).json({
      mensagem: "Denúncia enviada para análise.",
      denuncia: denuncia.rows[0],
    });
  } catch (error) {
    console.error("Erro ao denunciar:", error.message);
    res.status(500).json({ erro: "Erro ao enviar denúncia." });
  }
});

/* ================= MENSAGENS PRIVADAS ================= */

app.post("/mensagens", autenticar, async (req, res) => {
  try {
    const { destinatario_id, mensagem } = req.body;
    const destinatarioId = Number(destinatario_id);
    const textoMensagem = mensagem?.trim();

    if (!destinatarioId || !textoMensagem) {
      return res.status(400).json({
        erro: "Destinatário e mensagem são obrigatórios.",
      });
    }

    if (destinatarioId === Number(req.usuario.id)) {
      return res.status(400).json({
        erro: "Você não pode enviar mensagem para você mesmo.",
      });
    }

    if (bloquearSeNecessario(textoMensagem, res)) {
      return;
    }

    const usuario = await pool.query("SELECT id FROM usuarios WHERE id = $1", [
      destinatarioId,
    ]);

    if (usuario.rows.length === 0) {
      return res.status(404).json({ erro: "Usuário não encontrado." });
    }

    const novaMensagem = await pool.query(
      `
      INSERT INTO mensagens_privadas (remetente_id, destinatario_id, mensagem)
      VALUES ($1, $2, $3)
      RETURNING *
      `,
      [req.usuario.id, destinatarioId, textoMensagem],
    );

    res.status(201).json({
      mensagem: "Mensagem enviada com sucesso!",
      dados: novaMensagem.rows[0],
    });
  } catch (error) {
    console.error("Erro ao enviar mensagem privada:", error.message);
    res.status(500).json({ erro: "Erro ao enviar mensagem." });
  }
});

app.get("/mensagens/:usuarioId", autenticar, async (req, res) => {
  try {
    const outroUsuarioId = Number(req.params.usuarioId);

    if (!outroUsuarioId) {
      return res.status(400).json({ erro: "Usuário inválido." });
    }

    const usuario = await pool.query("SELECT id FROM usuarios WHERE id = $1", [
      outroUsuarioId,
    ]);

    if (usuario.rows.length === 0) {
      return res.status(404).json({ erro: "Usuário não encontrado." });
    }

    const mensagens = await pool.query(
      `
      SELECT
        mp.*,
        remetente.nome AS remetente_nome,
        remetente.foto AS remetente_foto,
        destinatario.nome AS destinatario_nome,
        destinatario.foto AS destinatario_foto
      FROM mensagens_privadas mp
      JOIN usuarios remetente ON remetente.id = mp.remetente_id
      JOIN usuarios destinatario ON destinatario.id = mp.destinatario_id
      WHERE (
        mp.remetente_id = $1 AND mp.destinatario_id = $2
      ) OR (
        mp.remetente_id = $2 AND mp.destinatario_id = $1
      )
      ORDER BY mp.criado_em ASC
      LIMIT 100
      `,
      [req.usuario.id, outroUsuarioId],
    );

    await pool.query(
      `
      UPDATE mensagens_privadas
      SET lida = true
      WHERE remetente_id = $1 AND destinatario_id = $2
      `,
      [outroUsuarioId, req.usuario.id],
    );

    res.json(mensagens.rows);
  } catch (error) {
    console.error("Erro ao buscar mensagens privadas:", error.message);
    res.status(500).json({ erro: "Erro ao buscar mensagens." });
  }
});

/* ================= SUGESTÕES ================= */

app.get("/usuarios/sugestoes", autenticar, async (req, res) => {
  try {
    const sugestoes = await pool.query(
      `
      SELECT 
        u.id,
        u.nome,
        u.email,
        u.foto,
        u.bio,
        u.ultimo_acesso,
        (u.ultimo_acesso > NOW() - INTERVAL '5 minutes') AS online,
        EXISTS (
          SELECT 1
          FROM seguidores s
          WHERE s.seguidor_id = $1
          AND s.seguindo_id = u.id
        ) AS seguindo
      FROM usuarios u
      WHERE u.id != $1
      ORDER BY u.id DESC
      `,
      [req.usuario.id],
    );

    res.json(sugestoes.rows);
  } catch (error) {
    console.error("❌ Erro ao buscar sugestões:", error.message);

    res.status(500).json({
      erro: "Erro ao buscar sugestões.",
      detalhe: error.message,
    });
  }
});

/* ================= BUSCAR USUÁRIO ================= */

/* ================= USUÁRIOS ONLINE ================= */

app.get("/usuarios/online", autenticar, async (req, res) => {
  try {
    const online = await pool.query(
      `
      SELECT
        u.id,
        u.nome,
        u.email,
        u.foto,
        u.bio,
        u.ultimo_acesso,
        (u.ultimo_acesso > NOW() - INTERVAL '5 minutes') AS online,
        EXISTS (
          SELECT 1
          FROM seguidores s
          WHERE s.seguidor_id = $1
          AND s.seguindo_id = u.id
        ) AS seguindo
      FROM usuarios u
      WHERE u.id != $1
      AND u.ultimo_acesso > NOW() - INTERVAL '5 minutes'
      ORDER BY u.ultimo_acesso DESC
      LIMIT 8
      `,
      [req.usuario.id],
    );

    res.json(online.rows);
  } catch (error) {
    console.error("❌ Erro ao buscar usuários online:", error.message);
    res.status(500).json({ erro: "Erro ao buscar usuários online." });
  }
});

/* ================= SEGUIDORES / SEGUINDO ================= */

app.get("/usuarios/seguidores", autenticar, async (req, res) => {
  try {
    const seguidores = await pool.query(
      `
      SELECT
        u.id,
        u.nome,
        u.email,
        u.foto,
        u.bio,
        u.ultimo_acesso,
        (u.ultimo_acesso > NOW() - INTERVAL '5 minutes') AS online,
        EXISTS (
          SELECT 1
          FROM seguidores rel
          WHERE rel.seguidor_id = $1
          AND rel.seguindo_id = u.id
        ) AS seguindo
      FROM seguidores s
      JOIN usuarios u ON u.id = s.seguidor_id
      WHERE s.seguindo_id = $1
      ORDER BY s.criado_em DESC
      LIMIT 12
      `,
      [req.usuario.id],
    );

    res.json(seguidores.rows);
  } catch (error) {
    console.error("❌ Erro ao buscar seguidores:", error.message);
    res.status(500).json({ erro: "Erro ao buscar seguidores." });
  }
});

app.get("/usuarios/seguindo", autenticar, async (req, res) => {
  try {
    const seguindo = await pool.query(
      `
      SELECT
        u.id,
        u.nome,
        u.email,
        u.foto,
        u.bio,
        u.ultimo_acesso,
        (u.ultimo_acesso > NOW() - INTERVAL '5 minutes') AS online,
        true AS seguindo
      FROM seguidores s
      JOIN usuarios u ON u.id = s.seguindo_id
      WHERE s.seguidor_id = $1
      ORDER BY s.criado_em DESC
      LIMIT 12
      `,
      [req.usuario.id],
    );

    res.json(seguindo.rows);
  } catch (error) {
    console.error("❌ Erro ao buscar seguindo:", error.message);
    res.status(500).json({ erro: "Erro ao buscar seguindo." });
  }
});

app.get("/usuarios/:id", autenticar, async (req, res) => {
  try {
    const { id } = req.params;

    const usuario = await pool.query(
      `
      SELECT 
        id, nome, email, foto, bio, criado_em,
        essencia_representa,
        essencia_tema,
        essencia_frase,
        aberto_para
      FROM usuarios
      WHERE id = $1
      `,
      [id],
    );

    if (usuario.rows.length === 0) {
      return res.status(404).json({ erro: "Usuário não encontrado." });
    }

    res.json(usuario.rows[0]);
  } catch {
    res.status(500).json({ erro: "Erro ao buscar usuário." });
  }
});

/* ================= ESTATÍSTICAS DO PERFIL ================= */

app.get("/perfil/stats/:id", autenticar, async (req, res) => {
  try {
    const { id } = req.params;

    const stats = await pool.query(
      `
      SELECT
        COALESCE((SELECT COUNT(*) FROM posts WHERE usuario_id = $1), 0) AS total_posts,
        COALESCE((SELECT COUNT(*) FROM seguidores WHERE seguindo_id = $1), 0) AS total_seguidores,
        COALESCE((SELECT COUNT(*) FROM seguidores WHERE seguidor_id = $1), 0) AS total_seguindo,
        EXISTS (
          SELECT 1 FROM seguidores
          WHERE seguidor_id = $2 AND seguindo_id = $1
        ) AS seguindo
      `,
      [id, req.usuario.id],
    );

    res.json(stats.rows[0]);
  } catch (error) {
    console.error("❌ Erro ao buscar estatísticas:", error.message);
    res.status(500).json({ erro: "Erro ao buscar estatísticas." });
  }
});

/* ================= POSTS DO PERFIL ================= */

app.get("/usuarios/:id/posts", autenticar, async (req, res) => {
  try {
    const usuarioId = Number(req.params.id);

    const posts = await pool.query(
      `
      SELECT
        p.*,
        u.nome,
        u.email,
        u.foto,
        COALESCE((SELECT COUNT(*) FROM curtidas WHERE post_id = p.id), 0) AS total_curtidas,
        COALESCE((SELECT COUNT(*) FROM comentarios WHERE post_id = p.id), 0) AS total_comentarios,
        COALESCE((SELECT COUNT(*) FROM compartilhamentos WHERE post_id = p.id), 0) AS total_compartilhamentos,
        EXISTS (
          SELECT 1 FROM curtidas 
          WHERE curtidas.post_id = p.id 
          AND curtidas.usuario_id = $2
        ) AS curtiu
      FROM posts p
      JOIN usuarios u ON u.id = p.usuario_id
      WHERE p.usuario_id = $1
      ORDER BY p.criado_em DESC
      `,
      [usuarioId, req.usuario.id],
    );

    res.json(posts.rows);
  } catch (error) {
    console.error("❌ Erro ao buscar posts do perfil:", error.message);
    res.status(500).json({ erro: "Erro ao buscar posts." });
  }
});

/* ================= SEGUIR / DEIXAR DE SEGUIR ================= */

app.post("/seguir/:id", autenticar, async (req, res) => {
  const seguidor_id = Number(req.usuario.id);
  const seguindo_id = Number(req.params.id);

  try {
    if (seguidor_id === seguindo_id) {
      return res.status(400).json({
        erro: "Você não pode seguir você mesmo.",
      });
    }

    const usuarioExiste = await pool.query(
      "SELECT id FROM usuarios WHERE id = $1",
      [seguindo_id],
    );

    if (usuarioExiste.rows.length === 0) {
      return res.status(404).json({ erro: "Usuário não encontrado." });
    }

    const existe = await pool.query(
      `
      SELECT * FROM seguidores
      WHERE seguidor_id = $1
      AND seguindo_id = $2
      `,
      [seguidor_id, seguindo_id],
    );

    if (existe.rows.length > 0) {
      await pool.query(
        `
        DELETE FROM seguidores
        WHERE seguidor_id = $1
        AND seguindo_id = $2
        `,
        [seguidor_id, seguindo_id],
      );

      return res.json({
        mensagem: "Você deixou de seguir este usuário.",
        seguindo: false,
      });
    }

    await pool.query(
      `
      INSERT INTO seguidores (seguidor_id, seguindo_id)
      VALUES ($1, $2)
      `,
      [seguidor_id, seguindo_id],
    );

    res.json({
      mensagem: "Você começou a seguir este usuário.",
      seguindo: true,
    });
  } catch (error) {
    console.error("❌ Erro ao seguir:", error.message);

    res.status(500).json({
      erro: "Erro interno ao seguir usuário.",
    });
  }
});

/* ================= CRIAR GRUPO ================= */

app.post("/api/grupos", autenticar, async (req, res) => {
  try {
    const { nome, descricao, categoria, tipo } = req.body;
    const tipoGrupo = tipo === "reservada" ? "reservada" : "publico";

    if (!nome || !descricao) {
      return res.status(400).json({
        erro: "Nome e descrição são obrigatórios.",
      });
    }

    if (bloquearSeNecessario(`${nome} ${descricao} ${categoria || ""}`, res)) {
      return;
    }

    let codigo = gerarCodigoGrupo();

    let codigoExiste = await pool.query(
      "SELECT id FROM grupos WHERE codigo_convite = $1",
      [codigo],
    );

    while (codigoExiste.rows.length > 0) {
      codigo = gerarCodigoGrupo();

      codigoExiste = await pool.query(
        "SELECT id FROM grupos WHERE codigo_convite = $1",
        [codigo],
      );
    }

    const grupo = await pool.query(
      `
      INSERT INTO grupos (
        dono_id,
        nome,
        descricao,
        categoria,
        codigo_convite,
        tipo,
        teste_expira_em,
        acesso_pago
      )
      VALUES (
        $1,
        $2,
        $3,
        $4,
        $5,
        $6::VARCHAR,
        CASE WHEN $6::VARCHAR = 'reservada' THEN NOW() + INTERVAL '7 days' ELSE NULL END,
        false
      )
      RETURNING *
      `,
      [
        req.usuario.id,
        nome,
        descricao,
        categoria || "Geral",
        codigo,
        tipoGrupo,
      ],
    );

    const novoGrupo = grupo.rows[0];

    await pool.query(
      `
      INSERT INTO grupo_membros (grupo_id, usuario_id, papel)
      VALUES ($1, $2, $3)
      `,
      [novoGrupo.id, req.usuario.id, "admin"],
    );

    res.status(201).json({
      mensagem: "Grupo criado com sucesso!",
      grupo: novoGrupo,
    });
  } catch (error) {
    console.error("❌ Erro ao criar grupo:", error.message);
    res.status(500).json({ erro: "Erro ao criar grupo." });
  }
});

/* ================= MEUS GRUPOS ================= */

app.get("/api/meus-grupos", autenticar, async (req, res) => {
  try {
    const grupos = await pool.query(
      `
      SELECT 
        g.*,
        gm.papel,
        u.nome AS dono_nome,
        COUNT(m.id) AS total_membros,
        COALESCE(
          (
            SELECT COUNT(*)
            FROM grupo_solicitacoes gs
            WHERE gs.grupo_id = g.id AND gs.status = 'pendente'
          ),
          0
        ) AS total_solicitacoes_pendentes
      FROM grupos g
      JOIN grupo_membros gm ON gm.grupo_id = g.id
      JOIN usuarios u ON u.id = g.dono_id
      LEFT JOIN grupo_membros m ON m.grupo_id = g.id
      WHERE gm.usuario_id = $1
      GROUP BY g.id, gm.papel, u.nome
      ORDER BY g.criado_em DESC
      `,
      [req.usuario.id],
    );

    res.json(grupos.rows);
  } catch (error) {
    console.error("❌ Erro ao buscar meus grupos:", error.message);
    res.status(500).json({ erro: "Erro ao buscar grupos." });
  }
});

/* ================= EXPLORAR GRUPOS ================= */

app.get("/api/grupos", autenticar, async (req, res) => {
  try {
    const grupos = await pool.query(
      `
      SELECT 
        g.id,
        g.nome,
        g.descricao,
        g.categoria,
        g.tipo,
        g.teste_expira_em,
        g.acesso_pago,
        g.criado_em,
        u.nome AS dono_nome,
        COUNT(gm.id) AS total_membros,
        EXISTS (
          SELECT 1 FROM grupo_membros membro
          WHERE membro.grupo_id = g.id AND membro.usuario_id = $1
        ) AS membro,
        EXISTS (
          SELECT 1 FROM grupo_solicitacoes sol
          WHERE sol.grupo_id = g.id
          AND sol.usuario_id = $1
          AND sol.status = 'pendente'
        ) AS solicitacao_pendente
      FROM grupos g
      JOIN usuarios u ON u.id = g.dono_id
      LEFT JOIN grupo_membros gm ON gm.grupo_id = g.id
      WHERE g.tipo = 'publico'
      GROUP BY g.id, u.nome
      ORDER BY g.criado_em DESC
      `,
      [req.usuario.id],
    );

    res.json(grupos.rows);
  } catch (error) {
    console.error("❌ Erro ao explorar grupos:", error.message);
    res.status(500).json({ erro: "Erro ao buscar grupos." });
  }
});

/* ================= ENTRAR COM CÓDIGO ================= */

app.post("/api/grupos/:id/solicitar", autenticar, async (req, res) => {
  try {
    const grupoId = Number(req.params.id);

    const grupo = await pool.query("SELECT * FROM grupos WHERE id = $1", [
      grupoId,
    ]);

    if (grupo.rows.length === 0 || grupo.rows[0].tipo !== "publico") {
      return res.status(404).json({ erro: "Grupo público não encontrado." });
    }

    if (Number(grupo.rows[0].dono_id) === Number(req.usuario.id)) {
      return res.status(400).json({ erro: "Você já administra esse grupo." });
    }

    const membro = await pool.query(
      "SELECT id FROM grupo_membros WHERE grupo_id = $1 AND usuario_id = $2",
      [grupoId, req.usuario.id],
    );

    if (membro.rows.length > 0) {
      return res.json({ mensagem: "Você já participa desse grupo." });
    }

    const solicitacao = await pool.query(
      `
      INSERT INTO grupo_solicitacoes (grupo_id, usuario_id, status)
      VALUES ($1, $2, 'pendente')
      ON CONFLICT (grupo_id, usuario_id)
      DO UPDATE SET status = 'pendente', atualizado_em = NOW()
      RETURNING *
      `,
      [grupoId, req.usuario.id],
    );

    res.status(201).json({
      mensagem: "Solicitação enviada ao administrador do grupo.",
      solicitacao: solicitacao.rows[0],
    });
  } catch (error) {
    console.error("Erro ao solicitar entrada:", error.message);
    res.status(500).json({ erro: "Erro ao solicitar entrada no grupo." });
  }
});

app.get("/api/grupos/:id/solicitacoes", autenticar, async (req, res) => {
  try {
    const grupoId = Number(req.params.id);

    const grupo = await pool.query("SELECT * FROM grupos WHERE id = $1", [
      grupoId,
    ]);

    if (grupo.rows.length === 0) {
      return res.status(404).json({ erro: "Grupo não encontrado." });
    }

    if (Number(grupo.rows[0].dono_id) !== Number(req.usuario.id)) {
      return res.status(403).json({
        erro: "Apenas o administrador pode ver as solicitações.",
      });
    }

    const solicitacoes = await pool.query(
      `
      SELECT gs.*, u.nome, u.email, u.foto
      FROM grupo_solicitacoes gs
      JOIN usuarios u ON u.id = gs.usuario_id
      WHERE gs.grupo_id = $1 AND gs.status = 'pendente'
      ORDER BY gs.criado_em ASC
      `,
      [grupoId],
    );

    res.json(solicitacoes.rows);
  } catch (error) {
    console.error("Erro ao buscar solicitações:", error.message);
    res.status(500).json({ erro: "Erro ao buscar solicitações." });
  }
});

app.post("/api/grupos/:id/solicitacoes/:solicitacaoId", autenticar, async (req, res) => {
  try {
    const grupoId = Number(req.params.id);
    const solicitacaoId = Number(req.params.solicitacaoId);
    const { acao } = req.body;

    if (!["aprovar", "recusar"].includes(acao)) {
      return res.status(400).json({ erro: "Ação inválida." });
    }

    const grupo = await pool.query("SELECT * FROM grupos WHERE id = $1", [
      grupoId,
    ]);

    if (grupo.rows.length === 0) {
      return res.status(404).json({ erro: "Grupo não encontrado." });
    }

    if (Number(grupo.rows[0].dono_id) !== Number(req.usuario.id)) {
      return res.status(403).json({
        erro: "Apenas o administrador pode responder solicitações.",
      });
    }

    const solicitacao = await pool.query(
      `
      SELECT * FROM grupo_solicitacoes
      WHERE id = $1 AND grupo_id = $2 AND status = 'pendente'
      `,
      [solicitacaoId, grupoId],
    );

    if (solicitacao.rows.length === 0) {
      return res.status(404).json({ erro: "Solicitação não encontrada." });
    }

    const novoStatus = acao === "aprovar" ? "aprovada" : "recusada";

    await pool.query(
      `
      UPDATE grupo_solicitacoes
      SET status = $1, atualizado_em = NOW()
      WHERE id = $2
      `,
      [novoStatus, solicitacaoId],
    );

    if (acao === "aprovar") {
      await pool.query(
        `
        INSERT INTO grupo_membros (grupo_id, usuario_id, papel)
        VALUES ($1, $2, 'membro')
        ON CONFLICT (grupo_id, usuario_id) DO NOTHING
        `,
        [grupoId, solicitacao.rows[0].usuario_id],
      );
    }

    res.json({
      mensagem:
        acao === "aprovar"
          ? "Solicitação aprovada. O usuário já pode acessar o grupo."
          : "Solicitação recusada.",
    });
  } catch (error) {
    console.error("Erro ao responder solicitação:", error.message);
    res.status(500).json({ erro: "Erro ao responder solicitação." });
  }
});

app.post("/api/grupos/entrar", autenticar, async (req, res) => {
  try {
    const { codigo } = req.body;

    if (!codigo) {
      return res.status(400).json({ erro: "Digite o código do grupo." });
    }

    const grupo = await pool.query(
      "SELECT * FROM grupos WHERE codigo_convite = $1",
      [codigo.toUpperCase()],
    );

    if (grupo.rows.length === 0) {
      return res.status(404).json({ erro: "Código inválido." });
    }

    if (grupo.rows[0].tipo !== "reservada") {
      return res.status(400).json({
        erro: "Esse código pertence a um grupo público. Solicite entrada pelo botão do grupo.",
      });
    }

    if (
      grupo.rows[0].teste_expira_em &&
      new Date(grupo.rows[0].teste_expira_em) < new Date() &&
      !grupo.rows[0].acesso_pago
    ) {
      return res.status(402).json({
        erro: "O período gratuito dessa Sala Reservada expirou. Em breve será necessário liberar o acesso pago.",
      });
    }

    const grupoId = grupo.rows[0].id;

    const existe = await pool.query(
      `
      SELECT * FROM grupo_membros
      WHERE grupo_id = $1 AND usuario_id = $2
      `,
      [grupoId, req.usuario.id],
    );

    if (existe.rows.length > 0) {
      return res.json({
        mensagem: "Você já está nesse grupo.",
        grupo: grupo.rows[0],
      });
    }

    await pool.query(
      `
      INSERT INTO grupo_membros (grupo_id, usuario_id, papel)
      VALUES ($1, $2, 'membro')
      `,
      [grupoId, req.usuario.id],
    );

    res.json({
      mensagem: "Você entrou no grupo!",
      grupo: grupo.rows[0],
    });
  } catch (error) {
    console.error("❌ Erro ao entrar no grupo:", error.message);
    res.status(500).json({ erro: "Erro ao entrar no grupo." });
  }
});

/* ================= DADOS DO GRUPO ================= */

app.get("/api/grupos/:id", autenticar, async (req, res) => {
  try {
    const { id } = req.params;

    const grupo = await pool.query(
      `
      SELECT 
        g.*,
        gm.papel,
        u.nome AS dono_nome
      FROM grupos g
      JOIN grupo_membros gm ON gm.grupo_id = g.id
      JOIN usuarios u ON u.id = g.dono_id
      WHERE g.id = $1 AND gm.usuario_id = $2
      `,
      [id, req.usuario.id],
    );

    if (grupo.rows.length === 0) {
      return res.status(403).json({
        erro: "Você não tem acesso a esse grupo.",
      });
    }

    if (
      grupo.rows[0].tipo === "reservada" &&
      grupo.rows[0].papel !== "admin" &&
      grupo.rows[0].teste_expira_em &&
      new Date(grupo.rows[0].teste_expira_em) < new Date() &&
      !grupo.rows[0].acesso_pago
    ) {
      return res.status(402).json({
        erro: "O período gratuito dessa Sala Reservada expirou. Em breve será necessário liberar o acesso pago.",
      });
    }

    res.json(grupo.rows[0]);
  } catch {
    res.status(500).json({ erro: "Erro ao buscar grupo." });
  }
});

/* ================= MENSAGENS DO GRUPO ================= */

app.get("/api/grupos/:id/mensagens", autenticar, async (req, res) => {
  try {
    const { id } = req.params;

    const membro = await pool.query(
      `
      SELECT * FROM grupo_membros
      WHERE grupo_id = $1 AND usuario_id = $2
      `,
      [id, req.usuario.id],
    );

    if (membro.rows.length === 0) {
      return res.status(403).json({
        erro: "Você não participa desse grupo.",
      });
    }

    const mensagens = await pool.query(
      `
      SELECT 
        gm.*,
        u.nome,
        u.foto
      FROM grupo_mensagens gm
      JOIN usuarios u ON u.id = gm.usuario_id
      WHERE gm.grupo_id = $1
      ORDER BY gm.criado_em ASC
      `,
      [id],
    );

    res.json(mensagens.rows);
  } catch {
    res.status(500).json({ erro: "Erro ao buscar mensagens." });
  }
});

/* ================= ENVIAR MENSAGEM ================= */

app.post("/api/grupos/:id/mensagens", autenticar, async (req, res) => {
  try {
    const { id } = req.params;
    const { mensagem } = req.body;

    if (!mensagem) {
      return res.status(400).json({ erro: "Digite uma mensagem." });
    }

    if (bloquearSeNecessario(mensagem, res)) {
      return;
    }

    const membro = await pool.query(
      `
      SELECT * FROM grupo_membros
      WHERE grupo_id = $1 AND usuario_id = $2
      `,
      [id, req.usuario.id],
    );

    if (membro.rows.length === 0) {
      return res.status(403).json({
        erro: "Você não participa desse grupo.",
      });
    }

    const nova = await pool.query(
      `
      INSERT INTO grupo_mensagens (grupo_id, usuario_id, mensagem)
      VALUES ($1, $2, $3)
      RETURNING *
      `,
      [id, req.usuario.id, mensagem],
    );

    res.status(201).json({
      mensagem: "Mensagem enviada!",
      dados: nova.rows[0],
    });
  } catch {
    res.status(500).json({ erro: "Erro ao enviar mensagem." });
  }
});

/* ================= EXCLUIR GRUPO ================= */

app.delete("/api/grupos/:id", autenticar, async (req, res) => {
  try {
    const { id } = req.params;

    const grupo = await pool.query("SELECT * FROM grupos WHERE id = $1", [id]);

    if (grupo.rows.length === 0) {
      return res.status(404).json({ erro: "Grupo não encontrado." });
    }

    if (Number(grupo.rows[0].dono_id) !== Number(req.usuario.id)) {
      return res.status(403).json({
        erro: "Apenas o administrador pode excluir este grupo.",
      });
    }

    await pool.query("DELETE FROM grupos WHERE id = $1", [id]);

    res.json({ mensagem: "Grupo excluído com sucesso!" });
  } catch (error) {
    console.error("❌ Erro ao excluir grupo:", error.message);
    res.status(500).json({ erro: "Erro ao excluir grupo." });
  }
});

app.use((error, req, res, next) => {
  if (error instanceof multer.MulterError) {
    const status = error.code === "LIMIT_FILE_SIZE" ? 413 : 400;

    return res.status(status).json({
      erro:
        error.code === "LIMIT_FILE_SIZE"
          ? "Arquivo maior que o limite de 10MB."
          : "Erro ao processar arquivo enviado.",
    });
  }

  if (error?.message === "Tipo de arquivo não permitido.") {
    return res.status(400).json({ erro: error.message });
  }

  next(error);
});

/* ================= FRONTEND SPA ================= */

if (fs.existsSync(frontendDistDir)) {
  app.use(express.static(frontendDistDir));

  app.get(/^(?!\/api\/|\/uploads\/).*/, (req, res, next) => {
    if (!req.accepts("html")) {
      return next();
    }

    return res.sendFile(path.join(frontendDistDir, "index.html"));
  });
}

/* ================= INICIAR SERVIDOR ================= */

if (require.main === module) {
  app.listen(PORT, () => {
    console.log(`🚀 Servidor Postfan rodando na porta ${PORT}`);
  });
}

module.exports = app;
