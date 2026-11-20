-- CreateEnum
CREATE TYPE "EstadoCuota" AS ENUM ('PENDIENTE', 'PAGADA', 'ANULADA');

-- CreateTable
CREATE TABLE "ConfigAlicuota" (
    "id" INTEGER NOT NULL DEFAULT 1,
    "montoCentavos" INTEGER NOT NULL,
    "montoPuntualCentavos" INTEGER NOT NULL,
    "diasPuntual" INTEGER NOT NULL,
    "actualizadoEn" TIMESTAMP(3) NOT NULL,
    "actualizadoPorId" TEXT,

    CONSTRAINT "ConfigAlicuota_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CuotaAlicuota" (
    "id" TEXT NOT NULL,
    "manzana" TEXT NOT NULL,
    "villa" TEXT NOT NULL,
    "periodo" TEXT NOT NULL,
    "estado" "EstadoCuota" NOT NULL DEFAULT 'PENDIENTE',
    "montoBaseCentavos" INTEGER NOT NULL,
    "montoPuntualCentavos" INTEGER NOT NULL,
    "diasPuntual" INTEGER NOT NULL,
    "creadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "pagadaEn" TIMESTAMP(3),

    CONSTRAINT "CuotaAlicuota_pkey" PRIMARY KEY ("id")
);

-- AlterTable
ALTER TABLE "Pago" ADD COLUMN "cuotaId" TEXT;

-- CreateIndex
CREATE INDEX "CuotaAlicuota_periodo_idx" ON "CuotaAlicuota"("periodo");

-- CreateIndex
CREATE INDEX "CuotaAlicuota_estado_idx" ON "CuotaAlicuota"("estado");

-- CreateIndex
CREATE UNIQUE INDEX "CuotaAlicuota_manzana_villa_periodo_key" ON "CuotaAlicuota"("manzana", "villa", "periodo");

-- CreateIndex
CREATE INDEX "Pago_cuotaId_idx" ON "Pago"("cuotaId");

-- AddForeignKey
ALTER TABLE "Pago" ADD CONSTRAINT "Pago_cuotaId_fkey" FOREIGN KEY ("cuotaId") REFERENCES "CuotaAlicuota"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- ===== Agregado a mano (Prisma no expresa CHECK ni índices parciales) =====

-- Un pago es de una reserva (alquiler o garantía) O de una cuota (alícuota); nunca de ambas.
ALTER TABLE "Pago" DROP CONSTRAINT "Pago_referencia_segun_tipo";
ALTER TABLE "Pago" ADD CONSTRAINT "Pago_referencia_segun_tipo" CHECK (
  ("tipo" = 'RESERVA' AND "reservaId" IS NOT NULL AND "cuotaId" IS NULL AND "concepto" IN ('ALQUILER', 'GARANTIA'))
  OR
  ("tipo" = 'ALICUOTA' AND "cuotaId" IS NOT NULL AND "reservaId" IS NULL AND "concepto" = 'ALICUOTA')
);

-- Idempotencia en la base: a lo sumo un pago APROBADO por cuota.
-- OJO: Prisma no conoce este índice (ver nota en la migración pagos_reservas).
CREATE UNIQUE INDEX "Pago_un_aprobado_por_cuota"
  ON "Pago"("cuotaId") WHERE "estado" = 'APROBADO';

ALTER TABLE "ConfigAlicuota" ADD CONSTRAINT "ConfigAlicuota_una_fila" CHECK ("id" = 1);
ALTER TABLE "ConfigAlicuota" ADD CONSTRAINT "ConfigAlicuota_montos_validos" CHECK (
  "montoCentavos" > 0 AND "montoPuntualCentavos" > 0 AND "montoPuntualCentavos" <= "montoCentavos"
  AND "diasPuntual" BETWEEN 1 AND 28
);
ALTER TABLE "CuotaAlicuota" ADD CONSTRAINT "CuotaAlicuota_periodo_formato" CHECK ("periodo" ~ '^\d{4}-(0[1-9]|1[0-2])$');
ALTER TABLE "CuotaAlicuota" ADD CONSTRAINT "CuotaAlicuota_montos_validos" CHECK (
  "montoBaseCentavos" > 0 AND "montoPuntualCentavos" > 0 AND "montoPuntualCentavos" <= "montoBaseCentavos"
);

-- Valores iniciales acordados: $60 al mes y $55 si se paga en los primeros 5 días.
INSERT INTO "ConfigAlicuota" ("id", "montoCentavos", "montoPuntualCentavos", "diasPuntual", "actualizadoEn")
VALUES (1, 6000, 5500, 5, CURRENT_TIMESTAMP);

-- Igual que las demás tablas de negocio.
ALTER TABLE "ConfigAlicuota" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "CuotaAlicuota" ENABLE ROW LEVEL SECURITY;
