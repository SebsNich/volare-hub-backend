const prisma = require('../lib/prisma');
const { subirArchivo, eliminarArchivo, extraerPublicId } = require('../lib/cloudinary')

const crearPost = async (req, res) => {
    const { titulo, descripcion, tipo} = req.body;
    const autorId = req.user.id;
    const files = { imagenes: req.files?.imagenes, archivos: req.files?.archivos };
    let imagenesUrl = []
    let archivosUrl = []

    try {
        if (!titulo || !descripcion || !tipo) {
            return res.status(400).json({ error: 'Faltan campos obligatorios' });
        }

        if (req.user.rol === 'RESIDENTE' && tipo !== 'EMPRENDIMIENTO') {
            return res.status(403).json({ error: 'Los residentes solo pueden crear publicaciones de tipo EMPRENDIMIENTO'});
        }

        if (files.imagenes) {
            const imageUrls = await Promise.all(
                files.imagenes.map(file => subirArchivo(file.buffer, 'volare-hub/posts'))
            );
            imagenesUrl = imageUrls.map(resultado => resultado.secure_url)
        }
        if (files.archivos) {
            const fileUrls = await Promise.all(
                files.archivos.map(file => subirArchivo(file.buffer, 'volare-hub/posts'))
            );
            archivosUrl = fileUrls.map(resultado => resultado.secure_url)
        }

        const post = await prisma.post.create({
            data: {
                titulo,
                descripcion,
                tipo,
                imagenUrl: imagenesUrl,
                archivoUrl: archivosUrl,
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
            where: { estado: 'ACTIVO' },
            orderBy: { creadoEn: 'desc' },
            include: {
                autor: {
                    select: { nombre: true }
                }
            }
        })
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
    let imagenesNuevosUrl = []
    let archivosNuevosUrl = []

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
        const { titulo, descripcion, tipo, imagenesAEliminar, archivosAEliminar } = req.body;

        const imagenesAEliminarArray = imagenesAEliminar 
            ? (Array.isArray(imagenesAEliminar) ? imagenesAEliminar : [imagenesAEliminar])
            : []

        const archivosAEliminarArray = archivosAEliminar 
            ? (Array.isArray(archivosAEliminar) ? archivosAEliminar : [archivosAEliminar])
            : []

        const files = { imagenes: req.files?.imagenes, archivos: req.files?.archivos };

        post.imagenUrl = post.imagenUrl.filter(url => !imagenesAEliminarArray?.includes(url));
        post.archivoUrl = post.archivoUrl.filter(url => !archivosAEliminarArray?.includes(url));

        const imgsEliminadas = await Promise.all(
            imagenesAEliminarArray?.map(url => eliminarArchivo(url)) || []
        )

        const archivosEliminados = await Promise.all(
            archivosAEliminarArray?.map(url => eliminarArchivo(url)) || []
        )

        if (files.imagenes) {
            const imageUrls = await Promise.all(
                files.imagenes.map(file => subirArchivo(file.buffer, 'volare-hub/posts'))
            );
            imagenesNuevosUrl = imageUrls.map(resultado => resultado.secure_url)
        }
        if (files.archivos) {
            const fileUrls = await Promise.all(
                files.archivos.map(file => subirArchivo(file.buffer, 'volare-hub/posts'))
            );
            archivosNuevosUrl = fileUrls.map(resultado => resultado.secure_url)
        }

        const postActualizado = await prisma.post.update({
            where: {
                id: req.params.id
            },
            data: {
                titulo,
                descripcion,
                tipo,
                imagenUrl: [...post.imagenUrl, ...imagenesNuevosUrl],
                archivoUrl: [...post.archivoUrl, ...archivosNuevosUrl]
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

        const imagenesAEliminar = await Promise.all(
            post.imagenUrl.map(url => eliminarArchivo(url))
        )

        const archivosAEliminar = await Promise.all(
            post.archivoUrl.map(url => eliminarArchivo(url))
        )

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