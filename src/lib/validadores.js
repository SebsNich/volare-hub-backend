const REGEX_CEDULA = /^\d{10}$/;

function esCedulaValida(cedula) {
    return REGEX_CEDULA.test(cedula);
}

module.exports = {
    esCedulaValida
};
