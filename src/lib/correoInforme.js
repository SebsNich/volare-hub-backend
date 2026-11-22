// Envío del informe económico por correo, desde contabilidad@urbvolare.com.
// Los destinatarios van en copia oculta (bcc), en tandas de 49: así ningún
// residente ve el correo de otro, y Resend recibe pocos pedidos grandes
// (con los adjuntos) en vez de cientos pequeños.
const { dividirEnLotes, plantillaInforme } = require('./informes')

const LOGO_URL = 'https://res.cloudinary.com/dayxxbzp9/image/upload/w_140,c_scale/v1783363631/volare-hub/usuarios/volare-logo_ocx3tp.png'
const PAUSA_ENTRE_CORREOS_MS = 700 // Resend permite 2 pedidos por segundo

const esperarMs = (ms) => new Promise(resolver => setTimeout(resolver, ms))

function crearEnviadorInforme({ cliente, direccion, logoUrl = LOGO_URL, esperar = esperarMs }) {
    return async function enviarInforme({ destinatarios, asunto, mensaje, adjuntos = [] }) {
        const html = plantillaInforme({ asunto, mensaje, logoUrl })
        const attachments = adjuntos.map(a => ({ filename: a.originalname, content: a.buffer }))
        const enviados = []
        const fallidos = []

        const tandas = dividirEnLotes(destinatarios)
        for (let i = 0; i < tandas.length; i++) {
            if (i > 0) await esperar(PAUSA_ENTRE_CORREOS_MS)
            try {
                const { error } = await cliente.emails.send({
                    from: `Contabilidad Urbanización Volare <${direccion}>`,
                    to: [direccion],
                    bcc: tandas[i],
                    replyTo: direccion,
                    subject: asunto.trim().replace(/[\r\n]+/g, ' '),
                    html,
                    attachments
                })
                if (error) throw new Error(error.message || 'Resend rechazó el envío')
                enviados.push(...tandas[i])
            } catch (falla) {
                // Un lote fallido no frena los demás: se informa qué correos quedaron sin enviar.
                fallidos.push({ correos: tandas[i], motivo: falla.message })
            }
        }
        return { enviados, fallidos }
    }
}

// Cliente real, creado solo al usarlo (así las pruebas no necesitan RESEND_API_KEY).
// Sin clave y fuera de producción no se envía nada: solo se anota en el log.
function enviarInformeEconomico(datos) {
    const direccion = process.env.CORREO_CONTABILIDAD || 'contabilidad@urbvolare.com'
    if (!process.env.RESEND_API_KEY) {
        if (process.env.NODE_ENV === 'production') throw new Error('Falta RESEND_API_KEY')
        console.warn(`[desarrollo] Informe NO enviado (sin RESEND_API_KEY): "${datos.asunto}" a ${datos.destinatarios.length} destinatario(s)`)
        return Promise.resolve({ enviados: datos.destinatarios, fallidos: [], simulado: true })
    }
    const { Resend } = require('resend')
    return crearEnviadorInforme({ cliente: new Resend(process.env.RESEND_API_KEY), direccion })(datos)
}

module.exports = { crearEnviadorInforme, enviarInformeEconomico }
