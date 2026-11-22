const prisma = require('../lib/prisma')
const { subirArchivo } = require('../lib/cloudinary')
const { carpetas } = require('../lib/carpetas')
const { FILTRO_RESIDENTES_ACTIVOS } = require('../lib/resumenAdmin')
const { enviarInformeEconomico, correoRemitentePorDefecto } = require('../lib/correoInforme')
const { DOMINIO_REMITENTE, NOMBRE_REMITENTE } = require('../lib/informes')
const { procesarInforme } = require('../lib/servicioInforme')

const correosResidentes = async () => {
    const residentes = await prisma.user.findMany({ where: FILTRO_RESIDENTES_ACTIVOS, select: { email: true } })
    return residentes.map(r => r.email.toLowerCase())
}

// Publica el informe como COMUNICADO visible solo para cuentas aprobadas.
// Imágenes y documentos van a su propia carpeta de Cloudinary (envios-masivos), separada de las publicaciones normales.
async function publicarComunicado({ asunto, mensaje, adjuntos, autorId }) {
    const esImagen = (a) => a.mimetype.startsWith('image/')
    const subir = (lista, tipo, carpeta) => Promise.all(
        lista.map(a => subirArchivo(a.buffer, carpetas().envioMasivo(carpeta), tipo, a.originalname).then(r => r.secure_url))
    )
    const [imagenUrl, archivoUrl] = await Promise.all([
        subir(adjuntos.filter(esImagen), 'image', 'imagen'),
        subir(adjuntos.filter(a => !esImagen(a)), 'raw', 'documento')
    ])
    return prisma.post.create({
        data: { titulo: asunto, descripcion: mensaje, tipo: 'COMUNICADO', imagenUrl, archivoUrl, soloAprobados: true, autorId }
    })
}

const cantidadDestinatarios = async (req, res) => {
    try {
        res.json({
            residentes: await prisma.user.count({ where: FILTRO_RESIDENTES_ACTIVOS }),
            remitente: { nombre: NOMBRE_REMITENTE, correo: correoRemitentePorDefecto() },
            dominioRemitente: DOMINIO_REMITENTE
        })
    } catch (error) {
        console.error('Error al contar los destinatarios:', error)
        res.status(500).json({ error: 'Error al contar los destinatarios' })
    }
}

const enviarInforme = async (req, res) => {
    try {
        const resultado = await procesarInforme(
            { cuerpo: req.body, adjuntos: req.files ?? [], autorId: req.user.id },
            { correosResidentes, enviar: enviarInformeEconomico, publicar: publicarComunicado, correoPorDefecto: correoRemitentePorDefecto() }
        )
        // Queda en los logs quién envió y a cuántos; nunca las direcciones ni el texto.
        console.log(`Informe económico: admin ${req.user.id}, estado ${resultado.status}, enviados ${resultado.cuerpo.correo?.enviados ?? 0}, publicado ${Boolean(resultado.cuerpo.publicacion)}`)
        res.status(resultado.status).json(resultado.cuerpo)
    } catch (error) {
        console.error('Error al enviar el informe económico:', error)
        res.status(500).json({ error: 'Error al enviar el informe económico' })
    }
}

module.exports = { enviarInforme, cantidadDestinatarios }
