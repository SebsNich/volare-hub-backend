// Mapa único de carpetas de Cloudinary: así cada archivo se reconoce por la
// ruta y no hay textos de carpeta repartidos por los controladores.
// Fuera de producción la raíz es otra, para que las pruebas nunca se mezclen
// con los comprobantes reales.

const RAIZ_PRODUCCION = 'volare-hub'
const RAIZ_PRUEBAS = 'volare-hub-dev'

const RESERVA_TIPOS = ['comprobantes', 'documentos']
const PUBLICACION_TIPOS = { imagen: 'imagenes', documento: 'documentos' }
const ENVIO_MASIVO_TIPOS = { imagen: 'imagenes', documento: 'documentos' }
const PAGO_CONCEPTOS = { RESERVA: 'reservas', ALICUOTA: 'alicuotas' }

function carpetas(env = process.env) {
    const raiz = env.NODE_ENV === 'production' ? RAIZ_PRODUCCION : RAIZ_PRUEBAS
    return {
        perfil: () => `${raiz}/perfiles/fotos`,
        publicacion: (tipo) => {
            if (!PUBLICACION_TIPOS[tipo]) throw new Error(`Tipo de publicación desconocido: ${tipo}`)
            return `${raiz}/publicaciones/${PUBLICACION_TIPOS[tipo]}`
        },
        // Imágenes y documentos de los envíos masivos publicados como comunicado.
        envioMasivo: (tipo) => {
            if (!ENVIO_MASIVO_TIPOS[tipo]) throw new Error(`Tipo de archivo de envío masivo desconocido: ${tipo}`)
            return `${raiz}/envios-masivos/${ENVIO_MASIVO_TIPOS[tipo]}`
        },
        reserva: (espacio, tipo) => {
            if (!RESERVA_TIPOS.includes(tipo)) throw new Error(`Tipo de archivo de reserva desconocido: ${tipo}`)
            const grupo = espacio === 'CASA_CLUB' ? 'casa-club' : 'cabanas'
            return `${raiz}/reservas/${grupo}/${tipo}`
        },
        pago: (concepto) => {
            if (!PAGO_CONCEPTOS[concepto]) throw new Error(`Concepto de pago desconocido: ${concepto}`)
            return `${raiz}/pagos/${PAGO_CONCEPTOS[concepto]}/transferencias`
        }
    }
}

module.exports = { carpetas }
