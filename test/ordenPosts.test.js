const { test } = require('node:test');
const assert = require('node:assert/strict');
const { ORDEN_FEED, ORDEN_PERFIL } = require('../src/lib/ordenPosts');

// Con fechas iguales, sin un último criterio único el orden cambia al recargar.
test('el feed termina desempatando por id', () => {
    assert.deepEqual(ORDEN_FEED, [{ anclado: 'desc' }, { creadoEn: 'desc' }, { id: 'desc' }]);
});

test('los posts del perfil terminan desempatando por id', () => {
    assert.deepEqual(ORDEN_PERFIL, [{ ancladoPerfil: 'desc' }, { creadoEn: 'desc' }, { id: 'desc' }]);
});
