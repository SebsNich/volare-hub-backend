const prisma = require('../lib/prisma');
const { subirArchivo, eliminarArchivo } = require('../lib/cloudinary');
const {
    CABANAS,
    esCabana,
    obtenerCarpetaReserva,
    obtenerRangoMes,
    validarDisponibilidadHorario,
    calcularMontos
} = require('../lib/reservas.helpers');

const ESPACIOS_VALIDOS = ['CABANA_ARBOL', 'CABANA_MEDIO', 'CABANA_RIO', 'CASA_CLUB'];
const TIPOS_CUENTA_VALIDOS = ['AHORROS', 'CORRIENTE'];
const ESTADOS_OCUPA_SLOT = ['PENDIENTE', 'APROBADA'];

function tipoRecursoCloudinary(mimetype) {
    return mimetype === 'application/pdf' ? 'raw' : 'image';
}

function tipoRecursoDesdeUrl(url) {
    return url && url.includes('/raw/upload/') ? 'raw' : 'image';
}

function datosTercero(espacio, esParaTerceroBool, terceroNombre, terceroCedula, terceroCorreo, terceroCelular) {
    if (!esParaTerceroBool || espacio !== 'CASA_CLUB') {
        return { valido: true, datos: { terceroNombre: null, terceroCedula: null, terceroCorreo: null, terceroCelular: null } };
    }

    if (!terceroNombre || !terceroCedula || !terceroCorreo || !terceroCelular) {
        return { valido: false, mensaje: 'Los datos del tercero (nombre, cédula, correo y celular) son obligatorios cuando la reserva es para un tercero' };
    }

    return { valido: true, datos: { terceroNombre, terceroCedula, terceroCorreo, terceroCelular } };
}

const obtenerDisponibilidadCabanas = async (req, res) => {
    try {
        const rango = obtenerRangoMes(req.query.mes);
        if (!rango) {
            return res.status(400).json({ error: 'Parámetro mes inválido, formato esperado YYYY-MM' });
        }

        const reservas = await prisma.reserva.findMany({
            where: {
                espacio: { in: CABANAS },
                estado: { in: ESTADOS_OCUPA_SLOT },
                fecha: { gte: rango.inicio, lt: rango.fin }
            },
            select: { espacio: true, fecha: true }
        });

        const resultado = { CABANA_ARBOL: [], CABANA_MEDIO: [], CABANA_RIO: [] };
        reservas.forEach(reserva => {
            resultado[reserva.espacio].push(reserva.fecha.toISOString().slice(0, 10));
        });

        res.status(200).json(resultado);
    }
    catch (error) {
        console.error('Error al obtener disponibilidad de cabañas:', error);
        res.status(500).json({ error: 'Error al obtener disponibilidad de cabañas' });
    }
}

const obtenerDisponibilidadCasaClub = async (req, res) => {
    try {
        const rango = obtenerRangoMes(req.query.mes);
        if (!rango) {
            return res.status(400).json({ error: 'Parámetro mes inválido, formato esperado YYYY-MM' });
        }

        const reservas = await prisma.reserva.findMany({
            where: {
                espacio: 'CASA_CLUB',
                estado: { in: ESTADOS_OCUPA_SLOT },
                fecha: { gte: rango.inicio, lt: rango.fin }
            },
            select: { fecha: true, horario: true }
        });

        const resultado = {};
        reservas.forEach(reserva => {
            const clave = reserva.fecha.toISOString().slice(0, 10);
            if (!resultado[clave]) resultado[clave] = [];
            resultado[clave].push(reserva.horario);
        });

        res.status(200).json(resultado);
    }
    catch (error) {
        console.error('Error al obtener disponibilidad de Casa Club:', error);
        res.status(500).json({ error: 'Error al obtener disponibilidad de Casa Club' });
    }
}

