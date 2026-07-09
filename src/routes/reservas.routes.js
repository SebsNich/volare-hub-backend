const router = require('express').Router()
const { verificarToken, verificarAdmin } = require('../middleware/auth.middleware')
const { uploadReservas } = require('../lib/multer')
const {
    obtenerDisponibilidadCabanas,
    obtenerDisponibilidadCasaClub,
    crearReserva,
    obtenerMisReservas,
    obtenerReservas,
    aprobarReserva,
    rechazarReserva
} = require('../controllers/reservas.controller')

router.get('/disponibilidad/cabanas', obtenerDisponibilidadCabanas)
router.get('/disponibilidad/casa-club', obtenerDisponibilidadCasaClub)
router.post('/', verificarToken, uploadReservas.fields([
    { name: 'comprobantePago', maxCount: 1 },
    { name: 'listaInvitados', maxCount: 1 },
    { name: 'contratoFirmado', maxCount: 1 }
]), crearReserva)
router.get('/mias', verificarToken, obtenerMisReservas)
router.get('/', verificarToken, verificarAdmin, obtenerReservas)
router.put('/:id/aprobar', verificarToken, verificarAdmin, aprobarReserva)
router.put('/:id/rechazar', verificarToken, verificarAdmin, rechazarReserva)

module.exports = router
