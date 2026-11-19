const { test, describe } = require('node:test')
const assert = require('node:assert/strict')
const { conEstadoDePago, INCLUIR_PAGOS_PARA_RESUMEN } = require('../src/lib/pagos/resumenReserva')

const reservaBase = { id: 'r1', estado: 'PENDIENTE', comprobantePagoUrls: [] }

describe('conEstadoDePago (Mis Reservas)', () => {
    test('una reserva sin pagos no tiene el alquiler pagado', () => {
        const resultado = conEstadoDePago({ ...reservaBase, pagos: [] })
        assert.equal(resultado.alquilerPagado, false)
    })

    test('con un ALQUILER APROBADO, el alquiler está pagado', () => {
        const resultado = conEstadoDePago({ ...reservaBase, pagos: [{ concepto: 'ALQUILER', estado: 'APROBADO' }] })
        assert.equal(resultado.alquilerPagado, true)
    })

    test('un ALQUILER rechazado, vencido o pendiente no cuenta como pagado', () => {
        for (const estado of ['PENDIENTE', 'RECHAZADO', 'VENCIDO', 'DUPLICADO', 'REVERSADO']) {
            const resultado = conEstadoDePago({ ...reservaBase, pagos: [{ concepto: 'ALQUILER', estado }] })
            assert.equal(resultado.alquilerPagado, false, `estado ${estado}`)
        }
    })

    test('una GARANTIA aprobada no marca pagado el alquiler', () => {
        const resultado = conEstadoDePago({ ...reservaBase, pagos: [{ concepto: 'GARANTIA', estado: 'APROBADO' }] })
        assert.equal(resultado.alquilerPagado, false)
    })

    test('si no se cargaron los pagos (undefined), no está pagado y no falla', () => {
        assert.equal(conEstadoDePago({ ...reservaBase }).alquilerPagado, false)
    })

    test('no devuelve la lista de pagos ni cambia los demás campos', () => {
        const resultado = conEstadoDePago({ ...reservaBase, pagos: [{ concepto: 'ALQUILER', estado: 'APROBADO' }] })
        assert.equal('pagos' in resultado, false)
        assert.deepEqual({ ...resultado, alquilerPagado: undefined }, { ...reservaBase, alquilerPagado: undefined })
    })

    test('la consulta trae solo lo necesario: concepto y estado del pago', () => {
        assert.deepEqual(INCLUIR_PAGOS_PARA_RESUMEN, { pagos: { select: { concepto: true, estado: true } } })
    })
})
