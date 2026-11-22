const REGEX_CEDULA = /^\d{10}$/;

// Formato básico: algo, una sola arroba, dominio con al menos un punto y sin
// espacios. No intenta cubrir todo el estándar; lo que importa es atajar los
// errores de tipeo antes de guardar un correo al que nunca llegarán los avisos.
const REGEX_EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const LARGO_MAX_EMAIL = 254;
const MENSAJE_EMAIL_INVALIDO = 'El correo no tiene un formato válido (ejemplo: nombre@correo.com)';

const MENSAJE_CELULAR_INVALIDO = 'El celular debe ser un número móvil de Ecuador de 10 dígitos que empiece con 09 (ejemplo: 0991234567)';

// Acepta lo que la gente suele escribir (espacios, guiones, +593) y lo deja en
// el formato único 09XXXXXXXX, así todos los celulares guardados se ven igual.
// Devuelve null si no es un móvil ecuatoriano válido.
function normalizarCelular(celular) {
    if (typeof celular !== 'string') return null;
    let digitos = celular.replace(/[\s\-().]/g, '');
    if (digitos.startsWith('+593')) digitos = '0' + digitos.slice(4);
    else if (digitos.startsWith('593') && digitos.length === 12) digitos = '0' + digitos.slice(3);
    return /^09\d{8}$/.test(digitos) ? digitos : null;
}

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
    normalizarCelular,
    MENSAJE_CELULAR_INVALIDO,
    esEmailValido,
    LARGO_MAX_EMAIL,
    MENSAJE_EMAIL_INVALIDO
};
