-- Endurecimiento de seguridad: activa Row Level Security (RLS) en las tablas
-- de negocio para bloquear el acceso por defecto vía la API REST publica
-- (PostgREST) que Supabase genera automaticamente para cada tabla.
--
-- El rol "postgres" (usado por Prisma/DATABASE_URL) tiene el atributo
-- BYPASSRLS en Supabase, por lo que esta migracion no afecta en nada
-- las consultas del backend. Solo bloquea el acceso de roles sin ese
-- atributo (ej. "anon"/"authenticated" de PostgREST) mientras no existan
-- policies explicitas.
--
-- _prisma_migrations queda excluida intencionalmente (tabla interna de Prisma).

ALTER TABLE "public"."User" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."Post" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."Reserva" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."Suggestion" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."TokenRecuperacion" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."InfoContacto" ENABLE ROW LEVEL SECURITY;