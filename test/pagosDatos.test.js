const { test } = require('node:test');
const assert = require('node:assert/strict');
const {
    validarPedidoPago,
    validarPedidoConfirmacion,
    armarUrlRetorno,
    venceEnPagoReserva,
    pagoParaUsuario
} = require('../src/lib/pagos/datosPago');

test('un pedido de pago válido devuelve solo reservaId, concepto y proveedor', () => {
    const r = validarPedidoPago({ reservaId: 'r1', concepto: 'ALQUILER', proveedor: 'SIMULADO', montoCentavos: 1 });
    assert.deepEqual(r, { datos: { reservaId: 'r1', concepto: 'ALQUILER', proveedor: 'SIMULADO' } });
});

test('el pedido de pago exige reservaId y proveedor', () => {
    assert.match(validarPedidoPago({ concepto: 'ALQUILER', proveedor: 'SIMULADO' }).error, /reserva/);
    assert.match(validarPedidoPago({ reservaId: 'r1', concepto: 'ALQUILER' }).error, /proveedor/);
    assert.ok(validarPedidoPago(undefined).error);
});

test('en este bloque solo se paga el ALQUILER', () => {
    assert.match(validarPedidoPago({ reservaId: 'r1', concepto: 'GARANTIA', proveedor: 'SIMULADO' }).error, /alquiler/i);
});

test('la confirmación acepta sin resultado o con APROBADO / RECHAZADO', () => {
    assert.deepEqual(validarPedidoConfirmacion({}), { datos: { resultado: undefined } });
    assert.deepEqual(validarPedidoConfirmacion({ resultado: 'RECHAZADO' }), { datos: { resultado: 'RECHAZADO' } });
    assert.ok(validarPedidoConfirmacion({ resultado: 'TARDIO' }).error);
    assert.deepEqual(validarPedidoConfirmacion(undefined), { datos: { resultado: undefined } });
});

test('la url de retorno apunta a la página del frontend con el id del pago', () => {
    assert.equal(armarUrlRetorno('http://localhost:5173', 'abc'), 'http://localhost:5173/pagos/retorno?pago=abc');
    assert.equal(armarUrlRetorno('http://localhost:5173/', 'abc'), 'http://localhost:5173/pagos/retorno?pago=abc');
});

test('sin FRONTEND_URL no se puede armar la url de retorno', () => {
    assert.throws(() => armarUrlRetorno(undefined, 'abc'), /FRONTEND_URL/);
});

test('un pago en línea vence 15 minutos después de crear la reserva', () => {
    const reserva = { creadoEn: new Date('2026-11-20T10:00:00Z') };
    const vence = venceEnPagoReserva(reserva, { vigenciaMinutos: 15 });
    assert.equal(vence.toISOString(), '2026-11-20T10:15:00.000Z');
});

test('un pago sin vigencia (manual) no vence', () => {
    assert.equal(venceEnPagoReserva({ creadoEn: new Date() }, { vigenciaMinutos: null }), null);
});

test('al residente no le llega la respuesta del proveedor; al admin sí', () => {
    const pago = { id: 'p1', estado: 'APROBADO', respuestaProveedor: { x: 1 } };
    assert.equal('respuestaProveedor' in pagoParaUsuario(pago, { rol: 'RESIDENTE' }), false);
    assert.deepEqual(pagoParaUsuario(pago, { rol: 'ADMIN' }).respuestaProveedor, { x: 1 });
});
