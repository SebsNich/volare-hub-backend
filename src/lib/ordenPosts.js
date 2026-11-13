// Orden de las publicaciones. El id al final desempata posts con la misma
// fecha: sin él, PostgreSQL puede devolverlos en otro orden en cada consulta
// y la paginación podría repetir u omitir alguno.
const ORDEN_FEED = [{ anclado: 'desc' }, { creadoEn: 'desc' }, { id: 'desc' }];
const ORDEN_PERFIL = [{ ancladoPerfil: 'desc' }, { creadoEn: 'desc' }, { id: 'desc' }];

module.exports = { ORDEN_FEED, ORDEN_PERFIL };
