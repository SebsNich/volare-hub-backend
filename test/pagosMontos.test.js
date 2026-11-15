const { test, describe } = require('node:test')
const assert = require('node:assert/strict')
const { dolaresACentavos, esCentavosValido } = require('../src/lib/pagos/montos')

// Imita al Decimal de Prisma: lo único que usamos de él es su texto exacto.
const decimalFalso = (texto) => ({ toString: () => texto })

describe('dolaresACentavos (prueba 3)', () => {
    test('números y textos con hasta 2 decimales', () => {
        assert.equal(dolaresACentavos(15), 1500)
        assert.equal(dolaresACentavos('80.10'), 8010)
        assert.equal(dolaresACentavos('80.1'), 8010)
        assert.equal(dolaresACentavos('0.05'), 5)
        assert.equal(dolaresACentavos(200), 20000)
    })

    test('un Decimal de Prisma se convierte por su texto, sin pasar por coma flotante', () => {
        assert.equal(dolaresACentavos(decimalFalso('120')), 12000)
        assert.equal(dolaresACentavos(decimalFalso('19.99')), 1999)
    })
})

describe('valores rechazados (prueba 4)', () => {
    for (const [nombre, valor] of [
        ['negativo', -5], ['cero', 0], ['cero con decimales', '0.00'], ['NaN', NaN],
        ['más de 2 decimales', '1.234'], ['texto', 'quince'], ['vacío', ''], ['null', null],
        ['resultado de coma flotante', 0.1 + 0.2], ['infinito', Infinity]
    ]) {
        test(nombre, () => {
            assert.throws(() => dolaresACentavos(valor), /Monto inválido/)
        })
    }
})

describe('esCentavosValido', () => {
    test('solo enteros positivos seguros', () => {
        assert.equal(esCentavosValido(1500), true)
        assert.equal(esCentavosValido(0), false)
        assert.equal(esCentavosValido(-1), false)
        assert.equal(esCentavosValido(15.5), false)
        assert.equal(esCentavosValido('1500'), false)
        assert.equal(esCentavosValido(Number.MAX_SAFE_INTEGER + 1), false)
    })
})
