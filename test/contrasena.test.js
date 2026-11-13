const { test } = require('node:test');
const assert = require('node:assert/strict');
const { validarContrasena } = require('../src/lib/contrasena');

test('acepta los bordes: 8 caracteres y 72 bytes', () => {
    assert.equal(validarContrasena('a'.repeat(8)), null);
    assert.equal(validarContrasena('a'.repeat(72)), null);
    assert.equal(validarContrasena('ñ'.repeat(36)), null, '36 ñ = 72 bytes');
});

test('rechaza menos de 8 caracteres', () => {
    assert.match(validarContrasena('a'.repeat(7)), /al menos 8/);
    assert.match(validarContrasena(''), /al menos 8/);
});

test('el mínimo se cuenta en caracteres, no en bytes', () => {
    assert.match(validarContrasena('ñ'.repeat(7)), /al menos 8/, '7 ñ son 14 bytes pero solo 7 caracteres');
});

test('rechaza más de 72 bytes aunque sean menos de 72 caracteres', () => {
    assert.match(validarContrasena('a'.repeat(73)), /72/);
    assert.match(validarContrasena('ñ'.repeat(37)), /tilde o ñ/, '37 ñ = 74 bytes');
    assert.match(validarContrasena('a'.repeat(71) + 'é'), /72/, '71 + 2 = 73 bytes');
});

test('rechaza lo que no es texto', () => {
    assert.ok(validarContrasena(undefined));
    assert.ok(validarContrasena(12345678));
    assert.ok(validarContrasena(['a'.repeat(8)]));
});
