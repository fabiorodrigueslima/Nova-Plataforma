-- CreateEnum
CREATE TYPE "provedor_autenticacao" AS ENUM ('local', 'google');

-- CreateEnum
CREATE TYPE "tipo_grupo" AS ENUM ('publico', 'reservada');

-- CreateEnum
CREATE TYPE "papel_grupo" AS ENUM ('admin', 'membro');

-- CreateEnum
CREATE TYPE "status_solicitacao_grupo" AS ENUM ('pendente', 'aprovada', 'recusada');

-- CreateEnum
CREATE TYPE "status_denuncia" AS ENUM ('pendente', 'em_analise', 'resolvida', 'rejeitada');

-- CreateEnum
CREATE TYPE "status_exclusao_conta" AS ENUM ('pendente', 'concluida', 'falhou');

-- CreateTable
CREATE TABLE "usuarios" (
    "id" SERIAL NOT NULL,
    "nome" VARCHAR(150) NOT NULL,
    "email" VARCHAR(150) NOT NULL,
    "senha" TEXT,
    "google_id" TEXT,
    "provider" "provedor_autenticacao" NOT NULL DEFAULT 'local',
    "foto" TEXT,
    "bio" TEXT,
    "essencia_representa" TEXT,
    "essencia_tema" TEXT,
    "essencia_frase" TEXT,
    "aberto_para" TEXT,
    "ultimo_acesso" TIMESTAMP(6),
    "token_recuperacao" TEXT,
    "token_expira" TIMESTAMP(6),
    "criado_em" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "usuarios_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "exclusoes_conta" (
    "id" SERIAL NOT NULL,
    "usuario_id" INTEGER,
    "nome" VARCHAR(150),
    "email" VARCHAR(150),
    "motivo" TEXT,
    "status" "status_exclusao_conta" NOT NULL DEFAULT 'concluida',
    "solicitado_em" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "concluido_em" TIMESTAMP(6),

    CONSTRAINT "exclusoes_conta_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "posts" (
    "id" SERIAL NOT NULL,
    "usuario_id" INTEGER NOT NULL,
    "conteudo" TEXT,
    "tema" VARCHAR(100),
    "sentimento" VARCHAR(100),
    "imagem" TEXT,
    "tipo_arquivo" VARCHAR(50),
    "nome_arquivo" TEXT,
    "criado_em" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizado_em" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "posts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "curtidas" (
    "id" SERIAL NOT NULL,
    "usuario_id" INTEGER NOT NULL,
    "post_id" INTEGER NOT NULL,
    "criado_em" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "curtidas_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "comentarios" (
    "id" SERIAL NOT NULL,
    "usuario_id" INTEGER NOT NULL,
    "post_id" INTEGER NOT NULL,
    "conteudo" TEXT NOT NULL,
    "texto" TEXT,
    "criado_em" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "comentarios_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "seguidores" (
    "id" SERIAL NOT NULL,
    "seguidor_id" INTEGER NOT NULL,
    "seguindo_id" INTEGER NOT NULL,
    "criado_em" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "seguidores_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "compartilhamentos" (
    "id" SERIAL NOT NULL,
    "usuario_id" INTEGER NOT NULL,
    "post_id" INTEGER NOT NULL,
    "criado_em" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "compartilhamentos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "denuncias" (
    "id" SERIAL NOT NULL,
    "denunciante_id" INTEGER,
    "usuario_id" INTEGER,
    "post_id" INTEGER,
    "motivo" TEXT NOT NULL,
    "status" "status_denuncia" NOT NULL DEFAULT 'pendente',
    "criado_em" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "denuncias_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "mensagens_privadas" (
    "id" SERIAL NOT NULL,
    "remetente_id" INTEGER NOT NULL,
    "destinatario_id" INTEGER NOT NULL,
    "mensagem" TEXT NOT NULL,
    "lida" BOOLEAN NOT NULL DEFAULT false,
    "criado_em" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "mensagens_privadas_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "grupos" (
    "id" SERIAL NOT NULL,
    "dono_id" INTEGER NOT NULL,
    "nome" VARCHAR(150) NOT NULL,
    "descricao" TEXT NOT NULL,
    "categoria" VARCHAR(100) NOT NULL DEFAULT 'Geral',
    "codigo_convite" VARCHAR(20) NOT NULL,
    "tipo" "tipo_grupo" NOT NULL DEFAULT 'publico',
    "teste_expira_em" TIMESTAMP(6),
    "acesso_pago" BOOLEAN NOT NULL DEFAULT false,
    "criado_em" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "grupos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "grupo_membros" (
    "id" SERIAL NOT NULL,
    "grupo_id" INTEGER NOT NULL,
    "usuario_id" INTEGER NOT NULL,
    "papel" "papel_grupo" NOT NULL DEFAULT 'membro',
    "criado_em" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "grupo_membros_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "grupo_mensagens" (
    "id" SERIAL NOT NULL,
    "grupo_id" INTEGER NOT NULL,
    "usuario_id" INTEGER NOT NULL,
    "mensagem" TEXT NOT NULL,
    "criado_em" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "grupo_mensagens_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "grupo_solicitacoes" (
    "id" SERIAL NOT NULL,
    "grupo_id" INTEGER NOT NULL,
    "usuario_id" INTEGER NOT NULL,
    "status" "status_solicitacao_grupo" NOT NULL DEFAULT 'pendente',
    "criado_em" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizado_em" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "grupo_solicitacoes_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "usuarios_email_key" ON "usuarios"("email");

-- CreateIndex
CREATE UNIQUE INDEX "usuarios_google_id_key" ON "usuarios"("google_id");

-- CreateIndex
CREATE INDEX "idx_exclusoes_conta_solicitado_em" ON "exclusoes_conta"("solicitado_em");

-- CreateIndex
CREATE INDEX "idx_posts_usuario_id" ON "posts"("usuario_id");

-- CreateIndex
CREATE INDEX "idx_posts_criado_em" ON "posts"("criado_em" DESC);

-- CreateIndex
CREATE INDEX "idx_curtidas_post_id" ON "curtidas"("post_id");

-- CreateIndex
CREATE UNIQUE INDEX "curtidas_usuario_id_post_id_key" ON "curtidas"("usuario_id", "post_id");

-- CreateIndex
CREATE INDEX "idx_comentarios_post_id" ON "comentarios"("post_id");

-- CreateIndex
CREATE INDEX "idx_comentarios_usuario_id" ON "comentarios"("usuario_id");

-- CreateIndex
CREATE INDEX "idx_seguidores_seguidor_id" ON "seguidores"("seguidor_id");

-- CreateIndex
CREATE INDEX "idx_seguidores_seguindo_id" ON "seguidores"("seguindo_id");

-- CreateIndex
CREATE UNIQUE INDEX "seguidores_seguidor_id_seguindo_id_key" ON "seguidores"("seguidor_id", "seguindo_id");

-- CreateIndex
CREATE INDEX "idx_compartilhamentos_post_id" ON "compartilhamentos"("post_id");

-- CreateIndex
CREATE INDEX "idx_compartilhamentos_usuario_id" ON "compartilhamentos"("usuario_id");

-- CreateIndex
CREATE INDEX "idx_denuncias_status_criado_em" ON "denuncias"("status", "criado_em");

-- CreateIndex
CREATE INDEX "idx_denuncias_usuario_id" ON "denuncias"("usuario_id");

-- CreateIndex
CREATE INDEX "idx_denuncias_post_id" ON "denuncias"("post_id");

-- CreateIndex
CREATE INDEX "idx_mensagens_privadas_destinatario_id" ON "mensagens_privadas"("destinatario_id");

-- CreateIndex
CREATE INDEX "idx_mensagens_privadas_conversa" ON "mensagens_privadas"("remetente_id", "destinatario_id", "criado_em" DESC);

-- CreateIndex
CREATE INDEX "idx_mensagens_privadas_nao_lidas" ON "mensagens_privadas"("destinatario_id", "lida");

-- CreateIndex
CREATE UNIQUE INDEX "grupos_codigo_convite_key" ON "grupos"("codigo_convite");

-- CreateIndex
CREATE INDEX "idx_grupos_dono_id" ON "grupos"("dono_id");

-- CreateIndex
CREATE INDEX "idx_grupos_tipo_criado_em" ON "grupos"("tipo", "criado_em" DESC);

-- CreateIndex
CREATE INDEX "idx_grupo_membros_usuario_id" ON "grupo_membros"("usuario_id");

-- CreateIndex
CREATE UNIQUE INDEX "grupo_membros_grupo_id_usuario_id_key" ON "grupo_membros"("grupo_id", "usuario_id");

-- CreateIndex
CREATE INDEX "idx_grupo_mensagens_grupo_id" ON "grupo_mensagens"("grupo_id", "criado_em");

-- CreateIndex
CREATE INDEX "idx_grupo_mensagens_usuario_id" ON "grupo_mensagens"("usuario_id");

-- CreateIndex
CREATE INDEX "idx_grupo_solicitacoes_grupo_status" ON "grupo_solicitacoes"("grupo_id", "status");

-- CreateIndex
CREATE INDEX "idx_grupo_solicitacoes_usuario_id" ON "grupo_solicitacoes"("usuario_id");

-- CreateIndex
CREATE UNIQUE INDEX "grupo_solicitacoes_grupo_id_usuario_id_key" ON "grupo_solicitacoes"("grupo_id", "usuario_id");

-- AddForeignKey
ALTER TABLE "posts" ADD CONSTRAINT "posts_usuario_id_fkey" FOREIGN KEY ("usuario_id") REFERENCES "usuarios"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "curtidas" ADD CONSTRAINT "curtidas_usuario_id_fkey" FOREIGN KEY ("usuario_id") REFERENCES "usuarios"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "curtidas" ADD CONSTRAINT "curtidas_post_id_fkey" FOREIGN KEY ("post_id") REFERENCES "posts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "comentarios" ADD CONSTRAINT "comentarios_usuario_id_fkey" FOREIGN KEY ("usuario_id") REFERENCES "usuarios"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "comentarios" ADD CONSTRAINT "comentarios_post_id_fkey" FOREIGN KEY ("post_id") REFERENCES "posts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "seguidores" ADD CONSTRAINT "seguidores_seguidor_id_fkey" FOREIGN KEY ("seguidor_id") REFERENCES "usuarios"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "seguidores" ADD CONSTRAINT "seguidores_seguindo_id_fkey" FOREIGN KEY ("seguindo_id") REFERENCES "usuarios"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "compartilhamentos" ADD CONSTRAINT "compartilhamentos_usuario_id_fkey" FOREIGN KEY ("usuario_id") REFERENCES "usuarios"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "compartilhamentos" ADD CONSTRAINT "compartilhamentos_post_id_fkey" FOREIGN KEY ("post_id") REFERENCES "posts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "denuncias" ADD CONSTRAINT "denuncias_denunciante_id_fkey" FOREIGN KEY ("denunciante_id") REFERENCES "usuarios"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "denuncias" ADD CONSTRAINT "denuncias_usuario_id_fkey" FOREIGN KEY ("usuario_id") REFERENCES "usuarios"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "denuncias" ADD CONSTRAINT "denuncias_post_id_fkey" FOREIGN KEY ("post_id") REFERENCES "posts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "mensagens_privadas" ADD CONSTRAINT "mensagens_privadas_remetente_id_fkey" FOREIGN KEY ("remetente_id") REFERENCES "usuarios"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "mensagens_privadas" ADD CONSTRAINT "mensagens_privadas_destinatario_id_fkey" FOREIGN KEY ("destinatario_id") REFERENCES "usuarios"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "grupos" ADD CONSTRAINT "grupos_dono_id_fkey" FOREIGN KEY ("dono_id") REFERENCES "usuarios"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "grupo_membros" ADD CONSTRAINT "grupo_membros_grupo_id_fkey" FOREIGN KEY ("grupo_id") REFERENCES "grupos"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "grupo_membros" ADD CONSTRAINT "grupo_membros_usuario_id_fkey" FOREIGN KEY ("usuario_id") REFERENCES "usuarios"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "grupo_mensagens" ADD CONSTRAINT "grupo_mensagens_grupo_id_fkey" FOREIGN KEY ("grupo_id") REFERENCES "grupos"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "grupo_mensagens" ADD CONSTRAINT "grupo_mensagens_usuario_id_fkey" FOREIGN KEY ("usuario_id") REFERENCES "usuarios"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "grupo_solicitacoes" ADD CONSTRAINT "grupo_solicitacoes_grupo_id_fkey" FOREIGN KEY ("grupo_id") REFERENCES "grupos"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "grupo_solicitacoes" ADD CONSTRAINT "grupo_solicitacoes_usuario_id_fkey" FOREIGN KEY ("usuario_id") REFERENCES "usuarios"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Integrity rules that Prisma schema syntax cannot currently express.
ALTER TABLE "usuarios"
  ADD CONSTRAINT "usuarios_metodo_autenticacao_check"
  CHECK ("senha" IS NOT NULL OR "google_id" IS NOT NULL);

ALTER TABLE "posts"
  ADD CONSTRAINT "posts_conteudo_ou_arquivo_check"
  CHECK (NULLIF(BTRIM("conteudo"), '') IS NOT NULL OR "imagem" IS NOT NULL);

ALTER TABLE "seguidores"
  ADD CONSTRAINT "seguidores_nao_seguir_si_check"
  CHECK ("seguidor_id" <> "seguindo_id");

ALTER TABLE "mensagens_privadas"
  ADD CONSTRAINT "mensagens_privadas_destinatarios_distintos_check"
  CHECK ("remetente_id" <> "destinatario_id");

ALTER TABLE "denuncias"
  ADD CONSTRAINT "denuncias_alvo_check"
  CHECK ("usuario_id" IS NOT NULL OR "post_id" IS NOT NULL);

CREATE UNIQUE INDEX "usuarios_email_lower_key" ON "usuarios" (LOWER("email"));
