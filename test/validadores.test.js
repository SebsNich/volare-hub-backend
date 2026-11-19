const { test } = require('node:test');
const assert = require('node:assert/strict');
const { esEmailValido, LARGO_MAX_EMAIL } = require('../src/lib/validadores');

// RF-20: formato del correo en el registro y en el cambio de correo.
test('acepta correos con usuario, arroba y dominio con punto', () => {
    for (const correo of ['ana@ejemplo.com', 'ana.perez+volare@correo.com.ec', '  Ana@Ejemplo.COM  ']) {
        assert.equal(esEmailValido(correo), true, correo);
    }
});

test('rechaza correos sin arroba, sin dominio, con espacios o con dos arrobas', () => {
    for (const correo of ['ana', 'ana@', '@ejemplo.com', 'ana@ejemplo', 'ana perez@ejemplo.com', 'ana@@ejemplo.com', 'ana@ejemplo .com']) {
        assert.equal(esEmailValido(correo), false, correo);
    }
});

test('rechaza lo que no es texto o está vacío', () => {
    for (const valor of [undefined, null, '', '   ', 123, {}, ['a@b.co']]) {
        assert.equal(esEmailValido(valor), false, String(valor));
    }
});

test(`rechaza correos de más de ${LARGO_MAX_EMAIL} caracteres`, () => {
    const largo = `${'a'.repeat(LARGO_MAX_EMAIL)}@ejemplo.com`;
    assert.equal(esEmailValido(largo), false);
});
