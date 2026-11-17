const router = require('express').Router()
const { verificarToken } = require('../middleware/auth.middleware')
const { verificarEstadoCuenta } = require('../middleware/estadoCuenta.middleware')
const { crearPago, confirmarPago, obtenerPago, listarPagos } = require('../controllers/pagos.controller')

// Pagar es un servicio: solo cuentas aprobadas y activas, como las reservas.
// Quién es dueño de cada pago lo decide el servicio (otro usuario → 404).
const cuentaAprobada = verificarEstadoCuenta()

router.post('/', verificarToken, cuentaAprobada, crearPago)
router.get('/', verificarToken, cuentaAprobada, listarPagos)
router.get('/:id', verificarToken, cuentaAprobada, obtenerPago)
router.post('/:id/confirmar', verificarToken, cuentaAprobada, confirmarPago)

module.exports = router
