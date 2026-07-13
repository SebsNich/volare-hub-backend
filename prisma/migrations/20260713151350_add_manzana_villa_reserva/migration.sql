-- AlterTable
ALTER TABLE "Reserva" ADD COLUMN     "manzana" TEXT,
ADD COLUMN     "villa" TEXT;

-- Backfill desde el usuario dueño de cada reserva
UPDATE "Reserva" r
SET "manzana" = u."manzana", "villa" = u."villa"
FROM "User" u
WHERE r."usuarioId" = u."id";

-- AlterTable
ALTER TABLE "Reserva" ALTER COLUMN "manzana" SET NOT NULL,
ALTER COLUMN "villa" SET NOT NULL;
