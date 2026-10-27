import test from 'node:test';
import assert from 'node:assert/strict';
import { calculateCorteRentalLines } from './corteBillingUtils.js';
import { calculatePendingCorteTransport } from './corteInvoiceUtils.js';

const clientId = 'CLIENT-TEST';
const obraId = 'OBRA-TEST';
const product = (id = 'A', overrides = {}) => ({
    id, name: `Equipo ${id}`, category: 'Equipos', value: 10,
    tipoCobro: 'Día', esquemaCobro: 'Calendario', ...overrides
});
const item = (productId = 'A', overrides = {}) => ({
    productId, nombre: `Equipo ${productId}`, cantidad: 1, cantidadDevuelta: 1,
    tarifaDia: 10, tipoCobro: 'Día',
    devoluciones: [{ fecha: '2026-01-05', cantidad: 1 }], ...overrides
});
const remission = (overrides = {}) => ({
    id: 'REM-TEST', clientId, obraId, fecha: '2026-01-01',
    estado: 'Cerrada', items: [item()], ...overrides
});
const invoice = (overrides = {}) => ({
    id: 'F-TEST', clientId, obraId, date: '2026-01-05',
    status: 'Paid', amount: 30, paidAmount: 30,
    items: [{ remId: 'REM-TEST', productId: 'A', nombre: 'Equipo A', quantity: 1, days: 3, price: 10 }],
    cortes: [{ fechaInicio: '2026-01-01', fechaCorte: '2026-01-03' }], ...overrides
});
const calculate = (overrides = {}) => calculateCorteRentalLines({
    remisiones: [remission()], invoices: [], products: [product()],
    fechaInicio: '2026-01-01', fechaCorte: '2026-01-10',
    ...overrides
});
const charged = result => result.lineas.filter(line => Number(line.subtotal) > 0);
const total = result => charged(result).reduce((sum, line) => sum + Number(line.subtotal), 0);
const unitDays = result => charged(result).reduce((sum, line) => sum + Number(line.cantidad) * Number(line.dias), 0);
const requireNoCharge = result => {
    assert.equal(total(result), 0);
    assert.equal(charged(result).length, 0);
};
const requireIssue = result => {
    assert.ok(Array.isArray(result.issues));
    assert.ok(result.issues.length > 0, 'Los datos ambiguos requieren una observación visible.');
    requireNoCharge(result);
};
const asInvoiceItems = lines => lines.map(line => ({
    remId: line.remId, remFecha: line.remFecha,
    productId: line.productId, nombre: line.equipo,
    quantity: line.cantidad, days: line.dias, price: line.tarifaDia,
    tipoCobro: line.isServ ? 'Servicio' : (line.isHora ? 'Hora' : 'Día'),
    rentalCoverage: structuredClone(line.billingCoverage)
}));
const savedInvoice = (lines, overrides = {}) => invoice({
    id: 'F-NUEVA', date: '2026-01-10', status: 'Pending', paidAmount: 0,
    amount: lines.reduce((sum, line) => sum + Number(line.subtotal), 0),
    cortes: [{ fechaInicio: '2026-01-01', fechaCorte: '2026-01-10' }],
    items: asInvoiceItems(lines), ...overrides
});
const adjustmentKey = line => line.key;

