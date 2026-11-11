const INTENTOS_POR_DEFECTO = 3

// Repite la operación solo para errores que "debeReintentar" considera pasajeros
// (por ejemplo, un choque entre transacciones). Cualquier otro error sale de inmediato.
async function ejecutarConReintentos(operacion, { intentos = INTENTOS_POR_DEFECTO, debeReintentar }) {
    for (let intento = 1; ; intento++) {
        try {
            return await operacion()
        } catch (error) {
            if (intento >= intentos || !debeReintentar(error)) throw error
        }
    }
}

module.exports = { ejecutarConReintentos }
