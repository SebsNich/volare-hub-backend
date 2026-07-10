const prisma = require('../lib/prisma');

const obtenerResumen = async (req, res) => {
    try {
        const [publicacionesTotales, residentesActivos, obrasActivas, mensajesSinLeer, reservasPendientes] = await Promise.all([
            prisma.post.count(),
            prisma.user.count({ where: { rol: 'RESIDENTE', activo: true } }),
            prisma.post.count({ where: { tipo: 'OBRA', estado: 'ACTIVO' } }),
            prisma.suggestion.count({ where: { estado: 'SIN_LEER' } }),
            prisma.reserva.count({ where: { estado: 'PENDIENTE' } })
        ]);

        res.status(200).json({
            publicacionesTotales,
            residentesActivos,
            obrasActivas,
            mensajesSinLeer,
            reservasPendientes
        });
    }
    catch (error) {
        console.error('Error al obtener el resumen:', error);
        res.status(500).json({ error: 'Error al obtener el resumen' });
    }
}

module.exports = {
    obtenerResumen
}
