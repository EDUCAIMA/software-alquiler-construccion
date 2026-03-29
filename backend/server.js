require('dotenv').config();
const express = require('express');
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 5001;

// Configuración de Middlewares
app.use(cors()); // Permite peticiones desde otros orígenes (como tu web o tu app móvil)
app.use(express.json()); // Permite a la API recibir datos en formato JSON

// Archivo de rutas
const apiRoutes = require('./routes/api');

// Ruta principal para verificar que el servidor está online
app.get('/', (req, res) => {
    res.json({ message: 'Bienvenido a la API REST de Cielo Constructores' });
});

// Usar las rutas centralizadas
app.use('/api', apiRoutes);

// Iniciar servidor
app.listen(PORT, () => {
    console.log(`Servidor corriendo en el puerto ${PORT}`);
    console.log(`En entorno de: ${process.env.NODE_ENV}`);
});
