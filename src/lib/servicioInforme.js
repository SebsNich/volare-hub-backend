// Orquesta el envío masivo (informe económico y similares): decide a quién se envía, valida, envía el
// correo y, si se pidió, publica el comunicado. Las dependencias (base de
// datos, Resend, Cloudinary) llegan por parámetro para poder probarlo con falsos.
const { parsearDestinatarios, validarInforme, validarRemitente, mensajeAHtml } = require('./informes')
const { limpiarHtmlCorreo, htmlATexto } = require('./htmlCorreo')

const bool = (valor) => valor === 'true' || valor === true

async function procesarInforme({ cuerpo = {}, adjuntos = [], autorId }, { correosResidentes, enviar, publicar, correoPorDefecto = 'contabilidad@urbvolare.com' }) {
    const enviarCorreo = bool(cuerpo.enviarCorreo)
    const publicarComunicado = bool(cuerpo.publicar)

    let destinatarios = []
    if (enviarCorreo) {
        if (cuerpo.modoDestinatarios === 'LISTA') {
            const { validos, invalidos } = parsearDestinatarios(cuerpo.destinatarios)
            if (invalidos.length > 0) {
                return { status: 400, cuerpo: { error: `Estas direcciones no tienen formato de correo: ${invalidos.slice(0, 5).join(', ')}` } }
            }
            destinatarios = validos
        } else {
            destinatarios = await correosResidentes()
        }
    }

    // El editor manda HTML; un texto sin etiquetas (sin editor) se convierte primero.
    const original = String(cuerpo.mensaje ?? '')
    const { html: cuerpoHtml, imagenes } = limpiarHtmlCorreo(/<[a-z][\s\S]*>/i.test(original) ? original : mensajeAHtml(original))
    const texto = htmlATexto(cuerpoHtml)

    const problema = validarInforme({
        asunto: cuerpo.asunto, texto, imagenes, enviarCorreo, publicar: publicarComunicado, destinatarios, adjuntos
    })
    if (problema) return { status: 400, cuerpo: { error: problema } }

    let remitente
    if (enviarCorreo) {
        const comprobado = validarRemitente({ nombre: cuerpo.remitenteNombre, correo: cuerpo.remitenteCorreo }, { correoPorDefecto })
        if (comprobado.error) return { status: 400, cuerpo: { error: comprobado.error } }
        remitente = comprobado.remitente
    }

    const respuesta = { correo: null, publicacion: null }

    if (enviarCorreo) {
        const { enviados, fallidos } = await enviar({ destinatarios, asunto: cuerpo.asunto, cuerpoHtml, imagenesEnLinea: imagenes, adjuntos, remitente })
        if (enviados.length === 0) {
            // No se publica nada: así el administrador puede reintentar sin duplicar el comunicado.
            return { status: 502, cuerpo: { error: 'No se pudo enviar el correo. Intenta de nuevo en unos minutos.', correosFallidos: fallidos.flatMap(f => f.correos) } }
        }
        respuesta.correo = { solicitados: destinatarios.length, enviados: enviados.length, correosFallidos: fallidos.flatMap(f => f.correos) }
    }

    if (publicarComunicado) {
        try {
            // Las imágenes del mensaje se publican junto con los demás adjuntos.
            const imagenesComoAdjuntos = imagenes.map(i => ({ buffer: i.buffer, mimetype: i.mimetype, originalname: i.filename }))
            const post = await publicar({ asunto: cuerpo.asunto.trim(), mensaje: texto || cuerpo.asunto.trim(), adjuntos: [...adjuntos, ...imagenesComoAdjuntos], autorId })
            respuesta.publicacion = { id: post.id }
        } catch (falla) {
            console.error('Informe: el correo salió pero no se pudo publicar el comunicado:', falla)
            respuesta.errorPublicacion = 'El correo se envió, pero no se pudo publicar el comunicado.'
        }
    }

    return { status: 200, cuerpo: respuesta }
}

module.exports = { procesarInforme }
