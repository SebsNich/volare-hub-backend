const { test } = require('node:test');
const assert = require('node:assert/strict');
const { validarSugerencia, crearLimiteBuzon, LARGOS_BUZON, MAX_ENVIOS_POR_IP } = require('../src/lib/buzon');

const valida = { nombre: ' Ana ', manzana: '01', villa: '02', tipo: 'QUEJA', mensaje: ' Hay ruido de noche ' };

// ---------- RF-50 / RF-20: validación ----------

test('una sugerencia válida devuelve solo los campos conocidos, recortados', () => {
    const r = validarSugerencia({ ...valida, estado: 'LEIDA', id: 'x' });
    assert.deepEqual(r, { datos: { nombre: 'Ana', manzana: '01', villa: '02', tipo: 'QUEJA', mensaje: 'Hay ruido de noche' } });
});

test('manzana y villa son opcionales', () => {
    const r = validarSugerencia({ nombre: 'Ana', tipo: 'OTRO', mensaje: 'Hola' });
    assert.deepEqual(r.datos, { nombre: 'Ana', manzana: null, villa: null, tipo: 'OTRO', mensaje: 'Hola' });
});

test('faltan nombre, tipo o mensaje (o solo espacios): 400', () => {
    for (const cambio of [{ nombre: '  ' }, { tipo: undefined }, { mensaje: '' }]) {
        assert.ok(validarSugerencia({ ...valida, ...cambio }).error, JSON.stringify(cambio));
    }
});

test('un tipo desconocido o un campo que no es texto: 400', () => {
    assert.match(validarSugerencia({ ...valida, tipo: 'SPAM' }).error, /tipo/);
    assert.ok(validarSugerencia({ ...valida, mensaje: { $gt: '' } }).error);
    assert.ok(validarSugerencia({ ...valida, manzana: 5 }).error);
});

test(`límites de longitud: nombre ${LARGOS_BUZON.nombre}, mensaje ${LARGOS_BUZON.mensaje}, manzana y villa ${LARGOS_BUZON.manzana}`, () => {
    assert.match(validarSugerencia({ ...valida, mensaje: 'x'.repeat(LARGOS_BUZON.mensaje + 1) }).error, /mensaje/);
    assert.match(validarSugerencia({ ...valida, nombre: 'x'.repeat(LARGOS_BUZON.nombre + 1) }).error, /nombre/);
    assert.match(validarSugerencia({ ...valida, villa: 'x'.repeat(LARGOS_BUZON.villa + 1) }).error, /villa/);
    assert.ok(validarSugerencia({ ...valida, mensaje: 'x'.repeat(LARGOS_BUZON.mensaje) }).datos);
});

// ---------- RF-50: límite por IP ----------

function probarMiddleware(limite, ip) {
    const res = { statusCode: null, cuerpo: null };
    res.status = (c) => { res.statusCode = c; return res; };
    res.json = (b) => { res.cuerpo = b; return res; };
    let siguio = false;
    limite.middleware({ ip }, res, () => { siguio = true; });
    return { res, siguio };
}

test(`deja pasar ${MAX_ENVIOS_POR_IP} envíos por IP y bloquea el siguiente con 429`, () => {
    let reloj = 0;
    const limite = crearLimiteBuzon({ ahora: () => reloj });
    for (let i = 0; i < MAX_ENVIOS_POR_IP; i++) {
        assert.equal(probarMiddleware(limite, '1.1.1.1').siguio, true, `envío ${i + 1}`);
        limite.registrarEnvio('1.1.1.1');
    }
    const bloqueado = probarMiddleware(limite, '1.1.1.1');
    assert.equal(bloqueado.siguio, false);
    assert.equal(bloqueado.res.statusCode, 429);
    assert.match(bloqueado.res.cuerpo.error, /Demasiados envíos/);
    // Otra IP no se ve afectada.
    assert.equal(probarMiddleware(limite, '2.2.2.2').siguio, true);
});

test('al pasar la ventana de una hora, la IP vuelve a poder enviar', () => {
    let reloj = 0;
    const limite = crearLimiteBuzon({ ahora: () => reloj });
    for (let i = 0; i < MAX_ENVIOS_POR_IP; i++) limite.registrarEnvio('1.1.1.1');
    assert.equal(probarMiddleware(limite, '1.1.1.1').siguio, false);
    reloj += 60 * 60 * 1000;
    assert.equal(probarMiddleware(limite, '1.1.1.1').siguio, true);
});
