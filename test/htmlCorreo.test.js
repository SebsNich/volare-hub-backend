const { test } = require('node:test')
const assert = require('node:assert/strict')
const { limpiarHtmlCorreo, htmlATexto } = require('../src/lib/htmlCorreo')

test('conserva el formato permitido: negrita, cursiva, listas y títulos', () => {
    const { html } = limpiarHtmlCorreo('<p>Hola <b>mundo</b> <i>hoy</i></p><ul><li>uno</li></ul><h2>Título</h2>')
    assert.match(html, /<b>mundo<\/b>/)
    assert.match(html, /<i>hoy<\/i>/)
    assert.match(html, /<ul[^>]*><li[^>]*>uno<\/li><\/ul>/)
    assert.match(html, /<h2[^>]*>Título<\/h2>/)
})

test('elimina scripts, estilos, eventos y etiquetas no permitidas', () => {
    const { html } = limpiarHtmlCorreo('<script>alert(1)</script><p onclick="x()" style="color:red">Hola</p><iframe src="https://x"></iframe><font color="red">f</font>')
    assert.doesNotMatch(html, /script|onclick|iframe|font|color:red/i)
    assert.match(html, /Hola/)
})

test('los enlaces solo pueden ser http, https o mailto y se abren en otra pestaña', () => {
    const bueno = limpiarHtmlCorreo('<a href="https://urbvolare.com/x?a=1&b=2">ver</a>').html
    assert.match(bueno, /href="https:\/\/urbvolare.com\/x\?a=1&amp;b=2"/)
    assert.match(bueno, /rel="noopener noreferrer"/)
    const malo = limpiarHtmlCorreo('<a href="javascript:alert(1)">ver</a><a href="data:text/html,x">otro</a>').html
    assert.doesNotMatch(malo, /<a|javascript|data:/)
    assert.match(malo, /ver/)
})

test('una imagen pegada en el texto sale como adjunto en línea (cid)', () => {
    const png = Buffer.from('imagen-falsa').toString('base64')
    const { html, imagenes } = limpiarHtmlCorreo(`<p>Hola</p><img src="data:image/png;base64,${png}" alt="Logo">`)
    assert.equal(imagenes.length, 1)
    assert.equal(imagenes[0].contentId, 'imagen-1')
    assert.equal(imagenes[0].buffer.toString(), 'imagen-falsa')
    assert.match(html, /src="cid:imagen-1"/)
    assert.doesNotMatch(html, /base64/)
})

test('imágenes con origen raro se descartan; las https se dejan', () => {
    assert.doesNotMatch(limpiarHtmlCorreo('<img src="javascript:x">').html, /<img/)
    assert.doesNotMatch(limpiarHtmlCorreo('<img src="data:image/svg+xml;base64,AAAA">').html, /<img/)
    assert.match(limpiarHtmlCorreo('<img src="https://res.cloudinary.com/a.png">').html, /<img src="https:\/\/res.cloudinary.com\/a.png"/)
})

test('cierra las etiquetas abiertas y escapa los < sueltos', () => {
    assert.match(limpiarHtmlCorreo('<p><b>abierto').html, /<\/b><\/p>$/)
    assert.match(limpiarHtmlCorreo('5 < 6 y 7 > 3').html, /5 &lt; 6 y 7 &gt; 3/)
})

test('htmlATexto deja texto simple con viñetas y enlaces visibles', () => {
    const texto = htmlATexto('<p>Hola&nbsp;<b>a todos</b></p><ul><li>uno</li><li>dos</li></ul><p><a href="https://x.com">sitio</a></p>')
    assert.equal(texto, 'Hola a todos\n• uno\n• dos\nsitio (https://x.com)')
})

test('htmlATexto de un mensaje vacío es cadena vacía', () => {
    assert.equal(htmlATexto('<p><br></p><div> </div>'), '')
})

test('el ancho de una imagen se conserva, acotado entre 20 y 900 píxeles', () => {
    const con = (w) => limpiarHtmlCorreo(`<img src="https://res.cloudinary.com/a.png" width="${w}">`).html
    assert.match(con('300'), /width="300"/)
    assert.match(con('5000'), /width="900"/) // 4 dígitos: se limita al máximo
    assert.match(con('5'), /width="20"/)
    assert.doesNotMatch(con('abc'), /width=/)
    assert.doesNotMatch(con('100%'), /width=/)
})
