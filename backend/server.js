const path = require("path");

// Segredos do servidor pertencem exclusivamente ao backend/.env.
// Em produção, variáveis fornecidas pelo Render continuam tendo prioridade.
require("dotenv").config({
  path: path.resolve(__dirname, ".env"),
  override: false,
  quiet: true,
});

const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const rateLimit = require("express-rate-limit");
const bcrypt = require("bcrypt");
const crypto = require("crypto");
const multer = require("multer");
const fs = require("fs");
const cloudinary = require("cloudinary").v2;
const pool = require("./db");
const { bloquearSeNecessario } = require("./moderacao");
const userService = require("./src/modules/users/user.service");
const authService = require("./src/modules/auth/auth.service");
const { normalizeEmail } = require("./src/modules/auth/email");
const googleVerifier = require("./src/modules/auth/google-verifier");
const sessionService = require("./src/modules/auth/session.service");
const recoveryEmailService = require("./src/modules/auth/recovery-email.service");
const postService = require("./src/modules/posts/post.service");
const socialService = require("./src/modules/social/social.service");
const blockService = require("./src/modules/social/block.service");
const moderationService = require("./src/modules/moderation/moderation.service");
const debateService = require("./src/modules/debates/debate.service");
const prisma = require("./src/lib/prisma");

const app = express();

/* ================= CONFIG ================= */

const PORT = process.env.PORT || 5000;
const SESSION_SECRET = process.env.SESSION_SECRET;
const SESSION_COOKIE_NAME = process.env.NODE_ENV === "production" ? "__Host-postfan_session" : "postfan_session";
const RECOVERY_PUBLIC_MESSAGE =
  "Se este email estiver cadastrado, enviaremos um link de recuperacao.";

if (!SESSION_SECRET || SESSION_SECRET.length < 32) {
  throw new Error("SESSION_SECRET precisa ter pelo menos 32 caracteres.");
}

const FRONTEND_URL =
  process.env.FRONTEND_URL ||
  process.env.RENDER_EXTERNAL_URL ||
  "http://localhost:5173";

const frontendDistDir = path.resolve(__dirname, "../dist");
const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID?.trim();
const GOOGLE_CLIENT_ID_VALIDO = googleVerifier.isValidConfiguration(GOOGLE_CLIENT_ID);
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

  // Origem local segura usada pelo aplicativo Android (Capacitor).
  "https://localhost",
];

if (process.env.FRONTEND_URL) {
  allowedOrigins.push(process.env.FRONTEND_URL);
}

if (process.env.RENDER_EXTERNAL_URL) {
  allowedOrigins.push(process.env.RENDER_EXTERNAL_URL);
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
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "X-CSRF-Token"],
  }),
);

// No Render há exatamente um proxy na frente do app; sem isso o rate limit
// enxerga o IP do proxy e trata todos os usuários como um só.
if (process.env.NODE_ENV === "production") {
  app.set("trust proxy", 1);
}

const GOOGLE_GSI = "https://accounts.google.com/gsi/";

app.use(
  helmet({
    crossOriginResourcePolicy: false,
    // O popup do Google Identity Services precisa se comunicar com a janela de origem.
    crossOriginOpenerPolicy: { policy: "same-origin-allow-popups" },
    contentSecurityPolicy: {
      directives: {
        "script-src": ["'self'", `${GOOGLE_GSI}client`],
        "frame-src": ["'self'", GOOGLE_GSI],
        "connect-src": ["'self'", GOOGLE_GSI],
        "style-src": ["'self'", "https:", "'unsafe-inline'"],
        "img-src": [
          "'self'",
          "data:",
          "blob:",
          "https://res.cloudinary.com",
          "https://*.googleusercontent.com",
        ],
        "media-src": ["'self'", "blob:", "https://res.cloudinary.com"],
      },
    },
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

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: process.env.NODE_ENV === "test" ? 100 : 12,
  skipSuccessfulRequests: true,
  // O login inválido responde 200 com autenticado:false; marcamos a falha
  // explicitamente para que ela conte no limite de tentativas.
  requestWasSuccessful: (req, res) => res.statusCode < 400 && !res.locals.authFailed,
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res) => res.status(429).json({ erro: "Muitas tentativas. Aguarde alguns minutos e tente novamente." }),
});

app.use(["/login", "/auth/google", "/recuperar", "/resetar"], authLimiter);

const signupLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: process.env.NODE_ENV === "test" ? 100 : 10,
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res) => res.status(429).json({ erro: "Muitos cadastros a partir desta rede. Tente novamente mais tarde." }),
});

app.use("/cadastro", signupLimiter);

const MAX_TEXTO_POST = 5000;
const MAX_TEXTO_MENSAGEM = 2000;

function parseId(value) {
  const id = Number(value);
  return Number.isInteger(id) && id > 0 ? id : null;
}

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

