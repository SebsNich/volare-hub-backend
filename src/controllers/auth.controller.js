const crypto = require('crypto');
const prisma = require('../lib/prisma');
const bcryptjs = require('bcryptjs');
const { COSTO_BCRYPT } = require('../lib/seguridad');
const jwt = require('jsonwebtoken');
const { subirArchivo, eliminarArchivo } = require('../lib/cloudinary');
const { carpetas } = require('../lib/carpetas');
const { estaBloqueado, registrarIntentoFallido, limpiarIntentos } = require('../lib/rateLimiterRecuperacion');
const { esCedulaValida, esEmailValido, MENSAJE_EMAIL_INVALIDO } = require('../lib/validadores');
const { crearLimitesLogin } = require('../lib/limitesLogin');
const { validarContrasena } = require('../lib/contrasena');
const { camposEditablesPerfil, celularEditablePerfil } = require('../lib/perfilPublico');
const { crearLimitador, mensajeDeBloqueo } = require('../lib/limitadorIntentos');

const limitesLogin = crearLimitesLogin();
// Quien ya inició sesión también puede fallar la contraseña actual al cambiar
// credenciales (por ejemplo, una sesión abierta en un equipo ajeno). Se limita
// por usuario para que nadie adivine la contraseña desde ese formulario.
const limiteCredenciales = crearLimitador({ maxIntentos: 5, ventanaMs: 15 * 60 * 1000 });
const MENSAJE_CREDENCIALES_BLOQUEADAS = (segundos) =>
    `Demasiados intentos con la contraseña actual. Intenta de nuevo en ${Math.max(1, Math.ceil(segundos / 60))} min.`;

// El aviso es una cortesía de seguridad: si Resend falla, el cambio ya se hizo
// y no debe devolverse como error al usuario.
async function avisarSinFallar(usuario, destino, titulo, texto) {
    try {
        await enviarAvisoSeguridad(usuario, destino, titulo, texto);
    } catch (error) {
        console.error('No se pudo enviar el aviso de seguridad:', error.message);
    }
}
const { enviarCorreoRecuperacion, enviarAvisoSeguridad } = require('../lib/resend');
const { ejecutarConReintentos } = require('../lib/reintentos');
const { buscarResidentesQueOcupanCupo } = require('../lib/residentes');
const {
    normalizarEmail,
    normalizarDireccion,
    validarCasa,
    contarCuentasEnCasa,
    alcanzaLimiteCasa,
    mensajeLimiteCasa,
    respuestaDuplicado,
    respuestaLoginSegunEstado,
    esConflictoDeTransaccion
} = require('../lib/registro.helpers');

const firmarToken = (usuario) => jwt.sign(
    { id: usuario.id, rol: usuario.rol },
    process.env.JWT_SECRET,
    { expiresIn: '24h', algorithm: 'HS256' }
);

const buscarPorEmail = (cliente, email) => cliente.user.findFirst({
    where: { email: { equals: email, mode: 'insensitive' } }
});

// Comprueba duplicados y cupo de la casa y crea la cuenta. Va dentro de una
// transacción Serializable para que dos registros simultáneos en la misma
// casa no terminen creando 3 cuentas.
async function crearCuentaPendiente(tx, datos) {
    const [porEmail, porCedula] = await Promise.all([
        buscarPorEmail(tx, datos.email),
        tx.user.findFirst({ where: { cedula: datos.cedula } })
    ]);
    const duplicado = respuestaDuplicado({ porEmail, porCedula });
    if (duplicado) return { error: duplicado };

    const residentes = await buscarResidentesQueOcupanCupo(tx);
    if (alcanzaLimiteCasa(contarCuentasEnCasa(residentes, datos.manzana, datos.villa))) {
        return { error: { status: 409, codigo: 'LIMITE_VILLA', mensaje: mensajeLimiteCasa(datos.manzana, datos.villa) } };
    }

    const usuario = await tx.user.create({ data: datos });
    return { usuario };
}

