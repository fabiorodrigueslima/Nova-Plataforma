-- Existing duplicate share rows represent the same user action. Keep the oldest row.
DELETE FROM "compartilhamentos" a
USING "compartilhamentos" b
WHERE a."usuario_id" = b."usuario_id"
  AND a."post_id" = b."post_id"
  AND a."id" > b."id";

CREATE UNIQUE INDEX "compartilhamentos_usuario_id_post_id_key"
ON "compartilhamentos"("usuario_id", "post_id");

CREATE TABLE "notificacoes" (
  "id" SERIAL NOT NULL,
  "destinatario_id" INTEGER NOT NULL,
  "ator_id" INTEGER,
  "tipo" VARCHAR(30) NOT NULL,
  "mensagem" VARCHAR(240) NOT NULL,
  "post_id" INTEGER,
  "lida_em" TIMESTAMP(6),
  "criado_em" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "notificacoes_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "notificacoes_tipo_check" CHECK ("tipo" IN ('curtida', 'comentario', 'compartilhamento', 'seguidor'))
);

CREATE INDEX "idx_notificacoes_caixa_entrada"
ON "notificacoes"("destinatario_id", "lida_em", "criado_em" DESC);
CREATE INDEX "idx_notificacoes_post_id" ON "notificacoes"("post_id");

ALTER TABLE "notificacoes" ADD CONSTRAINT "notificacoes_destinatario_id_fkey"
FOREIGN KEY ("destinatario_id") REFERENCES "usuarios"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "notificacoes" ADD CONSTRAINT "notificacoes_ator_id_fkey"
FOREIGN KEY ("ator_id") REFERENCES "usuarios"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "notificacoes" ADD CONSTRAINT "notificacoes_post_id_fkey"
FOREIGN KEY ("post_id") REFERENCES "posts"("id") ON DELETE CASCADE ON UPDATE CASCADE;
