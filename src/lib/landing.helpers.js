function aPostPublico(post) {
    return {
        id: post.id,
        titulo: post.titulo,
        descripcion: post.descripcion,
        tipo: post.tipo,
        imagenUrl: post.imagenUrl?.[0] ?? null,
        creadoEn: post.creadoEn
    }
}

function puedeEntrarAlCarrusel(post) {
    return post.publico === true
        && post.estado === 'ACTIVO'
        && Array.isArray(post.imagenUrl)
        && post.imagenUrl.length > 0
}

function calcularCambiosAlEditar(post, usuarioEditor) {
    if (usuarioEditor?.rol !== 'ADMIN' && post.publico) {
        return { publico: false, enCarrusel: false, publicadoPorId: null, publicadoEn: null }
    }
    return {}
}

// Recibe "ahora" como parámetro para que la prueba no dependa del reloj.
function calcularCambiosPublico(publico, adminId, ahora) {
    if (publico) {
        return { publico: true, publicadoPorId: adminId, publicadoEn: ahora }
    }
    // Un post privado no puede quedarse en el carrusel de la landing.
    return { publico: false, enCarrusel: false, publicadoPorId: null, publicadoEn: null }
}

// Devuelve el mensaje de error, o null si el cambio es válido.
function validarCambioCarrusel(post, enCarrusel) {
    if (!enCarrusel) return null
    if (!post.publico) return 'Primero marca la publicación como pública para ponerla en el carrusel'
    if (post.estado !== 'ACTIVO') return 'Solo una publicación activa puede ir al carrusel'
    if (!post.imagenUrl?.length) return 'La publicación necesita al menos una imagen para ir al carrusel'
    return null
}

module.exports = {
    aPostPublico,
    puedeEntrarAlCarrusel,
    calcularCambiosAlEditar,
    calcularCambiosPublico,
    validarCambioCarrusel
}
