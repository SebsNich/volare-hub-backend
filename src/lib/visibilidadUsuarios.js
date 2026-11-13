// Qué cuentas puede ver cada quien en el buscador y en los perfiles (RF-29).
// Una cuenta pendiente, rechazada o inactiva todavía no es un vecino verificado:
// los residentes no deben ver sus datos. El admin las ve todas para gestionarlas.

const CUENTA_VISIBLE = { activo: true, estadoCuenta: 'APROBADA' };

const esAdmin = (solicitante) => solicitante?.rol === 'ADMIN';

function filtroResidentesVisibles(solicitante) {
    return esAdmin(solicitante) ? {} : { ...CUENTA_VISIBLE };
}

function puedeVerPerfil(perfil, solicitante) {
    if (!perfil) return false;
    if (esAdmin(solicitante) || perfil.id === solicitante?.id) return true;
    return perfil.activo === CUENTA_VISIBLE.activo && perfil.estadoCuenta === CUENTA_VISIBLE.estadoCuenta;
}

module.exports = { filtroResidentesVisibles, puedeVerPerfil };
