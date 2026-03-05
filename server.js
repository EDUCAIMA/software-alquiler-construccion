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

app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// ─── Pool PostgreSQL ─────────────────────────────────────────────────────────
const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

// ─── Inicialización de Tablas ────────────────────────────────────────────────
async function initDB() {
    if (!process.env.DATABASE_URL) {
        console.log('⚠️  No DATABASE_URL encontrada. Configura tu archivo .env con la URL de Railway.');
        return;
    }
    const client = await pool.connect();
    try {
        // --- Productos ---
        await client.query(`
      CREATE TABLE IF NOT EXISTS products (
        id VARCHAR(50) PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        category VARCHAR(100),
        value NUMERIC(12,2) NOT NULL,
        total_stock INTEGER NOT NULL DEFAULT 1,
        available_stock INTEGER NOT NULL DEFAULT 1,
        image TEXT,
        proveedor VARCHAR(255),
        fecha_compra DATE,
        costo_adquisicion NUMERIC(12,2),
        proximo_mantenimiento DATE
      )
    `);

        // --- Clientes (obras guardadas como JSONB para mantener la estructura actual) ---
        await client.query(`
      CREATE TABLE IF NOT EXISTS clients (
        id VARCHAR(50) PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        tipo_persona VARCHAR(50),
        nit VARCHAR(50),
        regimen VARCHAR(50),
        responsable_iva BOOLEAN DEFAULT false,
        porc_iva NUMERIC(5,2) DEFAULT 0,
        porc_retencion NUMERIC(5,2) DEFAULT 0,
        email VARCHAR(255),
        phone VARCHAR(50),
        direccion VARCHAR(255),
        ciudad VARCHAR(100),
        departamento VARCHAR(100),
        contacto_principal VARCHAR(255),
        joined DATE DEFAULT CURRENT_DATE,
        debt NUMERIC(12,2) DEFAULT 0,
        obras JSONB DEFAULT '[]'
      )
    `);

        // --- Facturas ---
        await client.query(`
      CREATE TABLE IF NOT EXISTS invoices (
        id VARCHAR(50) PRIMARY KEY,
        client_id VARCHAR(50),
        obra_id VARCHAR(50),
        amount NUMERIC(15,2) DEFAULT 0,
        status VARCHAR(50) DEFAULT 'Pending',
        date DATE DEFAULT CURRENT_DATE,
        paid_date DATE,
        items JSONB DEFAULT '[]',
        cotizacion_id VARCHAR(50),
        remision_enabled BOOLEAN DEFAULT false,
        remision_creada BOOLEAN DEFAULT false
      )
    `);
        // Migración: agregar columnas si no existen (idempotente)
        await client.query(`ALTER TABLE invoices ADD COLUMN IF NOT EXISTS cotizacion_id VARCHAR(50)`);
        await client.query(`ALTER TABLE invoices ADD COLUMN IF NOT EXISTS remision_enabled BOOLEAN DEFAULT false`);
        await client.query(`ALTER TABLE invoices ADD COLUMN IF NOT EXISTS remision_creada BOOLEAN DEFAULT false`);

        // --- Cotizaciones ---
        await client.query(`
      CREATE TABLE IF NOT EXISTS cotizaciones (
        id VARCHAR(50) PRIMARY KEY,
        client_id VARCHAR(50),
        obra_id VARCHAR(50),
        fecha DATE DEFAULT CURRENT_DATE,
        validez_dias INTEGER DEFAULT 15,
        metodo_pago VARCHAR(100),
        responsable_transporte VARCHAR(100),
        plazo_entrega VARCHAR(100),
        transporte NUMERIC(12,2) DEFAULT 0,
        notas TEXT,
        estado VARCHAR(50) DEFAULT 'Borrador',
        items JSONB DEFAULT '[]',
        habeas_data BOOLEAN DEFAULT false,
        habeas_data_timestamp TIMESTAMPTZ,
        firma TEXT,
        foto TEXT
      )
    `);

        // --- Remisiones ---
        await client.query(`
      CREATE TABLE IF NOT EXISTS remisiones (
        id VARCHAR(50) PRIMARY KEY,
        client_id VARCHAR(50),
        obra_id VARCHAR(50),
        fecha DATE DEFAULT CURRENT_DATE,
        transporte NUMERIC(12,2) DEFAULT 0,
        estado VARCHAR(50) DEFAULT 'Activa',
        notas TEXT,
        items JSONB DEFAULT '[]'
      )
    `);

        // --- Mantenimientos ---
        await client.query(`
      CREATE TABLE IF NOT EXISTS maintenances (
        id VARCHAR(50) PRIMARY KEY,
        product_id VARCHAR(50),
        type VARCHAR(100),
        description TEXT,
        status VARCHAR(50) DEFAULT 'Pendiente',
        date DATE DEFAULT CURRENT_DATE,
        cost NUMERIC(12,2) DEFAULT 0
      )
    `);

        // --- Gastos ---
        await client.query(`
      CREATE TABLE IF NOT EXISTS gastos (
        id VARCHAR(50) PRIMARY KEY,
        fecha DATE DEFAULT CURRENT_DATE,
        concepto VARCHAR(255),
        proveedor VARCHAR(255),
        categoria VARCHAR(100),
        monto NUMERIC(12,2) DEFAULT 0,
        iva NUMERIC(12,2) DEFAULT 0,
        estado VARCHAR(50) DEFAULT 'Pendiente',
        notas TEXT
      )
    `);

        // --- Empleados ---
        await client.query(`
      CREATE TABLE IF NOT EXISTS empleados (
        id VARCHAR(50) PRIMARY KEY,
        nombre VARCHAR(255) NOT NULL,
        cargo VARCHAR(255),
        salario_dia NUMERIC(12,2) DEFAULT 0,
        tipo VARCHAR(50) DEFAULT 'Fijo',
        activo BOOLEAN DEFAULT true
      )
    `);

        // --- Liquidaciones ---
        await client.query(`
      CREATE TABLE IF NOT EXISTS liquidaciones (
        id VARCHAR(50) PRIMARY KEY,
        empleado_id VARCHAR(50),
        periodo VARCHAR(100),
        dias_trabajados INTEGER DEFAULT 0,
        horas_extra NUMERIC(6,2) DEFAULT 0,
        valor_hora_extra NUMERIC(12,2) DEFAULT 0,
        deduccion_salud NUMERIC(5,2) DEFAULT 4,
        deduccion_pension NUMERIC(5,2) DEFAULT 4,
        fondo_solidaridad NUMERIC(5,2) DEFAULT 0,
        bonificaciones NUMERIC(12,2) DEFAULT 0,
        estado VARCHAR(50) DEFAULT 'Pendiente'
      )
    `);

        // --- Seed inicial de products si está vacío ---
        const { rows: pRows } = await client.query('SELECT COUNT(*) FROM products');
        if (parseInt(pRows[0].count) === 0) {
            await client.query(`
        INSERT INTO products (id, name, total_stock, available_stock, category, value, image) VALUES
        ('P-101','Excavadora Cat 320',3,2,'Heavy Machinery',350000,'https://images.unsplash.com/photo-1541888087405-c8108c48a8f1?auto=format&fit=crop&q=80&w=150'),
        ('P-102','Martillo Demoledor Bosch',5,5,'Power Tools',45000,'https://images.unsplash.com/photo-1504148455328-c376907d081c?auto=format&fit=crop&q=80&w=150'),
        ('P-103','Planta Eléctrica 10kW',2,2,'Equipment',85000,'https://images.unsplash.com/photo-1580983546051-7649d214a1e9?auto=format&fit=crop&q=80&w=150'),
        ('P-104','Andamio Tubular',100,60,'Structures',15000,'https://images.unsplash.com/photo-1533038676239-502a507fa733?auto=format&fit=crop&q=80&w=150'),
        ('P-105','Mezcladora de Concreto 1 Bulto',4,3,'Machinery',65000,'https://images.unsplash.com/photo-1589939705384-5185137a7f0f?auto=format&fit=crop&q=80&w=150')
      `);
            console.log('✅ Productos de muestra insertados.');
        }

        console.log('✅ Base de datos inicializada correctamente.');
    } catch (err) {
        console.error('❌ Error inicializando la base de datos:', err.message);
    } finally {
        client.release();
    }
}

