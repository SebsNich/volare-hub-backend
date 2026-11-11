const router = require('express').Router()
const { obtenerPerfilPublico, buscarUsuarios, listarUsuarios, cambiarEstadoUsuario, crearAdmin } = require('../controllers/usuarios.controller')
const { verificarToken, verificarAdmin } = require('../middleware/auth.middleware');
const { verificarEstadoCuenta } = require('../middleware/estadoCuenta.middleware')

// Una cuenta pendiente aún no está verificada: no puede buscar residentes ni
// ver perfiles ajenos (datos de vecinos), pero sí el suyo.
const esSuPropioPerfil = (req) => req.params.id === req.user.id

router.get('/buscar', verificarToken, verificarEstadoCuenta(), buscarUsuarios)
router.get('/', verificarToken, verificarAdmin, listarUsuarios)
router.put('/:id/estado', verificarToken, verificarAdmin, cambiarEstadoUsuario)
router.post('/crear-admin', verificarToken, verificarAdmin, crearAdmin)
router.get('/:id', verificarToken, verificarEstadoCuenta({ permitirPendiente: esSuPropioPerfil }), obtenerPerfilPublico)

module.exports = router;