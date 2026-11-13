const { test } = require('node:test');
const assert = require('node:assert/strict');
const { FILTRO_RESIDENTES_ACTIVOS, FILTRO_SOLICITUDES_PENDIENTES } = require('../src/lib/resumenAdmin');

test('residentes activos: solo residentes aprobados y activos', () => {
    assert.deepEqual(FILTRO_RESIDENTES_ACTIVOS, { rol: 'RESIDENTE', activo: true, estadoCuenta: 'APROBADA' });
});

test('solicitudes pendientes: las cuentas que esperan decisión', () => {
    assert.deepEqual(FILTRO_SOLICITUDES_PENDIENTES, { estadoCuenta: 'PENDIENTE' });
});

test('los filtros no se pueden modificar por accidente', () => {
    assert.ok(Object.isFrozen(FILTRO_RESIDENTES_ACTIVOS));
    assert.ok(Object.isFrozen(FILTRO_SOLICITUDES_PENDIENTES));
});