const crearReserva = async (req, res) => {
    try {
        if (req.user.rol !== 'RESIDENTE') {
            return res.status(403).json({ error: 'Solo los residentes pueden crear reservas' });
        }

        const {
            espacio, fecha, horario, motivoEvento, nombres, apellidos, correo, celular, cedula,
            esParaTercero, terceroNombre, terceroCedula, terceroCorreo, terceroCelular,
            bancoNombre, numeroCuenta, tipoCuenta, cedulaRucBancario
        } = req.body;

        const archivos = {
            comprobantePago: req.files?.comprobantePago?.[0],
            listaInvitados: req.files?.listaInvitados?.[0],
            contratoFirmado: req.files?.contratoFirmado?.[0]
        };

        const camposObligatorios = { espacio, fecha, horario, motivoEvento, nombres, apellidos, correo, celular, cedula, bancoNombre, numeroCuenta, tipoCuenta, cedulaRucBancario };
        const faltanCampos = Object.values(camposObligatorios).some(valor => !valor);
        const faltanArchivos = !archivos.comprobantePago || !archivos.listaInvitados || !archivos.contratoFirmado;

        if (faltanCampos || faltanArchivos) {
            return res.status(400).json({ error: 'Faltan campos o archivos obligatorios' });
        }

        if (!ESPACIOS_VALIDOS.includes(espacio)) {
            return res.status(400).json({ error: 'Espacio inválido' });
        }

        if (!TIPOS_CUENTA_VALIDOS.includes(tipoCuenta)) {
            return res.status(400).json({ error: 'Tipo de cuenta bancaria inválido' });
        }

        const validacionHorario = validarDisponibilidadHorario(espacio, fecha, horario);
        if (!validacionHorario.valido) {
            return res.status(400).json({ error: validacionHorario.mensaje });
        }

        const fechaObj = new Date(fecha);

        const slotOcupado = await prisma.reserva.findFirst({
            where: {
                espacio,
                fecha: fechaObj,
                horario,
                estado: { in: ESTADOS_OCUPA_SLOT }
            }
        });
        if (slotOcupado) {
            return res.status(400).json({ error: 'Ese horario ya está reservado' });
        }

        if (esCabana(espacio)) {
            const otraCabanaMismaFecha = await prisma.reserva.findFirst({
                where: {
                    usuarioId: req.user.id,
                    espacio: { in: CABANAS },
                    fecha: fechaObj,
                    estado: { in: ESTADOS_OCUPA_SLOT }
                }
            });
            if (otraCabanaMismaFecha) {
                return res.status(400).json({ error: 'Ya tienes una reserva de cabaña para esta fecha' });
            }
        }

        const esParaTerceroBool = esParaTercero === 'true' || esParaTercero === true;

        const validacionTercero = datosTercero(espacio, esParaTerceroBool, terceroNombre, terceroCedula, terceroCorreo, terceroCelular);
        if (!validacionTercero.valido) {
            return res.status(400).json({ error: validacionTercero.mensaje });
        }

        const { montoAlquiler, montoGarantia } = calcularMontos(espacio, horario, esParaTerceroBool);

        const [comprobantePagoSubido, listaInvitadosSubido, contratoFirmadoSubido] = await Promise.all([
            subirArchivo(
                archivos.comprobantePago.buffer,
                obtenerCarpetaReserva(espacio, 'comprobantes'),
                tipoRecursoCloudinary(archivos.comprobantePago.mimetype),
                archivos.comprobantePago.originalname
            ),
            subirArchivo(
                archivos.listaInvitados.buffer,
                obtenerCarpetaReserva(espacio, 'documentos'),
                tipoRecursoCloudinary(archivos.listaInvitados.mimetype),
                `invitados-${archivos.listaInvitados.originalname}`
            ),
            subirArchivo(
                archivos.contratoFirmado.buffer,
                obtenerCarpetaReserva(espacio, 'documentos'),
                tipoRecursoCloudinary(archivos.contratoFirmado.mimetype),
                `contrato-${archivos.contratoFirmado.originalname}`
            )
        ]);

        const reserva = await prisma.reserva.create({
            data: {
                usuarioId: req.user.id,
                espacio,
                fecha: fechaObj,
                horario,
                motivoEvento,
                nombres,
                apellidos,
                correo,
                celular,
                cedula,
                esParaTercero: esParaTerceroBool,
                ...validacionTercero.datos,
                bancoNombre,
                numeroCuenta,
                tipoCuenta,
                cedulaRucBancario,
                montoAlquiler,
                montoGarantia,
                comprobantePagoUrl: comprobantePagoSubido.secure_url,
                listaInvitadosUrl: listaInvitadosSubido.secure_url,
                contratoFirmadoUrl: contratoFirmadoSubido.secure_url
            }
        });

        res.status(201).json(reserva);
    }
    catch (error) {
        console.error('Error al crear reserva:', error);
        res.status(500).json({ error: 'Error al crear reserva' });
    }
}

const obtenerReservaPorId = async (req, res) => {
    try {
        const reserva = await prisma.reserva.findUnique({ where: { id: req.params.id } });

        if (!reserva) {
            return res.status(404).json({ error: 'Reserva no encontrada' });
        }

        if (req.user.rol !== 'ADMIN' && reserva.usuarioId !== req.user.id) {
            return res.status(403).json({ error: 'No tienes permiso para ver esta reserva' });
        }

        res.status(200).json(reserva);
    }
    catch (error) {
        console.error('Error al obtener la reserva:', error);
        res.status(500).json({ error: 'Error al obtener la reserva' });
    }
}

