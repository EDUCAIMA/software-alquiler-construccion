import pg from 'pg';
const { Pool } = pg;
import dotenv from 'dotenv';
dotenv.config();

const pool = new Pool({
    connectionString: process.env.DATABASE_URL
});

async function findDebt() {
    try {
        const resClients = await pool.query('SELECT id, name, debt FROM clients WHERE debt > 0');
        console.log('--- Clientes con Deuda ---');
        resClients.rows.forEach(c => {
            console.log(`${c.id}: ${c.name} - $${parseFloat(c.debt).toLocaleString()}`);
        });

        const resInvoices = await pool.query("SELECT id, client_id, amount, status FROM invoices WHERE status = 'Pending'");
        console.log('\n--- Facturas Pendientes ---');
        resInvoices.rows.forEach(i => {
            console.log(`${i.id}: Cliente ${i.client_id} - $${parseFloat(i.amount).toLocaleString()}`);
        });

        const totalDebt = resClients.rows.reduce((s, c) => s + parseFloat(c.debt), 0);
        console.log(`\nTotal Deuda Clientes: $${totalDebt.toLocaleString()}`);

        const totalPending = resInvoices.rows.reduce((s, i) => s + parseFloat(i.amount), 0);
        console.log(`Total Facturas Pendientes: $${totalPending.toLocaleString()}`);

    } catch (e) {
        console.error(e);
    } finally {
        await pool.end();
    }
}

findDebt();
