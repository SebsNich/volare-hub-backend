const { test } = require('node:test')
const assert = require('node:assert/strict')
const { periodoDe, diaDelMes, validarPeriodo, calcularMontoCuota, validarConfig, CONFIG_INICIAL } = require('../src/lib/alicuotas/reglas')

const cuotaDic = { periodo: '2026-12', montoBaseCentavos: 6000, montoPuntualCentavos: 5500, diasPuntual: 5 }

test('la configuración inicial es $60 al mes y $55 si se paga en los primeros 5 días', () => {
    assert.deepEqual(CONFIG_INICIAL, { montoCentavos: 6000, montoPuntualCentavos: 5500, diasPuntual: 5 })
})

test('el día y el periodo se cuentan con la hora de Guayaquil (UTC-5), no la del servidor', () => {
    assert.equal(periodoDe(new Date('2026-12-01T04:59:00Z')), '2026-11') // 30 nov 23:59 en Guayaquil
    assert.equal(periodoDe(new Date('2026-12-01T05:00:00Z')), '2026-12')
    assert.equal(diaDelMes(new Date('2026-12-06T04:59:00Z')), 5)
    assert.equal(diaDelMes(new Date('2026-12-06T05:00:00Z')), 6)
})

test('pagar del día 1 al 5 del mes cuesta $55', () => {
    for (const dia of ['01', '02', '05']) {
        const r = calcularMontoCuota({ cuota: cuotaDic, fechaPago: new Date(`2026-12-${dia}T15:00:00Z`) })
        assert.equal(r.montoCentavos, 5500, `día ${dia}`)
        assert.equal(r.aplicaDescuento, true)
    }
})

test('pagar desde el día 6 cuesta $60, siempre valor fijo y sin recargo por mora', () => {
    for (const fecha of ['2026-12-06T15:00:00Z', '2026-12-31T15:00:00Z', '2027-03-02T15:00:00Z']) {
        const r = calcularMontoCuota({ cuota: cuotaDic, fechaPago: new Date(fecha) })
        assert.equal(r.montoCentavos, 6000, fecha)
        assert.equal(r.aplicaDescuento, false)
    }
})

test('pagar un mes por adelantado también cuesta $55', () => {
    const r = calcularMontoCuota({ cuota: cuotaDic, fechaPago: new Date('2026-11-20T15:00:00Z') })
    assert.equal(r.montoCentavos, 5500)
})

test('el límite del descuento se informa como fecha para mostrarlo al residente', () => {
    const r = calcularMontoCuota({ cuota: cuotaDic, fechaPago: new Date('2026-12-02T15:00:00Z') })
    assert.equal(r.descuentoHasta, '2026-12-05')
})

test('cada cuota conserva los montos con los que se generó aunque el admin cambie la configuración', () => {
    const vieja = { periodo: '2026-10', montoBaseCentavos: 5000, montoPuntualCentavos: 4500, diasPuntual: 3 }
    assert.equal(calcularMontoCuota({ cuota: vieja, fechaPago: new Date('2026-10-03T15:00:00Z') }).montoCentavos, 4500)
    assert.equal(calcularMontoCuota({ cuota: vieja, fechaPago: new Date('2026-10-04T15:00:00Z') }).montoCentavos, 5000)
})

test('validarPeriodo acepta AAAA-MM y rechaza lo demás', () => {
    assert.equal(validarPeriodo('2026-12'), true)
    for (const mal of ['2026-13', '2026-00', '26-12', '2026-1', '', null, undefined, '2026-12-01', 202612]) assert.equal(validarPeriodo(mal), false, String(mal))
})

test('validarConfig convierte dólares a centavos y exige datos coherentes', () => {
    assert.deepEqual(validarConfig({ monto: '60', montoPuntual: 55, diasPuntual: 5 }), { datos: { montoCentavos: 6000, montoPuntualCentavos: 5500, diasPuntual: 5 } })
    assert.deepEqual(validarConfig({ monto: 62.5, montoPuntual: '58.25', diasPuntual: '7' }).datos, { montoCentavos: 6250, montoPuntualCentavos: 5825, diasPuntual: 7 })
    assert.match(validarConfig({ monto: 'abc', montoPuntual: 5, diasPuntual: 5 }).error, /monto/i)
    assert.match(validarConfig({ monto: 50, montoPuntual: 60, diasPuntual: 5 }).error, /no puede ser mayor/i)
    assert.match(validarConfig({ monto: 60, montoPuntual: 55, diasPuntual: 0 }).error, /días/i)
    assert.match(validarConfig({ monto: 60, montoPuntual: 55, diasPuntual: 29 }).error, /días/i)
    assert.match(validarConfig({ monto: 60, montoPuntual: 55, diasPuntual: 2.5 }).error, /días/i)
    assert.match(validarConfig({ monto: -1, montoPuntual: 55, diasPuntual: 5 }).error, /monto/i)
    assert.match(validarConfig(null).error, /monto/i)
})
