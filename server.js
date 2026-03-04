import express from 'express';
import cors from 'cors';
import { Pool } from 'pg';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Configuración Base de Datos Postgres (con SSL para Railway)
const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

// Inicialización de las Tablas (Migración Automática)
async function initDB() {
    try {
        const client = await pool.connect();

        // Tabla Productos (Inventario)
        await client.query(`
      CREATE TABLE IF NOT EXISTS products (
        id VARCHAR(50) PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        category VARCHAR(100),
        value NUMERIC(12, 2) NOT NULL,
        total_stock INTEGER NOT NULL,
        available_stock INTEGER NOT NULL,
        image TEXT,
        proveedor VARCHAR(255),
        fecha_compra DATE,
        costo_adquisicion NUMERIC(12, 2),
        proximo_mantenimiento DATE
      )
    `);

        // Add dummy data if table is empty
        const { rows } = await client.query('SELECT COUNT(*) FROM products');
        if (parseInt(rows[0].count) === 0) {
            console.log('Inserting default products...');
            await client.query(`
        INSERT INTO products (id, name, total_stock, available_stock, category, value, image)
        VALUES 
        ('P-101', 'Excavadora Cat 320', 3, 2, 'Heavy Machinery', 350000, 'https://images.unsplash.com/photo-1541888087405-c8108c48a8f1?auto=format&fit=crop&q=80&w=150'),
        ('P-102', 'Martillo Demoledor Bosch', 5, 5, 'Power Tools', 45000, 'https://images.unsplash.com/photo-1504148455328-c376907d081c?auto=format&fit=crop&q=80&w=150'),
        ('P-103', 'Planta Eléctrica 10kW', 2, 2, 'Equipment', 85000, 'https://images.unsplash.com/photo-1580983546051-7649d214a1e9?auto=format&fit=crop&q=80&w=150'),
        ('P-104', 'Andamio Tubular', 100, 60, 'Structures', 15000, 'https://images.unsplash.com/photo-1533038676239-502a507fa733?auto=format&fit=crop&q=80&w=150'),
        ('P-105', 'Mezcladora de Concreto 1 Bulto', 4, 3, 'Machinery', 65000, 'https://images.unsplash.com/photo-1589939705384-5185137a7f0f?auto=format&fit=crop&q=80&w=150')
      `);
        }

        // Tabla Clientes 
        await client.query(`
      CREATE TABLE IF NOT EXISTS clients (
        id VARCHAR(50) PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        tipo_persona VARCHAR(50),
        nit VARCHAR(50),
        regimen VARCHAR(50),
        responsable_iva BOOLEAN,
        porc_iva NUMERIC(5, 2),
        porc_retencion NUMERIC(5, 2),
        email VARCHAR(255),
        phone VARCHAR(50),
        direccion VARCHAR(255),
        ciudad VARCHAR(100),
        departamento VARCHAR(100),
        contacto_principal VARCHAR(255),
        joined DATE,
        debt NUMERIC(12, 2) DEFAULT 0
      )
    `);

        // Tabla Obras
        await client.query(`
      CREATE TABLE IF NOT EXISTS obras (
        id VARCHAR(50) PRIMARY KEY,
        client_id VARCHAR(50) REFERENCES clients(id) ON DELETE CASCADE,
        nombre VARCHAR(255) NOT NULL,
        ubicacion VARCHAR(255),
        estado VARCHAR(50),
        presupuesto NUMERIC(15, 2),
        fecha_inicio DATE,
        descripcion TEXT
      )
    `);

        client.release();
        console.log('Database initialized successfully.');
    } catch (err) {
        if (process.env.DATABASE_URL) {
            console.error('Error initializing database:', err);
        } else {
            console.log('No DATABASE_URL provided. Skipping DB init.');
        }
    }
}

initDB();

// --- 🔸 API ENDPOINTS 🔸 ---

// GET Products
app.get('/api/products', async (req, res) => {
    try {
        const { rows } = await pool.query('SELECT * FROM products ORDER BY id ASC');
        // Map snake_case postgres columns to camelCase React properties
        const products = rows.map(r => ({
            id: r.id,
            name: r.name,
            category: r.category,
            value: Number(r.value),
            totalStock: r.total_stock,
            availableStock: r.available_stock,
            image: r.image,
            proveedor: r.proveedor,
            fechaCompra: r.fecha_compra ? r.fecha_compra.toISOString().split('T')[0] : '',
            costoAdquisicion: r.costo_adquisicion ? Number(r.costo_adquisicion) : '',
            proximoMantenimiento: r.proximo_mantenimiento ? r.proximo_mantenimiento.toISOString().split('T')[0] : ''
        }));
        res.json(products);
    } catch (error) {
        console.error('API /api/products GET Error:', error);
        res.status(500).json({ error: 'Internal Server Error' });
    }
});

// POST Products
app.post('/api/products', async (req, res) => {
    try {
        const { id, name, category, value, totalStock, availableStock, image, proveedor, fechaCompra, costoAdquisicion, proximoMantenimiento } = req.body;

        await pool.query(
            `INSERT INTO products (id, name, category, value, total_stock, available_stock, image, proveedor, fecha_compra, costo_adquisicion, proximo_mantenimiento)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`,
            [
                id, name, category, value, totalStock, availableStock, image, proveedor,
                fechaCompra || null, costoAdquisicion || null, proximoMantenimiento || null
            ]
        );

        res.json({ success: true, message: 'Producto Creado' });
    } catch (error) {
        console.error('API /api/products POST Error:', error);
        res.status(500).json({ error: 'Internal Server Error' });
    }
});

// PUT Products
app.put('/api/products/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const { name, category, value, totalStock, availableStock, image, proveedor, fechaCompra, costoAdquisicion, proximoMantenimiento } = req.body;

        await pool.query(
            `UPDATE products SET 
        name=$1, category=$2, value=$3, total_stock=$4, available_stock=$5, image=$6, 
        proveedor=$7, fecha_compra=$8, costo_adquisicion=$9, proximo_mantenimiento=$10 
       WHERE id=$11`,
            [
                name, category, value, totalStock, availableStock, image, proveedor,
                fechaCompra || null, costoAdquisicion || null, proximoMantenimiento || null, id
            ]
        );

        res.json({ success: true, message: 'Producto Actualizado' });
    } catch (error) {
        console.error('API /api/products PUT Error:', error);
        res.status(500).json({ error: 'Internal Server Error' });
    }
});


// ─── Serve React Static Files in Production ─────────────────────────────
if (process.env.NODE_ENV === 'production' || process.env.RAILWAY_ENVIRONMENT) {
    app.use(express.static(path.join(__dirname, 'dist')));

    // Fallback for Single Page Application
    app.use((req, res, next) => {
        if (req.method === 'GET' && !req.path.startsWith('/api')) {
            res.sendFile(path.join(__dirname, 'dist', 'index.html'));
        } else {
            next();
        }
    });
}

// ─── Start Server ────────────────────────────────────────────────────────
app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});
