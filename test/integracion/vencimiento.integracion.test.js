// Vencimiento de reservas con pago en línea sin completar, contra volare_test.
// Se ejecutan con: npm run test:integracion
const { verificarBaseDePruebas } = require('../helpers/candadoBasePruebas');
verificarBaseDePruebas(process.env.DATABASE_URL); // antes de cargar prisma

const { test, after, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
const prisma = require('../../src/lib/prisma');
const { crearVencimientoReservas, MOTIVO_VENCIMIENTO } = require('../../src/lib/pagos/vencimientoReservas');
const { crearServicioPagos } = require('../../src/lib/pagos/servicioPagos');
const { crearRegistroProveedores } = require('../../src/lib/pagos/registroProveedores');
const { crearDatosIntegracion } = require('../helpers/datosIntegracion');

const { crearUsuario, crearReserva, crearPago, limpiar } = crearDatosIntegracion(prisma, 'it.vencimiento.');
const registro = crearRegistroProveedores({ PAGOS_PROVEEDOR_EN_LINEA: 'SIMULADO' });
const { vencerReservasSinPago } = crearVencimientoReservas({ prisma, esEnLinea: registro.esPagoEnLinea });

const COMPROBANTE = ['https://res.cloudinary.com/demo/comprobante.jpg'];
const haceMinutos = (m) => new Date(Date.now() - m * 60000);

beforeEach(limpiar);
after(async () => {
    await limpiar();
    await prisma.$disconnect();
});

const leerReserva = (id) => prisma.reserva.findUnique({ where: { id } });
const leerPago = (id) => prisma.pago.findUnique({ where: { id } });

test('vence: reserva de hace 16 min con pago en línea PENDIENTE queda RECHAZADA y su pago VENCIDO', async () => {
    const reserva = await crearReserva(await crearUsuario(), { creadoEn: haceMinutos(16) });
    const pago = await crearPago(reserva, { estado: 'PENDIENTE' });

    const vencidas = await vencerReservasSinPago();

    assert.equal(vencidas, 1);
    const r = await leerReserva(reserva.id);
    assert.equal(r.estado, 'RECHAZADA');
    assert.equal(r.motivoRechazo, MOTIVO_VENCIMIENTO);
    assert.equal(r.notificacionPendiente, true);
    const p = await leerPago(pago.id);
    assert.equal(p.estado, 'VENCIDO');
    assert.ok(p.resueltoEn);
});

test('NO cambia: reserva con comprobante y sin pagos, aunque sea de hace 2 horas', async () => {
    const reserva = await crearReserva(await crearUsuario(), { creadoEn: haceMinutos(120), comprobantePagoUrls: COMPROBANTE });
    assert.equal(await vencerReservasSinPago(), 0);
    const r = await leerReserva(reserva.id);
    assert.equal(r.estado, 'PENDIENTE');
    assert.equal(r.motivoRechazo, null);
    assert.equal(r.notificacionPendiente, false);
});

test('NO cambia: reserva sin comprobante y sin pagos', async () => {
    const reserva = await crearReserva(await crearUsuario(), { creadoEn: haceMinutos(120) });
    assert.equal(await vencerReservasSinPago(), 0);
    assert.equal((await leerReserva(reserva.id)).estado, 'PENDIENTE');
});

test('NO cambia: reserva de hace 10 min (todavía en plazo)', async () => {
    const reserva = await crearReserva(await crearUsuario(), { creadoEn: haceMinutos(10) });
    const pago = await crearPago(reserva, { estado: 'PENDIENTE' });
    assert.equal(await vencerReservasSinPago(), 0);
    assert.equal((await leerReserva(reserva.id)).estado, 'PENDIENTE');
    assert.equal((await leerPago(pago.id)).estado, 'PENDIENTE');
});

test('NO cambia: tiene un pago APROBADO además del PENDIENTE', async () => {
    const reserva = await crearReserva(await crearUsuario(), { creadoEn: haceMinutos(16) });
    await crearPago(reserva, { estado: 'APROBADO' });
    const pendiente = await crearPago(reserva, { estado: 'PENDIENTE' });
    assert.equal(await vencerReservasSinPago(), 0);
    assert.equal((await leerReserva(reserva.id)).estado, 'PENDIENTE');
    assert.equal((await leerPago(pendiente.id)).estado, 'PENDIENTE');
});

test('NO cambia: pago en línea PENDIENTE abandonado pero la reserva tiene comprobante', async () => {
    const reserva = await crearReserva(await crearUsuario(), { creadoEn: haceMinutos(16), comprobantePagoUrls: COMPROBANTE });
    await crearPago(reserva, { estado: 'PENDIENTE' });
    assert.equal(await vencerReservasSinPago(), 0);
    assert.equal((await leerReserva(reserva.id)).estado, 'PENDIENTE');
});

test('NO cambia: solo una transferencia manual PENDIENTE', async () => {
    const reserva = await crearReserva(await crearUsuario(), { creadoEn: haceMinutos(16) });
    await crearPago(reserva, { estado: 'PENDIENTE', proveedor: 'TRANSFERENCIA_MANUAL' });
    assert.equal(await vencerReservasSinPago(), 0);
    assert.equal((await leerReserva(reserva.id)).estado, 'PENDIENTE');
});

test('dos ejecuciones simultáneas no se pisan: la reserva vence una sola vez', async () => {
    const reserva = await crearReserva(await crearUsuario(), { creadoEn: haceMinutos(16) });
    const pago = await crearPago(reserva, { estado: 'PENDIENTE' });

    const [a, b] = await Promise.all([vencerReservasSinPago(), vencerReservasSinPago()]);

    assert.equal(a + b, 1);
    assert.equal((await leerReserva(reserva.id)).estado, 'RECHAZADA');
    assert.equal((await leerPago(pago.id)).estado, 'VENCIDO');
});

test('una aprobación tardía del proveedor después de vencer queda DUPLICADO (dinero a devolver)', async () => {
    const dueno = await crearUsuario();
    const reserva = await crearReserva(dueno, { creadoEn: haceMinutos(1) });
    const servicio = crearServicioPagos({ prisma, registro, urlFrontend: 'http://localhost:5173' });
    const creado = await servicio.crearPago(dueno, { reservaId: reserva.id, concepto: 'ALQUILER', proveedor: 'SIMULADO' });
    assert.equal(creado.status, 201);
    // Se simula que pasaron 16 minutos sin que el residente terminara de pagar.
    await prisma.reserva.update({ where: { id: reserva.id }, data: { creadoEn: haceMinutos(16) } });

    assert.equal(await vencerReservasSinPago(), 1);
    const confirmado = await servicio.confirmarPago(dueno, creado.cuerpo.pagoId, { resultado: 'APROBADO' });

    assert.equal(confirmado.status, 200);
    assert.ok(['DUPLICADO', 'REVERSADO'].includes(confirmado.cuerpo.pago.estado), confirmado.cuerpo.pago.estado);
    assert.equal((await leerReserva(reserva.id)).estado, 'RECHAZADA');
});
