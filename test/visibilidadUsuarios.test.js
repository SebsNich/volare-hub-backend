const { test } = require('node:test');
const assert = require('node:assert/strict');
const { filtroResidentesVisibles, puedeVerPerfil } = require('../src/lib/visibilidadUsuarios');

const residente = { id: 'r1', rol: 'RESIDENTE' };
const admin = { id: 'a1', rol: 'ADMIN' };

const perfil = (estadoCuenta, activo = true) => ({ id: 'p1', estadoCuenta, activo });

test('un residente solo encuentra cuentas aprobadas y activas en el buscador', () => {
    assert.deepEqual(filtroResidentesVisibles(residente), { activo: true, estadoCuenta: 'APROBADA' });
});

test('el admin encuentra todas las cuentas en el buscador', () => {
    assert.deepEqual(filtroResidentesVisibles(admin), {});
});

test('un residente ve el perfil de una cuenta aprobada y activa', () => {
    assert.equal(puedeVerPerfil(perfil('APROBADA'), residente), true);
});

test('un residente no ve perfiles pendientes, rechazados ni inactivos', () => {
    assert.equal(puedeVerPerfil(perfil('PENDIENTE'), residente), false);
    assert.equal(puedeVerPerfil(perfil('RECHAZADA'), residente), false);
    assert.equal(puedeVerPerfil(perfil('APROBADA', false), residente), false);
});

test('el admin ve cualquier perfil', () => {
    for (const estado of ['APROBADA', 'PENDIENTE', 'RECHAZADA']) {
        assert.equal(puedeVerPerfil(perfil(estado), admin), true);
        assert.equal(puedeVerPerfil(perfil(estado, false), admin), true);
    }
});

test('cada uno ve su propio perfil aunque esté pendiente', () => {
    const propio = { id: 'p1', rol: 'RESIDENTE' };
    assert.equal(puedeVerPerfil(perfil('PENDIENTE'), propio), true);
});

test('un perfil inexistente no se puede ver', () => {
    assert.equal(puedeVerPerfil(null, admin), false);
});
