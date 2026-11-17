// Qué proveedores de pago existen en este servidor. Se arma UNA vez al arrancar:
// si la configuración es peligrosa (el simulado en producción) o está mal escrita,
// el servidor no arranca, igual que con TRUST_PROXY_SALTOS.
const { validarProveedor } = require('./contrato')
const { crearProveedorSimulado } = require('./proveedores/simulado')
const { crearProveedorTransferenciaManual } = require('./proveedores/transferenciaManual')

const VARIABLE_EN_LINEA = 'PAGOS_PROVEEDOR_EN_LINEA'

// Proveedores en línea conocidos. El real se agrega aquí cuando se elija.
const FABRICAS_EN_LINEA = {
    SIMULADO: () => crearProveedorSimulado()
}

function asegurarProveedor(proveedor, env) {
    const errores = validarProveedor(proveedor)
    if (errores.length > 0) {
        throw new Error(`El proveedor de pago no cumple el contrato: ${errores.join('; ')}`)
    }
    // Se pregunta por la capacidad, no por el nombre: cualquier proveedor de
    // prueba futuro queda bloqueado igual.
    if (env.NODE_ENV === 'production' && !proveedor.capacidades.disponibleEnProduccion) {
        throw new Error(`El proveedor ${proveedor.codigo} no está disponible en producción. Revisa ${VARIABLE_EN_LINEA}.`)
    }
}

// instancias permite a las pruebas pasar un simulado con guion.
function crearRegistroProveedores(env = {}, instancias = {}) {
    const proveedores = new Map()
    const registrar = (proveedor) => {
        asegurarProveedor(proveedor, env)
        proveedores.set(proveedor.codigo, proveedor)
    }

    registrar(instancias.transferencia ?? crearProveedorTransferenciaManual())

    const codigoEnLinea = (env[VARIABLE_EN_LINEA] ?? '').trim() || null
    if (codigoEnLinea) {
        const fabrica = FABRICAS_EN_LINEA[codigoEnLinea]
        // El mensaje nombra la variable, no su valor: el patrón vale también
        // para variables que algún día guarden datos sensibles.
        if (!fabrica) throw new Error(`${VARIABLE_EN_LINEA} tiene un proveedor desconocido`)
        registrar(codigoEnLinea === 'SIMULADO' && instancias.simulado ? instancias.simulado : fabrica())
    }

    return {
        codigoEnLinea,
        codigos: () => [...proveedores.keys()],
        obtener: (codigo) => proveedores.get(codigo) ?? null
    }
}

module.exports = { crearRegistroProveedores, VARIABLE_EN_LINEA }
