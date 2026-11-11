const { test } = require('node:test');
const assert = require('node:assert/strict');
const { ejecutarConReintentos } = require('../src/lib/reintentos');

const conflicto = () => Object.assign(new Error('conflicto'), { code: 'P2034' });
const esConflicto = (error) => error.code === 'P2034';

// Simula una operación que falla las primeras "fallos" veces con el error dado.
function operacionQueFalla(fallos, crearError) {
    const estado = { llamadas: 0 };
    const operacion = async () => {
        estado.llamadas++;
        if (estado.llamadas <= fallos) throw crearError();
        return 'listo';
    };
    return { operacion, estado };
}

test('ejecutarConReintentos devuelve el resultado al primer intento si no falla', async () => {
    const { operacion, estado } = operacionQueFalla(0, conflicto);
    assert.equal(await ejecutarConReintentos(operacion, { debeReintentar: esConflicto }), 'listo');
    assert.equal(estado.llamadas, 1);
});

test('ejecutarConReintentos reintenta tras un conflicto y termina bien', async () => {
    const { operacion, estado } = operacionQueFalla(2, conflicto);
    assert.equal(await ejecutarConReintentos(operacion, { debeReintentar: esConflicto }), 'listo');
    assert.equal(estado.llamadas, 3);
});

test('ejecutarConReintentos se rinde tras 3 intentos y lanza el último error', async () => {
    const { operacion, estado } = operacionQueFalla(5, conflicto);
    await assert.rejects(ejecutarConReintentos(operacion, { debeReintentar: esConflicto }), { code: 'P2034' });
    assert.equal(estado.llamadas, 3);
});

test('ejecutarConReintentos no reintenta errores que no son conflictos', async () => {
    const { operacion, estado } = operacionQueFalla(1, () => new Error('base caída'));
    await assert.rejects(ejecutarConReintentos(operacion, { debeReintentar: esConflicto }), /base caída/);
    assert.equal(estado.llamadas, 1);
});
