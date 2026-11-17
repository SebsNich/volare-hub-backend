// Las pruebas de integración crean y BORRAN datos. Antes de cargar prisma se
// comprueba que la conexión sea a una base local de pruebas: si .env.test faltara
// o estuviera mal, el backend tomaría otra base (incluso la de producción).
const HOSTS_LOCALES = ['localhost', '127.0.0.1']

function verificarBaseDePruebas(url) {
    if (!url) throw new Error('Falta DATABASE_URL: ejecuta con "npm run test:integracion" y un .env.test')

    let destino
    try {
        destino = new URL(url)
    } catch {
        throw new Error('DATABASE_URL no es una URL válida')
    }
    const base = destino.pathname.replace(/^\//, '')

    // Los mensajes nombran host y base, nunca usuario ni contraseña.
    if (!HOSTS_LOCALES.includes(destino.hostname)) {
        throw new Error(`Las pruebas de integración solo corren contra una base local (host: ${destino.hostname})`)
    }
    if (!base.endsWith('_test')) {
        throw new Error(`La base de pruebas debe terminar en _test (base: ${base})`)
    }
}

module.exports = { verificarBaseDePruebas }
