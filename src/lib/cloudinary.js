const path = require('node:path')
const cloudinary = require('cloudinary').v2
const { crearAlmacenamientoLocal, PREFIJO_URL } = require('./almacenamientoLocal')

cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET
})

// Sin credenciales de Cloudinary: en desarrollo se guarda en disco; en
// producción se falla al subir (mejor un error claro que perder archivos).
const cloudinaryConfigurado = Boolean(process.env.CLOUDINARY_CLOUD_NAME && process.env.CLOUDINARY_API_KEY && process.env.CLOUDINARY_API_SECRET)
const usaDisco = !cloudinaryConfigurado && process.env.NODE_ENV !== 'production'
const almacenamientoLocal = usaDisco
    ? crearAlmacenamientoLocal({
        raiz: path.join(__dirname, '..', '..', 'uploads-dev'),
        urlBase: process.env.API_PUBLIC_URL || `http://localhost:${process.env.PORT || 3000}`
    })
    : null
if (usaDisco) console.warn('Cloudinary sin configurar: los archivos se guardan en uploads-dev/ (solo desarrollo)')

const subirArchivo = (buffer, carpeta, tipo = 'image', nombreOriginal = '') => {
    if (almacenamientoLocal) return almacenamientoLocal.subir(buffer, carpeta, tipo, nombreOriginal)
    return new Promise((resolve, reject) => {
        cloudinary.uploader.upload_stream(
            { 
                folder: carpeta, 
                resource_type: tipo,
                use_filename: true,
                filename_override: nombreOriginal
            },
            (error, resultado) => {
                if (error) reject(error)
                else resolve(resultado)
            }
        ).end(buffer)
    })
}

const extraerPublicId = (url, tipo = 'image') => {
    if (!url || typeof url !== 'string' || !url.includes('/upload/')) {
        return null
    }

    const parte1 = url.split('/upload/')[1]
    const partes = parte1.split('/').slice(1);
    const publicIdConExtension = partes.join('/')

    if (!publicIdConExtension) {
        return null
    }

    if (tipo === 'raw') {
        return publicIdConExtension
    }

    const publicId = publicIdConExtension.split('.').slice(0, -1).join('.')
    return publicId || null
}

const eliminarArchivo = async (url, tipo = 'image') => {
    if (almacenamientoLocal || (typeof url === 'string' && url.includes(PREFIJO_URL))) {
        return almacenamientoLocal ? almacenamientoLocal.eliminar(url) : null
    }
    const publicId = extraerPublicId(url, tipo)

    if (!publicId) {
        console.warn('No se pudo eliminar archivo: URL de Cloudinary inválida o malformada:', url)
        return null
    }

    try {
        const archivoEliminado = await cloudinary.uploader.destroy(publicId, { resource_type: tipo })
        console.log('Archivo eliminado de Cloudinary:', archivoEliminado)
        return archivoEliminado
    }
    catch (error) {
        console.error('Error al eliminar archivo de Cloudinary:', error)
        throw error
    }
}

module.exports = { almacenamientoLocal, cloudinary, subirArchivo, extraerPublicId, eliminarArchivo }