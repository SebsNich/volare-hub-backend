const { test } = require('node:test');
const assert = require('node:assert/strict');
const { SELECCION_PERFIL_PUBLICO, SELECCION_BUSCADOR, camposEditablesPerfil } = require('../src/lib/perfilPublico');

test('el buscador devuelve nombre, foto, manzana y villa de cada resultado', () => {
    for (const campo of ['id', 'nombres', 'apellidos', 'foto', 'manzana', 'villa']) {
        assert.equal(SELECCION_BUSCADOR[campo], true, `falta ${campo}`);
    }
});

test('el buscador no expone rol, cédula, correo, celular ni bio', () => {
    for (const campo of ['rol', 'cedula', 'email', 'celular', 'password', 'bio']) {
        assert.equal(SELECCION_BUSCADOR[campo], undefined, `no debería incluir ${campo}`);
    }
});

test('el buscador conserva activo y estadoCuenta para la etiqueta del admin', () => {
    assert.equal(SELECCION_BUSCADOR.activo, true);
    assert.equal(SELECCION_BUSCADOR.estadoCuenta, true);
});

test('el perfil público incluye nombre, foto, manzana y villa', () => {
    for (const campo of ['nombres', 'apellidos', 'foto', 'manzana', 'villa']) {
        assert.equal(SELECCION_PERFIL_PUBLICO[campo], true, `falta ${campo}`);
    }
});

test('el perfil público no expone rol ni datos privados del vecino', () => {
    for (const campo of ['rol', 'cedula', 'email', 'celular', 'password', 'estadoCuenta', 'activo']) {
        assert.equal(SELECCION_PERFIL_PUBLICO[campo], undefined, `no debería incluir ${campo}`);
    }
});

test('editar perfil solo toma nombres, apellidos y bio', () => {
    const body = { nombres: 'Ana', apellidos: 'Pérez', bio: 'Hola' };
    assert.deepEqual(camposEditablesPerfil(body), body);
});

test('editar perfil ignora rol, manzana, villa y estado aunque lleguen en el body', () => {
    const body = {
        nombres: 'Ana',
        rol: 'ADMIN',
        manzana: '99',
        villa: '99',
        estadoCuenta: 'APROBADA',
        activo: 'true'
    };
    assert.deepEqual(camposEditablesPerfil(body), { nombres: 'Ana' });
});

test('editar perfil no inventa campos que no llegaron', () => {
    assert.deepEqual(camposEditablesPerfil({}), {});
    assert.deepEqual(camposEditablesPerfil(undefined), {});
});
