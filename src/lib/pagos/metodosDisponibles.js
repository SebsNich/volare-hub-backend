// Qué formas de pagar ofrece ESTE servidor. El frontend pregunta esto en vez de
// tener un proveedor escrito a mano: así, al elegir el proveedor real, solo cambia
// la variable del servidor y la pantalla se adapta sola.
const PROVEEDOR_TRANSFERENCIA = 'TRANSFERENCIA_MANUAL'

// Solo datos públicos: nunca se devuelve el objeto del proveedor ni sus funciones.
function describirMetodosDePago(registro) {
    const codigoEnLinea = registro.codigoEnLinea
    const proveedorEnLinea = codigoEnLinea ? registro.obtener(codigoEnLinea) : null

    return {
        enLinea: {
            disponible: Boolean(proveedorEnLinea),
            proveedor: proveedorEnLinea?.codigo ?? null,
            // El simulado no mueve dinero real: la pantalla lo avisa con una etiqueta.
            esSimulacion: proveedorEnLinea ? !proveedorEnLinea.capacidades.disponibleEnProduccion : false,
            vigenciaMinutos: proveedorEnLinea?.capacidades.vigenciaMinutos ?? null
        },
        transferencia: {
            disponible: Boolean(registro.obtener(PROVEEDOR_TRANSFERENCIA)),
            proveedor: PROVEEDOR_TRANSFERENCIA
        }
    }
}

module.exports = { describirMetodosDePago }
