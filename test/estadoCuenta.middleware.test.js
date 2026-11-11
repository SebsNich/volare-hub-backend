const { test } = require('node:test');
const assert = require('node:assert/strict');
const { crearVerificadorEstadoCuenta } = require('../src/middleware/estadoCuenta.middleware');

function crearResMock() {
    return {
        statusCode: null,
        body: null,
        status(codigo) { this.statusCode = codigo; return this; },
        json(payload) { this.body = payload; return this; }
    };
}

// Ejecuta el middleware con un usuario falso (sin base de datos).
async function ejecutar(usuarioEnBase, opciones, req = { user: { id: 'user-1' }, params: {} }) {
    const buscadas = [];
    const verificarEstadoCuenta = crearVerificadorEstadoCuenta(async (id) => { buscadas.push(id); return usuarioEnBase; });
    const res = crearResMock();
    let siguiente = false;
    await verificarEstadoCuenta(opciones)(req, res, () => { siguiente = true; });
    return { res, siguiente, buscadas };
}

const cuenta = (datos) => ({ activo: true, estadoCuenta: 'APROBADA', motivoRechazo: null, ...datos });

test('deja pasar una cuenta APROBADA y activa', async () => {
    const { res, siguiente, buscadas } = await ejecutar(cuenta({}));
    assert.equal(siguiente, true);
    assert.equal(res.statusCode, null);
    assert.deepEqual(buscadas, ['user-1']);
});

test('responde 403 CUENTA_INACTIVA si activo=false, aunque esté APROBADA', async () => {
    const { res, siguiente } = await ejecutar(cuenta({ activo: false }));
    assert.equal(siguiente, false);
    assert.equal(res.statusCode, 403);
    assert.equal(res.body.codigo, 'CUENTA_INACTIVA');
});

test('responde 403 CUENTA_PENDIENTE a una PENDIENTE por defecto', async () => {
    const { res, siguiente } = await ejecutar(cuenta({ estadoCuenta: 'PENDIENTE' }));
    assert.equal(siguiente, false);
    assert.equal(res.statusCode, 403);
    assert.equal(res.body.codigo, 'CUENTA_PENDIENTE');
});

test('deja pasar a una PENDIENTE si la ruta permite pendientes', async () => {
    const { siguiente } = await ejecutar(cuenta({ estadoCuenta: 'PENDIENTE' }), { permitirPendiente: true });
    assert.equal(siguiente, true);
});

test('permitirPendiente como función: una PENDIENTE ve su propio perfil', async () => {
    const esSuPerfil = (req) => req.params.id === req.user.id;
    const req = { user: { id: 'user-1' }, params: { id: 'user-1' } };
    const { siguiente } = await ejecutar(cuenta({ estadoCuenta: 'PENDIENTE' }), { permitirPendiente: esSuPerfil }, req);
    assert.equal(siguiente, true);
});

test('permitirPendiente como función: una PENDIENTE no ve perfiles ajenos', async () => {
    const esSuPerfil = (req) => req.params.id === req.user.id;
    const req = { user: { id: 'user-1' }, params: { id: 'otro-usuario' } };
    const { res, siguiente } = await ejecutar(cuenta({ estadoCuenta: 'PENDIENTE' }), { permitirPendiente: esSuPerfil }, req);
    assert.equal(siguiente, false);
    assert.equal(res.body.codigo, 'CUENTA_PENDIENTE');
});

test('responde 403 CUENTA_RECHAZADA aunque la ruta permita pendientes', async () => {
    const { res, siguiente } = await ejecutar(cuenta({ estadoCuenta: 'RECHAZADA' }), { permitirPendiente: true });
    assert.equal(siguiente, false);
    assert.equal(res.statusCode, 403);
    assert.equal(res.body.codigo, 'CUENTA_RECHAZADA');
});

test('responde 401 si el usuario del token ya no existe', async () => {
    const { res, siguiente } = await ejecutar(null);
    assert.equal(siguiente, false);
    assert.equal(res.statusCode, 401);
});

test('responde 500 con mensaje claro si falla la consulta, sin llamar a next', async () => {
    const verificar = crearVerificadorEstadoCuenta(async () => { throw new Error('base caída'); });
    const res = crearResMock();
    let siguiente = false;
    const errorOriginal = console.error;
    console.error = () => {};
    try {
        await verificar()({ user: { id: 'user-1' }, params: {} }, res, () => { siguiente = true; });
    } finally {
        console.error = errorOriginal;
    }
    assert.equal(siguiente, false);
    assert.equal(res.statusCode, 500);
    assert.match(res.body.mensaje, /estado de la cuenta/);
});