initDB();

// ─── HELPERS ─────────────────────────────────────────────────────────────────
const mapProduct = r => ({
    id: r.id, name: r.name, category: r.category, value: Number(r.value),
    totalStock: r.total_stock, availableStock: r.available_stock, image: r.image,
    proveedor: r.proveedor,
    fechaCompra: r.fecha_compra ? r.fecha_compra.toISOString().split('T')[0] : '',
    costoAdquisicion: r.costo_adquisicion ? Number(r.costo_adquisicion) : '',
    proximoMantenimiento: r.proximo_mantenimiento ? r.proximo_mantenimiento.toISOString().split('T')[0] : ''
});

const mapClient = r => ({
    id: r.id, name: r.name, tipoPersona: r.tipo_persona, nit: r.nit,
    regimen: r.regimen, responsableIVA: r.responsable_iva,
    porcIVA: Number(r.porc_iva), porcRetencion: Number(r.porc_retencion),
    email: r.email, phone: r.phone, direccion: r.direccion,
    ciudad: r.ciudad, departamento: r.departamento,
    contactoPrincipal: r.contacto_principal,
    joined: r.joined ? r.joined.toISOString().split('T')[0] : '',
    debt: Number(r.debt),
    obras: r.obras || []
});

const mapInvoice = r => ({
    id: r.id, clientId: r.client_id, obraId: r.obra_id,
    amount: Number(r.amount), status: r.status,
    date: r.date ? r.date.toISOString().split('T')[0] : '',
    paidDate: r.paid_date ? r.paid_date.toISOString().split('T')[0] : null,
    items: r.items || [],
    cotizacionId: r.cotizacion_id || null,
    remisionEnabled: r.remision_enabled || false,
    remisionCreada: r.remision_creada || false
});

