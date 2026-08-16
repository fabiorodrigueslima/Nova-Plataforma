-- Preserve compatibility with the current direct SQL during the gradual Prisma migration.
ALTER TABLE "usuarios" ALTER COLUMN "provider" DROP DEFAULT;
ALTER TABLE "usuarios" ALTER COLUMN "provider" TYPE VARCHAR(30) USING "provider"::TEXT;
ALTER TABLE "usuarios" ALTER COLUMN "provider" SET DEFAULT 'local';

ALTER TABLE "exclusoes_conta" ALTER COLUMN "status" DROP DEFAULT;
ALTER TABLE "exclusoes_conta" ALTER COLUMN "status" TYPE VARCHAR(50) USING "status"::TEXT;
ALTER TABLE "exclusoes_conta" ALTER COLUMN "status" SET DEFAULT 'concluida';

ALTER TABLE "denuncias" ALTER COLUMN "status" DROP DEFAULT;
ALTER TABLE "denuncias" ALTER COLUMN "status" TYPE VARCHAR(50) USING "status"::TEXT;
ALTER TABLE "denuncias" ALTER COLUMN "status" SET DEFAULT 'pendente';

ALTER TABLE "grupos" ALTER COLUMN "tipo" DROP DEFAULT;
ALTER TABLE "grupos" ALTER COLUMN "tipo" TYPE VARCHAR(30) USING "tipo"::TEXT;
ALTER TABLE "grupos" ALTER COLUMN "tipo" SET DEFAULT 'publico';

ALTER TABLE "grupo_membros" ALTER COLUMN "papel" DROP DEFAULT;
ALTER TABLE "grupo_membros" ALTER COLUMN "papel" TYPE VARCHAR(50) USING "papel"::TEXT;
ALTER TABLE "grupo_membros" ALTER COLUMN "papel" SET DEFAULT 'membro';

ALTER TABLE "grupo_solicitacoes" ALTER COLUMN "status" DROP DEFAULT;
ALTER TABLE "grupo_solicitacoes" ALTER COLUMN "status" TYPE VARCHAR(30) USING "status"::TEXT;
ALTER TABLE "grupo_solicitacoes" ALTER COLUMN "status" SET DEFAULT 'pendente';

DROP TYPE "provedor_autenticacao";
DROP TYPE "tipo_grupo";
DROP TYPE "papel_grupo";
DROP TYPE "status_solicitacao_grupo";
DROP TYPE "status_denuncia";
DROP TYPE "status_exclusao_conta";

ALTER TABLE "usuarios" ADD CONSTRAINT "usuarios_provider_check"
  CHECK ("provider" IN ('local', 'google'));
ALTER TABLE "exclusoes_conta" ADD CONSTRAINT "exclusoes_conta_status_check"
  CHECK ("status" IN ('pendente', 'concluida', 'falhou'));
ALTER TABLE "denuncias" ADD CONSTRAINT "denuncias_status_check"
  CHECK ("status" IN ('pendente', 'em_analise', 'resolvida', 'rejeitada'));
ALTER TABLE "grupos" ADD CONSTRAINT "grupos_tipo_check"
  CHECK ("tipo" IN ('publico', 'reservada'));
ALTER TABLE "grupo_membros" ADD CONSTRAINT "grupo_membros_papel_check"
  CHECK ("papel" IN ('admin', 'membro'));
ALTER TABLE "grupo_solicitacoes" ADD CONSTRAINT "grupo_solicitacoes_status_check"
  CHECK ("status" IN ('pendente', 'aprovada', 'recusada'));
