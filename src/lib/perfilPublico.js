// Qué se muestra del perfil de un vecino y qué puede cambiar cada quien (RF-29).

// Entre vecinos solo se ve nombre, foto, manzana y villa. La bio la escribe el
// propio residente para mostrarla, y las visitas y la fecha son del perfil.
// Cédula, correo, celular y rol quedan fuera: un select explícito evita que un
// campo nuevo del modelo se filtre sin que nadie lo decida.
const SELECCION_PERFIL_PUBLICO = {
    id: true,
    nombres: true,
    apellidos: true,
    foto: true,
    manzana: true,
    villa: true,
    bio: true,
    creadoEn: true,
    visitasPerfil: true
};

// El buscador muestra lo mismo que se ve entre vecinos, sin la bio (una lista
// corta no la necesita). activo y estadoCuenta quedan para la etiqueta del
// admin; a un residente solo le llegan cuentas aprobadas y activas.
const SELECCION_BUSCADOR = {
    id: true,
    nombres: true,
    apellidos: true,
    foto: true,
    manzana: true,
    villa: true,
    activo: true,
    estadoCuenta: true
};

// Rol, manzana y villa no se editan desde el perfil: el rol lo da el admin y la
// casa cuenta para el límite de 2 cuentas por villa del registro. Por eso se
// copia solo lo permitido en vez de pasar el body completo a la base.
const CAMPOS_EDITABLES = ['nombres', 'apellidos', 'bio'];

function camposEditablesPerfil(body = {}) {
    const datos = {};
    for (const campo of CAMPOS_EDITABLES) {
        if (body?.[campo] !== undefined) datos[campo] = body[campo];
    }
    return datos;
}

module.exports = { SELECCION_PERFIL_PUBLICO, SELECCION_BUSCADOR, camposEditablesPerfil };
