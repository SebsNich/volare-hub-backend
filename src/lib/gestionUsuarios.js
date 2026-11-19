// Reglas para que el admin active o desactive cuentas (RF-52). Función pura:
// devuelve null si el cambio es válido, o { status, error } si no.

function validarCambioEstado({ idObjetivo, activo, solicitante }) {
    // RF-20: "false" como texto se guardaría mal; solo se acepta un booleano.
    if (typeof activo !== 'boolean') return { status: 400, error: 'El estado debe ser true o false' }
    // Si el único admin se desactiva, nadie podría volver a activarlo.
    if (activo === false && idObjetivo === solicitante?.id) {
        return { status: 409, error: 'No puedes desactivar tu propia cuenta. Pide a otro administrador que lo haga.' }
    }
    return null
}

module.exports = { validarCambioEstado }
