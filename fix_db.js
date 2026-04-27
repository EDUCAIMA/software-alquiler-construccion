import pkg from 'pg';
const { Pool } = pkg;
import dotenv from 'dotenv';
dotenv.config();

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.DATABASE_URL.includes('rlwy.net') ? { rejectUnauthorized: false } : false
});

async function fixData() {
    const client = await pool.connect();
    try {
        console.log('🔍 Iniciando limpieza de datos...');

        // 1. Corregir items en remisiones (NaN o undefined)
        const { rows: rems } = await client.query('SELECT id, items FROM remisiones');
        for (const rem of rems) {
            let changed = false;
            const fixedItems = rem.items.map(item => {
                // Si falta cantidad pero existe quantity, o viceversa
                const qty = item.cantidad !== undefined ? item.cantidad : (item.quantity !== undefined ? item.quantity : 0);
                const name = item.nombre || item.name || 'Equipo sin nombre';
                const price = item.tarifaDia !== undefined ? item.tarifaDia : (item.price !== undefined ? item.price : 0);
                
                if (item.cantidad === undefined || item.nombre === undefined || isNaN(item.cantidad)) {
                    changed = true;
                }

                return {
                    ...item,
                    cantidad: Number(qty) || 0,
                    nombre: name,
                    tarifaDia: Number(price) || 0,
                    cantidadDevuelta: Number(item.cantidadDevuelta) || 0
                };
            });

            if (changed) {
                console.log(`✅ Reparando Remisión ${rem.id}`);
                await client.query('UPDATE remisiones SET items = $1 WHERE id = $2', [JSON.stringify(fixedItems), rem.id]);
            }
        }

        // 2. Corregir stock de productos (si hay NaN)
        const { rows: prods } = await client.query('SELECT id, available_stock FROM products');
        for (const prod of prods) {
            if (isNaN(prod.available_stock) || prod.available_stock === null) {
                console.log(`✅ Reparando Stock de Producto ${prod.id}`);
                await client.query('UPDATE products SET available_stock = total_stock WHERE id = $1', [prod.id]);
            }
        }

        console.log('✨ Limpieza completada.');
    } catch (e) {
        console.error('❌ Error:', e);
    } finally {
        client.release();
        await pool.end();
    }
}

fixData();
