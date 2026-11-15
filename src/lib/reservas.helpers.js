const { calcularMontosCentavos } = require('./tarifas')

const CABANAS = ['CABANA_ARBOL', 'CABANA_MEDIO', 'CABANA_RIO']
const HORARIOS_CASA_CLUB = ['CASA_CLUB_MATUTINO', 'CASA_CLUB_VESPERTINO', 'CASA_CLUB_NOCTURNO']

function esCabana(espacio) {
    return CABANAS.includes(espacio)
}

function obtenerCarpetaReserva(espacio, subcarpeta) {
    const grupo = espacio === 'CASA_CLUB' ? 'casaclub' : 'cabanas'
    return `servicios/reservas/${grupo}/${subcarpeta}`
}

function validarDisponibilidadHorario(espacio, fecha, horario) {
    const fechaObj = fecha instanceof Date ? fecha : new Date(fecha)

    if (isNaN(fechaObj.getTime())) {
        return { valido: false, mensaje: 'Fecha inválida' }
    }

    const diaSemana = fechaObj.getUTCDay() // 0=domingo, 1=lunes, ..., 6=sabado

    if (esCabana(espacio)) {
        if (diaSemana === 1) {
            return { valido: false, mensaje: 'Las cabañas no se pueden reservar los lunes' }
        }
        if (horario !== 'CABANA_COMPLETO') {
            return { valido: false, mensaje: 'El horario para cabañas debe ser CABANA_COMPLETO' }
        }
        return { valido: true }
    }

    if (espacio === 'CASA_CLUB') {
        if (diaSemana === 0 || diaSemana === 1) {
            return { valido: false, mensaje: 'Casa Club no se puede reservar los domingos ni lunes' }
        }
        if (!HORARIOS_CASA_CLUB.includes(horario)) {
            return { valido: false, mensaje: 'Horario inválido para Casa Club' }
        }
        if (diaSemana === 6 && horario === 'CASA_CLUB_VESPERTINO') {
            return { valido: false, mensaje: 'Casa Club no tiene horario vespertino los sábados' }
        }
        return { valido: true }
    }

    return { valido: false, mensaje: 'Espacio inválido' }
}

function obtenerRangoMes(mes) {
    if (!mes || !/^\d{4}-\d{2}$/.test(mes)) {
        return null
    }
    const [anio, mesNum] = mes.split('-').map(Number)
    const inicio = new Date(Date.UTC(anio, mesNum - 1, 1))
    const fin = new Date(Date.UTC(anio, mesNum, 1))
    return { inicio, fin }
}

// La Reserva guarda los montos en dólares (Decimal); los precios salen de tarifas.js.
function calcularMontos(espacio, horario, esParaTercero) {
    const { alquilerCentavos, garantiaCentavos } = calcularMontosCentavos(espacio, horario, esParaTercero)
    return { montoAlquiler: alquilerCentavos / 100, montoGarantia: garantiaCentavos / 100 }
}

module.exports = {
    CABANAS,
    esCabana,
    obtenerCarpetaReserva,
    obtenerRangoMes,
    validarDisponibilidadHorario,
    calcularMontos
}
