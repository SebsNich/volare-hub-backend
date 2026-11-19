// Libera el turno de una reserva cuyo pago en línea no se completó a tiempo
// (decisiones 2 y 3). La reserva pasa a RECHAZADA con un motivo automático y
// sus pagos en línea abiertos a VENCIDO. Las reservas sin pagos (camino del
// comprobante) y las transferencias no vencen nunca.
const { MINUTOS_PAGO_EN_LINEA } = require('./reglasPago')
const { siguienteEstado } = require('./estadosPago')
const { ejecutarConReintentos } = require('../reintentos')
const { esConflictoDeTransaccion } = require('../registro.helpers')

const MOTIVO_VENCIMIENTO = 'No se completó el pago en línea dentro de 15 minutos. ' +
    'El turno quedó libre; puedes hacer una nueva reserva.'
const INTERVALO_MS = 60 * 1000
const PLAZO_MS = MINUTOS_PAGO_EN_LINEA * 60 * 1000

const SELECCION_PAGOS = { select: { id: true, concepto: true, estado: true, proveedor: true } }

// Pura. Vence solo si se cumplen todas: sigue PENDIENTE, no tiene comprobante,
// no tiene ningún pago APROBADO, le queda un pago en línea PENDIENTE y ya
// pasaron 15 minutos desde que se creó la reserva.
function debeVencerReserva({ reserva, pagos = [], esEnLinea, ahora }) {
    if (reserva?.estado !== 'PENDIENTE') return false
    if ((reserva.comprobantePagoUrls ?? []).length > 0) return false
    if (pagos.some(pago => pago.estado === 'APROBADO')) return false
    if (!pagos.some(pago => pago.estado === 'PENDIENTE' && esEnLinea(pago))) return false
    return ahora.getTime() >= new Date(reserva.creadoEn).getTime() + PLAZO_MS
}

function crearVencimientoReservas({ prisma, esEnLinea, ahora = () => new Date() }) {

    const enTransaccion = (operacion) => ejecutarConReintentos(
        () => prisma.$transaction(operacion, { isolationLevel: 'Serializable' }),
        { debeReintentar: esConflictoDeTransaccion }
    )

    // Dentro de la transacción se vuelve a leer y a evaluar: si el admin la
    // aprobó o el pago se aprobó desde la búsqueda, ya no se toca.
    function vencerUna(reservaId, momento) {
        return enTransaccion(async (tx) => {
            const reserva = await tx.reserva.findUnique({ where: { id: reservaId }, include: { pagos: SELECCION_PAGOS } })
            if (!debeVencerReserva({ reserva, pagos: reserva?.pagos, esEnLinea, ahora: momento })) return false

            // Condicional: si otra ejecución ya la cambió, count es 0 y no se repite nada.
            const { count } = await tx.reserva.updateMany({
                where: { id: reservaId, estado: 'PENDIENTE' },
                data: { estado: 'RECHAZADA', motivoRechazo: MOTIVO_VENCIMIENTO, notificacionPendiente: true }
            })
            if (count === 0) return false

            const abiertos = reserva.pagos.filter(pago => pago.estado === 'PENDIENTE' && esEnLinea(pago))
            await tx.pago.updateMany({
                where: { id: { in: abiertos.map(pago => pago.id) }, estado: 'PENDIENTE' },
                data: { estado: siguienteEstado('PENDIENTE', 'VENCER').estado, resueltoEn: momento }
            })
            return true
        })
    }

    // Devuelve cuántas reservas venció. La búsqueda es amplia y barata; la
    // decisión final la toma debeVencerReserva dentro de cada transacción.
    async function vencerReservasSinPago() {
        const momento = ahora()
        const candidatas = await prisma.reserva.findMany({
            where: {
                estado: 'PENDIENTE',
                creadoEn: { lte: new Date(momento.getTime() - PLAZO_MS) },
                pagos: { some: { estado: 'PENDIENTE' } }
            },
            select: { id: true }
        })
        let vencidas = 0
        for (const { id } of candidatas) {
            if (await vencerUna(id, momento)) vencidas += 1
        }
        return vencidas
    }

    return { vencerReservasSinPago }
}

// Corre la tarea cada minuto. No arranca en pruebas, unref() deja que el
// proceso termine aunque el intervalo siga programado y, si una vuelta tarda
// más de un minuto, la siguiente se salta en vez de correr encima.
function iniciarVencimientoPeriodico({ tarea, env = process.env, programar = setInterval, registrarError = console.error }) {
    if (env.NODE_ENV === 'test') return null
    let corriendo = false
    const vuelta = async () => {
        if (corriendo) return
        corriendo = true
        try {
            await tarea()
        } catch (error) {
            registrarError('Error al vencer reservas sin pago:', error)
        } finally {
            corriendo = false
        }
    }
    const temporizador = programar(vuelta, INTERVALO_MS)
    temporizador.unref?.()
    return temporizador
}

module.exports = { MOTIVO_VENCIMIENTO, debeVencerReserva, crearVencimientoReservas, iniciarVencimientoPeriodico }
