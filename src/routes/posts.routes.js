const router = require('express').Router()
const { verificarToken } = require('../middleware/auth.middleware')
const { crearPost, obtenerPosts, obtenerPostPorId, editarPost, eliminarPost } = require('../controllers/posts.controller')
const upload = require('../lib/multer')

router.post('/', verificarToken, upload.single('imagen'), crearPost)
router.get('/', obtenerPosts)
router.get('/:id', obtenerPostPorId)
router.put('/:id', verificarToken, upload.single('imagen'), editarPost)
router.delete('/:id', verificarToken, eliminarPost)

module.exports = router;