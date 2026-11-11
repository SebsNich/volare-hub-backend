const { ESTADOS_QUE_OCUPAN_CUPO } = require('./registro.helpers')

// Recibe el cliente (prisma o la "tx" de una transacción) para servir en ambos casos.
// Trae solo lo necesario para contarCuentasEnCasa, que normaliza en memoria.
function buscarResidentesQueOcupanCupo(cliente) {
    return cliente.user.findMany({
        where: { rol: 'RESIDENTE', estadoCuenta: { in: ESTADOS_QUE_OCUPAN_CUPO } },
        select: { rol: true, estadoCuenta: true, manzana: true, villa: true }
    })
}

module.exports = { buscarResidentesQueOcupanCupo }
