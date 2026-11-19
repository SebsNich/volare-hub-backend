// Transferencia manual (Bloque E2 c) contra volare_test. La subida de archivos
// es falsa: ninguna prueba llama a Cloudinary. Se ejecutan con: npm run test:integracion
const { verificarBaseDePruebas } = require('../helpers/candadoBasePruebas');
verificarBaseDePruebas(process.env.DATABASE_URL); // antes de cargar prisma

const { test, after, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
const prisma = require('../../src/lib/prisma');
const { crearServicioPagos } = require('../../src/lib/pagos/servicioPagos');
const { crearRegistroProveedores } = require('../../src/lib/pagos/registroProveedores');
const { crearDatosIntegracion } = require('../helpers/datosIntegracion');

const { crearUsuario, crearReserva, crearPago, limpiar } = crearDatosIntegracion(prisma, 'it.transferencia.');
const registro = crearRegistroProveedores({ PAGOS_PROVEEDOR_EN_LINEA: 'SIMULADO' });

function armarServicio({ fallaSubida = false } = {}) {
    const subidas = [];
    const subirEvidencias = async (archivos) => {
        if (fallaSubida) throw new Error('Cloudinary no responde');
        subidas.push(archivos.length);
        return archivos.map((a, i) => `https://res.cloudinary.com/demo/transferencia-${i}-${a.originalname}`);
    };
    const servicio = crearServicioPagos({ prisma, registro, urlFrontend: 'http://localhost:5173', subirEvidencias });
    return { servicio, subidas };
}

const archivo = () => ({ buffer: Buffer.from('x'), mimetype: 'image/jpeg', originalname: 'comprobante.jpg' });
const pedido = (reserva) => ({ reservaId: reserva.id, concepto: 'ALQUILER' });
const haceMinutos = (m) => new Date(Date.now() - m * 60000);
const leerReserva = (id) => prisma.reserva.findUnique({ where: { id } });
const leerPago = (id) => prisma.pago.findUnique({ where: { id } });

beforeEach(limpiar);
after(async () => {
    await limpiar();
    await prisma.$disconnect();
});

// ---------- registrarTransferencia (residente) ----------

test('el residente registra la transferencia: pago PENDIENTE manual, con evidencia y sin vencimiento', async () => {
    const { servicio } = armarServicio();
    const dueno = await crearUsuario();
    const reserva = await crearReserva(dueno);

    const r = await servicio.registrarTransferencia(dueno, pedido(reserva), [archivo()]);

    assert.equal(r.status, 201);
    const p = await leerPago(r.cuerpo.pago.id);
    assert.equal(p.estado, 'PENDIENTE');
    assert.equal(p.proveedor, 'TRANSFERENCIA_MANUAL');
    assert.equal(p.montoCentavos, 1500);
    assert.equal(p.venceEn, null);
    assert.equal(p.idExterno, `TM-${p.id}`);
    assert.deepEqual(p.evidenciaUrls, ['https://res.cloudinary.com/demo/transferencia-0-comprobante.jpg']);
});

test('se puede transferir aunque ya pasaron los 15 minutos del pago en línea', async () => {
    const { servicio } = armarServicio();
    const dueno = await crearUsuario();
    const reserva = await crearReserva(dueno, { creadoEn: haceMinutos(120) });
    assert.equal((await servicio.registrarTransferencia(dueno, pedido(reserva), [archivo()])).status, 201);
});

test('sin archivos responde 400 y no sube nada', async () => {
    const { servicio, subidas } = armarServicio();
    const dueno = await crearUsuario();
    const reserva = await crearReserva(dueno);
    const r = await servicio.registrarTransferencia(dueno, pedido(reserva), []);
    assert.equal(r.status, 400);
    assert.equal(subidas.length, 0);
});

test('la reserva de otro usuario responde 404', async () => {
    const { servicio } = armarServicio();
    const reserva = await crearReserva(await crearUsuario());
    const r = await servicio.registrarTransferencia(await crearUsuario(), pedido(reserva), [archivo()]);
    assert.equal(r.status, 404);
});

test('una segunda transferencia con otra en revisión responde 409 y no sube archivos', async () => {
    const { servicio, subidas } = armarServicio();
    const dueno = await crearUsuario();
    const reserva = await crearReserva(dueno);
    await servicio.registrarTransferencia(dueno, pedido(reserva), [archivo()]);
    const r = await servicio.registrarTransferencia(dueno, pedido(reserva), [archivo()]);
    assert.equal(r.status, 409);
    assert.match(r.cuerpo.error, /revisión/);
    assert.equal(subidas.length, 1);
});

test('con el alquiler ya pagado responde 409', async () => {
    const { servicio } = armarServicio();
    const dueno = await crearUsuario();
    const reserva = await crearReserva(dueno);
    await crearPago(reserva, { estado: 'APROBADO' });
    assert.equal((await servicio.registrarTransferencia(dueno, pedido(reserva), [archivo()])).status, 409);
});

test('si falla la subida responde 502 y no crea el pago', async () => {
    const { servicio } = armarServicio({ fallaSubida: true });
    const dueno = await crearUsuario();
    const reserva = await crearReserva(dueno);
    const r = await servicio.registrarTransferencia(dueno, pedido(reserva), [archivo()]);
    assert.equal(r.status, 502);
    assert.equal(await prisma.pago.count({ where: { reservaId: reserva.id } }), 0);
});

test('con una transferencia en revisión no se puede iniciar un pago en línea (409)', async () => {
    const { servicio } = armarServicio();
    const dueno = await crearUsuario();
    const reserva = await crearReserva(dueno);
    await servicio.registrarTransferencia(dueno, pedido(reserva), [archivo()]);
    const r = await servicio.crearPago(dueno, { reservaId: reserva.id, concepto: 'ALQUILER', proveedor: 'SIMULADO' });
    assert.equal(r.status, 409);
    assert.match(r.cuerpo.error, /transferencia/);
});

// ---------- decidirPagoManual (admin) ----------

async function transferenciaPendiente(opciones) {
    const { servicio } = armarServicio();
    const dueno = await crearUsuario();
    const admin = await crearUsuario('ADMIN');
    const reserva = await crearReserva(dueno, opciones);
    const r = await servicio.registrarTransferencia(dueno, pedido(reserva), [archivo()]);
    return { servicio, dueno, admin, reserva, pagoId: r.cuerpo.pago.id };
}

test('el admin aprueba la transferencia: pago APROBADO con decididoPorId; la reserva sigue PENDIENTE', async () => {
    const { servicio, admin, reserva, pagoId } = await transferenciaPendiente();
    const r = await servicio.decidirPagoManual(admin, pagoId, { decision: 'APROBAR' });
    assert.equal(r.status, 200);
    const p = await leerPago(pagoId);
    assert.equal(p.estado, 'APROBADO');
    assert.equal(p.decididoPorId, admin.id);
    assert.ok(p.resueltoEn);
    assert.equal((await leerReserva(reserva.id)).estado, 'PENDIENTE');
});

test('aprobar con aprobarReserva: pago APROBADO y reserva APROBADA en la misma transacción', async () => {
    const { servicio, admin, reserva, pagoId } = await transferenciaPendiente();
    const r = await servicio.decidirPagoManual(admin, pagoId, { decision: 'APROBAR', aprobarReserva: true });
    assert.equal(r.status, 200);
    assert.equal((await leerPago(pagoId)).estado, 'APROBADO');
    const reservaFinal = await leerReserva(reserva.id);
    assert.equal(reservaFinal.estado, 'APROBADA');
    assert.equal(reservaFinal.notificacionPendiente, true);
});

test('el admin rechaza con motivo: pago RECHAZADO con el motivo; la reserva sigue PENDIENTE', async () => {
    const { servicio, admin, reserva, pagoId } = await transferenciaPendiente();
    const r = await servicio.decidirPagoManual(admin, pagoId, { decision: 'RECHAZAR', motivo: 'El monto no coincide' });
    assert.equal(r.status, 200);
    const p = await leerPago(pagoId);
    assert.equal(p.estado, 'RECHAZADO');
    assert.equal(p.motivoRechazo, 'El monto no coincide');
    assert.equal((await leerReserva(reserva.id)).estado, 'PENDIENTE');
});

test('rechazar sin motivo responde 400 y no cambia nada', async () => {
    const { servicio, admin, pagoId } = await transferenciaPendiente();
    assert.equal((await servicio.decidirPagoManual(admin, pagoId, { decision: 'RECHAZAR' })).status, 400);
    assert.equal((await leerPago(pagoId)).estado, 'PENDIENTE');
});

test('el residente no puede decidir su propia transferencia (403)', async () => {
    const { servicio, dueno, pagoId } = await transferenciaPendiente();
    assert.equal((await servicio.decidirPagoManual(dueno, pagoId, { decision: 'APROBAR' })).status, 403);
    assert.equal((await leerPago(pagoId)).estado, 'PENDIENTE');
});

test('un pago en línea no se decide por esta vía (409)', async () => {
    const { servicio } = armarServicio();
    const admin = await crearUsuario('ADMIN');
    const reserva = await crearReserva(await crearUsuario());
    const enLinea = await crearPago(reserva, { estado: 'PENDIENTE', proveedor: 'SIMULADO' });
    const r = await servicio.decidirPagoManual(admin, enLinea.id, { decision: 'APROBAR' });
    assert.equal(r.status, 409);
    assert.equal((await leerPago(enLinea.id)).estado, 'PENDIENTE');
});

test('aprobarReserva con la reserva ya RECHAZADA: 409 y NO se guarda nada (ni el pago)', async () => {
    const { servicio, admin, reserva, pagoId } = await transferenciaPendiente();
    await prisma.reserva.update({ where: { id: reserva.id }, data: { estado: 'RECHAZADA' } });
    const r = await servicio.decidirPagoManual(admin, pagoId, { decision: 'APROBAR', aprobarReserva: true });
    assert.equal(r.status, 409);
    assert.equal((await leerPago(pagoId)).estado, 'PENDIENTE');
    assert.equal((await leerReserva(reserva.id)).estado, 'RECHAZADA');
});

test('decidir dos veces: la segunda devuelve el estado guardado sin cambiarlo', async () => {
    const { servicio, admin, pagoId } = await transferenciaPendiente();
    await servicio.decidirPagoManual(admin, pagoId, { decision: 'APROBAR' });
    const r = await servicio.decidirPagoManual(admin, pagoId, { decision: 'RECHAZAR', motivo: 'tarde' });
    assert.equal(r.status, 200);
    assert.equal(r.cuerpo.pago.estado, 'APROBADO');
    assert.equal((await leerPago(pagoId)).motivoRechazo, null);
});

test('aprobar una transferencia cuando el alquiler ya se pagó en línea la deja DUPLICADO', async () => {
    const { servicio, admin, reserva, pagoId } = await transferenciaPendiente();
    await crearPago(reserva, { estado: 'APROBADO' });
    const r = await servicio.decidirPagoManual(admin, pagoId, { decision: 'APROBAR' });
    assert.equal(r.status, 200);
    assert.equal((await leerPago(pagoId)).estado, 'DUPLICADO');
});
