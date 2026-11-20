// Sustituto de Cloudinary SOLO para desarrollo: guarda los archivos en una
// carpeta del proyecto (uploads-dev/, ignorada por git) y devuelve una URL con
// la misma forma que Cloudinary. Permite probar subidas sin cuenta ni red.
// Nunca se usa en producción (ver lib/cloudinary.js).
const fs = require('node:fs')
const path = require('node:path')

const PREFIJO_URL = '/uploads-dev/'

// Se quedan solo letras, números, punto, guion y guion bajo del último tramo del nombre.
function nombreSeguro(nombre) {
    const ultimo = String(nombre || 'archivo').split(/[\\/]/).pop()
    return ultimo.replace(/[^\w.\-]/g, '_') || 'archivo'
}

// Quita ".." y separadores raros de cada tramo de la carpeta.
function carpetaSegura(carpeta) {
    return String(carpeta || '').split(/[\\/]/).filter(t => t && t !== '.' && t !== '..').map(t => t.replace(/[^\w.\-]/g, '_')).join('/')
}

function crearAlmacenamientoLocal({ raiz, urlBase, ahora = Date.now }) {
    async function subir(buffer, carpeta, _tipo, nombreOriginal) {
        const relativa = carpetaSegura(carpeta)
        const archivo = `${ahora()}-${nombreSeguro(nombreOriginal)}`
        const directorio = path.join(raiz, relativa)
        await fs.promises.mkdir(directorio, { recursive: true })
        await fs.promises.writeFile(path.join(directorio, archivo), buffer)
        return { secure_url: `${urlBase}${PREFIJO_URL}${relativa ? relativa + '/' : ''}${archivo}` }
    }

    async function eliminar(url) {
        if (typeof url !== 'string' || !url.includes(PREFIJO_URL)) return false
        const relativa = url.split(PREFIJO_URL)[1]
        const destino = path.resolve(raiz, relativa)
        // Defensa contra rutas con ../: el destino debe seguir colgando de la raíz.
        if (!destino.startsWith(path.resolve(raiz) + path.sep)) return false
        try { await fs.promises.unlink(destino); return true } catch { return false }
    }

    return { subir, eliminar, raiz }
}

module.exports = { crearAlmacenamientoLocal, nombreSeguro, PREFIJO_URL }
