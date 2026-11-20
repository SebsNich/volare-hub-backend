const router = require('express').Router()
const { verificarToken, verificarAdmin } = require('../middleware/auth.middleware')
const { verificarEstadoCuenta } = require('../middleware/estadoCuenta.middleware')
const { camposEvidenciaTransferencia } = require('../lib/multer')
const c = require('../controllers/alicuotas.controller')

// Pagar es un servicio: solo cuentas aprobadas y activas.
const cuentaAprobada = verificarEstadoCuenta()

// Rutas fijas antes de '/:id/...' para que "mias" o "config" no se tomen como un id.
router.get('/config', verificarToken, cuentaAprobada, c.obtenerConfig)
router.put('/config', verificarToken, verificarAdmin, c.actualizarConfig)
router.get('/mias', verificarToken, cuentaAprobada, c.misCuotas)
router.post('/generar', verificarToken, verificarAdmin, c.generarCuotas)
router.post('/pagar', verificarToken, cuentaAprobada, c.pagarEnLinea)
// Evidencia como multipart (campo "evidencia", hasta 5 archivos JPG, PNG o PDF).
router.post('/transferencia', verificarToken, cuentaAprobada, camposEvidenciaTransferencia, c.pagarPorTransferencia)
router.get('/', verificarToken, verificarAdmin, c.listarCuotas)
router.post('/:id/anular', verificarToken, verificarAdmin, c.anularCuota)

module.exports = router
