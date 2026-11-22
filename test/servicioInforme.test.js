const { test } = require('node:test')
const assert = require('node:assert/strict')
const { procesarInforme } = require('../src/lib/servicioInforme')

const residentes = ['r1@x.com', 'r2@x.com']
function dependencias({ envio, falloPublicar = false } = {}) {
    const llamadas = { enviar: [], publicar: [] }
    return {
        llamadas,
        deps: {
            correosResidentes: async () => residentes,
            enviar: async (d) => { llamadas.enviar.push(d); return envio ?? { enviados: d.destinatarios, fallidos: [] } },
            publicar: async (d) => { llamadas.publicar.push(d); if (falloPublicar) throw new Error('cloudinary'); return { id: 'post-1' } }
        }
    }
}
const cuerpo = (extra = {}) => ({ asunto: 'Informe', mensaje: 'Texto', enviarCorreo: 'true', publicar: 'false', modoDestinatarios: 'TODOS', ...extra })

test('modo TODOS envía a los residentes aprobados', async () => {
    const { deps, llamadas } = dependencias()
    const r = await procesarInforme({ cuerpo: cuerpo(), autorId: 'a1' }, deps)
    assert.equal(r.status, 200)
    assert.deepEqual(llamadas.enviar[0].destinatarios, residentes)
    assert.equal(r.cuerpo.correo.enviados, 2)
    assert.equal(r.cuerpo.publicacion, null)
})

test('modo LISTA usa los correos escritos y rechaza los mal escritos', async () => {
    const { deps, llamadas } = dependencias()
    const ok = await procesarInforme({ cuerpo: cuerpo({ modoDestinatarios: 'LISTA', destinatarios: 'a@x.com; b@x.com' }), autorId: 'a1' }, deps)
    assert.deepEqual(llamadas.enviar[0].destinatarios, ['a@x.com', 'b@x.com'])
    assert.equal(ok.status, 200)
    const mal = await procesarInforme({ cuerpo: cuerpo({ modoDestinatarios: 'LISTA', destinatarios: 'a@x.com; roto' }), autorId: 'a1' }, deps)
    assert.equal(mal.status, 400)
    assert.match(mal.cuerpo.error, /roto/)
    assert.equal(llamadas.enviar.length, 1) // el segundo intento no envió nada
})

test('puede publicar el comunicado además de enviar', async () => {
    const { deps, llamadas } = dependencias()
    const r = await procesarInforme({ cuerpo: cuerpo({ publicar: 'true' }), autorId: 'a1' }, deps)
    assert.equal(r.cuerpo.publicacion.id, 'post-1')
    assert.equal(llamadas.publicar[0].autorId, 'a1')
})

test('puede solo publicar, sin enviar correo', async () => {
    const { deps, llamadas } = dependencias()
    const r = await procesarInforme({ cuerpo: cuerpo({ enviarCorreo: 'false', publicar: 'true' }), autorId: 'a1' }, deps)
    assert.equal(r.status, 200)
    assert.equal(llamadas.enviar.length, 0)
    assert.equal(r.cuerpo.correo, null)
})

test('sin enviar ni publicar es un error', async () => {
    const { deps } = dependencias()
    const r = await procesarInforme({ cuerpo: cuerpo({ enviarCorreo: 'false', publicar: 'false' }), autorId: 'a1' }, deps)
    assert.equal(r.status, 400)
})

test('si ningún correo salió, devuelve 502 y no publica', async () => {
    const { deps, llamadas } = dependencias({ envio: { enviados: [], fallidos: [{ correos: residentes, motivo: 'x' }] } })
    const r = await procesarInforme({ cuerpo: cuerpo({ publicar: 'true' }), autorId: 'a1' }, deps)
    assert.equal(r.status, 502)
    assert.equal(llamadas.publicar.length, 0)
})

