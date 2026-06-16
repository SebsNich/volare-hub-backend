const router = require('express').Router()
const { verificarToken } = require('../middleware/auth.middleware')
const { crearPost, obtenerPosts, obtenerPostPorId, editarPost, eliminarPost } = require('../controllers/posts.controller')
const upload = require('../lib/multer')

router.post('/', verificarToken, upload.array('imagenes', 10), crearPost)
router.get('/', obtenerPosts)
router.get('/:id', obtenerPostPorId)
router.put('/:id', verificarToken, upload.array('imagenes', 10), editarPost)
router.delete('/:id', verificarToken, eliminarPost)

module.exports = router;