const prisma = require('../lib/prisma');
const bcryptjs = require('bcryptjs');
const { obtenerParametrosPaginacion } = require('../lib/paginacion');

const obtenerPerfilPublico = async (req, res) => {
    try {
        const user = await prisma.user.update({
            where:{
                id: req.params.id

            },
            data: {
                visitasPerfil: { increment: 1 }
            },
            select: {
                id: true,
                nombres: true,
                apellidos: true,
                rol: true,
                bio: true,
                foto: true,
                creadoEn: true,
                visitasPerfil: true
            }
        });
        const posts = await prisma.post.findMany({
            where: {
                autorId: req.params.id
            },
            orderBy: [{ ancladoPerfil: 'desc' }, { creadoEn: 'desc' }],
            include: {
                autor: {
                    select: { nombres: true, apellidos: true, foto: true }
                }
            }
        });
        return res.status(200).json({ mensaje: 'Perfil obtenido exitosamente', user: user, posts: posts });
    }
    catch (error) {
        if (error.code === 'P2025') {
            return res.status(404).json({ error: 'Usuario no encontrado' });
        }
        console.error('Error al obtener el perfil público:', error);
        res.status(500).json({ error: 'Error al obtener el perfil público' });
    }
}

const listarUsuarios = async (req, res) => {
    try {
        const { busqueda, manzanaVilla, estado } = req.query;
        const { skip, take, pagina } = obtenerParametrosPaginacion(req.query);

        const filtros = [];
        if (busqueda) {
            filtros.push({
                OR: [
                    { nombres: { contains: busqueda, mode: 'insensitive' } },
                    { apellidos: { contains: busqueda, mode: 'insensitive' } }
                ]
            });
        }
        if (manzanaVilla) {
            filtros.push({
                OR: [
                    { manzana: { contains: manzanaVilla, mode: 'insensitive' } },
                    { villa: { contains: manzanaVilla, mode: 'insensitive' } }
                ]
            });
        }
        if (estado === 'ACTIVO') filtros.push({ activo: true });
        if (estado === 'INACTIVO') filtros.push({ activo: false });

        const where = filtros.length ? { AND: filtros } : {};

        const [usuarios, total] = await Promise.all([
            prisma.user.findMany({
                where,
                orderBy: { creadoEn: 'desc' },
                skip,
                take,
                select: {
                    id: true,
                    nombres: true,
                    apellidos: true,
                    cedula: true,
                    celular: true,
                    email: true,
                    rol: true,
                    activo: true,
                    manzana: true,
                    villa: true,
                    bio: true,
                    foto: true,
                    creadoEn: true
                }
            }),
            prisma.user.count({ where })
        ]);

        const totalPaginas = Math.max(1, Math.ceil(total / take));
        return res.status(200).json({ mensaje: 'Usuarios listados exitosamente', usuarios, totalPaginas, paginaActual: pagina });
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
                nombres: true,
                apellidos: true,
                cedula: true,
                celular: true,
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
    const { nombres, apellidos, email, password, manzana, villa } = req.body;

    try {
        if (!nombres || !apellidos || !email || !password) {
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
                nombre: `${nombres} ${apellidos}`.trim(),
                nombres: nombres,
                apellidos: apellidos,
                manzana: manzana,
                villa: villa,
                email: email,
                password: hash,
                rol: 'ADMIN'
            },
            select: {
                id: true,
                nombres: true,
                apellidos: true,
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