test('si algunas tandas fallan, informa los correos pendientes', async () => {
    const { deps } = dependencias({ envio: { enviados: ['r1@x.com'], fallidos: [{ correos: ['r2@x.com'], motivo: 'x' }] } })
    const r = await procesarInforme({ cuerpo: cuerpo(), autorId: 'a1' }, deps)
    assert.equal(r.status, 200)
    assert.deepEqual(r.cuerpo.correo.correosFallidos, ['r2@x.com'])
})

test('si el correo salió pero publicar falla, lo avisa sin perder el resultado del correo', async () => {
    const { deps } = dependencias({ falloPublicar: true })
    const r = await procesarInforme({ cuerpo: cuerpo({ publicar: 'true' }), autorId: 'a1' }, deps)
    assert.equal(r.status, 200)
    assert.equal(r.cuerpo.correo.enviados, 2)
    assert.equal(r.cuerpo.publicacion, null)
    assert.match(r.cuerpo.errorPublicacion, /no se pudo publicar/)
})

test('el mensaje con formato se limpia y se envía como HTML; el comunicado queda en texto simple', async () => {
    const { deps, llamadas } = dependencias()
    const png = Buffer.from('img').toString('base64')
    const mensaje = `<p>Hola <b>todos</b></p><script>x()</script><ul><li>uno</li></ul><img src="data:image/png;base64,${png}">`
    const r = await procesarInforme({ cuerpo: cuerpo({ mensaje, publicar: 'true' }), autorId: 'a1' }, deps)
    assert.equal(r.status, 200)
    const envio = llamadas.enviar[0]
    assert.match(envio.cuerpoHtml, /<b>todos<\/b>/)
    assert.doesNotMatch(envio.cuerpoHtml, /script|base64/)
    assert.equal(envio.imagenesEnLinea.length, 1)
    assert.equal(llamadas.publicar[0].mensaje, 'Hola todos\n• uno')
    assert.equal(llamadas.publicar[0].adjuntos.length, 1) // la imagen del mensaje también se publica
})

test('un mensaje sin etiquetas conserva sus saltos de línea y se escapa', async () => {
    const { deps, llamadas } = dependencias()
    await procesarInforme({ cuerpo: cuerpo({ mensaje: 'línea 1\nlínea <2>' }), autorId: 'a1' }, deps)
    assert.match(llamadas.enviar[0].cuerpoHtml, /línea 1<br>línea &lt;2&gt;/)
})

test('un mensaje que solo tiene formato vacío se rechaza', async () => {
    const { deps, llamadas } = dependencias()
    const r = await procesarInforme({ cuerpo: cuerpo({ mensaje: '<p><br></p>' }), autorId: 'a1' }, deps)
    assert.equal(r.status, 400)
    assert.match(r.cuerpo.error, /mensaje/i)
    assert.equal(llamadas.enviar.length, 0)
})

test('el remitente editable se valida y se pasa al envío', async () => {
    const { deps, llamadas } = dependencias()
    const ok = await procesarInforme({ cuerpo: cuerpo({ remitenteNombre: 'Administración', remitenteCorreo: 'admin@urbvolare.com' }), autorId: 'a1' }, deps)
    assert.equal(ok.status, 200)
    assert.deepEqual(llamadas.enviar[0].remitente, { nombre: 'Administración', correo: 'admin@urbvolare.com' })
    const defecto = await procesarInforme({ cuerpo: cuerpo(), autorId: 'a1' }, deps)
    assert.equal(defecto.status, 200)
    assert.equal(llamadas.enviar[1].remitente.correo, 'contabilidad@urbvolare.com')
    const ajeno = await procesarInforme({ cuerpo: cuerpo({ remitenteCorreo: 'alguien@gmail.com' }), autorId: 'a1' }, deps)
    assert.equal(ajeno.status, 400)
    assert.match(ajeno.cuerpo.error, /@urbvolare.com/)
    assert.equal(llamadas.enviar.length, 2)
})
