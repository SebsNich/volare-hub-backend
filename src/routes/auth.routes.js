const router = require('express').Router()
const { verificarToken } = require('../middleware/auth.middleware')
const { registrar, login, obtenerPerfil, editarPerfil } = require('../controllers/auth.controller')

router.post('/registrar', registrar)
router.post('/login', login)
router.get('/perfil', verificarToken, obtenerPerfil)
router.put('/editar-perfil', verificarToken, editarPerfil)

module.exports = router;