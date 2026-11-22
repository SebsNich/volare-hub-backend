// Reglas puras del informe económico mensual: leer la lista de destinatarios,
// validar el formulario y armar el cuerpo del correo. Sin base de datos ni red,
// para poder probarlas sin tocar nada real.

const MAX_DESTINATARIOS = 600
const MAX_ADJUNTOS = 5
const MAX_BYTES_ADJUNTOS = 20 * 1024 * 1024 // Resend admite ~40 MB por correo; el base64 pesa 1/3 más
// Resend admite 50 direcciones por correo entre "to", "cc" y "bcc"; una la ocupa el "to".
const DESTINATARIOS_POR_CORREO = 49

const EMAIL_VALIDO = /^[^\s@;,]+@[^\s@;,]+\.[^\s@;,]+$/

// Acepta ";" (como piden los programas de correo), "," y saltos de línea.
// Devuelve las direcciones válidas sin repetir y las que no tienen formato de correo.
function parsearDestinatarios(texto) {
    const validos = []
    const invalidos = []
    const vistos = new Set()
    String(texto ?? '').split(/[;,\n\r]+/).map(t => t.trim()).filter(Boolean).forEach(candidato => {
        const correo = candidato.toLowerCase()
        if (!EMAIL_VALIDO.test(correo)) {
            invalidos.push(candidato)
        } else if (!vistos.has(correo)) {
            vistos.add(correo)
            validos.push(correo)
        }
    })
    return { validos, invalidos }
}

function dividirEnLotes(lista, tamano = DESTINATARIOS_POR_CORREO) {
    const lotes = []
    for (let i = 0; i < lista.length; i += tamano) lotes.push(lista.slice(i, i + tamano))
    return lotes
}

// Devuelve el primer problema del formulario, o null si está bien.
function validarInforme({ asunto, mensaje, enviarCorreo, publicar, destinatarios, adjuntos = [] }) {
    if (!asunto || !asunto.trim()) return 'El asunto es obligatorio'
    if (asunto.trim().length > 150) return 'El asunto no puede pasar de 150 caracteres'
    if (!mensaje || !mensaje.trim()) return 'El mensaje es obligatorio'
    if (mensaje.length > 10000) return 'El mensaje no puede pasar de 10.000 caracteres'
    if (!enviarCorreo && !publicar) return 'Elige al menos una opción: enviar por correo o publicar como comunicado'
    if (adjuntos.length > MAX_ADJUNTOS) return `Se permiten hasta ${MAX_ADJUNTOS} archivos adjuntos`
    const bytes = adjuntos.reduce((suma, a) => suma + (a.size ?? a.buffer?.length ?? 0), 0)
    if (bytes > MAX_BYTES_ADJUNTOS) return 'Los adjuntos no pueden pasar de 20 MB en total'
    if (enviarCorreo && destinatarios.length === 0) return 'No hay destinatarios con un correo válido'
    if (enviarCorreo && destinatarios.length > MAX_DESTINATARIOS) return `Se permiten hasta ${MAX_DESTINATARIOS} destinatarios por envío`
    return null
}

const escaparHtml = (t) => String(t).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]))

// El texto escrito por el administrador se escapa: nunca se interpreta como HTML.
function mensajeAHtml(mensaje) {
    return escaparHtml(mensaje.trim()).replace(/\r?\n/g, '<br>')
}

function plantillaInforme({ asunto, mensaje, logoUrl }) {
    return `
    <div style="font-family: Arial, sans-serif; max-width: 560px; margin: 0 auto; padding: 32px 24px; background-color: #f7f9fc;">
        <div style="text-align: center; margin-bottom: 12px;">
            <img src="${logoUrl}" alt="Urbanización Volare" width="140" style="width: 140px; max-width: 140px; height: auto; display: block; margin: 0 auto;" />
        </div>
        <div style="background-color: #ffffff; border-radius: 16px; padding: 32px 24px; box-shadow: 0 2px 8px rgba(0,0,0,0.06);">
            <h1 style="color: #1A75BB; margin: 0 0 16px; font-size: 20px;">${escaparHtml(asunto.trim())}</h1>
            <p style="color: #333333; font-size: 15px; line-height: 1.6; margin: 0;">${mensajeAHtml(mensaje)}</p>
        </div>
        <p style="text-align: center; color: #999999; font-size: 12px; margin-top: 24px;">
            Urbanización Volare · Contabilidad
        </p>
    </div>
    `
}

module.exports = {
    MAX_DESTINATARIOS, MAX_ADJUNTOS, MAX_BYTES_ADJUNTOS, DESTINATARIOS_POR_CORREO,
    parsearDestinatarios, dividirEnLotes, validarInforme, mensajeAHtml, plantillaInforme
}
