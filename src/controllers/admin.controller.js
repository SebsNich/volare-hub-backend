const prisma = require('../lib/prisma');
const { FILTRO_RESIDENTES_ACTIVOS, FILTRO_SOLICITUDES_PENDIENTES } = require('../lib/resumenAdmin');

const obtenerResumen = async (req, res) => {
    try {
        const [publicacionesTotales, residentesActivos, solicitudesPendientes, obrasActivas, mensajesSinLeer, reservasPendientes] = await Promise.all([
            prisma.post.count(),
            prisma.user.count({ where: FILTRO_RESIDENTES_ACTIVOS }),
            prisma.user.count({ where: FILTRO_SOLICITUDES_PENDIENTES }),
            prisma.post.count({ where: { tipo: 'OBRA', estado: 'ACTIVO' } }),
            prisma.suggestion.count({ where: { estado: 'SIN_LEER' } }),
            prisma.reserva.count({ where: { estado: 'PENDIENTE' } })
        ]);

        res.status(200).json({
            publicacionesTotales,
            residentesActivos,
            solicitudesPendientes,
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
