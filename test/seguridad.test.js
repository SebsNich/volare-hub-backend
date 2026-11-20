const { test } = require('node:test')
const assert = require('node:assert/strict')
const {
    cabecerasSeguras, respuestaDeError, validarSecretoJwt, crearLimitadorGeneral, COSTO_BCRYPT
} = require('../src/lib/seguridad')

const simularRes = () => {
    const cabeceras = {}
    return { cabeceras, setHeader: (k, v) => { cabeceras[k] = v }, removeHeader: (k) => { delete cabeceras[k] } }
}

test('las cabeceras seguras impiden sniffing, iframes y filtrado de referer', () => {
    const res = simularRes()
    let siguio = false
    cabecerasSeguras({ NODE_ENV: 'development' })({}, res, () => { siguio = true })
    assert.equal(siguio, true)
    assert.equal(res.cabeceras['X-Content-Type-Options'], 'nosniff')
    assert.equal(res.cabeceras['X-Frame-Options'], 'DENY')
    assert.equal(res.cabeceras['Referrer-Policy'], 'no-referrer')
    assert.match(res.cabeceras['Content-Security-Policy'], /default-src 'none'/)
    assert.equal(res.cabeceras['Strict-Transport-Security'], undefined)
})

test('en producción añade HSTS', () => {
    const res = simularRes()
    cabecerasSeguras({ NODE_ENV: 'production' })({}, res, () => {})
    assert.match(res.cabeceras['Strict-Transport-Security'], /max-age=\d+/)
})

test('un error desconocido no revela su mensaje interno', () => {
    const r = respuestaDeError(new Error('password authentication failed for user "postgres"'))
    assert.equal(r.status, 500)
    assert.equal(r.cuerpo.error, 'Error interno del servidor')
})

test('JSON mal formado y cuerpo demasiado grande tienen mensajes claros', () => {
    assert.deepEqual(respuestaDeError({ type: 'entity.parse.failed' }), { status: 400, cuerpo: { error: 'El cuerpo de la petición no es un JSON válido' } })
    assert.equal(respuestaDeError({ type: 'entity.too.large' }).status, 413)
})

test('los errores de subida (multer) y de CORS se muestran porque son del usuario', () => {
    const subida = respuestaDeError({ name: 'MulterError', code: 'LIMIT_FILE_SIZE', message: 'File too large' })
    assert.equal(subida.status, 400)
    assert.match(subida.cuerpo.error, /10 MB/)
    const tipo = respuestaDeError(Object.assign(new Error('Solo se permiten archivos JPG, PNG o PDF'), { esErrorDeUsuario: true }))
    assert.equal(tipo.status, 400)
    assert.equal(tipo.cuerpo.error, 'Solo se permiten archivos JPG, PNG o PDF')
    assert.equal(respuestaDeError(new Error('No permitido por CORS')).status, 403)
})

test('el secreto JWT debe existir y en producción ser largo', () => {
    assert.throws(() => validarSecretoJwt({ NODE_ENV: 'development' }), /JWT_SECRET/)
    assert.throws(() => validarSecretoJwt({ NODE_ENV: 'production', JWT_SECRET: 'corto' }), /32/)
    assert.doesNotThrow(() => validarSecretoJwt({ NODE_ENV: 'production', JWT_SECRET: 'x'.repeat(32) }))
    assert.doesNotThrow(() => validarSecretoJwt({ NODE_ENV: 'development', JWT_SECRET: 'abc' }))
})

test('el limitador general corta al pasar el máximo y se libera al vencer la ventana', () => {
    let t = 0
    const lim = crearLimitadorGeneral({ max: 2, ventanaMs: 1000, ahora: () => t })
    const intento = () => { const res = { codigo: null, cab: {}, status(c) { this.codigo = c; return this }, json() { return this }, setHeader(k, v) { this.cab[k] = v } }; let paso = false; lim({ ip: '1.1.1.1' }, res, () => { paso = true }); return { paso, res } }
    assert.equal(intento().paso, true)
    assert.equal(intento().paso, true)
    const tercero = intento()
    assert.equal(tercero.paso, false)
    assert.equal(tercero.res.codigo, 429)
    assert.ok(tercero.res.cab['Retry-After'])
    t = 1500
    assert.equal(intento().paso, true)
})

test('el costo de bcrypt es al menos 12', () => assert.ok(COSTO_BCRYPT >= 12))
