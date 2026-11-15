const { test, describe } = require('node:test')
const assert = require('node:assert/strict')
const { crearProveedorSimulado } = require('../src/lib/pagos/proveedores/simulado')

const ENTRADA = { pagoId: 'p1', montoCentavos: 1500, referencia: 'Alquiler Casa Club 2026-11-20', urlRetorno: 'http://localhost:5173/pagos/retorno?pago=p1' }

// Reloj falso: las pruebas "esperan" minutos sin esperar de verdad.
function reloj(inicio = '2026-11-16T15:00:00Z') {
    let ahora = new Date(inicio).getTime()
    return { ahora: () => new Date(ahora), avanzarMinutos: (m) => { ahora += m * 60000 } }
}

async function cobroCon(caso, opciones = {}) {
    const proveedor = crearProveedorSimulado({ guion: caso ? { p1: caso } : {}, ...opciones })
    const cobro = await proveedor.crearCobro({ ...ENTRADA })
    return { proveedor, cobro }
}

describe('SIMULADO: casos del guion (prueba 18)', () => {
    test('crearCobro devuelve una redirección de vuelta a urlRetorno marcada como simulada', async () => {
        const { cobro } = await cobroCon()
        assert.deepEqual(cobro, { tipo: 'REDIRECCION', url: `${ENTRADA.urlRetorno}&simulado=1`, idExterno: 'SIM-p1' })
    })

    test('aprobado (por defecto)', async () => {
        const { proveedor, cobro } = await cobroCon()
        assert.deepEqual(await proveedor.confirmarCobro({ idExterno: cobro.idExterno }), { estado: 'APROBADO', idExterno: 'SIM-p1', montoCentavos: 1500 })
    })

    test('rechazado', async () => {
        const { proveedor, cobro } = await cobroCon('RECHAZADO')
        assert.equal((await proveedor.confirmarCobro({ idExterno: cobro.idExterno })).estado, 'RECHAZADO')
    })

    test('tardío: PENDIENTE al confirmar y APROBADO al consultar después de que avanza el reloj', async () => {
        const r = reloj()
        const { proveedor, cobro } = await cobroCon('TARDIO', { ahora: r.ahora })
        assert.equal((await proveedor.confirmarCobro({ idExterno: cobro.idExterno })).estado, 'PENDIENTE')
        assert.equal((await proveedor.consultarEstado(cobro.idExterno)).estado, 'PENDIENTE')
        r.avanzarMinutos(3)
        assert.deepEqual(await proveedor.consultarEstado(cobro.idExterno), { estado: 'APROBADO', idExterno: 'SIM-p1', montoCentavos: 1500 })
    })

    test('duplicado: dos confirmaciones dan dos cobros aprobados con idExterno distintos', async () => {
        const { proveedor, cobro } = await cobroCon('DUPLICADO')
        const primera = await proveedor.confirmarCobro({ idExterno: cobro.idExterno })
        const segunda = await proveedor.confirmarCobro({ idExterno: cobro.idExterno })
        assert.equal(primera.estado, 'APROBADO')
        assert.equal(segunda.estado, 'APROBADO')
        assert.notEqual(primera.idExterno, segunda.idExterno)
    })

    test('monto distinto: aprueba con otro monto (el núcleo no debe aplicarlo)', async () => {
        const { proveedor, cobro } = await cobroCon('MONTO_DISTINTO')
        const respuesta = await proveedor.confirmarCobro({ idExterno: cobro.idExterno })
        assert.equal(respuesta.estado, 'APROBADO')
        assert.notEqual(respuesta.montoCentavos, 1500)
    })

    test('caída: PENDIENTE, como un timeout', async () => {
        const { proveedor, cobro } = await cobroCon('CAIDA')
        assert.equal((await proveedor.confirmarCobro({ idExterno: cobro.idExterno })).estado, 'PENDIENTE')
        assert.equal((await proveedor.consultarEstado(cobro.idExterno)).estado, 'PENDIENTE')
    })
})

describe('SIMULADO: demo y casos de borde', () => {
    test('sin guion, los botones de la demo eligen el resultado', async () => {
        const { proveedor, cobro } = await cobroCon()
        assert.equal((await proveedor.confirmarCobro({ idExterno: cobro.idExterno, resultado: 'RECHAZADO' })).estado, 'RECHAZADO')
    })

    test('con guion, el guion manda aunque el navegador pida otro resultado', async () => {
        const { proveedor, cobro } = await cobroCon('RECHAZADO')
        assert.equal((await proveedor.confirmarCobro({ idExterno: cobro.idExterno, resultado: 'APROBADO' })).estado, 'RECHAZADO')
    })

    test('confirmar un cobro que no existe → RECHAZADO, sin lanzar', async () => {
        const { proveedor } = await cobroCon()
        assert.equal((await proveedor.confirmarCobro({ idExterno: 'SIM-otro' })).estado, 'RECHAZADO')
        assert.equal((await proveedor.confirmarCobro()).estado, 'RECHAZADO')
    })

    test('consultar después de aprobar devuelve APROBADO otra vez (idempotente)', async () => {
        const { proveedor, cobro } = await cobroCon()
        await proveedor.confirmarCobro({ idExterno: cobro.idExterno })
        assert.equal((await proveedor.consultarEstado(cobro.idExterno)).estado, 'APROBADO')
    })

    test('revertir: solo un cobro aprobado se reversa', async () => {
        const { proveedor, cobro } = await cobroCon()
        assert.equal((await proveedor.revertir(cobro.idExterno)).estado, 'NO_REVERSADO')
        await proveedor.confirmarCobro({ idExterno: cobro.idExterno })
        assert.equal((await proveedor.revertir(cobro.idExterno)).estado, 'REVERSADO')
        assert.equal((await proveedor.revertir(cobro.idExterno)).estado, 'NO_REVERSADO')
    })

    test('un caso desconocido en el guion es un error de configuración', async () => {
        const proveedor = crearProveedorSimulado({ guion: { p1: 'INVENTADO' } })
        await assert.rejects(() => proveedor.crearCobro({ ...ENTRADA }), /Caso de simulación desconocido/)
    })

    test('capacidades del diseño: no está disponible en producción', () => {
        const { capacidades } = crearProveedorSimulado()
        assert.deepEqual(capacidades, {
            tipo: 'REDIRECCION', confirmaQuien: 'PAGADOR', soportaReversoMismoDia: true, soportaConsulta: true,
            vigenciaMinutos: 15, admiteEvidencia: false, disponibleEnProduccion: false
        })
    })
})
