const { test } = require('node:test');
const assert = require('node:assert/strict');

// Resend exige una clave al crearse; esta es falsa y nunca envía nada.
process.env.RESEND_API_KEY = 're_clave_falsa_de_prueba';
const { plantillaAvisoSeguridad } = require('../src/lib/resend');

test('el aviso de seguridad incluye el título, el nombre y el texto', () => {
    const html = plantillaAvisoSeguridad('Ana Pérez', 'Tu contraseña fue cambiada', 'Se cambió hace un momento.');
    assert.match(html, /Tu contraseña fue cambiada/);
    assert.match(html, /Ana Pérez/);
    assert.match(html, /Se cambió hace un momento/);
});

test('el aviso de seguridad escapa HTML para que un nombre no inyecte etiquetas', () => {
    const html = plantillaAvisoSeguridad('<script>x</script>', 'T', 'a & b');
    assert.doesNotMatch(html, /<script>/);
    assert.match(html, /&lt;script&gt;/);
    assert.match(html, /a &amp; b/);
});

test('el aviso de seguridad no lleva botones ni enlaces de acción', () => {
    const html = plantillaAvisoSeguridad('Ana', 'T', 'x');
    assert.doesNotMatch(html, /<a /);
});