test('REM-238: una cerrada con septiembre pagado conserva únicamente los días pendientes de octubre', () => {
    const products = [
        product('146', { name: 'Formaleta alta', value: 80000, esquemaCobro: 'Lunes-Sábado' }),
        product('126', { name: 'Formaleta modular', value: 25000 }),
        product('ENT', { name: 'Entrega equipos', category: 'Servicios', tipoCobro: 'Servicio', value: 70000 }),
        product('REC', { name: 'Recogida equipos', category: 'Servicios', tipoCobro: 'Servicio', value: 70000 })
    ];
    const rem = remission({
        id: 'REM-238', fecha: '2026-09-29', facturaId: 'F-182',
        items: [
            item('146', { nombre: 'Formaleta alta', cantidad: 2, cantidadDevuelta: 2, tarifaDia: 80000,
                devoluciones: [{ fecha: '2026-10-03', cantidad: 1 }, { fecha: '2026-10-09', cantidad: 1 }] }),
            item('126', { nombre: 'Formaleta modular', tarifaDia: 25000,
                devoluciones: [{ fecha: '2026-10-09', cantidad: 1 }] }),
            item('ENT', { nombre: 'Entrega equipos', tipoCobro: 'Servicio', tarifaDia: 70000, cantidadDevuelta: 0, devoluciones: [] }),
            item('REC', { nombre: 'Recogida equipos', tipoCobro: 'Servicio', tarifaDia: 70000, cantidadDevuelta: 0, devoluciones: [] })
        ]
    });
    const paid = invoice({
        id: 'F-182', date: '2026-09-30', amount: 560000, paidAmount: 560000,
        cortes: [{ fechaInicio: '2026-09-01', fechaCorte: '2026-09-30' }],
        items: [
            { remId: rem.id, productId: 'Formaleta alta', nombre: 'Formaleta alta', quantity: 2, days: 2, price: 80000 },
            { remId: rem.id, productId: 'Formaleta modular', nombre: 'Formaleta modular', quantity: 1, days: 2, price: 50000 },
            { remId: rem.id, productId: 'Entrega equipos', nombre: 'Entrega equipos', quantity: 1, days: 1, price: 70000 },
            { remId: rem.id, productId: 'Recogida equipos', nombre: 'Recogida equipos', quantity: 1, days: 1, price: 70000 }
        ]
    });
    const result = calculate({ remisiones: [rem], invoices: [paid], products, fechaInicio: '2026-10-01', fechaCorte: '2026-10-27' });
    assert.equal(total(result), 1105000);
    assert.equal(charged(result).filter(line => line.productId === '146').reduce((sum, line) => sum + line.subtotal, 0), 880000);
    assert.equal(charged(result).filter(line => line.productId === '126').reduce((sum, line) => sum + line.subtotal, 0), 225000);
    assert.ok(charged(result).every(line => !line.isServ));
    assert.equal(result.issues.length, 0);
});

test('REM-123: alquiler y servicios completamente facturados no reaparecen', () => {
    const products = [product('A', { value: 80000 }), product('B', { value: 1000 }),
        product('S', { name: 'Transporte de prueba', category: 'Servicios', tipoCobro: 'Servicio', value: 60000 })];
    const rem = remission({ id: 'REM-123', fecha: '2026-08-06', facturaId: 'F-079', items: [
        item('A', { tarifaDia: 80000, devoluciones: [{ fecha: '2026-08-08', cantidad: 1 }] }),
        item('B', { tarifaDia: 1000, devoluciones: [{ fecha: '2026-08-08', cantidad: 1 }] }),
        item('S', { nombre: 'Transporte de prueba', tarifaDia: 60000, tipoCobro: 'Servicio', cantidadDevuelta: 0, devoluciones: [] })
    ] });
    const paid = invoice({ id: 'F-079', date: '2026-08-27', amount: 303000, paidAmount: 303000,
        cortes: [{ fechaInicio: '2026-08-01', fechaCorte: '2026-08-31' }],
        items: rem.items.map(i => ({ remId: rem.id, productId: i.productId, nombre: i.nombre, quantity: 1, days: i.tipoCobro === 'Servicio' ? 1 : 3, price: i.tarifaDia }))
    });
    requireNoCharge(calculate({ remisiones: [rem], invoices: [paid], products, fechaInicio: '2026-08-01', fechaCorte: '2026-10-27' }));
});

for (const status of ['Pending', 'Partial', 'Paid']) {
    test(`la factura ${status} ya cubre sus días aunque el pago esté incompleto`, () => {
        const result = calculate({ invoices: [invoice({ status, paidAmount: status === 'Paid' ? 30 : 5 })] });
        assert.equal(total(result), 20);
        assert.equal(unitDays(result), 2);
    });
}

