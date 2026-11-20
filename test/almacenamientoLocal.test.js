const { test } = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const os = require('node:os')
const path = require('node:path')
const { crearAlmacenamientoLocal, nombreSeguro } = require('../src/lib/almacenamientoLocal')

const montar = () => {
    const raiz = fs.mkdtempSync(path.join(os.tmpdir(), 'volare-up-'))
    return { raiz, alm: crearAlmacenamientoLocal({ raiz, urlBase: 'http://localhost:3000', ahora: () => 1700000000000 }) }
}

test('guarda el archivo en la carpeta pedida y devuelve una URL con el mismo formato que Cloudinary', async () => {
    const { raiz, alm } = montar()
    const r = await alm.subir(Buffer.from('hola'), 'volare-hub-dev/pagos/reservas/transferencias', 'image', 'comprobante.png')
    assert.equal(r.secure_url, 'http://localhost:3000/uploads-dev/volare-hub-dev/pagos/reservas/transferencias/1700000000000-comprobante.png')
    assert.equal(fs.readFileSync(path.join(raiz, 'volare-hub-dev/pagos/reservas/transferencias/1700000000000-comprobante.png'), 'utf8'), 'hola')
})

test('un nombre con ../ no puede salirse de la carpeta de subidas', async () => {
    assert.equal(nombreSeguro('../../etc/passwd'), 'passwd')
    const { raiz, alm } = montar()
    const r = await alm.subir(Buffer.from('x'), '../../fuera', 'image', '..\\..\\malo.png')
    assert.ok(r.secure_url.includes('/uploads-dev/'))
    assert.ok(!r.secure_url.includes('..'))
    assert.ok(fs.existsSync(path.join(raiz, 'fuera')))
})

test('eliminar borra solo archivos que están dentro de la raíz', async () => {
    const { raiz, alm } = montar()
    const r = await alm.subir(Buffer.from('x'), 'a/b', 'image', 'f.png')
    assert.equal(await alm.eliminar(r.secure_url), true)
    assert.equal(await alm.eliminar('http://localhost:3000/uploads-dev/../../etc/hosts'), false)
    assert.equal(await alm.eliminar('https://res.cloudinary.com/x/image/upload/v1/a.png'), false)
    assert.ok(fs.existsSync(raiz))
})
