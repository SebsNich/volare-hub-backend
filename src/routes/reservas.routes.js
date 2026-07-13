const router = require('express').Router()
const { verificarToken, verificarAdmin } = require('../middleware/auth.middleware')
const { camposArchivosReservas } = require('../lib/multer')
const {
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

router.get('/disponibilidad/cabanas', obtenerDisponibilidadCabanas)
router.get('/disponibilidad/casa-club', obtenerDisponibilidadCasaClub)
router.post('/', verificarToken, camposArchivosReservas, crearReserva)
router.get('/mias', verificarToken, obtenerMisReservas)
router.get('/mias/no-leidas', verificarToken, obtenerNotificacionesNoLeidas)
router.put('/mias/marcar-leidas', verificarToken, marcarNotificacionesLeidas)
router.get('/', verificarToken, verificarAdmin, obtenerReservas)
router.put('/:id/aprobar', verificarToken, verificarAdmin, aprobarReserva)
router.put('/:id/rechazar', verificarToken, verificarAdmin, rechazarReserva)
router.put('/:id/observacion', verificarToken, verificarAdmin, enviarObservacion)
router.get('/:id', verificarToken, obtenerReservaPorId)
router.put('/:id', verificarToken, camposArchivosReservas, editarReserva)

module.exports = router
