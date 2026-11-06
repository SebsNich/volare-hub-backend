const prisma = require('../lib/prisma');
const { obtenerParametrosPaginacion } = require('../lib/paginacion');
const { aPostPublico } = require('../lib/landing.helpers');

const LIMITE_CARRUSEL = 6;

const obtenerCarruselPublico = async (req, res) => {
    try {
        const posts = await prisma.post.findMany({
            where: {
                publico: true,
                enCarrusel: true,
                estado: 'ACTIVO',
                imagenUrl: { isEmpty: false }
            },
            orderBy: { creadoEn: 'desc' },
            take: LIMITE_CARRUSEL
        });

        res.json({ slides: posts.map(aPostPublico) });
    }
    catch (error) {
        console.error('Error al obtener el carrusel público:', error);
        res.status(500).json({ error: 'Error al obtener el carrusel público' });
    }
}

const obtenerNoticiasPublicas = async (req, res) => {
    try {
        const { skip, take } = obtenerParametrosPaginacion({ pagina: req.query.pagina });

        const posts = await prisma.post.findMany({
            where: { publico: true, estado: 'ACTIVO' },
            orderBy: { creadoEn: 'desc' },
            skip,
            take: take + 1
        });

        const hayMas = posts.length > take;
        const noticias = (hayMas ? posts.slice(0, take) : posts).map(aPostPublico);

        res.json({ noticias, hayMas });
    }
    catch (error) {
        console.error('Error al obtener noticias públicas:', error);
        res.status(500).json({ error: 'Error al obtener noticias públicas' });
    }
}

module.exports = { obtenerCarruselPublico, obtenerNoticiasPublicas };
