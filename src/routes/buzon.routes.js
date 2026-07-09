const router = require('express').Router()
const { verificarToken, verificarAdmin } = require('../middleware/auth.middleware')
const { enviarSugerencia, obtenerSugerencias, marcarLeida, archivarSugerencia } = require('../controllers/buzon.controller')

router.post('/', enviarSugerencia)
router.get('/', verificarToken, verificarAdmin, obtenerSugerencias)
router.put('/:id/leida', verificarToken, verificarAdmin, marcarLeida)
router.put('/:id/archivar', verificarToken, verificarAdmin, archivarSugerencia)

module.exports = router