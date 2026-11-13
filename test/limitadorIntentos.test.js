const { test } = require('node:test');
const assert = require('node:assert/strict');
const { crearLimitador, mensajeDeBloqueo } = require('../src/lib/limitadorIntentos');

const MINUTO = 60 * 1000;

// Reloj falso: la prueba decide qué hora es, así no hay que esperar 15 minutos.
function crearReloj(inicio = 1_000_000) {
    let actual = inicio;
    return { ahora: () => actual, avanzar: (ms) => { actual += ms; } };
}

function limitadorDePrueba(reloj, maxIntentos = 3) {
    return crearLimitador({ maxIntentos, ventanaMs: 15 * MINUTO, ahora: reloj.ahora });
}

test('sin fallos no está bloqueado', () => {
    const limitador = limitadorDePrueba(crearReloj());
    assert.equal(limitador.consultar('ana@x.com').bloqueado, false);
});

test('bloquea al llegar al tope de fallos, no antes', () => {
    const limitador = limitadorDePrueba(crearReloj());
    limitador.registrarFallo('ana@x.com');
    limitador.registrarFallo('ana@x.com');
    assert.equal(limitador.consultar('ana@x.com').bloqueado, false);
    limitador.registrarFallo('ana@x.com');
    assert.equal(limitador.consultar('ana@x.com').bloqueado, true);
});

test('informa cuánto falta para desbloquear', () => {
    const reloj = crearReloj();
    const limitador = limitadorDePrueba(reloj, 1);
    limitador.registrarFallo('ana@x.com');
    reloj.avanzar(5 * MINUTO);
    assert.equal(limitador.consultar('ana@x.com').segundosRestantes, 10 * 60);
});

test('se libera al vencer la ventana', () => {
    const reloj = crearReloj();
    const limitador = limitadorDePrueba(reloj, 1);
    limitador.registrarFallo('ana@x.com');
    reloj.avanzar(15 * MINUTO - 1);
    assert.equal(limitador.consultar('ana@x.com').bloqueado, true);
    reloj.avanzar(1);
    assert.equal(limitador.consultar('ana@x.com').bloqueado, false);
});

test('un fallo después de vencida la ventana empieza una cuenta nueva', () => {
    const reloj = crearReloj();
    const limitador = limitadorDePrueba(reloj, 2);
    limitador.registrarFallo('ana@x.com');
    reloj.avanzar(16 * MINUTO);
    limitador.registrarFallo('ana@x.com');
    assert.equal(limitador.consultar('ana@x.com').bloqueado, false);
});

test('limpiar borra solo esa clave', () => {
    const limitador = limitadorDePrueba(crearReloj(), 1);
    limitador.registrarFallo('ana@x.com');
    limitador.registrarFallo('luis@x.com');
    limitador.limpiar('ana@x.com');
    assert.equal(limitador.consultar('ana@x.com').bloqueado, false);
    assert.equal(limitador.consultar('luis@x.com').bloqueado, true);
});

test('las claves son independientes', () => {
    const limitador = limitadorDePrueba(crearReloj(), 1);
    limitador.registrarFallo('ana@x.com');
    assert.equal(limitador.consultar('luis@x.com').bloqueado, false);
});

test('el mensaje redondea los minutos hacia arriba', () => {
    assert.match(mensajeDeBloqueo(61), /2 minutos/);
    assert.match(mensajeDeBloqueo(60), /1 minuto\./);
});
