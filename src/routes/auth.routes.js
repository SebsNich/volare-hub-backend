const router = require('express').Router()
const { verificarToken } = require('../middleware/auth.middleware')
const { registrar, login, obtenerPerfil, editarPerfil, cambiarPassword, cambiarEmail } = require('../controllers/auth.controller')

router.post('/registrar', registrar)
router.post('/login', login)
router.get('/perfil', verificarToken, obtenerPerfil)
router.put('/editar-perfil', verificarToken, editarPerfil)
router.put('/cambiar-password', verificarToken, cambiarPassword)
router.put('/cambiar-email', verificarToken, cambiarEmail)

module.exports = router;