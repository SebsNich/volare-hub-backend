const router = require('express').Router()
const { verificarToken, verificarAdmin } = require('../middleware/auth.middleware')
const { camposArchivosReservas } = require('../lib/multer')
const {
    obtenerTarifas,
    obtenerDisponibilidadCabanas,
    obtenerDisponibilidadCasaClub,
    crearReserva,
    obtenerReservaPorId,
    editarReserva,
    obtenerMisReservas,
    obtenerReservas,
    aprobarReserva,
    rechazarReserva,
    enviarObservacion,
    obtenerNotificacionesNoLeidas,
    marcarNotificacionesLeidas
} = require('../controllers/reservas.controller')
const { verificarEstadoCuenta } = require('../middleware/estadoCuenta.middleware')

// Los servicios (reservas) son solo para cuentas aprobadas y activas.
const cuentaAprobada = verificarEstadoCuenta()

// Antes de '/:id': si no, Express tomaría "tarifas" como el id de una reserva.
router.get('/tarifas', obtenerTarifas)
router.get('/disponibilidad/cabanas', obtenerDisponibilidadCabanas)
router.get('/disponibilidad/casa-club', obtenerDisponibilidadCasaClub)
router.post('/', verificarToken, cuentaAprobada, camposArchivosReservas, crearReserva)
router.get('/mias', verificarToken, cuentaAprobada, obtenerMisReservas)
router.get('/mias/no-leidas', verificarToken, cuentaAprobada, obtenerNotificacionesNoLeidas)
router.put('/mias/marcar-leidas', verificarToken, cuentaAprobada, marcarNotificacionesLeidas)
router.get('/', verificarToken, verificarAdmin, obtenerReservas)
router.put('/:id/aprobar', verificarToken, verificarAdmin, aprobarReserva)
router.put('/:id/rechazar', verificarToken, verificarAdmin, rechazarReserva)
router.put('/:id/observacion', verificarToken, verificarAdmin, enviarObservacion)
router.get('/:id', verificarToken, cuentaAprobada, obtenerReservaPorId)
router.put('/:id', verificarToken, cuentaAprobada, camposArchivosReservas, editarReserva)

module.exports = router
