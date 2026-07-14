const prisma = require('../lib/prisma');
const bcryptjs = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { subirArchivo, eliminarArchivo } = require('../lib/cloudinary');
const { estaBloqueado, registrarIntentoFallido, limpiarIntentos } = require('../lib/rateLimiterRecuperacion');
const { esCedulaValida } = require('../lib/validadores');

const registrar = async (req, res) => {
    const { nombres, apellidos, email, password, cedula, celular, manzana, villa } = req.body;

    try {
        if (!nombres || !apellidos || !email || !password || !cedula || !celular || !manzana || !villa) {
            return res.status(400).json({ mensaje: 'Todos los campos son obligatorios' })
        }

        if (!esCedulaValida(cedula)) {
            return res.status(400).json({ mensaje: 'La cédula debe tener exactamente 10 dígitos numéricos' });
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
                cedula: cedula,
                celular: celular,
                manzana: manzana,
                villa: villa,
                email: email,
                password: hash
            }
        });

        const token = jwt.sign(
            { id: resultado.id, rol: resultado.rol },
            process.env.JWT_SECRET,
            { expiresIn: '24h' }
        );

        return res.status(201).json({ mensaje: 'Usuario registrado exitosamente', token: token });

    } catch (error) {
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

        const usuario = await prisma.user.findUnique({
            where: {
                email: email
            }
        });

        if (!usuario) {
            return res.status(400).json({ mensaje: 'Credenciales inválidas' });
        }

        const passwordValida = await bcryptjs.compare(password, usuario.password);

        if (!passwordValida) {
            return res.status(400).json({ mensaje: 'Credenciales inválidas' });
        }

        if (!usuario.activo) {
            return res.status(403).json({ mensaje: 'Usuario inactivo. Contacta al administrador.' });
        }

        const token = jwt.sign(
            { id: usuario.id, rol: usuario.rol },
            process.env.JWT_SECRET,
            { expiresIn: '24h' }
        );

        return res.status(200).json({ mensaje: 'Inicio de sesión exitoso', token: token });
    }
    catch (error) {
        console.error('Error al iniciar sesión:', error);
        return res.status(500).json({ mensaje: 'Error interno del servidor' });
    }
}

const recuperarContrasena = async (req, res) => {
    const { correo, manzana, villa, nuevaContrasena, confirmarContrasena } = req.body;
    const ip = req.ip;

    try {
        if (!correo || !manzana || !villa || !nuevaContrasena || !confirmarContrasena) {
            return res.status(400).json({ mensaje: 'Todos los campos son obligatorios' });
        }

        if (estaBloqueado(ip, correo)) {
            return res.status(429).json({ mensaje: 'Demasiados intentos. Intenta de nuevo en unos minutos.' });
        }

        if (nuevaContrasena !== confirmarContrasena) {
            return res.status(400).json({ mensaje: 'Las contraseñas no coinciden' });
        }

        const usuario = await prisma.user.findFirst({
            where: {
                email: { equals: correo.trim(), mode: 'insensitive' },
                manzana: { equals: manzana.trim(), mode: 'insensitive' },
                villa: { equals: villa.trim(), mode: 'insensitive' }
            }
        });

        if (!usuario) {
            registrarIntentoFallido(ip, correo);
            return res.status(400).json({ mensaje: 'Los datos no coinciden con ninguna cuenta registrada.' });
        }

        const esIgualALaActual = await bcryptjs.compare(nuevaContrasena, usuario.password);
        if (esIgualALaActual) {
            return res.status(400).json({ mensaje: 'La nueva contraseña debe ser diferente a la actual.' });
        }

        const hash = await bcryptjs.hash(nuevaContrasena, 10);
        await prisma.user.update({
            where: { id: usuario.id },
            data: { password: hash }
        });

        limpiarIntentos(ip, correo);

        return res.status(200).json({ mensaje: 'Contraseña actualizada correctamente.' });
    }
    catch (error) {
        console.error('Error al recuperar contraseña:', error);
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
    const { nombres, apellidos, bio, eliminarFoto } = req.body;

    try{
        const usuarioActual = await prisma.user.findUnique({ where: { id: req.user.id } });
        let foto = usuarioActual.foto;

        if (req.file) {
            if (usuarioActual.foto) {
                await eliminarArchivo(usuarioActual.foto);
            }
            const resultado = await subirArchivo(req.file.buffer, 'volare-hub/perfil/photos', 'image', req.file.originalname);
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
                nombres: nombres,
                apellidos: apellidos,
                bio: bio,
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

        const user = await prisma.user.findUnique({
            where: {
                id: req.user.id
            }
        });

        const passwordValida = await bcryptjs.compare(passwordActual, user.password);

        if (!passwordValida) {
            return res.status(400).json({ mensaje: 'Contraseña actual incorrecta' });
        }

        const hash = await bcryptjs.hash(passwordNuevo, 10);

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
                manzana: true,
                villa: true,
                bio: true,
                foto: true,
                creadoEn: true,
                visitasPerfil: true
            }
        });
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

        const user = await prisma.user.findUnique({
            where: {
                id: req.user.id
            }
        });

        const passwordValida = await bcryptjs.compare(passwordActual, user.password);

        if (!passwordValida) {
            return res.status(400).json({ mensaje: 'Contraseña actual incorrecta' });
        }

        const emailExistente = await prisma.user.findUnique({
            where: {
                email: emailNuevo
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
                email: emailNuevo
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
                creadoEn: true,
                visitasPerfil: true
            }
        });
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
    recuperarContrasena,
    obtenerPerfil ,
    editarPerfil,
    cambiarPassword,
    cambiarEmail
}