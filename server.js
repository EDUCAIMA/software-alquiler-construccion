import express from 'express';
import cors from 'cors';
import { Pool } from 'pg';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';
import crypto from 'crypto';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// ─── Pool PostgreSQL ─────────────────────────────────────────────────────────
const isRailway = process.env.DATABASE_URL?.includes('rlwy.net');
const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: (process.env.NODE_ENV === 'production' || isRailway) ? { rejectUnauthorized: false } : false
});

// ─── Inicialización de Tablas ────────────────────────────────────────────────
async function initDB() {
    if (!process.env.DATABASE_URL) {
        console.log('⚠️  No DATABASE_URL encontrada. Configura tu archivo .env con la URL de Railway.');
        return;
    }
    let client;
    try {
        client = await pool.connect();
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
        // Migración: agregar columna tipo_cobro, esquema_cobro y tipo_propiedad si no existen
        await client.query(`ALTER TABLE products ADD COLUMN IF NOT EXISTS tipo_cobro VARCHAR(50) DEFAULT 'Día'`);
        await client.query(`ALTER TABLE products ADD COLUMN IF NOT EXISTS esquema_cobro VARCHAR(50) DEFAULT 'Calendario'`);
        await client.query(`ALTER TABLE products ADD COLUMN IF NOT EXISTS tipo_propiedad VARCHAR(50) DEFAULT 'Propio'`);
        await client.query(`ALTER TABLE products ADD COLUMN IF NOT EXISTS tipo_cobro_costo VARCHAR(50) DEFAULT 'Día'`);
        await client.query(`ALTER TABLE products ADD COLUMN IF NOT EXISTS esquema_cobro_costo VARCHAR(50) DEFAULT 'Calendario'`);

        // --- Lotes de Productos ---
        await client.query(`
          CREATE TABLE IF NOT EXISTS product_batches (
            id SERIAL PRIMARY KEY,
            product_id VARCHAR(50) NOT NULL REFERENCES products(id) ON DELETE CASCADE,
            stock INTEGER NOT NULL DEFAULT 1,
            available_stock INTEGER NOT NULL DEFAULT 1,
            fecha_compra DATE,
            costo_adquisicion NUMERIC(12,2) NOT NULL DEFAULT 0,
            tipo_cobro_costo VARCHAR(50) DEFAULT 'Día',
            esquema_cobro_costo VARCHAR(50) DEFAULT 'Calendario'
          )
        `);

        // Migración inicial para productos existentes que no tengan lotes creados
        const { rows: existingThirdPartyProds } = await client.query(`
          SELECT * FROM products
        `);
        for (const prod of existingThirdPartyProds) {
            const { rows: existingBatches } = await client.query(`
              SELECT COUNT(*) FROM product_batches WHERE product_id = $1
            `, [prod.id]);
            if (parseInt(existingBatches[0].count) === 0) {
                await client.query(`
                  INSERT INTO product_batches(product_id, stock, available_stock, fecha_compra, costo_adquisicion, tipo_cobro_costo, esquema_cobro_costo)
                  VALUES($1, $2, $3, $4, $5, $6, $7)
                `, [
                    prod.id, 
                    prod.total_stock, 
                    prod.available_stock, 
                    prod.fecha_compra, 
                    prod.costo_adquisicion || 0, 
                    prod.tipo_cobro_costo || 'Día', 
                    prod.esquema_cobro_costo || 'Calendario'
                ]);
            }
        }

        // --- Clientes (obras guardadas como JSONB para mantener la estructura actual) ---
        await client.query(`
      CREATE TABLE IF NOT EXISTS clients(
            id VARCHAR(50) PRIMARY KEY,
            name VARCHAR(255) NOT NULL,
            tipo_persona VARCHAR(50),
            nit VARCHAR(50),
            regimen VARCHAR(50),
            responsable_iva BOOLEAN DEFAULT false,
            porc_iva NUMERIC(5, 2) DEFAULT 0,
            porc_retencion NUMERIC(5, 2) DEFAULT 0,
            email VARCHAR(255),
            phone VARCHAR(50),
            direccion VARCHAR(255),
            ciudad VARCHAR(100),
            departamento VARCHAR(100),
            contacto_principal VARCHAR(255),
            joined DATE DEFAULT CURRENT_DATE,
            debt NUMERIC(12, 2) DEFAULT 0,
            obras JSONB DEFAULT '[]',
            foto TEXT,
            foto_cc TEXT,
            foto_cc_back TEXT
        )
            `);

        // Migración: agregar columnas foto, foto_cc y foto_cc_back si no existen
        await client.query(`ALTER TABLE clients ADD COLUMN IF NOT EXISTS foto TEXT`);
        await client.query(`ALTER TABLE clients ADD COLUMN IF NOT EXISTS foto_cc TEXT`);
        await client.query(`ALTER TABLE clients ADD COLUMN IF NOT EXISTS foto_cc_back TEXT`);

        // --- Proveedores ---
        await client.query(`
          CREATE TABLE IF NOT EXISTS providers(
            id VARCHAR(50) PRIMARY KEY,
            name VARCHAR(255) NOT NULL,
            nit VARCHAR(50),
            email VARCHAR(255),
            phone VARCHAR(50),
            direccion VARCHAR(255),
            ciudad VARCHAR(100),
            contacto_principal VARCHAR(255),
            joined DATE DEFAULT CURRENT_DATE
          )
        `);

        // --- Facturas ---
        await client.query(`
      CREATE TABLE IF NOT EXISTS invoices(
                id VARCHAR(50) PRIMARY KEY,
                client_id VARCHAR(50),
                obra_id VARCHAR(50),
                amount NUMERIC(15, 2) DEFAULT 0,
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
        await client.query(`ALTER TABLE invoices ADD COLUMN IF NOT EXISTS paid_amount NUMERIC(15, 2) DEFAULT 0`);
        await client.query(`ALTER TABLE invoices ADD COLUMN IF NOT EXISTS payment_type VARCHAR(50)`);
        await client.query(`ALTER TABLE invoices ADD COLUMN IF NOT EXISTS cortes JSONB DEFAULT '[]'`);
        await client.query(`ALTER TABLE invoices ADD COLUMN IF NOT EXISTS abonos JSONB DEFAULT '[]'`);

        // --- Cotizaciones ---
        await client.query(`
      CREATE TABLE IF NOT EXISTS cotizaciones(
                id VARCHAR(50) PRIMARY KEY,
                client_id VARCHAR(50),
                obra_id VARCHAR(50),
                fecha DATE DEFAULT CURRENT_DATE,
                validez_dias INTEGER DEFAULT 15,
                metodo_pago VARCHAR(100),
                responsable_transporte VARCHAR(100),
                plazo_entrega VARCHAR(100),
                transporte NUMERIC(12, 2) DEFAULT 0,
                notas TEXT,
                estado VARCHAR(50) DEFAULT 'Borrador',
                items JSONB DEFAULT '[]',
                habeas_data BOOLEAN DEFAULT false,
                habeas_data_timestamp TIMESTAMPTZ,
                firma TEXT,
                foto TEXT,
                foto_cc TEXT,
                clausulas JSONB DEFAULT '[]'
            )
            `);
        await client.query(`ALTER TABLE cotizaciones ADD COLUMN IF NOT EXISTS habeas_data BOOLEAN DEFAULT false`);
        await client.query(`ALTER TABLE cotizaciones ADD COLUMN IF NOT EXISTS habeas_data_timestamp TIMESTAMPTZ`);
        await client.query(`ALTER TABLE cotizaciones ADD COLUMN IF NOT EXISTS firma TEXT`);
        await client.query(`ALTER TABLE cotizaciones ADD COLUMN IF NOT EXISTS foto TEXT`);
        await client.query(`ALTER TABLE cotizaciones ADD COLUMN IF NOT EXISTS foto_cc TEXT`);
        await client.query(`ALTER TABLE cotizaciones ADD COLUMN IF NOT EXISTS foto_cc_back TEXT`);
        await client.query(`ALTER TABLE cotizaciones ADD COLUMN IF NOT EXISTS clausulas JSONB DEFAULT '[]'`);
        await client.query(`ALTER TABLE cotizaciones ADD COLUMN IF NOT EXISTS factura_id VARCHAR(50)`);

        // --- Remisiones ---
        await client.query(`
      CREATE TABLE IF NOT EXISTS remisiones(
                id VARCHAR(50) PRIMARY KEY,
                client_id VARCHAR(50),
                obra_id VARCHAR(50),
                fecha DATE DEFAULT CURRENT_DATE,
                transporte NUMERIC(12, 2) DEFAULT 0,
                estado VARCHAR(50) DEFAULT 'Activa',
                notas TEXT,
                items JSONB DEFAULT '[]',
                cotizacion_id VARCHAR(50),
                factura_id VARCHAR(50)
            )
            `);
        await client.query(`ALTER TABLE remisiones ADD COLUMN IF NOT EXISTS cotizacion_id VARCHAR(50)`);
        await client.query(`ALTER TABLE remisiones ADD COLUMN IF NOT EXISTS factura_id VARCHAR(50)`);

        // --- Mantenimientos ---
        await client.query(`
      CREATE TABLE IF NOT EXISTS maintenances(
                id VARCHAR(50) PRIMARY KEY,
                product_id VARCHAR(50),
                type VARCHAR(100),
                description TEXT,
                status VARCHAR(50) DEFAULT 'Pendiente',
                date DATE DEFAULT CURRENT_DATE,
                cost NUMERIC(12, 2) DEFAULT 0
            )
            `);

        // --- Gastos ---
        await client.query(`
      CREATE TABLE IF NOT EXISTS gastos(
                id VARCHAR(50) PRIMARY KEY,
                fecha DATE DEFAULT CURRENT_DATE,
                concepto VARCHAR(255),
                proveedor VARCHAR(255),
                categoria VARCHAR(100),
                monto NUMERIC(12, 2) DEFAULT 0,
                iva NUMERIC(12, 2) DEFAULT 0,
                estado VARCHAR(50) DEFAULT 'Pendiente',
                notas TEXT
            )
            `);

        // --- Empleados ---
        await client.query(`
      CREATE TABLE IF NOT EXISTS empleados(
                id VARCHAR(50) PRIMARY KEY,
                nombre VARCHAR(255) NOT NULL,
                cargo VARCHAR(255),
                salario_dia NUMERIC(12, 2) DEFAULT 0,
                tipo VARCHAR(50) DEFAULT 'Fijo',
                activo BOOLEAN DEFAULT true
            )
            `);

        // --- Liquidaciones ---
        await client.query(`
      CREATE TABLE IF NOT EXISTS liquidaciones(
                id VARCHAR(50) PRIMARY KEY,
                empleado_id VARCHAR(50),
                periodo VARCHAR(100),
                dias_trabajados INTEGER DEFAULT 0,
                horas_extra NUMERIC(6, 2) DEFAULT 0,
                valor_hora_extra NUMERIC(12, 2) DEFAULT 0,
                deduccion_salud NUMERIC(5, 2) DEFAULT 4,
                deduccion_pension NUMERIC(5, 2) DEFAULT 4,
                fondo_solidaridad NUMERIC(5, 2) DEFAULT 0,
                bonificaciones NUMERIC(12, 2) DEFAULT 0,
                estado VARCHAR(50) DEFAULT 'Pendiente'
            )
            `);

        // --- Ajustes de Empresa ---
        await client.query(`
      CREATE TABLE IF NOT EXISTS settings(
                id VARCHAR(50) PRIMARY KEY,
                company_name VARCHAR(255),
                short_name VARCHAR(100),
                name_complement VARCHAR(255),
                nit VARCHAR(50),
                phone VARCHAR(50),
                email VARCHAR(255),
                logo TEXT,
                address TEXT
            )
            `);

        // --- Gastos de Mantenimiento ---
        await client.query(`
      CREATE TABLE IF NOT EXISTS gastos_mantenimiento(
                id VARCHAR(50) PRIMARY KEY,
                id_maquina VARCHAR(50) REFERENCES products(id) ON DELETE SET NULL,
                tipo_gasto VARCHAR(100) NOT NULL,
                descripcion TEXT,
                costo NUMERIC(12, 2) DEFAULT 0,
                fecha_gasto DATE DEFAULT CURRENT_DATE,
                fecha_registro TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
                proveedor_beneficiario VARCHAR(255),
                referencia_soporte VARCHAR(100),
                subtipo_gasto VARCHAR(100)
            )
            `);
        await client.query(`
            CREATE TABLE IF NOT EXISTS logs (
                id SERIAL PRIMARY KEY,
                action TEXT NOT NULL,
                product TEXT,
                client TEXT,
                time VARCHAR(100),
                type VARCHAR(50)
            )
        `);
        await client.query(`ALTER TABLE gastos_mantenimiento ADD COLUMN IF NOT EXISTS proveedor_beneficiario VARCHAR(255)`);
        await client.query(`ALTER TABLE gastos_mantenimiento ADD COLUMN IF NOT EXISTS referencia_soporte VARCHAR(100)`);
        await client.query(`ALTER TABLE gastos_mantenimiento ADD COLUMN IF NOT EXISTS subtipo_gasto VARCHAR(100)`);
        // Migración: agregar columnas si no existen
        await client.query(`ALTER TABLE settings ADD COLUMN IF NOT EXISTS short_name VARCHAR(100)`);
        await client.query(`ALTER TABLE settings ADD COLUMN IF NOT EXISTS name_complement VARCHAR(255)`);
        await client.query(`ALTER TABLE settings ADD COLUMN IF NOT EXISTS header_extra TEXT`);
        await client.query(`ALTER TABLE settings ADD COLUMN IF NOT EXISTS logo_ui TEXT`);

        // --- Crear Tabla de Usuarios ---
        await client.query(`
            CREATE TABLE IF NOT EXISTS users (
                id VARCHAR(50) PRIMARY KEY,
                username VARCHAR(100) UNIQUE NOT NULL,
                password VARCHAR(255) NOT NULL,
                name VARCHAR(255) NOT NULL,
                role VARCHAR(50) NOT NULL DEFAULT 'operativo',
                avatar VARCHAR(10)
            )
        `);

        // --- Migraciones de Remisiones para Fase 2 ---
        await client.query(`ALTER TABLE remisiones ADD COLUMN IF NOT EXISTS assigned_operario_id VARCHAR(50)`);
        await client.query(`ALTER TABLE remisiones ADD COLUMN IF NOT EXISTS fotos_salida_bodega JSONB DEFAULT '[]'`);
        await client.query(`ALTER TABLE remisiones ADD COLUMN IF NOT EXISTS fotos_entrega_cliente JSONB DEFAULT '[]'`);
        await client.query(`ALTER TABLE remisiones ADD COLUMN IF NOT EXISTS fotos_retorno JSONB DEFAULT '[]'`);
        await client.query(`ALTER TABLE remisiones ADD COLUMN IF NOT EXISTS fecha_retorno_efectiva TIMESTAMPTZ`);

        // --- Seed Inicial de Usuarios ---
        const { rows: uRows } = await client.query('SELECT COUNT(*) FROM users');
        if (parseInt(uRows[0].count) === 0) {
            const hashPassword = pwd => crypto.createHash('sha256').update(pwd).digest('hex');
            await client.query(`
                INSERT INTO users(id, username, password, name, role, avatar) VALUES
                ('U-001', 'admin', $1, 'Administrador', 'admin', 'A'),
                ('U-002', 'gerente', $2, 'Gerente General', 'gerente', 'G'),
                ('U-003', 'op', $3, 'Operativo', 'operativo', 'O')
            `, [hashPassword('admin123'), hashPassword('gerente123'), hashPassword('op123')]);
            console.log('✅ Usuarios de muestra insertados en la base de datos.');
        }

        // Seed inicial de settings si está vacío
        const { rows: sRows } = await client.query('SELECT COUNT(*) FROM settings');
        if (parseInt(sRows[0].count) === 0) {
            await client.query(`
        INSERT INTO settings(id, company_name, short_name, name_complement, nit, phone, email, logo, address) VALUES
            ('main', 'CIELO - ALQUILER DE EQUIPOS', 'CIELO', 'ALQUILER DE EQUIPOS', '900.000.000-1', '300 123 4567', 'gerencia@cielo.com', null, 'Calle 123 #45-67')
                `);
        }

        // --- Seed inicial de products si está vacío ---
        const { rows: pRows } = await client.query('SELECT COUNT(*) FROM products');
        if (parseInt(pRows[0].count) === 0) {
            await client.query(`
        INSERT INTO products(id, name, total_stock, available_stock, category, value, image) VALUES
            ('P-101', 'Excavadora Cat 320', 3, 2, 'Heavy Machinery', 350000, 'https://images.unsplash.com/photo-1541888087405-c8108c48a8f1?auto=format&fit=crop&q=80&w=150'),
            ('P-102', 'Martillo Demoledor Bosch', 5, 5, 'Power Tools', 45000, 'https://images.unsplash.com/photo-1504148455328-c376907d081c?auto=format&fit=crop&q=80&w=150'),
            ('P-103', 'Planta Eléctrica 10kW', 2, 2, 'Equipment', 85000, 'https://images.unsplash.com/photo-1580983546051-7649d214a1e9?auto=format&fit=crop&q=80&w=150'),
            ('P-104', 'Andamio Tubular', 100, 60, 'Structures', 15000, 'https://images.unsplash.com/photo-1533038676239-502a507fa733?auto=format&fit=crop&q=80&w=150'),
            ('P-105', 'Mezcladora de Concreto 1 Bulto', 4, 3, 'Machinery', 65000, 'https://images.unsplash.com/photo-1589939705384-5185137a7f0f?auto=format&fit=crop&q=80&w=150')
                `);
            console.log('✅ Productos de muestra insertados.');
        }

        // --- Normalización de IDs con doble guión ---
        try {
            await client.query("UPDATE cotizaciones SET id = REPLACE(id, '--', '-'), factura_id = REPLACE(factura_id, '--', '-') WHERE id LIKE '%--%' OR factura_id LIKE '%--%'");
            await client.query("UPDATE invoices SET id = REPLACE(id, '--', '-'), cotizacion_id = REPLACE(cotizacion_id, '--', '-') WHERE id LIKE '%--%' OR cotizacion_id LIKE '%--%'");
            await client.query("UPDATE remisiones SET id = REPLACE(id, '--', '-'), cotizacion_id = REPLACE(cotizacion_id, '--', '-'), factura_id = REPLACE(factura_id, '--', '-') WHERE id LIKE '%--%' OR cotizacion_id LIKE '%--%' OR factura_id LIKE '%--%'");
            console.log('✅ IDs de base de datos normalizados (sin doble guión).');
        } catch (e) {
            console.error('⚠️ Error al normalizar IDs en base de datos:', e.message);
        }

        console.log('✅ Base de datos inicializada correctamente.');
    } catch (err) {
        console.error('❌ Error inicializando la base de datos:', err.message);
    } finally {
        if (client) client.release();
    }
}

initDB();

// ─── HELPERS ─────────────────────────────────────────────────────────────────
const mapBatch = r => ({
    id: r.id,
    productId: r.product_id,
    stock: r.stock,
    availableStock: r.available_stock,
    fechaCompra: r.fecha_compra ? (typeof r.fecha_compra === 'string' ? r.fecha_compra : (r.fecha_compra instanceof Date ? r.fecha_compra.toISOString().split('T')[0] : r.fecha_compra)) : '',
    costoAdquisicion: r.costo_adquisicion ? Number(r.costo_adquisicion) : 0,
    tipoCobroCosto: r.tipo_cobro_costo || 'Día',
    esquemaCobroCosto: r.esquema_cobro_costo || 'Calendario'
});

const mapProduct = r => ({
    id: r.id, name: r.name, category: r.category, value: Number(r.value),
    totalStock: r.total_stock, availableStock: r.available_stock, image: r.image,
    proveedor: r.proveedor,
    fechaCompra: r.fecha_compra ? r.fecha_compra.toISOString().split('T')[0] : '',
    costoAdquisicion: r.costo_adquisicion ? Number(r.costo_adquisicion) : '',
    proximoMantenimiento: r.proximo_mantenimiento ? r.proximo_mantenimiento.toISOString().split('T')[0] : '',
    tipoCobro: r.tipo_cobro || 'Día',
    esquemaCobro: r.esquema_cobro || 'Calendario',
    tipoPropiedad: r.tipo_propiedad || 'Propio',
    tipoCobroCosto: r.tipo_cobro_costo || 'Día',
    esquemaCobroCosto: r.esquema_cobro_costo || 'Calendario'
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
    obras: r.obras || [],
    foto: r.foto,
    fotoCC: r.foto_cc,
    fotoCCBack: r.foto_cc_back
});

const mapInvoice = r => ({
    id: r.id, clientId: r.client_id, obraId: r.obra_id,
    amount: Number(r.amount), status: r.status,
    date: r.date ? r.date.toISOString().split('T')[0] : '',
    paidDate: r.paid_date ? r.paid_date.toISOString().split('T')[0] : null,
    items: r.items || [],
    cotizacionId: r.cotizacion_id || null,
    remisionEnabled: r.remision_enabled || false,
    remisionCreada: r.remision_creada || false,
    paidAmount: Number(r.paid_amount || 0),
    paymentType: r.payment_type || null,
    cortes: r.cortes || [],
    abonos: r.abonos || []
});

const mapCot = r => ({
    id: r.id, clientId: r.client_id, obraId: r.obra_id,
    fecha: r.fecha ? r.fecha.toISOString().split('T')[0] : '',
    validezDias: r.validez_dias, metodoPago: r.metodo_pago,
    responsableTransporte: r.responsable_transporte, plazoEntrega: r.plazo_entrega,
    transporte: Number(r.transporte), notas: r.notas, estado: r.estado,
    items: r.items || [],
    habeasData: r.habeas_data, habeasDataTimestamp: r.habeas_data_timestamp,
    firma: r.firma, foto: r.foto, fotoCC: r.foto_cc, fotoCCBack: r.foto_cc_back,
    clausulas: r.clausulas || [],
    facturaId: r.factura_id || null
});

const mapRem = r => ({
    id: r.id, clientId: r.client_id, obraId: r.obra_id,
    fecha: r.fecha ? (typeof r.fecha === 'string' ? r.fecha : (r.fecha instanceof Date ? r.fecha.toISOString().split('T')[0] : r.fecha)) : '',
    transporte: Number(r.transporte), estado: r.estado,
    notas: r.notas, items: r.items || [],
    cotizacionId: r.cotizacion_id, facturaId: r.factura_id,
    assignedOperarioId: r.assigned_operario_id,
    fotosSalidaBodega: r.fotos_salida_bodega || [],
    fotosEntregaCliente: r.fotos_entrega_cliente || [],
    fotosRetorno: r.fotos_retorno || [],
    fechaRetornoEfectiva: r.fecha_retorno_efectiva
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

const mapSettings = r => ({
    id: r.id,
    companyName: r.company_name,
    shortName: r.short_name || '',
    nameComplement: r.name_complement || '',
    nit: r.nit,
    phone: r.phone,
    email: r.email,
    logo: r.logo,
    logoUI: r.logo_ui,
    address: r.address,
    headerExtra: r.header_extra || ''
});

const mapProvider = r => ({
    id: r.id,
    name: r.name,
    nit: r.nit,
    email: r.email,
    phone: r.phone,
    direccion: r.direccion,
    ciudad: r.ciudad,
    contactoPrincipal: r.contacto_principal,
    joined: r.joined ? (typeof r.joined === 'string' ? r.joined : (r.joined instanceof Date ? r.joined.toISOString().split('T')[0] : r.joined)) : ''
});

// ─── PRODUCTS ────────────────────────────────────────────────────────────────
app.get('/api/products', async (req, res) => {
    try {
        const { rows: products } = await pool.query('SELECT * FROM products ORDER BY id DESC');
        const { rows: batches } = await pool.query('SELECT * FROM product_batches ORDER BY id ASC');
        
        const mappedProducts = products.map(mapProduct);
        const mappedBatches = batches.map(mapBatch);
        
        const batchesByProduct = {};
        for (const batch of mappedBatches) {
            if (!batchesByProduct[batch.productId]) {
                batchesByProduct[batch.productId] = [];
            }
            batchesByProduct[batch.productId].push(batch);
        }
        
        for (const p of mappedProducts) {
            p.batches = batchesByProduct[p.id] || [];
        }
        
        res.json(mappedProducts);
    } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/products', async (req, res) => {
    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        const {
            id, name, category, value, totalStock, availableStock, image, proveedor, fechaCompra, costoAdquisicion, proximoMantenimiento, tipoCobro, esquemaCobro, tipoPropiedad, tipoCobroCosto, esquemaCobroCosto
        } = req.body;
        await client.query(
            `INSERT INTO products(id, name, category, value, total_stock, available_stock, image, proveedor, fecha_compra, costo_adquisicion, proximo_mantenimiento, tipo_cobro, esquema_cobro, tipo_propiedad, tipo_cobro_costo, esquema_cobro_costo)
       VALUES($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16)`,
            [id, name, category, value, totalStock, availableStock, image, proveedor, fechaCompra || null, costoAdquisicion || 0, proximoMantenimiento || null, tipoCobro || 'Día', esquemaCobro || 'Calendario', tipoPropiedad || 'Propio', tipoCobroCosto || 'Día', esquemaCobroCosto || 'Calendario']
        );

        // Insert initial batch
        await client.query(
            `INSERT INTO product_batches(product_id, stock, available_stock, fecha_compra, costo_adquisicion, tipo_cobro_costo, esquema_cobro_costo)
             VALUES($1, $2, $3, $4, $5, $6, $7)`,
            [id, totalStock, availableStock, fechaCompra || null, costoAdquisicion || 0, tipoCobroCosto || 'Día', esquemaCobroCosto || 'Calendario']
        );

        await client.query('COMMIT');
        res.json({ success: true });
    } catch (e) {
        await client.query('ROLLBACK');
        res.status(500).json({ error: e.message });
    } finally {
        client.release();
    }
});

app.put('/api/products/:id', async (req, res) => {
    try {
        const {
            name, category, value, totalStock, availableStock, image, proveedor, fechaCompra, costoAdquisicion, proximoMantenimiento, tipoCobro, esquemaCobro, tipoPropiedad, tipoCobroCosto, esquemaCobroCosto
        } = req.body;
        await pool.query(
            `UPDATE products SET name=$1, category=$2, value=$3, total_stock=$4, available_stock=$5, image=$6, proveedor=$7, fecha_compra=$8, costo_adquisicion=$9, proximo_mantenimiento=$10, tipo_cobro=$11, esquema_cobro=$12, tipo_propiedad=$13, tipo_cobro_costo=$14, esquema_cobro_costo=$15 WHERE id=$16`,
            [name, category, value, totalStock, availableStock, image, proveedor, fechaCompra || null, costoAdquisicion || 0, proximoMantenimiento || null, tipoCobro || 'Día', esquemaCobro || 'Calendario', tipoPropiedad || 'Propio', tipoCobroCosto || 'Día', esquemaCobroCosto || 'Calendario', req.params.id]
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

// ─── BATCHES ─────────────────────────────────────────────────────────────────
app.post('/api/products/:productId/batches', async (req, res) => {
    const { productId } = req.params;
    const { stock, availableStock, fechaCompra, costoAdquisicion, tipoCobroCosto, esquemaCobroCosto } = req.body;
    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        
        await client.query(
            `INSERT INTO product_batches(product_id, stock, available_stock, fecha_compra, costo_adquisicion, tipo_cobro_costo, esquema_cobro_costo)
             VALUES($1, $2, $3, $4, $5, $6, $7)`,
            [productId, stock, availableStock || stock, fechaCompra || null, costoAdquisicion || 0, tipoCobroCosto || 'Día', esquemaCobroCosto || 'Calendario']
        );
        
        await client.query(
            `UPDATE products 
             SET total_stock = (SELECT SUM(stock) FROM product_batches WHERE product_id = $1),
                 available_stock = (SELECT SUM(available_stock) FROM product_batches WHERE product_id = $1)
             WHERE id = $1`,
            [productId]
        );
        
        await client.query('COMMIT');
        res.json({ success: true });
    } catch (e) {
        await client.query('ROLLBACK');
        res.status(500).json({ error: e.message });
    } finally {
        client.release();
    }
});

app.put('/api/products/:productId/batches/:batchId', async (req, res) => {
    const { productId, batchId } = req.params;
    const { stock, availableStock, fechaCompra, costoAdquisicion, tipoCobroCosto, esquemaCobroCosto } = req.body;
    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        
        const { rows: oldBatchRows } = await client.query('SELECT stock, available_stock FROM product_batches WHERE id = $1', [batchId]);
        if (oldBatchRows.length === 0) {
            throw new Error('Batch not found');
        }
        const oldBatch = oldBatchRows[0];
        const calculatedAvailable = availableStock !== undefined ? availableStock : (stock - (oldBatch.stock - oldBatch.available_stock));
        
        await client.query(
            `UPDATE product_batches 
             SET stock=$1, available_stock=$2, fecha_compra=$3, costo_adquisicion=$4, tipo_cobro_costo=$5, esquema_cobro_costo=$6
             WHERE id=$7`,
            [stock, calculatedAvailable, fechaCompra || null, costoAdquisicion || 0, tipoCobroCosto || 'Día', esquemaCobroCosto || 'Calendario', batchId]
        );
        
        await client.query(
            `UPDATE products 
             SET total_stock = (SELECT SUM(stock) FROM product_batches WHERE product_id = $1),
                 available_stock = (SELECT SUM(available_stock) FROM product_batches WHERE product_id = $1)
             WHERE id = $1`,
            [productId]
        );
        
        await client.query('COMMIT');
        res.json({ success: true });
    } catch (e) {
        await client.query('ROLLBACK');
        res.status(500).json({ error: e.message });
    } finally {
        client.release();
    }
});

app.delete('/api/products/:productId/batches/:batchId', async (req, res) => {
    const { productId, batchId } = req.params;
    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        
        await client.query('DELETE FROM product_batches WHERE id = $1', [batchId]);
        
        await client.query(
            `UPDATE products 
             SET total_stock = COALESCE((SELECT SUM(stock) FROM product_batches WHERE product_id = $1), 0),
                 available_stock = COALESCE((SELECT SUM(available_stock) FROM product_batches WHERE product_id = $1), 0)
             WHERE id = $1`,
            [productId]
        );
        
        await client.query('COMMIT');
        res.json({ success: true });
    } catch (e) {
        await client.query('ROLLBACK');
        res.status(500).json({ error: e.message });
    } finally {
        client.release();
    }
});

// ─── CLIENTS ─────────────────────────────────────────────────────────────────
app.get('/api/clients', async (req, res) => {
    try {
        const { rows } = await pool.query('SELECT * FROM clients ORDER BY id DESC');
        res.json(rows.map(mapClient));
    } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/clients', async (req, res) => {
    try {
        const { id, name, tipoPersona, nit, regimen, responsableIVA, porcIVA, porcRetencion,
            email, phone, direccion, ciudad, departamento, contactoPrincipal, joined, debt, obras, foto, fotoCC, fotoCCBack } = req.body;
        await pool.query(
            `INSERT INTO clients(id, name, tipo_persona, nit, regimen, responsable_iva, porc_iva, porc_retencion, email, phone, direccion, ciudad, departamento, contacto_principal, joined, debt, obras, foto, foto_cc, foto_cc_back)
       VALUES($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20)`,
            [id, name, tipoPersona, nit, regimen, responsableIVA, porcIVA, porcRetencion,
                email, phone, direccion, ciudad, departamento, contactoPrincipal, joined || null, debt || 0, JSON.stringify(obras || []), foto || null, fotoCC || null, fotoCCBack || null]
        );
        res.json({ success: true });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

app.put('/api/clients/:id', async (req, res) => {
    try {
        const { name, tipoPersona, nit, regimen, responsableIVA, porcIVA, porcRetencion,
            email, phone, direccion, ciudad, departamento, contactoPrincipal, joined, debt, obras, foto, fotoCC, fotoCCBack } = req.body;
        await pool.query(
            `UPDATE clients SET name = $1, tipo_persona = $2, nit = $3, regimen = $4, responsable_iva = $5, porc_iva = $6, porc_retencion = $7,
            email = $8, phone = $9, direccion = $10, ciudad = $11, departamento = $12, contacto_principal = $13, joined = $14, debt = $15, obras = $16, foto = $17, foto_cc = $18, foto_cc_back = $19 WHERE id = $20`,
            [name, tipoPersona, nit, regimen, responsableIVA, porcIVA, porcRetencion,
                email, phone, direccion, ciudad, departamento, contactoPrincipal, joined || null, debt || 0, JSON.stringify(obras || []), foto || null, fotoCC || null, fotoCCBack || null, req.params.id]
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

// ─── PROVIDERS (TERCEROS) ───────────────────────────────────────────────────
app.get('/api/providers', async (req, res) => {
    try {
        const { rows } = await pool.query('SELECT * FROM providers ORDER BY id DESC');
        res.json(rows.map(mapProvider));
    } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/providers', async (req, res) => {
    try {
        const { id, name, nit, email, phone, direccion, ciudad, contactoPrincipal } = req.body;
        await pool.query(
            `INSERT INTO providers(id, name, nit, email, phone, direccion, ciudad, contacto_principal)
             VALUES($1, $2, $3, $4, $5, $6, $7, $8)`,
            [id, name, nit, email, phone, direccion, ciudad, contactoPrincipal]
        );
        res.json({ success: true });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

app.put('/api/providers/:id', async (req, res) => {
    try {
        const { name, nit, email, phone, direccion, ciudad, contactoPrincipal } = req.body;
        await pool.query(
            `UPDATE providers SET name = $1, nit = $2, email = $3, phone = $4, direccion = $5, ciudad = $6, contacto_principal = $7 WHERE id = $8`,
            [name, nit, email, phone, direccion, ciudad, contactoPrincipal, req.params.id]
        );
        res.json({ success: true });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

app.delete('/api/providers/:id', async (req, res) => {
    try {
        await pool.query('DELETE FROM providers WHERE id=$1', [req.params.id]);
        res.json({ success: true });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

// ─── INVOICES ────────────────────────────────────────────────────────────────
app.get('/api/invoices', async (req, res) => {
    try {
        const { rows } = await pool.query('SELECT * FROM invoices ORDER BY id DESC');
        res.json(rows.map(mapInvoice));
    } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/invoices', async (req, res) => {
    try {
        const { id, clientId, obraId, amount, status, date, paidDate, items, cotizacionId, remisionEnabled, remisionCreada, paidAmount, paymentType, cortes, abonos } = req.body;
        await pool.query(
            `INSERT INTO invoices(id, client_id, obra_id, amount, status, date, paid_date, items, cotizacion_id, remision_enabled, remision_creada, paid_amount, payment_type, cortes, abonos) VALUES($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)`,
            [id, clientId, obraId, amount, status, date || null, paidDate || null, JSON.stringify(items || []),
                cotizacionId || null, remisionEnabled || false, remisionCreada || false, paidAmount || 0, paymentType || null, JSON.stringify(cortes || []), JSON.stringify(abonos || [])]
        );
        res.json({ success: true });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

app.put('/api/invoices/:id', async (req, res) => {
    try {
        const { clientId, obraId, amount, status, date, paidDate, items, cotizacionId, remisionEnabled, remisionCreada, paidAmount, paymentType, cortes, abonos } = req.body;
        await pool.query(
            `UPDATE invoices SET client_id = $1, obra_id = $2, amount = $3, status = $4, date = $5, paid_date = $6, items = $7, cotizacion_id = $8, remision_enabled = $9, remision_creada = $10, paid_amount = $11, payment_type = $12, cortes = $13, abonos = $14 WHERE id = $15`,
            [clientId, obraId, amount, status, date || null, paidDate || null, JSON.stringify(items || []),
                cotizacionId || null, remisionEnabled || false, remisionCreada || false, paidAmount || 0, paymentType || null, JSON.stringify(cortes || []), JSON.stringify(abonos || []), req.params.id]
        );
        res.json({ success: true });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

app.delete('/api/invoices/:id', async (req, res) => {
    try {
        await pool.query('DELETE FROM invoices WHERE id=$1', [req.params.id]);
        res.json({ success: true });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

// ─── COTIZACIONES ────────────────────────────────────────────────────────────
app.get('/api/cotizaciones', async (req, res) => {
    try {
        const { rows } = await pool.query('SELECT * FROM cotizaciones ORDER BY id DESC');
        res.json(rows.map(mapCot));
    } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/cotizaciones', async (req, res) => {
    try {
        const { id, clientId, obraId, fecha, validezDias, metodoPago, responsableTransporte,
            plazoEntrega, transporte, notas, estado, items, habeasData, habeasDataTimestamp, firma, foto, fotoCC, fotoCCBack, clausulas, facturaId } = req.body;
        await pool.query(
            `INSERT INTO cotizaciones(id, client_id, obra_id, fecha, validez_dias, metodo_pago, responsable_transporte,
                plazo_entrega, transporte, notas, estado, items, habeas_data, habeas_data_timestamp, firma, foto, foto_cc, foto_cc_back, clausulas, factura_id)
                VALUES($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20)`,
            [id, clientId, obraId, fecha || null, validezDias, metodoPago, responsableTransporte,
                plazoEntrega, transporte, notas, estado, JSON.stringify(items || []),
                habeasData || false, habeasDataTimestamp || null, firma || null, foto || null, fotoCC || null, fotoCCBack || null, JSON.stringify(clausulas || []), facturaId || null]
        );
        res.json({ success: true });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

app.put('/api/cotizaciones/:id', async (req, res) => {
    try {
        console.log('📬 PUT /api/cotizaciones/', req.params.id, req.body);
        const { clientId, obraId, fecha, validezDias, metodoPago, responsableTransporte,
            plazoEntrega, transporte, notas, estado, items, habeasData, habeasDataTimestamp, firma, foto, fotoCC, fotoCCBack, clausulas, facturaId } = req.body;
        await pool.query(
            `UPDATE cotizaciones SET client_id = $1, obra_id = $2, fecha = $3, validez_dias = $4, metodo_pago = $5, responsable_transporte = $6, plazo_entrega = $7, transporte = $8, notas = $9, estado = $10, items = $11, habeas_data = $12, habeas_data_timestamp = $13, firma = $14, foto = $15, foto_cc = $16, foto_cc_back = $17, clausulas = $18, factura_id = $19 WHERE id = $20`,
            [clientId, obraId, fecha || null, validezDias, metodoPago, responsableTransporte,
                plazoEntrega, transporte, notas, estado, JSON.stringify(items || []),
                habeasData || false, habeasDataTimestamp || null, firma || null, foto || null, fotoCC || null, fotoCCBack || null, JSON.stringify(clausulas || []), facturaId || null, req.params.id]
        );
        res.json({ success: true });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

app.delete('/api/cotizaciones/:id', async (req, res) => {
    try {
        await pool.query('DELETE FROM cotizaciones WHERE id=$1', [req.params.id]);
        res.json({ success: true });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

// ─── PUBLIC COTIZACIONES (Sin Auth) ──────────────────────────────────────────
app.get('/api/public/cotizaciones/:id', async (req, res) => {
    try {
        const { rows } = await pool.query('SELECT * FROM cotizaciones WHERE id = $1', [req.params.id]);
        if (rows.length === 0) return res.status(404).json({ error: 'Cotización no encontrada' });
        
        const cot = mapCot(rows[0]);
        const { rows: clientRows } = await pool.query('SELECT name, nit, direccion, email, obras FROM clients WHERE id = $1', [cot.clientId]);
        const { rows: settingsRows } = await pool.query('SELECT * FROM settings WHERE id = $1', ['main']);
        
        res.json({ 
            cot, 
            client: clientRows[0] || null, 
            settings: settingsRows.length > 0 ? mapSettings(settingsRows[0]) : null
        });
    } catch (e) { 
        console.error('SERVER ERROR PUBLIC GET:', e.message);
        res.status(500).json({ error: e.message }); 
    }
});

app.post('/api/public/cotizaciones/:id/approve', async (req, res) => {
    try {
        const { firma, foto, fotoCC, fotoCCBack, habeasData, habeasDataTimestamp } = req.body;
        await pool.query(
            `UPDATE cotizaciones SET estado = 'Aprobada', firma = $1, foto = $2, foto_cc = $3, foto_cc_back = $4, habeas_data = $5, habeas_data_timestamp = $6 WHERE id = $7`,
            [firma, foto, fotoCC, fotoCCBack, habeasData !== undefined ? habeasData : true, habeasDataTimestamp || new Date(), req.params.id]
        );
        res.json({ success: true });
    } catch (e) { 
        console.error('SERVER ERROR PUBLIC POST APPROVE:', e.message);
        res.status(500).json({ error: e.message }); 
    }
});

// ─── REMISIONES ──────────────────────────────────────────────────────────────
app.get('/api/remisiones', async (req, res) => {
    try {
        const { rows } = await pool.query('SELECT * FROM remisiones ORDER BY id DESC');
        res.json(rows.map(mapRem));
    } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/remisiones', async (req, res) => {
    try {
        const { id, clientId, obraId, fecha, transporte, estado, notas, items, cotizacionId, facturaId } = req.body;
        await pool.query(
            `INSERT INTO remisiones(id, client_id, obra_id, fecha, transporte, estado, notas, items, cotizacion_id, factura_id) 
             VALUES($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
            [id, clientId, obraId, fecha || null, transporte, estado, notas, JSON.stringify(items || []), cotizacionId || null, facturaId || null]
        );
        res.json({ success: true });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

app.put('/api/remisiones/:id', async (req, res) => {
    try {
        const { clientId, obraId, fecha, transporte, estado, notas, items, cotizacionId, facturaId, assignedOperarioId } = req.body;
        await pool.query(
            `UPDATE remisiones SET client_id = $1, obra_id = $2, fecha = $3, transporte = $4, estado = $5, notas = $6, items = $7, cotizacion_id = $8, factura_id = $9, assigned_operario_id = $10 WHERE id = $11`,
            [clientId, obraId, fecha || null, transporte, estado, notas, JSON.stringify(items || []), cotizacionId || null, facturaId || null, assignedOperarioId || null, req.params.id]
        );
        res.json({ success: true });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

app.delete('/api/remisiones/:id', async (req, res) => {
    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        const remId = req.params.id;

        // 1. Obtener la remisión para saber qué ítems restituir
        const { rows } = await client.query('SELECT * FROM remisiones WHERE id = $1 OR REPLACE(id, \'--\', \'-\') = $1', [remId]);
        if (rows.length > 0) {
            const rem = rows[0];
            const items = Array.isArray(rem.items) ? rem.items : (typeof rem.items === 'string' ? JSON.parse(rem.items) : []);
            
            // 2. Por cada ítem, calcular la cantidad pendiente de devolución y sumar a available_stock
            for (const item of items) {
                const prodId = item.productId || item.id || item.product_id;
                if (!prodId) continue;
                const pendiente = Math.max(0, (Number(item.cantidad) || 0) - (Number(item.cantidadDevuelta) || 0));
                if (pendiente > 0) {
                    await client.query(
                        'UPDATE products SET available_stock = LEAST(total_stock, available_stock + $1) WHERE id = $2 OR name = $2',
                        [pendiente, prodId]
                    );
                }
            }

            // 3. Desmarcar factura vinculada si existe
            if (rem.factura_id) {
                await client.query('UPDATE invoices SET remision_creada = false WHERE id = $1', [rem.factura_id]);
            }
            const autoInvId = typeof rem.id === 'string' ? rem.id.replace('REM-', 'F-') : null;
            if (autoInvId) {
                await client.query('UPDATE invoices SET remision_creada = false WHERE id = $1', [autoInvId]);
            }
        }

        // 4. Eliminar la remisión de la base de datos
        await client.query('DELETE FROM remisiones WHERE id = $1 OR REPLACE(id, \'--\', \'-\') = $1', [remId]);
        
        await client.query('COMMIT');
        res.json({ success: true });
    } catch (e) {
        await client.query('ROLLBACK');
        console.error('Error en DELETE /api/remisiones/:id:', e);
        res.status(500).json({ error: e.message });
    } finally {
        client.release();
    }
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
            `INSERT INTO maintenances(id, product_id, type, description, status, date, cost) VALUES($1, $2, $3, $4, $5, $6, $7)`,
            [id, productId, type, description, status, date || null, cost]
        );
        res.json({ success: true });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

app.put('/api/maintenances/:id', async (req, res) => {
    try {
        const { productId, type, description, status, date, cost } = req.body;
        await pool.query(
            `UPDATE maintenances SET product_id = $1, type = $2, description = $3, status = $4, date = $5, cost = $6 WHERE id = $7`,
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
            `INSERT INTO gastos(id, fecha, concepto, proveedor, categoria, monto, iva, estado, notas) VALUES($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
            [id, fecha || null, concepto, proveedor, categoria, monto, iva, estado, notas]
        );
        res.json({ success: true });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

app.put('/api/gastos/:id', async (req, res) => {
    try {
        const { fecha, concepto, proveedor, categoria, monto, iva, estado, notas } = req.body;
        await pool.query(
            `UPDATE gastos SET fecha = $1, concepto = $2, proveedor = $3, categoria = $4, monto = $5, iva = $6, estado = $7, notas = $8 WHERE id = $9`,
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
            `INSERT INTO empleados(id, nombre, cargo, salario_dia, tipo, activo) VALUES($1, $2, $3, $4, $5, $6)`,
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
            `INSERT INTO liquidaciones(id, empleado_id, periodo, dias_trabajados, horas_extra, valor_hora_extra, deduccion_salud, deduccion_pension, fondo_solidaridad, bonificaciones, estado)
       VALUES($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`,
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
            `UPDATE liquidaciones SET empleado_id = $1, periodo = $2, dias_trabajados = $3, horas_extra = $4, valor_hora_extra = $5, deduccion_salud = $6, deduccion_pension = $7, fondo_solidaridad = $8, bonificaciones = $9, estado = $10 WHERE id = $11`,
            [empleadoId, periodo, diasTrabajados, horasExtra, valorHoraExtra,
                deduccionSalud, deduccionPension, fondoSolidaridad, bonificaciones, estado, req.params.id]
        );
        res.json({ success: true });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

// ─── SETTINGS ──────────────────────────────────────────────────────────────
app.get('/api/settings', async (req, res) => {
    try {
        const { rows } = await pool.query('SELECT * FROM settings WHERE id = $1', ['main']);
        if (rows.length === 0) return res.json({ companyName: 'CIELO', shortName: 'CIELO', nameComplement: '', nit: '', phone: '', email: '', logo: '', logoUI: '', address: '' });
        res.json(mapSettings(rows[0]));
    } catch (e) { res.status(500).json({ error: e.message }); }
});

app.put('/api/settings', async (req, res) => {
    try {
        const { companyName, shortName, nameComplement, nit, phone, email, logo, logoUI, address, headerExtra } = req.body;
        
        // Identificar el ID único de settings
        const { rows: currentRows } = await pool.query('SELECT id FROM settings LIMIT 1');
        const targetId = currentRows.length > 0 ? currentRows[0].id : 'main';

        await pool.query(
            `UPDATE settings SET 
             company_name = $1, short_name = $2, name_complement = $3, nit = $4, phone = $5, email = $6, logo = $7, logo_ui = $8, address = $9, header_extra = $10 
             WHERE id = $11`,
            [companyName, shortName, nameComplement, nit, phone, email, logo, logoUI, address, headerExtra || '', targetId]
        );
        res.json({ success: true });
    } catch (e) { 
        console.error('ERROR UPDATING SETTINGS:', e.message);
        res.status(500).json({ error: e.message }); 
    }
});

// ─── GASTOS MANTENIMIENTO CRUD ───────────────────────────────────────────────
app.get('/api/gastos-mantenimiento', async (req, res) => {
    try {
        const { rows } = await pool.query(`
            SELECT gm.*, p.name as name_maquina 
            FROM gastos_mantenimiento gm
            LEFT JOIN products p ON gm.id_maquina = p.id
            ORDER BY gm.fecha_gasto DESC, gm.fecha_registro DESC
        `);
        res.json(rows);
    } catch (e) {
        console.error('ERROR GETTING GASTOS MANTENIMIENTO:', e.message);
        res.status(500).json({ error: e.message });
    }
});

app.post('/api/gastos-mantenimiento', async (req, res) => {
    const { id, id_maquina, tipo_gasto, subtipo_gasto, descripcion, costo, fecha_gasto, proveedor_beneficiario, referencia_soporte } = req.body;
    try {
        const { rows } = await pool.query(`
            INSERT INTO gastos_mantenimiento (id, id_maquina, tipo_gasto, subtipo_gasto, descripcion, costo, fecha_gasto, proveedor_beneficiario, referencia_soporte)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
            RETURNING *
        `, [id, id_maquina || null, tipo_gasto, subtipo_gasto || null, descripcion, Number(costo) || 0, fecha_gasto, proveedor_beneficiario || null, referencia_soporte || null]);
        res.status(201).json(rows[0]);
    } catch (e) {
        console.error('ERROR CREATING GASTO MANTENIMIENTO:', e.message);
        res.status(500).json({ error: e.message });
    }
});

app.put('/api/gastos-mantenimiento/:id', async (req, res) => {
    const { id } = req.params;
    const { id_maquina, tipo_gasto, subtipo_gasto, descripcion, costo, fecha_gasto, proveedor_beneficiario, referencia_soporte } = req.body;
    try {
        const { rows } = await pool.query(`
            UPDATE gastos_mantenimiento
            SET id_maquina = $1, tipo_gasto = $2, subtipo_gasto = $3, descripcion = $4, costo = $5, fecha_gasto = $6, proveedor_beneficiario = $7, referencia_soporte = $8
            WHERE id = $9
            RETURNING *
        `, [id_maquina || null, tipo_gasto, subtipo_gasto || null, descripcion, Number(costo) || 0, fecha_gasto, proveedor_beneficiario || null, referencia_soporte || null, id]);
        if (rows.length === 0) return res.status(404).json({ error: 'Gasto de mantenimiento no encontrado' });
        res.json(rows[0]);
    } catch (e) {
        console.error('ERROR UPDATING GASTO MANTENIMIENTO:', e.message);
        res.status(500).json({ error: e.message });
    }
});

app.delete('/api/gastos-mantenimiento/:id', async (req, res) => {
    const { id } = req.params;
    try {
        const { rowCount } = await pool.query('DELETE FROM gastos_mantenimiento WHERE id = $1', [id]);
        if (rowCount === 0) return res.status(404).json({ error: 'Gasto de mantenimiento no encontrado' });
        res.json({ success: true });
    } catch (e) {
        console.error('ERROR DELETING GASTO MANTENIMIENTO:', e.message);
        res.status(500).json({ error: e.message });
    }
});

// ─── LOGS TRACER CRUD (NO DELETE ENDPOINT) ──────────────────────────────────
app.get('/api/logs', async (req, res) => {
    try {
        const { rows } = await pool.query('SELECT * FROM logs ORDER BY id DESC');
        res.json(rows);
    } catch (e) {
        console.error('ERROR GETTING LOGS:', e.message);
        res.status(500).json({ error: e.message });
    }
});

app.post('/api/logs', async (req, res) => {
    const { action, product, client, time, type } = req.body;
    try {
        const { rows } = await pool.query(`
            INSERT INTO logs (action, product, client, time, type)
            VALUES ($1, $2, $3, $4, $5)
            RETURNING *
        `, [action, product || '', client || '', time, type || 'system']);
        res.status(201).json(rows[0]);
    } catch (e) {
        console.error('ERROR CREATING LOG:', e.message);
        res.status(500).json({ error: e.message });
    }
});

// ─── AUTH ENDPOINTS ─────────────────────────────────────────────────────────
app.post('/api/auth/login', async (req, res) => {
    const { username, password } = req.body;
    if (!username || !password) {
        return res.status(400).json({ error: 'Usuario y contraseña son requeridos' });
    }
    try {
        const { rows } = await pool.query('SELECT * FROM users WHERE username = $1', [username.trim()]);
        if (rows.length === 0) {
            return res.status(401).json({ error: 'Usuario o contraseña incorrectos' });
        }
        
        const user = rows[0];
        const hash = crypto.createHash('sha256').update(password).digest('hex');
        if (user.password !== hash) {
            return res.status(401).json({ error: 'Usuario o contraseña incorrectos' });
        }
        
        // Retornar información segura (sin la contraseña)
        const { password: _, ...safeUser } = user;
        res.json(safeUser);
    } catch (e) {
        console.error('ERROR EN LOGIN:', e.message);
        res.status(500).json({ error: e.message });
    }
});

// ─── USER MANAGEMENT ENDPOINTS ────────────────────────────────────────────────
app.get('/api/users', async (req, res) => {
    try {
        const { rows } = await pool.query('SELECT id, username, name, role, avatar FROM users ORDER BY name ASC');
        res.json(rows);
    } catch (e) {
        console.error('ERROR EN GET USERS:', e.message);
        res.status(500).json({ error: e.message });
    }
});

app.post('/api/users', async (req, res) => {
    const { username, password, name, role, avatar } = req.body;
    if (!username || !password || !name || !role) {
        return res.status(400).json({ error: 'Todos los campos son requeridos' });
    }
    try {
        // Generar un ID único (U-XXX) basado en el último número
        const { rows: lastUserRows } = await pool.query("SELECT id FROM users WHERE id LIKE 'U-%' ORDER BY id DESC LIMIT 1");
        let nextNum = 1;
        if (lastUserRows.length > 0) {
            const lastId = lastUserRows[0].id;
            const match = lastId.match(/U-(\d+)/);
            if (match) {
                nextNum = parseInt(match[1]) + 1;
            }
        }
        const newId = `U-${String(nextNum).padStart(3, '0')}`;
        
        // Hash de contraseña
        const hash = crypto.createHash('sha256').update(password).digest('hex');
        
        await pool.query(
            `INSERT INTO users(id, username, password, name, role, avatar) VALUES($1, $2, $3, $4, $5, $6)`,
            [newId, username.trim().toLowerCase(), hash, name.trim(), role, avatar || name.charAt(0).toUpperCase()]
        );
        res.status(201).json({ id: newId, username: username.trim().toLowerCase(), name, role, avatar });
    } catch (e) {
        console.error('ERROR EN CREAR USER:', e.message);
        if (e.code === '23505' || e.message.includes('unique') || e.message.includes('duplicado')) {
            res.status(400).json({ error: 'El nombre de usuario ya está registrado' });
        } else {
            res.status(500).json({ error: e.message });
        }
    }
});

app.delete('/api/users/:id', async (req, res) => {
    const { id } = req.params;
    if (id === 'U-001') {
        return res.status(400).json({ error: 'No se puede eliminar el usuario administrador principal' });
    }
    try {
        await pool.query('DELETE FROM users WHERE id = $1', [id]);
        res.json({ success: true });
    } catch (e) {
        console.error('ERROR EN ELIMINAR USER:', e.message);
        res.status(500).json({ error: e.message });
    }
});

app.post('/api/auth/check-password', async (req, res) => {
    const { username, password } = req.body;
    if (!username || !password) {
        return res.status(400).json({ error: 'Usuario y contraseña son requeridos' });
    }
    try {
        const { rows } = await pool.query('SELECT password FROM users WHERE username = $1', [username.trim()]);
        if (rows.length === 0) {
            return res.json({ isValid: false });
        }
        const hash = crypto.createHash('sha256').update(password).digest('hex');
        const isValid = rows[0].password === hash;
        res.json({ isValid });
    } catch (e) {
        console.error('ERROR CHECK PASSWORD:', e.message);
        res.status(500).json({ error: e.message });
    }
});


// ─── REMISIONES FASE 2 ENDPOINTS ─────────────────────────────────────────────
app.get('/api/remisiones/mis-asignaciones', async (req, res) => {
    const { operarioId } = req.query;
    if (!operarioId) {
        return res.status(400).json({ error: 'Se requiere el parámetro operarioId' });
    }
    try {
        const { rows } = await pool.query(
            'SELECT * FROM remisiones WHERE assigned_operario_id = $1 ORDER BY id DESC', 
            [operarioId]
        );
        res.json(rows.map(mapRem));
    } catch (e) {
        console.error('ERROR EN MIS ASIGNACIONES:', e.message);
        res.status(500).json({ error: e.message });
    }
});

app.put('/api/remisiones/:id/evidencia', async (req, res) => {
    const { id } = req.params;
    const { 
        fotosSalidaBodega, 
        fotosEntregaCliente, 
        fotosRetorno, 
        fechaRetornoEfectiva, 
        estado, 
        items,
        notas 
    } = req.body;
    try {
        // Obtenemos el registro actual
        const { rows } = await pool.query('SELECT * FROM remisiones WHERE id = $1', [id]);
        if (rows.length === 0) {
            return res.status(404).json({ error: 'Remisión no encontrada' });
        }
        
        const rem = rows[0];
        
        // Mezclamos valores existentes con los nuevos recibidos
        const finalFotosSalida = fotosSalidaBodega ? JSON.stringify(fotosSalidaBodega) : JSON.stringify(rem.fotos_salida_bodega || []);
        const finalFotosEntrega = fotosEntregaCliente ? JSON.stringify(fotosEntregaCliente) : JSON.stringify(rem.fotos_entrega_cliente || []);
        const finalFotosRetorno = fotosRetorno ? JSON.stringify(fotosRetorno) : JSON.stringify(rem.fotos_retorno || []);
        const finalFechaRetorno = fechaRetornoEfectiva || rem.fecha_retorno_efectiva;
        const finalEstado = estado || rem.estado;
        const finalItems = items ? JSON.stringify(items) : JSON.stringify(rem.items || []);
        const finalNotas = notas !== undefined ? notas : rem.notas;

        await pool.query(
            `UPDATE remisiones 
             SET fotos_salida_bodega = $1, 
                 fotos_entrega_cliente = $2, 
                 fotos_retorno = $3, 
                 fecha_retorno_efectiva = $4,
                 estado = $5,
                 items = $6,
                 notas = $7
             WHERE id = $8`,
            [finalFotosSalida, finalFotosEntrega, finalFotosRetorno, finalFechaRetorno, finalEstado, finalItems, finalNotas, id]
        );

        // Si el estado cambia a Retornada/Devuelta/Finalizada, devolvemos stock disponible
        if (estado === 'Retornada' || estado === 'Devuelta' || estado === 'Finalizada') {
            const itemsList = items || rem.items || [];
            for (const item of itemsList) {
                const prodId = item.id || item.productId;
                const qty = Number(item.qty || item.cantidad || item.quantity || 0);
                if (prodId && qty > 0) {
                    await pool.query(
                        'UPDATE products SET available_stock = LEAST(total_stock, available_stock + $1) WHERE id = $2',
                        [qty, prodId]
                    );
                }
            }
        }

        res.json({ success: true });
    } catch (e) {
        console.error('ERROR ACTUALIZANDO EVIDENCIA:', e.message);
        res.status(500).json({ error: e.message });
    }
});

// ─── TAREA PROGRAMADA: LIMPIEZA DE EVIDENCIAS FOTOGRÁFICAS (> 1 AÑO) ────────
setInterval(async () => {
    console.log('🧹 Iniciando tarea programada: Limpieza de evidencias fotográficas > 1 año...');
    try {
        const query = `
            SELECT id, fotos_salida_bodega, fotos_entrega_cliente, fotos_retorno 
            FROM remisiones 
            WHERE fecha_retorno_efectiva < NOW() - INTERVAL '1 year'
        `;
        const { rows } = await pool.query(query);
        if (rows.length > 0) {
            console.log(`🧹 Se encontraron ${rows.length} remisiones antiguas para limpiar.`);
            for (const row of rows) {
                // En un caso real aquí se eliminarían de Cloudinary/S3 usando las URLs
                await pool.query(
                    `UPDATE remisiones 
                     SET fotos_salida_bodega = '[]', 
                         fotos_entrega_cliente = '[]', 
                         fotos_retorno = '[]' 
                     WHERE id = $1`,
                    [row.id]
                );
            }
            console.log('✅ Limpieza de evidencias completada.');
        } else {
            console.log('✅ No se encontraron evidencias antiguas para limpiar.');
        }
    } catch (e) {
        console.error('❌ Error en tarea programada de limpieza:', e.message);
    }
}, 24 * 60 * 60 * 1000); // Cada 24 horas


// ─── Serve React en Producción ───────────────────────────────────────────────
if (process.env.NODE_ENV === 'production' || process.env.RAILWAY_ENVIRONMENT) {
    const distPath = path.join(__dirname, 'dist');
    if (fs.existsSync(distPath)) {
        app.use(express.static(distPath));
        app.use((req, res, next) => {
            if (req.method === 'GET' && !req.path.startsWith('/api')) {
                res.sendFile(path.join(distPath, 'index.html'));
            } else { next(); }
        });
    } else {
        console.log('ℹ️  "dist" folder not found. Skipping static file serving.');
    }
}

app.listen(PORT, () => console.log(`🚀 Servidor corriendo en puerto ${PORT}`));
