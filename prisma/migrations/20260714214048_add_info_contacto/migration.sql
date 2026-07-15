-- CreateEnum
CREATE TYPE "TipoContacto" AS ENUM ('TELEFONO', 'CORREO', 'RED_SOCIAL');

-- CreateTable
CREATE TABLE "InfoContacto" (
    "id" TEXT NOT NULL,
    "tipo" "TipoContacto" NOT NULL,
    "etiqueta" TEXT,
    "plataforma" TEXT,
    "valor" TEXT NOT NULL,
    "orden" INTEGER NOT NULL DEFAULT 0,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "creadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "InfoContacto_pkey" PRIMARY KEY ("id")
);
