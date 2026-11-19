const { test, describe, mock } = require('node:test')
const assert = require('node:assert/strict')
const {
    debeVencerReserva,
    MOTIVO_VENCIMIENTO,
    iniciarVencimientoPeriodico
} = require('../src/lib/pagos/vencimientoReservas')

const CREADA = new Date('2026-11-18T20:00:00Z')
const minutosDespues = (m) => new Date(CREADA.getTime() + m * 60000)
const esEnLinea = (pago) => pago.proveedor !== 'TRANSFERENCIA_MANUAL'
const enLinea = (estado) => ({ concepto: 'ALQUILER', estado, proveedor: 'SIMULADO' })
const manual = (estado) => ({ concepto: 'ALQUILER', estado, proveedor: 'TRANSFERENCIA_MANUAL' })

function vence({ estado = 'PENDIENTE', comprobantePagoUrls = [], pagos = [enLinea('PENDIENTE')], minuto = 16 } = {}) {
    return debeVencerReserva({
        reserva: { estado, creadoEn: CREADA, comprobantePagoUrls },
        pagos,
        esEnLinea,
        ahora: minutosDespues(minuto)
    })
}

describe('debeVencerReserva (decisiones 2 y 3, Bloque E2)', () => {
    test('PENDIENTE, pago en línea PENDIENTE, sin aprobado y pasados 15 min: vence', () => {
        assert.equal(vence(), true)
    })
    test('justo a los 15 minutos ya vence (el plazo es creadoEn + 15 min)', () => {
        assert.equal(vence({ minuto: 15 }), true)
    })
    test('a los 14 minutos todavía no vence', () => {
        assert.equal(vence({ minuto: 14 }), false)
    })
    test('una reserva sin pagos no se toca (camino del comprobante)', () => {
        assert.equal(vence({ pagos: [] }), false)
        assert.equal(vence({ pagos: [], comprobantePagoUrls: ['c.jpg'] }), false)
    })
    test('con comprobante no vence aunque tenga un pago en línea abandonado', () => {
        assert.equal(vence({ comprobantePagoUrls: ['c.jpg'] }), false)
    })
    test('con un pago APROBADO no vence aunque haya otro PENDIENTE', () => {
        assert.equal(vence({ pagos: [enLinea('PENDIENTE'), enLinea('APROBADO')] }), false)
    })
    test('sin pago en línea PENDIENTE no vence (solo rechazados o vencidos)', () => {
        assert.equal(vence({ pagos: [enLinea('RECHAZADO')] }), false)
        assert.equal(vence({ pagos: [enLinea('VENCIDO')] }), false)
    })
    test('una transferencia PENDIENTE aparta el turno aunque haya un pago en línea abandonado', () => {
        assert.equal(vence({ pagos: [enLinea('PENDIENTE'), manual('PENDIENTE')] }), false)
    })
    test('una transferencia manual PENDIENTE no vence nunca', () => {
        assert.equal(vence({ pagos: [manual('PENDIENTE')] }), false)
    })
    test('una reserva que ya no está PENDIENTE no se toca', () => {
        assert.equal(vence({ estado: 'APROBADA' }), false)
        assert.equal(vence({ estado: 'RECHAZADA' }), false)
    })
    test('el motivo es el texto fijo de la decisión 3', () => {
        assert.equal(MOTIVO_VENCIMIENTO,
            'No se completó el pago en línea dentro de 15 minutos. El turno quedó libre; puedes hacer una nueva reserva.')
    })
})

describe('iniciarVencimientoPeriodico', () => {
    function programadorFalso() {
        const llamadas = []
        const temporizador = { unref: mock.fn() }
        const programar = (funcion, ms) => { llamadas.push({ funcion, ms }); return temporizador }
        return { llamadas, temporizador, programar }
    }

    test('en NODE_ENV=test no programa nada', () => {
        const { llamadas, programar } = programadorFalso()
        const resultado = iniciarVencimientoPeriodico({ tarea: async () => 0, env: { NODE_ENV: 'test' }, programar })
        assert.equal(resultado, null)
        assert.equal(llamadas.length, 0)
    })

    test('programa cada 60 000 ms y llama a unref para no impedir que el proceso termine', () => {
        const { llamadas, temporizador, programar } = programadorFalso()
        iniciarVencimientoPeriodico({ tarea: async () => 0, env: {}, programar })
        assert.equal(llamadas.length, 1)
        assert.equal(llamadas[0].ms, 60000)
        assert.equal(temporizador.unref.mock.callCount(), 1)
    })

    test('un error de la tarea se registra y no rompe el intervalo', async () => {
        const { llamadas, programar } = programadorFalso()
        const registrarError = mock.fn()
        iniciarVencimientoPeriodico({ tarea: async () => { throw new Error('base caída') }, env: {}, programar, registrarError })
        await llamadas[0].funcion()
        assert.equal(registrarError.mock.callCount(), 1)
    })

    test('si una vuelta sigue corriendo, la siguiente no empieza otra encima', async () => {
        const { llamadas, programar } = programadorFalso()
        let terminar
        const tarea = mock.fn(() => new Promise(resolve => { terminar = resolve }))
        iniciarVencimientoPeriodico({ tarea, env: {}, programar })
        const primera = llamadas[0].funcion()
        await llamadas[0].funcion()
        assert.equal(tarea.mock.callCount(), 1)
        terminar(0)
        await primera
        llamadas[0].funcion()
        assert.equal(tarea.mock.callCount(), 2)
    })
})
