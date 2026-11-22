const { test } = require('node:test')
const assert = require('node:assert/strict')
const { carpetas } = require('../src/lib/carpetas')

const prod = carpetas({ NODE_ENV: 'production' })
const dev = carpetas({ NODE_ENV: 'development' })

test('cada tipo de imagen va a una carpeta que dice de qué es', () => {
    assert.equal(prod.perfil(), 'volare-hub/perfiles/fotos')
    assert.equal(prod.publicacion('imagen'), 'volare-hub/publicaciones/imagenes')
    assert.equal(prod.publicacion('documento'), 'volare-hub/publicaciones/documentos')
    assert.equal(prod.reserva('CASA_CLUB', 'comprobantes'), 'volare-hub/reservas/casa-club/comprobantes')
    assert.equal(prod.reserva('CABANA_RIO', 'documentos'), 'volare-hub/reservas/cabanas/documentos')
    assert.equal(prod.pago('RESERVA'), 'volare-hub/pagos/reservas/transferencias')
    assert.equal(prod.pago('ALICUOTA'), 'volare-hub/pagos/alicuotas/transferencias')
})

test('fuera de producción todo cuelga de otra raíz para no mezclar pruebas con datos reales', () => {
    assert.equal(dev.perfil(), 'volare-hub-dev/perfiles/fotos')
    assert.equal(dev.pago('ALICUOTA'), 'volare-hub-dev/pagos/alicuotas/transferencias')
})

test('un tipo desconocido falla en voz alta en vez de subir a una carpeta inventada', () => {
    assert.throws(() => prod.pago('OTRO'), /pago/)
    assert.throws(() => prod.reserva('CASA_CLUB', 'x'), /reserva/)
    assert.throws(() => prod.publicacion('x'), /publicaci/)
})

test('los envíos masivos tienen su propia carpeta, separada de las publicaciones', () => {
    assert.equal(prod.envioMasivo('imagen'), 'volare-hub/envios-masivos/imagenes')
    assert.equal(prod.envioMasivo('documento'), 'volare-hub/envios-masivos/documentos')
    assert.equal(dev.envioMasivo('imagen'), 'volare-hub-dev/envios-masivos/imagenes')
    assert.throws(() => prod.envioMasivo('otro'), /desconocido/)
})
