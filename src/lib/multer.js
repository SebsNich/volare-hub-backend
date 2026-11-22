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

// Adjuntos del informe económico: el informe suele ser PDF o Excel, a veces Word o imagen.
const MIMETYPES_INFORMES = [
    'application/pdf', 'image/jpeg', 'image/png',
    'application/vnd.ms-excel', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'text/csv'
]

const uploadInformes = multer({
    storage: storage,
    limits: { fileSize: 10 * 1024 * 1024, files: 5 }, // 10MB por archivo
    fileFilter: (req, file, cb) => {
        MIMETYPES_INFORMES.includes(file.mimetype)
            ? cb(null, true)
            : cb(errorDeUsuario('Solo se permiten PDF, Excel, Word, CSV o imágenes JPG y PNG'), false)
    }
})

const camposAdjuntosInforme = uploadInformes.array('adjuntos', 5)

module.exports = { upload, uploadReservas, camposArchivosReservas, camposEvidenciaTransferencia, camposAdjuntosInforme }