const mapCot = r => ({
    id: r.id, clientId: r.client_id, obraId: r.obra_id,
    fecha: r.fecha ? r.fecha.toISOString().split('T')[0] : '',
    validezDias: r.validez_dias, metodoPago: r.metodo_pago,
    responsableTransporte: r.responsable_transporte, plazoEntrega: r.plazo_entrega,
    transporte: Number(r.transporte), notas: r.notas, estado: r.estado,
    items: r.items || [],
    habeasData: r.habeas_data, habeasDataTimestamp: r.habeas_data_timestamp,
    firma: r.firma, foto: r.foto
});

const mapRem = r => ({
    id: r.id, clientId: r.client_id, obraId: r.obra_id,
    fecha: r.fecha ? r.fecha.toISOString().split('T')[0] : '',
    transporte: Number(r.transporte), estado: r.estado,
    notas: r.notas, items: r.items || []
});

const mapMaint = r => ({
    id: r.id, productId: r.product_id, type: r.type,
    description: r.description, status: r.status,
    date: r.date ? r.date.toISOString().split('T')[0] : '',
    cost: Number(r.cost)
});

const mapGasto = r => ({
    id: r.id, fecha: r.fecha ? r.fecha.toISOString().split('T')[0] : '',
    concepto: r.concepto, proveedor: r.proveedor, categoria: r.categoria,
    monto: Number(r.monto), iva: Number(r.iva), estado: r.estado, notas: r.notas
});

const mapEmpleado = r => ({
    id: r.id, nombre: r.nombre, cargo: r.cargo,
    salarioDia: Number(r.salario_dia), tipo: r.tipo, activo: r.activo
});

const mapLiq = r => ({
    id: r.id, empleadoId: r.empleado_id, periodo: r.periodo,
    diasTrabajados: r.dias_trabajados, horasExtra: Number(r.horas_extra),
    valorHoraExtra: Number(r.valor_hora_extra),
    deduccionSalud: Number(r.deduccion_salud), deduccionPension: Number(r.deduccion_pension),
    fondoSolidaridad: Number(r.fondo_solidaridad), bonificaciones: Number(r.bonificaciones),
    estado: r.estado
});

