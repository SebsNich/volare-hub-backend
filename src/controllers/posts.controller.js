const prisma = require('../lib/prisma');
const { subirArchivo } = require('../lib/cloudinary')

const crearPost = async (req, res) => {
    const { titulo, descripcion, tipo} = req.body;
    const autorId = req.user.id;
    const file = req.file;
    let imagenUrl = null

    try {
        if (!titulo || !descripcion || !tipo) {
            return res.status(400).json({ error: 'Faltan campos obligatorios' });
        }

        if (req.user.rol === 'RESIDENTE' && tipo !== 'EMPRENDIMIENTO') {
            return res.status(403).json({ error: 'Los residentes solo pueden crear publicaciones de tipo EMPRENDIMIENTO'});
        }

        if (file) {
            const subida = await subirArchivo(file.buffer, 'volare-hub/posts')
            imagenUrl = subida.secure_url
        }

        const post = await prisma.post.create({
            data: {
                titulo,
                descripcion,
                tipo,
                imagenUrl,
                autorId
            }
        });

        res.status(201).json(post);
    }
    catch (error) {
        console.error('Error al crear post:', error);
        res.status(500).json({ error: 'Error al crear post' });
    }
}

const obtenerPosts = async (req, res) => {
    try {
        const posts = await prisma.post.findMany({
            where: {
                estado: 'ACTIVO'
            },
            orderBy: {
                creadoEn: 'desc'
            }
        });
        res.json(posts);
    }
    catch (error) {
        console.error('Error al obtener posts:', error);
        res.status(500).json({ error: 'Error al obtener posts' });
    }
}

const obtenerPostPorId = async (req, res) => {
    try{
        const post = await prisma.post.findUnique({
            where:{
                id: req.params.id
                
            },
            select: {
                id: true,
                titulo: true,
                descripcion: true,
                imagenUrl: true,
                archivoUrl: true,
                tipo: true,
                estado: true,
                creadoEn: true,
            }
        })
        if (!post) {
            return res.status(404).json({ error: 'Post no encontrado' });
        }
        return res.status(200).json(post);
    }
    catch (error) {
        console.error('Error al obtener post por ID:', error);
        res.status(500).json({ error: 'Error al obtener post por ID' });
    }
}

const editarPost = async (req, res) => {
    try{
        const post = await prisma.post.findUnique({
            where:{
                id: req.params.id
            }
        });
        if (!post) {
            return res.status(404).json({ error: 'Post no encontrado' });
        }
        if (req.user.rol === 'RESIDENTE' && post.autorId !== req.user.id) {
            return res.status(403).json({ error: 'No tienes permiso para editar este post' });
        }
        const { titulo, descripcion, tipo, imagenUrl, archivoUrl } = req.body;
        const postActualizado = await prisma.post.update({
            where: {
                id: req.params.id
            },
            data: {
                titulo,
                descripcion,
                tipo,
                imagenUrl,
                archivoUrl
            }
        });
        res.json(postActualizado);
    } catch (error) {
        console.error('Error al editar post:', error);
        res.status(500).json({ error: 'Error al editar post' });
    }
}

const eliminarPost = async (req, res) => {
    try{
        const post = await prisma.post.findUnique({
            where: {
                id: req.params.id
            }
        })
        if (!post) {
            return res.status(404).json({ error: 'Post no encontrado' });
        }
        if (req.user.rol === 'RESIDENTE' && post.autorId !== req.user.id) {
            return res.status(403).json({ error: 'No tienes permiso para editar este post' });
        }
        const postEliminado = await prisma.post.delete({
            where: {
                id: req.params.id
            }
        });
        res.json({ mensaje: 'Post eliminado exitosamente' });
    }
    catch (error) {
        console.error('Error al eliminar post:', error);
        res.status(500).json({ error: 'Error al eliminar post' });
    }
}

module.exports = {
    crearPost,
    obtenerPosts,
    obtenerPostPorId,
    editarPost,
    eliminarPost
};