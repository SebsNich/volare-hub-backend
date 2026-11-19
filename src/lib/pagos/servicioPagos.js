// Núcleo de pagos: une la base con un proveedor sin saber cuál es. Cada función
// devuelve { status, cuerpo } y el controlador solo lo traduce a HTTP.
// Recibe prisma y el registro por parámetro para poder probarlo contra volare_test.
const { siguienteEstado } = require('./estadosPago')
const { dolaresACentavos } = require('./montos')
const { puedePagarReserva, puedeConfirmar, puedeAprobarReserva, respuestaCoincide, referenciaLegible } = require('./reglasPago')
const {
    validarPedidoPago, validarPedidoConfirmacion, validarPedidoTransferencia, validarDecisionManual,
    armarUrlRetorno, venceEnPagoReserva, pagoParaUsuario
} = require('./datosPago')
const { ejecutarConReintentos } = require('../reintentos')
const { esConflictoDeTransaccion } = require('../registro.helpers')
const { esConflictoDeUnicidad } = require('../reservas.helpers')

// Mismo cuerpo para "no existe" y "no es tuyo", como en los perfiles (RF-29).
const PAGO_NO_ENCONTRADO = Object.freeze({ status: 404, cuerpo: { error: 'Pago no encontrado' } })
const RESERVA_NO_ENCONTRADA = Object.freeze({ status: 404, cuerpo: { error: 'Reserva no encontrada' } })
const ESTADOS_ABIERTOS = ['PENDIENTE', 'VENCIDO']
const CODIGO_TRANSFERENCIA = 'TRANSFERENCIA_MANUAL'
const TRANSFERENCIA_EN_REVISION = 'Ya enviaste una transferencia para este alquiler. Espera la revisión de la administración.'

const esAdmin = (usuario) => usuario?.rol === 'ADMIN'
const puedeVer = (registroConDueno, usuario) => Boolean(registroConDueno) && (esAdmin(usuario) || registroConDueno.usuarioId === usuario?.id)
const error = (status, mensaje, codigo) => ({ status, cuerpo: codigo ? { error: mensaje, codigo } : { error: mensaje } })

