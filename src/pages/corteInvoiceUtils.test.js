import test from 'node:test';
import assert from 'node:assert/strict';
import { calculatePendingCorteTransport } from './corteInvoiceUtils.js';
import { readCorteRecords, requireCorteRecords } from './corteDataUtils.js';

test('obras y abonos serializados se leen conservando sus datos', () => {
    const records = [{ id: 1, monto: 50000 }];
    assert.deepEqual(requireCorteRecords(JSON.stringify(records), 'los abonos'), records);
    assert.equal(requireCorteRecords(records, 'las obras'), records);
    assert.deepEqual(readCorteRecords(undefined), []);
});

test('datos ilegibles del cliente producen un error descriptivo para el modal', () => {
    for (const value of ['incompleto', '{}', [null], [5], [[{}]]]) {
        assert.equal(readCorteRecords(value), null);
        assert.throws(() => requireCorteRecords(value, 'los abonos'), /No se pueden leer los abonos/);
    }
});

const remisiones = [{ id: 'R-A', clientId: 'C', fecha: '2026-10-01', transporte: 70000 }];
const calculate = overrides => calculatePendingCorteTransport({
    remisiones, invoices: [], remIdsConCobro: ['R-A'], fechaInicio: '2026-10-01', fechaCorte: '2026-10-31', ...overrides
});

test('abrir sin remisiones seleccionadas no recorre historiales de transporte', () => {
    assert.deepEqual(calculate({ remIdsConCobro: [], invoices: [{ id: 'F', cortes: [null] }] }),
        { total: 0, transportes: [], issues: [] });
});

test('historial de transporte ilegible no se convierte en un nuevo cobro', () => {
    for (const overrides of [{ cortes: [null] }, { items: [null] }, { cortes: [{ transportes: [null] }] }, { cortes: 'incompleto' }]) {
        const result = calculate({ invoices: [{ id: 'F', ...overrides }] });
        assert.equal(result.total, 0);
        assert.equal(result.transportes.length, 0);
        assert.ok(result.issues.some(issue => issue.code === 'INVALID_TRANSPORT_HISTORY'));
    }
});

test('asignaciones de transporte serializadas conservan la cobertura emitida', () => {
    const result = calculate({ invoices: [{ id: 'F', cortes: JSON.stringify([
        { transportes: JSON.stringify([{ remId: 'R-A', monto: 70000 }]) }
    ]) }] });
    assert.equal(result.total, 0);
    assert.equal(result.issues.length, 0);
});

test('historial inválido de otro cliente no bloquea el transporte del corte actual', () => {
    const result = calculate({ invoices: [{ id: 'F-OTRO', clientId: 'OTRO', cortes: [null] }] });
    assert.equal(result.total, 70000);
    assert.equal(result.issues.length, 0);
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
