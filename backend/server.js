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
const bcrypt = require("bcrypt");
const nodemailer = require("nodemailer");
const { v4: uuidv4 } = require("uuid");
const jwt = require("jsonwebtoken");
const multer = require("multer");
const fs = require("fs");
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
  process.env.FRONTEND_URL || "https://postfan-novo.netlify.app";

const BACKEND_URL = process.env.BACKEND_URL || `http://localhost:${PORT}`;

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

function validarOrigem(origin, callback) {
  if (!origin || allowedOrigins.includes(origin)) {
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

app.options(
  /.*/,
  cors({
    origin: validarOrigem,
    credentials: true,
  }),
);

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

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

if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir);
}

app.use("/uploads", express.static(uploadsDir));

const storage = multer.diskStorage({
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
  storage,
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
        senha TEXT NOT NULL,
        foto TEXT,
        bio TEXT,
        essencia_representa TEXT,
        essencia_tema TEXT,
        essencia_frase TEXT,
        aberto_para TEXT,
        token_recuperacao TEXT,
        token_expira TIMESTAMP,
        criado_em TIMESTAMP DEFAULT NOW()
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

      CREATE TABLE IF NOT EXISTS grupos (
        id SERIAL PRIMARY KEY,
        dono_id INTEGER REFERENCES usuarios(id) ON DELETE CASCADE,
        nome VARCHAR(150) NOT NULL,
        descricao TEXT NOT NULL,
        categoria VARCHAR(100) DEFAULT 'Geral',
        codigo_convite VARCHAR(20) UNIQUE NOT NULL,
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

      ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS foto TEXT;
      ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS bio TEXT;
      ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS essencia_representa TEXT;
      ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS essencia_tema TEXT;
      ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS essencia_frase TEXT;
      ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS aberto_para TEXT;
      ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS token_recuperacao TEXT;
      ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS token_expira TIMESTAMP;

      ALTER TABLE posts ADD COLUMN IF NOT EXISTS conteudo TEXT;
      ALTER TABLE posts ADD COLUMN IF NOT EXISTS tema VARCHAR(100);
      ALTER TABLE posts ADD COLUMN IF NOT EXISTS sentimento VARCHAR(100);
      ALTER TABLE posts ADD COLUMN IF NOT EXISTS imagem TEXT;
      ALTER TABLE posts ADD COLUMN IF NOT EXISTS tipo_arquivo VARCHAR(50);
      ALTER TABLE posts ADD COLUMN IF NOT EXISTS nome_arquivo TEXT;
      ALTER TABLE posts ADD COLUMN IF NOT EXISTS atualizado_em TIMESTAMP DEFAULT NOW();
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
      fotoUrl = `${BACKEND_URL}/uploads/${req.file.filename}`;
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

    const token = jwt.sign(
      {
        id: usuario.id,
        nome: usuario.nome,
        email: usuario.email,
      },
      JWT_SECRET,
      {
        expiresIn: "7d",
      },
    );

    res.status(201).json({
      mensagem: "Cadastro realizado com sucesso!",
      token,
      usuario,
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
      return res.status(400).json({ erro: "Email ou senha inválidos." });
    }

    const usuario = resultado.rows[0];

    const senhaCorreta = await bcrypt.compare(senha, usuario.senha);

    if (!senhaCorreta) {
      return res.status(400).json({ erro: "Email ou senha inválidos." });
    }

    const token = jwt.sign(
      {
        id: usuario.id,
        nome: usuario.nome,
        email: usuario.email,
      },
      JWT_SECRET,
      { expiresIn: "7d" },
    );

    res.json({
      mensagem: "Login realizado com sucesso!",
      token,
      usuario: {
        id: usuario.id,
        nome: usuario.nome,
        email: usuario.email,
        foto: usuario.foto,
        bio: usuario.bio,
        essencia_representa: usuario.essencia_representa,
        essencia_tema: usuario.essencia_tema,
        essencia_frase: usuario.essencia_frase,
        aberto_para: usuario.aberto_para,
      },
    });
  } catch (error) {
    console.error("❌ Erro no login:", error.message);
    res.status(500).json({ erro: "Erro interno no servidor." });
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
      return res.status(404).json({ erro: "Email não encontrado." });
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

    const link = `${FRONTEND_URL}/resetar-senha?token=${token}`;

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
    const { token, novaSenha } = req.body;

    if (!token || !novaSenha) {
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
      [token],
    );

    if (resultado.rows.length === 0) {
      return res.status(400).json({ erro: "Token inválido." });
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
      fotoUrl = `${BACKEND_URL}/uploads/${req.file.filename}`;
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

app.post("/upload", autenticar, upload.single("imagem"), (req, res) => {
  if (!req.file) {
    return res.status(400).json({ erro: "Nenhuma imagem enviada." });
  }

  res.json({
    url: `${BACKEND_URL}/uploads/${req.file.filename}`,
  });
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
      imagem = `${BACKEND_URL}/uploads/${req.file.filename}`;
      tipoArquivo = req.file.mimetype;
      nomeArquivo = req.file.originalname;
    }

    if (!conteudo && !imagem) {
      return res.status(400).json({
        erro: "Escreva algo ou envie uma imagem, video ou documento.",
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
      INSERT INTO comentarios (usuario_id, post_id, conteudo)
      VALUES ($1, $2, $3)
      RETURNING *
      `,
      [req.usuario.id, post_id, conteudo],
    );

    const comentarioCompleto = await pool.query(
      `
      SELECT 
        cm.*,
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
    const { nome, descricao, categoria } = req.body;

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
      INSERT INTO grupos (dono_id, nome, descricao, categoria, codigo_convite)
      VALUES ($1, $2, $3, $4, $5)
      RETURNING *
      `,
      [req.usuario.id, nome, descricao, categoria || "Geral", codigo],
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
        COUNT(m.id) AS total_membros
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
    const grupos = await pool.query(`
      SELECT 
        g.id,
        g.nome,
        g.descricao,
        g.categoria,
        g.codigo_convite,
        g.criado_em,
        u.nome AS dono_nome,
        COUNT(gm.id) AS total_membros
      FROM grupos g
      JOIN usuarios u ON u.id = g.dono_id
      LEFT JOIN grupo_membros gm ON gm.grupo_id = g.id
      GROUP BY g.id, u.nome
      ORDER BY g.criado_em DESC
    `);

    res.json(grupos.rows);
  } catch (error) {
    console.error("❌ Erro ao explorar grupos:", error.message);
    res.status(500).json({ erro: "Erro ao buscar grupos." });
  }
});

/* ================= ENTRAR COM CÓDIGO ================= */

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

/* ================= INICIAR SERVIDOR ================= */

if (require.main === module) {
  app.listen(PORT, () => {
    console.log(`🚀 Servidor Postfan rodando na porta ${PORT}`);
  });
}

module.exports = app;
