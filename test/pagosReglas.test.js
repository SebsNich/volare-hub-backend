const { test, describe } = require('node:test')
const assert = require('node:assert/strict')
const {
    puedePagarReserva,
    puedePagarCuota,
    puedeConfirmar,
    respuestaCoincide,
    normalizarVilla,
    referenciaLegible,
    MINUTOS_PAGO_EN_LINEA,
    LARGO_MAX_REFERENCIA
} = require('../src/lib/pagos/reglasPago')

const CREADA = new Date('2026-11-16T15:00:00Z')
const minutosDespues = (m) => new Date(CREADA.getTime() + m * 60000)

const EN_LINEA = { capacidades: { tipo: 'REDIRECCION', confirmaQuien: 'PAGADOR' } }
const MANUAL = { capacidades: { tipo: 'MANUAL', confirmaQuien: 'ADMIN' } }

const dueno = { id: 'u1', rol: 'RESIDENTE', activo: true, estadoCuenta: 'APROBADA', manzana: 'A', villa: '3' }
const otro = { id: 'u2', rol: 'RESIDENTE', activo: true, estadoCuenta: 'APROBADA', manzana: 'B', villa: '7' }
const admin = { id: 'adm', rol: 'ADMIN', activo: true, estadoCuenta: 'APROBADA' }
const reserva = { id: 'r1', usuarioId: 'u1', estado: 'PENDIENTE', creadoEn: CREADA }

function pagarReserva(cambios = {}) {
    return puedePagarReserva({
        reserva, usuario: dueno, concepto: 'ALQUILER', pagos: [], proveedor: EN_LINEA, ahora: minutosDespues(1),
        ...cambios
    })
}

describe('puedePagarReserva (prueba 9)', () => {
    test('el dueño con la reserva PENDIENTE puede pagar', () => {
        assert.deepEqual(pagarReserva(), { permitido: true })
    })
    test('otro usuario no', () => {
        assert.equal(pagarReserva({ usuario: otro }).permitido, false)
    })
    test('una reserva APROBADA o RECHAZADA no', () => {
        assert.equal(pagarReserva({ reserva: { ...reserva, estado: 'APROBADA' } }).permitido, false)
        assert.equal(pagarReserva({ reserva: { ...reserva, estado: 'RECHAZADA' } }).permitido, false)
    })
    test('un concepto que ya tiene un pago APROBADO no', () => {
        const pagos = [{ concepto: 'ALQUILER', estado: 'APROBADO' }]
        assert.equal(pagarReserva({ pagos }).permitido, false)
        // La garantía todavía se puede pagar aunque el alquiler esté aprobado.
        assert.equal(pagarReserva({ pagos, concepto: 'GARANTIA', proveedor: MANUAL }).permitido, true)
    })
    test('un pago RECHAZADO anterior no impide reintentar', () => {
        assert.equal(pagarReserva({ pagos: [{ concepto: 'ALQUILER', estado: 'RECHAZADO' }] }).permitido, true)
    })
    test('la GARANTIA no se paga con un proveedor de redirección: va por transferencia', () => {
        assert.equal(pagarReserva({ concepto: 'GARANTIA' }).permitido, false)
        assert.equal(pagarReserva({ concepto: 'GARANTIA', proveedor: MANUAL }).permitido, true)
    })
    test('un concepto desconocido no', () => {
        assert.equal(pagarReserva({ concepto: 'ALICUOTA' }).permitido, false)
    })
    test(`en línea, solo dentro de ${MINUTOS_PAGO_EN_LINEA} minutos desde la creación de la reserva (decisión 2)`, () => {
        assert.equal(pagarReserva({ ahora: minutosDespues(14) }).permitido, true)
        assert.equal(pagarReserva({ ahora: minutosDespues(15) }).permitido, false)
        // La transferencia no tiene ese límite.
        assert.equal(pagarReserva({ proveedor: MANUAL, ahora: minutosDespues(600) }).permitido, true)
    })
    test('cuando no se permite, dice por qué', () => {
        assert.match(pagarReserva({ usuario: otro }).motivo, /\S/)
    })
})

describe('puedePagarCuota (prueba 10)', () => {
    const cuota = { id: 'c1', manzana: 'A', villa: '3', estado: 'PENDIENTE' }
    test('la misma villa escrita distinto ("a ", "A") sí', () => {
        const usuario = { ...dueno, manzana: 'a ', villa: ' 3' }
        assert.deepEqual(puedePagarCuota({ cuota, usuario }), { permitido: true })
    })
    test('otra villa no', () => {
        assert.equal(puedePagarCuota({ cuota, usuario: otro }).permitido, false)
    })
    test('un residente sin manzana o sin villa no', () => {
        assert.equal(puedePagarCuota({ cuota, usuario: { ...dueno, villa: null } }).permitido, false)
        assert.equal(puedePagarCuota({ cuota, usuario: { ...dueno, manzana: '  ' } }).permitido, false)
    })
    test('una cuota PAGADA o ANULADA no', () => {
        assert.equal(puedePagarCuota({ cuota: { ...cuota, estado: 'PAGADA' }, usuario: dueno }).permitido, false)
        assert.equal(puedePagarCuota({ cuota: { ...cuota, estado: 'ANULADA' }, usuario: dueno }).permitido, false)
    })
    test('una cuenta inactiva o no aprobada no', () => {
        assert.equal(puedePagarCuota({ cuota, usuario: { ...dueno, activo: false } }).permitido, false)
        assert.equal(puedePagarCuota({ cuota, usuario: { ...dueno, estadoCuenta: 'PENDIENTE' } }).permitido, false)
    })
})

