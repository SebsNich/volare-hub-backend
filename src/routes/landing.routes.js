const router = require('express').Router()
const { obtenerCarruselPublico, obtenerNoticiasPublicas } = require('../controllers/landing.controller')

router.get('/carrusel', obtenerCarruselPublico)
router.get('/noticias', obtenerNoticiasPublicas)

module.exports = router
