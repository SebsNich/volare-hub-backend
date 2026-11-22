const { test } = require('node:test');
const assert = require('node:assert/strict');
const { normalizarCelular } = require('../src/lib/validadores');
const { celularEditablePerfil } = require('../src/lib/perfilPublico');

test('normalizarCelular deja el formato 09XXXXXXXX', () => {
    assert.equal(normalizarCelular('0939619439'), '0939619439');
    assert.equal(normalizarCelular(' 093 961-9439 '), '0939619439');
    assert.equal(normalizarCelular('+593 93 961 9439'), '0939619439');
    assert.equal(normalizarCelular('593939619439'), '0939619439');
});

test('normalizarCelular rechaza lo que no es un móvil ecuatoriano', () => {
    for (const malo of ['', '123', '0239619439', '09396194', '093961943900', 'abcdefghij', null, undefined, 939619439, '+57 300 1234567']) {
        assert.equal(normalizarCelular(malo), null, `debería rechazar ${String(malo)}`);
    }
});

test('celularEditablePerfil no hace nada si el celular no llegó', () => {
    assert.deepEqual(celularEditablePerfil({}), {});
    assert.deepEqual(celularEditablePerfil(undefined), {});
});

test('celularEditablePerfil devuelve el celular normalizado', () => {
    assert.deepEqual(celularEditablePerfil({ celular: '+593 99 123 4567' }), { datos: { celular: '0991234567' } });
});

test('celularEditablePerfil devuelve un mensaje claro si es inválido', () => {
    const r = celularEditablePerfil({ celular: '12345' });
    assert.equal(r.datos, undefined);
    assert.match(r.error, /09/);
});

test('camposEditablesPerfil sigue sin copiar cédula, manzana ni villa', () => {
    const { camposEditablesPerfil } = require('../src/lib/perfilPublico');
    assert.deepEqual(camposEditablesPerfil({ cedula: '1', manzana: '1', villa: '1', celular: '0991234567' }), {});
});