describe('puedeConfirmar (prueba 11)', () => {
    const pago = { id: 'p1', usuarioId: 'u1' }
    test('PAGADOR: solo el dueño del pago', () => {
        assert.equal(puedeConfirmar({ pago, usuario: dueno, proveedor: EN_LINEA }), true)
        assert.equal(puedeConfirmar({ pago, usuario: otro, proveedor: EN_LINEA }), false)
        assert.equal(puedeConfirmar({ pago, usuario: admin, proveedor: EN_LINEA }), false)
    })
    test('ADMIN: solo un admin, nunca el residente que pagó', () => {
        assert.equal(puedeConfirmar({ pago, usuario: admin, proveedor: MANUAL }), true)
        assert.equal(puedeConfirmar({ pago, usuario: dueno, proveedor: MANUAL }), false)
    })
    test('sin usuario o con un confirmaQuien desconocido, no', () => {
        assert.equal(puedeConfirmar({ pago, usuario: null, proveedor: EN_LINEA }), false)
        assert.equal(puedeConfirmar({ pago, usuario: admin, proveedor: { capacidades: { confirmaQuien: 'TODOS' } } }), false)
    })
})

describe('respuestaCoincide (prueba 12)', () => {
    const pago = { idExterno: 'SIM-p1', montoCentavos: 1500 }
    test('mismo idExterno y mismo monto → coincide', () => {
        assert.equal(respuestaCoincide(pago, { idExterno: 'SIM-p1', montoCentavos: 1500 }), true)
    })
    test('otro idExterno o un centavo de diferencia → no coincide', () => {
        assert.equal(respuestaCoincide(pago, { idExterno: 'SIM-p2', montoCentavos: 1500 }), false)
        assert.equal(respuestaCoincide(pago, { idExterno: 'SIM-p1', montoCentavos: 1501 }), false)
        assert.equal(respuestaCoincide(pago, { idExterno: 'SIM-p1', montoCentavos: '1500' }), false)
        assert.equal(respuestaCoincide(pago, {}), false)
    })
})

describe('normalizarVilla y referenciaLegible (prueba 13)', () => {
    test('normalizarVilla quita espacios y pasa a mayúsculas; vacío → null', () => {
        assert.equal(normalizarVilla('  a  '), 'A')
        assert.equal(normalizarVilla('12 b'), '12 B')
        assert.equal(normalizarVilla('12   b'), '12 B')
        assert.equal(normalizarVilla('   '), null)
        assert.equal(normalizarVilla(null), null)
    })
    test('referencias de reserva y de alícuota', () => {
        assert.equal(referenciaLegible({ concepto: 'ALQUILER', espacio: 'CASA_CLUB', fecha: new Date('2026-11-20T00:00:00Z') }), 'Alquiler Casa Club 2026-11-20')
        assert.equal(referenciaLegible({ concepto: 'GARANTIA', espacio: 'CABANA_ARBOL', fecha: '2026-11-21' }), 'Garantía Cabaña del Árbol 2026-11-21')
        assert.equal(referenciaLegible({ concepto: 'ALICUOTA', periodo: '2026-11', manzana: 'a', villa: '3' }), 'Alícuota 2026-11 Mz A V 3')
    })
    test('no incluye datos personales aunque vengan en la entrada', () => {
        const texto = referenciaLegible({
            concepto: 'ALQUILER', espacio: 'CASA_CLUB', fecha: '2026-11-20',
            nombres: 'Ana', correo: 'ana@ejemplo.com', cedula: '0912345678'
        })
        assert.doesNotMatch(texto, /Ana|ejemplo|0912345678/)
    })
    test(`respeta el largo máximo (${LARGO_MAX_REFERENCIA})`, () => {
        const texto = referenciaLegible({ concepto: 'ALICUOTA', periodo: '2026-11', manzana: 'M'.repeat(200), villa: 'V'.repeat(200) })
        assert.ok(texto.length <= LARGO_MAX_REFERENCIA)
    })
    test('un concepto desconocido lanza error', () => {
        assert.throws(() => referenciaLegible({ concepto: 'OTRO' }), /Concepto de pago desconocido/)
    })
})
