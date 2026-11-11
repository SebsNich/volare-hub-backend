const router = require('express').Router()
const { verificarToken, verificarAdmin } = require('../middleware/auth.middleware')
const { crearPost, obtenerPosts, obtenerPostPorId, editarPost, eliminarPost, anclarPost, anclarPostPerfil, cambiarPublico, cambiarCarrusel } = require('../controllers/posts.controller')
const { upload } = require('../lib/multer')
const { verificarEstadoCuenta } = require('../middleware/estadoCuenta.middleware')

// Una cuenta pendiente puede leer el feed, pero no publicar, editar ni borrar.
const soloLectura = verificarEstadoCuenta({ permitirPendiente: true })
const cuentaAprobada = verificarEstadoCuenta()

router.post('/', verificarToken, cuentaAprobada, upload.fields([
    { name: 'imagenes', maxCount: 10 },
    { name: 'archivos', maxCount: 10 }
]), crearPost)
router.get('/', verificarToken, soloLectura, obtenerPosts)
router.get('/:id', verificarToken, soloLectura, obtenerPostPorId)
router.put('/:id', verificarToken, cuentaAprobada, upload.fields([
    { name: 'imagenes', maxCount: 10 },
    { name: 'archivos', maxCount: 10 }
]), editarPost)
router.put('/:id/anclar', verificarToken, verificarAdmin, anclarPost)
router.put('/:id/anclar-perfil', verificarToken, cuentaAprobada, anclarPostPerfil)
router.put('/:id/publico', verificarToken, verificarAdmin, cambiarPublico)
router.put('/:id/carrusel', verificarToken, verificarAdmin, cambiarCarrusel)
router.delete('/:id', verificarToken, cuentaAprobada, eliminarPost)

module.exports = router;