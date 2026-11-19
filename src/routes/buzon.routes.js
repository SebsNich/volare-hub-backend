const router = require('express').Router()
const { verificarToken, verificarAdmin } = require('../middleware/auth.middleware')
const { enviarSugerencia, limitarBuzon, obtenerSugerencias, marcarLeida, archivarSugerencia } = require('../controllers/buzon.controller')

// RF-50: límite por IP antes de validar y guardar.
router.post('/', limitarBuzon, enviarSugerencia)
router.get('/', verificarToken, verificarAdmin, obtenerSugerencias)
router.put('/:id/leida', verificarToken, verificarAdmin, marcarLeida)
router.put('/:id/archivar', verificarToken, verificarAdmin, archivarSugerencia)

module.exports = router