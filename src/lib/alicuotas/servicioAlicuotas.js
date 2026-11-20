// Servicio de alícuotas. Igual que el de pagos: devuelve { status, cuerpo } y no
// conoce HTTP. El cobro lo hace el MISMO núcleo de pagos (proveedor en línea o
// transferencia), por eso aquí solo se decide QUÉ se cobra y A QUIÉN.
const { CONFIG_INICIAL, periodoDe, validarPeriodo, calcularMontoCuota, validarConfig } = require('./reglas')
const { puedePagarCuota, normalizarVilla, referenciaLegible } = require('../pagos/reglasPago')
const { armarUrlRetorno, pagoParaUsuario } = require('../pagos/datosPago')
const { evidenciaValida } = require('./evidencia')

const CODIGO_TRANSFERENCIA = 'TRANSFERENCIA_MANUAL'
const CUOTAS_POR_PAGINA = 200
const MESES_HISTORIAL = 24
const error = (status, mensaje) => ({ status, cuerpo: { error: mensaje } })
const CUOTA_NO_ENCONTRADA = Object.freeze(error(404, 'Cuota no encontrada'))

function crearServicioAlicuotas({ prisma, registro, urlFrontend, ahora = () => new Date(), subirEvidencias }) {

    // ---------- configuración ----------

    async function leerConfig(cliente = prisma) {
        const fila = await cliente.configAlicuota.findUnique({ where: { id: 1 } })
        return fila ?? cliente.configAlicuota.create({ data: { id: 1, ...CONFIG_INICIAL } })
    }

    const vistaConfig = (c) => ({
        montoCentavos: c.montoCentavos,
        montoPuntualCentavos: c.montoPuntualCentavos,
        diasPuntual: c.diasPuntual,
        actualizadoEn: c.actualizadoEn
    })

    async function obtenerConfig() {
        return { status: 200, cuerpo: { config: vistaConfig(await leerConfig()) } }
    }

    async function actualizarConfig(admin, body) {
        const pedido = validarConfig(body)
        if (pedido.error) return error(400, pedido.error)
        await leerConfig()
        const config = await prisma.configAlicuota.update({
            where: { id: 1 },
            data: { ...pedido.datos, actualizadoPorId: admin.id }
        })
        return { status: 200, cuerpo: { config: vistaConfig(config) } }
    }

    // ---------- cuotas ----------

    // Villas con al menos un residente aprobado y activo (manzana y villa son
    // texto libre en User, por eso se normalizan antes de comparar).
    async function villasConResidentes() {
        const residentes = await prisma.user.findMany({
            where: { rol: 'RESIDENTE', activo: true, estadoCuenta: 'APROBADA', manzana: { not: null }, villa: { not: null } },
            select: { manzana: true, villa: true }
        })
        const unicas = new Map()
        for (const r of residentes) {
            const manzana = normalizarVilla(r.manzana)
            const villa = normalizarVilla(r.villa)
            if (manzana && villa) unicas.set(`${manzana}|${villa}`, { manzana, villa })
        }
        return [...unicas.values()]
    }

    // createMany con skipDuplicates: repetir la generación no duplica ni cambia lo ya creado.
    async function crearCuotas(villas, periodo) {
        if (villas.length === 0) return 0
        const config = await leerConfig()
        const { count } = await prisma.cuotaAlicuota.createMany({
            data: villas.map(v => ({
                manzana: v.manzana, villa: v.villa, periodo,
                montoBaseCentavos: config.montoCentavos,
                montoPuntualCentavos: config.montoPuntualCentavos,
                diasPuntual: config.diasPuntual
            })),
            skipDuplicates: true
        })
        return count
    }

    async function generarCuotas(body) {
        const periodo = body?.periodo ?? periodoDe(ahora())
        if (!validarPeriodo(periodo)) return error(400, 'El periodo debe tener el formato AAAA-MM, por ejemplo 2026-12')
        const villas = await villasConResidentes()
        const creadas = await crearCuotas(villas, periodo)
        return { status: 200, cuerpo: { periodo, villas: villas.length, creadas, yaExistian: villas.length - creadas } }
    }

    async function listarCuotas(query = {}) {
        const where = {}
        if (query.periodo !== undefined) {
            if (!validarPeriodo(query.periodo)) return error(400, 'El periodo debe tener el formato AAAA-MM')
            where.periodo = query.periodo
        }
        if (query.estado !== undefined) {
            if (!['PENDIENTE', 'PAGADA', 'ANULADA'].includes(query.estado)) return error(400, 'Estado no válido')
            where.estado = query.estado
        }
        const cuotas = await prisma.cuotaAlicuota.findMany({
            where,
            orderBy: [{ periodo: 'desc' }, { manzana: 'asc' }, { villa: 'asc' }],
            take: CUOTAS_POR_PAGINA,
            include: { pagos: { orderBy: { creadoEn: 'desc' } } }
        })
        const momento = ahora()
        return { status: 200, cuerpo: { cuotas: cuotas.map(c => decorarCuota(c, momento, { admin: true })) } }
    }

    async function anularCuota(cuotaId) {
        const cuota = await prisma.cuotaAlicuota.findUnique({ where: { id: cuotaId }, include: { pagos: true } })
        if (!cuota) return CUOTA_NO_ENCONTRADA
        if (cuota.estado !== 'PENDIENTE') return error(409, 'Solo se puede anular una cuota pendiente')
        if (cuota.pagos.some(p => p.estado === 'PENDIENTE' && p.proveedor === CODIGO_TRANSFERENCIA)) {
            return error(409, 'Hay una transferencia en revisión: decídela antes de anular la cuota')
        }
        const { count } = await prisma.cuotaAlicuota.updateMany({ where: { id: cuotaId, estado: 'PENDIENTE' }, data: { estado: 'ANULADA' } })
        if (count === 0) return error(409, 'La cuota ya cambió de estado')
        return { status: 200, cuerpo: { ok: true } }
    }

    // ---------- lo que ve el residente ----------

    const transferenciaEnRevision = (pagos) => pagos.some(p => p.estado === 'PENDIENTE' && p.proveedor === CODIGO_TRANSFERENCIA)

    function decorarCuota(cuota, momento, { admin = false } = {}) {
        const { pagos = [], ...datos } = cuota
        const salida = { ...datos }
        if (cuota.estado === 'PENDIENTE') {
            const cobro = calcularMontoCuota({ cuota, fechaPago: momento })
            salida.pagarHoyCentavos = cobro.montoCentavos
            salida.aplicaDescuento = cobro.aplicaDescuento
            salida.descuentoHasta = cobro.descuentoHasta
            salida.transferenciaEnRevision = transferenciaEnRevision(pagos)
        }
        const visibles = pagos.map(p => pagoParaUsuario(p, { rol: admin ? 'ADMIN' : 'RESIDENTE' }))
        if (admin) {
            salida.pagos = visibles.filter(p => p.estado === 'PENDIENTE' && p.proveedor === CODIGO_TRANSFERENCIA)
            const aprobado = visibles.find(p => p.estado === 'APROBADO')
            if (aprobado) salida.pagado = { montoCentavos: aprobado.montoCentavos, proveedor: aprobado.proveedor, resueltoEn: aprobado.resueltoEn }
        } else {
            const aprobado = visibles.find(p => p.estado === 'APROBADO')
            if (aprobado) salida.pagado = { montoCentavos: aprobado.montoCentavos, proveedor: aprobado.proveedor, resueltoEn: aprobado.resueltoEn }
            const rechazado = visibles.find(p => p.estado === 'RECHAZADO')
            if (cuota.estado === 'PENDIENTE' && rechazado && !transferenciaEnRevision(pagos)) {
                salida.ultimoRechazo = rechazado.motivoRechazo ?? null
            }
        }
        return salida
    }

    async function misCuotas(usuarioId) {
        const usuario = await prisma.user.findUnique({ where: { id: usuarioId }, select: { manzana: true, villa: true } })
        const manzana = normalizarVilla(usuario?.manzana)
        const villa = normalizarVilla(usuario?.villa)
        if (!manzana || !villa) {
            return error(409, 'Tu perfil no tiene manzana y villa. Complétalos en Mi perfil para ver tus alícuotas.')
        }
        // Se crea la cuota del mes en el primer acceso: no depende de que alguien la genere.
        await crearCuotas([{ manzana, villa }], periodoDe(ahora()))
        const cuotas = await prisma.cuotaAlicuota.findMany({
            where: { manzana, villa },
            orderBy: { periodo: 'desc' },
            take: MESES_HISTORIAL,
            include: { pagos: { orderBy: { creadoEn: 'desc' } } }
        })
        const config = await leerConfig()
        const momento = ahora()
        return {
            status: 200,
            cuerpo: { villa: { manzana, villa }, config: vistaConfig(config), cuotas: cuotas.map(c => decorarCuota(c, momento)) }
        }
    }

    // ---------- pagar ----------

    async function cargarCuotaPagable(usuario, cuotaId) {
        if (typeof cuotaId !== 'string' || !cuotaId) return { respuesta: error(400, 'Falta la cuota a pagar') }
        const [cuota, perfil] = await Promise.all([
            prisma.cuotaAlicuota.findUnique({ where: { id: cuotaId }, include: { pagos: true } }),
            prisma.user.findUnique({ where: { id: usuario.id }, select: { activo: true, estadoCuenta: true, manzana: true, villa: true } })
        ])
        if (!cuota) return { respuesta: CUOTA_NO_ENCONTRADA }
        const permiso = puedePagarCuota({ cuota, usuario: perfil })
        // "No es de tu villa" se responde igual que "no existe": no revela cuotas ajenas.
        if (!permiso.permitido) {
            return { respuesta: permiso.motivo === 'La cuota no es de tu villa' ? CUOTA_NO_ENCONTRADA : error(409, permiso.motivo) }
        }
        return { cuota }
    }

    function datosPago(usuario, cuota, proveedor, extra = {}) {
        const cobro = calcularMontoCuota({ cuota, fechaPago: ahora() })
        return {
            usuarioId: usuario.id,
            tipo: 'ALICUOTA',
            concepto: 'ALICUOTA',
            cuotaId: cuota.id,
            // El monto lo calcula el servidor con la fecha de hoy: nunca viene del navegador.
            montoCentavos: cobro.montoCentavos,
            proveedor,
            ...extra
        }
    }

    const referencia = (cuota) => referenciaLegible({ concepto: 'ALICUOTA', periodo: cuota.periodo, manzana: cuota.manzana, villa: cuota.villa })

    async function pagarEnLinea(usuario, body) {
        const codigo = body?.proveedor
        const proveedor = typeof codigo === 'string' ? registro.obtener(codigo) : null
        if (proveedor?.capacidades.tipo !== 'REDIRECCION') return error(400, 'Ese proveedor de pago no está disponible')

        const { cuota, respuesta } = await cargarCuotaPagable(usuario, body?.cuotaId)
        if (respuesta) return respuesta
        if (transferenciaEnRevision(cuota.pagos)) {
            return error(409, 'Ya enviaste una transferencia para esta cuota. Espera la revisión de la administración.')
        }

        const monto = calcularMontoCuota({ cuota, fechaPago: ahora() }).montoCentavos
        // Un intento anterior con otro monto (por ejemplo, de antes del día 6) ya no sirve.
        await prisma.pago.updateMany({
            where: { cuotaId: cuota.id, estado: 'PENDIENTE', proveedor: codigo, NOT: { montoCentavos: monto } },
            data: { estado: 'VENCIDO' }
        })
        const vigencia = proveedor.capacidades.vigenciaMinutos
        const venceEn = vigencia == null ? null : new Date(ahora().getTime() + vigencia * 60000)
        const pago = await prisma.pago.create({ data: datosPago(usuario, cuota, codigo, { venceEn }) })

        const cobro = await proveedor.crearCobro({
            pagoId: pago.id,
            montoCentavos: pago.montoCentavos,
            referencia: referencia(cuota),
            urlRetorno: armarUrlRetorno(urlFrontend, pago.id)
        })
        await prisma.pago.update({ where: { id: pago.id }, data: { idExterno: cobro.idExterno } })
        return { status: 201, cuerpo: { pagoId: pago.id, tipo: cobro.tipo, url: cobro.url } }
    }

    async function pagarPorTransferencia(usuario, body, archivos) {
        const lista = archivos ?? []
        const falloEvidencia = evidenciaValida(lista)
        if (falloEvidencia) return error(400, falloEvidencia)

        const { cuota, respuesta } = await cargarCuotaPagable(usuario, body?.cuotaId)
        if (respuesta) return respuesta
        if (transferenciaEnRevision(cuota.pagos)) {
            return error(409, 'Ya enviaste una transferencia para esta cuota. Espera la revisión de la administración.')
        }

        // Primero la subida: si falla no queda un pago sin comprobante.
        let urls
        try {
            urls = await subirEvidencias(lista, cuota)
        } catch (falla) {
            console.error('Error al subir la evidencia de la alícuota:', falla)
            return error(502, 'No se pudo subir el comprobante. Intenta de nuevo.')
        }

        const proveedor = registro.obtener(CODIGO_TRANSFERENCIA)
        const pago = await prisma.pago.create({ data: datosPago(usuario, cuota, CODIGO_TRANSFERENCIA, { evidenciaUrls: urls }) })
        const cobro = await proveedor.crearCobro({
            pagoId: pago.id,
            montoCentavos: pago.montoCentavos,
            referencia: referencia(cuota),
            urlRetorno: armarUrlRetorno(urlFrontend, pago.id)
        })
        const guardado = await prisma.pago.update({ where: { id: pago.id }, data: { idExterno: cobro.idExterno } })
        return { status: 201, cuerpo: { pago: pagoParaUsuario(guardado, usuario) } }
    }

    return {
        obtenerConfig, actualizarConfig, generarCuotas, listarCuotas, anularCuota, misCuotas, pagarEnLinea, pagarPorTransferencia
    }
}

module.exports = { crearServicioAlicuotas }