test('facturar el producto A no cubre al producto B de la misma remisión', () => {
    const result = calculate({
        remisiones: [remission({ items: [item('A'), item('B')] })],
        products: [product('A'), product('B')],
        invoices: [invoice({ cortes: [{ fechaInicio: '2026-01-01', fechaCorte: '2026-01-05' }] })]
    });
    assert.equal(total(result), 50);
    assert.ok(charged(result).every(line => line.productId === 'B'));
});

test('un producto ya devuelto en septiembre no bloquea otro que sigue en obra en octubre', () => {
    const rem = remission({ fecha: '2026-09-01', estado: 'Parcial', items: [
        item('A', { devoluciones: [{ fecha: '2026-09-10', cantidad: 1 }] }),
        item('B', { cantidadDevuelta: 0, devoluciones: [] })
    ] });
    const inv = invoice({ date: '2026-09-30', items: [
        { remId: rem.id, productId: 'A', nombre: 'Equipo A (Dev: 2026-09-10)', quantity: 1, days: 10, price: 10 },
        { remId: rem.id, productId: 'B', nombre: 'Equipo B', quantity: 1, days: 30, price: 10 }
    ], cortes: [{ fechaInicio: '2026-09-01', fechaCorte: '2026-09-30' }] });
    const result = calculate({ remisiones: [rem], products: [product('A'), product('B')], invoices: [inv],
        fechaInicio: '2026-10-01', fechaCorte: '2026-10-10' });
    assert.equal(total(result), 100);
    assert.ok(charged(result).every(line => line.productId === 'B'));
    assert.equal(result.issues.length, 0);
});

test('una unidad facturada no cubre dos unidades alquiladas en las mismas fechas', () => {
    const rem = remission({ items: [item('A', { cantidad: 2, cantidadDevuelta: 2, devoluciones: [{ fecha: '2026-01-10', cantidad: 2 }] })] });
    const original = calculate({ remisiones: [rem], fechaCorte: '2026-01-05' });
    const linesForOneUnit = charged(original).map(line => ({
        ...line, cantidad: 1, subtotal: Number(line.dias) * Number(line.tarifaDia),
        billingCoverage: { ...line.billingCoverage,
            segments: line.billingCoverage.segments.map(segment => ({ ...segment, quantity: 1 })) }
    }));
    const result = calculate({ remisiones: [rem], invoices: [savedInvoice(linesForOneUnit, {
        cortes: [{ fechaInicio: '2026-01-01', fechaCorte: '2026-01-05' }]
    })] });
    assert.equal(unitDays(result), 15);
    assert.equal(total(result), 150);
});

test('la cobertura de una devolución no se aplica a otra cohorte devuelta después', () => {
    const rem = remission({ items: [item('A', {
        cantidad: 2, cantidadDevuelta: 2,
        devoluciones: [{ fecha: '2026-01-03', cantidad: 1 }, { fecha: '2026-01-05', cantidad: 1 }]
    })] });
    const original = calculate({ remisiones: [rem] });
    const firstCohort = charged(original).filter(line => line.devFecha === '2026-01-03');
    assert.equal(firstCohort.length, 1);
    const result = calculate({ remisiones: [rem], invoices: [savedInvoice(firstCohort)] });
    assert.equal(total(result), 50);
    assert.ok(charged(result).every(line => line.devFecha === '2026-01-05'));
});

test('devolución parcial y equipo todavía en obra conservan cantidades separadas', () => {
    const rem = remission({ estado: 'Parcial', items: [item('A', {
        cantidad: 3, cantidadDevuelta: 1, devoluciones: [{ fecha: '2026-01-03', cantidad: 1 }]
    })] });
    const result = calculate({ remisiones: [rem], fechaCorte: '2026-01-05' });
    assert.equal(unitDays(result), 13);
    assert.equal(total(result), 130);
});

