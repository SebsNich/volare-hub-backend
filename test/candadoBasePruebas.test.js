const { test } = require('node:test');
const assert = require('node:assert/strict');
const { verificarBaseDePruebas } = require('./helpers/candadoBasePruebas');

test('acepta una base local cuyo nombre termina en _test', () => {
    assert.doesNotThrow(() => verificarBaseDePruebas('postgresql://u:p@localhost:5432/volare_test'));
    assert.doesNotThrow(() => verificarBaseDePruebas('postgresql://u:p@127.0.0.1:5432/volare_test?schema=public'));
});

test('rechaza si falta la variable', () => {
    assert.throws(() => verificarBaseDePruebas(undefined), /DATABASE_URL/);
});

test('rechaza una base remota aunque se llame _test', () => {
    assert.throws(() => verificarBaseDePruebas('postgresql://u:p@db.ejemplo.supabase.co:5432/volare_test'), /local/);
});

test('rechaza la base de desarrollo y cualquier otra que no termine en _test', () => {
    assert.throws(() => verificarBaseDePruebas('postgresql://u:p@localhost:5432/volare_dev'), /_test/);
    assert.throws(() => verificarBaseDePruebas('postgresql://u:p@localhost:5432/postgres'), /_test/);
});

test('el mensaje de error no muestra la contraseña', () => {
    try {
        verificarBaseDePruebas('postgresql://u:secreta@remoto.com:5432/x');
        assert.fail('debía lanzar');
    } catch (error) {
        assert.equal(error.message.includes('secreta'), false);
    }
});
