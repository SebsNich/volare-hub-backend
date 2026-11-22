// Quién puede ver cada publicación. Las cuentas PENDIENTES leen el feed, pero
// las publicaciones marcadas "soloAprobados" (como el informe económico) no.

const esCuentaAprobada = (usuario) => usuario?.rol === 'ADMIN' || usuario?.estadoCuenta === 'APROBADA'

// Condición para agregar al "where" de Prisma en los listados.
const filtroVisibilidad = (usuario) => (esCuentaAprobada(usuario) ? {} : { soloAprobados: false })

const puedeVerPost = (post, usuario) => !post.soloAprobados || esCuentaAprobada(usuario)

module.exports = { esCuentaAprobada, filtroVisibilidad, puedeVerPost }
