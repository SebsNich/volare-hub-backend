// Informe económico contra volare_test: quién recibe el correo y quién ve el comunicado.
// Se ejecutan con: npm run test:integracion
const { verificarBaseDePruebas } = require('../helpers/candadoBasePruebas');
verificarBaseDePruebas(process.env.DATABASE_URL);

const { test, after, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
const prisma = require('../../src/lib/prisma');
const { FILTRO_RESIDENTES_ACTIVOS } = require('../../src/lib/resumenAdmin');
const { filtroVisibilidad } = require('../../src/lib/visibilidadPosts');

const PREFIJO = 'it.informe.';
let contador = 0;

async function crearUsuario(datos = {}) {
    contador += 1;
    return prisma.user.create({
        data: { nombre: `Prueba ${contador}`, email: `${PREFIJO}${Date.now()}.${contador}@ejemplo.test`, password: 'no-se-usa', rol: 'RESIDENTE', estadoCuenta: 'APROBADA', ...datos }
    });
}

async function limpiar() {
    await prisma.post.deleteMany({ where: { autor: { email: { startsWith: PREFIJO } } } });
    await prisma.user.deleteMany({ where: { email: { startsWith: PREFIJO } } });
}

beforeEach(limpiar);
after(async () => { await limpiar(); await prisma.$disconnect(); });

test('"todos los residentes" son solo los aprobados, activos y de rol residente', async () => {
    const ok = await crearUsuario();
    await crearUsuario({ estadoCuenta: 'PENDIENTE' });
    await crearUsuario({ estadoCuenta: 'RECHAZADA' });
    await crearUsuario({ activo: false });
    await crearUsuario({ rol: 'ADMIN' });
    const encontrados = await prisma.user.findMany({
        where: { ...FILTRO_RESIDENTES_ACTIVOS, email: { startsWith: PREFIJO } }, select: { email: true }
    });
    assert.deepEqual(encontrados.map(u => u.email), [ok.email]);
});

test('un comunicado "solo aprobados" lo ve un residente aprobado y no uno pendiente', async () => {
    const admin = await crearUsuario({ rol: 'ADMIN' });
    const comun = await prisma.post.create({ data: { titulo: 'Informe', descripcion: 'x', tipo: 'COMUNICADO', soloAprobados: true, autorId: admin.id } });
    const normal = await prisma.post.create({ data: { titulo: 'Aviso', descripcion: 'x', tipo: 'AVISO', autorId: admin.id } });
    assert.equal(normal.soloAprobados, false); // por defecto sigue visible para todos

    const ids = async (usuario) => (await prisma.post.findMany({
        where: { autorId: admin.id, estado: 'ACTIVO', ...filtroVisibilidad(usuario) }
    })).map(p => p.id).sort();

    assert.deepEqual(await ids({ rol: 'RESIDENTE', estadoCuenta: 'APROBADA' }), [comun.id, normal.id].sort());
    assert.deepEqual(await ids({ rol: 'RESIDENTE', estadoCuenta: 'PENDIENTE' }), [normal.id]);
});
