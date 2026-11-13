const prisma = require('../lib/prisma');
const bcryptjs = require('bcryptjs');
const { obtenerParametrosPaginacion } = require('../lib/paginacion');
const { ejecutarConReintentos } = require('../lib/reintentos');
const { buscarResidentesQueOcupanCupo } = require('../lib/residentes');
const { construirFiltroUsuarios } = require('../lib/listadoUsuarios');
const { filtroResidentesVisibles, puedeVerPerfil } = require('../lib/visibilidadUsuarios');
const { FILTRO_SOLICITUDES_PENDIENTES } = require('../lib/resumenAdmin');
const {
    contarCuentasEnCasa,
    agregarCuentasEnCasa,
    validarDecision,
    validarMotivoRechazo,
    cambiosAlAprobar,
    cambiosAlRechazar,
    esConflictoDeTransaccion
} = require('../lib/registro.helpers');

const CAMPOS_SOLICITUD = {
    id: true,
    nombres: true,
    apellidos: true,
    cedula: true,
    celular: true,
    email: true,
    rol: true,
    manzana: true,
    villa: true,
    estadoCuenta: true,
    fechaDecision: true,
    motivoRechazo: true,
    creadoEn: true
};

const NO_ENCONTRADO = { status: 404, codigo: 'USUARIO_NO_ENCONTRADO', mensaje: 'Usuario no encontrado' };
const YA_DECIDIDA_POR_OTRO = { status: 409, codigo: 'YA_DECIDIDA', mensaje: 'Otro administrador ya decidió esta solicitud. Actualiza la lista.' };

const responderError = (res, { status, codigo, mensaje }) => res.status(status).json({ codigo, mensaje });

const PERFIL_NO_ENCONTRADO = { error: 'Usuario no encontrado' };

const obtenerPerfilPublico = async (req, res) => {
    try {
        // Primero se decide si se puede ver y solo después se suma la visita:
        // un perfil oculto responde igual que uno inexistente y no deja rastro.
        const perfil = await prisma.user.findUnique({
            where: { id: req.params.id },
            select: { id: true, activo: true, estadoCuenta: true }
        });
        if (!puedeVerPerfil(perfil, req.user)) {
            return res.status(404).json(PERFIL_NO_ENCONTRADO);
        }

        const user = await prisma.user.update({
            where:{
                id: req.params.id

            },
            data: {
                visitasPerfil: { increment: 1 }
            },
            select: {
                id: true,
                nombres: true,
                apellidos: true,
                rol: true,
                bio: true,
                foto: true,
                creadoEn: true,
                visitasPerfil: true
            }
        });
        const posts = await prisma.post.findMany({
            where: {
                autorId: req.params.id
            },
            orderBy: [{ ancladoPerfil: 'desc' }, { creadoEn: 'desc' }],
            include: {
                autor: {
                    select: { nombres: true, apellidos: true, foto: true }
                }
            }
        });
        return res.status(200).json({ mensaje: 'Perfil obtenido exitosamente', user: user, posts: posts });
    }
    catch (error) {
        if (error.code === 'P2025') {
            return res.status(404).json(PERFIL_NO_ENCONTRADO);
        }
        console.error('Error al obtener el perfil público:', error);
        res.status(500).json({ error: 'Error al obtener el perfil público' });
    }
}

const buscarUsuarios = async (req, res) => {
    try {
        const q = (req.query.q || '').trim();

        if (q.length < 2) {
            return res.status(200).json({ usuarios: [] });
        }

        const usuarios = await prisma.user.findMany({
            where: {
                ...filtroResidentesVisibles(req.user),
                OR: [
                    { nombres: { contains: q, mode: 'insensitive' } },
                    { apellidos: { contains: q, mode: 'insensitive' } },
                    { nombre: { contains: q, mode: 'insensitive' } }
                ]
            },
            take: 8,
            orderBy: { nombres: 'asc' },
            select: {
                id: true,
                nombres: true,
                apellidos: true,
                foto: true,
                // Para que el admin vea la etiqueta de estado; un residente
                // solo recibe cuentas aprobadas y activas.
                activo: true,
                estadoCuenta: true
            }
        });

        return res.status(200).json({ usuarios });
    } catch (error) {
        console.error('Error al buscar usuarios:', error);
        return res.status(500).json({ mensaje: 'Error interno del servidor' });
    }
}

