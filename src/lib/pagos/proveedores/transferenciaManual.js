// Proveedor TRANSFERENCIA_MANUAL (RF-42 adaptado): el residente transfiere, sube
// el comprobante (eso lo maneja el núcleo con evidenciaUrls) y el admin decide.
// No hay sistema externo, así que no guarda estado: la verdad está en la base.
const { validarEntradaCobro, errorDeValidacion } = require('../contrato')

const CAPACIDADES = Object.freeze({
    tipo: 'MANUAL',
    confirmaQuien: 'ADMIN',
    soportaReversoMismoDia: false,
    soportaConsulta: false,
    vigenciaMinutos: null,
    admiteEvidencia: true,
    disponibleEnProduccion: true
})

// cuentas: las cuentas de la asociación que se muestran al residente (configuración del backend).
function crearProveedorTransferenciaManual({ cuentas = [] } = {}) {
    const cuentasFijas = Object.freeze([...cuentas])

    async function crearCobro(entrada) {
        validarEntradaCobro(entrada)
        return {
            tipo: 'MANUAL',
            idExterno: `TM-${entrada.pagoId}`,
            instrucciones: { cuentas: cuentasFijas, montoCentavos: entrada.montoCentavos, referencia: entrada.referencia }
        }
    }

    // La "confirmación" es la decisión del admin. Rechazar exige un motivo porque el
    // residente lo va a leer; faltarlo es un error del formulario del admin, no un resultado.
    async function confirmarCobro({ idExterno, montoCentavos, decision, motivo } = {}) {
        if (typeof idExterno !== 'string' || !idExterno) throw errorDeValidacion('Falta idExterno del pago')
        if (decision === 'APROBAR') return { estado: 'APROBADO', idExterno, montoCentavos }
        if (decision === 'RECHAZAR') {
            const motivoLimpio = typeof motivo === 'string' ? motivo.trim() : ''
            if (!motivoLimpio) throw errorDeValidacion('Para rechazar hay que escribir el motivo')
            return { estado: 'RECHAZADO', idExterno, montoCentavos, detalle: { motivo: motivoLimpio } }
        }
        throw errorDeValidacion('La decision debe ser APROBAR o RECHAZAR')
    }

    async function consultarEstado(idExterno) {
        return { estado: 'PENDIENTE', idExterno, montoCentavos: null }
    }

    return { codigo: 'TRANSFERENCIA_MANUAL', capacidades: CAPACIDADES, crearCobro, confirmarCobro, consultarEstado }
}

module.exports = { crearProveedorTransferenciaManual }
