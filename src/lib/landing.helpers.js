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

module.exports = { aPostPublico, puedeEntrarAlCarrusel, calcularCambiosAlEditar }
