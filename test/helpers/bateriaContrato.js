// Batería de contrato (pruebas 15 a 17 del diseño de pagos). La misma batería
// corre contra cada proveedor: hoy SIMULADO y TRANSFERENCIA_MANUAL; el adaptador
// real, cuando se decida, tendrá que pasarla sin cambios.
const { test, describe } = require('node:test')
const assert = require('node:assert/strict')
const { validarProveedor, RESULTADOS_CONFIRMACION } = require('../../src/lib/pagos/contrato')

const ENTRADA = Object.freeze({
    pagoId: 'pago-contrato-1',
    montoCentavos: 1500,
    referencia: 'Alquiler Casa Club 2026-11-20',
    urlRetorno: 'http://localhost:5173/pagos/retorno?pago=pago-contrato-1'
})

// opciones.crear(escenario) devuelve un proveedor nuevo preparado para ese escenario.
// opciones.escenarios: { nombre: (cobro, entrada) => parámetros de retorno }.
// Debe existir el escenario 'aprobado'; los demás son resultados del pagador (rechazo, caída, tardío...).
function probarContratoProveedor(nombre, { crear, escenarios }) {
    describe(`contrato de proveedor: ${nombre}`, () => {
        test('cumple la forma del contrato (prueba 14)', () => {
            assert.deepEqual(validarProveedor(crear('aprobado')), [])
        })

        test('crearCobro devuelve el tipo de sus capacidades y un idExterno (prueba 15)', async () => {
            const proveedor = crear('aprobado')
            const cobro = await proveedor.crearCobro({ ...ENTRADA })
            assert.equal(cobro.tipo, proveedor.capacidades.tipo)
            assert.equal(typeof cobro.idExterno, 'string')
            assert.ok(cobro.idExterno.length > 0)
            if (cobro.tipo === 'REDIRECCION') assert.equal(typeof cobro.url, 'string')
        })

        test('el escenario aprobado devuelve APROBADO con el mismo idExterno y monto', async () => {
            const proveedor = crear('aprobado')
            const cobro = await proveedor.crearCobro({ ...ENTRADA })
            const respuesta = await proveedor.confirmarCobro(escenarios.aprobado(cobro, ENTRADA))
            assert.deepEqual(
                { estado: respuesta.estado, idExterno: respuesta.idExterno, montoCentavos: respuesta.montoCentavos },
                { estado: 'APROBADO', idExterno: cobro.idExterno, montoCentavos: ENTRADA.montoCentavos }
            )
        })

        for (const [escenario, parametros] of Object.entries(escenarios)) {
            test(`${escenario}: confirmarCobro no lanza y solo da APROBADO, RECHAZADO o PENDIENTE (pruebas 16 y 17)`, async () => {
                const proveedor = crear(escenario)
                const cobro = await proveedor.crearCobro({ ...ENTRADA })
                const respuesta = await proveedor.confirmarCobro(parametros(cobro, ENTRADA))
                assert.ok(RESULTADOS_CONFIRMACION.includes(respuesta.estado), `estado recibido: ${respuesta.estado}`)
            })
        }

        test('consultarEstado tampoco lanza y da un resultado válido', async () => {
            const proveedor = crear('aprobado')
            const cobro = await proveedor.crearCobro({ ...ENTRADA })
            const respuesta = await proveedor.consultarEstado(cobro.idExterno)
            assert.ok(RESULTADOS_CONFIRMACION.includes(respuesta.estado))
        })

        test('crearCobro con un monto inválido lanza (es un error de quien llama, no del pagador)', async () => {
            const proveedor = crear('aprobado')
            await assert.rejects(() => proveedor.crearCobro({ ...ENTRADA, montoCentavos: 15.5 }), /montoCentavos/)
        })
    })
}

module.exports = { probarContratoProveedor, ENTRADA }
