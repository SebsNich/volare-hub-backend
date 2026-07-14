-- AlterTable
ALTER TABLE "User" ADD COLUMN     "nombres" TEXT,
ADD COLUMN     "apellidos" TEXT,
ADD COLUMN     "cedula" TEXT,
ADD COLUMN     "celular" TEXT;

-- Backfill: preservar el nombre de las cuentas existentes en el campo "nombres"
UPDATE "User" SET "nombres" = "nombre" WHERE "nombres" IS NULL;
