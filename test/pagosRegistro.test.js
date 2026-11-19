const { test } = require('node:test');
const assert = require('node:assert/strict');
const { crearRegistroProveedores } = require('../src/lib/pagos/registroProveedores');

test('sin PAGOS_PROVEEDOR_EN_LINEA solo está la transferencia manual', () => {
    const registro = crearRegistroProveedores({});
    assert.deepEqual(registro.codigos(), ['TRANSFERENCIA_MANUAL']);
    assert.equal(registro.codigoEnLinea, null);
    assert.equal(registro.obtener('SIMULADO'), null);
});

test('una variable vacía o con espacios cuenta como sin proveedor en línea', () => {
    assert.equal(crearRegistroProveedores({ PAGOS_PROVEEDOR_EN_LINEA: '  ' }).codigoEnLinea, null);
});

test('con SIMULADO en desarrollo se registra el simulado', () => {
    const registro = crearRegistroProveedores({ PAGOS_PROVEEDOR_EN_LINEA: 'SIMULADO', NODE_ENV: 'development' });
    assert.equal(registro.codigoEnLinea, 'SIMULADO');
    assert.equal(registro.obtener('SIMULADO').codigo, 'SIMULADO');
    assert.equal(registro.obtener('TRANSFERENCIA_MANUAL').codigo, 'TRANSFERENCIA_MANUAL');
});

test('SIMULADO en producción impide arrancar', () => {
    assert.throws(
        () => crearRegistroProveedores({ PAGOS_PROVEEDOR_EN_LINEA: 'SIMULADO', NODE_ENV: 'production' }),
        /no está disponible en producción/
    );
});

test('un proveedor desconocido impide arrancar y el error nombra la variable', () => {
    assert.throws(
        () => crearRegistroProveedores({ PAGOS_PROVEEDOR_EN_LINEA: 'OTRO' }),
        /PAGOS_PROVEEDOR_EN_LINEA/
    );
});

test('el registro devuelve siempre la misma instancia del proveedor', () => {
    // El simulado guarda sus cobros en memoria: si cada pedido creara uno nuevo,
    // confirmar no encontraría el cobro que se creó antes.
    const registro = crearRegistroProveedores({ PAGOS_PROVEEDOR_EN_LINEA: 'SIMULADO' });
    assert.equal(registro.obtener('SIMULADO'), registro.obtener('SIMULADO'));
});

test('se puede inyectar un simulado con guion para las pruebas', () => {
    const { crearProveedorSimulado } = require('../src/lib/pagos/proveedores/simulado');
    const simulado = crearProveedorSimulado({ guion: { p1: 'RECHAZADO' } });
    const registro = crearRegistroProveedores({ PAGOS_PROVEEDOR_EN_LINEA: 'SIMULADO' }, { simulado });
    assert.equal(registro.obtener('SIMULADO'), simulado);
});

test('esPagoEnLinea: el simulado es en línea y la transferencia manual no', () => {
    const registro = crearRegistroProveedores({ PAGOS_PROVEEDOR_EN_LINEA: 'SIMULADO' });
    assert.equal(registro.esPagoEnLinea({ proveedor: 'SIMULADO' }), true);
    assert.equal(registro.esPagoEnLinea({ proveedor: 'TRANSFERENCIA_MANUAL' }), false);
});

test('esPagoEnLinea: un proveedor que este servidor no conoce cuenta como en línea', () => {
    // Ejemplo: un pago SIMULADO hecho en desarrollo, leído con el registro sin simulado.
    const registro = crearRegistroProveedores({});
    assert.equal(registro.esPagoEnLinea({ proveedor: 'SIMULADO' }), true);
});
