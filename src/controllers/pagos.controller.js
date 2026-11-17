const prisma = require('../lib/prisma');
const { crearServicioPagos } = require('../lib/pagos/servicioPagos');
const { registroPagos } = require('../lib/pagos/registroActivo');

const servicio = crearServicioPagos({
    prisma,
    registro: registroPagos,
    urlFrontend: process.env.FRONTEND_URL
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

const crearPago = responder((req) => servicio.crearPago(req.user, req.body));
const confirmarPago = responder((req) => servicio.confirmarPago(req.user, req.params.id, req.body));
const obtenerPago = responder((req) => servicio.obtenerPago(req.user, req.params.id));
const listarPagos = responder((req) => servicio.listarPagosDeReserva(req.user, req.query.reservaId));

module.exports = { crearPago, confirmarPago, obtenerPago, listarPagos };
