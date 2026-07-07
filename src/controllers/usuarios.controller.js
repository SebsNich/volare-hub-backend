const prisma = require('../lib/prisma');
const bcryptjs = require('bcryptjs');

const obtenerPerfilPublico = async (req, res) => {
    try {
        const user = await prisma.user.findUnique({
            where:{
                id: req.params.id
                
            },
            select: {
                id: true,
                nombre: true,
                rol: true,
                bio: true,
                foto: true,
                creadoEn: true
            }
        });
        if (!user) {
            return res.status(404).json({ error: 'Usuario no encontrado' });
        }
        const posts = await prisma.post.findMany({
            where: {
                autorId: req.params.id
            },
            orderBy: [{ ancladoPerfil: 'desc' }, { creadoEn: 'desc' }],
            include: {
                autor: {
                    select: { nombre: true, foto: true }
                }
            }
        });
        return res.status(200).json({ mensaje: 'Perfil obtenido exitosamente', user: user, posts: posts });
    }
    catch (error) {
        console.error('Error al obtener el perfil público:', error);
        res.status(500).json({ error: 'Error al obtener el perfil público' });
    }
}

const listarUsuarios = async (req, res) => {
    try {
        const usuarios = await prisma.user.findMany({
            select: {
                id: true,
                nombre: true,
                email: true,
                rol: true,
                activo: true,
                manzana: true,
                villa: true,
                bio: true,
                foto: true,
                creadoEn: true
            }
        });
        return res.status(200).json({ mensaje: 'Usuarios listados exitosamente', usuarios: usuarios });
    } catch (error) {
        console.error('Error al listar usuarios:', error);
        return res.status(500).json({ mensaje: 'Error interno del servidor' });
    }
}

const cambiarEstadoUsuario = async (req, res) => {
    const { id } = req.params;
    const { activo } = req.body;
    
    try {
        const usuario = await prisma.user.update({
            where: {
                id: id
            },
            data: {
                activo: activo
            },
            select: {
                id: true,
                nombre: true,
                email: true,
                rol: true,
                activo: true,
                manzana: true,
                villa: true,
                bio: true,
                foto: true,
                creadoEn: true
            }
        })
        
        res.status(200).json({ mensaje: 'Estado del usuario actualizado exitosamente', usuario })
    }
    catch (error) {
        console.error('Error al cambiar estado:', error)
        res.status(500).json({ error: 'Error al cambiar estado del usuario' })
    }
}

const crearAdmin = async (req, res) => {
    const { nombre, email, password, manzana, villa } = req.body;

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
                manzana: manzana,
                villa: villa,
                email: email,
                password: hash,
                rol: 'ADMIN'
            },
            select: {
                id: true,
                nombre: true,
                email: true,
                rol: true,
                activo: true,
                manzana: true,
                villa: true,
                bio: true,
                foto: true,
                creadoEn: true
            }
        });

        return res.status(201).json({ mensaje: 'Usuario registrado exitosamente', user: resultado });

    } catch (error) {
        console.error('Error al registrar usuario:', error);
        return res.status(500).json({ mensaje: 'Error interno del servidor' });
    }
}

module.exports = {
    obtenerPerfilPublico,
    listarUsuarios,
    cambiarEstadoUsuario,
    crearAdmin
}
