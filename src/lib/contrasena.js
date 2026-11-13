// Regla de contraseñas (RF-21): de 8 a 72.
// El mínimo se cuenta en caracteres (lo que la persona ve al escribir).
// El máximo se cuenta en bytes UTF-8 porque bcrypt solo usa los primeros 72
// bytes y bcryptjs corta el resto sin avisar: dos contraseñas que difieran
// después del byte 72 serían la misma. Se rechaza en vez de cortar en silencio.
// Una letra con tilde o una ñ ocupa 2 bytes.
const MINIMO_CARACTERES = 8;
const MAXIMO_BYTES = 72;

function validarContrasena(password) {
    if (typeof password !== 'string' || password.length < MINIMO_CARACTERES) {
        return `La contraseña debe tener al menos ${MINIMO_CARACTERES} caracteres.`;
    }
    if (Buffer.byteLength(password, 'utf8') > MAXIMO_BYTES) {
        return `La contraseña es demasiado larga: máximo ${MAXIMO_BYTES} caracteres (las letras con tilde o ñ cuentan doble).`;
    }
    return null;
}

module.exports = { validarContrasena, MINIMO_CARACTERES, MAXIMO_BYTES };