// ─── PRODUCTS ────────────────────────────────────────────────────────────────
app.get('/api/products', async (req, res) => {
    try {
        const { rows } = await pool.query('SELECT * FROM products ORDER BY id ASC');
        res.json(rows.map(mapProduct));
    } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/products', async (req, res) => {
    try {
        const { id, name, category, value, totalStock, availableStock, image, proveedor, fechaCompra, costoAdquisicion, proximoMantenimiento } = req.body;
        await pool.query(
            `INSERT INTO products (id,name,category,value,total_stock,available_stock,image,proveedor,fecha_compra,costo_adquisicion,proximo_mantenimiento)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)`,
            [id, name, category, value, totalStock, availableStock, image, proveedor,
                fechaCompra || null, costoAdquisicion || null, proximoMantenimiento || null]
        );
        res.json({ success: true });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

app.put('/api/products/:id', async (req, res) => {
    try {
        const { name, category, value, totalStock, availableStock, image, proveedor, fechaCompra, costoAdquisicion, proximoMantenimiento } = req.body;
        await pool.query(
            `UPDATE products SET name=$1,category=$2,value=$3,total_stock=$4,available_stock=$5,image=$6,proveedor=$7,fecha_compra=$8,costo_adquisicion=$9,proximo_mantenimiento=$10 WHERE id=$11`,
            [name, category, value, totalStock, availableStock, image, proveedor,
                fechaCompra || null, costoAdquisicion || null, proximoMantenimiento || null, req.params.id]
        );
        res.json({ success: true });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

app.delete('/api/products/:id', async (req, res) => {
    try {
        await pool.query('DELETE FROM products WHERE id=$1', [req.params.id]);
        res.json({ success: true });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

// ─── CLIENTS ─────────────────────────────────────────────────────────────────
app.get('/api/clients', async (req, res) => {
    try {
        const { rows } = await pool.query('SELECT * FROM clients ORDER BY id ASC');
        res.json(rows.map(mapClient));
    } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/clients', async (req, res) => {
    try {
        const { id, name, tipoPersona, nit, regimen, responsableIVA, porcIVA, porcRetencion,
            email, phone, direccion, ciudad, departamento, contactoPrincipal, joined, debt, obras } = req.body;
        await pool.query(
            `INSERT INTO clients (id,name,tipo_persona,nit,regimen,responsable_iva,porc_iva,porc_retencion,email,phone,direccion,ciudad,departamento,contacto_principal,joined,debt,obras)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17)`,
            [id, name, tipoPersona, nit, regimen, responsableIVA, porcIVA, porcRetencion,
                email, phone, direccion, ciudad, departamento, contactoPrincipal, joined || null, debt || 0, JSON.stringify(obras || [])]
        );
        res.json({ success: true });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

app.put('/api/clients/:id', async (req, res) => {
    try {
        const { name, tipoPersona, nit, regimen, responsableIVA, porcIVA, porcRetencion,
            email, phone, direccion, ciudad, departamento, contactoPrincipal, joined, debt, obras } = req.body;
        await pool.query(
            `UPDATE clients SET name=$1,tipo_persona=$2,nit=$3,regimen=$4,responsable_iva=$5,porc_iva=$6,porc_retencion=$7,
       email=$8,phone=$9,direccion=$10,ciudad=$11,departamento=$12,contacto_principal=$13,joined=$14,debt=$15,obras=$16 WHERE id=$17`,
            [name, tipoPersona, nit, regimen, responsableIVA, porcIVA, porcRetencion,
                email, phone, direccion, ciudad, departamento, contactoPrincipal, joined || null, debt || 0, JSON.stringify(obras || []), req.params.id]
        );
        res.json({ success: true });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

app.delete('/api/clients/:id', async (req, res) => {
    try {
        await pool.query('DELETE FROM clients WHERE id=$1', [req.params.id]);
        res.json({ success: true });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

// ─── INVOICES ────────────────────────────────────────────────────────────────
app.get('/api/invoices', async (req, res) => {
    try {
        const { rows } = await pool.query('SELECT * FROM invoices ORDER BY id ASC');
        res.json(rows.map(mapInvoice));
    } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/invoices', async (req, res) => {
    try {
        const { id, clientId, obraId, amount, status, date, paidDate, items, cotizacionId, remisionEnabled, remisionCreada } = req.body;
        await pool.query(
            `INSERT INTO invoices (id,client_id,obra_id,amount,status,date,paid_date,items,cotizacion_id,remision_enabled,remision_creada) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)`,
            [id, clientId, obraId, amount, status, date || null, paidDate || null, JSON.stringify(items || []),
                cotizacionId || null, remisionEnabled || false, remisionCreada || false]
        );
        res.json({ success: true });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

app.put('/api/invoices/:id', async (req, res) => {
    try {
        const { clientId, obraId, amount, status, date, paidDate, items, cotizacionId, remisionEnabled, remisionCreada } = req.body;
        await pool.query(
            `UPDATE invoices SET client_id=$1,obra_id=$2,amount=$3,status=$4,date=$5,paid_date=$6,items=$7,cotizacion_id=$8,remision_enabled=$9,remision_creada=$10 WHERE id=$11`,
            [clientId, obraId, amount, status, date || null, paidDate || null, JSON.stringify(items || []),
                cotizacionId || null, remisionEnabled || false, remisionCreada || false, req.params.id]
        );
        res.json({ success: true });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

// ─── COTIZACIONES ────────────────────────────────────────────────────────────
app.get('/api/cotizaciones', async (req, res) => {
    try {
        const { rows } = await pool.query('SELECT * FROM cotizaciones ORDER BY id ASC');
        res.json(rows.map(mapCot));
    } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/cotizaciones', async (req, res) => {
    try {
        const { id, clientId, obraId, fecha, validezDias, metodoPago, responsableTransporte,
            plazoEntrega, transporte, notas, estado, items, habeasData, habeasDataTimestamp, firma, foto } = req.body;
        await pool.query(
            `INSERT INTO cotizaciones (id,client_id,obra_id,fecha,validez_dias,metodo_pago,responsable_transporte,plazo_entrega,transporte,notas,estado,items,habeas_data,habeas_data_timestamp,firma,foto)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16)`,
            [id, clientId, obraId, fecha || null, validezDias, metodoPago, responsableTransporte,
                plazoEntrega, transporte, notas, estado, JSON.stringify(items || []),
                habeasData || false, habeasDataTimestamp || null, firma || null, foto || null]
        );
        res.json({ success: true });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

app.put('/api/cotizaciones/:id', async (req, res) => {
    try {
        const { clientId, obraId, fecha, validezDias, metodoPago, responsableTransporte,
            plazoEntrega, transporte, notas, estado, items, habeasData, habeasDataTimestamp, firma, foto } = req.body;
        await pool.query(
            `UPDATE cotizaciones SET client_id=$1,obra_id=$2,fecha=$3,validez_dias=$4,metodo_pago=$5,responsable_transporte=$6,plazo_entrega=$7,transporte=$8,notas=$9,estado=$10,items=$11,habeas_data=$12,habeas_data_timestamp=$13,firma=$14,foto=$15 WHERE id=$16`,
            [clientId, obraId, fecha || null, validezDias, metodoPago, responsableTransporte,
                plazoEntrega, transporte, notas, estado, JSON.stringify(items || []),
                habeasData || false, habeasDataTimestamp || null, firma || null, foto || null, req.params.id]
        );
        res.json({ success: true });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

// ─── REMISIONES ──────────────────────────────────────────────────────────────
app.get('/api/remisiones', async (req, res) => {
    try {
        const { rows } = await pool.query('SELECT * FROM remisiones ORDER BY id ASC');
        res.json(rows.map(mapRem));
    } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/remisiones', async (req, res) => {
    try {
        const { id, clientId, obraId, fecha, transporte, estado, notas, items } = req.body;
        await pool.query(
            `INSERT INTO remisiones (id,client_id,obra_id,fecha,transporte,estado,notas,items) VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
            [id, clientId, obraId, fecha || null, transporte, estado, notas, JSON.stringify(items || [])]
        );
        res.json({ success: true });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

app.put('/api/remisiones/:id', async (req, res) => {
    try {
        const { clientId, obraId, fecha, transporte, estado, notas, items } = req.body;
        await pool.query(
            `UPDATE remisiones SET client_id=$1,obra_id=$2,fecha=$3,transporte=$4,estado=$5,notas=$6,items=$7 WHERE id=$8`,
            [clientId, obraId, fecha || null, transporte, estado, notas, JSON.stringify(items || []), req.params.id]
        );
        res.json({ success: true });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

// ─── MAINTENANCES ────────────────────────────────────────────────────────────
app.get('/api/maintenances', async (req, res) => {
    try {
        const { rows } = await pool.query('SELECT * FROM maintenances ORDER BY id ASC');
        res.json(rows.map(mapMaint));
    } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/maintenances', async (req, res) => {
    try {
        const { id, productId, type, description, status, date, cost } = req.body;
        await pool.query(
            `INSERT INTO maintenances (id,product_id,type,description,status,date,cost) VALUES ($1,$2,$3,$4,$5,$6,$7)`,
            [id, productId, type, description, status, date || null, cost]
        );
        res.json({ success: true });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

app.put('/api/maintenances/:id', async (req, res) => {
    try {
        const { productId, type, description, status, date, cost } = req.body;
        await pool.query(
            `UPDATE maintenances SET product_id=$1,type=$2,description=$3,status=$4,date=$5,cost=$6 WHERE id=$7`,
            [productId, type, description, status, date || null, cost, req.params.id]
        );
        res.json({ success: true });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

// ─── GASTOS ──────────────────────────────────────────────────────────────────
app.get('/api/gastos', async (req, res) => {
    try {
        const { rows } = await pool.query('SELECT * FROM gastos ORDER BY id ASC');
        res.json(rows.map(mapGasto));
    } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/gastos', async (req, res) => {
    try {
        const { id, fecha, concepto, proveedor, categoria, monto, iva, estado, notas } = req.body;
        await pool.query(
            `INSERT INTO gastos (id,fecha,concepto,proveedor,categoria,monto,iva,estado,notas) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
            [id, fecha || null, concepto, proveedor, categoria, monto, iva, estado, notas]
        );
        res.json({ success: true });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

app.put('/api/gastos/:id', async (req, res) => {
    try {
        const { fecha, concepto, proveedor, categoria, monto, iva, estado, notas } = req.body;
        await pool.query(
            `UPDATE gastos SET fecha=$1,concepto=$2,proveedor=$3,categoria=$4,monto=$5,iva=$6,estado=$7,notas=$8 WHERE id=$9`,
            [fecha || null, concepto, proveedor, categoria, monto, iva, estado, notas, req.params.id]
        );
        res.json({ success: true });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

// ─── EMPLEADOS ───────────────────────────────────────────────────────────────
app.get('/api/empleados', async (req, res) => {
    try {
        const { rows } = await pool.query('SELECT * FROM empleados ORDER BY id ASC');
        res.json(rows.map(mapEmpleado));
    } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/empleados', async (req, res) => {
    try {
        const { id, nombre, cargo, salarioDia, tipo, activo } = req.body;
        await pool.query(
            `INSERT INTO empleados (id,nombre,cargo,salario_dia,tipo,activo) VALUES ($1,$2,$3,$4,$5,$6)`,
            [id, nombre, cargo, salarioDia, tipo, activo !== undefined ? activo : true]
        );
        res.json({ success: true });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

// ─── LIQUIDACIONES ───────────────────────────────────────────────────────────
app.get('/api/liquidaciones', async (req, res) => {
    try {
        const { rows } = await pool.query('SELECT * FROM liquidaciones ORDER BY id ASC');
        res.json(rows.map(mapLiq));
    } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/liquidaciones', async (req, res) => {
    try {
        const { id, empleadoId, periodo, diasTrabajados, horasExtra, valorHoraExtra,
            deduccionSalud, deduccionPension, fondoSolidaridad, bonificaciones, estado } = req.body;
        await pool.query(
            `INSERT INTO liquidaciones (id,empleado_id,periodo,dias_trabajados,horas_extra,valor_hora_extra,deduccion_salud,deduccion_pension,fondo_solidaridad,bonificaciones,estado)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)`,
            [id, empleadoId, periodo, diasTrabajados, horasExtra, valorHoraExtra,
                deduccionSalud, deduccionPension, fondoSolidaridad, bonificaciones, estado]
        );
        res.json({ success: true });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

app.put('/api/liquidaciones/:id', async (req, res) => {
    try {
        const { empleadoId, periodo, diasTrabajados, horasExtra, valorHoraExtra,
            deduccionSalud, deduccionPension, fondoSolidaridad, bonificaciones, estado } = req.body;
        await pool.query(
            `UPDATE liquidaciones SET empleado_id=$1,periodo=$2,dias_trabajados=$3,horas_extra=$4,valor_hora_extra=$5,deduccion_salud=$6,deduccion_pension=$7,fondo_solidaridad=$8,bonificaciones=$9,estado=$10 WHERE id=$11`,
            [empleadoId, periodo, diasTrabajados, horasExtra, valorHoraExtra,
                deduccionSalud, deduccionPension, fondoSolidaridad, bonificaciones, estado, req.params.id]
        );
        res.json({ success: true });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

// ─── Serve React en Producción ───────────────────────────────────────────────
if (process.env.NODE_ENV === 'production' || process.env.RAILWAY_ENVIRONMENT) {
    app.use(express.static(path.join(__dirname, 'dist')));
    app.use((req, res, next) => {
        if (req.method === 'GET' && !req.path.startsWith('/api')) {
            res.sendFile(path.join(__dirname, 'dist', 'index.html'));
        } else { next(); }
    });
}

app.listen(PORT, () => console.log(`🚀 Servidor corriendo en puerto ${PORT}`));