test('dos líneas del mismo producto con identificador estable conservan su propia tarifa y cobertura', () => {
    const rem = remission({ items: [item('A', { remItemId: 'linea-1' }), item('A', { remItemId: 'linea-2', tarifaDia: 20 })] });
    const original = calculate({ remisiones: [rem] });
    const first = charged(original).filter(line => line.remItemKey === 'linea-1');
    assert.equal(first.length, 1);
    const reordered = { ...rem, items: [...rem.items].reverse() };
    const result = calculate({ remisiones: [reordered], invoices: [savedInvoice(first)] });
    assert.equal(total(result), 100);
    assert.ok(charged(result).every(line => line.remItemKey === 'linea-2'));
});

test('asignar identidad estable a una línea antigua conserva la cobertura emitida con su clave legacy', () => {
    const rem = remission({ items: [item('A', { devoluciones: [{ fecha: '2026-01-10', cantidad: 1 }] })] });
    const first = calculate({ remisiones: [rem], fechaCorte: '2026-01-05' });
    const edited = { ...rem, items: rem.items.map(line => ({ ...line, remItemId: 'identidad-asignada-al-editar' })) };
    const next = calculate({ remisiones: [edited], invoices: [savedInvoice(charged(first))] });
    assert.equal(total(next), 50);
    assert.equal(next.issues.length, 0);
});

test('líneas duplicadas legacy sin identidad suficiente requieren revisión y no cargos automáticos', () => {
    requireIssue(calculate({
        remisiones: [remission({ items: [item('A'), item('A', { tarifaDia: 20 })] })],
        invoices: [invoice()]
    }));
});

test('calendario, lunes-sábado y lunes-viernes respetan fechas inclusivas', () => {
    const products = [product('A'), product('B', { esquemaCobro: 'Lunes-Sábado' }), product('C', { esquemaCobro: 'Lunes-Viernes' })];
    const rem = remission({ fecha: '2026-10-01', items: products.map(p => item(p.id, {
        devoluciones: [{ fecha: '2026-10-05', cantidad: 1 }]
    })) });
    const result = calculate({ remisiones: [rem], products, fechaInicio: '2026-10-01', fechaCorte: '2026-10-05' });
    assert.equal(total(result), 120);
    assert.deepEqual(Object.fromEntries(charged(result).map(line => [line.productId, line.dias])), { A: 5, B: 4, C: 3 });
});

test('la unión de cortes superpuestos no descuenta una fecha dos veces', () => {
    const result = calculate({
        remisiones: [remission({ items: [item('A', { devoluciones: [{ fecha: '2026-01-07', cantidad: 1 }] })] })],
        invoices: [invoice(), invoice({ id: 'F-SEGUNDA', cortes: [{ fechaInicio: '2026-01-03', fechaCorte: '2026-01-04' }] })]
    });
    assert.equal(total(result), 30);
    assert.equal(unitDays(result), 3);
});

test('legacy remFecha + days no agrega un segundo período a partir de la fecha de emisión', () => {
    const result = calculate({
        remisiones: [remission({ items: [item('A', { devoluciones: [{ fecha: '2026-02-05', cantidad: 1 }] })] })],
        invoices: [invoice({ date: '2026-02-01', cortes: [], items: [
            { remId: 'REM-TEST', remFecha: '2026-01-01', productId: 'A', nombre: 'Equipo A', quantity: 1, days: 5, price: 10 }
        ] })],
        fechaInicio: '2026-02-01', fechaCorte: '2026-02-05'
    });
    assert.equal(total(result), 50);
});

test('la factura directa sin remId reconoce solo los productos relacionados con la remisión', () => {
    const result = calculate({
        remisiones: [remission({ facturaId: 'F-TEST', items: [item('A'), item('B')] })],
        products: [product('A'), product('B')],
        invoices: [invoice({ items: [{ productId: 'A', nombre: 'Equipo A', quantity: 1, days: 5, price: 10 }],
            cortes: [{ fechaInicio: '2026-01-01', fechaCorte: '2026-01-05' }] })]
    });
    assert.equal(total(result), 50);
    assert.ok(charged(result).every(line => line.productId === 'B'));
});

test('una factura directa sin ítems verificables exige revisión antes de recobrar', () => {
    requireIssue(calculate({ remisiones: [remission({ facturaId: 'F-TEST' })], invoices: [invoice({ items: [] })] }));
});

