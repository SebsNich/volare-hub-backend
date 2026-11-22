const router = require('express').Router()
const { verificarToken, verificarAdmin } = require('../middleware/auth.middleware')
const { enviarInforme, cantidadDestinatarios } = require('../controllers/informes.controller')
const { camposAdjuntosInforme } = require('../lib/multer')

router.get('/destinatarios', verificarToken, verificarAdmin, cantidadDestinatarios)
router.post('/', verificarToken, verificarAdmin, camposAdjuntosInforme, enviarInforme)

module.exports = router
