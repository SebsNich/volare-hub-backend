// Piezas puras del servicio de pagos: qué se acepta del navegador y cómo se
// arman los datos que el núcleo guarda o devuelve.
const { MINUTOS_PAGO_EN_LINEA } = require('./reglasPago')

// Bloque E: solo el alquiler en línea. La garantía (siempre por transferencia)
// llega con la transferencia manual en el Bloque E2.
const CONCEPTOS_PERMITIDOS = ['ALQUILER']
const RESULTADOS_DE_LA_DEMO = ['APROBADO', 'RECHAZADO']

const textoNoVacio = (valor) => typeof valor === 'string' && valor.trim() !== ''

// Se copian solo los campos conocidos: un monto en el body se descarta, porque
// el monto siempre sale de la reserva guardada.
function validarPedidoPago(body = {}) {
    const { reservaId, concepto, proveedor } = body ?? {}
    if (!textoNoVacio(reservaId)) return { error: 'Falta la reserva a pagar' }
    if (!CONCEPTOS_PERMITIDOS.includes(concepto)) return { error: 'Por ahora solo se paga en línea el alquiler' }
    if (!textoNoVacio(proveedor)) return { error: 'Falta el proveedor de pago' }
    return { datos: { reservaId, concepto, proveedor } }
}

function validarPedidoConfirmacion(body = {}) {
    const resultado = body?.resultado
    if (resultado !== undefined && !RESULTADOS_DE_LA_DEMO.includes(resultado)) {
        return { error: 'El resultado debe ser APROBADO o RECHAZADO' }
    }
    return { datos: { resultado } }
}

function armarUrlRetorno(urlFrontend, pagoId) {
    if (!textoNoVacio(urlFrontend)) throw new Error('Falta FRONTEND_URL para armar la url de retorno del pago')
    const base = urlFrontend.replace(/\/+$/, '')
    return `${base}/pagos/retorno?pago=${encodeURIComponent(pagoId)}`
}

// Decisión 2: el plazo se cuenta desde la reserva, no desde cada intento, para
// que reintentar el pago no alargue el bloqueo del turno.
function venceEnPagoReserva(reserva, capacidades) {
    if (capacidades?.vigenciaMinutos == null) return null
    return new Date(new Date(reserva.creadoEn).getTime() + MINUTOS_PAGO_EN_LINEA * 60000)
}

// respuestaProveedor es para auditoría del admin; el residente no la necesita.
function pagoParaUsuario(pago, usuario) {
    if (usuario?.rol === 'ADMIN') return pago
    const { respuestaProveedor, ...resto } = pago
    return resto
}

// ---------- Bloque E2 (c): transferencia manual ----------
// Por ahora solo el alquiler: la garantía sigue con el comprobante de la reserva.
const CONCEPTOS_TRANSFERENCIA = ['ALQUILER']
const MAX_ARCHIVOS_EVIDENCIA = 5
const DECISIONES_MANUALES = ['APROBAR', 'RECHAZAR']

// Los archivos ya llegan filtrados por multer (JPG, PNG o PDF de hasta 10 MB).
function validarPedidoTransferencia(body = {}, archivos = []) {
    const { reservaId, concepto } = body ?? {}
    const lista = archivos ?? []
    if (!textoNoVacio(reservaId)) return { error: 'Falta la reserva a pagar' }
    if (!CONCEPTOS_TRANSFERENCIA.includes(concepto)) return { error: 'Por ahora solo se paga por transferencia el alquiler' }
    if (lista.length === 0) return { error: 'Adjunta el comprobante de la transferencia' }
    if (lista.length > MAX_ARCHIVOS_EVIDENCIA) return { error: `Puedes adjuntar como máximo ${MAX_ARCHIVOS_EVIDENCIA} archivos` }
    return { datos: { reservaId, concepto, archivos: lista } }
}

function validarDecisionManual(body = {}) {
    const { decision, motivo, aprobarReserva = false } = body ?? {}
    if (!DECISIONES_MANUALES.includes(decision)) return { error: 'La decisión debe ser APROBAR o RECHAZAR' }
    if (typeof aprobarReserva !== 'boolean') return { error: 'aprobarReserva debe ser true o false' }
    if (decision === 'RECHAZAR') {
        // El residente va a leer el motivo: no puede quedar vacío.
        if (!textoNoVacio(motivo)) return { error: 'Para rechazar hay que escribir el motivo' }
        if (aprobarReserva) return { error: 'La reserva se puede aprobar solo al aprobar el pago' }
        return { datos: { decision, motivo: motivo.trim(), aprobarReserva: false } }
    }
    return { datos: { decision, motivo: undefined, aprobarReserva } }
}

module.exports = {
    validarPedidoPago,
    validarPedidoTransferencia,
    validarDecisionManual,
    MAX_ARCHIVOS_EVIDENCIA,
    validarPedidoConfirmacion,
    armarUrlRetorno,
    venceEnPagoReserva,
    pagoParaUsuario
}
