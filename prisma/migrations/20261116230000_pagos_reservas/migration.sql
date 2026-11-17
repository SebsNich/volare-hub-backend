-- CreateEnum
CREATE TYPE "TipoPago" AS ENUM ('RESERVA', 'ALICUOTA');

-- CreateEnum
CREATE TYPE "ConceptoPago" AS ENUM ('ALQUILER', 'GARANTIA', 'ALICUOTA');

-- CreateEnum
CREATE TYPE "EstadoPago" AS ENUM ('PENDIENTE', 'APROBADO', 'RECHAZADO', 'VENCIDO', 'DUPLICADO', 'REVERSADO');

-- CreateTable
CREATE TABLE "Pago" (
    "id" TEXT NOT NULL,
    "usuarioId" TEXT NOT NULL,
    "tipo" "TipoPago" NOT NULL,
    "concepto" "ConceptoPago" NOT NULL,
    "reservaId" TEXT,
    "montoCentavos" INTEGER NOT NULL,
    "estado" "EstadoPago" NOT NULL DEFAULT 'PENDIENTE',
    "proveedor" TEXT NOT NULL,
    "idExterno" TEXT,
    "respuestaProveedor" JSONB,
    "evidenciaUrls" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "decididoPorId" TEXT,
    "motivoRechazo" TEXT,
    "creadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "venceEn" TIMESTAMP(3),
    "resueltoEn" TIMESTAMP(3),
    "actualizadoEn" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Pago_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Pago_usuarioId_idx" ON "Pago"("usuarioId");

-- CreateIndex
CREATE INDEX "Pago_estado_idx" ON "Pago"("estado");

-- CreateIndex
CREATE INDEX "Pago_reservaId_idx" ON "Pago"("reservaId");

-- CreateIndex
CREATE UNIQUE INDEX "Pago_proveedor_idExterno_key" ON "Pago"("proveedor", "idExterno");

-- AddForeignKey
ALTER TABLE "Pago" ADD CONSTRAINT "Pago_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Pago" ADD CONSTRAINT "Pago_reservaId_fkey" FOREIGN KEY ("reservaId") REFERENCES "Reserva"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Pago" ADD CONSTRAINT "Pago_decididoPorId_fkey" FOREIGN KEY ("decididoPorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- ===== Agregado a mano (Prisma no expresa CHECK ni índices parciales) =====

-- Por ahora un pago es siempre de una reserva. ALICUOTA queda bloqueado por
-- la base hasta que su propia migración cambie esta regla.
ALTER TABLE "Pago" ADD CONSTRAINT "Pago_referencia_segun_tipo" CHECK (
  "tipo" = 'RESERVA' AND "reservaId" IS NOT NULL AND "concepto" IN ('ALQUILER', 'GARANTIA')
);
ALTER TABLE "Pago" ADD CONSTRAINT "Pago_monto_positivo" CHECK ("montoCentavos" > 0);

-- Idempotencia en la base: a lo sumo un pago APROBADO por (reserva, concepto).
-- OJO: Prisma no conoce este índice. Si un "prisma migrate dev" futuro genera
-- DROP INDEX "Pago_un_aprobado_por_reserva_concepto", hay que quitar esa línea.
CREATE UNIQUE INDEX "Pago_un_aprobado_por_reserva_concepto"
  ON "Pago"("reservaId", "concepto") WHERE "estado" = 'APROBADO';

-- Igual que las demás tablas de negocio (migración enable_row_level_security).
ALTER TABLE "Pago" ENABLE ROW LEVEL SECURITY;
