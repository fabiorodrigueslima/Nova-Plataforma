-- Debate estruturado: posts do tipo debate, posições, argumentos, votos e mudanças de opinião.

-- AlterTable
ALTER TABLE "posts" ADD COLUMN     "lado_a" VARCHAR(60),
ADD COLUMN     "lado_b" VARCHAR(60),
ADD COLUMN     "tipo" VARCHAR(20) NOT NULL DEFAULT 'post';

-- CreateTable
CREATE TABLE "debate_posicoes" (
    "id" SERIAL NOT NULL,
    "post_id" INTEGER NOT NULL,
    "usuario_id" INTEGER NOT NULL,
    "lado" VARCHAR(1) NOT NULL,
    "criado_em" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizado_em" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "debate_posicoes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "debate_argumentos" (
    "id" SERIAL NOT NULL,
    "post_id" INTEGER NOT NULL,
    "usuario_id" INTEGER NOT NULL,
    "lado" VARCHAR(1) NOT NULL,
    "texto" VARCHAR(800) NOT NULL,
    "criado_em" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "debate_argumentos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "argumento_votos" (
    "id" SERIAL NOT NULL,
    "argumento_id" INTEGER NOT NULL,
    "usuario_id" INTEGER NOT NULL,
    "criado_em" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "argumento_votos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "mudancas_opiniao" (
    "id" SERIAL NOT NULL,
    "post_id" INTEGER NOT NULL,
    "usuario_id" INTEGER NOT NULL,
    "de" VARCHAR(1) NOT NULL,
    "para" VARCHAR(1) NOT NULL,
    "argumento_id" INTEGER,
    "criado_em" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "mudancas_opiniao_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "idx_debate_posicoes_post_lado" ON "debate_posicoes"("post_id", "lado");

-- CreateIndex
CREATE UNIQUE INDEX "debate_posicoes_post_id_usuario_id_key" ON "debate_posicoes"("post_id", "usuario_id");

-- CreateIndex
CREATE INDEX "idx_debate_argumentos_post_lado" ON "debate_argumentos"("post_id", "lado");

-- CreateIndex
CREATE INDEX "idx_debate_argumentos_usuario_id" ON "debate_argumentos"("usuario_id");

-- CreateIndex
CREATE INDEX "idx_argumento_votos_usuario_id" ON "argumento_votos"("usuario_id");

-- CreateIndex
CREATE UNIQUE INDEX "argumento_votos_argumento_id_usuario_id_key" ON "argumento_votos"("argumento_id", "usuario_id");

-- CreateIndex
CREATE INDEX "idx_mudancas_opiniao_usuario_id" ON "mudancas_opiniao"("usuario_id");

-- CreateIndex
CREATE INDEX "idx_mudancas_opiniao_argumento_id" ON "mudancas_opiniao"("argumento_id");

-- CreateIndex
CREATE INDEX "idx_mudancas_opiniao_post_id" ON "mudancas_opiniao"("post_id");

-- AddForeignKey
ALTER TABLE "debate_posicoes" ADD CONSTRAINT "debate_posicoes_post_id_fkey" FOREIGN KEY ("post_id") REFERENCES "posts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "debate_posicoes" ADD CONSTRAINT "debate_posicoes_usuario_id_fkey" FOREIGN KEY ("usuario_id") REFERENCES "usuarios"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "debate_argumentos" ADD CONSTRAINT "debate_argumentos_post_id_fkey" FOREIGN KEY ("post_id") REFERENCES "posts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "debate_argumentos" ADD CONSTRAINT "debate_argumentos_usuario_id_fkey" FOREIGN KEY ("usuario_id") REFERENCES "usuarios"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "argumento_votos" ADD CONSTRAINT "argumento_votos_argumento_id_fkey" FOREIGN KEY ("argumento_id") REFERENCES "debate_argumentos"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "argumento_votos" ADD CONSTRAINT "argumento_votos_usuario_id_fkey" FOREIGN KEY ("usuario_id") REFERENCES "usuarios"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "mudancas_opiniao" ADD CONSTRAINT "mudancas_opiniao_post_id_fkey" FOREIGN KEY ("post_id") REFERENCES "posts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "mudancas_opiniao" ADD CONSTRAINT "mudancas_opiniao_usuario_id_fkey" FOREIGN KEY ("usuario_id") REFERENCES "usuarios"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "mudancas_opiniao" ADD CONSTRAINT "mudancas_opiniao_argumento_id_fkey" FOREIGN KEY ("argumento_id") REFERENCES "debate_argumentos"("id") ON DELETE SET NULL ON UPDATE CASCADE;


-- Regras de integridade do debate
ALTER TABLE "posts" ADD CONSTRAINT "posts_tipo_check" CHECK ("tipo" IN ('post', 'debate'));
ALTER TABLE "posts" ADD CONSTRAINT "posts_debate_lados_check"
  CHECK ("tipo" <> 'debate' OR (NULLIF(BTRIM("lado_a"), '') IS NOT NULL AND NULLIF(BTRIM("lado_b"), '') IS NOT NULL));
ALTER TABLE "debate_posicoes" ADD CONSTRAINT "debate_posicoes_lado_check" CHECK ("lado" IN ('a', 'b'));
ALTER TABLE "debate_argumentos" ADD CONSTRAINT "debate_argumentos_lado_check" CHECK ("lado" IN ('a', 'b'));
ALTER TABLE "debate_argumentos" ADD CONSTRAINT "debate_argumentos_texto_check" CHECK (NULLIF(BTRIM("texto"), '') IS NOT NULL);
ALTER TABLE "mudancas_opiniao" ADD CONSTRAINT "mudancas_opiniao_lados_check"
  CHECK ("de" IN ('a', 'b') AND "para" IN ('a', 'b') AND "de" <> "para");

-- Novos tipos de notificação: argumento no seu debate e argumento que convenceu alguém
ALTER TABLE "notificacoes" DROP CONSTRAINT "notificacoes_tipo_check";
ALTER TABLE "notificacoes" ADD CONSTRAINT "notificacoes_tipo_check"
  CHECK ("tipo" IN ('curtida', 'comentario', 'compartilhamento', 'seguidor', 'argumento', 'convenceu'));