const listarUsuarios = async (req, res) => {
    try {
        const { skip, take, pagina } = obtenerParametrosPaginacion(req.query);
        const where = construirFiltroUsuarios(req.query);

        const [usuarios, total] = await Promise.all([
            prisma.user.findMany({
                where,
                orderBy: { creadoEn: 'desc' },
                skip,
                take,
                select: {
                    id: true,
                    nombres: true,
                    apellidos: true,
                    cedula: true,
                    celular: true,
                    email: true,
                    rol: true,
                    activo: true,
                    manzana: true,
                    villa: true,
                    bio: true,
                    foto: true,
                    creadoEn: true,
                    // Para la columna "Cuenta" y para mostrar el motivo al reconsiderar una rechazada.
                    estadoCuenta: true,
                    motivoRechazo: true
                }
            }),
            prisma.user.count({ where })
        ]);

        const totalPaginas = Math.max(1, Math.ceil(total / take));
        return res.status(200).json({ mensaje: 'Usuarios listados exitosamente', usuarios, totalPaginas, paginaActual: pagina });
    } catch (error) {
        console.error('Error al listar usuarios:', error);
        return res.status(500).json({ mensaje: 'Error interno del servidor' });
    }
}

const cambiarEstadoUsuario = async (req, res) => {
    const { id } = req.params;
    const { activo } = req.body;
    
    try {
        const usuario = await prisma.user.update({
            where: {
                id: id
            },
            data: {
                activo: activo
            },
            select: {
                id: true,
                nombres: true,
                apellidos: true,
                cedula: true,
                celular: true,
                email: true,
                rol: true,
                activo: true,
                manzana: true,
                villa: true,
                bio: true,
                foto: true,
                creadoEn: true
            }
        })
        
        res.status(200).json({ mensaje: 'Estado del usuario actualizado exitosamente', usuario })
    }
    catch (error) {
        console.error('Error al cambiar estado:', error)
        res.status(500).json({ error: 'Error al cambiar estado del usuario' })
    }
}

const crearAdmin = async (req, res) => {
    const { nombres, apellidos, email, password, manzana, villa } = req.body;

    try {
        if (!nombres || !apellidos || !email || !password) {
            return res.status(400).json({ mensaje: 'Todos los campos son obligatorios' })
        }

        const usuarioExistente = await prisma.user.findUnique({
            where: {
                email: email
            }
        });

        if (usuarioExistente){
            return res.status(400).json({ mensaje: 'El email ya está registrado' });
        }

        const hash = await bcryptjs.hash(password, 10);

        const resultado = await prisma.user.create({
            data: {
                nombre: `${nombres} ${apellidos}`.trim(),
                nombres: nombres,
                apellidos: apellidos,
                manzana: manzana,
                villa: villa,
                email: email,
                password: hash,
                rol: 'ADMIN',
                // Un admin creado por otro admin ya está verificado; sin esto
                // nacería PENDIENTE (el default de los registros nuevos).
                estadoCuenta: 'APROBADA',
                decididoPorId: req.user.id,
                fechaDecision: new Date()
            },
            select: {
                id: true,
                nombres: true,
                apellidos: true,
                email: true,
                rol: true,
                activo: true,
                manzana: true,
                villa: true,
                bio: true,
                foto: true,
                creadoEn: true
            }
        });

        return res.status(201).json({ mensaje: 'Usuario registrado exitosamente', user: resultado });

    } catch (error) {
        console.error('Error al registrar usuario:', error);
        return res.status(500).json({ mensaje: 'Error interno del servidor' });
    }
}

