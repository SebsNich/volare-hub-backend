// Datos de prueba para las pruebas de integración de reservas y pagos.
// Todo lo que se crea lleva el prefijo en el correo del usuario, para que
// limpiar() borre solo lo de esta prueba y nada más de volare_test.
function crearDatosIntegracion(prisma, prefijo) {
    let contador = 0;

    async function crearUsuario(rol = 'RESIDENTE') {
        contador += 1;
        const u = await prisma.user.create({
            data: {
                nombre: `Prueba ${contador}`,
                email: `${prefijo}${Date.now()}.${contador}@ejemplo.test`,
                password: 'no-se-usa',
                rol,
                estadoCuenta: 'APROBADA',
                manzana: '01',
                villa: '02'
            }
        });
        return { id: u.id, rol: u.rol };
    }

    async function crearReserva(usuario, { creadoEn = new Date(), estado = 'PENDIENTE', comprobantePagoUrls = [], espacio = 'CABANA_ARBOL', fecha = null } = {}) {
        contador += 1;
        return prisma.reserva.create({
            data: {
                usuarioId: usuario.id,
                espacio,
                // Fechas lejanas y distintas: no chocan con el índice de turno único.
                fecha: fecha ?? new Date(Date.UTC(2031, 0, 1 + contador)),
                horario: 'CABANA_COMPLETO',
                manzana: '01', villa: '02',
                motivoEvento: 'Prueba de integración',
                nombres: 'Prueba', apellidos: 'Integración',
                correo: 'prueba@ejemplo.test', celular: '0999999999', cedula: '0000000000',
                bancoNombre: 'Banco', numeroCuenta: '123', tipoCuenta: 'AHORROS', cedulaRucBancario: '0000000000',
                montoAlquiler: '15', montoGarantia: '25',
                comprobantePagoUrls,
                estado,
                creadoEn
            }
        });
    }

    function crearPago(reserva, { concepto = 'ALQUILER', estado = 'PENDIENTE', proveedor = 'SIMULADO', venceEn = null } = {}) {
        return prisma.pago.create({
            data: {
                usuarioId: reserva.usuarioId,
                tipo: 'RESERVA',
                concepto,
                reservaId: reserva.id,
                montoCentavos: 1500,
                proveedor,
                estado,
                venceEn
            }
        });
    }

    async function limpiar() {
        const usuarios = { usuario: { email: { startsWith: prefijo } } };
        await prisma.pago.deleteMany({ where: usuarios });
        await prisma.reserva.deleteMany({ where: usuarios });
        await prisma.user.deleteMany({ where: { email: { startsWith: prefijo } } });
    }

    return { crearUsuario, crearReserva, crearPago, limpiar };
}

// Un res de Express mínimo: guarda el status y el JSON para revisarlos.
function respuestaFalsa() {
    const res = { statusCode: null, cuerpo: null };
    res.status = (codigo) => { res.statusCode = codigo; return res; };
    res.json = (cuerpo) => { res.cuerpo = cuerpo; return res; };
    return res;
}

module.exports = { crearDatosIntegracion, respuestaFalsa };
