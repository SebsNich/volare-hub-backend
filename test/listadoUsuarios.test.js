const { test } = require('node:test');
const assert = require('node:assert/strict');
const { construirFiltroUsuarios } = require('../src/lib/listadoUsuarios');

test('sin filtros devuelve un where vacío', () => {
    assert.deepEqual(construirFiltroUsuarios({}), {});
});

test('ACTIVO e INACTIVO siguen filtrando por activo', () => {
    assert.deepEqual(construirFiltroUsuarios({ estado: 'ACTIVO' }), { AND: [{ activo: true }] });
    assert.deepEqual(construirFiltroUsuarios({ estado: 'INACTIVO' }), { AND: [{ activo: false }] });
});

test('PENDIENTE y RECHAZADA filtran por estadoCuenta', () => {
    assert.deepEqual(construirFiltroUsuarios({ estado: 'PENDIENTE' }), { AND: [{ estadoCuenta: 'PENDIENTE' }] });
    assert.deepEqual(construirFiltroUsuarios({ estado: 'RECHAZADA' }), { AND: [{ estadoCuenta: 'RECHAZADA' }] });
});

test('un estado desconocido se ignora en vez de filtrar por él', () => {
    assert.deepEqual(construirFiltroUsuarios({ estado: 'APROBADA_O_LO_QUE_SEA' }), {});
});

test('combina búsqueda, manzana/villa y estado', () => {
    const where = construirFiltroUsuarios({ busqueda: 'ana', manzanaVilla: '09', estado: 'RECHAZADA' });
    assert.equal(where.AND.length, 3);
    assert.deepEqual(where.AND[0], {
        OR: [
            { nombres: { contains: 'ana', mode: 'insensitive' } },
            { apellidos: { contains: 'ana', mode: 'insensitive' } }
        ]
    });
    assert.deepEqual(where.AND[1], {
        OR: [
            { manzana: { contains: '09', mode: 'insensitive' } },
            { villa: { contains: '09', mode: 'insensitive' } }
        ]
    });
    assert.deepEqual(where.AND[2], { estadoCuenta: 'RECHAZADA' });
});
