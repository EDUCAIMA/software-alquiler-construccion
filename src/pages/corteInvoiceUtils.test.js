import test from 'node:test';
import assert from 'node:assert/strict';
import { calculatePendingCorteTransport } from './corteInvoiceUtils.js';

const remisiones = [{ id: 'R-A', clientId: 'C', fecha: '2026-10-01', transporte: 70000 }];
const calculate = overrides => calculatePendingCorteTransport({
    remisiones, invoices: [], remIdsConCobro: ['R-A'], fechaInicio: '2026-10-01', fechaCorte: '2026-10-31', ...overrides
});

test('asignación explícita no cubre el transporte de otra remisión de la misma factura', () => {
    const result = calculate({ invoices: [{ id: 'F', status: 'Pending', transporte: 70000,
        items: [{ remId: 'R-A' }, { remId: 'R-B' }], cortes: [{ transportes: [{ remId: 'R-B', monto: 70000 }] }] }] });
    assert.equal(result.total, 70000);
    assert.equal(result.issues.length, 0);
});

test('factura directa legacy identifica el transporte aunque no tenga remId en sus ítems', () => {
    const result = calculate({ remisiones: [{ ...remisiones[0], facturaId: 'F' }],
        invoices: [{ id: 'F', status: 'Paid', transporte: 70000, items: [] }] });
    assert.equal(result.total, 0);
});

test('una factura parcialmente pagada ya cubre todo el transporte que fue emitido', () => {
    const result = calculate({ invoices: [{ id: 'F', status: 'Partial', paidAmount: 10000,
        transporte: 70000, items: [{ remId: 'R-A' }] }] });
    assert.equal(result.total, 0);
});
