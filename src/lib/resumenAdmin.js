// Filtros del resumen del panel (RF-57). Una cuenta pendiente o rechazada
// todavía no es un residente: contarla inflaría "Residentes activos".
const FILTRO_RESIDENTES_ACTIVOS = Object.freeze({ rol: 'RESIDENTE', activo: true, estadoCuenta: 'APROBADA' });

// El mismo filtro que usa la lista de solicitudes, para que la tarjeta y la
// lista den siempre el mismo número.
const FILTRO_SOLICITUDES_PENDIENTES = Object.freeze({ estadoCuenta: 'PENDIENTE' });

module.exports = { FILTRO_RESIDENTES_ACTIVOS, FILTRO_SOLICITUDES_PENDIENTES };
