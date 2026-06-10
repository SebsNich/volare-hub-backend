-- CreateEnum
CREATE TYPE "Rol" AS ENUM ('ADMIN', 'RESIDENTE');

-- CreateEnum
CREATE TYPE "TipoPost" AS ENUM ('AVISO', 'OBRA', 'COMUNICADO', 'EMPRENDIMIENTO');

-- CreateEnum
CREATE TYPE "EstadoPost" AS ENUM ('ACTIVO', 'INACTIVO');

-- CreateEnum
CREATE TYPE "TipoSugerencia" AS ENUM ('SUGERENCIA', 'QUEJA', 'CONSULTA', 'OTRO');

-- CreateEnum
CREATE TYPE "EstadoSugerencia" AS ENUM ('SIN_LEER', 'LEIDA');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "password" TEXT NOT NULL,
    "rol" "Rol" NOT NULL DEFAULT 'RESIDENTE',
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "bio" TEXT,
    "foto" TEXT,
    "creadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Post" (
    "id" TEXT NOT NULL,
    "titulo" TEXT NOT NULL,
    "descripcion" TEXT NOT NULL,
    "tipo" "TipoPost" NOT NULL,
    "imagenUrl" TEXT,
    "archivoUrl" TEXT,
    "anclado" BOOLEAN NOT NULL DEFAULT false,
    "ancladoPerfil" BOOLEAN NOT NULL DEFAULT false,
    "estado" "EstadoPost" NOT NULL DEFAULT 'ACTIVO',
    "creadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "autorId" TEXT NOT NULL,

    CONSTRAINT "Post_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Suggestion" (
    "id" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "tipo" "TipoSugerencia" NOT NULL,
    "mensaje" TEXT NOT NULL,
    "estado" "EstadoSugerencia" NOT NULL DEFAULT 'SIN_LEER',
    "creadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Suggestion_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- AddForeignKey
ALTER TABLE "Post" ADD CONSTRAINT "Post_autorId_fkey" FOREIGN KEY ("autorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