const uploadPhoto = multer({
  storage: usaCloudinary ? multer.memoryStorage() : diskStorage,
  limits: { fileSize: 5 * 1024 * 1024, files: 1 },
  fileFilter: function (req, file, cb) {
    const ext = path.extname(file.originalname).toLowerCase();
    const imageTypes = new Map([
      ["image/jpeg", [".jpg", ".jpeg"]],
      ["image/png", [".png"]],
      ["image/webp", [".webp"]],
      ["image/gif", [".gif"]],
    ]);
    const extensions = imageTypes.get(file.mimetype);
    if (!extensions?.includes(ext)) return cb(new Error("A foto deve ser JPG, PNG, WEBP ou GIF."));
    return cb(null, true);
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
    let result;
    try {
      result = await uploadCloudinary(file, folder);
    } catch (error) {
      // Mensagens do Cloudinary não contêm a chave secreta; ajudam a achar credencial errada.
      console.error("❌ Falha no upload para o Cloudinary:", error?.http_code || "", error?.message || error?.name);
      const falha = new Error("Falha ao enviar mídia.");
      falha.code = "UPLOAD_FAILED";
      throw falha;
    }

    return {
      url: result.secure_url,
      tipo: file.mimetype,
      nome: file.originalname,
    };
  }

  return {
    // Caminho relativo mantém os uploads acessíveis no computador e no celular.
    url: `/uploads/${file.filename}`,
    tipo: file.mimetype,
    nome: file.originalname,
  };
}

async function removerArquivoArmazenado(url) {
  if (!url) return;
  if (url.startsWith("/uploads/")) {
    const target = path.resolve(uploadsDir, path.basename(url));
    if (path.dirname(target) === uploadsDir && fs.existsSync(target)) fs.unlinkSync(target);
    return;
  }
  if (usaCloudinary && url.includes("res.cloudinary.com")) {
    const pathname = new URL(url).pathname;
    const uploadPart = pathname.split("/upload/")[1]?.replace(/^v\d+\//, "");
    if (uploadPart) await cloudinary.uploader.destroy(uploadPart.replace(/\.[^.]+$/, ""), { resource_type: "auto" });
  }
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

/* ================= FUNÇÕES ================= */

const ALFABETO_CONVITE = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

function gerarCodigoGrupo() {
  // Código criptograficamente aleatório (8 caracteres, sem 0/O/1/I ambíguos).
  let codigo = "";
  for (let i = 0; i < 8; i += 1) {
    codigo += ALFABETO_CONVITE[crypto.randomInt(ALFABETO_CONVITE.length)];
  }
  return codigo;
}

function obterFrontendUrl(req) {
  const origin = req.get("origin");
  const host = req.get("host");
  const forwardedProto = req.get("x-forwarded-proto");

  // Links enviados por email devem abrir o site público, não o endereço
  // interno da WebView do aplicativo.
  if (origin === "https://localhost") {
    return FRONTEND_URL;
  }

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

function cookieOptions(expires) {
  const production = process.env.NODE_ENV === "production";
  return {
    httpOnly: true,
    secure: production,
    // O app Android acessa a API publicada a partir de https://localhost.
    // SameSite=None + Secure permite a sessão nesse cenário sem expor o token ao JavaScript.
    sameSite: production ? "none" : "lax",
    path: "/",
    expires,
  };
}

function readCookie(req, name) {
  const header = req.headers.cookie || "";
  for (const part of header.split(";")) {
    const separator = part.indexOf("=");
    if (separator < 0) continue;
    if (part.slice(0, separator).trim() === name) return decodeURIComponent(part.slice(separator + 1).trim());
  }
  return null;
}

async function issueSession(req, res, usuarioId) {
  const session = await sessionService.createSession(usuarioId, req.get("user-agent"));
  res.cookie(SESSION_COOKIE_NAME, session.token, cookieOptions(session.expiraEm));
  return sessionService.csrfTokenFor(session.token, SESSION_SECRET);
}

function clearSessionCookie(res) {
  res.clearCookie(SESSION_COOKIE_NAME, cookieOptions(new Date(0)));
}

function mensagemSuspensao(suspensoAte) {
  const data = new Date(suspensoAte).toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" });
  return `Sua conta está suspensa até ${data} por violar as regras da comunidade.`;
}

function exigirEquipe(req, res, next) {
  if (!moderationService.isStaff(req.usuario?.papel)) {
    return res.status(403).json({ erro: "Acesso restrito à equipe de moderação." });
  }
  return next();
}

// Grava ultimo_acesso no máximo uma vez por minuto por usuário, em vez de a cada requisição.
const ultimoAcessoGravado = new Map();
function registrarAcesso(usuarioId) {
  const agora = Date.now();
  if (agora - (ultimoAcessoGravado.get(usuarioId) || 0) < 60 * 1000) return;
  ultimoAcessoGravado.set(usuarioId, agora);
  if (ultimoAcessoGravado.size > 50000) ultimoAcessoGravado.clear();
  userService.touchLastAccess(usuarioId).catch(() => {});
}

async function autenticar(req, res, next) {
  try {
    const token = readCookie(req, SESSION_COOKIE_NAME);
    const session = await sessionService.findActiveSession(token);
    if (!session) {
      clearSessionCookie(res);
      return res.status(401).json({ erro: "Sessão inválida ou expirada." });
    }
    if (!["GET", "HEAD", "OPTIONS"].includes(req.method)) {
      const expected = sessionService.csrfTokenFor(token, SESSION_SECRET);
      if (!sessionService.csrfMatches(req.get("x-csrf-token"), expected)) {
        return res.status(403).json({ erro: "Proteção CSRF inválida." });
      }
    }
    if (moderationService.isSuspended(session.usuario) && req.path !== "/logout") {
      return res.status(403).json({ erro: mensagemSuspensao(session.usuario.suspensoAte), codigo: "CONTA_SUSPENSA" });
    }
    req.usuario = session.usuario;
    req.session = session;
    req.sessionToken = token;
    registrarAcesso(session.usuarioId);
    return next();
  } catch {
    return res.status(401).json({ erro: "Sessão inválida ou expirada." });
  }
}

/* ================= STATUS ================= */

app.get("/api/status", (req, res) => {
  res.json({
    mensagem: "Servidor Postfan rodando!",
    status: "online",
  });
});

/* ================= CADASTRO ================= */

app.post("/cadastro", uploadPhoto.single("foto"), async (req, res) => {
  try {
    const { nome, email, senha } = req.body;
    const emailNormalizado = normalizeEmail(email);

    if (!nome || !emailNormalizado || !senha) {
      return res.status(400).json({
        erro: "Preencha todos os os campos.",
      });
    }

    if (senha.length < 6) {
      return res.status(400).json({
        erro: "A senha precisa ter pelo menos 6 caracteres.",
      });
    }

    const existe = await authService.emailExists(emailNormalizado);

    if (existe) {
      return res.status(409).json({
        erro: "Este email já está cadastrado.",
      });
    }

    let fotoUrl = null;

    if (req.file) {
      const arquivo = await salvarArquivoEnviado(req.file, "postfan/perfis");
      fotoUrl = arquivo.url;
    }

    const senhaHash = await bcrypt.hash(senha, 10);

    const usuario = await authService.createLocalUser({
      nome,
      email: emailNormalizado,
      passwordHash: senhaHash,
      photo: fotoUrl,
    });

    const csrfToken = await issueSession(req, res, usuario.id);

    res.status(201).json({
      mensagem: "Cadastro realizado com sucesso!",
      csrfToken,
      usuario,
    });
  } catch (error) {
    console.error("❌ Erro no cadastro:", error.message);

    if (authService.isUniqueConstraintError(error)) {
      return res.status(409).json({ erro: "Este email já está cadastrado." });
    }

    return res.status(500).json({
      erro: "Erro interno no servidor.",
    });
  }
});

/* ================= LOGIN ================= */

app.post("/login", async (req, res) => {
  try {
    const { email, senha } = req.body;
    const emailNormalizado = normalizeEmail(email);

    if (!emailNormalizado || !senha) {
      return res.status(400).json({ erro: "Digite email e senha." });
    }

    const usuario = await authService.findLoginUser(emailNormalizado);

    if (!usuario) {
      res.locals.authFailed = true;
      return res.json({
        autenticado: false,
        erro: "Email ou senha inválidos.",
      });
    }

    if (!usuario.passwordHash) {
      return res.status(400).json({
        autenticado: false,
        erro: "Esta conta foi criada com Google. Use o botão Entrar com Google.",
      });
    }

    const senhaCorreta = await bcrypt.compare(senha, usuario.passwordHash);

    if (!senhaCorreta) {
      res.locals.authFailed = true;
      return res.json({
        autenticado: false,
        erro: "Email ou senha inválidos.",
      });
    }

    if (moderationService.isSuspended(usuario)) {
      return res.status(403).json({ autenticado: false, erro: mensagemSuspensao(usuario.suspensoAte), codigo: "CONTA_SUSPENSA" });
    }

    const csrfToken = await issueSession(req, res, usuario.user.id);

    res.json({
      autenticado: true,
      mensagem: "Login realizado com sucesso!",
      csrfToken,
      usuario: usuario.user,
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

    if (!GOOGLE_CLIENT_ID_VALIDO) {
      return res.status(503).json({
        erro:
          "Google Client ID inválido. Use o ID que termina com .apps.googleusercontent.com.",
      });
    }

    if (!credential) {
      return res.status(400).json({ erro: "Credencial do Google não enviada." });
    }

    const payload = await googleVerifier.verify(credential, GOOGLE_CLIENT_ID);

    if (!payload?.email || !payload?.sub || payload.email_verified !== true) {
      return res.status(400).json({ erro: "Conta Google inválida." });
    }

    const email = normalizeEmail(payload.email);
    const nome = payload.name || email.split("@")[0];
    const foto = payload.picture || null;

    const usuario = await authService.findOrCreateGoogleUser({
      email,
      googleId: payload.sub,
      name: nome,
      photo: foto,
    });

    const suspensao = await prisma.usuario.findUnique({ where: { id: usuario.id }, select: { suspensoAte: true } });
    if (moderationService.isSuspended(suspensao)) {
      return res.status(403).json({ autenticado: false, erro: mensagemSuspensao(suspensao.suspensoAte), codigo: "CONTA_SUSPENSA" });
    }

    const csrfToken = await issueSession(req, res, usuario.id);

    res.json({
      autenticado: true,
      mensagem: "Login com Google realizado com sucesso!",
      csrfToken,
      usuario,
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
    const emailNormalizado = normalizeEmail(email);

    if (!emailNormalizado) {
      return res.status(400).json({ erro: "Digite seu email." });
    }

    if (!recoveryEmailService.isConfigured()) {
      console.error("Provedor de email de recuperação não configurado.");
      return res.status(503).json({
        erro:
          "Recuperação de senha indisponível. Configure RESEND_API_KEY e EMAIL_FROM no servidor.",
      });
    }

    const accountExists = await authService.emailExists(emailNormalizado);

    if (!accountExists) {
      return res.json({ mensagem: RECOVERY_PUBLIC_MESSAGE });
    }

    const token = crypto.randomBytes(32).toString("base64url");

    const expira = new Date();
    expira.setHours(expira.getHours() + 1);

    await authService.createPasswordRecovery(emailNormalizado, token, expira);

    const link = `${obterFrontendUrl(req)}/resetar-senha#token=${encodeURIComponent(
      token,
    )}`;

    try {
      await recoveryEmailService.sendRecoveryEmail(emailNormalizado, link);
    } catch (error) {
      if (error.code === "EAUTH") {
        console.error("Falha no envio da recuperação: Gmail recusou a autenticação. Use uma senha de app de 16 caracteres em EMAIL_PASS.");
      } else {
        console.error("Falha no envio da recuperação:", error.code || error.name);
      }
    }

    res.json({ mensagem: RECOVERY_PUBLIC_MESSAGE });
  } catch (error) {
    console.error("Falha interna na recuperacao:", error.code || error.name);

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

    const senhaHash = await bcrypt.hash(novaSenha, 10);
    const resultado = await authService.resetPasswordWithToken(
      tokenLimpo,
      senhaHash,
    );

    if (resultado.status === "invalid") {
      return res.status(400).json({
        erro:
          "Token inválido. Solicite um novo link de recuperação e use o link mais recente enviado por email.",
      });
    }

    if (resultado.status === "expired") {
      return res.status(400).json({
        erro: "Token expirado. Solicite outro link.",
      });
    }

    res.json({ mensagem: "Senha alterada com sucesso!" });
  } catch (error) {
    console.error("❌ Erro ao resetar senha:", error.message);
    res.status(500).json({ erro: "Erro interno no servidor." });
  }
});

/* ================= USUÁRIO LOGADO ================= */

app.get("/me", autenticar, async (req, res) => {
  try {
    const usuario = await userService.findPrivateProfile(req.usuario.id);

    if (!usuario) {
      return res.status(404).json({ erro: "Usuário não encontrado." });
    }

    res.json({
      usuario,
      csrfToken: sessionService.csrfTokenFor(req.sessionToken, SESSION_SECRET),
    });
  } catch {
    res.status(500).json({ erro: "Erro ao buscar usuário." });
  }
});

app.post("/logout", autenticar, async (req, res) => {
  await sessionService.revokeSession(req.session.id);
  clearSessionCookie(res);
  res.json({ mensagem: "Logout realizado com sucesso." });
});

app.post("/sessions/revoke-all", autenticar, async (req, res) => {
  await sessionService.revokeAllUserSessions(req.usuario.id);
  clearSessionCookie(res);
  res.json({ mensagem: "Todas as sessões foram revogadas." });
});

/* ================= EXCLUIR CONTA ================= */

app.delete("/conta", autenticar, async (req, res) => {
  try {
    const { motivo } = req.body || {};
    const deleted = await userService.deleteAccount(req.usuario.id, motivo);

    if (!deleted) {
      return res.status(404).json({ erro: "Usuário não encontrado." });
    }

    res.json({ mensagem: "Conta excluída com sucesso." });
  } catch (error) {
    console.error("Erro ao excluir conta:", error.message);
    res.status(500).json({ erro: "Erro ao excluir conta." });
  }
});

/* ================= EDITAR PERFIL ================= */

app.put("/perfil", autenticar, uploadPhoto.single("foto"), async (req, res) => {
  let fotoUrl = null;
  try {
    const {
      nome,
      bio,
      essencia_representa,
      essencia_tema,
      essencia_frase,
      aberto_para,
    } = req.body;

    const perfilAnterior = await userService.findPrivateProfile(req.usuario.id);

    if (req.file) {
      const arquivo = await salvarArquivoEnviado(req.file, "postfan/perfis");
      fotoUrl = arquivo.url;
    }

    const usuario = await userService.updateProfile(req.usuario.id, {
      nome,
      bio,
      foto: fotoUrl,
      essencia_representa,
      essencia_tema,
      essencia_frase,
      aberto_para,
    });

    if (!usuario) {
      return res.status(404).json({ erro: "Usuário não encontrado." });
    }

    if (usuario.status === "invalid_name") {
      if (fotoUrl) await removerArquivoArmazenado(fotoUrl);
      return res.status(400).json({ erro: "O nome é obrigatório." });
    }

    if (fotoUrl && perfilAnterior?.foto && perfilAnterior.foto !== fotoUrl) {
      removerArquivoArmazenado(perfilAnterior.foto).catch(() => {
        console.error("Falha ao remover foto de perfil substituída.");
      });
    }

    res.json({
      mensagem: "Perfil atualizado com sucesso!",
      usuario,
    });
  } catch (error) {
    if (fotoUrl) removerArquivoArmazenado(fotoUrl).catch(() => {});
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
    const page = await postService.listPosts({ viewerId: req.usuario.id, tema: req.query.tema, limit: req.query.limit, cursor: req.query.cursor });
    if (page.status === "invalid_cursor") return res.status(400).json({ erro: "Cursor inválido." });
    res.json({ items: page.items, nextCursor: page.nextCursor });
  } catch (error) {
    console.error("❌ Erro ao buscar posts:", error.message);
    res.status(500).json({ erro: "Erro ao buscar posts." });
  }
});

/* ================= CRIAR POST ================= */
app.post("/posts", autenticar, upload.single("imagem"), async (req, res) => {
  let imagem = null;
  try {
    const { conteudo, tema, sentimento } = req.body;
    const texto = String(conteudo || "").trim();
    const ehDebate = req.body.tipo === "debate";
    let lados = { ladoA: null, ladoB: null };
    if (ehDebate) {
      const validacao = debateService.validateNewDebate({ pergunta: texto, ladoA: req.body.lado_a, ladoB: req.body.lado_b });
      if (!validacao.ok) {
        if (req.file?.filename) await removerArquivoArmazenado(`/uploads/${req.file.filename}`).catch(() => {});
        return res.status(400).json({ erro: validacao.erro });
      }
      lados = { ladoA: validacao.ladoA, ladoB: validacao.ladoB };
    }
    if (texto.length > MAX_TEXTO_POST) {
      return res.status(400).json({ erro: `A publicação pode ter no máximo ${MAX_TEXTO_POST} caracteres.` });
    }
    let tipoArquivo = null;
    let nomeArquivo = null;

    if (req.file) {
      const arquivo = await salvarArquivoEnviado(req.file, "postfan/posts");
      imagem = arquivo.url;
      tipoArquivo = arquivo.tipo;
      nomeArquivo = arquivo.nome;
    }

    if (!texto && !imagem) {
      return res.status(400).json({
        erro: "Para publicar no PostFan, compartilhe uma ideia ou adicione uma foto, vídeo ou documento.",
      });
    }

    if (bloquearSeNecessario(`${texto} ${lados.ladoA || ""} ${lados.ladoB || ""}`, res)) {
      await removerArquivoArmazenado(imagem);
      return;
    }
    const post = await postService.createPost({ usuarioId: req.usuario.id, conteudo: texto, tema: tema || "Geral", sentimento: sentimento || "", imagem, tipoArquivo, nomeArquivo, tipo: ehDebate ? "debate" : "post", ...lados }, req.usuario.id);

    res.status(201).json({
      mensagem: "Post criado com sucesso!",
      post,
    });
  } catch (error) {
    try { await removerArquivoArmazenado(imagem); } catch { console.error("Falha ao compensar mídia de post."); }
    console.error("❌ Erro ao criar post:", error.code || error.name, error.message);
    if (error.code === "UPLOAD_FAILED") {
      return res.status(502).json({ erro: "Não foi possível enviar a mídia agora. Tente novamente em instantes." });
    }
    res.status(500).json({
      erro: "Erro ao criar post.",
    });
  }
});

/* ================= EDITAR POST ================= */

app.put("/posts/:id", autenticar, async (req, res) => {
  try {
    const { id } = req.params;
    const { conteudo, tema, sentimento } = req.body;

    const postId = Number(id);
    if (!Number.isInteger(postId) || postId <= 0) return res.status(400).json({ erro: "Post inválido." });
    const owned = await postService.findOwned(postId, req.usuario.id);
    if (owned.status === "not_found") {
      return res.status(404).json({ erro: "Post não encontrado." });
    }

    if (owned.status === "forbidden") {
      return res.status(403).json({ erro: "Você não pode editar este post." });
    }

    const texto = conteudo === undefined ? owned.post.conteudo : String(conteudo).trim();
    if (texto && texto.length > MAX_TEXTO_POST) {
      return res.status(400).json({ erro: `A publicação pode ter no máximo ${MAX_TEXTO_POST} caracteres.` });
    }
    if (!texto && !owned.post.imagem) return res.status(400).json({ erro: "O post precisa de texto ou mídia." });
    if (conteudo !== undefined && bloquearSeNecessario(texto, res)) {
      return;
    }

    const atualizado = await postService.updatePost(postId, { conteudo: texto, tema: tema ?? owned.post.tema, sentimento: sentimento ?? owned.post.sentimento }, req.usuario.id);

    res.json({
      mensagem: "Post editado com sucesso!",
      post: atualizado,
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

    const postId = Number(id);
    if (!Number.isInteger(postId) || postId <= 0) return res.status(400).json({ erro: "Post inválido." });
    const owned = await postService.findOwned(postId, req.usuario.id);
    if (owned.status === "not_found") {
      return res.status(404).json({ erro: "Post não encontrado." });
    }

    if (owned.status === "forbidden") {
      return res.status(403).json({ erro: "Você não pode excluir este post." });
    }

    await postService.deletePost(postId);
    try { await removerArquivoArmazenado(owned.post.imagem); } catch { console.error("Falha ao remover mídia órfã; retry manual necessário."); }

    res.json({ mensagem: "Post excluído com sucesso!" });
  } catch (error) {
    console.error("❌ Erro ao excluir post:", error.message);
    res.status(500).json({ erro: "Erro ao excluir post." });
  }
});

/* ================= CURTIR / DESCURTIR ================= */

app.post("/curtir", autenticar, async (req, res) => {
  try {
    const postId = socialService.parsePositiveId(req.body.post_id);
    if (!postId) return res.status(400).json({ erro: "post_id é obrigatório." });
    const result = await socialService.toggleLike(req.usuario.id, postId);
    if (result.status === "not_found") return res.status(404).json({ erro: "Post não encontrado." });
    return res.json({ mensagem: result.curtiu ? "Post curtido." : "Curtida removida.", curtiu: result.curtiu });
  } catch (error) {
    console.error("❌ Erro ao curtir:", error.message);
    res.status(500).json({ erro: "Erro ao curtir post." });
  }
});

/* ================= COMENTÁRIOS ================= */

app.get("/comentarios", autenticar, async (req, res) => {
  try {
    const postId = socialService.parsePositiveId(req.query.post_id);
    if (!postId) return res.status(400).json({ erro: "post_id é obrigatório." });
    if (!(await postService.postExists(postId))) return res.status(404).json({ erro: "Post não encontrado." });
    return res.json(await socialService.listComments(postId, req.usuario.id));
  } catch (error) {
    console.error("❌ Erro ao buscar comentários:", error.message);
    res.status(500).json({ erro: "Erro ao buscar comentários." });
  }
});

app.post("/comentarios", autenticar, async (req, res) => {
  try {
    const { post_id, conteudo } = req.body;
    const postId = socialService.parsePositiveId(post_id);
    const texto = String(conteudo || "").trim();

    if (!postId || !texto) {
      return res.status(400).json({
        erro: "post_id e conteudo são obrigatórios.",
      });
    }

    if (texto.length > MAX_TEXTO_MENSAGEM) {
      return res.status(400).json({ erro: `O comentário pode ter no máximo ${MAX_TEXTO_MENSAGEM} caracteres.` });
    }

    if (bloquearSeNecessario(texto, res)) {
      return;
    }
    const comentario = await socialService.createComment(req.usuario.id, postId, texto);
    if (!comentario) return res.status(404).json({ erro: "Post não encontrado." });
    if (comentario.status === "blocked") return res.status(403).json({ erro: "Você não pode comentar nesta publicação." });

    res.status(201).json({
      mensagem: "Comentário criado com sucesso!",
      comentario,
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

    const result = await socialService.updateComment(comentarioId, req.usuario.id, textoComentario);
    if (result.status === "not_found") {
      return res.status(404).json({ erro: "Comentário não encontrado." });
    }
    if (result.status === "forbidden") {
      return res.status(403).json({
        erro: "Você só pode editar seus próprios comentários.",
      });
    }

    res.json({
      mensagem: "Comentário atualizado com sucesso!",
      comentario: result.comment,
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

    const result = await socialService.deleteComment(comentarioId, req.usuario.id);
    if (result.status === "not_found") {
      return res.status(404).json({ erro: "Comentário não encontrado." });
    }
    if (result.status === "forbidden") {
      return res.status(403).json({
        erro: "Você só pode excluir seus próprios comentários.",
      });
    }

    res.json({
      mensagem: "Comentário excluído com sucesso!",
      post_id: result.postId,
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
    const postId = socialService.parsePositiveId(req.body.post_id);
    if (!postId) return res.status(400).json({ erro: "post_id é obrigatório." });
    const result = await socialService.share(req.usuario.id, postId);
    if (result.status === "not_found") return res.status(404).json({ erro: "Post não encontrado." });
    if (result.status === "duplicate") return res.status(409).json({ erro: "Você já compartilhou esta publicação." });
    return res.status(201).json({ mensagem: "Compartilhamento registrado com sucesso!" });
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

    if ((post_id && !parseId(post_id)) || (usuario_id && !parseId(usuario_id))) {
      return res.status(400).json({ erro: "Alvo da denúncia inválido." });
    }

    const resultado = await moderationService.createReport({
      denuncianteId: req.usuario.id,
      usuarioId,
      postId,
      motivo: motivoDenuncia.slice(0, 1000),
    });
    if (resultado.status === "post_not_found") return res.status(404).json({ erro: "Post não encontrado." });
    if (resultado.status === "user_not_found") return res.status(404).json({ erro: "Usuário não encontrado." });
    if (resultado.status === "self") return res.status(400).json({ erro: "Você não pode denunciar a si mesmo." });

    res.status(201).json({
      mensagem: "Denúncia enviada para análise.",
      denuncia: resultado.denuncia,
    });
  } catch (error) {
    console.error("Erro ao denunciar:", error.message);
    res.status(500).json({ erro: "Erro ao enviar denúncia." });
  }
});

/* ================= MENSAGENS PRIVADAS ================= */

app.get("/conversas", autenticar, async (req, res) => {
  try {
    const conversas = await pool.query(
      `
      SELECT DISTINCT ON (outro.id)
        outro.id AS usuario_id,
        outro.nome,
        outro.foto,
        mp.mensagem AS ultima_mensagem,
        mp.criado_em,
        (
          SELECT COUNT(*)::int
          FROM mensagens_privadas nao_lida
          WHERE nao_lida.remetente_id = outro.id
            AND nao_lida.destinatario_id = $1
            AND nao_lida.lida = false
        ) AS nao_lidas
      FROM mensagens_privadas mp
      JOIN usuarios outro ON outro.id = CASE
        WHEN mp.remetente_id = $1 THEN mp.destinatario_id
        ELSE mp.remetente_id
      END
      WHERE mp.remetente_id = $1 OR mp.destinatario_id = $1
      ORDER BY outro.id, mp.criado_em DESC
      `,
      [req.usuario.id],
    );

    conversas.rows.sort(
      (a, b) => new Date(b.criado_em).getTime() - new Date(a.criado_em).getTime(),
    );

    res.json(conversas.rows);
  } catch (error) {
    console.error("Erro ao buscar conversas:", error.message);
    res.status(500).json({ erro: "Erro ao buscar conversas." });
  }
});

app.get("/posts/:id", autenticar, async (req, res) => {
  const postId = socialService.parsePositiveId(req.params.id);
  if (!postId) return res.status(400).json({ erro: "Post inválido." });
  try {
    const post = await postService.getPost(postId, req.usuario.id);
    if (!post) return res.status(404).json({ erro: "Post não encontrado." });
    return res.json({ post });
  } catch (error) {
    console.error("Erro ao buscar post:", error.message);
    return res.status(500).json({ erro: "Erro ao buscar post." });
  }
});

app.post("/mensagens", autenticar, async (req, res) => {
  try {
    const { destinatario_id, mensagem } = req.body;
    const destinatarioId = parseId(destinatario_id);
    const textoMensagem = String(mensagem || "").trim();

    if (textoMensagem.length > MAX_TEXTO_MENSAGEM) {
      return res.status(400).json({ erro: `A mensagem pode ter no máximo ${MAX_TEXTO_MENSAGEM} caracteres.` });
    }

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

    if (await blockService.isBlockedEitherWay(req.usuario.id, destinatarioId)) {
      return res.status(403).json({ erro: "Não é possível enviar mensagem para este usuário." });
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
    const outroUsuarioId = parseId(req.params.usuarioId);

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
      SELECT * FROM (
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
        ORDER BY mp.criado_em DESC, mp.id DESC
        LIMIT 100
      ) ultimas
      ORDER BY ultimas.criado_em ASC, ultimas.id ASC
      `,
      [req.usuario.id, outroUsuarioId],
    );

    await pool.query(
      `
      UPDATE mensagens_privadas
      SET lida = true
      WHERE remetente_id = $1 AND destinatario_id = $2 AND lida = false
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
    const sugestoes = await userService.listSuggestions(req.usuario.id);

    res.json(sugestoes);
  } catch (error) {
    console.error("❌ Erro ao buscar sugestões:", error.message);

    res.status(500).json({
      erro: "Erro ao buscar sugestões.",
    });
  }
});

/* ================= BUSCAR USUÁRIO ================= */

/* ================= USUÁRIOS ONLINE ================= */

app.get("/usuarios/online", autenticar, async (req, res) => {
  try {
    const online = await userService.listOnlineUsers(req.usuario.id);

    res.json(online);
  } catch (error) {
    console.error("❌ Erro ao buscar usuários online:", error.message);
    res.status(500).json({ erro: "Erro ao buscar usuários online." });
  }
});

/* ================= SEGUIDORES / SEGUINDO ================= */

app.get("/usuarios/seguidores", autenticar, async (req, res) => {
  try {
    const seguidores = await userService.listFollowers(req.usuario.id);

    res.json(seguidores);
  } catch (error) {
    console.error("❌ Erro ao buscar seguidores:", error.message);
    res.status(500).json({ erro: "Erro ao buscar seguidores." });
  }
});

app.get("/usuarios/seguindo", autenticar, async (req, res) => {
  try {
    const seguindo = await userService.listFollowing(req.usuario.id);

    res.json(seguindo);
  } catch (error) {
    console.error("❌ Erro ao buscar seguindo:", error.message);
    res.status(500).json({ erro: "Erro ao buscar seguindo." });
  }
});

app.get("/usuarios/:id", autenticar, async (req, res) => {
  try {
    const id = parseId(req.params.id);
    if (!id) return res.status(400).json({ erro: "Usuário inválido." });

    const usuario = await userService.findPublicProfile(id);

    if (!usuario || (await blockService.hasBlocked(id, req.usuario.id))) {
      return res.status(404).json({ erro: "Usuário não encontrado." });
    }

    res.json(usuario);
  } catch {
    res.status(500).json({ erro: "Erro ao buscar usuário." });
  }
});

/* ================= ESTATÍSTICAS DO PERFIL ================= */

app.get("/perfil/stats/:id", autenticar, async (req, res) => {
  try {
    const id = parseId(req.params.id);
    if (!id) return res.status(400).json({ erro: "Usuário inválido." });

    const stats = await pool.query(
      `
      SELECT
        COALESCE((SELECT COUNT(*) FROM posts WHERE usuario_id = $1), 0) AS total_posts,
        COALESCE((SELECT COUNT(*) FROM seguidores WHERE seguindo_id = $1), 0) AS total_seguidores,
        COALESCE((SELECT COUNT(*) FROM seguidores WHERE seguidor_id = $1), 0) AS total_seguindo,
        EXISTS (
          SELECT 1 FROM seguidores
          WHERE seguidor_id = $2 AND seguindo_id = $1
        ) AS seguindo,
        EXISTS (
          SELECT 1 FROM bloqueios
          WHERE bloqueador_id = $2 AND bloqueado_id = $1
        ) AS bloqueado_por_mim
      `,
      [id, req.usuario.id],
    );

    res.json({ ...stats.rows[0], ...(await debateService.userStats(id)) });
  } catch (error) {
    console.error("❌ Erro ao buscar estatísticas:", error.message);
    res.status(500).json({ erro: "Erro ao buscar estatísticas." });
  }
});

/* ================= POSTS DO PERFIL ================= */

app.get("/usuarios/:id/posts", autenticar, async (req, res) => {
  try {
    const usuarioId = Number(req.params.id);
    if (!Number.isInteger(usuarioId) || usuarioId <= 0) return res.status(400).json({ erro: "Usuário inválido." });
    const usuario = await userService.findPublicProfile(usuarioId);
    if (!usuario) return res.status(404).json({ erro: "Usuário não encontrado." });
    const page = await postService.listPosts({ viewerId: req.usuario.id, userId: usuarioId, limit: req.query.limit, cursor: req.query.cursor });
    if (page.status === "invalid_cursor") return res.status(400).json({ erro: "Cursor inválido." });
    res.json({ items: page.items, nextCursor: page.nextCursor });
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
    if (!socialService.parsePositiveId(seguindo_id)) return res.status(400).json({ erro: "Usuário inválido." });
    const result = await socialService.toggleFollow(seguidor_id, seguindo_id);
    if (result.status === "self") return res.status(400).json({ erro: "Você não pode seguir você mesmo." });
    if (result.status === "blocked") return res.status(403).json({ erro: "Não é possível seguir este usuário." });
    if (result.status === "not_found") return res.status(404).json({ erro: "Usuário não encontrado." });
    return res.json({ mensagem: result.seguindo ? "Você começou a seguir este usuário." : "Você deixou de seguir este usuário.", seguindo: result.seguindo });
  } catch (error) {
    console.error("❌ Erro ao seguir:", error.message);

    res.status(500).json({
      erro: "Erro interno ao seguir usuário.",
    });
  }
});

/* ================= CRIAR GRUPO ================= */

/* ================= API SOCIAL REST ================= */

app.post("/posts/:id/like", autenticar, async (req, res) => {
  const postId = socialService.parsePositiveId(req.params.id);
  if (!postId) return res.status(400).json({ erro: "Post inválido." });
  try {
    const result = await socialService.toggleLike(req.usuario.id, postId);
    if (result.status === "not_found") return res.status(404).json({ erro: "Post não encontrado." });
    return res.json({ mensagem: result.curtiu ? "Post curtido." : "Curtida removida.", curtiu: result.curtiu });
  } catch (error) {
    console.error("Erro ao atualizar curtida:", error.message);
    return res.status(500).json({ erro: "Erro ao atualizar curtida." });
  }
});

app.post("/posts/:id/share", autenticar, async (req, res) => {
  const postId = socialService.parsePositiveId(req.params.id);
  if (!postId) return res.status(400).json({ erro: "Post inválido." });
  try {
    const result = await socialService.share(req.usuario.id, postId);
    if (result.status === "not_found") return res.status(404).json({ erro: "Post não encontrado." });
    if (result.status === "duplicate") return res.status(409).json({ erro: "Você já compartilhou esta publicação." });
    return res.status(201).json({ mensagem: "Compartilhamento registrado com sucesso!" });
  } catch (error) {
    console.error("Erro ao compartilhar:", error.message);
    return res.status(500).json({ erro: "Erro ao compartilhar." });
  }
});

app.post("/users/:id/follow", autenticar, async (req, res) => {
  const targetId = socialService.parsePositiveId(req.params.id);
  if (!targetId) return res.status(400).json({ erro: "Usuário inválido." });
  try {
    const result = await socialService.toggleFollow(req.usuario.id, targetId);
    if (result.status === "self") return res.status(400).json({ erro: "Você não pode seguir você mesmo." });
    if (result.status === "blocked") return res.status(403).json({ erro: "Não é possível seguir este usuário." });
    if (result.status === "not_found") return res.status(404).json({ erro: "Usuário não encontrado." });
    return res.json({ mensagem: result.seguindo ? "Você começou a seguir este usuário." : "Você deixou de seguir este usuário.", seguindo: result.seguindo });
  } catch (error) {
    console.error("Erro ao seguir usuário:", error.message);
    return res.status(500).json({ erro: "Erro ao seguir usuário." });
  }
});

app.get("/search", autenticar, async (req, res) => {
  const query = String(req.query.q || "").trim().slice(0, 100);
  const limit = Math.min(Math.max(Number.parseInt(req.query.limit, 10) || 20, 1), 50);
  const offset = Math.max(Number.parseInt(req.query.offset, 10) || 0, 0);
  if (query.length < 2) return res.status(400).json({ erro: "Digite pelo menos 2 caracteres." });
  try {
    const bloqueados = await blockService.blockedIdsFor(req.usuario.id);
    const semBloqueados = bloqueados.length ? { notIn: bloqueados } : undefined;
    const [users, posts] = await prisma.$transaction([
      prisma.usuario.findMany({ where: { ...(semBloqueados ? { id: semBloqueados } : {}), OR: [{ nome: { contains: query, mode: "insensitive" } }, { bio: { contains: query, mode: "insensitive" } }] }, skip: offset, take: limit, select: { id: true, nome: true, foto: true, bio: true } }),
      prisma.post.findMany({ where: { ...(semBloqueados ? { usuarioId: semBloqueados } : {}), conteudo: { contains: query, mode: "insensitive" } }, orderBy: [{ criadoEm: "desc" }, { id: "desc" }], skip: offset, take: limit, select: { id: true, conteudo: true, tema: true, criadoEm: true, usuario: { select: { id: true, nome: true, foto: true } } } }),
    ]);
    return res.json({ users, posts, nextOffset: users.length === limit || posts.length === limit ? offset + limit : null });
  } catch (error) {
    console.error("Erro na pesquisa:", error.message);
    return res.status(500).json({ erro: "Erro ao pesquisar." });
  }
});

app.get("/notifications", autenticar, async (req, res) => {
  try {
    return res.json(await socialService.listNotifications(req.usuario.id, req.query.limit));
  } catch (error) {
    console.error("Erro ao listar notificações:", error.message);
    return res.status(500).json({ erro: "Erro ao listar notificações." });
  }
});

app.patch("/notifications/:id/read", autenticar, async (req, res) => {
  const id = socialService.parsePositiveId(req.params.id);
  if (!id) return res.status(400).json({ erro: "Notificação inválida." });
  const updated = await prisma.notificacao.updateMany({ where: { id, destinatarioId: req.usuario.id }, data: { lidaEm: new Date() } });
  if (!updated.count) return res.status(404).json({ erro: "Notificação não encontrada." });
  return res.json({ mensagem: "Notificação marcada como lida." });
});

app.patch("/notifications/read-all", autenticar, async (req, res) => {
  const updated = await prisma.notificacao.updateMany({ where: { destinatarioId: req.usuario.id, lidaEm: null }, data: { lidaEm: new Date() } });
  return res.json({ mensagem: "Notificações marcadas como lidas.", atualizadas: updated.count });
});

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

    const nomeGrupo = String(nome).trim().slice(0, 150);
    const descricaoGrupo = String(descricao).trim().slice(0, 1000);
    const categoriaGrupo = String(categoria || "Geral").trim().slice(0, 100) || "Geral";

    const client = await pool.connect();
    let novoGrupo;
    try {
      await client.query("BEGIN");
      // Código aleatório de 8 caracteres; em caso raríssimo de colisão, tenta de novo.
      for (let tentativa = 0; tentativa < 5 && !novoGrupo; tentativa += 1) {
        const grupo = await client.query(
          `
          INSERT INTO grupos (
            dono_id, nome, descricao, categoria, codigo_convite, tipo, teste_expira_em, acesso_pago
          )
          VALUES (
            $1, $2, $3, $4, $5, $6::VARCHAR,
            CASE WHEN $6::VARCHAR = 'reservada' THEN NOW() + INTERVAL '7 days' ELSE NULL END,
            false
          )
          ON CONFLICT (codigo_convite) DO NOTHING
          RETURNING *
          `,
          [req.usuario.id, nomeGrupo, descricaoGrupo, categoriaGrupo, gerarCodigoGrupo(), tipoGrupo],
        );
        novoGrupo = grupo.rows[0];
      }
      if (!novoGrupo) throw new Error("Não foi possível gerar código de convite.");

      await client.query(
        "INSERT INTO grupo_membros (grupo_id, usuario_id, papel) VALUES ($1, $2, 'admin')",
        [novoGrupo.id, req.usuario.id],
      );
      await client.query("COMMIT");
    } catch (error) {
      await client.query("ROLLBACK").catch(() => {});
      throw error;
    } finally {
      client.release();
    }

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
    const grupoId = parseId(req.params.id);
    if (!grupoId) return res.status(400).json({ erro: "Grupo inválido." });

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
    const grupoId = parseId(req.params.id);
    if (!grupoId) return res.status(400).json({ erro: "Grupo inválido." });

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
      SELECT gs.*, u.nome, u.foto
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
    const grupoId = parseId(req.params.id);
    if (!grupoId) return res.status(400).json({ erro: "Grupo inválido." });
    const solicitacaoId = parseId(req.params.solicitacaoId);
    if (!solicitacaoId) return res.status(400).json({ erro: "Solicitação inválida." });
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
    const codigo = String(req.body.codigo || "").trim();

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
    const id = parseId(req.params.id);
    if (!id) return res.status(400).json({ erro: "Grupo inválido." });

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
    const id = parseId(req.params.id);
    if (!id) return res.status(400).json({ erro: "Grupo inválido." });

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
      SELECT * FROM (
        SELECT
          gm.*,
          u.nome,
          u.foto
        FROM grupo_mensagens gm
        JOIN usuarios u ON u.id = gm.usuario_id
        WHERE gm.grupo_id = $1
        ORDER BY gm.criado_em DESC, gm.id DESC
        LIMIT 200
      ) ultimas
      ORDER BY ultimas.criado_em ASC, ultimas.id ASC
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
    const id = parseId(req.params.id);
    if (!id) return res.status(400).json({ erro: "Grupo inválido." });
    const mensagem = String(req.body.mensagem || "").trim();

    if (!mensagem) {
      return res.status(400).json({ erro: "Digite uma mensagem." });
    }

    if (mensagem.length > MAX_TEXTO_MENSAGEM) {
      return res.status(400).json({ erro: `A mensagem pode ter no máximo ${MAX_TEXTO_MENSAGEM} caracteres.` });
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
    const id = parseId(req.params.id);
    if (!id) return res.status(400).json({ erro: "Grupo inválido." });

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

/* ================= DEBATE ESTRUTURADO ================= */

app.get("/debates/:id", autenticar, async (req, res) => {
  const postId = parseId(req.params.id);
  if (!postId) return res.status(400).json({ erro: "Debate inválido." });
  try {
    const post = await postService.getPost(postId, req.usuario.id);
    if (!post || post.tipo !== "debate" || (await blockService.isBlockedEitherWay(req.usuario.id, post.usuario_id))) {
      return res.status(404).json({ erro: "Debate não encontrado." });
    }
    return res.json({ post, argumentos: await debateService.listArguments(postId, req.usuario.id) });
  } catch (error) {
    console.error("Erro ao abrir debate:", error.message);
    return res.status(500).json({ erro: "Erro ao abrir debate." });
  }
});

app.post("/debates/:id/posicao", autenticar, async (req, res) => {
  const postId = parseId(req.params.id);
  if (!postId) return res.status(400).json({ erro: "Debate inválido." });
  const argumentoId = req.body?.argumento_id ? parseId(req.body.argumento_id) : null;
  if (req.body?.argumento_id && !argumentoId) return res.status(400).json({ erro: "Argumento inválido." });
  try {
    const result = await debateService.choosePosition({ postId, usuarioId: req.usuario.id, lado: req.body?.lado, argumentoId, notify: socialService.notify });
    if (result.status === "invalid_side") return res.status(400).json({ erro: "Escolha um dos lados do debate." });
    if (result.status === "not_found") return res.status(404).json({ erro: "Debate não encontrado." });
    if (result.status === "invalid_argument") return res.status(400).json({ erro: "Esse argumento não pode ser indicado como o que convenceu você." });
    const post = await postService.getPost(postId, req.usuario.id);
    return res.json({ mudou: result.mudou, debate: post.debate });
  } catch (error) {
    console.error("Erro ao registrar posição:", error.message);
    return res.status(500).json({ erro: "Erro ao registrar sua posição." });
  }
});

app.post("/debates/:id/argumentos", autenticar, async (req, res) => {
  const postId = parseId(req.params.id);
  if (!postId) return res.status(400).json({ erro: "Debate inválido." });
  const texto = String(req.body?.texto || "").trim();
  if (texto && bloquearSeNecessario(texto, res)) return;
  try {
    const result = await debateService.createArgument({ postId, usuarioId: req.usuario.id, texto, notify: socialService.notify });
    const erros = {
      not_found: [404, "Debate não encontrado."],
      blocked: [403, "Você não pode participar deste debate."],
      no_position: [409, "Escolha um lado antes de argumentar."],
      empty: [400, "Escreva o seu argumento."],
      too_long: [400, `O argumento pode ter no máximo ${debateService.MAX_ARGUMENTO} caracteres.`],
    };
    if (erros[result.status]) {
      const [status, erro] = erros[result.status];
      return res.status(status).json({ erro });
    }
    return res.status(201).json({ mensagem: "Argumento publicado.", argumentos: await debateService.listArguments(postId, req.usuario.id) });
  } catch (error) {
    console.error("Erro ao publicar argumento:", error.message);
    return res.status(500).json({ erro: "Erro ao publicar argumento." });
  }
});

app.post("/argumentos/:id/voto", autenticar, async (req, res) => {
  const argumentoId = parseId(req.params.id);
  if (!argumentoId) return res.status(400).json({ erro: "Argumento inválido." });
  try {
    const result = await debateService.toggleVote({ argumentoId, usuarioId: req.usuario.id });
    if (result.status === "not_found") return res.status(404).json({ erro: "Argumento não encontrado." });
    if (result.status === "own") return res.status(400).json({ erro: "Você não pode avaliar o próprio argumento." });
    if (result.status === "blocked") return res.status(403).json({ erro: "Você não pode avaliar este argumento." });
    return res.json({ votei: result.votei });
  } catch (error) {
    console.error("Erro ao avaliar argumento:", error.message);
    return res.status(500).json({ erro: "Erro ao avaliar argumento." });
  }
});

app.delete("/argumentos/:id", autenticar, async (req, res) => {
  const argumentoId = parseId(req.params.id);
  if (!argumentoId) return res.status(400).json({ erro: "Argumento inválido." });
  try {
    const result = await debateService.deleteArgument({ argumentoId, usuarioId: req.usuario.id, isStaff: moderationService.isStaff(req.usuario.papel) });
    if (result.status === "not_found") return res.status(404).json({ erro: "Argumento não encontrado." });
    if (result.status === "forbidden") return res.status(403).json({ erro: "Você só pode apagar seus próprios argumentos." });
    return res.json({ mensagem: "Argumento apagado." });
  } catch (error) {
    console.error("Erro ao apagar argumento:", error.message);
    return res.status(500).json({ erro: "Erro ao apagar argumento." });
  }
});

/* ================= BLOQUEIO ENTRE USUÁRIOS ================= */

app.post("/usuarios/:id/bloquear", autenticar, async (req, res) => {
  const alvoId = parseId(req.params.id);
  if (!alvoId) return res.status(400).json({ erro: "Usuário inválido." });
  try {
    const result = await blockService.toggleBlock(req.usuario.id, alvoId);
    if (result.status === "self") return res.status(400).json({ erro: "Você não pode bloquear a si mesmo." });
    if (result.status === "not_found") return res.status(404).json({ erro: "Usuário não encontrado." });
    return res.json({
      bloqueado: result.bloqueado,
      mensagem: result.bloqueado
        ? "Usuário bloqueado. Vocês não verão mais as publicações um do outro."
        : "Usuário desbloqueado.",
    });
  } catch (error) {
    console.error("Erro ao bloquear usuário:", error.message);
    return res.status(500).json({ erro: "Erro ao atualizar bloqueio." });
  }
});

app.get("/bloqueios", autenticar, async (req, res) => {
  try {
    return res.json(await blockService.listBlocked(req.usuario.id));
  } catch (error) {
    console.error("Erro ao listar bloqueios:", error.message);
    return res.status(500).json({ erro: "Erro ao listar bloqueios." });
  }
});

/* ================= MODERAÇÃO (EQUIPE) ================= */

app.get("/admin/denuncias", autenticar, exigirEquipe, async (req, res) => {
  try {
    return res.json(await moderationService.listReports({ status: req.query.status, limit: req.query.limit }));
  } catch (error) {
    console.error("Erro ao listar denúncias:", error.message);
    return res.status(500).json({ erro: "Erro ao listar denúncias." });
  }
});

app.post("/admin/denuncias/:id/resolver", autenticar, exigirEquipe, async (req, res) => {
  const denunciaId = parseId(req.params.id);
  if (!denunciaId) return res.status(400).json({ erro: "Denúncia inválida." });
  try {
    const { acao, dias, motivo } = req.body || {};
    const result = await moderationService.resolveReport({ denunciaId, moderadorId: req.usuario.id, acao, dias, motivo });
    const erros = {
      invalid_action: [400, "Ação inválida."],
      not_found: [404, "Denúncia não encontrada."],
      already_resolved: [409, "Esta denúncia já foi resolvida."],
      no_post: [400, "Esta denúncia não está ligada a uma publicação."],
      no_user: [400, "Esta denúncia não está ligada a um usuário."],
      self: [400, "Você não pode suspender a si mesmo."],
      target_is_staff: [403, "Membros da equipe não podem ser suspensos por aqui."],
    };
    if (erros[result.status]) {
      const [status, erro] = erros[result.status];
      return res.status(status).json({ erro });
    }
    if (result.removedPostImage) {
      removerArquivoArmazenado(result.removedPostImage).catch(() => console.error("Falha ao remover mídia de post moderado."));
    }
    const mensagens = {
      remover_post: "Publicação removida e denúncias relacionadas resolvidas.",
      suspender_usuario: "Usuário suspenso e desconectado de todas as sessões.",
      arquivar: "Denúncia arquivada sem ação.",
    };
    return res.json({ mensagem: mensagens[acao], suspenso_ate: result.suspensoAte || null });
  } catch (error) {
    console.error("Erro ao resolver denúncia:", error.message);
    return res.status(500).json({ erro: "Erro ao resolver denúncia." });
  }
});

app.post("/admin/usuarios/:id/reativar", autenticar, exigirEquipe, async (req, res) => {
  const usuarioId = parseId(req.params.id);
  if (!usuarioId) return res.status(400).json({ erro: "Usuário inválido." });
  try {
    const ok = await moderationService.liftSuspension(usuarioId);
    if (!ok) return res.status(404).json({ erro: "Usuário não encontrado." });
    return res.json({ mensagem: "Suspensão removida." });
  } catch (error) {
    console.error("Erro ao reativar usuário:", error.message);
    return res.status(500).json({ erro: "Erro ao reativar usuário." });
  }
});

app.get("/admin/metricas", autenticar, exigirEquipe, async (req, res) => {
  try {
    return res.json(await moderationService.metrics());
  } catch (error) {
    console.error("Erro ao calcular métricas:", error.message);
    return res.status(500).json({ erro: "Erro ao calcular métricas." });
  }
});

app.use((error, req, res, next) => {
  void next;
  if (error instanceof multer.MulterError) {
    const status = error.code === "LIMIT_FILE_SIZE" ? 413 : 400;

    return res.status(status).json({
      erro:
        error.code === "LIMIT_FILE_SIZE"
          ? "Arquivo maior que o limite permitido."
          : "Erro ao processar arquivo enviado.",
    });
  }

  if (error?.message === "Tipo de arquivo não permitido.") {
    return res.status(400).json({ erro: error.message });
  }

  if (error?.message === "A foto deve ser JPG, PNG, WEBP ou GIF.") {
    return res.status(400).json({ erro: error.message });
  }

  console.error("Erro inesperado:", process.env.NODE_ENV === "production" ? error?.name : error);
  return res.status(500).json({ erro: "Erro interno no servidor." });
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
