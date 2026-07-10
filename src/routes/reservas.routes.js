const router = require('express').Router()
const { verificarToken, verificarAdmin } = require('../middleware/auth.middleware')
const { uploadReservas } = require('../lib/multer')
const {
    obtenerDisponibilidadCabanas,
    obtenerDisponibilidadCasaClub,
    crearReserva,
    obtenerReservaPorId,
    editarReserva,
    obtenerMisReservas,
    obtenerReservas,
    aprobarReserva,
    rechazarReserva
} = require('../controllers/reservas.controller')

const camposArchivos = uploadReservas.fields([
    { name: 'comprobantePago', maxCount: 1 },
    { name: 'listaInvitados', maxCount: 1 },
    { name: 'contratoFirmado', maxCount: 1 }
])

router.get('/disponibilidad/cabanas', obtenerDisponibilidadCabanas)
router.get('/disponibilidad/casa-club', obtenerDisponibilidadCasaClub)
router.post('/', verificarToken, camposArchivos, crearReserva)
router.get('/mias', verificarToken, obtenerMisReservas)
router.get('/', verificarToken, verificarAdmin, obtenerReservas)
router.put('/:id/aprobar', verificarToken, verificarAdmin, aprobarReserva)
router.put('/:id/rechazar', verificarToken, verificarAdmin, rechazarReserva)
router.get('/:id', verificarToken, obtenerReservaPorId)
router.put('/:id', verificarToken, camposArchivos, editarReserva)

module.exports = router
