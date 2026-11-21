const { test } = require('node:test');
const assert = require('node:assert/strict');
const {
    normalizarCodigoCasa,
    validarCasa,
    normalizarDireccion,
    normalizarEmail,
    contarCuentasEnCasa,
    alcanzaLimiteCasa,
    mensajeLimiteCasa,
    respuestaLoginSegunEstado,
    evaluarAccesoCuenta,
    validarDecision,
    validarMotivoRechazo,
    cambiosAlAprobar,
    cambiosAlRechazar,
    esConflictoDeTransaccion,
    respuestaDuplicado,
    agregarCuentasEnCasa
} = require('../src/lib/registro.helpers');

const residente = (datos) => ({ rol: 'RESIDENTE', estadoCuenta: 'APROBADA', activo: true, manzana: '01', villa: '02', ...datos });

// --- Normalización de manzana y villa ---

test('normalizarCodigoCasa rellena con cero los números de un dígito', () => {
    assert.equal(normalizarCodigoCasa('1'), '01');
    assert.equal(normalizarCodigoCasa('7'), '07');
});

test('normalizarCodigoCasa deja igual los números que ya tienen dos dígitos', () => {
    assert.equal(normalizarCodigoCasa('01'), '01');
    assert.equal(normalizarCodigoCasa('12'), '12');
});

test('normalizarCodigoCasa recorta espacios antes de rellenar', () => {
    assert.equal(normalizarCodigoCasa(' 2 '), '02');
});

test('normalizarCodigoCasa quita ceros sobrantes para que "001" sea "01"', () => {
    assert.equal(normalizarCodigoCasa('001'), '01');
    assert.equal(normalizarCodigoCasa('0'), '00');
});

test('normalizarCodigoCasa no recorta números de tres dígitos', () => {
    assert.equal(normalizarCodigoCasa('105'), '105');
});

test('normalizarCodigoCasa pasa las letras a mayúscula sin rellenar', () => {
    assert.equal(normalizarCodigoCasa('a'), 'A');
    assert.equal(normalizarCodigoCasa(' b2 '), 'B2');
});

test('normalizarCodigoCasa devuelve texto vacío si no hay valor', () => {
    assert.equal(normalizarCodigoCasa(null), '');
    assert.equal(normalizarCodigoCasa(undefined), '');
});

test('normalizarDireccion normaliza manzana y villa a la vez', () => {
    assert.deepEqual(normalizarDireccion(' 1', 'a '), { manzana: '01', villa: 'A' });
});

test('normalizarEmail recorta espacios y pasa a minúsculas', () => {
    assert.equal(normalizarEmail('  Ana.Perez@Correo.COM '), 'ana.perez@correo.com');
});

// --- Límite de 2 cuentas por casa ---

test('contarCuentasEnCasa reconoce datos viejos mal formateados ("2" cuenta como "02")', () => {
    const usuarios = [residente({ manzana: '1', villa: '2' }), residente({ manzana: '01', villa: '02' })];
    assert.equal(contarCuentasEnCasa(usuarios, '01', '02'), 2);
});

test('contarCuentasEnCasa solo cuenta RESIDENTE (los ADMIN no ocupan cupo)', () => {
    const usuarios = [residente({}), { ...residente({}), rol: 'ADMIN' }];
    assert.equal(contarCuentasEnCasa(usuarios, '01', '02'), 1);
});

test('contarCuentasEnCasa cuenta PENDIENTE y APROBADA pero no RECHAZADA', () => {
    const usuarios = [
        residente({ estadoCuenta: 'PENDIENTE' }),
        residente({ estadoCuenta: 'APROBADA' }),
        residente({ estadoCuenta: 'RECHAZADA' })
    ];
    assert.equal(contarCuentasEnCasa(usuarios, '01', '02'), 2);
});

test('contarCuentasEnCasa no mezcla casas distintas', () => {
    const usuarios = [residente({ villa: '03' }), residente({ manzana: '02' })];
    assert.equal(contarCuentasEnCasa(usuarios, '01', '02'), 0);
});

