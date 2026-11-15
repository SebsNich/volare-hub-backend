// Proveedor SIMULADO (RF-40): permite desarrollar, probar y hacer la demo del pago
// en línea sin dinero real. Guarda los cobros en memoria. Nunca va a producción
// (disponibleEnProduccion: false).
const { validarEntradaCobro, errorDeValidacion } = require('../contrato')

const CASOS = ['APROBADO', 'RECHAZADO', 'TARDIO', 'DUPLICADO', 'MONTO_DISTINTO', 'CAIDA']
const RESULTADOS_DE_LA_DEMO = ['APROBADO', 'RECHAZADO']
const MINUTOS_RETRASO_TARDIO = 2

const CAPACIDADES = Object.freeze({
    tipo: 'REDIRECCION',
    confirmaQuien: 'PAGADOR',
    soportaReversoMismoDia: true,
    soportaConsulta: true,
    vigenciaMinutos: 15,
    admiteEvidencia: false,
    disponibleEnProduccion: false
})

// guion: { [pagoId]: caso } fija el resultado en las pruebas. Sin guion, el
// resultado lo eligen los botones de la demo ("Simular pago aprobado/rechazado").
function crearProveedorSimulado({ ahora = () => new Date(), guion = {} } = {}) {
    const cobros = new Map()

    const resultado = (estado, idExterno, montoCentavos, detalle) =>
        (detalle ? { estado, idExterno, montoCentavos, detalle } : { estado, idExterno, montoCentavos })
    const inexistente = (idExterno) => resultado('RECHAZADO', idExterno ?? null, null, { motivo: 'Cobro inexistente' })

    function tardioYaAprobado(cobro) {
        return ahora().getTime() >= cobro.creadoEn + MINUTOS_RETRASO_TARDIO * 60000
    }

    async function crearCobro(entrada) {
        validarEntradaCobro(entrada)
        const caso = guion[entrada.pagoId]
        if (caso !== undefined && !CASOS.includes(caso)) {
            throw errorDeValidacion(`Caso de simulación desconocido: ${caso}`)
        }
        const idExterno = `SIM-${entrada.pagoId}`
        cobros.set(idExterno, {
            caso, montoCentavos: entrada.montoCentavos, creadoEn: ahora().getTime(), estado: 'PENDIENTE', aprobaciones: 0
        })
        const separador = entrada.urlRetorno.includes('?') ? '&' : '?'
        return { tipo: 'REDIRECCION', url: `${entrada.urlRetorno}${separador}simulado=1`, idExterno }
    }

    async function confirmarCobro({ idExterno, resultado: pedidoPorLaDemo } = {}) {
        const cobro = cobros.get(idExterno)
        if (!cobro) return inexistente(idExterno)

        const caso = cobro.caso ?? (RESULTADOS_DE_LA_DEMO.includes(pedidoPorLaDemo) ? pedidoPorLaDemo : 'APROBADO')
        switch (caso) {
            case 'RECHAZADO':
                cobro.estado = 'RECHAZADO'
                return resultado('RECHAZADO', idExterno, cobro.montoCentavos)
            case 'CAIDA':
                return resultado('PENDIENTE', idExterno, cobro.montoCentavos, { motivo: 'Sin respuesta del proveedor simulado' })
            case 'TARDIO':
                if (!tardioYaAprobado(cobro)) return resultado('PENDIENTE', idExterno, cobro.montoCentavos)
                cobro.estado = 'APROBADO'
                return resultado('APROBADO', idExterno, cobro.montoCentavos)
            case 'DUPLICADO': {
                // Simula un doble cobro: cada confirmación es un cargo aprobado distinto.
                cobro.aprobaciones += 1
                cobro.estado = 'APROBADO'
                const id = cobro.aprobaciones === 1 ? idExterno : `${idExterno}-${cobro.aprobaciones}`
                return resultado('APROBADO', id, cobro.montoCentavos)
            }
            case 'MONTO_DISTINTO':
                cobro.estado = 'APROBADO'
                return resultado('APROBADO', idExterno, cobro.montoCentavos + 1)
            default:
                cobro.estado = 'APROBADO'
                return resultado('APROBADO', idExterno, cobro.montoCentavos)
        }
    }

    async function consultarEstado(idExterno) {
        const cobro = cobros.get(idExterno)
        if (!cobro) return inexistente(idExterno)
        if (cobro.caso === 'TARDIO' && cobro.estado === 'PENDIENTE' && tardioYaAprobado(cobro)) {
            cobro.estado = 'APROBADO'
        }
        const estado = cobro.estado === 'REVERSADO' ? 'RECHAZADO' : cobro.estado
        return resultado(estado, idExterno, cobro.montoCentavos)
    }

    async function revertir(idExterno) {
        const cobro = cobros.get(idExterno)
        if (cobro?.estado !== 'APROBADO') return { estado: 'NO_REVERSADO', detalle: { motivo: 'El cobro no está aprobado' } }
        cobro.estado = 'REVERSADO'
        return { estado: 'REVERSADO' }
    }

    return { codigo: 'SIMULADO', capacidades: CAPACIDADES, crearCobro, confirmarCobro, consultarEstado, revertir }
}

module.exports = { crearProveedorSimulado, CASOS_SIMULADOS: CASOS }
