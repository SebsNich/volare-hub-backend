const prisma = require('../lib/prisma');

const PLATAFORMAS_VALIDAS = ['FACEBOOK', 'INSTAGRAM', 'WHATSAPP', 'TIKTOK', 'TWITTER', 'YOUTUBE', 'LINKEDIN', 'OTRO'];
const REGEX_CORREO = /^\S+@\S+\.\S+$/;

function validarContacto(tipo, valor, plataforma) {
    if (!['TELEFONO', 'CORREO', 'RED_SOCIAL'].includes(tipo)) {
        return 'Tipo de contacto inválido';
    }

    if (!valor || !valor.trim()) {
        return 'El valor es obligatorio';
    }

    if (tipo === 'CORREO' && !REGEX_CORREO.test(valor)) {
        return 'El correo no tiene un formato válido';
    }

    if (tipo === 'RED_SOCIAL') {
        if (!valor.startsWith('http')) {
            return 'La URL de la red social debe empezar con http';
        }
        if (!PLATAFORMAS_VALIDAS.includes(plataforma)) {
            return 'Plataforma de red social inválida';
        }
    }

    return null;
}

const obtenerContactoPublico = async (req, res) => {
    try {
        const contactos = await prisma.infoContacto.findMany({
            where: { activo: true },
            orderBy: [{ tipo: 'asc' }, { orden: 'asc' }]
        });
        res.status(200).json(contactos);
    }
    catch (error) {
        console.error('Error al obtener información de contacto:', error);
        res.status(500).json({ error: 'Error al obtener información de contacto' });
    }
}

const obtenerContactoAdmin = async (req, res) => {
    try {
        const contactos = await prisma.infoContacto.findMany({
            orderBy: [{ tipo: 'asc' }, { orden: 'asc' }]
        });
        res.status(200).json(contactos);
    }
    catch (error) {
        console.error('Error al obtener información de contacto:', error);
        res.status(500).json({ error: 'Error al obtener información de contacto' });
    }
}

const crearContacto = async (req, res) => {
    try {
        const { tipo, etiqueta, plataforma, valor } = req.body;

        const errorValidacion = validarContacto(tipo, valor, plataforma);
        if (errorValidacion) {
            return res.status(400).json({ error: errorValidacion });
        }

        const ultimo = await prisma.infoContacto.findFirst({
            where: { tipo },
            orderBy: { orden: 'desc' }
        });

        const contacto = await prisma.infoContacto.create({
            data: {
                tipo,
                etiqueta: etiqueta || null,
                plataforma: tipo === 'RED_SOCIAL' ? plataforma : null,
                valor,
                orden: ultimo ? ultimo.orden + 1 : 0
            }
        });

        res.status(201).json(contacto);
    }
    catch (error) {
        console.error('Error al crear información de contacto:', error);
        res.status(500).json({ error: 'Error al crear información de contacto' });
    }
}

const editarContacto = async (req, res) => {
    try {
        const contactoActual = await prisma.infoContacto.findUnique({ where: { id: req.params.id } });
        if (!contactoActual) {
            return res.status(404).json({ error: 'Registro no encontrado' });
        }

        const { etiqueta, plataforma, valor } = req.body;
        const tipo = contactoActual.tipo;

        const errorValidacion = validarContacto(tipo, valor, plataforma);
        if (errorValidacion) {
            return res.status(400).json({ error: errorValidacion });
        }

        const contacto = await prisma.infoContacto.update({
            where: { id: req.params.id },
            data: {
                etiqueta: etiqueta || null,
                plataforma: tipo === 'RED_SOCIAL' ? plataforma : null,
                valor
            }
        });

        res.status(200).json(contacto);
    }
    catch (error) {
        console.error('Error al editar información de contacto:', error);
        res.status(500).json({ error: 'Error al editar información de contacto' });
    }
}

const eliminarContacto = async (req, res) => {
    try {
        const contactoActual = await prisma.infoContacto.findUnique({ where: { id: req.params.id } });
        if (!contactoActual) {
            return res.status(404).json({ error: 'Registro no encontrado' });
        }

        await prisma.infoContacto.delete({ where: { id: req.params.id } });
        res.status(200).json({ mensaje: 'Registro eliminado exitosamente' });
    }
    catch (error) {
        console.error('Error al eliminar información de contacto:', error);
        res.status(500).json({ error: 'Error al eliminar información de contacto' });
    }
}

const cambiarOrdenContacto = async (req, res) => {
    try {
        const { direccion } = req.body;
        if (!['subir', 'bajar'].includes(direccion)) {
            return res.status(400).json({ error: 'Dirección inválida' });
        }

        const contactoActual = await prisma.infoContacto.findUnique({ where: { id: req.params.id } });
        if (!contactoActual) {
            return res.status(404).json({ error: 'Registro no encontrado' });
        }

        const hermanos = await prisma.infoContacto.findMany({
            where: { tipo: contactoActual.tipo },
            orderBy: { orden: 'asc' }
        });

        const indiceActual = hermanos.findIndex(c => c.id === contactoActual.id);
        const indiceAdyacente = direccion === 'subir' ? indiceActual - 1 : indiceActual + 1;

        if (indiceAdyacente < 0 || indiceAdyacente >= hermanos.length) {
            return res.status(400).json({ error: 'No se puede mover más en esa dirección' });
        }

        const adyacente = hermanos[indiceAdyacente];

        await prisma.$transaction([
            prisma.infoContacto.update({ where: { id: contactoActual.id }, data: { orden: adyacente.orden } }),
            prisma.infoContacto.update({ where: { id: adyacente.id }, data: { orden: contactoActual.orden } })
        ]);

        res.status(200).json({ mensaje: 'Orden actualizado exitosamente' });
    }
    catch (error) {
        console.error('Error al cambiar el orden:', error);
        res.status(500).json({ error: 'Error al cambiar el orden' });
    }
}

module.exports = {
    obtenerContactoPublico,
    obtenerContactoAdmin,
    crearContacto,
    editarContacto,
    eliminarContacto,
    cambiarOrdenContacto
}