test('agregarCuentasEnCasa añade a cada solicitud el total de su casa (datos viejos incluidos)', () => {
    const pendiente = residente({ id: 'p1', estadoCuenta: 'PENDIENTE', manzana: '01', villa: '02' });
    const residentes = [pendiente, residente({ manzana: '1', villa: '2' }), residente({ manzana: '05', villa: '05' })];
    const [resultado] = agregarCuentasEnCasa([pendiente], residentes);
    assert.equal(resultado.id, 'p1');
    assert.equal(resultado.cuentasEnCasa, 2);
});

test('alcanzaLimiteCasa es true desde 2 cuentas', () => {
    assert.equal(alcanzaLimiteCasa(1), false);
    assert.equal(alcanzaLimiteCasa(2), true);
    assert.equal(alcanzaLimiteCasa(3), true);
});

// --- Login según el estado de la cuenta ---

test('respuestaLoginSegunEstado deja entrar a una cuenta APROBADA', () => {
    const r = respuestaLoginSegunEstado(residente({}));
    assert.equal(r.status, 200);
    assert.equal(r.codigo, null);
});

test('respuestaLoginSegunEstado deja entrar a una PENDIENTE con aviso', () => {
    const r = respuestaLoginSegunEstado(residente({ estadoCuenta: 'PENDIENTE' }));
    assert.equal(r.status, 200);
    assert.equal(r.codigo, 'CUENTA_PENDIENTE');
    assert.match(r.mensaje, /pendiente de aprobación/);
});

test('respuestaLoginSegunEstado rechaza una RECHAZADA y muestra el motivo', () => {
    const r = respuestaLoginSegunEstado(residente({ estadoCuenta: 'RECHAZADA', motivoRechazo: 'La villa no coincide' }));
    assert.equal(r.status, 403);
    assert.equal(r.codigo, 'CUENTA_RECHAZADA');
    assert.match(r.mensaje, /La villa no coincide/);
});

test('el mensaje de rechazo no duplica el punto final del motivo', () => {
    const casos = [
        ['La villa no coincide', 'Motivo: La villa no coincide. Contacta'],
        ['La villa no coincide.', 'Motivo: La villa no coincide. Contacta'],
        ['¿Eres residente?', 'Motivo: ¿Eres residente? Contacta'],
        ['Faltan datos!', 'Motivo: Faltan datos! Contacta']
    ];
    for (const [motivoRechazo, esperado] of casos) {
        const r = respuestaLoginSegunEstado(residente({ estadoCuenta: 'RECHAZADA', motivoRechazo }));
        assert.ok(r.mensaje.includes(esperado), `"${motivoRechazo}" produjo: ${r.mensaje}`);
    }
});

test('respuestaLoginSegunEstado revisa activo antes que el estado de la cuenta', () => {
    const r = respuestaLoginSegunEstado(residente({ activo: false, estadoCuenta: 'PENDIENTE' }));
    assert.equal(r.status, 403);
    assert.equal(r.codigo, 'CUENTA_INACTIVA');
});

// --- Acceso a rutas protegidas (lo usará el middleware verificarEstadoCuenta) ---

test('evaluarAccesoCuenta permite a una cuenta APROBADA y activa', () => {
    assert.equal(evaluarAccesoCuenta(residente({})), null);
});

test('evaluarAccesoCuenta bloquea una cuenta con activo=false aunque esté APROBADA', () => {
    const r = evaluarAccesoCuenta(residente({ activo: false }));
    assert.equal(r.status, 403);
    assert.equal(r.codigo, 'CUENTA_INACTIVA');
});

test('evaluarAccesoCuenta bloquea una PENDIENTE por defecto', () => {
    const r = evaluarAccesoCuenta(residente({ estadoCuenta: 'PENDIENTE' }));
    assert.equal(r.status, 403);
    assert.equal(r.codigo, 'CUENTA_PENDIENTE');
});

