const prisma = require('../lib/prisma');

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
            orderBy: {
                creadoEn: 'desc'
            }
        });
        return res.status(200).json({ mensaje: 'Perfil obtenido exitosamente', user: user, posts: posts });
    }
    catch (error) {
        console.error('Error al obtener el perfil público:', error);
        res.status(500).json({ error: 'Error al obtener el perfil público' });
    }
}

module.exports = {
    obtenerPerfilPublico
}