const editarReserva = async (req, res) => {
    try {
        const reservaActual = await prisma.reserva.findUnique({ where: { id: req.params.id } });

        if (!reservaActual) {
            return res.status(404).json({ error: 'Reserva no encontrada' });
        }

        if (reservaActual.usuarioId !== req.user.id) {
            return res.status(403).json({ error: 'No tienes permiso para editar esta reserva' });
        }

        if (reservaActual.estado !== 'PENDIENTE') {
            return res.status(400).json({ error: 'Solo puedes editar reservas pendientes' });
        }

        const {
            motivoEvento, nombres, apellidos, correo, celular, cedula,
            esParaTercero, terceroNombre, terceroCedula, terceroCorreo, terceroCelular,
            bancoNombre, numeroCuenta, tipoCuenta, cedulaRucBancario
        } = req.body;

        const archivos = {
            comprobantePago: req.files?.comprobantePago?.[0],
            listaInvitados: req.files?.listaInvitados?.[0],
            contratoFirmado: req.files?.contratoFirmado?.[0]
        };

        const camposObligatorios = { motivoEvento, nombres, apellidos, correo, celular, cedula, bancoNombre, numeroCuenta, tipoCuenta, cedulaRucBancario };
        const faltanCampos = Object.values(camposObligatorios).some(valor => !valor);
        if (faltanCampos) {
            return res.status(400).json({ error: 'Faltan campos obligatorios' });
        }

        if (!TIPOS_CUENTA_VALIDOS.includes(tipoCuenta)) {
            return res.status(400).json({ error: 'Tipo de cuenta bancaria inválido' });
        }

        const esParaTerceroBool = esParaTercero === 'true' || esParaTercero === true;

        const validacionTercero = datosTercero(reservaActual.espacio, esParaTerceroBool, terceroNombre, terceroCedula, terceroCorreo, terceroCelular);
        if (!validacionTercero.valido) {
            return res.status(400).json({ error: validacionTercero.mensaje });
        }

        const { montoAlquiler, montoGarantia } = calcularMontos(reservaActual.espacio, reservaActual.horario, esParaTerceroBool);

        const urlsArchivos = {};
        const subcarpetaPorSlot = { comprobantePago: 'comprobantes', listaInvitados: 'documentos', contratoFirmado: 'documentos' };
        const prefijoPorSlot = { comprobantePago: '', listaInvitados: 'invitados-', contratoFirmado: 'contrato-' };
        const campoUrlPorSlot = { comprobantePago: 'comprobantePagoUrl', listaInvitados: 'listaInvitadosUrl', contratoFirmado: 'contratoFirmadoUrl' };

        for (const slot of ['comprobantePago', 'listaInvitados', 'contratoFirmado']) {
            const archivo = archivos[slot];
            if (!archivo) continue;

            const urlAnterior = reservaActual[campoUrlPorSlot[slot]];
            await eliminarArchivo(urlAnterior, tipoRecursoDesdeUrl(urlAnterior));

            const subido = await subirArchivo(
                archivo.buffer,
                obtenerCarpetaReserva(reservaActual.espacio, subcarpetaPorSlot[slot]),
                tipoRecursoCloudinary(archivo.mimetype),
                `${prefijoPorSlot[slot]}${archivo.originalname}`
            );
            urlsArchivos[campoUrlPorSlot[slot]] = subido.secure_url;
        }

        const reserva = await prisma.reserva.update({
            where: { id: req.params.id },
            data: {
                motivoEvento,
                nombres,
                apellidos,
                correo,
                celular,
                cedula,
                esParaTercero: esParaTerceroBool,
                ...validacionTercero.datos,
                bancoNombre,
                numeroCuenta,
                tipoCuenta,
                cedulaRucBancario,
                montoAlquiler,
                montoGarantia,
                ...urlsArchivos
            }
        });

        res.status(200).json(reserva);
    }
    catch (error) {
        console.error('Error al editar reserva:', error);
        res.status(500).json({ error: 'Error al editar reserva' });
    }
}

const obtenerMisReservas = async (req, res) => {
    try {
        const reservas = await prisma.reserva.findMany({
            where: { usuarioId: req.user.id },
            orderBy: { fecha: 'desc' }
        });
        res.status(200).json(reservas);
    }
    catch (error) {
        console.error('Error al obtener mis reservas:', error);
        res.status(500).json({ error: 'Error al obtener mis reservas' });
    }
}

const obtenerReservas = async (req, res) => {
    try {
        const reservas = await prisma.reserva.findMany({
            orderBy: { creadoEn: 'desc' },
            include: {
                usuario: {
                    select: { id: true, nombre: true, email: true, manzana: true, villa: true, foto: true }
                }
            }
        });
        res.status(200).json(reservas);
    }
    catch (error) {
        console.error('Error al obtener reservas:', error);
        res.status(500).json({ error: 'Error al obtener reservas' });
    }
}

const aprobarReserva = async (req, res) => {
    try {
        const reserva = await prisma.reserva.update({
            where: { id: req.params.id },
            data: { estado: 'APROBADA', motivoRechazo: null }
        });
        res.status(200).json(reserva);
    }
    catch (error) {
        console.error('Error al aprobar reserva:', error);
        res.status(500).json({ error: 'Error al aprobar reserva' });
    }
}

const rechazarReserva = async (req, res) => {
    try {
        const { motivoRechazo } = req.body;
        const reserva = await prisma.reserva.update({
            where: { id: req.params.id },
            data: { estado: 'RECHAZADA', motivoRechazo: motivoRechazo || null }
        });
        res.status(200).json(reserva);
    }
    catch (error) {
        console.error('Error al rechazar reserva:', error);
        res.status(500).json({ error: 'Error al rechazar reserva' });
    }
}

module.exports = {
    obtenerDisponibilidadCabanas,
    obtenerDisponibilidadCasaClub,
    crearReserva,
    obtenerReservaPorId,
    editarReserva,
    obtenerMisReservas,
    obtenerReservas,
    aprobarReserva,
    rechazarReserva
}
