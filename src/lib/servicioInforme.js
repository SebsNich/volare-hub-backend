// Orquesta el informe económico: decide a quién se envía, valida, envía el
// correo y, si se pidió, publica el comunicado. Las dependencias (base de
// datos, Resend, Cloudinary) llegan por parámetro para poder probarlo con falsos.
const { parsearDestinatarios, validarInforme } = require('./informes')

const bool = (valor) => valor === 'true' || valor === true

async function procesarInforme({ cuerpo = {}, adjuntos = [], autorId }, { correosResidentes, enviar, publicar }) {
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

    const problema = validarInforme({
        asunto: cuerpo.asunto, mensaje: cuerpo.mensaje, enviarCorreo, publicar: publicarComunicado, destinatarios, adjuntos
    })
    if (problema) return { status: 400, cuerpo: { error: problema } }

    const respuesta = { correo: null, publicacion: null }

    if (enviarCorreo) {
        const { enviados, fallidos } = await enviar({ destinatarios, asunto: cuerpo.asunto, mensaje: cuerpo.mensaje, adjuntos })
        if (enviados.length === 0) {
            // No se publica nada: así el administrador puede reintentar sin duplicar el comunicado.
            return { status: 502, cuerpo: { error: 'No se pudo enviar el correo. Intenta de nuevo en unos minutos.', correosFallidos: fallidos.flatMap(f => f.correos) } }
        }
        respuesta.correo = { solicitados: destinatarios.length, enviados: enviados.length, correosFallidos: fallidos.flatMap(f => f.correos) }
    }

    if (publicarComunicado) {
        try {
            const post = await publicar({ asunto: cuerpo.asunto.trim(), mensaje: cuerpo.mensaje.trim(), adjuntos, autorId })
            respuesta.publicacion = { id: post.id }
        } catch (falla) {
            console.error('Informe: el correo salió pero no se pudo publicar el comunicado:', falla)
            respuesta.errorPublicacion = 'El correo se envió, pero no se pudo publicar el comunicado.'
        }
    }

    return { status: 200, cuerpo: respuesta }
}

module.exports = { procesarInforme }
