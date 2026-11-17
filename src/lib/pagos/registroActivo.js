// El registro de proveedores de ESTE servidor, armado una sola vez con las
// variables de entorno. app.js lo carga al arrancar: con el simulado en
// producción o un proveedor desconocido, el servidor no llega a escuchar.
const { crearRegistroProveedores } = require('./registroProveedores')

const registroPagos = crearRegistroProveedores(process.env)

module.exports = { registroPagos }
