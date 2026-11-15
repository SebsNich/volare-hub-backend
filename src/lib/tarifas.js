// Única fuente de los precios de reservas. Están en centavos enteros para que
// ningún cálculo de dinero dependa de decimales de coma flotante. El frontend
// los pide a GET /api/reservas/tarifas en vez de tener su propia copia.

const CABANAS = ['CABANA_ARBOL', 'CABANA_MEDIO', 'CABANA_RIO']
const HORARIOS_CASA_CLUB = ['CASA_CLUB_MATUTINO', 'CASA_CLUB_VESPERTINO', 'CASA_CLUB_NOCTURNO']

const TARIFA_CABANA = { alquilerCentavos: 1500, garantiaCentavos: 2500 }
const TARIFAS_CASA_CLUB = {
    DIURNO: {
        residente: { alquilerCentavos: 8000, garantiaCentavos: 8000 },
        tercero: { alquilerCentavos: 12000, garantiaCentavos: 12000 }
    },
    NOCTURNO: {
        residente: { alquilerCentavos: 10000, garantiaCentavos: 10000 },
        tercero: { alquilerCentavos: 20000, garantiaCentavos: 20000 }
    }
}

// Las cabañas no tienen precio distinto para terceros: solo Casa Club se reserva para otra persona.
function calcularMontosCentavos(espacio, horario, esParaTercero) {
    if (CABANAS.includes(espacio) && horario === 'CABANA_COMPLETO') {
        return { ...TARIFA_CABANA }
    }
    if (espacio === 'CASA_CLUB' && HORARIOS_CASA_CLUB.includes(horario)) {
        const franja = horario === 'CASA_CLUB_NOCTURNO' ? 'NOCTURNO' : 'DIURNO'
        return { ...TARIFAS_CASA_CLUB[franja][esParaTercero ? 'tercero' : 'residente'] }
    }
    throw new Error(`Espacio u horario sin tarifa: ${espacio} / ${horario}`)
}

// Tabla completa para el frontend: tabla[espacio][horario][residente|tercero].
// Así el formulario solo busca el precio y no repite ninguna regla.
function tablaTarifas() {
    const horariosPorEspacio = {
        ...Object.fromEntries(CABANAS.map(cabana => [cabana, ['CABANA_COMPLETO']])),
        CASA_CLUB: HORARIOS_CASA_CLUB
    }
    const tabla = {}
    for (const [espacio, horarios] of Object.entries(horariosPorEspacio)) {
        tabla[espacio] = {}
        for (const horario of horarios) {
            tabla[espacio][horario] = {
                residente: calcularMontosCentavos(espacio, horario, false),
                tercero: calcularMontosCentavos(espacio, horario, true)
            }
        }
    }
    return tabla
}

module.exports = { calcularMontosCentavos, tablaTarifas }
