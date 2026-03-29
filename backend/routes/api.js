const express = require('express');
const router = express.Router();

// Ruta de ejemplo para probar la conexión desde la app móvil o web
router.get('/estado', (req, res) => {
    res.json({
        ok: true,
        message: 'API funcionando correctamente.',
        timestamp: new Date()
    });
});

// Aquí agregaremos luego más rutas (por ejemplo: /facturas, /inventario, /clientes)
// router.get('/inventario', inventarioController.obtenerTodos);

module.exports = router;
