const { test } = require('node:test');
const assert = require('node:assert/strict');
const {
    validarPedidoPago,
    validarPedidoConfirmacion,
    armarUrlRetorno,
    venceEnPagoReserva,
    pagoParaUsuario,
    validarPedidoTransferencia,
    validarDecisionManual,
    MAX_ARCHIVOS_EVIDENCIA
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

// ---------- Bloque E2 (c): transferencia manual ----------

const archivo = (mimetype = 'image/jpeg') => ({ buffer: Buffer.from('x'), mimetype, originalname: 'comprobante.jpg' });

test('transferencia válida: devuelve reservaId, concepto ALQUILER y los archivos', () => {
    const archivos = [archivo(), archivo('application/pdf')];
    const r = validarPedidoTransferencia({ reservaId: 'r1', concepto: 'ALQUILER', montoCentavos: 1 }, archivos);
    assert.deepEqual(r, { datos: { reservaId: 'r1', concepto: 'ALQUILER', archivos } });
});

test('transferencia sin reserva, con otro concepto o sin archivos se rechaza', () => {
    assert.match(validarPedidoTransferencia({ concepto: 'ALQUILER' }, [archivo()]).error, /reserva/);
    assert.match(validarPedidoTransferencia({ reservaId: 'r1', concepto: 'GARANTIA' }, [archivo()]).error, /alquiler/);
    assert.match(validarPedidoTransferencia({ reservaId: 'r1', concepto: 'ALQUILER' }, []).error, /comprobante/);
    assert.match(validarPedidoTransferencia({ reservaId: 'r1', concepto: 'ALQUILER' }, undefined).error, /comprobante/);
});

test(`transferencia con más de ${MAX_ARCHIVOS_EVIDENCIA} archivos se rechaza`, () => {
    const muchos = Array.from({ length: MAX_ARCHIVOS_EVIDENCIA + 1 }, () => archivo());
    assert.match(validarPedidoTransferencia({ reservaId: 'r1', concepto: 'ALQUILER' }, muchos).error, /máximo/);
});

test('decisión del admin: APROBAR, con aprobarReserva opcional', () => {
    assert.deepEqual(validarDecisionManual({ decision: 'APROBAR' }), { datos: { decision: 'APROBAR', motivo: undefined, aprobarReserva: false } });
    assert.deepEqual(validarDecisionManual({ decision: 'APROBAR', aprobarReserva: true }).datos.aprobarReserva, true);
});

test('decisión del admin: RECHAZAR exige motivo y lo limpia', () => {
    assert.match(validarDecisionManual({ decision: 'RECHAZAR' }).error, /motivo/);
    assert.match(validarDecisionManual({ decision: 'RECHAZAR', motivo: '   ' }).error, /motivo/);
    assert.deepEqual(validarDecisionManual({ decision: 'RECHAZAR', motivo: '  monto incorrecto ' }).datos,
        { decision: 'RECHAZAR', motivo: 'monto incorrecto', aprobarReserva: false });
});

test('decisión del admin: otra decisión o aprobarReserva al rechazar se rechazan', () => {
    assert.match(validarDecisionManual({ decision: 'TAL_VEZ' }).error, /APROBAR o RECHAZAR/);
    assert.match(validarDecisionManual({ decision: 'RECHAZAR', motivo: 'x', aprobarReserva: true }).error, /solo al aprobar/);
    assert.match(validarDecisionManual({ decision: 'APROBAR', aprobarReserva: 'si' }).error, /true o false/);
});
