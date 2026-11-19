// El vencimiento de ESTE servidor, armado una vez con la base y el registro
// de proveedores reales. Lo usan app.js (intervalo) y los controladores de
// reservas (antes de mostrar disponibilidad o crear una reserva).
const prisma = require('../prisma')
const { registroPagos } = require('./registroActivo')
const { crearVencimientoReservas } = require('./vencimientoReservas')

const { vencerReservasSinPago } = crearVencimientoReservas({ prisma, esEnLinea: registroPagos.esPagoEnLinea })

// Para las consultas: si vencer falla, se registra y la consulta sigue. En el
// peor caso el turno se ve ocupado un rato más, que es el lado seguro.
async function vencerSinFallar() {
    try {
        await vencerReservasSinPago()
    } catch (error) {
        console.error('Error al vencer reservas sin pago:', error)
    }
}

module.exports = { vencerReservasSinPago, vencerSinFallar }
