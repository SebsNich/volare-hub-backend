const { test, describe } = require('node:test')
const assert = require('node:assert/strict')
const { crearProveedorTransferenciaManual } = require('../src/lib/pagos/proveedores/transferenciaManual')
const { probarContratoProveedor } = require('./helpers/bateriaContrato')

const ENTRADA = { pagoId: 'p9', montoCentavos: 8000, referencia: 'Garantía Casa Club 2026-11-20', urlRetorno: 'http://localhost:5173/pagos/retorno?pago=p9' }
const CUENTAS = [{ banco: 'Banco de prueba', tipo: 'AHORROS', numero: '000000' }]

// El proveedor manual no guarda estado: el núcleo le pasa idExterno y monto del Pago.
const decision = (decision, motivo) => (cobro, entrada) => ({ idExterno: cobro.idExterno, montoCentavos: entrada.montoCentavos, decision, motivo })

probarContratoProveedor('TRANSFERENCIA_MANUAL', {
    crear: () => crearProveedorTransferenciaManual({ cuentas: CUENTAS }),
    escenarios: {
        aprobado: decision('APROBAR'),
        rechazado: decision('RECHAZAR', 'El comprobante no corresponde al monto')
    }
})

describe('TRANSFERENCIA_MANUAL (prueba 19)', () => {
    const proveedor = crearProveedorTransferenciaManual({ cuentas: CUENTAS })

    test('crearCobro devuelve las instrucciones de transferencia, sin redirección', async () => {
        assert.deepEqual(await proveedor.crearCobro({ ...ENTRADA }), {
            tipo: 'MANUAL',
            idExterno: 'TM-p9',
            instrucciones: { cuentas: CUENTAS, montoCentavos: 8000, referencia: 'Garantía Casa Club 2026-11-20' }
        })
    })

    test('APROBAR → APROBADO con el idExterno y el monto del pago', async () => {
        assert.deepEqual(
            await proveedor.confirmarCobro({ idExterno: 'TM-p9', montoCentavos: 8000, decision: 'APROBAR' }),
            { estado: 'APROBADO', idExterno: 'TM-p9', montoCentavos: 8000 }
        )
    })

    test('RECHAZAR con motivo → RECHAZADO y el motivo va en el detalle', async () => {
        assert.deepEqual(
            await proveedor.confirmarCobro({ idExterno: 'TM-p9', montoCentavos: 8000, decision: 'RECHAZAR', motivo: '  Comprobante ilegible ' }),
            { estado: 'RECHAZADO', idExterno: 'TM-p9', montoCentavos: 8000, detalle: { motivo: 'Comprobante ilegible' } }
        )
    })

    test('RECHAZAR sin motivo → error de validación (lo corrige el admin, no es un resultado)', async () => {
        for (const motivo of [undefined, '', '   ']) {
            await assert.rejects(
                () => proveedor.confirmarCobro({ idExterno: 'TM-p9', montoCentavos: 8000, decision: 'RECHAZAR', motivo }),
                (error) => error.codigo === 'VALIDACION_PAGO' && /motivo/.test(error.message)
            )
        }
    })

    test('una decisión desconocida o sin idExterno → error de validación', async () => {
        await assert.rejects(() => proveedor.confirmarCobro({ idExterno: 'TM-p9', montoCentavos: 8000, decision: 'QUIZAS' }), /decision/)
        await assert.rejects(() => proveedor.confirmarCobro({ montoCentavos: 8000, decision: 'APROBAR' }), /idExterno/)
    })

    test('consultarEstado → PENDIENTE: la verdad está en la base, no hay sistema externo', async () => {
        assert.deepEqual(await proveedor.consultarEstado('TM-p9'), { estado: 'PENDIENTE', idExterno: 'TM-p9', montoCentavos: null })
    })

    test('capacidades: confirma el admin, admite comprobantes, no vence y no se reversa', () => {
        assert.deepEqual(proveedor.capacidades, {
            tipo: 'MANUAL', confirmaQuien: 'ADMIN', soportaReversoMismoDia: false, soportaConsulta: false,
            vigenciaMinutos: null, admiteEvidencia: true, disponibleEnProduccion: true
        })
        assert.equal(proveedor.revertir, undefined)
    })
})
