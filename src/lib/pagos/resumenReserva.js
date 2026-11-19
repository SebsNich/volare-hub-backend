// Resumen del pago de una reserva para las listas. El servidor decide si el
// alquiler está pagado; el frontend solo muestra "Pagar" o "Pagado" según esto.

// Se traen solo concepto y estado: montos y respuestas del proveedor no hacen
// falta en una lista y así no viajan al navegador.
const INCLUIR_PAGOS_PARA_RESUMEN = Object.freeze({ pagos: { select: { concepto: true, estado: true } } })

const alquilerAprobado = (pagos = []) =>
    pagos.some(pago => pago.concepto === 'ALQUILER' && pago.estado === 'APROBADO')

function conEstadoDePago(reserva) {
    const { pagos, ...resto } = reserva
    return { ...resto, alquilerPagado: alquilerAprobado(pagos) }
}

module.exports = { INCLUIR_PAGOS_PARA_RESUMEN, conEstadoDePago, alquilerAprobado }
