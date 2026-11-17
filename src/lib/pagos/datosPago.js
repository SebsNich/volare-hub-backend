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

module.exports = {
    validarPedidoPago,
    validarPedidoConfirmacion,
    armarUrlRetorno,
    venceEnPagoReserva,
    pagoParaUsuario
}
