// Limpieza del mensaje del correo. El administrador escribe con un editor
// (negrita, listas, enlaces, imágenes) y el navegador manda HTML: antes de
// enviarlo se deja SOLO lo permitido, sin scripts ni atributos peligrosos.
// Sin base de datos ni red, para probarlo con textos de ejemplo.

const ETIQUETAS_SIMPLES = {
    p: 'margin: 0 0 12px;',
    div: 'margin: 0 0 12px;',
    b: '', strong: '', i: '', em: '', u: '', s: '', span: '',
    h1: 'color: #1A75BB; font-size: 20px; margin: 16px 0 8px;',
    h2: 'color: #1A75BB; font-size: 17px; margin: 16px 0 8px;',
    h3: 'font-size: 15px; margin: 12px 0 6px;',
    ul: 'margin: 0 0 12px; padding-left: 22px;',
    ol: 'margin: 0 0 12px; padding-left: 22px;',
    li: 'margin: 0 0 4px;',
    blockquote: 'margin: 0 0 12px; padding-left: 12px; border-left: 3px solid #cccccc; color: #555555;'
}
const SIN_CIERRE = new Set(['br'])
const BLOQUES_PELIGROSOS = /<(script|style|iframe|object|embed|svg|math|head|title)\b[\s\S]*?<\/\1\s*>/gi
const ETIQUETA = /<(\/?)([a-zA-Z][a-zA-Z0-9]*)((?:\s+[^\s"'<>\/=]+(?:\s*=\s*(?:"[^"]*"|'[^']*'|[^\s"'<>]+))?)*)\s*\/?>/g
const ATRIBUTO = /([^\s"'<>\/=]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'<>]+)))?/g
const IMAGEN_EN_LINEA = /^data:image\/(png|jpe?g|gif|webp);base64,([A-Za-z0-9+/=]+)$/i

const escaparAtributo = (t) => String(t).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]))
const desescapar = (t) => String(t).replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&')

function leerAtributos(texto) {
    const atributos = {}
    for (const m of texto.matchAll(ATRIBUTO)) atributos[m[1].toLowerCase()] = desescapar(m[2] ?? m[3] ?? m[4] ?? '')
    return atributos
}

// Solo http, https y mailto: "javascript:" y similares se descartan.
function enlaceSeguro(href) {
    const limpio = String(href ?? '').trim()
    return /^(https?:\/\/|mailto:)[^\s]+$/i.test(limpio) ? limpio : null
}

// Devuelve { html, imagenes }: el HTML limpio, con cada imagen pegada en el
// texto reemplazada por "cid:imagen-N", y las imágenes aparte para adjuntarlas
// "en línea" (así se ven aunque el programa de correo bloquee imágenes externas).
function limpiarHtmlCorreo(entrada) {
    const imagenes = []
    const abiertas = []
    let origen = String(entrada ?? '').replace(/<!--[\s\S]*?-->/g, '').replace(BLOQUES_PELIGROSOS, '')
    let salida = ''
    let cursor = 0

    const texto = (t) => t.replace(/</g, '&lt;').replace(/>/g, '&gt;')

    for (const m of origen.matchAll(ETIQUETA)) {
        salida += texto(origen.slice(cursor, m.index))
        cursor = m.index + m[0].length
        const [, cierre, nombreOriginal, atributosTexto] = m
        const nombre = nombreOriginal.toLowerCase()

        if (cierre) {
            // Solo se cierra lo que se abrió, para no producir HTML mal formado.
            const posicion = abiertas.lastIndexOf(nombre)
            if (posicion !== -1) {
                while (abiertas.length > posicion) salida += `</${abiertas.pop()}>`
            }
            continue
        }
        if (nombre === 'br') { salida += '<br>'; continue }
        if (nombre === 'a') {
            const href = enlaceSeguro(leerAtributos(atributosTexto).href)
            if (!href) continue
            abiertas.push('a')
            salida += `<a href="${escaparAtributo(href)}" target="_blank" rel="noopener noreferrer" style="color: #1A75BB;">`
            continue
        }
        if (nombre === 'img') {
            const { src = '', alt = '' } = leerAtributos(atributosTexto)
            const enLinea = IMAGEN_EN_LINEA.exec(src.trim())
            let destino = null
            if (enLinea) {
                const numero = imagenes.length + 1
                const tipo = enLinea[1].toLowerCase().replace('jpg', 'jpeg')
                imagenes.push({ contentId: `imagen-${numero}`, filename: `imagen-${numero}.${tipo === 'jpeg' ? 'jpg' : tipo}`, mimetype: `image/${tipo}`, buffer: Buffer.from(enLinea[2], 'base64') })
                destino = `cid:imagen-${numero}`
            } else if (/^https:\/\/[^\s]+$/i.test(src.trim())) {
                destino = src.trim()
            }
            if (destino) salida += `<img src="${escaparAtributo(destino)}" alt="${escaparAtributo(alt)}" style="max-width: 100%; height: auto; display: block; margin: 8px 0;">`
            continue
        }
        if (Object.hasOwn(ETIQUETAS_SIMPLES, nombre)) {
            abiertas.push(nombre)
            const estilo = ETIQUETAS_SIMPLES[nombre]
            salida += estilo ? `<${nombre} style="${estilo}">` : `<${nombre}>`
        }
        // Cualquier otra etiqueta se descarta (su texto interior se conserva).
    }
    salida += texto(origen.slice(cursor))
    while (abiertas.length) salida += `</${abiertas.pop()}>`
    return { html: salida, imagenes }
}

// Texto plano del mensaje: sirve para saber si está vacío y para el comunicado,
// que se publica como texto simple (las imágenes y archivos van como adjuntos).
function htmlATexto(html) {
    const sinEtiquetas = String(html ?? '')
        .replace(BLOQUES_PELIGROSOS, '')
        .replace(/<a\b[^>]*href\s*=\s*"([^"]*)"[^>]*>([\s\S]*?)<\/a>/gi, (_, href, interior) => {
            const visible = interior.replace(/<[^>]*>/g, '').trim()
            const url = desescapar(href)
            return visible && visible !== url ? `${visible} (${url})` : url
        })
        .replace(/<li\b[^>]*>/gi, '• ')
        .replace(/<br\s*\/?>|<\/(p|div|li|h[1-6]|blockquote)>/gi, '\n')
        .replace(/<[^>]*>/g, '')
    return desescapar(sinEtiquetas.replace(/&nbsp;/g, ' '))
        .replace(/[ \t]+\n/g, '\n').replace(/\n{3,}/g, '\n\n').trim()
}

module.exports = { limpiarHtmlCorreo, htmlATexto }
