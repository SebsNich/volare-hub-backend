const router = require('express').Router()
const { obtenerPerfilPublico } = require('../controllers/usuarios.controller')

router.get('/:id', obtenerPerfilPublico)

module.exports = router;