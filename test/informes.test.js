const { test } = require('node:test')
const assert = require('node:assert/strict')
const { parsearDestinatarios, dividirEnLotes, validarInforme, validarRemitente, mensajeAHtml, plantillaInforme, DESTINATARIOS_POR_CORREO } = require('../src/lib/informes')

test('lee correos separados por punto y coma, coma o salto de línea', () => {
    const { validos, invalidos } = parsearDestinatarios('a@x.com; b@x.com,c@x.com\nd@x.com ;')
    assert.deepEqual(validos, ['a@x.com', 'b@x.com', 'c@x.com', 'd@x.com'])
    assert.deepEqual(invalidos, [])
})

test('pasa a minúsculas, quita espacios y no repite correos', () => {
    const { validos } = parsearDestinatarios(' Ana@X.com ; ana@x.COM ;b@x.com')
    assert.deepEqual(validos, ['ana@x.com', 'b@x.com'])
})

test('separa las direcciones sin formato de correo', () => {
    const { validos, invalidos } = parsearDestinatarios('ok@x.com; sinarroba; otro@; @x.com')
    assert.deepEqual(validos, ['ok@x.com'])
    assert.deepEqual(invalidos, ['sinarroba', 'otro@', '@x.com'])
})

test('un texto vacío no da destinatarios', () => {
    assert.deepEqual(parsearDestinatarios(''), { validos: [], invalidos: [] })
    assert.deepEqual(parsearDestinatarios(undefined), { validos: [], invalidos: [] })
})

test('divide en tandas del tamaño que admite Resend', () => {
    const lista = Array.from({ length: 120 }, (_, i) => `u${i}@x.com`)
    const lotes = dividirEnLotes(lista)
    assert.equal(DESTINATARIOS_POR_CORREO, 49)
    assert.deepEqual(lotes.map(l => l.length), [49, 49, 22])
    assert.equal(dividirEnLotes([]).length, 0)
})

const base = { asunto: 'Informe octubre', texto: 'Adjunto el informe', imagenes: [], enviarCorreo: true, publicar: false, destinatarios: ['a@x.com'], adjuntos: [] }

test('un informe completo es válido', () => assert.equal(validarInforme(base), null))

test('pide asunto y mensaje', () => {
    assert.match(validarInforme({ ...base, asunto: '  ' }), /asunto/i)
    assert.match(validarInforme({ ...base, texto: '' }), /mensaje/i)
})

test('exige enviar por correo o publicar', () => {
    assert.match(validarInforme({ ...base, enviarCorreo: false, publicar: false }), /al menos una opción/)
    assert.equal(validarInforme({ ...base, enviarCorreo: false, publicar: true, destinatarios: [] }), null)
})

test('para enviar por correo hacen falta destinatarios', () => {
    assert.match(validarInforme({ ...base, destinatarios: [] }), /destinatarios/)
})

test('limita cantidad y peso de los adjuntos', () => {
    const f = (size) => ({ size })
    assert.match(validarInforme({ ...base, adjuntos: Array(6).fill(f(1)) }), /hasta 5/)
    assert.match(validarInforme({ ...base, adjuntos: [f(15 * 1024 * 1024), f(10 * 1024 * 1024)] }), /20 MB/)
    assert.equal(validarInforme({ ...base, adjuntos: [f(1024)] }), null)
})

test('limita el número de destinatarios por envío', () => {
    const muchos = Array.from({ length: 601 }, (_, i) => `u${i}@x.com`)
    assert.match(validarInforme({ ...base, destinatarios: muchos }), /600/)
})

test('el mensaje se escapa: no se interpreta como HTML', () => {
    assert.equal(mensajeAHtml('<script>alert(1)</script>\nlinea 2'), '&lt;script&gt;alert(1)&lt;/script&gt;<br>linea 2')
    const html = plantillaInforme({ asunto: '<b>x</b>', cuerpoHtml: '<p>hola</p>', logoUrl: 'https://l/logo.png' })
    assert.ok(!html.includes('<b>x</b>'))
    assert.ok(html.includes('&lt;b&gt;x&lt;/b&gt;'))
    assert.ok(html.includes('<p>hola</p>'))
})

test('un mensaje con solo una imagen es válido, y las imágenes cuentan para el peso total', () => {
    assert.equal(validarInforme({ ...base, texto: '', imagenes: [{ buffer: Buffer.alloc(10) }] }), null)
    assert.match(validarInforme({ ...base, imagenes: [{ buffer: Buffer.alloc(21 * 1024 * 1024) }] }), /20 MB/)
    assert.match(validarInforme({ ...base, imagenes: Array(11).fill({ buffer: Buffer.alloc(1) }) }), /10 imágenes/)
})

test('remitente: por defecto contabilidad; editable solo dentro del dominio verificado', () => {
    const opciones = { correoPorDefecto: 'contabilidad@urbvolare.com' }
    assert.deepEqual(validarRemitente({}, opciones).remitente, { nombre: 'Contabilidad Urbanización Volare', correo: 'contabilidad@urbvolare.com' })
    assert.deepEqual(validarRemitente({ nombre: 'Administración', correo: ' Admin@UrbVolare.com ' }, opciones).remitente, { nombre: 'Administración', correo: 'admin@urbvolare.com' })
    assert.match(validarRemitente({ correo: 'alguien@gmail.com' }, opciones).error, /@urbvolare.com/)
    assert.match(validarRemitente({ correo: 'sin-arroba' }, opciones).error, /formato/)
    assert.match(validarRemitente({ correo: 'a@urbvolare.com.evil.com' }, opciones).error, /@urbvolare.com/)
})

test('el nombre del remitente no puede romper el encabezado del correo', () => {
    const { remitente } = validarRemitente({ nombre: 'Falso\r\nBcc: x@y.com <a@b.com>' }, { correoPorDefecto: 'c@urbvolare.com' })
    assert.ok(!/[\r\n<>"]/.test(remitente.nombre))
})
