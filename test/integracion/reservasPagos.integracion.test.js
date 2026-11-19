// Controladores de reservas que dependen de los pagos, probados contra
// volare_test con req/res falsos. Se ejecutan con: npm run test:integracion
const { verificarBaseDePruebas } = require('../helpers/candadoBasePruebas');
verificarBaseDePruebas(process.env.DATABASE_URL); // antes de cargar prisma

const { test, after, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
const prisma = require('../../src/lib/prisma');
const { obtenerMisReservas, aprobarReserva } = require('../../src/controllers/reservas.controller');
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

// ---------- (b) PUT /api/reservas/:id/aprobar ----------

const COMPROBANTE = ['https://res.cloudinary.com/demo/comprobante.jpg'];

async function aprobarComoAdmin(reserva) {
    const admin = await crearUsuario('ADMIN');
    const res = respuestaFalsa();
    await aprobarReserva({ user: admin, params: { id: reserva.id } }, res);
    const guardada = await prisma.reserva.findUnique({ where: { id: reserva.id } });
    return { res, guardada };
}

test('aprobar: reserva antigua sin pagos y sin comprobante se aprueba como hoy', async () => {
    const reserva = await crearReserva(await crearUsuario());
    const { res, guardada } = await aprobarComoAdmin(reserva);
    assert.equal(res.statusCode, 200);
    assert.equal(guardada.estado, 'APROBADA');
});

test('aprobar: alquiler en línea APROBADO se aprueba', async () => {
    const reserva = await crearReserva(await crearUsuario());
    await crearPago(reserva, { estado: 'APROBADO' });
    const { res, guardada } = await aprobarComoAdmin(reserva);
    assert.equal(res.statusCode, 200);
    assert.equal(guardada.estado, 'APROBADA');
});

test('aprobar: pago en línea PENDIENTE abandonado no bloquea si hay comprobante', async () => {
    const reserva = await crearReserva(await crearUsuario(), { comprobantePagoUrls: COMPROBANTE });
    await crearPago(reserva, { estado: 'PENDIENTE' });
    const { res, guardada } = await aprobarComoAdmin(reserva);
    assert.equal(res.statusCode, 200);
    assert.equal(guardada.estado, 'APROBADA');
});

test('aprobar: pago en línea sin aprobar y sin comprobante responde 409 y no cambia nada', async () => {
    const reserva = await crearReserva(await crearUsuario());
    await crearPago(reserva, { estado: 'RECHAZADO' });
    const { res, guardada } = await aprobarComoAdmin(reserva);
    assert.equal(res.statusCode, 409);
    assert.match(res.cuerpo.error, /pago en línea sin aprobar/);
    assert.equal(guardada.estado, 'PENDIENTE');
    assert.equal(guardada.notificacionPendiente, false);
});

test('aprobar: una reserva que no existe responde 404', async () => {
    const admin = await crearUsuario('ADMIN');
    const res = respuestaFalsa();
    await aprobarReserva({ user: admin, params: { id: '00000000-0000-0000-0000-000000000000' } }, res);
    assert.equal(res.statusCode, 404);
});
