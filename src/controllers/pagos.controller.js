const prisma = require('../lib/prisma');
const { crearServicioPagos } = require('../lib/pagos/servicioPagos');
const { registroPagos } = require('../lib/pagos/registroActivo');
const { subirArchivo } = require('../lib/cloudinary');
const { carpetas } = require('../lib/carpetas');
const { describirMetodosDePago } = require('../lib/pagos/metodosDisponibles');

// Carpeta propia de pagos por transferencia, separada por concepto.
async function subirEvidencias(archivos, reserva) {
    const carpeta = carpetas().pago('RESERVA');
    const subidos = await Promise.all(archivos.map(archivo => subirArchivo(
        archivo.buffer,
        carpeta,
        archivo.mimetype === 'application/pdf' ? 'raw' : 'image',
        `transferencia-${archivo.originalname}`
    )));
    return subidos.map(resultado => resultado.secure_url);
}

const servicio = crearServicioPagos({
    prisma,
    registro: registroPagos,
    urlFrontend: process.env.FRONTEND_URL,
    subirEvidencias
});

// Las reglas viven en el servicio; aquí solo se traduce su { status, cuerpo }
// a HTTP y se evita que un error inesperado muestre detalles internos.
const responder = (operacion) => async (req, res) => {
    try {
        const { status, cuerpo } = await operacion(req);
        return res.status(status).json(cuerpo);
    } catch (error) {
        console.error('Error en pagos:', error);
        return res.status(500).json({ error: 'Error interno al procesar el pago' });
    }
};

// No depende de la base de datos: solo lo que se configuró al arrancar el servidor.
const metodosDePago = (req, res) => res.json(describirMetodosDePago(registroPagos));
const crearPago = responder((req) => servicio.crearPago(req.user, req.body));
const confirmarPago = responder((req) => servicio.confirmarPago(req.user, req.params.id, req.body));
const obtenerPago = responder((req) => servicio.obtenerPago(req.user, req.params.id));
const listarPagos = responder((req) => servicio.listarPagosDeReserva(req.user, req.query.reservaId));
const registrarTransferencia = responder((req) => servicio.registrarTransferencia(req.user, req.body, req.files));
const decidirPagoManual = responder((req) => servicio.decidirPagoManual(req.user, req.params.id, req.body));

module.exports = { metodosDePago, crearPago, confirmarPago, obtenerPago, listarPagos, registrarTransferencia, decidirPagoManual };
