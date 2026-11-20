const multer = require('multer')

// Marca el error como "del usuario" para que el manejador general lo muestre tal cual.
const errorDeUsuario = (mensaje) => Object.assign(new Error(mensaje), { esErrorDeUsuario: true })

const storage = multer.memoryStorage()

const upload = multer({
    storage: storage,
    limits: { fileSize: 10 * 1024 * 1024 }, // 10MB máximo
    fileFilter: (req, file, cb) => {
        file.mimetype.startsWith('image/') || file.mimetype === 'application/pdf'
            ? cb(null, true)
            : cb(errorDeUsuario('Solo se permiten imágenes y archivos PDF'), false)
    }
})

const MIMETYPES_RESERVAS = ['image/jpeg', 'image/png', 'application/pdf']

const uploadReservas = multer({
    storage: storage,
    limits: { fileSize: 10 * 1024 * 1024 }, // 10MB máximo
    fileFilter: (req, file, cb) => {
        MIMETYPES_RESERVAS.includes(file.mimetype)
            ? cb(null, true)
            : cb(errorDeUsuario('Solo se permiten archivos JPG, PNG o PDF'), false)
    }
})

const camposArchivosReservas = uploadReservas.fields([
    { name: 'comprobantePago', maxCount: 5 },
    { name: 'listaInvitados', maxCount: 5 },
    { name: 'contratoFirmado', maxCount: 5 }
])

// Evidencia de una transferencia manual: mismos formatos y tamaño que los comprobantes.
const camposEvidenciaTransferencia = uploadReservas.array('evidencia', 5)

module.exports = { upload, uploadReservas, camposArchivosReservas, camposEvidenciaTransferencia }