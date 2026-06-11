const prisma = require('../lib/prisma');
const bcryptjs = require('bcryptjs');
const jwt = require('jsonwebtoken');

const registrar = async (req, res) => {
    const { nombre, email, password } = req.body;

    try {
        if (!nombre || !email || !password) {
            return res.status(400).json({ mensaje: 'Todos los campos son obligatorios' })
        }
        
        const usuarioExistente = await prisma.user.findUnique({
            where: {
                email: email
            }
        });

        if (usuarioExistente){
            return res.status(400).json({ mensaje: 'El email ya está registrado' });
        }

        const hash = await bcryptjs.hash(password, 10);

        const resultado = await prisma.user.create({
            data: {
                nombre: nombre,
                email: email,
                password: hash
            }
        });

        const token = jwt.sign(
            { id: resultado.id, rol: resultado.rol },
            process.env.JWT_SECRET,
            { expiresIn: '24h' }
        );

        return res.status(201).json({ mensaje: 'Usuario registrado exitosamente', token: token });

    } catch (error) {
        console.error('Error al registrar usuario:', error);
        return res.status(500).json({ mensaje: 'Error interno del servidor' });
    }
}

const login = async (req, res) => {
    const { email, password } = req.body;

    try {
        if (!email || !password) {
            return res.status(400).json({ mensaje: 'Todos los campos son obligatorios' })
        }

        const usuario = await prisma.user.findUnique({
            where: {
                email: email
            }
        });

        if (!usuario) {
            return res.status(400).json({ mensaje: 'Credenciales inválidas' });
        }

        const passwordValida = await bcryptjs.compare(password, usuario.password);

        if (!passwordValida) {
            return res.status(400).json({ mensaje: 'Credenciales inválidas' });
        }

        const token = jwt.sign(
            { id: usuario.id, rol: usuario.rol },
            process.env.JWT_SECRET,
            { expiresIn: '24h' }
        );

        return res.status(200).json({ mensaje: 'Inicio de sesión exitoso', token: token });
    }
    catch (error) {
        console.error('Error al iniciar sesión:', error);
        return res.status(500).json({ mensaje: 'Error interno del servidor' });
    }
}

const obtenerPerfil = async (req, res) => {
    try{
        const user = await prisma.user.findUnique({
            where:{
                id: req.user.id
                
            },
            select: {
                id: true,
                nombre: true,
                email: true,
                rol: true,
                activo: true,
                bio: true,
                foto: true,
                creadoEn: true
            }
        })
        return res.status(200).json({ mensaje: 'Perfil obtenido exitosamente', user: user });
    }
    catch (error) {
        console.error('Error al obtener perfil:', error);
        return res.status(500).json({ mensaje: 'Error interno del servidor' });
    }
}

module.exports = {
    registrar,
    login,
    obtenerPerfil 
}