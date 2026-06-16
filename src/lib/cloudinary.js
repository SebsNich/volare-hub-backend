const cloudinary = require('cloudinary').v2

cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET
})

const subirArchivo = (buffer, carpeta) => {
    return new Promise((resolve, reject) => {
        cloudinary.uploader.upload_stream(
            { folder: carpeta },
            (error, resultado) => {
                if (error) reject(error)
                else resolve(resultado)
            }
        ).end(buffer)
    })
}

module.exports = { cloudinary, subirArchivo }