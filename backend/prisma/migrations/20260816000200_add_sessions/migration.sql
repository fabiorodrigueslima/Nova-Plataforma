CREATE TABLE "sessoes" (
    "id" SERIAL NOT NULL,
    "usuario_id" INTEGER NOT NULL,
    "token_hash" CHAR(64) NOT NULL,
    "criado_em" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "ultimo_uso_em" TIMESTAMP(6),
    "expira_em" TIMESTAMP(6) NOT NULL,
    "revogado_em" TIMESTAMP(6),
    "user_agent" VARCHAR(300),
    CONSTRAINT "sessoes_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "sessoes_token_hash_key" ON "sessoes"("token_hash");
CREATE INDEX "idx_sessoes_usuario_id" ON "sessoes"("usuario_id");
CREATE INDEX "idx_sessoes_expira_em" ON "sessoes"("expira_em");
CREATE INDEX "idx_sessoes_revogado_em" ON "sessoes"("revogado_em");

ALTER TABLE "sessoes" ADD CONSTRAINT "sessoes_usuario_id_fkey"
FOREIGN KEY ("usuario_id") REFERENCES "usuarios"("id") ON DELETE CASCADE ON UPDATE CASCADE;
