const { test } = require('node:test');
const assert = require('node:assert/strict');
const { aPostPublico, puedeEntrarAlCarrusel, calcularCambiosAlEditar } = require('../src/lib/landing.helpers');

const postBase = {
    id: 'post-1',
    titulo: 'Bazar comunitario',
    descripcion: 'Este sábado en el parque central',
    tipo: 'AVISO',
    imagenUrl: ['https://cloudinary.test/foto1.jpg', 'https://cloudinary.test/foto2.jpg'],
    archivoUrl: ['https://cloudinary.test/reglamento.pdf'],
    estado: 'ACTIVO',
    creadoEn: new Date('2026-01-01'),
    autorId: 'user-1',
    autor: { nombres: 'Ana', apellidos: 'Pérez', foto: null },
    publico: true,
    enCarrusel: false,
    publicadoPorId: 'user-admin',
    publicadoEn: new Date('2026-01-02')
};

test('aPostPublico expone solo los campos permitidos', () => {
    const resultado = aPostPublico(postBase);
    assert.deepEqual(Object.keys(resultado).sort(), ['creadoEn', 'descripcion', 'id', 'imagenUrl', 'titulo', 'tipo'].sort());
});

test('aPostPublico nunca incluye datos del autor ni archivos adjuntos', () => {
    const resultado = aPostPublico(postBase);
    assert.equal('autor' in resultado, false);
    assert.equal('autorId' in resultado, false);
    assert.equal('archivoUrl' in resultado, false);
    assert.equal('publicadoPorId' in resultado, false);
});

test('aPostPublico usa la primera imagen del arreglo', () => {
    const resultado = aPostPublico(postBase);
    assert.equal(resultado.imagenUrl, 'https://cloudinary.test/foto1.jpg');
});

test('aPostPublico devuelve imagenUrl null si el post no tiene imágenes', () => {
    const resultado = aPostPublico({ ...postBase, imagenUrl: [] });
    assert.equal(resultado.imagenUrl, null);
});

test('puedeEntrarAlCarrusel es true con post público, activo y con imagen', () => {
    assert.equal(puedeEntrarAlCarrusel(postBase), true);
});

test('puedeEntrarAlCarrusel es false si el post no es público', () => {
    assert.equal(puedeEntrarAlCarrusel({ ...postBase, publico: false }), false);
});

test('puedeEntrarAlCarrusel es false si no tiene imágenes', () => {
    assert.equal(puedeEntrarAlCarrusel({ ...postBase, imagenUrl: [] }), false);
});

test('puedeEntrarAlCarrusel es false si el post está inactivo', () => {
    assert.equal(puedeEntrarAlCarrusel({ ...postBase, estado: 'INACTIVO' }), false);
});

test('calcularCambiosAlEditar baja a privado si edita un no-admin y el post era público', () => {
    const cambios = calcularCambiosAlEditar(postBase, { id: 'user-1', rol: 'RESIDENTE' });
    assert.deepEqual(cambios, { publico: false, enCarrusel: false, publicadoPorId: null, publicadoEn: null });
});

test('calcularCambiosAlEditar no cambia nada si edita un ADMIN', () => {
    const cambios = calcularCambiosAlEditar(postBase, { id: 'user-admin', rol: 'ADMIN' });
    assert.deepEqual(cambios, {});
});

test('calcularCambiosAlEditar no cambia nada si el post ya era privado', () => {
    const cambios = calcularCambiosAlEditar({ ...postBase, publico: false }, { id: 'user-1', rol: 'RESIDENTE' });
    assert.deepEqual(cambios, {});
});