test('evaluarAccesoCuenta deja leer a una PENDIENTE si la ruta lo permite', () => {
    assert.equal(evaluarAccesoCuenta(residente({ estadoCuenta: 'PENDIENTE' }), { permitirPendiente: true }), null);
});

test('evaluarAccesoCuenta bloquea una RECHAZADA aunque la ruta permita pendientes', () => {
    const r = evaluarAccesoCuenta(residente({ estadoCuenta: 'RECHAZADA' }), { permitirPendiente: true });
    assert.equal(r.status, 403);
    assert.equal(r.codigo, 'CUENTA_RECHAZADA');
});

test('evaluarAccesoCuenta responde 401 si el usuario del token ya no existe', () => {
    const r = evaluarAccesoCuenta(null);
    assert.equal(r.status, 401);
});

// --- Decisiones del ADMIN ---

test('validarDecision permite aprobar una PENDIENTE', () => {
    assert.equal(validarDecision(residente({ estadoCuenta: 'PENDIENTE' }), 'aprobar', 2), null);
});

test('validarDecision no permite aprobar una cuenta ya APROBADA', () => {
    const r = validarDecision(residente({}), 'aprobar', 0);
    assert.equal(r.status, 409);
    assert.equal(r.codigo, 'YA_DECIDIDA');
});

test('validarDecision permite aprobar una RECHAZADA si la casa tiene cupo', () => {
    assert.equal(validarDecision(residente({ estadoCuenta: 'RECHAZADA' }), 'aprobar', 1), null);
});

test('validarDecision no aprueba una RECHAZADA si la casa ya está llena', () => {
    const r = validarDecision(residente({ estadoCuenta: 'RECHAZADA' }), 'aprobar', 2);
    assert.equal(r.status, 409);
    assert.equal(r.codigo, 'LIMITE_VILLA');
});

test('validarDecision da al ADMIN un mensaje de límite pensado para él', () => {
    const r = validarDecision(residente({ estadoCuenta: 'RECHAZADA', manzana: '7', villa: '3' }), 'aprobar', 2);
    assert.match(r.mensaje, /manzana 07, villa 03/);
    assert.match(r.mensaje, /Revisa las cuentas de esa casa/);
    assert.doesNotMatch(r.mensaje, /contacta a la administración/i);
});

test('el mensaje de límite del registro sigue indicando al residente que contacte a la administración', () => {
    assert.match(mensajeLimiteCasa('7', '3'), /contacta a la administración/);
});

test('validarDecision permite rechazar solo una PENDIENTE', () => {
    assert.equal(validarDecision(residente({ estadoCuenta: 'PENDIENTE' }), 'rechazar', 0), null);
    assert.equal(validarDecision(residente({ estadoCuenta: 'APROBADA' }), 'rechazar', 0).codigo, 'YA_DECIDIDA');
    assert.equal(validarDecision(residente({ estadoCuenta: 'RECHAZADA' }), 'rechazar', 0).codigo, 'YA_DECIDIDA');
});

test('validarMotivoRechazo exige un motivo con texto', () => {
    assert.match(validarMotivoRechazo(''), /obligatorio/);
    assert.match(validarMotivoRechazo('   '), /obligatorio/);
    assert.match(validarMotivoRechazo(undefined), /obligatorio/);
});

test('validarMotivoRechazo limita el motivo a 500 caracteres', () => {
    assert.match(validarMotivoRechazo('a'.repeat(501)), /500/);
    assert.equal(validarMotivoRechazo('a'.repeat(500)), null);
});

test('cambiosAlAprobar guarda quién decidió, cuándo y limpia el motivo', () => {
    const ahora = new Date('2026-11-10T12:00:00Z');
    assert.deepEqual(cambiosAlAprobar('admin-1', ahora), {
        estadoCuenta: 'APROBADA', decididoPorId: 'admin-1', fechaDecision: ahora, motivoRechazo: null
    });
});