test('una factura vinculada ausente no convierte automáticamente todo el alquiler en pendiente nuevo', () => {
    requireIssue(calculate({ remisiones: [remission({ facturaId: 'F-AUSENTE' })], invoices: [] }));
});

test('una factura de otra obra no se asigna automáticamente a la remisión actual', () => {
    requireIssue(calculate({ invoices: [invoice({ obraId: 'OTRA-OBRA' })] }));
});

test('un servicio es cobro único y no vuelve a emitirse después de guardar', () => {
    const p = product('S', { name: 'Entrega de prueba', category: 'Servicios', tipoCobro: 'Servicio', value: 30 });
    const rem = remission({ items: [item('S', { nombre: p.name, tipoCobro: 'Servicio', tarifaDia: 30, cantidadDevuelta: 0, devoluciones: [] })] });
    const original = calculate({ remisiones: [rem], products: [p] });
    assert.equal(total(original), 30);
    requireNoCharge(calculate({ remisiones: [rem], products: [p], invoices: [savedInvoice(charged(original))], fechaCorte: '2026-01-31' }));
});

test('un servicio legacy ya facturado se reconoce por su descripción histórica', () => {
    const p = product('S', { name: 'Entrega de prueba', category: 'Servicios', tipoCobro: 'Servicio', value: 30 });
    const rem = remission({ items: [item('S', { nombre: p.name, tipoCobro: 'Servicio', tarifaDia: 30, cantidadDevuelta: 0, devoluciones: [] })] });
    const inv = invoice({ items: [{ remId: rem.id, productId: p.name, nombre: p.name, quantity: 1, days: 1, price: 30 }] });
    requireNoCharge(calculate({ remisiones: [rem], products: [p], invoices: [inv] }));
});

const calculateHours = (start, end) => {
    const minutes = text => text.split(':').map(Number).reduce((hours, value, index) => index === 0 ? value * 60 : hours + value, 0);
    return (minutes(end) - minutes(start)) / 60;
};
const hourlyFixture = () => ({
    remisiones: [remission({ fecha: '2026-01-03', items: [item('H', {
        nombre: 'Equipo horario', tipoCobro: 'Hora', horaInicio: '08:00', horaFin: '12:00', horasCalculadas: 4,
        devoluciones: [{ fecha: '2026-01-03', cantidad: 1 }]
    })] })],
    products: [product('H', { name: 'Equipo horario', tipoCobro: 'Hora' })], calculateHours
});

test('un evento por horas facturado no vuelve a cobrarse al reincorporar una cerrada', () => {
    const fixture = hourlyFixture();
    const original = calculate(fixture);
    assert.equal(total(original), 40);
    requireNoCharge(calculate({ ...fixture, invoices: [savedInvoice(charged(original))] }));
});

test('cambiar el horario de un evento ya facturado exige revisión, sin cargos nuevos automáticos', () => {
    const fixture = hourlyFixture();
    const original = calculate(fixture);
    const first = charged(original)[0];
    assert.deepEqual(first.billingCoverage.hourly, { start: '08:00', end: '12:00', hours: 4 });
    const changed = calculate({ ...fixture, invoices: [savedInvoice(charged(original))],
        customHorasInicio: { [first.key]: '08:00' }, customHorasFin: { [first.key]: '14:00' } });
    requireIssue(changed);
});

test('un evento horario legacy completamente facturado tampoco reaparece', () => {
    const fixture = hourlyFixture();
    const inv = invoice({ cortes: [{ fechaInicio: '2026-01-03', fechaCorte: '2026-01-03' }],
        items: [{ remId: 'REM-TEST', productId: 'H', nombre: 'Equipo horario', quantity: 1, days: 4, price: 10, tipoCobro: 'Hora' }] });
    requireNoCharge(calculate({ ...fixture, invoices: [inv] }));
});

