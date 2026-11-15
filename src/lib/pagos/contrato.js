// Contrato que cumple todo proveedor de pago (RF-39). El núcleo solo conoce esta
// forma y las capacidades; nunca pregunta "¿qué proveedor es?", sino "¿puede revertir?".
const { esCentavosValido } = require('./montos')

const TIPOS = ['REDIRECCION', 'MANUAL']
const QUIEN_CONFIRMA = ['PAGADOR', 'ADMIN']
const RESULTADOS_CONFIRMACION = ['APROBADO', 'RECHAZADO', 'PENDIENTE']
const CAPACIDADES_BOOLEANAS = ['soportaReversoMismoDia', 'soportaConsulta', 'admiteEvidencia', 'disponibleEnProduccion']
const FUNCIONES_REQUERIDAS = ['crearCobro', 'confirmarCobro', 'consultarEstado']

// Devuelve la lista de problemas (vacía si el proveedor cumple el contrato).
function validarProveedor(proveedor) {
    if (!proveedor || typeof proveedor !== 'object') return ['El proveedor debe ser un objeto']
    const errores = []
    if (typeof proveedor.codigo !== 'string' || !proveedor.codigo.trim()) errores.push('Falta codigo')

    const capacidades = proveedor.capacidades
    if (!capacidades || typeof capacidades !== 'object') {
        errores.push('Faltan capacidades')
    } else {
        if (!TIPOS.includes(capacidades.tipo)) errores.push(`capacidades.tipo debe ser ${TIPOS.join(' o ')}`)
        if (!QUIEN_CONFIRMA.includes(capacidades.confirmaQuien)) errores.push(`capacidades.confirmaQuien debe ser ${QUIEN_CONFIRMA.join(' o ')}`)
        for (const nombre of CAPACIDADES_BOOLEANAS) {
            if (typeof capacidades[nombre] !== 'boolean') errores.push(`capacidades.${nombre} debe ser true o false`)
        }
        const vigencia = capacidades.vigenciaMinutos
        if (vigencia !== null && !(Number.isInteger(vigencia) && vigencia > 0)) {
            errores.push('capacidades.vigenciaMinutos debe ser un entero positivo o null')
        }
        if (capacidades.soportaReversoMismoDia === true && typeof proveedor.revertir !== 'function') {
            errores.push('Si soportaReversoMismoDia es true, hace falta la función revertir')
        }
    }

    for (const nombre of FUNCIONES_REQUERIDAS) {
        if (typeof proveedor[nombre] !== 'function') errores.push(`Falta la función ${nombre}`)
    }
    return errores
}

// Los errores de quien llama (datos mal armados por el núcleo o por el admin) sí
// lanzan excepción; los resultados del pagador nunca: se devuelven como estado.
function errorDeValidacion(mensaje) {
    const error = new Error(mensaje)
    error.codigo = 'VALIDACION_PAGO'
    return error
}

function validarEntradaCobro({ pagoId, montoCentavos, referencia, urlRetorno } = {}) {
    if (typeof pagoId !== 'string' || !pagoId) throw errorDeValidacion('crearCobro: falta pagoId')
    if (!esCentavosValido(montoCentavos)) throw errorDeValidacion('crearCobro: montoCentavos debe ser un entero positivo')
    if (typeof referencia !== 'string' || !referencia) throw errorDeValidacion('crearCobro: falta referencia')
    if (typeof urlRetorno !== 'string' || !urlRetorno) throw errorDeValidacion('crearCobro: falta urlRetorno')
}

module.exports = {
    RESULTADOS_CONFIRMACION,
    validarProveedor,
    validarEntradaCobro,
    errorDeValidacion
}
