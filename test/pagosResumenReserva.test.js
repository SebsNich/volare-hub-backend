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
        const { alquilerPagado, transferenciaEnRevision, ...demas } = resultado
        assert.deepEqual(demas, reservaBase)
    })

    test('la consulta trae solo lo necesario: concepto, estado y proveedor del pago', () => {
        assert.deepEqual(INCLUIR_PAGOS_PARA_RESUMEN, { pagos: { select: { concepto: true, estado: true, proveedor: true } } })
    })

    test('transferenciaEnRevision: true con una transferencia de ALQUILER PENDIENTE', () => {
        const r = conEstadoDePago({ ...reservaBase, pagos: [{ concepto: 'ALQUILER', estado: 'PENDIENTE', proveedor: 'TRANSFERENCIA_MANUAL' }] })
        assert.equal(r.transferenciaEnRevision, true)
        assert.equal(r.alquilerPagado, false)
    })

    test('transferenciaEnRevision: false con un pago en línea pendiente, una transferencia decidida o sin pagos', () => {
        const con = (pagos) => conEstadoDePago({ ...reservaBase, pagos }).transferenciaEnRevision
        assert.equal(con([{ concepto: 'ALQUILER', estado: 'PENDIENTE', proveedor: 'SIMULADO' }]), false)
        assert.equal(con([{ concepto: 'ALQUILER', estado: 'RECHAZADO', proveedor: 'TRANSFERENCIA_MANUAL' }]), false)
        assert.equal(con([{ concepto: 'ALQUILER', estado: 'APROBADO', proveedor: 'TRANSFERENCIA_MANUAL' }]), false)
        assert.equal(con([]), false)
        assert.equal(con(undefined), false)
    })
})
