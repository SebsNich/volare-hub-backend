const LIMITE_CUENTAS_POR_CASA = 2
const ESTADOS_QUE_OCUPAN_CUPO = ['PENDIENTE', 'APROBADA']
const LARGO_MAXIMO_MOTIVO = 500

// Formato oficial de Volare: números de dos dígitos ("01") y letras en mayúscula.
// Se quitan ceros sobrantes antes de rellenar para que "001" y "1" sean "01".
function normalizarCodigoCasa(valor) {
    const limpio = String(valor ?? '').trim().toUpperCase()
    if (!/^\d+$/.test(limpio)) return limpio
    return limpio.replace(/^0+(?=\d)/, '').padStart(2, '0')
}

function normalizarDireccion(manzana, villa) {
    return { manzana: normalizarCodigoCasa(manzana), villa: normalizarCodigoCasa(villa) }
}

function normalizarEmail(email) {
    return String(email ?? '').trim().toLowerCase()
}

// Normaliza también los datos guardados, así los registros viejos mal
// formateados ("2") cuentan como su forma oficial ("02") sin modificarlos.
function contarCuentasEnCasa(usuarios, manzana, villa) {
    const casa = normalizarDireccion(manzana, villa)
    return usuarios.filter(usuario => {
        if (usuario.rol !== 'RESIDENTE') return false
        if (!ESTADOS_QUE_OCUPAN_CUPO.includes(usuario.estadoCuenta)) return false
        const suCasa = normalizarDireccion(usuario.manzana, usuario.villa)
        return suCasa.manzana === casa.manzana && suCasa.villa === casa.villa
    }).length
}

// Para que el ADMIN vea, junto a cada solicitud, cuántas cuentas ya ocupan esa casa.
function agregarCuentasEnCasa(solicitudes, residentes) {
    return solicitudes.map(solicitud => ({
        ...solicitud,
        cuentasEnCasa: contarCuentasEnCasa(residentes, solicitud.manzana, solicitud.villa)
    }))
}

function alcanzaLimiteCasa(cantidad) {
    return cantidad >= LIMITE_CUENTAS_POR_CASA
}

function mensajeLimiteCasa(manzana, villa) {
    const casa = normalizarDireccion(manzana, villa)
    return `La manzana ${casa.manzana}, villa ${casa.villa} ya tiene ${LIMITE_CUENTAS_POR_CASA} cuentas registradas. Si crees que es un error, contacta a la administración.`
}

// Variante para el ADMIN: él es la administración, así que no se le pide contactarla.
// No sugiere desactivar porque una cuenta inactiva sigue ocupando cupo.
function mensajeLimiteCasaParaAdmin(manzana, villa) {
    const casa = normalizarDireccion(manzana, villa)
    return `No se puede aprobar: la manzana ${casa.manzana}, villa ${casa.villa} ya tiene ${LIMITE_CUENTAS_POR_CASA} cuentas de residentes pendientes o aprobadas. Revisa las cuentas de esa casa antes de aprobar esta.`
}

const RESPUESTAS = {
    inactiva: { status: 403, codigo: 'CUENTA_INACTIVA', mensaje: 'Usuario inactivo. Contacta al administrador.' },
    pendiente: { status: 403, codigo: 'CUENTA_PENDIENTE', mensaje: 'Tu cuenta está pendiente de aprobación. Podrás publicar y reservar cuando un administrador la apruebe.' },
    noEncontrada: { status: 401, codigo: 'CUENTA_NO_ENCONTRADA', mensaje: 'Tu sesión ya no es válida. Inicia sesión de nuevo.' },
    yaDecidida: { status: 409, codigo: 'YA_DECIDIDA', mensaje: 'Esta solicitud ya fue decidida.' }
}

// El ADMIN escribe el motivo libremente: puede terminarlo o no en punto,
// así que el punto solo se agrega si falta, para no mostrar "..".
function cerrarFrase(texto) {
    const limpio = texto.trim()
    return /[.!?…]$/.test(limpio) ? limpio : `${limpio}.`
}

function respuestaRechazada(usuario) {
    const motivo = usuario.motivoRechazo ? ` Motivo: ${cerrarFrase(usuario.motivoRechazo)}` : ''
    return {
        status: 403,
        codigo: 'CUENTA_RECHAZADA',
        mensaje: `Tu solicitud de registro fue rechazada.${motivo} Contacta a la administración si necesitas ayuda.`
    }
}