const registrar = async (req, res) => {
    const { nombres, apellidos, password, celular } = req.body;
    const cedula = String(req.body.cedula ?? '').trim();

    if (!nombres || !apellidos || !req.body.email || !password || !cedula || !celular || !req.body.manzana || !req.body.villa) {
        return res.status(400).json({ mensaje: 'Todos los campos son obligatorios' })
    }
    if (!esEmailValido(req.body.email)) {
        return res.status(400).json({ mensaje: MENSAJE_EMAIL_INVALIDO });
    }
    if (!esCedulaValida(cedula)) {
        return res.status(400).json({ mensaje: 'La cédula debe tener exactamente 10 dígitos numéricos' });
    }
    const errorContrasena = validarContrasena(password);
    if (errorContrasena) {
        return res.status(400).json({ mensaje: errorContrasena });
    }

    const errorCasa = validarCasa(req.body.manzana, req.body.villa);
    if (errorCasa) {
        return res.status(400).json({ mensaje: errorCasa });
    }

    const { manzana, villa } = normalizarDireccion(req.body.manzana, req.body.villa);

    try {
        // El hash va fuera de la transacción: es lento y no necesita la base.
        const hash = await bcryptjs.hash(password, COSTO_BCRYPT);
        const datos = {
            nombre: `${nombres} ${apellidos}`.trim(),
            nombres, apellidos, cedula, celular, manzana, villa,
            email: normalizarEmail(req.body.email),
            password: hash
        };

        const resultado = await ejecutarConReintentos(
            () => prisma.$transaction(tx => crearCuentaPendiente(tx, datos), { isolationLevel: 'Serializable' }),
            { debeReintentar: esConflictoDeTransaccion }
        );

        if (resultado.error) {
            const { status, codigo, mensaje } = resultado.error;
            return res.status(status).json({ codigo, mensaje });
        }

        return res.status(201).json({
            mensaje: 'Tu cuenta fue creada y está pendiente de aprobación. Mientras tanto, puedes ver las publicaciones.',
            token: firmarToken(resultado.usuario),
            estadoCuenta: resultado.usuario.estadoCuenta
        });

    } catch (error) {
        if (esConflictoDeTransaccion(error)) {
            return res.status(409).json({ codigo: 'REINTENTAR', mensaje: 'Hubo varias solicitudes al mismo tiempo. Intenta registrarte de nuevo en unos segundos.' });
        }
        // P2002: el índice único del email ganó una carrera que la validación no vio.
        if (error.code === 'P2002') {
            return res.status(409).json({ codigo: 'EMAIL_DUPLICADO', mensaje: 'El email ya está registrado' });
        }
        console.error('Error al registrar usuario:', error);
        return res.status(500).json({ mensaje: 'Error interno del servidor' });
    }
}

const login = async (req, res) => {
    const { email, password } = req.body;

    try {
        if (!email || !password) {
            return res.status(400).json({ mensaje: 'Todos los campos son obligatorios' })
        }

        if (typeof email !== 'string' || typeof password !== 'string') {
            return res.status(400).json({ mensaje: 'Datos inválidos' })
        }

        // Antes de tocar la base y bcrypt: un bloqueado no gasta CPU ni consultas.
        const bloqueo = limitesLogin.revisar(req.ip, email);
        if (bloqueo) {
            res.set('Retry-After', String(bloqueo.segundosRestantes));
            return res.status(429).json({ codigo: 'DEMASIADOS_INTENTOS', mensaje: mensajeDeBloqueo(bloqueo.segundosRestantes) });
        }

        // Sin distinguir mayúsculas, para no romper cuentas guardadas antes de normalizar.
        const usuario = await buscarPorEmail(prisma, normalizarEmail(email));

        // Un correo inexistente cuenta como fallo igual que una contraseña mala.
        const passwordValida = usuario ? await bcryptjs.compare(password, usuario.password) : false;

        if (!passwordValida) {
            limitesLogin.registrarFallo(req.ip, email);
            return res.status(400).json({ mensaje: 'Credenciales inválidas' });
        }

        limitesLogin.loginExitoso(email);

        const { status, codigo, mensaje } = respuestaLoginSegunEstado(usuario);
        if (status !== 200) {
            return res.status(status).json({ codigo, mensaje });
        }

        return res.status(200).json({ mensaje, codigo, token: firmarToken(usuario), estadoCuenta: usuario.estadoCuenta });
    }
    catch (error) {
        console.error('Error al iniciar sesión:', error);
        return res.status(500).json({ mensaje: 'Error interno del servidor' });
    }
}

const solicitarRecuperacion = async (req, res) => {
    const { correo } = req.body;
    const ip = req.ip;
    const MENSAJE_GENERICO = 'Si el correo existe, te enviamos instrucciones para restablecer tu contraseña.';

    try {
        if (!correo) {
            return res.status(400).json({ mensaje: 'El correo es obligatorio' });
        }

        if (estaBloqueado(ip, correo)) {
            return res.status(429).json({ mensaje: 'Demasiados intentos. Intenta de nuevo en unos minutos.' });
        }

        registrarIntentoFallido(ip, correo);

        const usuario = await prisma.user.findFirst({
            where: { email: { equals: correo.trim(), mode: 'insensitive' } }
        });

        if (usuario) {
            await prisma.tokenRecuperacion.updateMany({
                where: { usuarioId: usuario.id, usado: false },
                data: { usado: true }
            });

            const token = crypto.randomBytes(32).toString('hex');
            const expiraEn = new Date(Date.now() + 60 * 60 * 1000);

            await prisma.tokenRecuperacion.create({
                data: { token, usuarioId: usuario.id, expiraEn }
            });

            await enviarCorreoRecuperacion(usuario, token);
        }

        return res.status(200).json({ mensaje: MENSAJE_GENERICO });
    }
    catch (error) {
        console.error('Error al solicitar recuperación de contraseña:', error);
        return res.status(200).json({ mensaje: MENSAJE_GENERICO });
    }
}

