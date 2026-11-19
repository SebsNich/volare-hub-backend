const { test } = require('node:test');
const assert = require('node:assert/strict');
const { validarCambioEstado } = require('../src/lib/gestionUsuarios');

const admin = { id: 'adm1', rol: 'ADMIN' };

test('RF-52: un admin no puede desactivarse a sí mismo', () => {
    const r = validarCambioEstado({ idObjetivo: 'adm1', activo: false, solicitante: admin });
    assert.equal(r.status, 409);
    assert.match(r.error, /tu propia cuenta/);
});

test('RF-52: un admin sí puede activarse a sí mismo (no cambia nada malo) y desactivar a otro', () => {
    assert.equal(validarCambioEstado({ idObjetivo: 'adm1', activo: true, solicitante: admin }), null);
    assert.equal(validarCambioEstado({ idObjetivo: 'u2', activo: false, solicitante: admin }), null);
});

test('RF-20: activo debe ser true o false (no texto ni ausente)', () => {
    for (const activo of ['false', undefined, null, 0, 'si']) {
        const r = validarCambioEstado({ idObjetivo: 'u2', activo, solicitante: admin });
        assert.equal(r.status, 400, `activo=${activo}`);
    }
});
