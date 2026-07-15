const router = require('express').Router()
const { verificarToken, verificarAdmin } = require('../middleware/auth.middleware')
const {
    obtenerContactoPublico,
    obtenerContactoAdmin,
    crearContacto,
    editarContacto,
    eliminarContacto,
    cambiarOrdenContacto
} = require('../controllers/contacto.controller')

router.get('/', obtenerContactoPublico)
router.get('/admin', verificarToken, verificarAdmin, obtenerContactoAdmin)
router.post('/', verificarToken, verificarAdmin, crearContacto)
router.put('/:id', verificarToken, verificarAdmin, editarContacto)
router.delete('/:id', verificarToken, verificarAdmin, eliminarContacto)
router.put('/:id/orden', verificarToken, verificarAdmin, cambiarOrdenContacto)

module.exports = router