// Las más antiguas primero: quien lleva más tiempo esperando se atiende antes.
const listarPendientes = async (req, res) => {
    try {
        const { skip, take, pagina } = obtenerParametrosPaginacion(req.query);
        const where = FILTRO_SOLICITUDES_PENDIENTES;

        const [pendientes, total, residentes] = await Promise.all([
            prisma.user.findMany({ where, orderBy: [{ creadoEn: 'asc' }, { id: 'asc' }], skip, take, select: CAMPOS_SOLICITUD }),
            prisma.user.count({ where }),
            buscarResidentesQueOcupanCupo(prisma)
        ]);

        const totalPaginas = Math.max(1, Math.ceil(total / take));
        return res.status(200).json({ usuarios: agregarCuentasEnCasa(pendientes, residentes), total, totalPaginas, paginaActual: pagina });
    } catch (error) {
        console.error('Error al listar solicitudes pendientes:', error);
        return res.status(500).json({ mensaje: 'Error al listar las solicitudes pendientes' });
    }
}

// Va en transacción Serializable porque aprobar una RECHAZADA vuelve a ocupar
// cupo y podría chocar con un registro simultáneo en la misma casa.
async function aprobarEnTransaccion(tx, id, adminId) {
    const usuario = await tx.user.findUnique({ where: { id }, select: { rol: true, estadoCuenta: true, manzana: true, villa: true } });
    if (!usuario) return { error: NO_ENCONTRADO };

    const residentes = await buscarResidentesQueOcupanCupo(tx);
    const error = validarDecision(usuario, 'aprobar', contarCuentasEnCasa(residentes, usuario.manzana, usuario.villa));
    if (error) return { error };

    // La condición sobre el estado leído evita pisar la decisión de otro admin.
    const { count } = await tx.user.updateMany({
        where: { id, estadoCuenta: usuario.estadoCuenta },
        data: cambiosAlAprobar(adminId, new Date())
    });
    return count === 0 ? { error: YA_DECIDIDA_POR_OTRO } : {};
}

const aprobarCuenta = async (req, res) => {
    try {
        const resultado = await ejecutarConReintentos(
            () => prisma.$transaction(tx => aprobarEnTransaccion(tx, req.params.id, req.user.id), { isolationLevel: 'Serializable' }),
            { debeReintentar: esConflictoDeTransaccion }
        );
        if (resultado.error) return responderError(res, resultado.error);

        const usuario = await prisma.user.findUnique({ where: { id: req.params.id }, select: CAMPOS_SOLICITUD });
        return res.status(200).json({ mensaje: 'Cuenta aprobada', usuario });
    } catch (error) {
        if (esConflictoDeTransaccion(error)) {
            return res.status(409).json({ codigo: 'REINTENTAR', mensaje: 'Hubo varias operaciones al mismo tiempo. Intenta de nuevo.' });
        }
        console.error('Error al aprobar cuenta:', error);
        return res.status(500).json({ mensaje: 'Error al aprobar la cuenta' });
    }
}

const rechazarCuenta = async (req, res) => {
    const errorMotivo = validarMotivoRechazo(req.body?.motivo);
    if (errorMotivo) {
        return res.status(400).json({ codigo: 'MOTIVO_INVALIDO', mensaje: errorMotivo });
    }

    try {
        const usuario = await prisma.user.findUnique({ where: { id: req.params.id }, select: { estadoCuenta: true } });
        if (!usuario) return responderError(res, NO_ENCONTRADO);

        const error = validarDecision(usuario, 'rechazar', 0);
        if (error) return responderError(res, error);

        const { count } = await prisma.user.updateMany({
            where: { id: req.params.id, estadoCuenta: 'PENDIENTE' },
            data: cambiosAlRechazar(req.user.id, req.body.motivo, new Date())
        });
        if (count === 0) return responderError(res, YA_DECIDIDA_POR_OTRO);

        const actualizado = await prisma.user.findUnique({ where: { id: req.params.id }, select: CAMPOS_SOLICITUD });
        return res.status(200).json({ mensaje: 'Solicitud rechazada', usuario: actualizado });
    } catch (error) {
        console.error('Error al rechazar cuenta:', error);
        return res.status(500).json({ mensaje: 'Error al rechazar la cuenta' });
    }
}

module.exports = {
    listarPendientes,
    aprobarCuenta,
    rechazarCuenta,
    obtenerPerfilPublico,
    buscarUsuarios,
    listarUsuarios,
    cambiarEstadoUsuario,
    crearAdmin
}
