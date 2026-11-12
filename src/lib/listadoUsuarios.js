// Un solo parámetro "estado" sirve al desplegable del panel: ACTIVO/INACTIVO
// miran si la cuenta está habilitada; PENDIENTE/RECHAZADA, la decisión del registro.
const FILTROS_POR_ESTADO = {
    ACTIVO: { activo: true },
    INACTIVO: { activo: false },
    PENDIENTE: { estadoCuenta: 'PENDIENTE' },
    RECHAZADA: { estadoCuenta: 'RECHAZADA' }
};

function construirFiltroUsuarios({ busqueda, manzanaVilla, estado } = {}) {
    const filtros = [];
    if (busqueda) {
        filtros.push({
            OR: [
                { nombres: { contains: busqueda, mode: 'insensitive' } },
                { apellidos: { contains: busqueda, mode: 'insensitive' } }
            ]
        });
    }
    if (manzanaVilla) {
        filtros.push({
            OR: [
                { manzana: { contains: manzanaVilla, mode: 'insensitive' } },
                { villa: { contains: manzanaVilla, mode: 'insensitive' } }
            ]
        });
    }
    // hasOwn evita que un valor como "toString" saque algo del prototipo.
    if (Object.hasOwn(FILTROS_POR_ESTADO, estado)) filtros.push(FILTROS_POR_ESTADO[estado]);

    return filtros.length ? { AND: filtros } : {};
}

module.exports = { construirFiltroUsuarios };