const restablecerContrasena = async (req, res) => {
    const { token, nuevaContrasena, confirmarContrasena } = req.body;

    try {
        if (!token || !nuevaContrasena || !confirmarContrasena) {
            return res.status(400).json({ mensaje: 'Todos los campos son obligatorios' });
        }

        if (nuevaContrasena !== confirmarContrasena) {
            return res.status(400).json({ mensaje: 'Las contraseñas no coinciden' });
        }

        const errorContrasena = validarContrasena(nuevaContrasena);
        if (errorContrasena) {
            return res.status(400).json({ mensaje: errorContrasena });
        }

        const tokenRecuperacion = await prisma.tokenRecuperacion.findUnique({
            where: { token },
            include: { usuario: true }
        });

        if (!tokenRecuperacion || tokenRecuperacion.usado || tokenRecuperacion.expiraEn < new Date()) {
            return res.status(400).json({ mensaje: 'El enlace no es válido o ha expirado. Solicita uno nuevo.' });
        }

        const esIgualALaActual = await bcryptjs.compare(nuevaContrasena, tokenRecuperacion.usuario.password);
        if (esIgualALaActual) {
            return res.status(400).json({ mensaje: 'La nueva contraseña debe ser diferente a la actual.' });
        }

        const hash = await bcryptjs.hash(nuevaContrasena, COSTO_BCRYPT);

        await prisma.$transaction([
            prisma.user.update({ where: { id: tokenRecuperacion.usuarioId }, data: { password: hash } }),
            prisma.tokenRecuperacion.update({ where: { id: tokenRecuperacion.id }, data: { usado: true } })
        ]);

        limpiarIntentos(req.ip, tokenRecuperacion.usuario.email);

        return res.status(200).json({ mensaje: 'Contraseña actualizada correctamente.' });
    }
    catch (error) {
        console.error('Error al restablecer contraseña:', error);
        return res.status(500).json({ mensaje: 'Error interno del servidor' });
    }
}

const obtenerPerfil = async (req, res) => {
    try{
        const user = await prisma.user.findUnique({
            where:{
                id: req.user.id
                
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
                estadoCuenta: true,
                manzana: true,
                villa: true,
                bio: true,
                foto: true,
                creadoEn: true,
                visitasPerfil: true
            }
        })
        return res.status(200).json({ mensaje: 'Perfil obtenido exitosamente', user: user });
    }
    catch (error) {
        console.error('Error al obtener perfil:', error);
        return res.status(500).json({ mensaje: 'Error interno del servidor' });
    }
}

const editarPerfil = async (req, res) => {
    const { eliminarFoto } = req.body;

    try{
        // Antes de tocar Cloudinary: un celular inválido no debe dejar una foto subida a medias.
        const celular = celularEditablePerfil(req.body);
        if (celular.error) {
            return res.status(400).json({ mensaje: celular.error });
        }

        const usuarioActual = await prisma.user.findUnique({ where: { id: req.user.id } });
        let foto = usuarioActual.foto;

        if (req.file) {
            if (usuarioActual.foto) {
                await eliminarArchivo(usuarioActual.foto);
            }
            const resultado = await subirArchivo(req.file.buffer, carpetas().perfil(), 'image', req.file.originalname);
            foto = resultado.secure_url;
        } else if (eliminarFoto === 'true') {
            if (usuarioActual.foto) {
                await eliminarArchivo(usuarioActual.foto);
            }
            foto = null;
        }

        const usuarioActualizado = await prisma.user.update({
            where: {
                id: req.user.id
            },
            data: {
                ...camposEditablesPerfil(req.body),
                ...celular.datos,
                foto: foto
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
                estadoCuenta: true,
                manzana: true,
                villa: true,
                bio: true,
                foto: true,
                creadoEn: true,
                visitasPerfil: true
            }
        });
        return res.status(200).json({ mensaje: 'Perfil actualizado exitosamente', user: usuarioActualizado });
    }
    catch (error) {
        console.error('Error al editar perfil:', error);
        return res.status(500).json({ mensaje: 'Error interno del servidor' });
    }
}

