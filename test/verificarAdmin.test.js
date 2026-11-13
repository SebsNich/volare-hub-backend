const { test } = require('node:test');
const assert = require('node:assert/strict');
const { crearVerificadorAdmin } = require('../src/middleware/auth.middleware');

function crearResMock() {
    return {
        statusCode: null,
        body: null,
        status(codigo) { this.statusCode = codigo; return this; },
        json(payload) { this.body = payload; return this; }
    };
}

// Ejecuta el middleware con un "usuario en base" falso y cuenta las consultas.
async function ejecutar(usuarioToken, usuarioEnBase) {
    const consultas = [];
    const verificarAdmin = crearVerificadorAdmin(async (id) => { consultas.push(id); return usuarioEnBase; });
    const req = { user: usuarioToken };
    const res = crearResMock();
    let llamoNext = false;
    await verificarAdmin(req, res, () => { llamoNext = true; });
    return { res, llamoNext, consultas };
}

const adminToken = { id: 'a1', rol: 'ADMIN' };
const adminEnBase = { rol: 'ADMIN', activo: true, estadoCuenta: 'APROBADA' };

test('un admin activo y aprobado pasa', async () => {
    const { llamoNext, res } = await ejecutar(adminToken, adminEnBase);
    assert.equal(llamoNext, true);
    assert.equal(res.statusCode, null);
});

test('un admin desactivado recibe 403 al instante, aunque su token siga vigente', async () => {
    const { llamoNext, res } = await ejecutar(adminToken, { ...adminEnBase, activo: false });
    assert.equal(llamoNext, false);
    assert.equal(res.statusCode, 403);
});

test('si en la base ya no es admin, recibe 403 aunque el token diga ADMIN', async () => {
    const { llamoNext, res } = await ejecutar(adminToken, { ...adminEnBase, rol: 'RESIDENTE' });
    assert.equal(llamoNext, false);
    assert.equal(res.statusCode, 403);
});

test('si la cuenta ya no existe, no pasa', async () => {
    const { llamoNext, res } = await ejecutar(adminToken, null);
    assert.equal(llamoNext, false);
    assert.ok(res.statusCode >= 400);
});

test('un residente recibe 403 sin consultar la base', async () => {
    const { llamoNext, res, consultas } = await ejecutar({ id: 'r1', rol: 'RESIDENTE' }, adminEnBase);
    assert.equal(llamoNext, false);
    assert.equal(res.statusCode, 403);
    assert.equal(consultas.length, 0);
});

test('si la base falla responde 500 y no deja pasar', async () => {
    const verificarAdmin = crearVerificadorAdmin(async () => { throw new Error('base caída'); });
    const res = crearResMock();
    let llamoNext = false;
    const original = console.error;
    console.error = () => {};
    try {
        await verificarAdmin({ user: adminToken }, res, () => { llamoNext = true; });
    } finally {
        console.error = original;
    }
    assert.equal(res.statusCode, 500);
    assert.equal(llamoNext, false);
});
