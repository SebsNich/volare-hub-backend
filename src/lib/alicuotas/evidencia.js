// Los archivos ya llegan filtrados por multer (JPG, PNG o PDF de hasta 10 MB);
// aquí solo se exige que haya al menos uno y no más de cinco.
const MAX_ARCHIVOS = 5

function evidenciaValida(archivos) {
    if (!Array.isArray(archivos) || archivos.length === 0) return 'Adjunta el comprobante de la transferencia'
    if (archivos.length > MAX_ARCHIVOS) return `Puedes adjuntar como máximo ${MAX_ARCHIVOS} archivos`
    return null
}

module.exports = { evidenciaValida, MAX_ARCHIVOS }
