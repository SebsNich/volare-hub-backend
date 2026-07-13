-- AlterTable
ALTER TABLE "Reserva" ADD COLUMN     "comprobantePagoUrls" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "contratoFirmadoUrls" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "listaInvitadosUrls" TEXT[] DEFAULT ARRAY[]::TEXT[];

UPDATE "Reserva" SET "comprobantePagoUrls" = ARRAY["comprobantePagoUrl"] WHERE "comprobantePagoUrl" IS NOT NULL;
UPDATE "Reserva" SET "listaInvitadosUrls" = ARRAY["listaInvitadosUrl"] WHERE "listaInvitadosUrl" IS NOT NULL;
UPDATE "Reserva" SET "contratoFirmadoUrls" = ARRAY["contratoFirmadoUrl"] WHERE "contratoFirmadoUrl" IS NOT NULL;
