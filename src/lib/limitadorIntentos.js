// Limitador de intentos fallidos en memoria (RF-18).
// Ventana fija: cuenta desde el primer fallo; al vencer, la clave queda libre.
// "ahora" se inyecta para que las pruebas avancen el reloj sin esperar.
// Vive en la memoria del proceso: se reinicia al reiniciar el servidor y no se
// comparte entre instancias (en Render hay una sola).

const LIMPIAR_DESDE = 1000;

function crearLimitador({ maxIntentos, ventanaMs, ahora = Date.now }) {
    const intentos = new Map();

    const vencido = (registro) => ahora() - registro.primerFallo >= ventanaMs;

    // Evita que la memoria crezca sin fin con claves viejas.
    function purgarVencidos() {
        for (const [clave, registro] of intentos) {
            if (vencido(registro)) intentos.delete(clave);
        }
    }

    function consultar(clave) {
        const registro = intentos.get(clave);
        if (!registro || vencido(registro)) {
            return { bloqueado: false, segundosRestantes: 0 };
        }
        const bloqueado = registro.cantidad >= maxIntentos;
        const restanteMs = ventanaMs - (ahora() - registro.primerFallo);
        return { bloqueado, segundosRestantes: bloqueado ? Math.ceil(restanteMs / 1000) : 0 };
    }

    function registrarFallo(clave) {
        if (intentos.size >= LIMPIAR_DESDE) purgarVencidos();
        const registro = intentos.get(clave);
        if (!registro || vencido(registro)) {
            intentos.set(clave, { cantidad: 1, primerFallo: ahora() });
            return;
        }
        registro.cantidad += 1;
    }

    function limpiar(clave) {
        intentos.delete(clave);
    }

    return { consultar, registrarFallo, limpiar };
}

function mensajeDeBloqueo(segundosRestantes) {
    const minutos = Math.max(1, Math.ceil(segundosRestantes / 60));
    const unidad = minutos === 1 ? 'minuto' : 'minutos';
    return `Demasiados intentos de inicio de sesión. Intenta de nuevo en ${minutos} ${unidad}.`;
}

module.exports = { crearLimitador, mensajeDeBloqueo };
