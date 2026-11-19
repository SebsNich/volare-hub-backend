// Buzón público (RF-50): validación de lo que llega y límite de envíos por IP.
// El buzón no pide sesión, así que es lo más fácil de llenar con spam.
const { crearLimitador } = require('./limitadorIntentos')

const TIPOS = ['SUGERENCIA', 'QUEJA', 'CONSULTA', 'OTRO']
const LARGOS_BUZON = Object.freeze({ nombre: 100, manzana: 20, villa: 20, mensaje: 2000 })
const MAX_ENVIOS_POR_IP = 5
const VENTANA_MS = 60 * 60 * 1000

const NOMBRES_CAMPO = { nombre: 'El nombre', manzana: 'La manzana', villa: 'La villa', mensaje: 'El mensaje' }

// Devuelve el texto recortado, null si viene vacío y no es obligatorio, o un error.
function leerTexto(body, campo, obligatorio) {
    const valor = body[campo]
    if (valor === undefined || valor === null || valor === '') {
        return obligatorio ? { error: 'Faltan campos obligatorios' } : { valor: null }
    }
    if (typeof valor !== 'string') return { error: `${NOMBRES_CAMPO[campo]} debe ser texto` }
    const limpio = valor.trim()
    if (!limpio) return obligatorio ? { error: 'Faltan campos obligatorios' } : { valor: null }
    if (limpio.length > LARGOS_BUZON[campo]) {
        return { error: `${NOMBRES_CAMPO[campo]} puede tener como máximo ${LARGOS_BUZON[campo]} caracteres` }
    }
    return { valor: limpio }
}

// Solo se copian los campos conocidos: estado o id en el body se descartan.
function validarSugerencia(body = {}) {
    const entrada = body ?? {}
    const datos = {}
    for (const [campo, obligatorio] of [['nombre', true], ['manzana', false], ['villa', false], ['mensaje', true]]) {
        const leido = leerTexto(entrada, campo, obligatorio)
        if (leido.error) return { error: leido.error }
        datos[campo] = leido.valor
    }
    if (!TIPOS.includes(entrada.tipo)) return { error: 'El tipo debe ser SUGERENCIA, QUEJA, CONSULTA u OTRO' }
    return { datos: { nombre: datos.nombre, manzana: datos.manzana, villa: datos.villa, tipo: entrada.tipo, mensaje: datos.mensaje } }
}

// Reutiliza el limitador de RF-18: aquí cada envío exitoso cuenta como un "intento".
function crearLimiteBuzon({ ahora = Date.now } = {}) {
    const limitador = crearLimitador({ maxIntentos: MAX_ENVIOS_POR_IP, ventanaMs: VENTANA_MS, ahora })

    function middleware(req, res, next) {
        const { bloqueado, segundosRestantes } = limitador.consultar(req.ip)
        if (!bloqueado) return next()
        const minutos = Math.max(1, Math.ceil(segundosRestantes / 60))
        return res.status(429).json({ error: `Demasiados envíos desde esta conexión. Intenta de nuevo en ${minutos} minuto(s).` })
    }

    return { middleware, registrarEnvio: (ip) => limitador.registrarFallo(ip) }
}

module.exports = { validarSugerencia, crearLimiteBuzon, LARGOS_BUZON, MAX_ENVIOS_POR_IP }
