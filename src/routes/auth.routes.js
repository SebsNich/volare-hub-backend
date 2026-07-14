const router = require('express').Router()
const { verificarToken } = require('../middleware/auth.middleware')
const { registrar, login, solicitarRecuperacion, restablecerContrasena, obtenerPerfil, editarPerfil, cambiarPassword, cambiarEmail } = require('../controllers/auth.controller')
const { upload } = require('../lib/multer')

router.post('/registrar', registrar)
router.post('/login', login)
router.post('/solicitar-recuperacion', solicitarRecuperacion)
router.post('/restablecer-contrasena', restablecerContrasena)
router.get('/perfil', verificarToken, obtenerPerfil)
router.put('/editar-perfil', verificarToken, upload.single('foto'), editarPerfil)
router.put('/cambiar-password', verificarToken, cambiarPassword)
router.put('/cambiar-email', verificarToken, cambiarEmail)

module.exports = router;