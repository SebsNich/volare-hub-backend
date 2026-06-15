const router = require('express').Router()
const { verificarToken, verificarAdmin } = require('../middleware/auth.middleware')
const { enviarSugerencia, obtenerSugerencias, marcarLeida } = require('../controllers/buzon.controller')

router.post('/', enviarSugerencia)
router.get('/', verificarToken, verificarAdmin, obtenerSugerencias)
router.put('/:id/leida', verificarToken, verificarAdmin, marcarLeida)

module.exports = router