const REGEX_CEDULA = /^\d{10}$/;

// Formato básico: algo, una sola arroba, dominio con al menos un punto y sin
// espacios. No intenta cubrir todo el estándar; lo que importa es atajar los
// errores de tipeo antes de guardar un correo al que nunca llegarán los avisos.
const REGEX_EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const LARGO_MAX_EMAIL = 254;
const MENSAJE_EMAIL_INVALIDO = 'El correo no tiene un formato válido (ejemplo: nombre@correo.com)';

function esCedulaValida(cedula) {
    return REGEX_CEDULA.test(cedula);
}

function esEmailValido(email) {
    if (typeof email !== 'string') return false;
    const limpio = email.trim();
    return limpio.length > 0 && limpio.length <= LARGO_MAX_EMAIL && REGEX_EMAIL.test(limpio);
}

module.exports = {
    esCedulaValida,
    esEmailValido,
    LARGO_MAX_EMAIL,
    MENSAJE_EMAIL_INVALIDO
};
