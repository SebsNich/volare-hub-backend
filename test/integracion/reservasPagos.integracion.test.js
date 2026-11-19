// Controladores de reservas que dependen de los pagos, probados contra
// volare_test con req/res falsos. Se ejecutan con: npm run test:integracion
const { verificarBaseDePruebas } = require('../helpers/candadoBasePruebas');
verificarBaseDePruebas(process.env.DATABASE_URL); // antes de cargar prisma

const { test, after, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
const prisma = require('../../src/lib/prisma');
const { obtenerMisReservas, aprobarReserva, obtenerDisponibilidadCabanas, crearReserva: crearReservaControlador } = require('../../src/controllers/reservas.controller');
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

test('Mis Reservas marca transferenciaEnRevision solo con una transferencia PENDIENTE', async () => {
    const dueno = await crearUsuario();
    const enRevision = await crearReserva(dueno);
    const enLinea = await crearReserva(dueno);
    await crearPago(enRevision, { estado: 'PENDIENTE', proveedor: 'TRANSFERENCIA_MANUAL' });
    await crearPago(enLinea, { estado: 'PENDIENTE', proveedor: 'SIMULADO' });

    const res = respuestaFalsa();
    await obtenerMisReservas({ user: dueno, query: {} }, res);

    const porId = Object.fromEntries(res.cuerpo.reservas.map(r => [r.id, r]));
    assert.equal(porId[enRevision.id].transferenciaEnRevision, true);
    assert.equal(porId[enLinea.id].transferenciaEnRevision, false);
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

// ---------- (d) vencimiento antes de consultar disponibilidad ----------

test('disponibilidad: un turno con pago en línea vencido aparece libre y la reserva queda RECHAZADA', async () => {
    const dueno = await crearUsuario();
    const vencida = await crearReserva(dueno, { creadoEn: new Date(Date.now() - 16 * 60000) });
    await crearPago(vencida, { estado: 'PENDIENTE' });
    const conComprobante = await crearReserva(dueno, { creadoEn: new Date(Date.now() - 16 * 60000), comprobantePagoUrls: COMPROBANTE });
    const mes = vencida.fecha.toISOString().slice(0, 7);

    const res = respuestaFalsa();
    await obtenerDisponibilidadCabanas({ query: { mes } }, res);

    assert.equal(res.statusCode, 200);
    const ocupadas = res.cuerpo.CABANA_ARBOL;
    assert.equal(ocupadas.includes(vencida.fecha.toISOString().slice(0, 10)), false);
    assert.equal((await prisma.reserva.findUnique({ where: { id: vencida.id } })).estado, 'RECHAZADA');
    // La del comprobante sigue ocupando su turno, si cae en el mismo mes.
    if (conComprobante.fecha.toISOString().slice(0, 7) === mes) {
        assert.equal(ocupadas.includes(conComprobante.fecha.toISOString().slice(0, 10)), true);
    }
    assert.equal((await prisma.reserva.findUnique({ where: { id: conComprobante.id } })).estado, 'PENDIENTE');
});

test('crearReserva: se puede tomar un turno apartado por un pago en línea vencido', async () => {
    // 2032-03-06 es sábado: las cabañas no se reservan los lunes.
    const fecha = new Date('2032-03-06T00:00:00.000Z');
    const primero = await crearUsuario();
    const vencida = await crearReserva(primero, { fecha, creadoEn: new Date(Date.now() - 16 * 60000) });
    await crearPago(vencida, { estado: 'PENDIENTE' });

    const segundo = await crearUsuario();
    const res = respuestaFalsa();
    await crearReservaControlador({
        user: segundo,
        files: {},
        body: {
            espacio: 'CABANA_ARBOL', fecha: '2032-03-06', horario: 'CABANA_COMPLETO', motivoEvento: 'Cumpleaños',
            manzana: '01', villa: '02', nombres: 'Otro', apellidos: 'Residente', correo: 'otro@ejemplo.test',
            celular: '0999999999', cedula: '0912345678', bancoNombre: 'Banco', numeroCuenta: '123',
            tipoCuenta: 'AHORROS', cedulaRucBancario: '0912345678'
        }
    }, res);

    assert.equal(res.statusCode, 201, JSON.stringify(res.cuerpo));
    assert.equal(res.cuerpo.usuarioId, segundo.id);
    assert.equal((await prisma.reserva.findUnique({ where: { id: vencida.id } })).estado, 'RECHAZADA');
});

// ---------- RF-36: índice único parcial del turno activo ----------

function pedidoCabana(fecha) {
    return {
        espacio: 'CABANA_MEDIO', fecha, horario: 'CABANA_COMPLETO', motivoEvento: 'Cumpleaños',
        manzana: '01', villa: '02', nombres: 'Prueba', apellidos: 'Turno', correo: 'turno@ejemplo.test',
        celular: '0999999999', cedula: '0912345678', bancoNombre: 'Banco', numeroCuenta: '123',
        tipoCuenta: 'AHORROS', cedulaRucBancario: '0912345678'
    };
}

// Barrera: retiene la revisión de turno ocupado (findFirst con horario) hasta que
// lleguen las dos peticiones. Así ambas pasan la revisión del código, como en la
// peor carrera real, y solo el índice de la base puede detener a la segunda.
function retenerRevisionDeTurno(cuantas) {
    const original = prisma.reserva.findFirst;
    let llegadas = 0;
    let soltar;
    const todasLlegaron = new Promise(resolve => { soltar = resolve; });
    prisma.reserva.findFirst = async (args) => {
        if (args?.where?.horario) {
            llegadas += 1;
            if (llegadas >= cuantas) soltar();
            await todasLlegaron;
        }
        return original.call(prisma.reserva, args);
    };
    return () => { prisma.reserva.findFirst = original; };
}

test('RF-36: dos reservas simultáneas del mismo turno: una 201 y la otra 409, y queda una sola activa', async () => {
    // 2032-03-13 es sábado. Dos residentes distintos (la regla de una cabaña por residente no interviene).
    const [a, b] = [await crearUsuario(), await crearUsuario()];
    const [resA, resB] = [respuestaFalsa(), respuestaFalsa()];

    const restaurar = retenerRevisionDeTurno(2);
    try {
        await Promise.all([
            crearReservaControlador({ user: a, files: {}, body: pedidoCabana('2032-03-13') }, resA),
            crearReservaControlador({ user: b, files: {}, body: pedidoCabana('2032-03-13') }, resB)
        ]);
    } finally {
        restaurar();
    }

    const estados = [resA.statusCode, resB.statusCode].sort();
    assert.deepEqual(estados, [201, 409]);
    const perdedora = resA.statusCode === 409 ? resA : resB;
    assert.equal(perdedora.cuerpo.error, 'Ese horario ya está reservado');
    const activas = await prisma.reserva.count({
        where: { espacio: 'CABANA_MEDIO', fecha: new Date('2032-03-13T00:00:00.000Z'), estado: { in: ['PENDIENTE', 'APROBADA'] } }
    });
    assert.equal(activas, 1);
});

test('RF-36: la base rechaza un segundo turno activo aunque el código no lo revise (P2002)', async () => {
    const fecha = new Date('2032-03-20T00:00:00.000Z');
    await crearReserva(await crearUsuario(), { fecha });
    await assert.rejects(crearReserva(await crearUsuario(), { fecha }), (error) => error.code === 'P2002');
});

test('RF-36: una reserva RECHAZADA no ocupa el turno: se puede crear otra activa', async () => {
    const fecha = new Date('2032-03-27T00:00:00.000Z');
    await crearReserva(await crearUsuario(), { fecha, estado: 'RECHAZADA' });
    await crearReserva(await crearUsuario(), { fecha });
    assert.equal(await prisma.reserva.count({ where: { fecha } }), 2);
});

test('RF-36: aprobar una reserva rechazada cuyo turno ya tomó otro responde 409, no 500', async () => {
    const fecha = new Date('2032-04-03T00:00:00.000Z');
    const vieja = await crearReserva(await crearUsuario(), { fecha, estado: 'RECHAZADA' });
    await crearReserva(await crearUsuario(), { fecha });
    const { res, guardada } = await aprobarComoAdmin(vieja);
    assert.equal(res.statusCode, 409);
    assert.equal(guardada.estado, 'RECHAZADA');
});

// ---------- RF-52: un admin no puede desactivarse a sí mismo ----------

test('RF-52: PUT /api/usuarios/:id/estado sobre uno mismo responde 409 y la cuenta sigue activa', async () => {
    const { cambiarEstadoUsuario } = require('../../src/controllers/usuarios.controller');
    const admin = await crearUsuario('ADMIN');
    const res = respuestaFalsa();
    await cambiarEstadoUsuario({ user: admin, params: { id: admin.id }, body: { activo: false } }, res);
    assert.equal(res.statusCode, 409);
    assert.equal((await prisma.user.findUnique({ where: { id: admin.id } })).activo, true);
});

test('RF-52: desactivar a otro usuario sigue funcionando, y un id inexistente responde 404', async () => {
    const { cambiarEstadoUsuario } = require('../../src/controllers/usuarios.controller');
    const admin = await crearUsuario('ADMIN');
    const residente = await crearUsuario();
    const res = respuestaFalsa();
    await cambiarEstadoUsuario({ user: admin, params: { id: residente.id }, body: { activo: false } }, res);
    assert.equal(res.statusCode, 200);
    assert.equal((await prisma.user.findUnique({ where: { id: residente.id } })).activo, false);

    const res404 = respuestaFalsa();
    await cambiarEstadoUsuario({ user: admin, params: { id: '00000000-0000-0000-0000-000000000000' }, body: { activo: false } }, res404);
    assert.equal(res404.statusCode, 404);
});
