const router = require('express').Router()
const { verificarToken } = require('../middleware/auth.middleware')
const { crearPost, obtenerPosts, obtenerPostPorId, editarPost, eliminarPost } = require('../controllers/posts.controller')

router.post('/', verificarToken, crearPost)
router.get('/', obtenerPosts)
router.get('/:id', obtenerPostPorId)
router.put('/:id', verificarToken, editarPost)
router.delete('/:id', verificarToken, eliminarPost)

module.exports = router;