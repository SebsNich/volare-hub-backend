const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
dotenv.config();

const authRoutes = require('./routes/auth.routes');
const postsRoutes = require('./routes/posts.routes');
const suggestionsRoutes = require('./routes/buzon.routes')

const app = express();

app.use(cors());
app.use(express.json());
app.use('/api/auth', authRoutes)
app.use('/api/posts', postsRoutes)
app.use('/api/buzon', suggestionsRoutes)

app.get('/', (req, res) => {
    res.json({ mensaje: 'Bienvenido a la API de Volare Hub' });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Servidor corriendo en el puerto ${PORT}`);
});