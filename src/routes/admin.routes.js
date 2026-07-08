const router = require('express').Router()
const { verificarToken, verificarAdmin } = require('../middleware/auth.middleware')
const { obtenerResumen } = require('../controllers/admin.controller')

router.get('/resumen', verificarToken, verificarAdmin, obtenerResumen)

module.exports = router