test('cobertura horaria legacy parcial requiere revisión en lugar de recobrar el evento completo', () => {
    const fixture = hourlyFixture();
    const inv = invoice({ cortes: [{ fechaInicio: '2026-01-03', fechaCorte: '2026-01-03' }],
        items: [{ remId: 'REM-TEST', productId: 'H', nombre: 'Equipo horario', quantity: 1, days: 2, price: 10, tipoCobro: 'Hora' }] });
    requireIssue(calculate({ ...fixture, invoices: [inv] }));
});

test('facturar una cohorte horaria no cubre otra devuelta en distinta fecha', () => {
    const fixture = hourlyFixture();
    fixture.remisiones[0].items[0] = { ...fixture.remisiones[0].items[0],
        cantidad: 2, cantidadDevuelta: 2,
        devoluciones: [{ fecha: '2026-01-03', cantidad: 1 }, { fecha: '2026-01-04', cantidad: 1 }]
    };
    const original = calculate(fixture);
    const first = charged(original).filter(line => line.devFecha === '2026-01-03');
    assert.equal(first.length, 1);
    const next = calculate({ ...fixture, invoices: [savedInvoice(first)] });
    assert.equal(total(next), 40);
    assert.ok(charged(next).every(line => line.devFecha === '2026-01-04'));
});

test('guardar un corte y recalcularlo no emite de nuevo los mismos cargos', () => {
    const original = calculate();
    const lines = charged(original);
    assert.ok(lines.length > 0);
    for (const line of lines) {
        assert.equal(line.billingCoverage.version, 1);
        assert.equal(line.billingCoverage.productId, line.productId);
        assert.equal(line.billingCoverage.itemKey, line.remItemKey);
        assert.ok(Array.isArray(line.billingCoverage.segments));
        assert.ok(line.billingCoverage.segments.length > 0);
    }
    const wireInvoice = JSON.parse(JSON.stringify(savedInvoice(lines)));
    requireNoCharge(calculate({ invoices: [wireInvoice] }));
});

test('días ajustados manualmente quedan cubiertos al emitir la factura', () => {
    const base = calculate();
    const key = adjustmentKey(charged(base)[0]);
    assert.ok(key);
    const adjusted = calculate({ customDays: { [key]: 2 } });
    assert.equal(total(adjusted), 20);
    requireNoCharge(calculate({ invoices: [savedInvoice(charged(adjusted))] }));
});

test('un festivo descontado no se recobra en un corte posterior', () => {
    const adjusted = calculate({ aplicarFestivos: true, isHoliday: date => date === '2026-01-02' });
    assert.equal(total(adjusted), 40);
    requireNoCharge(calculate({ invoices: [savedInvoice(charged(adjusted))], aplicarFestivos: false }));
});

test('festivos ajustados manualmente se conservan como días cubiertos', () => {
    const base = calculate();
    const key = adjustmentKey(charged(base)[0]);
    const adjusted = calculate({ customFestivos: { [key]: 2 } });
    assert.equal(total(adjusted), 30);
    requireNoCharge(calculate({ invoices: [savedInvoice(charged(adjusted))] }));
});

test('adelantar la fecha de corte de una cohorte solo cubre hasta esa fecha', () => {
    const base = calculate();
    const key = charged(base)[0].dateKey;
    assert.ok(key);
    const adjusted = calculate({ customDates: { [key]: '2026-01-03' } });
    assert.equal(total(adjusted), 30);
    const next = calculate({ invoices: [savedInvoice(charged(adjusted))] });
    assert.equal(total(next), 20);
});

test('una cantidad devuelta sin historial fechado requiere revisión', () => {
    requireIssue(calculate({ remisiones: [remission({ items: [item('A', { cantidadDevuelta: 1, devoluciones: [] })] })] }));
});

test('un producto eliminado sin esquema histórico requiere revisión antes de cobrar', () => {
    requireIssue(calculate({ products: [] }));
});

test('un producto eliminado conserva cálculo si el ítem guarda su esquema histórico', () => {
    const result = calculate({ products: [], remisiones: [remission({ items: [item('A', { esquemaCobro: 'Calendario' })] })] });
    assert.equal(total(result), 50);
    assert.equal(result.issues.length, 0);
});

