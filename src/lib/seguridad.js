// Protecciones generales de la API. Son funciones pequeñas y sin dependencias
// nuevas para poder probarlas solas (el "ahora" y el entorno se inyectan).

// Costo de bcrypt: cada +1 duplica el tiempo de cálculo. 12 sigue siendo ágil
// para un login y encarece mucho un ataque con una base filtrada. Los hashes
// ya guardados con costo 10 siguen validando: el costo viaja dentro del hash.
const COSTO_BCRYPT = 12

// Esta API solo devuelve JSON, así que se le prohíbe cargar cualquier recurso.
function cabecerasSeguras(env = process.env) {
    return (req, res, next) => {
        res.removeHeader?.('X-Powered-By')
        res.setHeader('X-Content-Type-Options', 'nosniff')
        res.setHeader('X-Frame-Options', 'DENY')
        res.setHeader('Referrer-Policy', 'no-referrer')
        res.setHeader('Content-Security-Policy', "default-src 'none'; frame-ancestors 'none'")
        res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin')
        res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()')
        // HSTS solo en producción: en local (http) el navegador lo recordaría y bloquearía localhost.
        if (env.NODE_ENV === 'production') {
            res.setHeader('Strict-Transport-Security', 'max-age=15552000; includeSubDomains')
        }
        next()
    }
}

const MENSAJES_MULTER = {
    LIMIT_FILE_SIZE: 'Un archivo supera el máximo de 10 MB',
    LIMIT_FILE_COUNT: 'Enviaste demasiados archivos',
    LIMIT_UNEXPECTED_FILE: 'Se envió un archivo en un campo no permitido'
}

// Decide qué ve el cliente al fallar algo. Solo se muestran los mensajes que
// escribimos nosotros para el usuario; el resto (errores de Prisma, de pg, de
// Cloudinary) puede traer nombres de tablas o de usuarios de base de datos.
function respuestaDeError(err) {
    if (err?.type === 'entity.parse.failed') {
        return { status: 400, cuerpo: { error: 'El cuerpo de la petición no es un JSON válido' } }
    }
    if (err?.type === 'entity.too.large') {
        return { status: 413, cuerpo: { error: 'El cuerpo de la petición es demasiado grande' } }
    }
    if (err?.name === 'MulterError') {
        return { status: 400, cuerpo: { error: MENSAJES_MULTER[err.code] || 'Archivo no válido' } }
    }
    if (err?.message === 'No permitido por CORS') {
        return { status: 403, cuerpo: { error: 'Origen no permitido' } }
    }
    if (err?.esErrorDeUsuario) {
        return { status: 400, cuerpo: { error: err.message } }
    }
    return { status: 500, cuerpo: { error: 'Error interno del servidor' } }
}

// Falla al arrancar, no al primer login: un servidor sin secreto firmaría
// tokens con "undefined" o rechazaría a todos, y el error aparecería lejos de su causa.
function validarSecretoJwt(env = process.env) {
    const secreto = env.JWT_SECRET
    if (!secreto) throw new Error('Falta la variable JWT_SECRET')
    if (env.NODE_ENV === 'production' && secreto.length < 32) {
        throw new Error('JWT_SECRET debe tener al menos 32 caracteres en producción')
    }
}

// Tope general por IP, además de los límites específicos de login y buzón.
// Ventana fija en memoria (una sola instancia en Render). Frena ráfagas, no es un WAF.
function crearLimitadorGeneral({ max = 300, ventanaMs = 60 * 1000, ahora = Date.now } = {}) {
    const contadores = new Map()
    return (req, res, next) => {
        const t = ahora()
        if (contadores.size > 5000) {
            for (const [clave, c] of contadores) if (t - c.inicio >= ventanaMs) contadores.delete(clave)
        }
        const clave = req.ip || 'desconocida'
        let c = contadores.get(clave)
        if (!c || t - c.inicio >= ventanaMs) {
            c = { inicio: t, cantidad: 0 }
            contadores.set(clave, c)
        }
        c.cantidad += 1
        if (c.cantidad > max) {
            res.setHeader('Retry-After', String(Math.ceil((ventanaMs - (t - c.inicio)) / 1000)))
            return res.status(429).json({ error: 'Demasiadas peticiones. Intenta de nuevo en unos segundos.' })
        }
        next()
    }
}

module.exports = { COSTO_BCRYPT, cabecerasSeguras, respuestaDeError, validarSecretoJwt, crearLimitadorGeneral }
