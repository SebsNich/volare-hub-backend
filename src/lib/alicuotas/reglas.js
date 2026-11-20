// Reglas de las alícuotas (puras: no tocan la base ni el reloj).
// Decisión del cliente: la alícuota es un VALOR FIJO MENSUAL que el
// administrador configura. Si se paga en los primeros N días del mes se cobra
// un valor menor (pago puntual). No hay recargo por mora: no existe un
// histórico limpio para calcularla, así que pagar tarde solo pierde el descuento.
const { dolaresACentavos } = require('../pagos/montos')

const CONFIG_INICIAL = Object.freeze({ montoCentavos: 6000, montoPuntualCentavos: 5500, diasPuntual: 5 })
const MAX_DIAS_PUNTUAL = 28 // existe en todos los meses
const DESFASE_GUAYAQUIL_MS = -5 * 60 * 60 * 1000 // Ecuador continental no cambia de hora

// Se desplaza la fecha a la hora de Guayaquil y se lee con getUTC*: así no
// depende de la zona horaria del servidor (Render corre en UTC).
const enGuayaquil = (fecha) => new Date(fecha.getTime() + DESFASE_GUAYAQUIL_MS)
const dos = (n) => String(n).padStart(2, '0')

function periodoDe(fecha) {
    const g = enGuayaquil(fecha)
    return `${g.getUTCFullYear()}-${dos(g.getUTCMonth() + 1)}`
}

const diaDelMes = (fecha) => enGuayaquil(fecha).getUTCDate()

const validarPeriodo = (texto) => typeof texto === 'string' && /^\d{4}-(0[1-9]|1[0-2])$/.test(texto)

// Cuánto cuesta HOY pagar esta cuota. Usa los montos guardados en la cuota (los
// de cuando se generó): si el admin cambia la configuración, lo ya generado no se mueve.
function calcularMontoCuota({ cuota, fechaPago }) {
    const periodoPago = periodoDe(fechaPago)
    const aTiempo = periodoPago < cuota.periodo
        || (periodoPago === cuota.periodo && diaDelMes(fechaPago) <= cuota.diasPuntual)
    return {
        montoCentavos: aTiempo ? cuota.montoPuntualCentavos : cuota.montoBaseCentavos,
        aplicaDescuento: aTiempo,
        descuentoHasta: `${cuota.periodo}-${dos(cuota.diasPuntual)}`
    }
}

// Lo que escribe el administrador llega como texto o número en dólares.
function validarConfig(body) {
    const { monto, montoPuntual, diasPuntual } = body ?? {}
    let montoCentavos, montoPuntualCentavos
    try {
        montoCentavos = dolaresACentavos(monto)
    } catch {
        return { error: 'El monto de la alícuota debe ser un valor en dólares mayor a cero, por ejemplo 60 o 60.50' }
    }
    try {
        montoPuntualCentavos = dolaresACentavos(montoPuntual)
    } catch {
        return { error: 'El monto por pago puntual debe ser un valor en dólares mayor a cero, por ejemplo 55' }
    }
    if (montoPuntualCentavos > montoCentavos) {
        return { error: 'El monto por pago puntual no puede ser mayor que el monto de la alícuota' }
    }
    const dias = typeof diasPuntual === 'string' && diasPuntual.trim() !== '' ? Number(diasPuntual) : diasPuntual
    if (!Number.isInteger(dias) || dias < 1 || dias > MAX_DIAS_PUNTUAL) {
        return { error: `Los días para el pago puntual deben ser un número entero entre 1 y ${MAX_DIAS_PUNTUAL}` }
    }
    return { datos: { montoCentavos, montoPuntualCentavos, diasPuntual: dias } }
}

module.exports = { CONFIG_INICIAL, MAX_DIAS_PUNTUAL, periodoDe, diaDelMes, validarPeriodo, calcularMontoCuota, validarConfig }
