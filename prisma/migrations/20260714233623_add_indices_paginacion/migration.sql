-- CreateIndex
CREATE INDEX "Post_creadoEn_idx" ON "Post"("creadoEn");

-- CreateIndex
CREATE INDEX "Post_tipo_idx" ON "Post"("tipo");

-- CreateIndex
CREATE INDEX "Post_autorId_idx" ON "Post"("autorId");

-- CreateIndex
CREATE INDEX "Reserva_fecha_idx" ON "Reserva"("fecha");

-- CreateIndex
CREATE INDEX "Reserva_estado_idx" ON "Reserva"("estado");

-- CreateIndex
CREATE INDEX "Reserva_usuarioId_idx" ON "Reserva"("usuarioId");

-- CreateIndex
CREATE INDEX "Reserva_espacio_idx" ON "Reserva"("espacio");

-- CreateIndex
CREATE INDEX "Suggestion_creadoEn_idx" ON "Suggestion"("creadoEn");

-- CreateIndex
CREATE INDEX "Suggestion_estado_idx" ON "Suggestion"("estado");

-- CreateIndex
CREATE INDEX "Suggestion_tipo_idx" ON "Suggestion"("tipo");

-- CreateIndex
CREATE INDEX "User_activo_idx" ON "User"("activo");
