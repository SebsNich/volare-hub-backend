const { test, describe } = require('node:test')
const assert = require('node:assert/strict')
const { esConflictoDeUnicidad, RESPUESTA_TURNO_OCUPADO } = require('../src/lib/reservas.helpers')

// Prueba 40 (parte de código). La parte de base, que el índice único rechace de verdad
// un segundo turno activo, se prueba después de aplicar la migración de RF-36 en volare_dev.
describe('esConflictoDeUnicidad (RF-36)', () => {
    test('P2002 es el código de Prisma cuando la base rechaza una fila por índice único', () => {
        assert.equal(esConflictoDeUnicidad({ code: 'P2002' }), true)
    })

    test('cualquier otro error no es un conflicto de turno', () => {
        assert.equal(esConflictoDeUnicidad({ code: 'P2025' }), false)
        assert.equal(esConflictoDeUnicidad(new Error('red caída')), false)
        assert.equal(esConflictoDeUnicidad(null), false)
        assert.equal(esConflictoDeUnicidad(undefined), false)
    })

    test('la respuesta es 409 con el mismo mensaje que la revisión previa', () => {
        assert.deepEqual(RESPUESTA_TURNO_OCUPADO, { status: 409, cuerpo: { error: 'Ese horario ya está reservado' } })
    })
})
