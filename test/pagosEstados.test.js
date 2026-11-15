const { test, describe } = require('node:test')
const assert = require('node:assert/strict')
const { siguienteEstado, ESTADOS_PAGO } = require('../src/lib/pagos/estadosPago')

const disponible = { referenciaDisponible: true }
const noDisponible = { referenciaDisponible: false }

describe('desde PENDIENTE (prueba 5)', () => {
    test('APROBADO → APROBADO, y cambia', () => {
        assert.deepEqual(siguienteEstado('PENDIENTE', 'APROBADO', disponible), { estado: 'APROBADO', cambia: true })
    })
    test('RECHAZADO → RECHAZADO', () => {
        assert.deepEqual(siguienteEstado('PENDIENTE', 'RECHAZADO'), { estado: 'RECHAZADO', cambia: true })
    })
    test('PENDIENTE (todavía no se sabe) → sin cambio', () => {
        assert.deepEqual(siguienteEstado('PENDIENTE', 'PENDIENTE'), { estado: 'PENDIENTE', cambia: false })
    })
    test('VENCER → VENCIDO', () => {
        assert.deepEqual(siguienteEstado('PENDIENTE', 'VENCER'), { estado: 'VENCIDO', cambia: true })
    })
    test('APROBADO cuando lo pagado ya no está disponible → DUPLICADO', () => {
        assert.deepEqual(siguienteEstado('PENDIENTE', 'APROBADO', noDisponible), { estado: 'DUPLICADO', cambia: true })
    })
})

describe('aprobación tardía desde VENCIDO (prueba 6)', () => {
    test('con la referencia disponible → APROBADO', () => {
        assert.deepEqual(siguienteEstado('VENCIDO', 'APROBADO', disponible), { estado: 'APROBADO', cambia: true })
    })
    test('sin la referencia disponible → DUPLICADO (hay que devolver el dinero)', () => {
        assert.deepEqual(siguienteEstado('VENCIDO', 'APROBADO', noDisponible), { estado: 'DUPLICADO', cambia: true })
    })
    test('RECHAZADO o PENDIENTE sobre un vencido no lo cambia', () => {
        assert.equal(siguienteEstado('VENCIDO', 'RECHAZADO').cambia, false)
        assert.equal(siguienteEstado('VENCIDO', 'PENDIENTE').cambia, false)
    })
    test('al aprobar, el contexto es obligatorio: no se adivina si la referencia está disponible', () => {
        assert.throws(() => siguienteEstado('PENDIENTE', 'APROBADO'), /referenciaDisponible/)
        assert.throws(() => siguienteEstado('VENCIDO', 'APROBADO', {}), /referenciaDisponible/)
    })
})

describe('idempotencia (prueba 7)', () => {
    for (const resultado of ['APROBADO', 'RECHAZADO', 'PENDIENTE']) {
        test(`APROBADO + ${resultado} → sin cambio`, () => {
            assert.deepEqual(siguienteEstado('APROBADO', resultado, disponible), { estado: 'APROBADO', cambia: false })
        })
    }
    test('DUPLICADO y REVERSADO tampoco cambian con un resultado del proveedor', () => {
        assert.equal(siguienteEstado('DUPLICADO', 'APROBADO', disponible).cambia, false)
        assert.equal(siguienteEstado('REVERSADO', 'APROBADO', disponible).cambia, false)
    })
    test('APROBADO o DUPLICADO + REVERSADO → REVERSADO', () => {
        assert.deepEqual(siguienteEstado('APROBADO', 'REVERSADO'), { estado: 'REVERSADO', cambia: true })
        assert.deepEqual(siguienteEstado('DUPLICADO', 'REVERSADO'), { estado: 'REVERSADO', cambia: true })
    })
})

describe('transiciones fuera de la tabla (prueba 8)', () => {
    test('RECHAZADO + APROBADO → error (un pago rechazado no se reabre solo)', () => {
        assert.throws(() => siguienteEstado('RECHAZADO', 'APROBADO', disponible), /Transición no permitida: RECHAZADO \+ APROBADO/)
    })
    test('otras transiciones no previstas → error', () => {
        assert.throws(() => siguienteEstado('APROBADO', 'VENCER'), /Transición no permitida/)
        assert.throws(() => siguienteEstado('PENDIENTE', 'REVERSADO'), /Transición no permitida/)
        assert.throws(() => siguienteEstado('INVENTADO', 'APROBADO', disponible), /Transición no permitida/)
        assert.throws(() => siguienteEstado('PENDIENTE', 'INVENTADO'), /Transición no permitida/)
    })
    test('los seis estados del diseño', () => {
        assert.deepEqual(ESTADOS_PAGO, ['PENDIENTE', 'APROBADO', 'RECHAZADO', 'VENCIDO', 'DUPLICADO', 'REVERSADO'])
    })
})
