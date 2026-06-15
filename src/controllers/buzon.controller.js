const prisma = require('../lib/prisma');

const enviarSugerencia = async (req, res) => {
    const {nombre, tipo, mensaje} = req.body;

    try{
        if (!nombre || !tipo || !mensaje) {
            return res.status(400).json({ error: 'Faltan campos obligatorios' });
        }
        const sugerencia = await prisma.suggestion.create({
            data: {
                nombre,
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
        const sugerencias = await prisma.suggestion.findMany({
            orderBy: {
                creadoEn: 'desc'
            }
        });
        res.status(200).json(sugerencias);
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

module.exports = {
    enviarSugerencia,
    obtenerSugerencias,
    marcarLeida
}