-- Moderação (papéis, suspensão, resolução de denúncias) e bloqueio entre usuários.

-- Usuários: papel e suspensão
ALTER TABLE "usuarios" ADD COLUMN "papel" VARCHAR(20) NOT NULL DEFAULT 'usuario',
ADD COLUMN "suspenso_ate" TIMESTAMP(6),
ADD COLUMN "suspenso_motivo" VARCHAR(300);

ALTER TABLE "usuarios" ADD CONSTRAINT "usuarios_papel_check"
  CHECK ("papel" IN ('usuario', 'moderador', 'admin'));

-- Denúncias: histórico de moderação que sobrevive à remoção do post
ALTER TABLE "denuncias" ADD COLUMN "acao" VARCHAR(30),
ADD COLUMN "conteudo_denunciado" TEXT,
ADD COLUMN "resolvido_em" TIMESTAMP(6),
ADD COLUMN "resolvido_por_id" INTEGER;

-- Denúncias antigas de post passam a apontar também para o autor e guardam o texto,
-- para que "denuncias_alvo_check" continue válido quando o post for removido.
UPDATE "denuncias" d
SET "usuario_id" = COALESCE(d."usuario_id", p."usuario_id"),
    "conteudo_denunciado" = COALESCE(d."conteudo_denunciado", p."conteudo")
FROM "posts" p
WHERE d."post_id" = p."id";

-- Status continua validado por "denuncias_status_check" (pendente, em_analise, resolvida, rejeitada).
ALTER TABLE "denuncias" ADD CONSTRAINT "denuncias_acao_check"
  CHECK ("acao" IS NULL OR "acao" IN ('remover_post', 'suspender_usuario', 'arquivar'));

ALTER TABLE "denuncias" DROP CONSTRAINT "denuncias_post_id_fkey";
ALTER TABLE "denuncias" ADD CONSTRAINT "denuncias_post_id_fkey" FOREIGN KEY ("post_id") REFERENCES "posts"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "denuncias" ADD CONSTRAINT "denuncias_resolvido_por_id_fkey" FOREIGN KEY ("resolvido_por_id") REFERENCES "usuarios"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Bloqueios
CREATE TABLE "bloqueios" (
    "id" SERIAL NOT NULL,
    "bloqueador_id" INTEGER NOT NULL,
    "bloqueado_id" INTEGER NOT NULL,
    "criado_em" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "bloqueios_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "bloqueios_nao_bloquear_si_check" CHECK ("bloqueador_id" <> "bloqueado_id")
);

CREATE INDEX "idx_bloqueios_bloqueado_id" ON "bloqueios"("bloqueado_id");
CREATE UNIQUE INDEX "bloqueios_bloqueador_id_bloqueado_id_key" ON "bloqueios"("bloqueador_id", "bloqueado_id");

ALTER TABLE "bloqueios" ADD CONSTRAINT "bloqueios_bloqueador_id_fkey" FOREIGN KEY ("bloqueador_id") REFERENCES "usuarios"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "bloqueios" ADD CONSTRAINT "bloqueios_bloqueado_id_fkey" FOREIGN KEY ("bloqueado_id") REFERENCES "usuarios"("id") ON DELETE CASCADE ON UPDATE CASCADE;
