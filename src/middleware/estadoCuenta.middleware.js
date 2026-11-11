const { evaluarAccesoCuenta } = require('../lib/registro.helpers')

// El require de prisma va dentro de la función para que las pruebas, que
// inyectan su propio buscador, no carguen la base ni las variables de entorno.
function buscarUsuarioEnBase(id) {
    const prisma = require('../lib/prisma')
    return prisma.user.findUnique({
        where: { id },
        select: { activo: true, estadoCuenta: true, motivoRechazo: true }
    })
}

// Se consulta la base en cada petición (en vez de guardar el estado en el JWT)
// para que una aprobación, un rechazo o una desactivación valgan al instante.
// permitirPendiente puede ser true/false o una función (req) => boolean.
function crearVerificadorEstadoCuenta(buscarUsuario) {
    return ({ permitirPendiente = false } = {}) => async (req, res, next) => {
        try {
            const usuario = await buscarUsuario(req.user.id)
            const permitir = typeof permitirPendiente === 'function' ? permitirPendiente(req) : permitirPendiente
            const error = evaluarAccesoCuenta(usuario, { permitirPendiente: permitir })
            if (error) {
                return res.status(error.status).json({ codigo: error.codigo, mensaje: error.mensaje })
            }
            next()
        } catch (error) {
            console.error('Error al verificar el estado de la cuenta:', error)
            return res.status(500).json({ mensaje: 'Error al verificar el estado de la cuenta' })
        }
    }
}

const verificarEstadoCuenta = crearVerificadorEstadoCuenta(buscarUsuarioEnBase)

module.exports = { crearVerificadorEstadoCuenta, verificarEstadoCuenta }
