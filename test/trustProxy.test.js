const { test } = require('node:test');
const assert = require('node:assert/strict');
const { saltosDeProxy } = require('../src/lib/trustProxy');

test('en local (sin variable y sin producción) no confía en ningún proxy', () => {
    assert.equal(saltosDeProxy({}), 0);
    assert.equal(saltosDeProxy({ NODE_ENV: 'development' }), 0);
});

test('en producción, sin variable, confía en 1 salto', () => {
    assert.equal(saltosDeProxy({ NODE_ENV: 'production' }), 1);
});

test('la variable manda sobre el valor por defecto', () => {
    assert.equal(saltosDeProxy({ NODE_ENV: 'production', TRUST_PROXY_SALTOS: '2' }), 2);
    assert.equal(saltosDeProxy({ NODE_ENV: 'production', TRUST_PROXY_SALTOS: '0' }), 0);
    assert.equal(saltosDeProxy({ TRUST_PROXY_SALTOS: ' 1 ' }), 1);
});

test('una variable vacía se trata como si no existiera', () => {
    assert.equal(saltosDeProxy({ NODE_ENV: 'production', TRUST_PROXY_SALTOS: '' }), 1);
});

test('rechaza "true" y otros valores que no son un entero de 0 a 10', () => {
    for (const valor of ['true', 'false', '-1', '1.5', 'uno', '11']) {
        assert.throws(() => saltosDeProxy({ TRUST_PROXY_SALTOS: valor }), /TRUST_PROXY_SALTOS/);
    }
});
