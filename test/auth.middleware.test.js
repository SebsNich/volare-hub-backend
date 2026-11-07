process.env.JWT_SECRET = 'secreto-de-prueba-no-usar-en-produccion';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const jwt = require('jsonwebtoken');
const { verificarToken } = require('../src/middleware/auth.middleware');

function crearResMock() {
    return {
        statusCode: null,
        body: null,
        status(codigo) { this.statusCode = codigo; return this; },
        json(payload) { this.body = payload; return this; }
    };
}

function crearNextMock() {
    const estado = { llamado: false };
    const next = () => { estado.llamado = true; };
    return { next, estado };
}

test('responde 401 si no hay header de autorización', () => {
    const req = { headers: {} };
    const res = crearResMock();
    const { next, estado } = crearNextMock();

    verificarToken(req, res, next);

    assert.equal(res.statusCode, 401);
    assert.equal(estado.llamado, false);
});

test('responde 401 si el header no empieza con "Bearer "', () => {
    const req = { headers: { authorization: 'Token abc123' } };
    const res = crearResMock();
    const { next, estado } = crearNextMock();

    verificarToken(req, res, next);

    assert.equal(res.statusCode, 401);
    assert.equal(estado.llamado, false);
});

test('responde 401 si el token es inválido', () => {
    const req = { headers: { authorization: 'Bearer esto-no-es-un-token-valido' } };
    const res = crearResMock();
    const { next, estado } = crearNextMock();

    verificarToken(req, res, next);

    assert.equal(res.statusCode, 401);
    assert.equal(estado.llamado, false);
});

test('responde 401 si el token expiró', () => {
    const tokenExpirado = jwt.sign({ id: 'user-1', rol: 'RESIDENTE' }, process.env.JWT_SECRET, { expiresIn: -10 });
    const req = { headers: { authorization: `Bearer ${tokenExpirado}` } };
    const res = crearResMock();
    const { next, estado } = crearNextMock();

    verificarToken(req, res, next);

    assert.equal(res.statusCode, 401);
    assert.equal(estado.llamado, false);
});

test('llama a next() y llena req.user si el token es válido', () => {
    const token = jwt.sign({ id: 'user-1', rol: 'RESIDENTE' }, process.env.JWT_SECRET, { expiresIn: '1h' });
    const req = { headers: { authorization: `Bearer ${token}` } };
    const res = crearResMock();
    const { next, estado } = crearNextMock();

    verificarToken(req, res, next);

    assert.equal(estado.llamado, true);
    assert.equal(res.statusCode, null);
    assert.equal(req.user.id, 'user-1');
    assert.equal(req.user.rol, 'RESIDENTE');
});
