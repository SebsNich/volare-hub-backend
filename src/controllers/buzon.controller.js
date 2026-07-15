const prisma = require('../lib/prisma');
const { obtenerParametrosPaginacion } = require('../lib/paginacion');

const enviarSugerencia = async (req, res) => {
    const {nombre, manzana, villa, tipo, mensaje} = req.body;

    try{
        if (!nombre || !tipo || !mensaje) {
            return res.status(400).json({ error: 'Faltan campos obligatorios' });
        }
        const sugerencia = await prisma.suggestion.create({
            data: {
                nombre,
                manzana,
                villa,
                tipo,
                mensaje
            }
        });
        res.status(201).json(sugerencia);
    }
    catch (error) {
        console.error('Error al enviar sugerencia:', error);
        res.status(500).json({ error: 'Error al enviar sugerencia' });
    }
}

const obtenerSugerencias  = async (req, res) => {
    try {
        const { busqueda, tipo, archivadas } = req.query;
        const { skip, take, pagina } = obtenerParametrosPaginacion(req.query);

        const filtros = [];
        if (busqueda) {
            filtros.push({ nombre: { contains: busqueda, mode: 'insensitive' } });
        }
        if (tipo && tipo !== 'TODOS') {
            filtros.push({ tipo });
        }
        if (archivadas !== 'true') {
            filtros.push({ estado: { not: 'ARCHIVADA' } });
        }

        const where = filtros.length ? { AND: filtros } : {};

        const [sugerencias, total] = await Promise.all([
            prisma.suggestion.findMany({
                where,
                orderBy: { creadoEn: 'desc' },
                skip,
                take
            }),
            prisma.suggestion.count({ where })
        ]);

        const totalPaginas = Math.max(1, Math.ceil(total / take));
        res.status(200).json({ sugerencias, totalPaginas, paginaActual: pagina });
    }
    catch (error) {
        console.error('Error al obtener sugerencias:', error);
        res.status(500).json({ error: 'Error al obtener sugerencias' });
    }
}

const marcarLeida = async (req, res) => {
    const { id } = req.params;

    try {
        const sugerencia = await prisma.suggestion.update({
            where: { id: id},
            data: { estado: 'LEIDA' }
        });
        res.status(200).json(sugerencia);
    }
    catch (error) {
        console.error('Error al marcar sugerencia como leída:', error);
        res.status(500).json({ error: 'Error al marcar sugerencia como leída' });
    }
}

const archivarSugerencia = async (req, res) => {
    const { id } = req.params;

    try {
        const sugerencia = await prisma.suggestion.update({
            where: { id: id },
            data: { estado: 'ARCHIVADA' }
        });
        res.status(200).json(sugerencia);
    }
    catch (error) {
        console.error('Error al archivar sugerencia:', error);
        res.status(500).json({ error: 'Error al archivar sugerencia' });
    }
}

module.exports = {
    enviarSugerencia,
    obtenerSugerencias,
    marcarLeida,
    archivarSugerencia
}