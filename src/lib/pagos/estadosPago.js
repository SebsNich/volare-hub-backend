// Todas las transiciones de un pago pasan por esta tabla. Lo que no está aquí
// no se permite: así un error en otra parte del código no puede, por ejemplo,
// reabrir un pago rechazado o aprobar dos veces.
const ESTADOS_PAGO = ['PENDIENTE', 'APROBADO', 'RECHAZADO', 'VENCIDO', 'DUPLICADO', 'REVERSADO']

// Eventos: los tres resultados de un proveedor (APROBADO, RECHAZADO, PENDIENTE),
// VENCER (pasó venceEn sin resultado) y REVERSADO (el dinero se devolvió).
const SEGUN_DISPONIBILIDAD = 'SEGUN_DISPONIBILIDAD'

const TRANSICIONES = {
    PENDIENTE: { APROBADO: SEGUN_DISPONIBILIDAD, RECHAZADO: 'RECHAZADO', PENDIENTE: 'PENDIENTE', VENCER: 'VENCIDO' },
    // Una aprobación tardía todavía puede aplicarse si lo pagado sigue disponible.
    VENCIDO: { APROBADO: SEGUN_DISPONIBILIDAD, RECHAZADO: 'VENCIDO', PENDIENTE: 'VENCIDO' },
    // Estados resueltos: los resultados repetidos del proveedor no cambian nada (idempotencia).
    APROBADO: { APROBADO: 'APROBADO', RECHAZADO: 'APROBADO', PENDIENTE: 'APROBADO', REVERSADO: 'REVERSADO' },
    RECHAZADO: { RECHAZADO: 'RECHAZADO', PENDIENTE: 'RECHAZADO' },
    DUPLICADO: { APROBADO: 'DUPLICADO', RECHAZADO: 'DUPLICADO', PENDIENTE: 'DUPLICADO', REVERSADO: 'REVERSADO' },
    REVERSADO: { APROBADO: 'REVERSADO', RECHAZADO: 'REVERSADO', PENDIENTE: 'REVERSADO' }
}

// Si el proveedor cobró pero lo pagado ya no está disponible (la cuota ya se
// pagó, la reserva se rechazó por tiempo), el pago queda DUPLICADO: hay que
// devolver el dinero. Por eso no se acepta un valor por defecto: hay que decirlo.
function resolverAprobacion(contexto) {
    if (typeof contexto?.referenciaDisponible !== 'boolean') {
        throw new Error('Para aplicar una aprobación hay que indicar referenciaDisponible (true o false)')
    }
    return contexto.referenciaDisponible ? 'APROBADO' : 'DUPLICADO'
}

function siguienteEstado(estadoActual, evento, contexto) {
    const destino = TRANSICIONES[estadoActual]?.[evento]
    if (!destino) {
        throw new Error(`Transición no permitida: ${estadoActual} + ${evento}`)
    }
    const estado = destino === SEGUN_DISPONIBILIDAD ? resolverAprobacion(contexto) : destino
    return { estado, cambia: estado !== estadoActual }
}

module.exports = { ESTADOS_PAGO, siguienteEstado }