const cambiarPassword = async (req, res) => {
    const { passwordActual, passwordNuevo } = req.body;

    try {

        if (!passwordActual || !passwordNuevo) {
            return res.status(400).json({ mensaje: 'Todos los campos son obligatorios' });
        }

        const errorContrasena = validarContrasena(passwordNuevo);
        if (errorContrasena) {
            return res.status(400).json({ mensaje: errorContrasena });
        }

        const user = await prisma.user.findUnique({
            where: {
                id: req.user.id
            }
        });

        const bloqueo = limiteCredenciales.consultar(user.id);
        if (bloqueo.bloqueado) {
            return res.status(429).json({ mensaje: MENSAJE_CREDENCIALES_BLOQUEADAS(bloqueo.segundosRestantes) });
        }

        const passwordValida = await bcryptjs.compare(passwordActual, user.password);

        if (!passwordValida) {
            limiteCredenciales.registrarFallo(user.id);
            return res.status(400).json({ mensaje: 'Contraseña actual incorrecta' });
        }
        limiteCredenciales.limpiar(user.id);

        if (passwordNuevo === passwordActual) {
            return res.status(400).json({ mensaje: 'La contraseña nueva debe ser distinta de la actual' });
        }

        const hash = await bcryptjs.hash(passwordNuevo, COSTO_BCRYPT);

        const usuarioActualizado = await prisma.user.update({
            where: {
                id: req.user.id
            },
            data: {
                password: hash
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
                estadoCuenta: true,
                manzana: true,
                villa: true,
                bio: true,
                foto: true,
                creadoEn: true,
                visitasPerfil: true
            }
        });
        await avisarSinFallar(usuarioActualizado, usuarioActualizado.email, 'Tu contraseña fue cambiada',
            'La contraseña de tu cuenta en Urbanización Volare se cambió hace un momento.');
        return res.status(200).json({ mensaje: 'Contraseña actualizada exitosamente', user: usuarioActualizado });
    }
    catch (error) {
        console.error('Error al cambiar contraseña:', error);
        return res.status(500).json({ mensaje: 'Error interno del servidor' });
    }
}

const cambiarEmail = async (req, res) => {
    const { passwordActual, emailNuevo } = req.body;

    try {
        if (!passwordActual || !emailNuevo) {
            return res.status(400).json({ mensaje: 'Todos los campos son obligatorios' });
        }
        // Antes de comparar la contraseña: es la validación barata y no revela nada.
        if (!esEmailValido(emailNuevo)) {
            return res.status(400).json({ mensaje: MENSAJE_EMAIL_INVALIDO });
        }

        const user = await prisma.user.findUnique({
            where: {
                id: req.user.id
            }
        });

        const bloqueo = limiteCredenciales.consultar(user.id);
        if (bloqueo.bloqueado) {
            return res.status(429).json({ mensaje: MENSAJE_CREDENCIALES_BLOQUEADAS(bloqueo.segundosRestantes) });
        }

        const passwordValida = await bcryptjs.compare(passwordActual, user.password);

        if (!passwordValida) {
            limiteCredenciales.registrarFallo(user.id);
            return res.status(400).json({ mensaje: 'Contraseña actual incorrecta' });
        }
        limiteCredenciales.limpiar(user.id);

        // Se guarda en minúsculas, igual que en el registro, para que el inicio
        // de sesión no dependa de cómo se escribió.
        const emailNormalizado = normalizarEmail(emailNuevo);
        if (emailNormalizado === normalizarEmail(user.email)) {
            return res.status(400).json({ mensaje: 'El correo nuevo es el mismo que ya tienes' });
        }

        const emailExistente = await prisma.user.findUnique({
            where: {
                email: emailNormalizado
            }
        });

        if (emailExistente) {
            return res.status(400).json({ mensaje: 'El email ya está registrado' });
        }

        const usuarioActualizado = await prisma.user.update({
            where: {
                id: req.user.id
            },
            data: {
                email: emailNormalizado
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
                estadoCuenta: true,
                manzana: true,
                villa: true,
                bio: true,
                foto: true,
                creadoEn: true,
                visitasPerfil: true
            }
        });
        // Al correo anterior: si la cuenta fue tomada por otra persona, el dueño se entera.
        await avisarSinFallar(usuarioActualizado, user.email, 'Tu correo de acceso fue cambiado',
            `El correo de acceso de tu cuenta cambió a ${emailNormalizado}. Desde ahora debes iniciar sesión con ese correo.`);
        return res.status(200).json({ mensaje: 'Email actualizado exitosamente', user: usuarioActualizado });
    }
    catch(error){
        console.error('Error al cambiar email:', error);
        return res.status(500).json({ mensaje: 'Error interno del servidor' });
    }
}

module.exports = {
    registrar,
    login,
    solicitarRecuperacion,
    restablecerContrasena,
    obtenerPerfil ,
    editarPerfil,
    cambiarPassword,
    cambiarEmail
}