// subirEvidencias(archivos, reserva) → urls. Se inyecta para que las pruebas no
// llamen a Cloudinary; el controlador pasa la versión real.
function crearServicioPagos({ prisma, registro, urlFrontend, ahora = () => new Date(), subirEvidencias }) {

    const enTransaccion = (operacion) => ejecutarConReintentos(
        () => prisma.$transaction(operacion, { isolationLevel: 'Serializable' }),
        { debeReintentar: esConflictoDeTransaccion }
    )

    // ---------- crearPago ----------

    function proveedorEnLinea(codigo) {
        const proveedor = registro.obtener(codigo)
        return proveedor?.capacidades.tipo === 'REDIRECCION' ? proveedor : null
    }

    function pagoPendienteReutilizable(pagos, concepto, codigo) {
        return pagos.find(pago => pago.concepto === concepto && pago.proveedor === codigo
            && pago.estado === 'PENDIENTE' && (!pago.venceEn || pago.venceEn > ahora()))
    }

    // La llamada al proveedor va fuera de cualquier transacción: es de red y
    // puede tardar; una transacción abierta tanto tiempo bloquearía la base.
    async function iniciarCobro(proveedor, pago, reserva) {
        const cobro = await proveedor.crearCobro({
            pagoId: pago.id,
            montoCentavos: pago.montoCentavos,
            referencia: referenciaLegible({ concepto: pago.concepto, espacio: reserva.espacio, fecha: reserva.fecha }),
            urlRetorno: armarUrlRetorno(urlFrontend, pago.id)
        })
        await prisma.pago.update({ where: { id: pago.id }, data: { idExterno: cobro.idExterno } })
        return { pagoId: pago.id, tipo: cobro.tipo, url: cobro.url }
    }

    async function crearPago(usuario, body) {
        const pedido = validarPedidoPago(body)
        if (pedido.error) return error(400, pedido.error)
        const { reservaId, concepto, proveedor: codigo } = pedido.datos

        const proveedor = proveedorEnLinea(codigo)
        if (!proveedor) return error(400, 'Ese proveedor de pago no está disponible')

        const reserva = await prisma.reserva.findUnique({ where: { id: reservaId }, include: { pagos: true } })
        if (!reserva || reserva.usuarioId !== usuario.id) return RESERVA_NO_ENCONTRADA

        const permiso = puedePagarReserva({ reserva, usuario, concepto, pagos: reserva.pagos, proveedor, ahora: ahora() })
        if (!permiso.permitido) return error(409, permiso.motivo)
        // Pagar en línea encima de una transferencia en revisión sería cobrar dos veces.
        if (transferenciaEnRevision(reserva.pagos, concepto)) return error(409, TRANSFERENCIA_EN_REVISION)

        const existente = pagoPendienteReutilizable(reserva.pagos, concepto, codigo)
        if (existente) return { status: 200, cuerpo: await iniciarCobro(proveedor, existente, reserva) }

        const pago = await prisma.pago.create({
            data: {
                usuarioId: usuario.id,
                tipo: 'RESERVA',
                concepto,
                reservaId,
                // El monto sale de la reserva guardada, nunca del navegador.
                montoCentavos: dolaresACentavos(reserva.montoAlquiler.toString()),
                proveedor: codigo,
                venceEn: venceEnPagoReserva(reserva, proveedor.capacidades)
            }
        })
        return { status: 201, cuerpo: await iniciarCobro(proveedor, pago, reserva) }
    }

    const transferenciaEnRevision = (pagos, concepto) =>
        pagos.some(pago => pago.concepto === concepto && pago.estado === 'PENDIENTE' && pago.proveedor === CODIGO_TRANSFERENCIA)

    // ---------- registrarTransferencia (Bloque E2 c) ----------

    async function subirSinFallar(archivos, reserva) {
        try {
            return { urls: await subirEvidencias(archivos, reserva) }
        } catch (falla) {
            console.error('Error al subir la evidencia de la transferencia:', falla)
            return { error: error(502, 'No se pudo subir el comprobante. Intenta de nuevo.') }
        }
    }

    async function registrarTransferencia(usuario, body, archivos) {
        const pedido = validarPedidoTransferencia(body, archivos)
        if (pedido.error) return error(400, pedido.error)
        const { reservaId, concepto } = pedido.datos
        const proveedor = registro.obtener(CODIGO_TRANSFERENCIA)

        const reserva = await prisma.reserva.findUnique({ where: { id: reservaId }, include: { pagos: true } })
        if (!reserva || reserva.usuarioId !== usuario.id) return RESERVA_NO_ENCONTRADA

        const permiso = puedePagarReserva({ reserva, usuario, concepto, pagos: reserva.pagos, proveedor, ahora: ahora() })
        if (!permiso.permitido) return error(409, permiso.motivo)
        if (transferenciaEnRevision(reserva.pagos, concepto)) return error(409, TRANSFERENCIA_EN_REVISION)

        // Los archivos se suben antes de crear el pago: si la subida falla, no queda
        // un pago sin evidencia que el admin no podría revisar.
        const subida = await subirSinFallar(pedido.datos.archivos, reserva)
        if (subida.error) return subida.error

        const pago = await prisma.pago.create({
            data: {
                usuarioId: usuario.id,
                tipo: 'RESERVA',
                concepto,
                reservaId,
                montoCentavos: dolaresACentavos(reserva.montoAlquiler.toString()),
                proveedor: CODIGO_TRANSFERENCIA,
                evidenciaUrls: subida.urls,
                venceEn: venceEnPagoReserva(reserva, proveedor.capacidades)
            }
        })
        const cobro = await proveedor.crearCobro({
            pagoId: pago.id,
            montoCentavos: pago.montoCentavos,
            referencia: referenciaLegible({ concepto, espacio: reserva.espacio, fecha: reserva.fecha }),
            urlRetorno: armarUrlRetorno(urlFrontend, pago.id)
        })
        const guardado = await prisma.pago.update({ where: { id: pago.id }, data: { idExterno: cobro.idExterno } })
        return { status: 201, cuerpo: { pago: pagoParaUsuario(guardado, usuario) } }
    }

    // ---------- confirmarPago ----------

    // Lo pagado sigue disponible si la reserva sigue pendiente y nadie más pagó
    // ya ese concepto. Si no, el cobro queda DUPLICADO y se devuelve el dinero.
    async function referenciaDisponible(tx, pago) {
        const reserva = await tx.reserva.findUnique({ where: { id: pago.reservaId }, select: { estado: true } })
        if (reserva?.estado !== 'PENDIENTE') return false
        const otroAprobado = await tx.pago.findFirst({
            where: { reservaId: pago.reservaId, concepto: pago.concepto, estado: 'APROBADO', NOT: { id: pago.id } },
            select: { id: true }
        })
        return !otroAprobado
    }

    // Solo cambia el pago si sigue en el estado que se leyó: si otra petición
    // lo resolvió antes, count es 0 y se devuelve lo que quedó, sin repetir nada.
    async function cambiarEstado(tx, pago, estado, respuesta) {
        await tx.pago.updateMany({
            where: { id: pago.id, estado: pago.estado },
            data: { estado, resueltoEn: ahora(), respuestaProveedor: respuesta }
        })
        return tx.pago.findUnique({ where: { id: pago.id } })
    }

    function aplicarResultado(pagoId, respuesta) {
        return enTransaccion(async (tx) => {
            const actual = await tx.pago.findUnique({ where: { id: pagoId } })
            if (!ESTADOS_ABIERTOS.includes(actual.estado)) return actual
            const contexto = respuesta.estado === 'APROBADO'
                ? { referenciaDisponible: await referenciaDisponible(tx, actual) }
                : undefined
            const { estado, cambia } = siguienteEstado(actual.estado, respuesta.estado, contexto)
            return cambia ? cambiarEstado(tx, actual, estado, respuesta) : actual
        })
    }

    // Respaldo de la base: si dos pagos del mismo concepto se aprueban a la vez,
    // el índice parcial rechaza al segundo (P2002) y ese queda DUPLICADO.
    function marcarDuplicado(pagoId, respuesta) {
        return enTransaccion(async (tx) => {
            const actual = await tx.pago.findUnique({ where: { id: pagoId } })
            if (!ESTADOS_ABIERTOS.includes(actual.estado)) return actual
            const { estado } = siguienteEstado(actual.estado, 'APROBADO', { referenciaDisponible: false })
            return cambiarEstado(tx, actual, estado, respuesta)
        })
    }

    async function intentarReverso(proveedor, pago) {
        if (pago.estado !== 'DUPLICADO' || !proveedor.capacidades.soportaReversoMismoDia) return pago
        const reverso = await proveedor.revertir(pago.idExterno)
        if (reverso.estado !== 'REVERSADO') return pago
        const { estado } = siguienteEstado(pago.estado, 'REVERSADO')
        return enTransaccion((tx) => cambiarEstado(tx, pago, estado, { confirmacion: pago.respuestaProveedor, reverso }))
    }

    async function confirmarPago(usuario, pagoId, body) {
        const pedido = validarPedidoConfirmacion(body)
        if (pedido.error) return error(400, pedido.error)

        const pago = await prisma.pago.findUnique({ where: { id: pagoId } })
        if (!puedeVer(pago, usuario)) return PAGO_NO_ENCONTRADO

        const proveedor = registro.obtener(pago.proveedor)
        if (!proveedor) return error(409, 'El proveedor de este pago no está disponible')
        if (!puedeConfirmar({ pago, usuario, proveedor })) return error(403, 'No puedes confirmar este pago')

        const vista = (p) => ({ status: 200, cuerpo: { pago: pagoParaUsuario(p, usuario) } })
        // Idempotencia: un pago ya resuelto no vuelve a consultar al proveedor.
        if (!ESTADOS_ABIERTOS.includes(pago.estado)) return vista(pago)

        const respuesta = await proveedor.confirmarCobro({ idExterno: pago.idExterno, resultado: pedido.datos.resultado })
        if (respuesta.estado === 'PENDIENTE') return vista(pago)
        if (!respuestaCoincide(pago, respuesta)) {
            return error(409, 'La respuesta del proveedor no coincide con el pago. Queda para revisión.', 'RESPUESTA_NO_COINCIDE')
        }

        let resultado
        try {
            resultado = await aplicarResultado(pago.id, respuesta)
        } catch (falla) {
            if (!esConflictoDeUnicidad(falla)) throw falla
            resultado = await marcarDuplicado(pago.id, respuesta)
        }
        return vista(await intentarReverso(proveedor, resultado))
    }

    // ---------- decidirPagoManual (Bloque E2 c) ----------

    // Error para deshacer toda la transacción cuando la reserva no se puede aprobar.
    function noSePuedeAprobar(mensaje) {
        const falla = new Error(mensaje)
        falla.codigo = 'RESERVA_NO_APROBABLE'
        return falla
    }

    async function aprobarReservaEn(tx, reservaId) {
        const reserva = await tx.reserva.findUnique({ where: { id: reservaId }, include: { pagos: true } })
        const permiso = puedeAprobarReserva({ reserva, pagos: reserva.pagos, esEnLinea: registro.esPagoEnLinea })
        if (!permiso.permitido) throw noSePuedeAprobar(permiso.motivo)
        const { count } = await tx.reserva.updateMany({
            where: { id: reservaId, estado: 'PENDIENTE' },
            data: { estado: 'APROBADA', motivoRechazo: null, notificacionPendiente: true }
        })
        if (count === 0) throw noSePuedeAprobar('La reserva ya no está pendiente. No se guardó ningún cambio.')
    }

    // Decisión 1: pago y reserva en UNA transacción. Si la reserva no se puede
    // aprobar, se lanza un error y el pago tampoco cambia.
    function aplicarDecision(pagoId, respuesta, { decididoPorId, aprobarReserva }) {
        return enTransaccion(async (tx) => {
            const actual = await tx.pago.findUnique({ where: { id: pagoId } })
            if (actual.estado !== 'PENDIENTE') return actual
            const contexto = respuesta.estado === 'APROBADO'
                ? { referenciaDisponible: await referenciaDisponible(tx, actual) }
                : undefined
            const { estado } = siguienteEstado(actual.estado, respuesta.estado, contexto)
            await tx.pago.updateMany({
                where: { id: actual.id, estado: actual.estado },
                data: {
                    estado,
                    resueltoEn: ahora(),
                    respuestaProveedor: respuesta,
                    decididoPorId,
                    motivoRechazo: estado === 'RECHAZADO' ? respuesta.detalle.motivo : null
                }
            })
            if (aprobarReserva) {
                if (estado !== 'APROBADO') {
                    throw noSePuedeAprobar('El alquiler ya estaba cubierto o la reserva no está pendiente. No se guardó ningún cambio.')
                }
                await aprobarReservaEn(tx, actual.reservaId)
            }
            return tx.pago.findUnique({ where: { id: actual.id } })
        })
    }

    async function decidirPagoManual(usuario, pagoId, body) {
        const pedido = validarDecisionManual(body)
        if (pedido.error) return error(400, pedido.error)

        const pago = await prisma.pago.findUnique({ where: { id: pagoId } })
        if (!puedeVer(pago, usuario)) return PAGO_NO_ENCONTRADO
        const proveedor = registro.obtener(pago.proveedor)
        if (proveedor?.capacidades.tipo !== 'MANUAL') return error(409, 'Este pago no es una transferencia')
        if (!puedeConfirmar({ pago, usuario, proveedor })) return error(403, 'Solo la administración decide las transferencias')

        const vista = (p) => ({ status: 200, cuerpo: { pago: pagoParaUsuario(p, usuario) } })
        // Idempotencia: una transferencia ya decidida no se vuelve a decidir.
        if (pago.estado !== 'PENDIENTE') return vista(pago)

        const { decision, motivo, aprobarReserva } = pedido.datos
        const respuesta = await proveedor.confirmarCobro({ idExterno: pago.idExterno, montoCentavos: pago.montoCentavos, decision, motivo })
        try {
            return vista(await aplicarDecision(pago.id, respuesta, { decididoPorId: usuario.id, aprobarReserva }))
        } catch (falla) {
            if (falla.codigo === 'RESERVA_NO_APROBABLE') return error(409, falla.message)
            if (!esConflictoDeUnicidad(falla)) throw falla
            return vista(await marcarDuplicado(pago.id, respuesta))
        }
    }

    // ---------- lectura ----------

    async function obtenerPago(usuario, pagoId) {
        const pago = await prisma.pago.findUnique({ where: { id: pagoId } })
        if (!puedeVer(pago, usuario)) return PAGO_NO_ENCONTRADO
        return { status: 200, cuerpo: { pago: pagoParaUsuario(pago, usuario) } }
    }

    async function listarPagosDeReserva(usuario, reservaId) {
        if (typeof reservaId !== 'string' || !reservaId) return error(400, 'Falta reservaId')
        const reserva = await prisma.reserva.findUnique({ where: { id: reservaId }, select: { usuarioId: true } })
        if (!puedeVer(reserva, usuario)) return RESERVA_NO_ENCONTRADA
        const pagos = await prisma.pago.findMany({ where: { reservaId }, orderBy: [{ creadoEn: 'desc' }, { id: 'desc' }] })
        return { status: 200, cuerpo: { pagos: pagos.map(p => pagoParaUsuario(p, usuario)) } }
    }

    return { crearPago, confirmarPago, registrarTransferencia, decidirPagoManual, obtenerPago, listarPagosDeReserva }
}

module.exports = { crearServicioPagos }
