import { Pool } from 'pg';
import dotenv from 'dotenv';
dotenv.config();
const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
});

async function run() {
    try {
        await pool.query(
            `INSERT INTO products (id,name,category,value,total_stock,available_stock,image,proveedor,fecha_compra,costo_adquisicion,proximo_mantenimiento)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)`,
            ["P-999", "Test", "Other", 100, 1, 1, "image_url", "",
                null, "", null]
        );
        console.log("SUCCESS");
    } catch(e) {
        console.error("ERROR:", e.message);
    }
    process.exit(0);
}
run();
