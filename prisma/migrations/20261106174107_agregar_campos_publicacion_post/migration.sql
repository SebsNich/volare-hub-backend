-- AlterTable
ALTER TABLE "Post" ADD COLUMN     "enCarrusel" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "publicadoEn" TIMESTAMP(3),
ADD COLUMN     "publicadoPorId" TEXT,
ADD COLUMN     "publico" BOOLEAN NOT NULL DEFAULT false;

-- CreateIndex
CREATE INDEX "Post_publico_idx" ON "Post"("publico");

-- CreateIndex
CREATE INDEX "Post_enCarrusel_idx" ON "Post"("enCarrusel");

-- AddForeignKey
ALTER TABLE "Post" ADD CONSTRAINT "Post_publicadoPorId_fkey" FOREIGN KEY ("publicadoPorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