test('cambiosAlRechazar guarda el motivo sin espacios sobrantes', () => {
    const ahora = new Date('2026-11-10T12:00:00Z');
    assert.deepEqual(cambiosAlRechazar('admin-1', '  Datos no coinciden  ', ahora), {
        estadoCuenta: 'RECHAZADA', decididoPorId: 'admin-1', fechaDecision: ahora, motivoRechazo: 'Datos no coinciden'
    });
});

// --- Email o cédula ya registrados ---

test('respuestaDuplicado devuelve null si no hay coincidencias', () => {
    assert.equal(respuestaDuplicado({ porEmail: null, porCedula: null }), null);
});

test('respuestaDuplicado avisa del email repetido', () => {
    const r = respuestaDuplicado({ porEmail: residente({}), porCedula: null });
    assert.equal(r.status, 409);
    assert.equal(r.codigo, 'EMAIL_DUPLICADO');
});

test('respuestaDuplicado avisa de la cédula repetida', () => {
    const r = respuestaDuplicado({ porEmail: null, porCedula: residente({}) });
    assert.equal(r.status, 409);
    assert.equal(r.codigo, 'CEDULA_DUPLICADA');
});

test('respuestaDuplicado da un aviso genérico si la coincidencia es una cuenta RECHAZADA', () => {
    const rechazada = residente({ estadoCuenta: 'RECHAZADA', motivoRechazo: 'Dato privado' });
    for (const coincidencia of [{ porEmail: rechazada, porCedula: null }, { porEmail: null, porCedula: rechazada }]) {
        const r = respuestaDuplicado(coincidencia);
        assert.equal(r.status, 409);
        assert.equal(r.codigo, 'SOLICITUD_RECHAZADA');
        // El motivo solo se muestra tras validar la contraseña en el login.
        assert.doesNotMatch(r.mensaje, /Dato privado/);
    }
});

// --- Conflicto de la transacción Serializable ---

test('esConflictoDeTransaccion reconoce el código P2034 de Prisma', () => {
    assert.equal(esConflictoDeTransaccion({ code: 'P2034' }), true);
    assert.equal(esConflictoDeTransaccion({ code: 'P2002' }), false);
    assert.equal(esConflictoDeTransaccion(new Error('otro')), false);
});

// Forma real observada con @prisma/adapter-pg: no trae code P2034.
test('esConflictoDeTransaccion reconoce el conflicto que envía el adaptador de pg', () => {
    const error = Object.assign(new Error('TransactionWriteConflict'), {
        name: 'DriverAdapterError',
        cause: { originalCode: '40001', kind: 'TransactionWriteConflict' }
    });
    assert.equal(esConflictoDeTransaccion(error), true);
});

test('esConflictoDeTransaccion reconoce el código 40001 de Postgres aunque cambie el "kind"', () => {
    assert.equal(esConflictoDeTransaccion({ cause: { originalCode: '40001' } }), true);
});

test('esConflictoDeTransaccion no confunde otros errores del adaptador', () => {
    assert.equal(esConflictoDeTransaccion({ name: 'DriverAdapterError', cause: { originalCode: '23505', kind: 'UniqueConstraintViolation' } }), false);
    assert.equal(esConflictoDeTransaccion(null), false);
});

test('validarCasa acepta solo números del 1 al 99', () => {
    assert.equal(validarCasa('7', '03'), null);
    assert.equal(validarCasa(' 28 ', '30'), null);
    assert.equal(validarCasa('99', '1'), null);
});

test('validarCasa rechaza letras, ceros, vacíos y números de 3 dígitos', () => {
    assert.match(validarCasa('A', '03'), /manzana/);
    assert.match(validarCasa('07', 'B2'), /villa/);
    assert.match(validarCasa('0', '03'), /manzana/);
    assert.match(validarCasa('07', '100'), /villa/);
    assert.match(validarCasa('', '03'), /manzana/);
    assert.match(validarCasa('1.5', '03'), /manzana/);
});
