const { test } = require('node:test')
const assert = require('node:assert/strict')
const { crearEnviadorInforme } = require('../src/lib/correoInforme')

const correos = (n) => Array.from({ length: n }, (_, i) => `u${i}@x.com`)
const adjunto = { originalname: 'informe.pdf', buffer: Buffer.from('pdf') }

function clienteFalso({ fallarEn = [] } = {}) {
    const llamadas = []
    return {
        llamadas,
        emails: { send: async (datos) => {
            llamadas.push(datos)
            if (fallarEn.includes(llamadas.length)) return { error: { message: 'límite' } }
            return { data: { id: 'x' } }
        } }
    }
}

test('envía desde contabilidad con los residentes en copia oculta', async () => {
    const cliente = clienteFalso()
    const enviar = crearEnviadorInforme({ cliente, direccion: 'contabilidad@urbvolare.com', esperar: async () => {} })
    const r = await enviar({ destinatarios: correos(3), asunto: 'Informe', mensaje: 'Hola', adjuntos: [adjunto] })
    assert.equal(r.enviados.length, 3)
    const envio = cliente.llamadas[0]
    assert.match(envio.from, /<contabilidad@urbvolare.com>/)
    assert.deepEqual(envio.to, ['contabilidad@urbvolare.com'])
    assert.deepEqual(envio.bcc, correos(3))
    assert.equal(envio.replyTo, 'contabilidad@urbvolare.com')
    assert.deepEqual(envio.attachments, [{ filename: 'informe.pdf', content: adjunto.buffer }])
})

test('500 destinatarios salen en 11 correos de máximo 49 (Resend admite 50 por correo)', async () => {
    const cliente = clienteFalso()
    const esperas = []
    const enviar = crearEnviadorInforme({ cliente, direccion: 'c@x.com', esperar: async (ms) => esperas.push(ms) })
    const r = await enviar({ destinatarios: correos(500), asunto: 'a', mensaje: 'b' })
    assert.equal(cliente.llamadas.length, 11)
    assert.ok(cliente.llamadas.every(l => l.bcc.length + l.to.length <= 50))
    assert.equal(r.enviados.length, 500)
    assert.equal(esperas.length, 10) // pausa entre correos para respetar 2 pedidos/segundo
})

test('si una tanda falla, las demás se envían y se informa cuáles quedaron sin enviar', async () => {
    const cliente = clienteFalso({ fallarEn: [2] })
    const enviar = crearEnviadorInforme({ cliente, direccion: 'c@x.com', esperar: async () => {} })
    const r = await enviar({ destinatarios: correos(120), asunto: 'a', mensaje: 'b' })
    assert.equal(r.enviados.length, 71)
    assert.equal(r.fallidos.length, 1)
    assert.equal(r.fallidos[0].correos.length, 49)
    assert.match(r.fallidos[0].motivo, /límite/)
})

test('un error lanzado por el cliente tampoco frena las demás tandas', async () => {
    const cliente = { emails: { send: async () => { throw new Error('red caída') } } }
    const enviar = crearEnviadorInforme({ cliente, direccion: 'c@x.com', esperar: async () => {} })
    const r = await enviar({ destinatarios: correos(60), asunto: 'a', mensaje: 'b' })
    assert.equal(r.enviados.length, 0)
    assert.equal(r.fallidos.length, 2)
})

test('el asunto no admite saltos de línea', async () => {
    const cliente = clienteFalso()
    const enviar = crearEnviadorInforme({ cliente, direccion: 'c@x.com', esperar: async () => {} })
    await enviar({ destinatarios: correos(1), asunto: 'Informe\r\nBcc: otro@x.com', mensaje: 'b' })
    assert.ok(!/[\r\n]/.test(cliente.llamadas[0].subject))
})
