-- RF-36: control de doble reserva en la base de datos.
-- Mismo SQL que el borrador de 5e5de6c (semana-2-reservas), con fecha nueva para
-- que Prisma lo aplique después de 20261116230000_pagos_reservas.
--
-- Índice único PARCIAL: dos reservas del mismo espacio, fecha y horario no pueden
-- estar a la vez en PENDIENTE o APROBADA. Las RECHAZADAS no cuentan, así el turno
-- queda libre otra vez. Prisma no expresa índices parciales en schema.prisma.
-- OJO: si un "prisma migrate dev" futuro genera DROP INDEX "Reserva_slot_activo_unico",
-- hay que quitar esa línea.
--
-- ANTES de aplicarlo hay que comprobar que no existan duplicados (si los hay, falla):
--   consulta_duplicados_reservas.sql (2026-11-18: 0 filas en volare_dev).

CREATE UNIQUE INDEX "Reserva_slot_activo_unico"
ON "Reserva" ("espacio", "fecha", "horario")
WHERE "estado" IN ('PENDIENTE', 'APROBADA');
