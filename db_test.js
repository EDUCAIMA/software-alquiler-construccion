
import { Pool } from 'pg';
import dotenv from 'dotenv';
dotenv.config();

console.log("Iniciando prueba de conexión...");
console.log("URL:", process.env.DATABASE_URL.split('@')[1]); // Log only the host part for safety

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
});

async function test() {
    try {
        console.log("Intentando conectar al pool...");
        const client = await pool.connect();
        console.log("¡Conexión exitosa!");
        const res = await client.query('SELECT NOW()');
        console.log("Hora del servidor DB:", res.rows[0]);
        client.release();
    } catch (err) {
        console.error("Error en la prueba:", err.message);
    } finally {
        await pool.end();
        console.log("Prueba finalizada.");
    }
}

test();
