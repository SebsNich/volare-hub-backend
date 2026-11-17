// Pruebas del servicio de pagos contra una base PostgreSQL REAL de pruebas
// (volare_test). Comprueban lo que una función pura no puede: el CHECK, el índice
// parcial, el aislamiento Serializable y dos confirmaciones en paralelo.
// Se ejecutan con: npm run test:integracion
const { verificarBaseDePruebas } = require('../helpers/candadoBasePruebas');
verificarBaseDePruebas(process.env.DATABASE_URL); // antes de cargar prisma

const { test, after, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
const prisma = require('../../src/lib/prisma');
const { crearServicioPagos } = require('../../src/lib/pagos/servicioPagos');
const { crearRegistroProveedores } = require('../../src/lib/pagos/registroProveedores');
const { crearProveedorSimulado } = require('../../src/lib/pagos/proveedores/simulado');

const PREFIJO = 'it.pagos.';
const URL_FRONTEND = 'http://localhost:5173';
let contador = 0;

// Envuelve el simulado para contar cuántas veces se llama a confirmarCobro.
function simuladoContado(guion = {}) {
    const simulado = crearProveedorSimulado({ guion });
    const espia = { ...simulado, llamadasConfirmar: 0 };
    espia.confirmarCobro = async (...args) => {
        espia.llamadasConfirmar += 1;
        return simulado.confirmarCobro(...args);
    };
    return espia;
}

function armarServicio(guion) {
    const simulado = simuladoContado(guion);
    const registro = crearRegistroProveedores({ PAGOS_PROVEEDOR_EN_LINEA: 'SIMULADO' }, { simulado });
    return { simulado, servicio: crearServicioPagos({ prisma, registro, urlFrontend: URL_FRONTEND }) };
}

async function crearUsuario(rol = 'RESIDENTE') {
    contador += 1;
    const u = await prisma.user.create({
        data: {
            nombre: `Prueba ${contador}`,
            email: `${PREFIJO}${Date.now()}.${contador}@ejemplo.test`,
            password: 'no-se-usa',
            rol,
            estadoCuenta: 'APROBADA',
            manzana: '01',
            villa: '02'
        }
    });
    return { id: u.id, rol: u.rol };
}

async function crearReserva(usuario, { creadoEn = new Date(), estado = 'PENDIENTE', montoAlquiler = '15' } = {}) {
    contador += 1;
    return prisma.reserva.create({
        data: {
            usuarioId: usuario.id,
            espacio: 'CABANA_ARBOL',
            fecha: new Date(Date.UTC(2030, 0, 1 + contador)),
            horario: 'CABANA_COMPLETO',
            manzana: '01', villa: '02',
            motivoEvento: 'Prueba de integración',
            nombres: 'Prueba', apellidos: 'Integración',
            correo: 'prueba@ejemplo.test', celular: '0999999999', cedula: '0000000000',
            bancoNombre: 'Banco', numeroCuenta: '123', tipoCuenta: 'AHORROS', cedulaRucBancario: '0000000000',
            montoAlquiler, montoGarantia: '25',
            estado,
            creadoEn
        }
    });
}

async function limpiar() {
    const usuarios = { usuario: { email: { startsWith: PREFIJO } } };
    await prisma.pago.deleteMany({ where: usuarios });
    await prisma.reserva.deleteMany({ where: usuarios });
    await prisma.user.deleteMany({ where: { email: { startsWith: PREFIJO } } });
}

beforeEach(limpiar);
after(async () => {
    await limpiar();
    await prisma.$disconnect();
});

const pedidoAlquiler = (reserva, extra = {}) => ({ reservaId: reserva.id, concepto: 'ALQUILER', proveedor: 'SIMULADO', ...extra });

// ---------- crearPago ----------

test('crearPago toma el monto de la reserva guardada e ignora el del body', async () => {
    const { servicio } = armarServicio();
    const dueno = await crearUsuario();
    const reserva = await crearReserva(dueno, { montoAlquiler: '80.10' });

    const r = await servicio.crearPago(dueno, pedidoAlquiler(reserva, { montoCentavos: 1 }));

    assert.equal(r.status, 201);
    assert.equal(r.cuerpo.tipo, 'REDIRECCION');
    assert.equal(r.cuerpo.url, `${URL_FRONTEND}/pagos/retorno?pago=${r.cuerpo.pagoId}&simulado=1`);
    const pago = await prisma.pago.findUnique({ where: { id: r.cuerpo.pagoId } });
    assert.equal(pago.montoCentavos, 8010);
    assert.equal(pago.estado, 'PENDIENTE');
    assert.equal(pago.idExterno, `SIM-${pago.id}`);
    assert.equal(pago.venceEn.getTime(), reserva.creadoEn.getTime() + 15 * 60000);
});

test('crearPago dos veces reutiliza el pago pendiente en vez de crear otro', async () => {
    const { servicio } = armarServicio();
    const dueno = await crearUsuario();
    const reserva = await crearReserva(dueno);

    const primero = await servicio.crearPago(dueno, pedidoAlquiler(reserva));
    const segundo = await servicio.crearPago(dueno, pedidoAlquiler(reserva));

    assert.equal(segundo.status, 200);
    assert.equal(segundo.cuerpo.pagoId, primero.cuerpo.pagoId);
    assert.equal(await prisma.pago.count({ where: { reservaId: reserva.id } }), 1);
});

test('crearPago responde 404 si la reserva es de otro usuario', async () => {
    const { servicio } = armarServicio();
    const dueno = await crearUsuario();
    const otro = await crearUsuario();
    const reserva = await crearReserva(dueno);

    const r = await servicio.crearPago(otro, pedidoAlquiler(reserva));
    assert.equal(r.status, 404);
});

test('crearPago responde 409 si pasaron los 15 minutos desde la reserva', async () => {
    const { servicio } = armarServicio();
    const dueno = await crearUsuario();
    const reserva = await crearReserva(dueno, { creadoEn: new Date(Date.now() - 20 * 60000) });

    const r = await servicio.crearPago(dueno, pedidoAlquiler(reserva));
    assert.equal(r.status, 409);
    assert.match(r.cuerpo.error, /15 minutos/);
});

test('crearPago responde 400 con un proveedor que no es en línea o no existe', async () => {
    const { servicio } = armarServicio();
    const dueno = await crearUsuario();
    const reserva = await crearReserva(dueno);

    assert.equal((await servicio.crearPago(dueno, pedidoAlquiler(reserva, { proveedor: 'TRANSFERENCIA_MANUAL' }))).status, 400);
    assert.equal((await servicio.crearPago(dueno, pedidoAlquiler(reserva, { proveedor: 'NO_EXISTE' }))).status, 400);
});

// ---------- confirmarPago ----------

test('confirmar con APROBADO deja el pago APROBADO y la reserva sigue PENDIENTE', async () => {
    const { servicio } = armarServicio();
    const dueno = await crearUsuario();
    const reserva = await crearReserva(dueno);
    const { cuerpo } = await servicio.crearPago(dueno, pedidoAlquiler(reserva));

    const r = await servicio.confirmarPago(dueno, cuerpo.pagoId, { resultado: 'APROBADO' });

    assert.equal(r.status, 200);
    assert.equal(r.cuerpo.pago.estado, 'APROBADO');
    const enBase = await prisma.pago.findUnique({ where: { id: cuerpo.pagoId } });
    assert.ok(enBase.resueltoEn);
    // Bloque E: aprobar el pago no cambia la reserva; eso llega en el Bloque E2.
    assert.equal((await prisma.reserva.findUnique({ where: { id: reserva.id } })).estado, 'PENDIENTE');
});

test('confirmar con RECHAZADO deja el pago RECHAZADO', async () => {
    const { servicio } = armarServicio();
    const dueno = await crearUsuario();
    const reserva = await crearReserva(dueno);
    const { cuerpo } = await servicio.crearPago(dueno, pedidoAlquiler(reserva));

    const r = await servicio.confirmarPago(dueno, cuerpo.pagoId, { resultado: 'RECHAZADO' });
    assert.equal(r.cuerpo.pago.estado, 'RECHAZADO');
});

test('dos confirmaciones en paralelo aplican un solo APROBADO y ambas responden APROBADO', async () => {
    const { servicio } = armarServicio();
    const dueno = await crearUsuario();
    const reserva = await crearReserva(dueno);
    const { cuerpo } = await servicio.crearPago(dueno, pedidoAlquiler(reserva));

    const [a, b] = await Promise.all([
        servicio.confirmarPago(dueno, cuerpo.pagoId, { resultado: 'APROBADO' }),
        servicio.confirmarPago(dueno, cuerpo.pagoId, { resultado: 'APROBADO' })
    ]);

    assert.equal(a.cuerpo.pago.estado, 'APROBADO');
    assert.equal(b.cuerpo.pago.estado, 'APROBADO');
    assert.equal(await prisma.pago.count({ where: { reservaId: reserva.id, estado: 'APROBADO' } }), 1);
});

test('confirmar un pago ya APROBADO no vuelve a llamar al proveedor', async () => {
    const { servicio, simulado } = armarServicio();
    const dueno = await crearUsuario();
    const reserva = await crearReserva(dueno);
    const { cuerpo } = await servicio.crearPago(dueno, pedidoAlquiler(reserva));
    await servicio.confirmarPago(dueno, cuerpo.pagoId, { resultado: 'APROBADO' });
    const llamadas = simulado.llamadasConfirmar;

    const r = await servicio.confirmarPago(dueno, cuerpo.pagoId, { resultado: 'RECHAZADO' });

    assert.equal(r.cuerpo.pago.estado, 'APROBADO');
    assert.equal(simulado.llamadasConfirmar, llamadas);
});

test('si el proveedor no responde (caída) el pago sigue PENDIENTE', async () => {
    const dueno = await crearUsuario();
    const reserva = await crearReserva(dueno);
    // El guion se fija por pagoId, que aún no existe: se crea primero con un
    // servicio y se confirma con otro cuyo simulado conoce el cobro con CAIDA.
    const { servicio } = armarServicio();
    const { cuerpo } = await servicio.crearPago(dueno, pedidoAlquiler(reserva));
    const conCaida = armarServicio({ [cuerpo.pagoId]: 'CAIDA' });
    await conCaida.simulado.crearCobro({ pagoId: cuerpo.pagoId, montoCentavos: 1500, referencia: 'x', urlRetorno: URL_FRONTEND });

    const r = await conCaida.servicio.confirmarPago(dueno, cuerpo.pagoId, {});
    assert.equal(r.status, 200);
    assert.equal(r.cuerpo.pago.estado, 'PENDIENTE');
});

test('si el monto confirmado no coincide, no se aplica y responde 409', async () => {
    const dueno = await crearUsuario();
    const reserva = await crearReserva(dueno);
    const { servicio } = armarServicio();
    const { cuerpo } = await servicio.crearPago(dueno, pedidoAlquiler(reserva));
    const distinto = armarServicio({ [cuerpo.pagoId]: 'MONTO_DISTINTO' });
    await distinto.simulado.crearCobro({ pagoId: cuerpo.pagoId, montoCentavos: 1500, referencia: 'x', urlRetorno: URL_FRONTEND });

    const r = await distinto.servicio.confirmarPago(dueno, cuerpo.pagoId, {});
    assert.equal(r.status, 409);
    assert.equal((await prisma.pago.findUnique({ where: { id: cuerpo.pagoId } })).estado, 'PENDIENTE');
});

test('un segundo pago aprobado del mismo concepto queda DUPLICADO y el simulado lo revierte', async () => {
    const { servicio, simulado } = armarServicio();
    const dueno = await crearUsuario();
    const reserva = await crearReserva(dueno);
    const { cuerpo } = await servicio.crearPago(dueno, pedidoAlquiler(reserva));
    await servicio.confirmarPago(dueno, cuerpo.pagoId, { resultado: 'APROBADO' });

    // Un segundo cobro del mismo alquiler (por ejemplo, de otra pestaña).
    const segundo = await prisma.pago.create({
        data: { usuarioId: dueno.id, tipo: 'RESERVA', concepto: 'ALQUILER', reservaId: reserva.id, montoCentavos: 1500, proveedor: 'SIMULADO' }
    });
    const cobro = await simulado.crearCobro({ pagoId: segundo.id, montoCentavos: 1500, referencia: 'x', urlRetorno: URL_FRONTEND });
    await prisma.pago.update({ where: { id: segundo.id }, data: { idExterno: cobro.idExterno } });

    const r = await servicio.confirmarPago(dueno, segundo.id, { resultado: 'APROBADO' });
    assert.equal(r.cuerpo.pago.estado, 'REVERSADO');
    assert.equal(await prisma.pago.count({ where: { reservaId: reserva.id, estado: 'APROBADO' } }), 1);
});

test('otro usuario no puede ver ni confirmar el pago (404)', async () => {
    const { servicio } = armarServicio();
    const dueno = await crearUsuario();
    const otro = await crearUsuario();
    const reserva = await crearReserva(dueno);
    const { cuerpo } = await servicio.crearPago(dueno, pedidoAlquiler(reserva));

    assert.equal((await servicio.confirmarPago(otro, cuerpo.pagoId, {})).status, 404);
    assert.equal((await servicio.obtenerPago(otro, cuerpo.pagoId)).status, 404);
    assert.equal((await servicio.listarPagosDeReserva(otro, reserva.id)).status, 404);
});

test('el dueño y el admin ven el pago; el dueño sin respuestaProveedor', async () => {
    const { servicio } = armarServicio();
    const dueno = await crearUsuario();
    const admin = await crearUsuario('ADMIN');
    const reserva = await crearReserva(dueno);
    const { cuerpo } = await servicio.crearPago(dueno, pedidoAlquiler(reserva));
    await servicio.confirmarPago(dueno, cuerpo.pagoId, { resultado: 'APROBADO' });

    const delDueno = await servicio.obtenerPago(dueno, cuerpo.pagoId);
    const delAdmin = await servicio.obtenerPago(admin, cuerpo.pagoId);
    assert.equal('respuestaProveedor' in delDueno.cuerpo.pago, false);
    assert.ok(delAdmin.cuerpo.pago.respuestaProveedor);

    const lista = await servicio.listarPagosDeReserva(dueno, reserva.id);
    assert.equal(lista.status, 200);
    assert.equal(lista.cuerpo.pagos.length, 1);
});

// ---------- Reglas de la base (migración) ----------

test('la base rechaza un segundo APROBADO para la misma reserva y concepto (índice parcial)', async () => {
    const dueno = await crearUsuario();
    const reserva = await crearReserva(dueno);
    const datos = { usuarioId: dueno.id, tipo: 'RESERVA', concepto: 'ALQUILER', reservaId: reserva.id, montoCentavos: 1500, proveedor: 'SIMULADO', estado: 'APROBADO' };
    await prisma.pago.create({ data: datos });

    await assert.rejects(prisma.pago.create({ data: datos }), (error) => error.code === 'P2002');
});

test('la base rechaza un monto de 0 y un pago de reserva sin reserva (CHECK)', async () => {
    const dueno = await crearUsuario();
    const reserva = await crearReserva(dueno);
    const base = { usuarioId: dueno.id, tipo: 'RESERVA', concepto: 'ALQUILER', proveedor: 'SIMULADO' };

    await assert.rejects(prisma.pago.create({ data: { ...base, reservaId: reserva.id, montoCentavos: 0 } }), /Pago_monto_positivo/);
    await assert.rejects(prisma.pago.create({ data: { ...base, montoCentavos: 1500 } }), /Pago_referencia_segun_tipo/);
});

test('la base no deja borrar una reserva que tiene pagos (RESTRICT)', async () => {
    const dueno = await crearUsuario();
    const reserva = await crearReserva(dueno);
    await prisma.pago.create({
        data: { usuarioId: dueno.id, tipo: 'RESERVA', concepto: 'ALQUILER', reservaId: reserva.id, montoCentavos: 1500, proveedor: 'SIMULADO' }
    });

    await assert.rejects(prisma.reserva.delete({ where: { id: reserva.id } }), /Pago_reservaId_fkey/);
});

test('las transacciones de pagos corren de verdad en Serializable con adapter-pg', async () => {
    const nivel = await prisma.$transaction(
        (tx) => tx.$queryRaw`SELECT current_setting('transaction_isolation') AS nivel`,
        { isolationLevel: 'Serializable' }
    );
    assert.equal(nivel[0].nivel, 'serializable');
});
