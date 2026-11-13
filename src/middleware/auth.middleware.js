const jwt = require('jsonwebtoken');
const { evaluarAccesoCuenta } = require('../lib/registro.helpers');

const verificarToken = (req, res, next) => {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({ mensaje: 'Token no proporcionado o formato incorrecto' });
    }   

    const token = authHeader.split(' ')[1];

    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        req.user = decoded;
        next(); 
    }
    catch (error) {
        console.error('Error al verificar token:', error);
        return res.status(401).json({ mensaje: 'Token inválido o expirado' });
    }
}

const ACCESO_DENEGADO = { mensaje: 'Acceso denegado: se requieren privilegios de administrador' };

// El require de prisma va dentro para que las pruebas, que inyectan su propio
// buscador, no carguen la base ni las variables de entorno.
function buscarAdminEnBase(id) {
    const prisma = require('../lib/prisma');
    return prisma.user.findUnique({
        where: { id },
        select: { rol: true, activo: true, estadoCuenta: true, motivoRechazo: true }
    });
}

// El JWT dura 24 h: si solo se mirara su "rol", un admin desactivado o
// degradado seguiría entrando al panel hasta que venza. Por eso se confirma
// en la base en cada petición, igual que verificarEstadoCuenta.
function crearVerificadorAdmin(buscarUsuario) {
    return async (req, res, next) => {
        // Un token que ni siquiera dice ADMIN se rechaza sin consultar la base.
        if (req.user?.rol !== 'ADMIN') {
            return res.status(403).json(ACCESO_DENEGADO);
        }
        try {
            const usuario = await buscarUsuario(req.user.id);
            const errorCuenta = evaluarAccesoCuenta(usuario);
            if (errorCuenta) {
                return res.status(errorCuenta.status).json({ codigo: errorCuenta.codigo, mensaje: errorCuenta.mensaje });
            }
            if (usuario.rol !== 'ADMIN') {
                return res.status(403).json(ACCESO_DENEGADO);
            }
            next();
        } catch (error) {
            console.error('Error al verificar el administrador:', error);
            return res.status(500).json({ mensaje: 'Error al verificar el administrador' });
        }
    };
}

const verificarAdmin = crearVerificadorAdmin(buscarAdminEnBase);

module.exports = { verificarToken, verificarAdmin, crearVerificadorAdmin }