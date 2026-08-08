const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
dotenv.config();

const authRoutes = require('./routes/auth.routes');
const postsRoutes = require('./routes/posts.routes');
const suggestionsRoutes = require('./routes/buzon.routes')
const userRoutes = require('./routes/usuarios.routes')
const adminRoutes = require('./routes/admin.routes')
const reservasRoutes = require('./routes/reservas.routes')
const contactoRoutes = require('./routes/contacto.routes')
const sistemaRoutes = require('./routes/sistema.routes')

const app = express();

const origenesPermitidos = [
    'http://localhost:5173',
    'https://volare-hub-frontend-theta.vercel.app',
    'https://urbvolare.com',
    'https://www.urbvolare.com'
]

app.use(cors({
    origin: function (origin, callback) {
        if (!origin || origenesPermitidos.includes(origin)) {
            callback(null, true)
        } else {
            callback(new Error('No permitido por CORS'))
        }
    },
    credentials: true
}))
app.use(express.json());
app.use('/api/auth', authRoutes)
app.use('/api/posts', postsRoutes)
app.use('/api/buzon', suggestionsRoutes)
app.use('/api/usuarios', userRoutes)
app.use('/api/admin', adminRoutes)
app.use('/api/reservas', reservasRoutes)
app.use('/api/contacto', contactoRoutes)
app.use('/api/sistema', sistemaRoutes)

app.get('/', (req, res) => {
    res.json({ mensaje: 'Bienvenido a la API de Volare Hub' });
});

app.use((err, req, res, next) => {
    console.error('Error no manejado:', err);
    res.status(400).json({ error: err.message || 'Error al procesar la solicitud' });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Servidor corriendo en el puerto ${PORT}`);
});