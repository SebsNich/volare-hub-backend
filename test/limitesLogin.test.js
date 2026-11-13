const { test } = require('node:test');
const assert = require('node:assert/strict');
const { crearLimitesLogin } = require('../src/lib/limitesLogin');

const MINUTO = 60 * 1000;

function crearReloj() {
    let actual = 0;
    return { ahora: () => actual, avanzar: (ms) => { actual += ms; } };
}

const IP = '10.0.0.1';

function fallar(limites, veces, correo, ip = IP) {
    for (let i = 0; i < veces; i++) limites.registrarFallo(ip, correo);
}

test('el intento 11 con el mismo correo queda bloqueado', () => {
    const limites = crearLimitesLogin({ ahora: crearReloj().ahora });
    fallar(limites, 9, 'ana@x.com');
    assert.equal(limites.revisar(IP, 'ana@x.com'), null);
    fallar(limites, 1, 'ana@x.com');
    assert.ok(limites.revisar(IP, 'ana@x.com').segundosRestantes > 0);
});

test('el correo se compara sin mayúsculas ni espacios', () => {
    const limites = crearLimitesLogin({ ahora: crearReloj().ahora });
    fallar(limites, 10, '  Ana@X.com ');
    assert.ok(limites.revisar(IP, 'ana@x.com'));
});

test('el bloqueo por correo vale desde cualquier IP', () => {
    const limites = crearLimitesLogin({ ahora: crearReloj().ahora });
    fallar(limites, 10, 'ana@x.com', '10.0.0.1');
    assert.ok(limites.revisar('10.0.0.2', 'ana@x.com'));
});

test('30 fallos desde una IP la bloquean aunque cambie el correo', () => {
    const limites = crearLimitesLogin({ ahora: crearReloj().ahora });
    for (let i = 0; i < 29; i++) limites.registrarFallo(IP, `c${i}@x.com`);
    assert.equal(limites.revisar(IP, 'nuevo@x.com'), null);
    limites.registrarFallo(IP, 'c29@x.com');
    assert.ok(limites.revisar(IP, 'nuevo@x.com'));
    assert.equal(limites.revisar('10.0.0.2', 'nuevo@x.com'), null);
});

test('un login exitoso limpia solo el contador de ese correo, no el de la IP', () => {
    const limites = crearLimitesLogin({ ahora: crearReloj().ahora });
    for (let i = 0; i < 10; i++) limites.registrarFallo(IP, `c${i}@x.com`);
    fallar(limites, 9, 'ana@x.com');
    limites.loginExitoso('ana@x.com');
    fallar(limites, 9, 'ana@x.com');
    assert.equal(limites.revisar(IP, 'ana@x.com'), null, 'el correo empezó de cero: 9 < 10');
    fallar(limites, 2, 'otro@x.com');
    assert.ok(limites.revisar(IP, 'otro@x.com'), 'la IP siguió sumando: 10 + 9 + 9 + 2 = 30');
});

test('a los 15 minutos se libera', () => {
    const reloj = crearReloj();
    const limites = crearLimitesLogin({ ahora: reloj.ahora });
    fallar(limites, 10, 'ana@x.com');
    reloj.avanzar(15 * MINUTO);
    assert.equal(limites.revisar(IP, 'ana@x.com'), null);
});

test('si están bloqueados correo e IP, informa la espera más larga', () => {
    const reloj = crearReloj();
    const limites = crearLimitesLogin({ ahora: reloj.ahora });
    for (let i = 0; i < 30; i++) limites.registrarFallo(IP, `c${i}@x.com`);
    reloj.avanzar(5 * MINUTO);
    fallar(limites, 10, 'ana@x.com');
    assert.equal(limites.revisar(IP, 'ana@x.com').segundosRestantes, 15 * 60);
});
