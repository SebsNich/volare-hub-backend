const prisma = require('../lib/prisma');
const { crearServicioAlicuotas } = require('../lib/alicuotas/servicioAlicuotas');
const { registroPagos } = require('../lib/pagos/registroActivo');
const { subirArchivo } = require('../lib/cloudinary');
const { carpetas } = require('../lib/carpetas');

async function subirEvidencias(archivos, cuota) {
    const carpeta = carpetas().pago('ALICUOTA');
    const subidos = await Promise.all(archivos.map(archivo => subirArchivo(
        archivo.buffer,
        carpeta,
        archivo.mimetype === 'application/pdf' ? 'raw' : 'image',
        `alicuota-${cuota.periodo}-${archivo.originalname}`
    )));
    return subidos.map(resultado => resultado.secure_url);
}

const servicio = crearServicioAlicuotas({
    prisma,
    registro: registroPagos,
    urlFrontend: process.env.FRONTEND_URL,
    subirEvidencias
});

// Igual que en pagos: el servicio decide, aquí solo se traduce a HTTP.
const responder = (operacion) => async (req, res) => {
    try {
        const { status, cuerpo } = await operacion(req);
        return res.status(status).json(cuerpo);
    } catch (error) {
        console.error('Error en alícuotas:', error);
        return res.status(500).json({ error: 'Error interno al procesar la alícuota' });
    }
};

module.exports = {
    obtenerConfig: responder(() => servicio.obtenerConfig()),
    actualizarConfig: responder((req) => servicio.actualizarConfig(req.user, req.body)),
    generarCuotas: responder((req) => servicio.generarCuotas(req.body)),
    listarCuotas: responder((req) => servicio.listarCuotas(req.query)),
    anularCuota: responder((req) => servicio.anularCuota(req.params.id)),
    misCuotas: responder((req) => servicio.misCuotas(req.user.id)),
    pagarEnLinea: responder((req) => servicio.pagarEnLinea(req.user, req.body)),
    pagarPorTransferencia: responder((req) => servicio.pagarPorTransferencia(req.user, req.body, req.files))
};
