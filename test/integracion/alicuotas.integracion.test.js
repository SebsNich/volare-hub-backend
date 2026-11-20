// Alícuotas contra volare_test: el valor fijo ($60, o $55 si se paga en los
// primeros 5 días), el pago por el MISMO núcleo de pagos y lo que garantiza la base.
// Se ejecutan con: npm run test:integracion
const { verificarBaseDePruebas } = require('../helpers/candadoBasePruebas');
verificarBaseDePruebas(process.env.DATABASE_URL);

const { test, after, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
const prisma = require('../../src/lib/prisma');
const { crearServicioPagos } = require('../../src/lib/pagos/servicioPagos');
const { crearServicioAlicuotas } = require('../../src/lib/alicuotas/servicioAlicuotas');
const { crearRegistroProveedores } = require('../../src/lib/pagos/registroProveedores');

const PREFIJO = 'it.alic.';
const URL_FRONTEND = 'http://localhost:5173';
let contador = 0;

// Reloj de la prueba: se cambia para "pagar" en distintos días del mes.
let ahoraPrueba = new Date('2026-12-03T15:00:00Z');
const ahora = () => ahoraPrueba;

const registro = crearRegistroProveedores({ PAGOS_PROVEEDOR_EN_LINEA: 'SIMULADO' });
const subirEvidencias = async () => ['http://localhost:3000/uploads-dev/prueba/comprobante.png'];
const alicuotas = crearServicioAlicuotas({ prisma, registro, urlFrontend: URL_FRONTEND, ahora, subirEvidencias });
const pagos = crearServicioPagos({ prisma, registro, urlFrontend: URL_FRONTEND, ahora });
const archivo = [{ buffer: Buffer.from('x'), mimetype: 'image/png', originalname: 'c.png' }];

async function crearUsuario({ rol = 'RESIDENTE', manzana = `T${++contador}`, villa = '7' } = {}) {
    contador += 1;
    const u = await prisma.user.create({
        data: {
            nombre: `Prueba ${contador}`, email: `${PREFIJO}${Date.now()}.${contador}@ejemplo.test`, password: 'no-se-usa',
            rol, estadoCuenta: 'APROBADA', manzana, villa
        }
    });
    return { id: u.id, rol: u.rol, manzana, villa };
}

async function limpiar() {
    const duenos = { usuario: { email: { startsWith: PREFIJO } } };
    await prisma.pago.deleteMany({ where: duenos });
    await prisma.cuotaAlicuota.deleteMany({ where: { manzana: { startsWith: 'T' } } });
    await prisma.user.deleteMany({ where: { email: { startsWith: PREFIJO } } });
    await prisma.configAlicuota.deleteMany({});
    ahoraPrueba = new Date('2026-12-03T15:00:00Z');
}

beforeEach(limpiar);
after(async () => { await limpiar(); await prisma.$disconnect(); });

const cuotaDe = (usuario, periodo = '2026-12') =>
    prisma.cuotaAlicuota.findFirst({ where: { manzana: usuario.manzana.toUpperCase(), villa: usuario.villa.toUpperCase(), periodo } });

test('sin configuración guardada se usa la inicial: $60 y $55 en los primeros 5 días', async () => {
    const r = await alicuotas.obtenerConfig();
    assert.deepEqual([r.cuerpo.config.montoCentavos, r.cuerpo.config.montoPuntualCentavos, r.cuerpo.config.diasPuntual], [6000, 5500, 5]);
});

test('el residente ve su cuota del mes sin que nadie la genere', async () => {
    const u = await crearUsuario();
    const r = await alicuotas.misCuotas(u.id);
    assert.equal(r.status, 200);
    assert.equal(r.cuerpo.cuotas.length, 1);
    assert.equal(r.cuerpo.cuotas[0].periodo, '2026-12');
    assert.equal(r.cuerpo.cuotas[0].estado, 'PENDIENTE');
    // Repetir la consulta no duplica la cuota.
    assert.equal((await alicuotas.misCuotas(u.id)).cuerpo.cuotas.length, 1);
});

test('PRUEBA CLAVE: el día 3 se cobra $55 y el día 10 se cobra $60', async () => {
    const u = await crearUsuario();
    ahoraPrueba = new Date('2026-12-03T15:00:00Z');
    const temprano = (await alicuotas.misCuotas(u.id)).cuerpo.cuotas[0];
    assert.equal(temprano.pagarHoyCentavos, 5500);
    assert.equal(temprano.aplicaDescuento, true);

    ahoraPrueba = new Date('2026-12-10T15:00:00Z');
    const tarde = (await alicuotas.misCuotas(u.id)).cuerpo.cuotas[0];
    assert.equal(tarde.pagarHoyCentavos, 6000);
    assert.equal(tarde.aplicaDescuento, false);
});

test('el pago creado guarda el monto del día: $55 el día 3 y $60 el día 10', async () => {
    const u1 = await crearUsuario();
    const u2 = await crearUsuario();
    ahoraPrueba = new Date('2026-12-03T15:00:00Z');
    const a = await alicuotas.pagarPorTransferencia(u1, { cuotaId: (await cuotaOCrear(u1)).id }, archivo);
    ahoraPrueba = new Date('2026-12-10T15:00:00Z');
    const b = await alicuotas.pagarPorTransferencia(u2, { cuotaId: (await cuotaOCrear(u2)).id }, archivo);
    assert.equal(a.status, 201);
    assert.equal(a.cuerpo.pago.montoCentavos, 5500);
    assert.equal(b.cuerpo.pago.montoCentavos, 6000);
});

async function cuotaOCrear(u) {
    await alicuotas.misCuotas(u.id);
    return cuotaDe(u);
}

test('el monto del body se ignora: el servidor siempre calcula', async () => {
    const u = await crearUsuario();
    const cuota = await cuotaOCrear(u);
    const r = await alicuotas.pagarPorTransferencia(u, { cuotaId: cuota.id, montoCentavos: 1, monto: 1 }, archivo);
    assert.equal(r.cuerpo.pago.montoCentavos, 5500);
});

test('si el admin cambia los montos, lo ya generado no cambia y lo nuevo sí', async () => {
    const admin = await crearUsuario({ rol: 'ADMIN', manzana: 'T0', villa: '0' });
    const u = await crearUsuario();
    await cuotaOCrear(u); // se genera con 60/55
    const cambio = await alicuotas.actualizarConfig(admin, { monto: '70', montoPuntual: '65', diasPuntual: 7 });
    assert.equal(cambio.status, 200);
    assert.equal(cambio.cuerpo.config.montoCentavos, 7000);

    const vieja = (await alicuotas.misCuotas(u.id)).cuerpo.cuotas[0];
    assert.equal(vieja.pagarHoyCentavos, 5500);

    const gen = await alicuotas.generarCuotas({ periodo: '2027-01' });
    assert.equal(gen.status, 200);
    const nueva = await cuotaDe(u, '2027-01');
    assert.equal(nueva.montoBaseCentavos, 7000);
    assert.equal(nueva.montoPuntualCentavos, 6500);
    assert.equal(nueva.diasPuntual, 7);
});

test('actualizarConfig rechaza datos incoherentes y no guarda nada', async () => {
    const admin = await crearUsuario({ rol: 'ADMIN', manzana: 'T0', villa: '0' });
    const r = await alicuotas.actualizarConfig(admin, { monto: 50, montoPuntual: 60, diasPuntual: 5 });
    assert.equal(r.status, 400);
    assert.equal((await alicuotas.obtenerConfig()).cuerpo.config.montoCentavos, 6000);
});

test('generarCuotas es idempotente y crea una cuota por villa (aunque la villa se escriba distinto)', async () => {
    await crearUsuario({ manzana: 'T1', villa: '1' });
    await crearUsuario({ manzana: 't1 ', villa: '1' }); // misma villa, otra escritura
    await crearUsuario({ manzana: 'T1', villa: '2' });
    const primera = await alicuotas.generarCuotas({ periodo: '2026-12' });
    const segunda = await alicuotas.generarCuotas({ periodo: '2026-12' });
    const propias = await prisma.cuotaAlicuota.count({ where: { manzana: 'T1', periodo: '2026-12' } });
    assert.equal(propias, 2);
    assert.ok(primera.cuerpo.creadas >= 2);
    assert.equal(segunda.cuerpo.creadas, 0);
});

test('un periodo con formato inválido se rechaza', async () => {
    assert.equal((await alicuotas.generarCuotas({ periodo: '2026-13' })).status, 400);
});

test('pagar en línea (simulado) aprobado deja la cuota PAGADA con el monto de hoy', async () => {
    const u = await crearUsuario();
    const cuota = await cuotaOCrear(u);
    const r = await alicuotas.pagarEnLinea(u, { cuotaId: cuota.id, proveedor: 'SIMULADO' });
    assert.equal(r.status, 201);
    const pago = await prisma.pago.findUnique({ where: { id: r.cuerpo.pagoId } });
    assert.equal(pago.tipo, 'ALICUOTA');
    assert.equal(pago.montoCentavos, 5500);

    const conf = await pagos.confirmarPago(u, pago.id, { resultado: 'APROBADO' });
    assert.equal(conf.cuerpo.pago.estado, 'APROBADO');
    assert.equal((await cuotaDe(u)).estado, 'PAGADA');
    // Una cuota pagada no se vuelve a pagar.
    assert.equal((await alicuotas.pagarEnLinea(u, { cuotaId: cuota.id, proveedor: 'SIMULADO' })).status, 409);
});

test('un pago en línea rechazado deja la cuota pendiente para reintentar', async () => {
    const u = await crearUsuario();
    const cuota = await cuotaOCrear(u);
    const r = await alicuotas.pagarEnLinea(u, { cuotaId: cuota.id, proveedor: 'SIMULADO' });
    await pagos.confirmarPago(u, r.cuerpo.pagoId, { resultado: 'RECHAZADO' });
    assert.equal((await cuotaDe(u)).estado, 'PENDIENTE');
    assert.equal((await alicuotas.pagarEnLinea(u, { cuotaId: cuota.id, proveedor: 'SIMULADO' })).status, 201);
});

test('transferencia: queda en revisión y el admin la aprueba → cuota PAGADA', async () => {
    const admin = await crearUsuario({ rol: 'ADMIN', manzana: 'T0', villa: '0' });
    const u = await crearUsuario();
    const cuota = await cuotaOCrear(u);
    const r = await alicuotas.pagarPorTransferencia(u, { cuotaId: cuota.id }, archivo);
    assert.equal(r.status, 201);
    assert.deepEqual(r.cuerpo.pago.evidenciaUrls, ['http://localhost:3000/uploads-dev/prueba/comprobante.png']);
    assert.equal((await alicuotas.misCuotas(u.id)).cuerpo.cuotas[0].transferenciaEnRevision, true);
    // Mientras está en revisión no se puede enviar otra ni pagar en línea.
    assert.equal((await alicuotas.pagarPorTransferencia(u, { cuotaId: cuota.id }, archivo)).status, 409);
    assert.equal((await alicuotas.pagarEnLinea(u, { cuotaId: cuota.id, proveedor: 'SIMULADO' })).status, 409);

    const dec = await pagos.decidirPagoManual(admin, r.cuerpo.pago.id, { decision: 'APROBAR' });
    assert.equal(dec.cuerpo.pago.estado, 'APROBADO');
    assert.equal((await cuotaDe(u)).estado, 'PAGADA');
});

test('transferencia rechazada: la cuota sigue pendiente y el residente ve el motivo', async () => {
    const admin = await crearUsuario({ rol: 'ADMIN', manzana: 'T0', villa: '0' });
    const u = await crearUsuario();
    const cuota = await cuotaOCrear(u);
    const r = await alicuotas.pagarPorTransferencia(u, { cuotaId: cuota.id }, archivo);
    await pagos.decidirPagoManual(admin, r.cuerpo.pago.id, { decision: 'RECHAZAR', motivo: 'El monto no coincide' });
    const vista = (await alicuotas.misCuotas(u.id)).cuerpo.cuotas[0];
    assert.equal(vista.estado, 'PENDIENTE');
    assert.equal(vista.transferenciaEnRevision, false);
    assert.equal(vista.ultimoRechazo, 'El monto no coincide');
});

test('transferencia sin comprobante se rechaza con 400', async () => {
    const u = await crearUsuario();
    const cuota = await cuotaOCrear(u);
    assert.equal((await alicuotas.pagarPorTransferencia(u, { cuotaId: cuota.id }, [])).status, 400);
});

test('nadie puede pagar la cuota de otra villa (404, como si no existiera)', async () => {
    const dueno = await crearUsuario();
    const intruso = await crearUsuario();
    const cuota = await cuotaOCrear(dueno);
    assert.equal((await alicuotas.pagarPorTransferencia(intruso, { cuotaId: cuota.id }, archivo)).status, 404);
    assert.equal((await alicuotas.pagarEnLinea(intruso, { cuotaId: cuota.id, proveedor: 'SIMULADO' })).status, 404);
});

test('una cuota anulada no se puede pagar y una pagada no se puede anular', async () => {
    const u = await crearUsuario();
    const cuota = await cuotaOCrear(u);
    assert.equal((await alicuotas.anularCuota(cuota.id)).status, 200);
    assert.equal((await alicuotas.pagarEnLinea(u, { cuotaId: cuota.id, proveedor: 'SIMULADO' })).status, 409);
    assert.equal((await alicuotas.anularCuota(cuota.id)).status, 409);
});

test('la base rechaza un pago de alícuota sin cuota y a dos pagos aprobados de la misma cuota (CHECK e índice)', async () => {
    const u = await crearUsuario();
    const cuota = await cuotaOCrear(u);
    const base = { usuarioId: u.id, tipo: 'ALICUOTA', concepto: 'ALICUOTA', montoCentavos: 5500, proveedor: 'X' };
    await assert.rejects(prisma.pago.create({ data: base }), /Pago_referencia_segun_tipo/);
    await prisma.pago.create({ data: { ...base, cuotaId: cuota.id, estado: 'APROBADO', idExterno: 'a' } });
    await assert.rejects(prisma.pago.create({ data: { ...base, cuotaId: cuota.id, estado: 'APROBADO', idExterno: 'b' } }), /Pago_un_aprobado_por_cuota|Unique/);
});
