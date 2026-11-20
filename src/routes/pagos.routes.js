const router = require('express').Router()
const { verificarToken, verificarAdmin } = require('../middleware/auth.middleware')
const { verificarEstadoCuenta } = require('../middleware/estadoCuenta.middleware')
const { camposEvidenciaTransferencia } = require('../lib/multer')
const {
    metodosDePago, crearPago, confirmarPago, obtenerPago, listarPagos, registrarTransferencia, decidirPagoManual
} = require('../controllers/pagos.controller')

// Pagar es un servicio: solo cuentas aprobadas y activas, como las reservas.
// Quién es dueño de cada pago lo decide el servicio (otro usuario → 404).
const cuentaAprobada = verificarEstadoCuenta()

// Antes de '/:id' para que "metodos" no se tome como un id de pago.
router.get('/metodos', verificarToken, cuentaAprobada, metodosDePago)
router.post('/', verificarToken, cuentaAprobada, crearPago)
// La evidencia llega como multipart (campo "evidencia", hasta 5 archivos JPG, PNG o PDF).
router.post('/transferencia', verificarToken, cuentaAprobada, camposEvidenciaTransferencia, registrarTransferencia)
router.get('/', verificarToken, cuentaAprobada, listarPagos)
router.get('/:id', verificarToken, cuentaAprobada, obtenerPago)
router.post('/:id/confirmar', verificarToken, cuentaAprobada, confirmarPago)
router.post('/:id/decidir', verificarToken, verificarAdmin, decidirPagoManual)

module.exports = router
