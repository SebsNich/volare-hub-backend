// Cuántos proxies hay delante del servidor (Express "trust proxy").
// Con N saltos, req.ip es la IP que anotó el proxy N contando desde el servidor
// en X-Forwarded-For. Nunca se usa "true": haría creer cualquier cabecera que
// mande el cliente, y un atacante cambiaría de IP en cada intento de login.
//
// TRUST_PROXY_SALTOS (entero de 0 a 10) manda si existe. Si no:
// producción -> 1 (el proxy de Render); local -> 0 (no hay proxy).
const MAXIMO_SALTOS = 10;

function saltosDeProxy(entorno) {
    const valor = (entorno.TRUST_PROXY_SALTOS ?? '').trim();
    if (valor === '') {
        return entorno.NODE_ENV === 'production' ? 1 : 0;
    }
    if (!/^\d+$/.test(valor) || Number(valor) > MAXIMO_SALTOS) {
        throw new Error(`TRUST_PROXY_SALTOS debe ser un entero de 0 a ${MAXIMO_SALTOS}; llegó "${valor}".`);
    }
    return Number(valor);
}

module.exports = { saltosDeProxy };
