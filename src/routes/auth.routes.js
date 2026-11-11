const router = require('express').Router()
const { verificarToken } = require('../middleware/auth.middleware')
const { registrar, login, solicitarRecuperacion, restablecerContrasena, obtenerPerfil, editarPerfil, cambiarPassword, cambiarEmail } = require('../controllers/auth.controller')
const { upload } = require('../lib/multer')
const { verificarEstadoCuenta } = require('../middleware/estadoCuenta.middleware')

// Una cuenta pendiente gestiona su propia cuenta; una rechazada o inactiva, no.
const cuentaPropia = verificarEstadoCuenta({ permitirPendiente: true })

router.post('/registrar', registrar)
router.post('/login', login)
router.post('/solicitar-recuperacion', solicitarRecuperacion)
router.post('/restablecer-contrasena', restablecerContrasena)
router.get('/perfil', verificarToken, cuentaPropia, obtenerPerfil)
router.put('/editar-perfil', verificarToken, cuentaPropia, upload.single('foto'), editarPerfil)
router.put('/cambiar-password', verificarToken, cuentaPropia, cambiarPassword)
router.put('/cambiar-email', verificarToken, cuentaPropia, cambiarEmail)

module.exports = router;