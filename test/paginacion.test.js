const { test } = require('node:test');
const assert = require('node:assert/strict');
const { obtenerParametrosPaginacion } = require('../src/lib/paginacion');

test('usa página 1 y tamaño por defecto cuando no se pide nada', () => {
    const resultado = obtenerParametrosPaginacion({});
    assert.equal(resultado.pagina, 1);
    assert.equal(resultado.tamanoPagina, 10);
    assert.equal(resultado.skip, 0);
    assert.equal(resultado.take, 10);
});

test('respeta un tamanoPagina válido dentro del máximo', () => {
    const resultado = obtenerParametrosPaginacion({ pagina: 2, tamanoPagina: 20 });
    assert.equal(resultado.pagina, 2);
    assert.equal(resultado.tamanoPagina, 20);
    assert.equal(resultado.skip, 20);
    assert.equal(resultado.take, 20);
});

test('limita tamanoPagina al máximo permitido (50) si se pide más', () => {
    const resultado = obtenerParametrosPaginacion({ tamanoPagina: 999999 });
    assert.equal(resultado.tamanoPagina, 50);
    assert.equal(resultado.take, 50);
});

test('ignora tamanoPagina no numérico o negativo y usa el valor por defecto', () => {
    assert.equal(obtenerParametrosPaginacion({ tamanoPagina: 'abc' }).tamanoPagina, 10);
    assert.equal(obtenerParametrosPaginacion({ tamanoPagina: -5 }).tamanoPagina, 10);
    assert.equal(obtenerParametrosPaginacion({ tamanoPagina: 0 }).tamanoPagina, 10);
});

test('ignora pagina no numérica o negativa y usa la página 1', () => {
    assert.equal(obtenerParametrosPaginacion({ pagina: 'abc' }).pagina, 1);
    assert.equal(obtenerParametrosPaginacion({ pagina: -1 }).pagina, 1);
});
