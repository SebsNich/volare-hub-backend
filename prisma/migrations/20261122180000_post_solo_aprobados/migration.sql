-- Publicaciones que solo ven los residentes con cuenta APROBADA (p. ej. el informe económico).
-- Aditiva: las publicaciones existentes quedan en false, como hasta ahora.
ALTER TABLE "Post" ADD COLUMN "soloAprobados" BOOLEAN NOT NULL DEFAULT false;
