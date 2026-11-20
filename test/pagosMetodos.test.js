const { test } = require('node:test')
const assert = require('node:assert/strict')
const { crearRegistroProveedores } = require('../src/lib/pagos/registroProveedores')
const { describirMetodosDePago } = require('../src/lib/pagos/metodosDisponibles')

test('sin proveedor en línea solo ofrece la transferencia', () => {
    const metodos = describirMetodosDePago(crearRegistroProveedores({ NODE_ENV: 'production' }))
    assert.equal(metodos.enLinea.disponible, false)
    assert.equal(metodos.enLinea.proveedor, null)
    assert.equal(metodos.transferencia.disponible, true)
    assert.equal(metodos.transferencia.proveedor, 'TRANSFERENCIA_MANUAL')
})

test('con el simulado activo lo informa y marca que es una simulación', () => {
    const metodos = describirMetodosDePago(crearRegistroProveedores({ PAGOS_PROVEEDOR_EN_LINEA: 'SIMULADO' }))
    assert.equal(metodos.enLinea.disponible, true)
    assert.equal(metodos.enLinea.proveedor, 'SIMULADO')
    assert.equal(metodos.enLinea.esSimulacion, true)
    assert.equal(metodos.enLinea.vigenciaMinutos, 15)
})

test('solo expone datos públicos, nunca funciones del proveedor', () => {
    const metodos = describirMetodosDePago(crearRegistroProveedores({ PAGOS_PROVEEDOR_EN_LINEA: 'SIMULADO' }))
    assert.deepEqual(Object.keys(metodos).sort(), ['enLinea', 'transferencia'])
    assert.deepEqual(Object.keys(metodos.enLinea).sort(), ['disponible', 'esSimulacion', 'proveedor', 'vigenciaMinutos'])
    assert.deepEqual(Object.keys(metodos.transferencia).sort(), ['disponible', 'proveedor'])
})
