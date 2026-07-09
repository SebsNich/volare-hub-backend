-- CreateEnum
CREATE TYPE "EspacioReservable" AS ENUM ('CABANA_ARBOL', 'CABANA_MEDIO', 'CABANA_RIO', 'CASA_CLUB');

-- CreateEnum
CREATE TYPE "HorarioReserva" AS ENUM ('CABANA_COMPLETO', 'CASA_CLUB_MATUTINO', 'CASA_CLUB_VESPERTINO', 'CASA_CLUB_NOCTURNO');

-- CreateEnum
CREATE TYPE "EstadoReserva" AS ENUM ('PENDIENTE', 'APROBADA', 'RECHAZADA');

-- CreateEnum
CREATE TYPE "TipoCuentaBancaria" AS ENUM ('AHORROS', 'CORRIENTE');

-- CreateTable
CREATE TABLE "Reserva" (
    "id" TEXT NOT NULL,
    "usuarioId" TEXT NOT NULL,
    "espacio" "EspacioReservable" NOT NULL,
    "fecha" TIMESTAMP(3) NOT NULL,
    "horario" "HorarioReserva" NOT NULL,
    "motivoEvento" TEXT NOT NULL,
    "nombres" TEXT NOT NULL,
    "apellidos" TEXT NOT NULL,
    "correo" TEXT NOT NULL,
    "celular" TEXT NOT NULL,
    "cedula" TEXT NOT NULL,
    "esParaTercero" BOOLEAN NOT NULL DEFAULT false,
    "bancoNombre" TEXT NOT NULL,
    "numeroCuenta" TEXT NOT NULL,
    "tipoCuenta" "TipoCuentaBancaria" NOT NULL,
    "cedulaRucBancario" TEXT NOT NULL,
    "montoAlquiler" DECIMAL(65,30) NOT NULL,
    "montoGarantia" DECIMAL(65,30) NOT NULL,
    "comprobantePagoUrl" TEXT NOT NULL,
    "listaInvitadosUrl" TEXT NOT NULL,
    "contratoFirmadoUrl" TEXT NOT NULL,
    "estado" "EstadoReserva" NOT NULL DEFAULT 'PENDIENTE',
    "motivoRechazo" TEXT,
    "creadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "actualizadoEn" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Reserva_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "Reserva" ADD CONSTRAINT "Reserva_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
