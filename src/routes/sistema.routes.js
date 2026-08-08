const router = require('express').Router()
const { keepalive } = require('../controllers/sistema.controller')

router.get('/keepalive', keepalive)

module.exports = router
