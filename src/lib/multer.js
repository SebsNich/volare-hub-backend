const multer = require('multer')

const storage = multer.memoryStorage()

const upload = multer({
    storage: storage,
    limits: { fileSize: 10 * 1024 * 1024 }, // 10MB máximo
    fileFilter: (req, file, cb) => {
        file.mimetype.startsWith('image/') || file.mimetype === 'application/pdf'
            ? cb(null, true)
            : cb(new Error('Solo se permiten imágenes y archivos PDF'), false)
    }
})

module.exports = upload