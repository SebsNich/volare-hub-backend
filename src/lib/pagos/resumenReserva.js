// Resumen del pago de una reserva para las listas. El servidor decide si el
// alquiler está pagado o en revisión; el frontend solo muestra "Pagar",
// "Pagado" o "En revisión" según esto.

// Se traen solo concepto, estado y proveedor: montos y respuestas del proveedor no hacen
// falta en una lista y así no viajan al navegador.
const INCLUIR_PAGOS_PARA_RESUMEN = Object.freeze({ pagos: { select: { concepto: true, estado: true, proveedor: true } } })

const alquilerAprobado = (pagos = []) =>
    pagos.some(pago => pago.concepto === 'ALQUILER' && pago.estado === 'APROBADO')

const transferenciaPendiente = (pagos = []) =>
    pagos.some(pago => pago.concepto === 'ALQUILER' && pago.estado === 'PENDIENTE' && pago.proveedor === 'TRANSFERENCIA_MANUAL')

function conEstadoDePago(reserva) {
    const { pagos, ...resto } = reserva
    return { ...resto, alquilerPagado: alquilerAprobado(pagos), transferenciaEnRevision: transferenciaPendiente(pagos) }
}

module.exports = { INCLUIR_PAGOS_PARA_RESUMEN, conEstadoDePago, alquilerAprobado }
