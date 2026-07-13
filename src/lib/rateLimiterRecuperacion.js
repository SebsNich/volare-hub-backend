const VENTANA_MS = 15 * 60 * 1000
const MAX_INTENTOS = 5

const intentos = new Map()

function claveIntento(ip, correo) {
    return `${ip}:${correo.trim().toLowerCase()}`
}

function estaBloqueado(ip, correo) {
    const clave = claveIntento(ip, correo)
    const registro = intentos.get(clave)
    if (!registro) return false

    if (Date.now() - registro.primerIntento > VENTANA_MS) {
        intentos.delete(clave)
        return false
    }

    return registro.cantidad >= MAX_INTENTOS
}

function registrarIntentoFallido(ip, correo) {
    const clave = claveIntento(ip, correo)
    const registro = intentos.get(clave)

    if (!registro || Date.now() - registro.primerIntento > VENTANA_MS) {
        intentos.set(clave, { cantidad: 1, primerIntento: Date.now() })
        return
    }

    registro.cantidad += 1
}

function limpiarIntentos(ip, correo) {
    intentos.delete(claveIntento(ip, correo))
}

module.exports = { estaBloqueado, registrarIntentoFallido, limpiarIntentos }
