import { Pool } from 'pg';
import dotenv from 'dotenv';
dotenv.config();

const isRailway = process.env.DATABASE_URL?.includes('rlwy.net');
const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: isRailway ? { rejectUnauthorized: false } : false
});

async function run() {
    try {
        const id = 'P-TEST-123';
        const name = "Test Name";
        const category = "";
        const value = 0;
        const totalStock = 1;
        const availableStock = 1;
        const image = "";
        const proveedor = "";
        const fechaCompra = "";
        const costoAdquisicion = "";
        const proximoMantenimiento = "";

        await pool.query(
            `INSERT INTO products (id,name,category,value,total_stock,available_stock,image,proveedor,fecha_compra,costo_adquisicion,proximo_mantenimiento)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)`,
            [id, name, category, value, totalStock, availableStock, image, proveedor,
                fechaCompra || null, costoAdquisicion || null, proximoMantenimiento || null]
        );
        console.log("INSERT SUCCESS");

        await pool.query('DELETE FROM products WHERE id = $1', [id]);
        console.log("DELETE SUCCESS");

    } catch (e) {
        console.error("PG ERROR:", e.message);
    } finally {
        await pool.end();
    }
}
run();
