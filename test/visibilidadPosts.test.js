const { test } = require('node:test')
const assert = require('node:assert/strict')
const { esCuentaAprobada, filtroVisibilidad, puedeVerPost } = require('../src/lib/visibilidadPosts')

test('una cuenta aprobada y un administrador ven todo', () => {
    assert.deepEqual(filtroVisibilidad({ rol: 'RESIDENTE', estadoCuenta: 'APROBADA' }), {})
    assert.deepEqual(filtroVisibilidad({ rol: 'ADMIN', estadoCuenta: 'PENDIENTE' }), {})
})

test('una cuenta pendiente, rechazada o desconocida no ve lo reservado a aprobados', () => {
    const esperado = { soloAprobados: false }
    assert.deepEqual(filtroVisibilidad({ rol: 'RESIDENTE', estadoCuenta: 'PENDIENTE' }), esperado)
    assert.deepEqual(filtroVisibilidad({ rol: 'RESIDENTE', estadoCuenta: 'RECHAZADA' }), esperado)
    assert.deepEqual(filtroVisibilidad(undefined), esperado)
})

test('puedeVerPost respeta la marca soloAprobados', () => {
    const reservado = { soloAprobados: true }
    assert.equal(puedeVerPost(reservado, { rol: 'RESIDENTE', estadoCuenta: 'PENDIENTE' }), false)
    assert.equal(puedeVerPost(reservado, { rol: 'RESIDENTE', estadoCuenta: 'APROBADA' }), true)
    assert.equal(puedeVerPost({ soloAprobados: false }, { rol: 'RESIDENTE', estadoCuenta: 'PENDIENTE' }), true)
    assert.equal(esCuentaAprobada(null), false)
})
