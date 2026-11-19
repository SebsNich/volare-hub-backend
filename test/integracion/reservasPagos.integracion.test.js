// Controladores de reservas que dependen de los pagos, probados contra
// volare_test con req/res falsos. Se ejecutan con: npm run test:integracion
const { verificarBaseDePruebas } = require('../helpers/candadoBasePruebas');
verificarBaseDePruebas(process.env.DATABASE_URL); // antes de cargar prisma

const { test, after, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
const prisma = require('../../src/lib/prisma');
const { obtenerMisReservas } = require('../../src/controllers/reservas.controller');
const { crearDatosIntegracion, respuestaFalsa } = require('../helpers/datosIntegracion');

const { crearUsuario, crearReserva, crearPago, limpiar } = crearDatosIntegracion(prisma, 'it.reservas-pagos.');

beforeEach(limpiar);
after(async () => {
    await limpiar();
    await prisma.$disconnect();
});

// ---------- (a) GET /api/reservas/mias ----------

test('Mis Reservas marca alquilerPagado solo en la reserva con ALQUILER APROBADO', async () => {
    const dueno = await crearUsuario();
    const pagada = await crearReserva(dueno);
    const sinPagar = await crearReserva(dueno);
    const rechazada = await crearReserva(dueno);
    await crearPago(pagada, { estado: 'APROBADO' });
    await crearPago(rechazada, { estado: 'RECHAZADO' });

    const res = respuestaFalsa();
    await obtenerMisReservas({ user: dueno, query: {} }, res);

    assert.equal(res.statusCode, 200);
    const porId = Object.fromEntries(res.cuerpo.reservas.map(r => [r.id, r]));
    assert.equal(porId[pagada.id].alquilerPagado, true);
    assert.equal(porId[sinPagar.id].alquilerPagado, false);
    assert.equal(porId[rechazada.id].alquilerPagado, false);
    // La lista de pagos no viaja al navegador.
    assert.equal('pagos' in porId[pagada.id], false);
});
