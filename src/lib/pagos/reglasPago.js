// Reglas de quién puede pagar o confirmar qué. Son funciones puras: reciben
// los datos ya cargados y no conocen la base ni a ningún proveedor concreto;
// del proveedor solo miran sus capacidades.

// Decisión 2: una reserva con pago en línea aparta el turno 15 minutos desde
// que se crea. Se cuenta desde la reserva, no desde cada intento, para que
// reintentar no alargue el bloqueo del turno.
const MINUTOS_PAGO_EN_LINEA = 15
const LARGO_MAX_REFERENCIA = 100
const CONCEPTOS_RESERVA = ['ALQUILER', 'GARANTIA']

const NOMBRES_ESPACIO = {
    CABANA_ARBOL: 'Cabaña del Árbol',
    CABANA_MEDIO: 'Cabaña del Medio',
    CABANA_RIO: 'Cabaña del Río',
    CASA_CLUB: 'Casa Club'
}

const PERMITIDO = Object.freeze({ permitido: true })
const negar = (motivo) => ({ permitido: false, motivo })

function puedePagarReserva({ reserva, usuario, concepto, pagos = [], proveedor, ahora }) {
    if (!reserva || !usuario || reserva.usuarioId !== usuario.id) return negar('Solo el dueño de la reserva puede pagarla')
    if (reserva.estado !== 'PENDIENTE') return negar('La reserva ya no está pendiente')
    if (!CONCEPTOS_RESERVA.includes(concepto)) return negar('Concepto de pago no válido para una reserva')
    if (pagos.some(pago => pago.concepto === concepto && pago.estado === 'APROBADO')) return negar('Ese concepto ya está pagado')

    const enLinea = proveedor?.capacidades?.tipo === 'REDIRECCION'
    // La garantía se devuelve después del evento: por eso va siempre por transferencia.
    if (concepto === 'GARANTIA' && enLinea) return negar('La garantía se paga por transferencia')
    if (enLinea) {
        const limite = new Date(reserva.creadoEn).getTime() + MINUTOS_PAGO_EN_LINEA * 60000
        if (ahora.getTime() >= limite) return negar(`El plazo de ${MINUTOS_PAGO_EN_LINEA} minutos para pagar en línea terminó`)
    }
    return PERMITIDO
}

// "A", "a " y " A" son la misma manzana: User.manzana y User.villa son texto libre.
function normalizarVilla(texto) {
    if (typeof texto !== 'string') return null
    const limpio = texto.trim().replace(/\s+/g, ' ').toUpperCase()
    return limpio || null
}

function puedePagarCuota({ cuota, usuario }) {
    if (!usuario || usuario.activo !== true || usuario.estadoCuenta !== 'APROBADA') return negar('La cuenta no está aprobada y activa')
    const manzana = normalizarVilla(usuario.manzana)
    const villa = normalizarVilla(usuario.villa)
    if (!manzana || !villa) return negar('Tu perfil no tiene manzana y villa')
    if (!cuota || manzana !== normalizarVilla(cuota.manzana) || villa !== normalizarVilla(cuota.villa)) {
        return negar('La cuota no es de tu villa')
    }
    if (cuota.estado !== 'PENDIENTE') return negar('La cuota no está pendiente')
    return PERMITIDO
}

function puedeConfirmar({ pago, usuario, proveedor }) {
    if (!pago || !usuario) return false
    const quien = proveedor?.capacidades?.confirmaQuien
    if (quien === 'PAGADOR') return usuario.id === pago.usuarioId
    if (quien === 'ADMIN') return usuario.rol === 'ADMIN'
    return false
}

// Decisión 1 (ajustada en el Bloque E2). Se puede aprobar si se cumple una:
//   - el ALQUILER tiene un pago APROBADO;
//   - la reserva tiene comprobante (camino de siempre, aunque haya un intento
//     en línea abandonado);
//   - no hay ningún pago en línea (reservas antiguas o solo transferencia).
// esEnLinea(pago) la pasa quien llama: esta función no conoce proveedores.
const MOTIVO_FALTA_PAGO = 'Esta reserva tiene un pago en línea sin aprobar y no tiene comprobante. ' +
    'Espera a que el residente complete el pago o pídele que suba el comprobante.'

function puedeAprobarReserva({ reserva, pagos = [], esEnLinea }) {
    const alquilerAprobado = pagos.some(pago => pago.concepto === 'ALQUILER' && pago.estado === 'APROBADO')
    const tieneComprobante = (reserva?.comprobantePagoUrls ?? []).length > 0
    const tienePagoEnLinea = pagos.some(esEnLinea)
    if (alquilerAprobado || tieneComprobante || !tienePagoEnLinea) return PERMITIDO
    return negar(MOTIVO_FALTA_PAGO)
}

// Si lo que confirmó el proveedor no es exactamente lo que se cobró, no se aplica.
function respuestaCoincide(pago, respuesta) {
    return respuesta?.idExterno === pago.idExterno && respuesta?.montoCentavos === pago.montoCentavos
}

function fechaIso(fecha) {
    return (fecha instanceof Date ? fecha.toISOString() : String(fecha)).slice(0, 10)
}

// Texto corto para el proveedor y el recibo. Solo usa los campos de lo que se
// paga: aunque la entrada traiga nombres o correos, no llegan al texto.
function referenciaLegible({ concepto, espacio, fecha, periodo, manzana, villa }) {
    let texto
    if (concepto === 'ALQUILER' || concepto === 'GARANTIA') {
        const nombre = concepto === 'ALQUILER' ? 'Alquiler' : 'Garantía'
        texto = `${nombre} ${NOMBRES_ESPACIO[espacio] ?? 'Espacio'} ${fechaIso(fecha)}`
    } else if (concepto === 'ALICUOTA') {
        texto = `Alícuota ${periodo} Mz ${normalizarVilla(manzana)} V ${normalizarVilla(villa)}`
    } else {
        throw new Error(`Concepto de pago desconocido: ${concepto}`)
    }
    return texto.slice(0, LARGO_MAX_REFERENCIA)
}

module.exports = {
    MINUTOS_PAGO_EN_LINEA,
    LARGO_MAX_REFERENCIA,
    puedePagarReserva,
    puedePagarCuota,
    puedeConfirmar,
    puedeAprobarReserva,
    respuestaCoincide,
    normalizarVilla,
    referenciaLegible
}
