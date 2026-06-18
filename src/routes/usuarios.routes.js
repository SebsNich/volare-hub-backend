const router = require('express').Router()
const { obtenerPerfilPublico, listarUsuarios, cambiarEstadoUsuario, crearAdmin } = require('../controllers/usuarios.controller')
const { verificarToken, verificarAdmin } = require('../middleware/auth.middleware');

router.get('/', verificarToken, verificarAdmin, listarUsuarios)
router.put('/:id/estado', verificarToken, verificarAdmin, cambiarEstadoUsuario)
router.post('/crear-admin', verificarToken, verificarAdmin, crearAdmin)
router.get('/:id', obtenerPerfilPublico)

module.exports = router;