const router = require('express').Router()
const { verificarToken, verificarAdmin } = require('../middleware/auth.middleware')
const { crearPost, obtenerPosts, obtenerPostPorId, editarPost, eliminarPost, anclarPost, anclarPostPerfil, cambiarPublico, cambiarCarrusel } = require('../controllers/posts.controller')
const { upload } = require('../lib/multer')

router.post('/', verificarToken, upload.fields([
    { name: 'imagenes', maxCount: 10 },
    { name: 'archivos', maxCount: 10 }
]), crearPost)
router.get('/', verificarToken, obtenerPosts)
router.get('/:id', verificarToken, obtenerPostPorId)
router.put('/:id', verificarToken, upload.fields([
    { name: 'imagenes', maxCount: 10 },
    { name: 'archivos', maxCount: 10 }
]), editarPost)
router.put('/:id/anclar', verificarToken, verificarAdmin, anclarPost)
router.put('/:id/anclar-perfil', verificarToken, anclarPostPerfil)
router.put('/:id/publico', verificarToken, verificarAdmin, cambiarPublico)
router.put('/:id/carrusel', verificarToken, verificarAdmin, cambiarCarrusel)
router.delete('/:id', verificarToken, eliminarPost)

module.exports = router;