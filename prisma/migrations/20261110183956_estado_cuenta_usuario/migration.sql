-- Estado de cuenta para el registro con aprobación (bloque 8).
-- EDITADA A MANO: Prisma generaba DEFAULT 'PENDIENTE' directamente, lo que
-- habría dejado pendientes a TODOS los usuarios existentes, admins incluidos,
-- y nadie habría podido aprobar. Toda la migración corre en una transacción.

-- CreateEnum
CREATE TYPE "EstadoCuenta" AS ENUM ('PENDIENTE', 'APROBADA', 'RECHAZADA');

-- 1) Backfill: al agregar la columna con DEFAULT 'APROBADA', Postgres llena
--    con ese valor todas las filas que ya existen, en el mismo paso.
ALTER TABLE "User" ADD COLUMN "estadoCuenta" "EstadoCuenta" NOT NULL DEFAULT 'APROBADA';

-- 2) Desde aquí, solo los registros NUEVOS nacen pendientes.
ALTER TABLE "User" ALTER COLUMN "estadoCuenta" SET DEFAULT 'PENDIENTE';

-- 3) Datos de la decisión (vacíos para las cuentas existentes).
ALTER TABLE "User" ADD COLUMN "decididoPorId" TEXT,
ADD COLUMN "fechaDecision" TIMESTAMP(3),
ADD COLUMN "motivoRechazo" TEXT;

-- CreateIndex
CREATE INDEX "User_estadoCuenta_idx" ON "User"("estadoCuenta");

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_decididoPorId_fkey" FOREIGN KEY ("decididoPorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