test('una devolución anterior al despacho no genera días inventados', () => {
    requireIssue(calculate({ remisiones: [remission({ items: [item('A', { devoluciones: [{ fecha: '2025-12-31', cantidad: 1 }] })] })] }));
});

test('intervalo de corte invertido no genera el día por defecto del cálculo anterior', () => {
    requireIssue(calculate({ fechaInicio: '2026-01-10', fechaCorte: '2026-01-01' }));
});

test('las remisiones canceladas y las facturas canceladas no producen ni cubren cargos', () => {
    requireNoCharge(calculate({ remisiones: [remission({ estado: 'Cancelada' })] }));
    assert.equal(total(calculate({ remisiones: [remission({ facturaId: 'F-TEST' })],
        invoices: [invoice({ status: 'Cancelada' })] })), 50);
});

test('la auditoría del corte no modifica remisiones, facturas ni productos de entrada', () => {
    const input = { remisiones: [remission()], products: [product()], invoices: [invoice()], fechaInicio: '2026-01-01', fechaCorte: '2026-01-10' };
    const before = JSON.stringify(input);
    calculateCorteRentalLines(input);
    assert.equal(JSON.stringify(input), before);
});

const transport = (overrides = {}) => calculatePendingCorteTransport({
    remisiones: [remission({ transporte: 70000 })], invoices: [], remIdsConCobro: ['REM-TEST'],
    fechaInicio: '2026-01-01', fechaCorte: '2026-01-10', ...overrides
});

test('el primer corte asigna el transporte del despacho a su remisión', () => {
    const result = transport();
    assert.equal(result.total, 70000);
    assert.deepEqual(result.transportes, [{ remId: 'REM-TEST', monto: 70000 }]);
});

test('facturar después otro producto pendiente no vuelve a cobrar transporte emitido en una Pending', () => {
    const first = invoice({ status: 'Pending', paidAmount: 0, transporte: 70000,
        cortes: [{ fechaInicio: '2026-01-01', fechaCorte: '2026-01-10', transportes: [{ remId: 'REM-TEST', monto: 70000 }] }] });
    const result = transport({ invoices: [first] });
    assert.equal(result.total, 0);
    assert.equal(result.transportes.length, 0);
});

test('el transporte legacy de una factura con una sola remisión tampoco se duplica', () => {
    assert.equal(transport({ invoices: [invoice({ transporte: 70000, status: 'Partial', paidAmount: 0 })] }).total, 0);
});

test('un transporte emitido parcialmente deja solo la diferencia sin facturar', () => {
    const result = transport({ invoices: [invoice({ transporte: 30000,
        cortes: [{ fechaInicio: '2026-01-01', fechaCorte: '2026-01-10', transportes: [{ remId: 'REM-TEST', monto: 30000 }] }] })] });
    assert.equal(result.total, 40000);
    assert.deepEqual(result.transportes, [{ remId: 'REM-TEST', monto: 40000 }]);
});

test('un transporte legacy de varias remisiones sin asignación genera aviso y no un recobro', () => {
    const grouped = invoice({ transporte: 90000, items: [
        { remId: 'REM-TEST', productId: 'A', quantity: 1, days: 1, price: 10 },
        { remId: 'REM-OTRA', productId: 'B', quantity: 1, days: 1, price: 10 }
    ] });
    const result = transport({ invoices: [grouped] });
    assert.equal(result.total, 0);
    assert.ok(result.issues.some(issue => issue.code === 'AMBIGUOUS_TRANSPORT'));
});

test('una factura cancelada no marca el transporte como facturado', () => {
    assert.equal(transport({ invoices: [invoice({ transporte: 70000, status: 'Cancelada' })] }).total, 70000);
});

test('el transporte del despacho no se arrastra a otro mes ni a remisiones excluidas del corte', () => {
    assert.equal(transport({ fechaInicio: '2026-02-01', fechaCorte: '2026-02-10' }).total, 0);
    assert.equal(transport({ remIdsConCobro: [] }).total, 0);
});