// Se llama solo después de validar la contraseña, para no revelar el estado
// de una cuenta a quien solo conoce el correo.
function respuestaLoginSegunEstado(usuario) {
    if (!usuario.activo) return RESPUESTAS.inactiva
    if (usuario.estadoCuenta === 'RECHAZADA') return respuestaRechazada(usuario)
    if (usuario.estadoCuenta === 'PENDIENTE') {
        return { status: 200, codigo: 'CUENTA_PENDIENTE', mensaje: 'Iniciaste sesión. Tu cuenta está pendiente de aprobación: por ahora solo puedes ver las publicaciones.' }
    }
    return { status: 200, codigo: null, mensaje: 'Inicio de sesión exitoso' }
}

// Devuelve null si puede pasar, o la respuesta de error que debe enviarse.
function evaluarAccesoCuenta(usuario, { permitirPendiente = false } = {}) {
    if (!usuario) return RESPUESTAS.noEncontrada
    if (!usuario.activo) return RESPUESTAS.inactiva
    if (usuario.estadoCuenta === 'RECHAZADA') return respuestaRechazada(usuario)
    if (usuario.estadoCuenta === 'PENDIENTE' && !permitirPendiente) return RESPUESTAS.pendiente
    return null
}

// cuentasEnCasa no incluye a este usuario cuando está RECHAZADA, porque
// una rechazada no ocupa cupo: por eso hay que volver a comprobar al aprobarla.
function validarDecision(usuario, accion, cuentasEnCasa) {
    if (accion === 'rechazar') {
        return usuario.estadoCuenta === 'PENDIENTE' ? null : RESPUESTAS.yaDecidida
    }
    if (usuario.estadoCuenta === 'APROBADA') return RESPUESTAS.yaDecidida
    if (usuario.estadoCuenta === 'RECHAZADA' && alcanzaLimiteCasa(cuentasEnCasa)) {
        return { status: 409, codigo: 'LIMITE_VILLA', mensaje: mensajeLimiteCasaParaAdmin(usuario.manzana, usuario.villa) }
    }
    return null
}

function validarMotivoRechazo(motivo) {
    const texto = String(motivo ?? '').trim()
    if (!texto) return 'El motivo del rechazo es obligatorio'
    if (texto.length > LARGO_MAXIMO_MOTIVO) return `El motivo no puede tener más de ${LARGO_MAXIMO_MOTIVO} caracteres`
    return null
}

function cambiosAlAprobar(adminId, ahora) {
    return { estadoCuenta: 'APROBADA', decididoPorId: adminId, fechaDecision: ahora, motivoRechazo: null }
}

function cambiosAlRechazar(adminId, motivo, ahora) {
    return { estadoCuenta: 'RECHAZADA', decididoPorId: adminId, fechaDecision: ahora, motivoRechazo: motivo.trim() }
}

// Si la coincidencia es una cuenta RECHAZADA, el aviso es genérico: quien
// escribe esa cédula podría no ser su dueño, y el motivo es privado.
function respuestaDuplicado({ porEmail, porCedula }) {
    const coincidencia = porEmail || porCedula
    if (!coincidencia) return null
    if (coincidencia.estadoCuenta === 'RECHAZADA') {
        return { status: 409, codigo: 'SOLICITUD_RECHAZADA', mensaje: 'Ya existe una solicitud con estos datos. Contacta a la administración.' }
    }
    if (porEmail) return { status: 409, codigo: 'EMAIL_DUPLICADO', mensaje: 'El email ya está registrado' }
    return { status: 409, codigo: 'CEDULA_DUPLICADA', mensaje: 'La cédula ya está registrada' }
}

// Postgres canceló la transacción Serializable porque otra la tocó a la vez.
// No es un error del usuario: se puede reintentar. Prisma lo informa como P2034,
// pero con @prisma/adapter-pg llega como DriverAdapterError con el código
// original de Postgres (40001) en "cause"; se reconocen ambas formas.
function esConflictoDeTransaccion(error) {
    return error?.code === 'P2034'
        || error?.cause?.kind === 'TransactionWriteConflict'
        || error?.cause?.originalCode === '40001'
}

module.exports = {
    LIMITE_CUENTAS_POR_CASA,
    ESTADOS_QUE_OCUPAN_CUPO,
    normalizarCodigoCasa,
    normalizarDireccion,
    normalizarEmail,
    contarCuentasEnCasa,
    alcanzaLimiteCasa,
    mensajeLimiteCasa,
    respuestaLoginSegunEstado,
    evaluarAccesoCuenta,
    validarDecision,
    validarMotivoRechazo,
    cambiosAlAprobar,
    cambiosAlRechazar,
    esConflictoDeTransaccion,
    respuestaDuplicado,
    agregarCuentasEnCasa
}
