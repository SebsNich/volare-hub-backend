const { crearLimitador } = require('./limitadorIntentos');

const VENTANA_MS = 15 * 60 * 1000;
const MAX_FALLOS_POR_CORREO = 10;
const MAX_FALLOS_POR_IP = 30;

const normalizarCorreo = (correo) => String(correo).trim().toLowerCase();

// Dos contadores (RF-18):
// - por correo: frena adivinar la contraseña de una cuenta, aunque se cambie de IP;
// - por IP: frena probar muchos correos desde el mismo lugar.
// Cuentan también los fallos de correos inexistentes, para no revelar cuáles existen.
function crearLimitesLogin({ ahora = Date.now } = {}) {
    const porCorreo = crearLimitador({ maxIntentos: MAX_FALLOS_POR_CORREO, ventanaMs: VENTANA_MS, ahora });
    const porIp = crearLimitador({ maxIntentos: MAX_FALLOS_POR_IP, ventanaMs: VENTANA_MS, ahora });

    // Devuelve null si puede intentar, o { segundosRestantes } si está bloqueado.
    function revisar(ip, correo) {
        const estados = [porCorreo.consultar(normalizarCorreo(correo)), porIp.consultar(ip)]
            .filter((estado) => estado.bloqueado);
        if (estados.length === 0) return null;
        return { segundosRestantes: Math.max(...estados.map((estado) => estado.segundosRestantes)) };
    }

    function registrarFallo(ip, correo) {
        porCorreo.registrarFallo(normalizarCorreo(correo));
        porIp.registrarFallo(ip);
    }

    // Solo el correo: si se limpiara la IP, un atacante con una cuenta propia
    // podría entrar con ella cada tanto y seguir probando otros correos.
    function loginExitoso(correo) {
        porCorreo.limpiar(normalizarCorreo(correo));
    }

    return { revisar, registrarFallo, loginExitoso };
}

module.exports = { crearLimitesLogin, VENTANA_MS, MAX_FALLOS_POR_CORREO, MAX_FALLOS_POR_IP };
