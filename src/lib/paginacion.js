const TAMANO_PAGINA_DEFECTO = 10;

function obtenerParametrosPaginacion(query = {}) {
    const paginaParsed = parseInt(query.pagina, 10);
    const tamanoParsed = parseInt(query.tamanoPagina, 10);

    const pagina = Number.isInteger(paginaParsed) && paginaParsed > 0 ? paginaParsed : 1;
    const tamanoPagina = Number.isInteger(tamanoParsed) && tamanoParsed > 0 ? tamanoParsed : TAMANO_PAGINA_DEFECTO;

    return {
        skip: (pagina - 1) * tamanoPagina,
        take: tamanoPagina,
        pagina,
        tamanoPagina
    };
}

module.exports = { obtenerParametrosPaginacion };
