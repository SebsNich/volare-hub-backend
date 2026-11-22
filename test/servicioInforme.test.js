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
