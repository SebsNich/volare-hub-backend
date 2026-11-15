// El dinero se maneja en centavos enteros. Para convertir se trabaja con el TEXTO
// del valor (también el del Decimal de Prisma): multiplicar 80.1 * 100 en coma
// flotante puede dar 8009.999..., y un centavo de diferencia ya es un error de cobro.
const FORMATO_DOLARES = /^\d+(\.\d{1,2})?$/

function dolaresACentavos(valor) {
    const texto = valor === null || valor === undefined ? '' : String(valor).trim()
    if (!FORMATO_DOLARES.test(texto)) {
        throw new Error(`Monto inválido: ${texto || '(vacío)'}`)
    }
    const [enteros, decimales = ''] = texto.split('.')
    const centavos = Number(enteros) * 100 + Number(decimales.padEnd(2, '0'))
    if (!esCentavosValido(centavos)) {
        throw new Error(`Monto inválido: ${texto}`)
    }
    return centavos
}

function esCentavosValido(centavos) {
    return Number.isSafeInteger(centavos) && centavos > 0
}

module.exports = { dolaresACentavos, esCentavosValido }
