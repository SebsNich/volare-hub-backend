const { test, describe } = require('node:test')
const assert = require('node:assert/strict')
const { calcularMontosCentavos, tablaTarifas } = require('../src/lib/tarifas')
const { calcularMontos } = require('../src/lib/reservas.helpers')

// Precios vigentes antes del cambio (en dólares), copiados de calcularMontos.
// Si alguien cambia una tarifa sin querer, la prueba 2 lo detecta.
const PRECIOS_ANTERIORES = [
    ['CABANA_ARBOL', 'CABANA_COMPLETO', false, 15, 25],
    ['CABANA_MEDIO', 'CABANA_COMPLETO', true, 15, 25],
    ['CABANA_RIO', 'CABANA_COMPLETO', false, 15, 25],
    ['CASA_CLUB', 'CASA_CLUB_MATUTINO', false, 80, 80],
    ['CASA_CLUB', 'CASA_CLUB_VESPERTINO', true, 120, 120],
    ['CASA_CLUB', 'CASA_CLUB_NOCTURNO', false, 100, 100],
    ['CASA_CLUB', 'CASA_CLUB_NOCTURNO', true, 200, 200]
]

describe('calcularMontosCentavos (prueba 1)', () => {
    test('cabaña: 1500 de alquiler y 2500 de garantía, sea o no para un tercero', () => {
        assert.deepEqual(calcularMontosCentavos('CABANA_ARBOL', 'CABANA_COMPLETO', false), { alquilerCentavos: 1500, garantiaCentavos: 2500 })
        assert.deepEqual(calcularMontosCentavos('CABANA_RIO', 'CABANA_COMPLETO', true), { alquilerCentavos: 1500, garantiaCentavos: 2500 })
    })

    test('Casa Club nocturno: 10000 y 10000, o 20000 y 20000 para un tercero', () => {
        assert.deepEqual(calcularMontosCentavos('CASA_CLUB', 'CASA_CLUB_NOCTURNO', false), { alquilerCentavos: 10000, garantiaCentavos: 10000 })
        assert.deepEqual(calcularMontosCentavos('CASA_CLUB', 'CASA_CLUB_NOCTURNO', true), { alquilerCentavos: 20000, garantiaCentavos: 20000 })
    })

    test('Casa Club diurno (matutino o vespertino): 8000 y 8000, o 12000 y 12000 para un tercero', () => {
        assert.deepEqual(calcularMontosCentavos('CASA_CLUB', 'CASA_CLUB_MATUTINO', false), { alquilerCentavos: 8000, garantiaCentavos: 8000 })
        assert.deepEqual(calcularMontosCentavos('CASA_CLUB', 'CASA_CLUB_VESPERTINO', true), { alquilerCentavos: 12000, garantiaCentavos: 12000 })
    })

    test('los montos son enteros', () => {
        for (const [espacio, horario, tercero] of PRECIOS_ANTERIORES) {
            const { alquilerCentavos, garantiaCentavos } = calcularMontosCentavos(espacio, horario, tercero)
            assert.ok(Number.isInteger(alquilerCentavos) && Number.isInteger(garantiaCentavos))
        }
    })
})

describe('mismos precios que antes (prueba 2)', () => {
    test('calcularMontos (dólares) sigue dando los precios anteriores', () => {
        for (const [espacio, horario, tercero, alquiler, garantia] of PRECIOS_ANTERIORES) {
            assert.deepEqual(
                calcularMontos(espacio, horario, tercero),
                { montoAlquiler: alquiler, montoGarantia: garantia },
                `${espacio} ${horario} tercero=${tercero}`
            )
        }
    })

    test('centavos = dólares × 100 en todos los casos', () => {
        for (const [espacio, horario, tercero, alquiler, garantia] of PRECIOS_ANTERIORES) {
            assert.deepEqual(
                calcularMontosCentavos(espacio, horario, tercero),
                { alquilerCentavos: alquiler * 100, garantiaCentavos: garantia * 100 }
            )
        }
    })
})

describe('tablaTarifas (lo que devuelve GET /api/reservas/tarifas)', () => {
    test('trae cada espacio con sus horarios válidos, para residente y para tercero', () => {
        const tabla = tablaTarifas()
        assert.deepEqual(Object.keys(tabla).sort(), ['CABANA_ARBOL', 'CABANA_MEDIO', 'CABANA_RIO', 'CASA_CLUB'])
        assert.deepEqual(Object.keys(tabla.CABANA_ARBOL), ['CABANA_COMPLETO'])
        assert.deepEqual(Object.keys(tabla.CASA_CLUB).sort(), ['CASA_CLUB_MATUTINO', 'CASA_CLUB_NOCTURNO', 'CASA_CLUB_VESPERTINO'])
        assert.deepEqual(tabla.CASA_CLUB.CASA_CLUB_NOCTURNO, {
            residente: { alquilerCentavos: 10000, garantiaCentavos: 10000 },
            tercero: { alquilerCentavos: 20000, garantiaCentavos: 20000 }
        })
    })

    test('coincide con calcularMontosCentavos en cada celda', () => {
        const tabla = tablaTarifas()
        for (const [espacio, horarios] of Object.entries(tabla)) {
            for (const [horario, celda] of Object.entries(horarios)) {
                assert.deepEqual(celda.residente, calcularMontosCentavos(espacio, horario, false))
                assert.deepEqual(celda.tercero, calcularMontosCentavos(espacio, horario, true))
            }
        }
    })
})

describe('datos inválidos', () => {
    test('un espacio u horario desconocido lanza error en vez de inventar un precio', () => {
        assert.throws(() => calcularMontosCentavos('PISCINA', 'CABANA_COMPLETO', false), /Espacio u horario sin tarifa/)
        assert.throws(() => calcularMontosCentavos('CASA_CLUB', 'CABANA_COMPLETO', false), /Espacio u horario sin tarifa/)
    })
})
