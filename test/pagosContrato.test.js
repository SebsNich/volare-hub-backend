const { test, describe } = require('node:test')
const assert = require('node:assert/strict')
const { validarProveedor } = require('../src/lib/pagos/contrato')
const { crearProveedorSimulado } = require('../src/lib/pagos/proveedores/simulado')
const { probarContratoProveedor, ENTRADA } = require('./helpers/bateriaContrato')

function proveedorValido(cambios = {}) {
    return {
        codigo: 'PRUEBA',
        capacidades: {
            tipo: 'MANUAL', confirmaQuien: 'ADMIN', soportaReversoMismoDia: false, soportaConsulta: false,
            vigenciaMinutos: null, admiteEvidencia: true, disponibleEnProduccion: true,
            ...cambios.capacidades
        },
        crearCobro: async () => ({}),
        confirmarCobro: async () => ({}),
        consultarEstado: async () => ({}),
        ...cambios.raiz
    }
}

describe('validarProveedor (prueba 14)', () => {
    test('un proveedor completo no tiene errores', () => {
        assert.deepEqual(validarProveedor(proveedorValido()), [])
    })
    test('sin codigo, sin capacidades o sin funciones requeridas', () => {
        assert.match(validarProveedor(proveedorValido({ raiz: { codigo: '' } })).join(), /codigo/)
        assert.match(validarProveedor({ ...proveedorValido(), capacidades: undefined }).join(), /capacidades/)
        assert.match(validarProveedor(proveedorValido({ raiz: { confirmarCobro: 'no' } })).join(), /confirmarCobro/)
        assert.match(validarProveedor(null).join(), /objeto/)
    })
    test('capacidades con valores fuera de lo permitido', () => {
        assert.match(validarProveedor(proveedorValido({ capacidades: { tipo: 'QR' } })).join(), /tipo/)
        assert.match(validarProveedor(proveedorValido({ capacidades: { confirmaQuien: 'TODOS' } })).join(), /confirmaQuien/)
        assert.match(validarProveedor(proveedorValido({ capacidades: { vigenciaMinutos: 0 } })).join(), /vigenciaMinutos/)
        assert.match(validarProveedor(proveedorValido({ capacidades: { admiteEvidencia: 'sí' } })).join(), /admiteEvidencia/)
    })
    test('si dice que soporta reverso, tiene que tener revertir', () => {
        assert.match(validarProveedor(proveedorValido({ capacidades: { soportaReversoMismoDia: true } })).join(), /revertir/)
        assert.deepEqual(validarProveedor(proveedorValido({ capacidades: { soportaReversoMismoDia: true }, raiz: { revertir: async () => ({}) } })), [])
    })
})

// Escenarios del SIMULADO: el guion decide el resultado de cada pagoId.
probarContratoProveedor('SIMULADO', {
    crear: (escenario) => crearProveedorSimulado({
        guion: { [ENTRADA.pagoId]: { aprobado: 'APROBADO', rechazado: 'RECHAZADO', caida: 'CAIDA', tardio: 'TARDIO' }[escenario] }
    }),
    escenarios: {
        aprobado: (cobro) => ({ idExterno: cobro.idExterno }),
        rechazado: (cobro) => ({ idExterno: cobro.idExterno }),
        caida: (cobro) => ({ idExterno: cobro.idExterno }),
        tardio: (cobro) => ({ idExterno: cobro.idExterno })
    }
})
