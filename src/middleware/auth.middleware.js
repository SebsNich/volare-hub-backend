const jwt = require('jsonwebtoken');

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

const verificarAdmin = (req, res, next) => {
    if (req.user && req.user.rol === 'ADMIN') {
        next();
    } else {
        return res.status(403).json({ mensaje: 'Acceso denegado: se requieren privilegios de administrador' });
    }
}

module.exports = { verificarToken, verificarAdmin }