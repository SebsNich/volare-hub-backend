const router = require('express').Router()
const { verificarToken, verificarAdmin } = require('../middleware/auth.middleware')
const { crearPost, obtenerPosts, obtenerPostPorId, editarPost, eliminarPost, anclarPost, anclarPostPerfil } = require('../controllers/posts.controller')
const { upload } = require('../lib/multer')

router.post('/', verificarToken, upload.fields([
    { name: 'imagenes', maxCount: 10 },
    { name: 'archivos', maxCount: 10 }
]), crearPost)
router.get('/', obtenerPosts)
router.get('/:id', obtenerPostPorId)
router.put('/:id', verificarToken, upload.fields([
    { name: 'imagenes', maxCount: 10 },
    { name: 'archivos', maxCount: 10 }
]), editarPost)
router.put('/:id/anclar', verificarToken, verificarAdmin, anclarPost)
router.put('/:id/anclar-perfil', verificarToken, anclarPostPerfil)
router.delete('/:id', verificarToken, eliminarPost)

module.exports = router;