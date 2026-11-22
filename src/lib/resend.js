const { Resend } = require('resend');

const resend = new Resend(process.env.RESEND_API_KEY);

const LOGO_URL = 'https://res.cloudinary.com/dayxxbzp9/image/upload/w_140,c_scale/v1783363631/volare-hub/usuarios/volare-logo_ocx3tp.png';

function plantillaCorreoRecuperacion(nombreCompleto, urlRestablecer) {
    return `
    <div style="font-family: Arial, sans-serif; max-width: 480px; margin: 0 auto; padding: 32px 24px; background-color: #f7f9fc;">
        <div style="text-align: center; margin-bottom: 12px;">
            <img src="${LOGO_URL}" alt="Urbanización Volare" width="140" style="width: 140px; max-width: 140px; height: auto; display: block; margin: 0 auto;" />
        </div>
        <div style="text-align: center; margin-bottom: 24px;">
            <h1 style="color: #1A75BB; margin: 0; font-size: 22px;">Urbanización Volare</h1>
        </div>
        <div style="background-color: #ffffff; border-radius: 16px; padding: 32px 24px; box-shadow: 0 2px 8px rgba(0,0,0,0.06);">
            <p style="color: #333333; font-size: 15px; margin: 0 0 16px;">Hola, <strong>${nombreCompleto}</strong>:</p>
            <p style="color: #333333; font-size: 15px; line-height: 1.5; margin: 0 0 8px;">
                Recibimos una solicitud para restablecer la contraseña de tu cuenta en Urbanización Volare.
                Si fuiste tú, haz clic en el siguiente botón para continuar:
            </p>
            <div style="text-align: center; margin: 32px 0;">
                <a href="${urlRestablecer}" style="background-color: #1A75BB; color: #ffffff; text-decoration: none; font-weight: bold; padding: 14px 32px; border-radius: 8px; display: inline-block; font-size: 15px;">
                    Restablecer contraseña
                </a>
            </div>
            <p style="color: #666666; font-size: 13px; line-height: 1.5; margin: 0;">
                Este enlace expira en 1 hora. Si tú no solicitaste este cambio, puedes ignorar este correo con tranquilidad.
            </p>
        </div>
        <p style="text-align: center; color: #999999; font-size: 12px; margin-top: 24px;">
            © ${new Date().getFullYear()} Urbanización Volare
        </p>
    </div>
    `;
}

async function enviarCorreoRecuperacion(usuario, token) {
    const nombreCompleto = `${usuario.nombres || ''} ${usuario.apellidos || ''}`.trim() || usuario.email;
    const urlRestablecer = `${process.env.FRONTEND_URL}/restablecer-contrasena?token=${token}`;

    await resend.emails.send({
        from: 'Urbanización Volare <noreply@urbvolare.com>',
        to: usuario.email,
        subject: 'Restablece tu contraseña - Urbanización Volare',
        html: plantillaCorreoRecuperacion(nombreCompleto, urlRestablecer)
    });
}

function escaparHtml(texto) {
    return String(texto).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
}

// Aviso de seguridad: le dice a la persona que sus credenciales cambiaron para
// que, si no fue ella, actúe a tiempo. No lleva enlaces (un correo de alerta
// con botones se parece demasiado a un intento de phishing).
function plantillaAvisoSeguridad(nombreCompleto, titulo, texto) {
    return `
    <div style="font-family: Arial, sans-serif; max-width: 480px; margin: 0 auto; padding: 32px 24px; background-color: #f7f9fc;">
        <div style="text-align: center; margin-bottom: 12px;">
            <img src="${LOGO_URL}" alt="Urbanización Volare" width="140" style="width: 140px; max-width: 140px; height: auto; display: block; margin: 0 auto;" />
        </div>
        <div style="background-color: #ffffff; border-radius: 16px; padding: 32px 24px; box-shadow: 0 2px 8px rgba(0,0,0,0.06);">
            <h1 style="color: #1A75BB; margin: 0 0 16px; font-size: 20px;">${escaparHtml(titulo)}</h1>
            <p style="color: #333333; font-size: 15px; margin: 0 0 16px;">Hola, <strong>${escaparHtml(nombreCompleto)}</strong>:</p>
            <p style="color: #333333; font-size: 15px; line-height: 1.5; margin: 0 0 16px;">${escaparHtml(texto)}</p>
            <p style="color: #666666; font-size: 13px; line-height: 1.5; margin: 0;">
                Si no fuiste tú, restablece tu contraseña desde la opción "¿Olvidaste tu contraseña?" del inicio de sesión y avisa a la administración.
            </p>
        </div>
        <p style="text-align: center; color: #999999; font-size: 12px; margin-top: 24px;">
            © ${new Date().getFullYear()} Urbanización Volare
        </p>
    </div>
    `;
}

async function enviarAvisoSeguridad(usuario, destino, titulo, texto) {
    const nombreCompleto = `${usuario.nombres || ''} ${usuario.apellidos || ''}`.trim() || destino;
    await resend.emails.send({
        from: 'Urbanización Volare <noreply@urbvolare.com>',
        to: destino,
        subject: `${titulo} - Urbanización Volare`,
        html: plantillaAvisoSeguridad(nombreCompleto, titulo, texto)
    });
}

module.exports = { enviarCorreoRecuperacion, enviarAvisoSeguridad, plantillaAvisoSeguridad };
