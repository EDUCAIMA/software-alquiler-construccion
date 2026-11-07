// Pure billing calculation. Dates are calendar dates (UTC is used only to avoid
// time-zone/DST arithmetic); no invoice, remisión or product is changed here.
import { readCorteRecords } from './corteDataUtils.js';
const DAY = 86400000;
const EPSILON = 1e-8;
const id = value => String(value ?? '').trim();
const sameId = (a, b) => id(a) !== '' && id(a) === id(b);
const num = value => value === '' || value === null || value === undefined ? null :
    (Number.isFinite(Number(value)) ? Number(value) : null);
const fold = value => String(value ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();
const arr = value => readCorteRecords(value) || [];
const validArray = value => readCorteRecords(value) !== null;
const dayOf = value => {
    if (value instanceof Date && !Number.isFinite(value.getTime())) return null;
    const text = value instanceof Date ? value.toISOString().slice(0, 10) : String(value ?? '').slice(0, 10);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(text)) return null;
    const [y, m, d] = text.split('-').map(Number);
    const timestamp = Date.UTC(y, m - 1, d);
    return new Date(timestamp).toISOString().slice(0, 10) === text ? timestamp / DAY : null;
};
const textOf = day => new Date(day * DAY).toISOString().slice(0, 10);
const cancelled = status => ['cancelada', 'cancelado', 'cancelled', 'canceled', 'anulada', 'anulado', 'void'].includes(fold(status));
const nameOf = value => fold(value)
    .replace(/\s*\((?:dev(?:\.\s*previa)?|corte)\s*:\s*\d{4}-\d{2}-\d{2}\)\s*/gi, ' ')
    .replace(/\s+/g, ' ').trim();
const returnMarker = item => {
    const match = String(item.nombre || item.name || item.productId || '').match(/\((dev(?:\.\s*previa)?|corte)\s*:\s*(\d{4}-\d{2}-\d{2})\)/i);
    return match && !fold(match[1]).startsWith('corte') ? match[2] : null;
};
const isService = (item = {}, product = {}) => {
    const descriptor = fold([item.category, item.tipoCobro, item.esquemaCobro, item.nombre, item.name,
        product.category, product.tipoCobro, product.esquemaCobro, product.nombre, product.name].filter(Boolean).join(' '));
    return ['servicio', 'servio ', 'unica vez', 'mano de obra', 'transporte', 'entrega', 'recogida',
        'flete', 'acarreo', 'armado', 'desarmado', 'deposito', 'cargo por'].some(term => descriptor.includes(term));
};
const schemeOf = value => {
    const normalized = fold(value || 'Calendario').replace(/[–—]/g, '-').replace(/\s+/g, '');
    if (normalized === 'calendario') return 'Calendario';
    if (normalized === 'lunes-sabado') return 'Lunes-Sábado';
    if (normalized === 'lunes-viernes') return 'Lunes-Viernes';
    return null;
};
const allowedDay = (day, scheme) => {
    const weekday = new Date(day * DAY).getUTCDay();
    return !(weekday === 0 && scheme !== 'Calendario') && !(weekday === 6 && scheme === 'Lunes-Viernes');
};
const overrideNumber = (map, key, fallback) => Object.prototype.hasOwnProperty.call(map, key) && num(map[key]) !== null ? Math.max(0, Number(map[key])) : fallback;
const encode = value => encodeURIComponent(String(value));

const cutsOutsideWindow = (invoice, start, end) => {
    if (!validArray(invoice.cortes)) return false;
    const cuts = arr(invoice.cortes);
    return cuts.length > 0 && cuts.every(cut => {
        const from = dayOf(cut.fechaInicio), to = dayOf(cut.fechaCorte);
        return from !== null && to !== null && from <= to && (to < start || from > end);
    });
};

function segmentsFromDays(days, quantity) {
    const result = [];
    for (const day of days) {
        const last = result.at(-1);
        if (last && day === last.endDay + 1) { last.endDay = day; last.end = textOf(day); }
        else result.push({ start: textOf(day), end: textOf(day), quantity, endDay: day });
    }
    return result.map(({ start, end, quantity: qty }) => ({ start, end, quantity: qty }));
}

export function calculateCorteRentalLines({
    remisiones = [], invoices = [], products = [], auditLogs = [], fechaInicio, fechaCorte,
    customDates = {}, customDays = {}, customFestivos = {}, customHorasInicio = {}, customHorasFin = {},
    aplicarFestivos = false, isHoliday = () => false, calculateHours = () => 0
} = {}) {
    const lineas = [];
    const issues = [];
    const issueKeys = new Set();
    const windowStart = dayOf(fechaInicio);
    const windowEnd = dayOf(fechaCorte);
    const report = (code, rem, info, message, invoiceId) => {
        const issue = { code, remId: id(rem?.id), productId: id(info?.productId), itemKey: info?.itemKey || '', message,
            ...(invoiceId ? { invoiceId: id(invoiceId) } : {}) };
        const key = JSON.stringify(issue);
        if (!issueKeys.has(key)) { issueKeys.add(key); issues.push(issue); }
    };
    if (windowStart === null || windowEnd === null || windowStart > windowEnd) {
        report('INVALID_WINDOW', null, null, 'Selecciona un rango de fechas válido para calcular el corte.');
        return { lineas, issues };
    }
    const productMap = new Map(products.map(product => [id(product.id), product]));
    const validInvoices = invoices.filter(invoice => !cancelled(invoice.status));
    // Un registro vacío no confirma una eliminación ni debe cerrar el corte.
    const deletedInvoiceIds = new Set((Array.isArray(auditLogs) ? auditLogs : [])
        .filter(log => log?.action === 'Invoice Deleted')
        .map(log => id(log.product)).filter(Boolean));

    for (const rem of remisiones) {
        if (cancelled(rem.estado)) continue;
        const dispatch = dayOf(rem.fecha);
        if (dispatch !== null && dispatch > windowEnd) continue;
        const rawItems = arr(rem.items);
        if (!validArray(rem.items)) {
            report('INVALID_REM_ITEMS', rem, null, 'Los ítems de esta remisión no se pueden leer; revisa su información antes de facturarla.');
            continue;
        }
        const productCounts = new Map();
        for (const item of rawItems) productCounts.set(id(item.productId), (productCounts.get(id(item.productId)) || 0) + 1);
        const itemIdCounts = new Map();
        for (const item of rawItems) if (item.remItemId) itemIdCounts.set(id(item.remItemId), (itemIdCounts.get(id(item.remItemId)) || 0) + 1);

        const infos = [];
        for (const item of rawItems) {
            const productId = id(item.productId);
            const product = productMap.get(productId) || {};
            const kind = isService(item, product) ? 'service' :
                (fold(item.tipoCobro || product.tipoCobro).includes('hora') ? 'hourly' : 'daily');
            const quantity = num(item.cantidad ?? item.quantity);
            const name = item.nombre || item.name || product.name || productId || 'Equipo sin identificar';
            const itemKey = item.remItemId ? id(item.remItemId) : `${id(rem.id)}:product:${productId}`;
            const info = { item, product, productId, itemKey, name, kind, quantity, cohorts: [], blocked: false,
                aliases: new Set([item.nombre, item.name, product.name, product.nombre].filter(Boolean).map(nameOf)) };
            const pendingIssues = [];
            const problem = (code, message) => { info.blocked = true; pendingIssues.push([code, message]); };
            if (quantity === null || quantity <= 0) continue;
            if (!productId) problem('MISSING_PRODUCT', `${name}: falta la identificación del producto.`);
            if (dispatch === null) problem('INVALID_DISPATCH_DATE', `${name}: falta una fecha de despacho válida.`);
            if ((!item.remItemId && productCounts.get(productId) > 1) || (item.remItemId && itemIdCounts.get(id(item.remItemId)) > 1)) {
                problem('AMBIGUOUS_REM_ITEM', `${name}: hay líneas repetidas sin una identificación de ítem única; revisa su relación con las facturas.`);
            }
            info.rate = num(item.tarifaDia ?? item.price ?? product.value);
            if (info.rate === null || info.rate < 0) problem('INVALID_RATE', `${name}: falta una tarifa válida.`);
            info.scheme = schemeOf(product.esquemaCobro || item.esquemaCobro || 'Calendario');
            if (kind === 'daily' && !productMap.has(productId) && !item.esquemaCobro) {
                problem('MISSING_BILLING_SCHEME', `${name}: el producto ya no está en el catálogo y el ítem no conserva su esquema de cobro; revisa este dato antes de facturar.`);
            }
            if (kind === 'daily' && !info.scheme) problem('UNKNOWN_SCHEME', `${name}: el esquema de cobro no se puede calcular por días.`);
            const declaredType = fold(item.tipoCobro || product.tipoCobro || 'Día');
            if (kind === 'daily' && !['dia', 'diario', 'daily', ''].includes(declaredType)) {
                problem('UNSUPPORTED_BILLING_TYPE', `${name}: requiere revisar su tipo de cobro antes de facturarlo por días.`);
            }

            if (kind === 'service') {
                if (dispatch === null || (dispatch >= windowStart && dispatch <= windowEnd)) {
                    const dateKey = `${encode(rem.id)}:${encode(itemKey)}:service`;
                    info.cohorts.push({ type: 'remaining', date: null, defaultDate: rem.fecha, effectiveDate: rem.fecha,
                        dateKey, quantity, start: dispatch, end: dispatch });
                }
            } else {
                const byDate = new Map();
                if (!validArray(item.devoluciones)) problem('INVALID_RETURN_HISTORY', `${name}: el historial de devoluciones no se puede leer.`);
                let historyQuantity = 0;
                let unknownReturns = 0;
                for (const dev of arr(item.devoluciones)) {
                    const returned = num(dev.cantidad);
                    if (returned === null || returned <= 0) { problem('INVALID_RETURN_QUANTITY', `${name}: una devolución tiene cantidad inválida.`); continue; }
                    historyQuantity += returned;
                    const returnedDay = dayOf(dev.fecha);
                    if (returnedDay === null) { unknownReturns += returned; continue; }
                    byDate.set(textOf(returnedDay), (byDate.get(textOf(returnedDay)) || 0) + returned);
                }
                const declaredReturned = num(item.cantidadDevuelta);
                const returnedTotal = declaredReturned === null ? historyQuantity : Math.max(declaredReturned, historyQuantity);
                const orphan = Math.max(0, (declaredReturned || 0) - historyQuantity) + unknownReturns;
                const remaining = Math.max(0, quantity - returnedTotal);
                if (returnedTotal > quantity + EPSILON || (declaredReturned !== null && declaredReturned < historyQuantity - EPSILON)) {
                    problem('INCONSISTENT_RETURN_QUANTITY', `${name}: las cantidades devueltas no coinciden con el historial o superan lo despachado.`);
                }
                for (const [date, returned] of [...byDate].sort((a, b) => a[0].localeCompare(b[0]))) {
                    const dateKey = `${encode(rem.id)}:${encode(itemKey)}:dev:${date}`;
                    const effectiveDate = customDates[dateKey] || date;
                    const end = dayOf(effectiveDate);
                    if (end === null) { problem('INVALID_RETURN_DATE', `${name}: selecciona una fecha de devolución válida.`); continue; }
                    if (dispatch !== null && end < dispatch) { problem('RETURN_BEFORE_DISPATCH', `${name}: la devolución no puede ser anterior al despacho.`); continue; }
                    if (end < windowStart) continue;
                    info.cohorts.push({ type: 'dev', date, defaultDate: date, effectiveDate, dateKey, quantity: returned,
                        start: dispatch === null ? null : Math.max(dispatch, windowStart), end: Math.min(end, windowEnd) });
                }
                if (remaining > EPSILON) {
                    const dateKey = `${encode(rem.id)}:${encode(itemKey)}:remaining`;
                    const effectiveDate = customDates[dateKey] || fechaCorte;
                    const chosenEnd = dayOf(effectiveDate);
                    if (chosenEnd === null) problem('INVALID_CUTOFF_DATE', `${name}: selecciona una fecha de corte válida.`);
                    else if (dispatch !== null && chosenEnd < dispatch) problem('CUTOFF_BEFORE_DISPATCH', `${name}: el corte no puede ser anterior al despacho.`);
                    else if (chosenEnd >= windowStart) info.cohorts.push({ type: 'remaining', date: null, defaultDate: fechaCorte,
                        effectiveDate, dateKey, quantity: remaining, start: dispatch === null ? null : Math.max(dispatch, windowStart),
                        end: Math.min(chosenEnd, windowEnd) });
                }
                if (orphan > EPSILON) {
                    // An arbitrary dispatch/today date would invent a financial obligation.
                    problem('UNDATED_RETURN', `${name}: hay ${orphan} unidad(es) devuelta(s) sin fecha verificable; completa su historial antes de incluirlas en el corte.`);
                }
            }
            info.cohorts = info.cohorts.filter(cohort => cohort.start === null || cohort.start <= cohort.end);
            // Historical returned items outside this cut do not require a legacy
            // invoice review merely because their previous identifiers differ.
            if (info.cohorts.length === 0 && !pendingIssues.some(([code]) => ['UNDATED_RETURN', 'INVALID_RETURN_DATE', 'RETURN_BEFORE_DISPATCH', 'INVALID_CUTOFF_DATE', 'INVALID_DISPATCH_DATE'].includes(code))) {
                // Keep the identity for matching old invoice lines, while not
                // producing issues or charges outside the requested window.
                infos.push(info);
                continue;
            }
            for (const [code, message] of pendingIssues) report(code, rem, info, message);
            infos.push(info);
        }
        const relevant = infos.filter(info => info.cohorts.length > 0 && !info.blocked);
        if (relevant.length === 0) continue;
        const linkedInvoiceId = id(rem.facturaId ?? rem.factura_id);
        if (linkedInvoiceId && !invoices.some(invoice => sameId(invoice.id, linkedInvoiceId)) &&
            !deletedInvoiceIds.has(linkedInvoiceId)) {
            // A confirmed deletion releases this stale link, like cancellation.
            // An unexplained missing record still requires review. All surviving
            // invoices are checked below, including replacement cuts.
            for (const info of relevant) report('MISSING_LINKED_INVOICE', rem, info,
                `${info.name}: la factura vinculada ${linkedInvoiceId} no está disponible; revisa su cobertura antes de emitir otro cobro.`, linkedInvoiceId);
            continue;
        }
        const entriesByItem = new Map(relevant.map(info => [info.itemKey, []]));

        for (const invoice of validInvoices) {
            const direct = sameId(rem.facturaId ?? rem.factura_id, invoice.id);
            const invItems = arr(invoice.items);
            if (!validArray(invoice.items)) {
                if (!direct && invoice.clientId && !sameId(invoice.clientId, rem.clientId)) continue;
                for (const info of relevant) { info.blocked = true; report('INVALID_INVOICE_ITEMS', rem, info, `${info.name}: no se pueden leer los ítems de la factura ${invoice.id}.`, invoice.id); }
                continue;
            }
            const linked = direct || invItems.some(invoiceItem => sameId(invoiceItem.remId, rem.id));
            if (!linked) continue;
            if (direct && invItems.length === 0) {
                for (const info of relevant) { info.blocked = true; report('EMPTY_LINKED_INVOICE', rem, info, `${info.name}: la factura vinculada ${invoice.id} no contiene ítems que permitan comprobar su cobertura.`, invoice.id); }
                continue;
            }
            if (invoice.clientId && rem.clientId && !sameId(invoice.clientId, rem.clientId)) {
                for (const info of relevant) { info.blocked = true; report('INVOICE_CLIENT_MISMATCH', rem, info, `${info.name}: la factura ${invoice.id} está vinculada a otro cliente.`, invoice.id); }
                continue;
            }
            if (invoice.obraId && rem.obraId && !sameId(invoice.obraId, rem.obraId)) {
                for (const info of relevant) { info.blocked = true; report('INVOICE_OBRA_MISMATCH', rem, info, `${info.name}: la factura ${invoice.id} está vinculada a otra obra.`, invoice.id); }
                continue;
            }
            const outsideWindow = cutsOutsideWindow(invoice, windowStart, windowEnd);
            for (const invItem of invItems) {
                if (invItem.remId && !sameId(invItem.remId, rem.id)) continue;
                if (!invItem.remId && !direct) continue;
                const coverage = invItem.rentalCoverage;
                const explicitKey = coverage?.itemKey || invItem.remItemKey || invItem.remItemId;
                let matches = explicitKey ? infos.filter(info => sameId(info.itemKey, explicitKey) || sameId(info.item.remItemId, explicitKey)) : [];
                if (explicitKey && matches.length === 0) {
                    // A legacy unique-product identity can survive an explicit
                    // UUID added later. Never apply this alias to duplicates or
                    // to an unknown UUID belonging to a different item.
                    matches = infos.filter(info => productCounts.get(info.productId) === 1 &&
                        explicitKey === `${id(rem.id)}:product:${info.productId}`);
                }
                if (!explicitKey) {
                    const realProductId = id(coverage?.productId || invItem.productId);
                    matches = infos.filter(info => sameId(info.productId, realProductId));
                    if (!matches.length && !productMap.has(realProductId)) {
                        const names = [invItem.nombre, invItem.name, invItem.productId].filter(Boolean).map(nameOf);
                        matches = infos.filter(info => names.some(name => info.aliases.has(name)));
                    }
                }
                if (matches.length !== 1) {
                    const apparentKind = coverage?.kind || (isService(invItem) ? 'service' : fold(invItem.tipoCobro).includes('hora') ? 'hourly' : 'daily');
                    const affected = matches.length ? matches : relevant.filter(info => info.kind === apparentKind);
                    // Old descriptions need reconciliation only when their daily
                    // cut overlaps this calculation. Services and hourly events
                    // retain their lifetime coverage checks, even in old cuts.
                    if (!coverage && outsideWindow && apparentKind === 'daily' &&
                        !infos.some(info => info.kind === 'hourly') && affected.every(info => info.kind === 'daily')) continue;
                    for (const info of affected) {
                        if (!relevant.includes(info)) continue;
                        info.blocked = true;
                        report('AMBIGUOUS_INVOICE_ITEM', rem, info, `${info.name}: no se puede asignar inequívocamente un ítem de la factura ${invoice.id}; revisa la relación antes de volver a cobrarlo.`, invoice.id);
                    }
                    continue;
                }
                const info = matches[0];
                if (!relevant.includes(info) || info.blocked) continue;
                if (!coverage && info.kind === 'daily' && outsideWindow) continue;
                if (coverage && (coverage.version !== 1 || coverage.kind !== info.kind || (coverage.productId && !sameId(coverage.productId, info.productId)))) {
                    info.blocked = true;
                    report('INCOMPATIBLE_COVERAGE', rem, info, `${info.name}: la cobertura guardada en ${invoice.id} no corresponde al ítem o tipo de alquiler.`, invoice.id);
                    continue;
                }
                const quantity = num(invItem.quantity ?? invItem.cantidad);
                let targetDate = coverage?.cohort?.type === 'dev' ? coverage.cohort.date : (!coverage ? returnMarker(invItem) : null);
                if (targetDate && dayOf(targetDate) === null) {
                    info.blocked = true;
                    report('INVALID_INVOICE_COHORT', rem, info, `${info.name}: la factura ${invoice.id} no identifica una devolución válida.`, invoice.id);
                    continue;
                }
                targetDate = targetDate ? textOf(dayOf(targetDate)) : null;
                const entry = { invoiceId: invoice.id, quantity, targetDate, exact: !!coverage,
                    hours: num(invItem.days ?? invItem.dias), hourlySnapshot: coverage?.hourly,
                    periods: [], dayQuantities: new Map() };
                if (coverage) {
                    if (!Array.isArray(coverage.segments) || coverage.segments.length === 0) {
                        info.blocked = true;
                        report('MISSING_COVERAGE_SEGMENTS', rem, info, `${info.name}: la factura ${invoice.id} carece de intervalos de cobertura válidos.`, invoice.id);
                        continue;
                    }
                    for (const segment of coverage.segments) {
                        if (!segment || typeof segment !== 'object' || Array.isArray(segment)) {
                            info.blocked = true;
                            report('INVALID_COVERAGE_SEGMENT', rem, info, `${info.name}: revisa los intervalos de cobertura de la factura ${invoice.id}.`, invoice.id);
                            break;
                        }
                        const start = dayOf(segment.start), end = dayOf(segment.end), q = num(segment.quantity);
                        if (start === null || end === null || start > end || q === null || q <= 0) {
                            info.blocked = true;
                            report('INVALID_COVERAGE_SEGMENT', rem, info, `${info.name}: revisa los intervalos de cobertura de la factura ${invoice.id}.`, invoice.id);
                            break;
                        }
                        entry.periods.push({ start, end, quantity: q });
                    }
                    entry.quantity = Math.max(...entry.periods.map(period => period.quantity));
                } else if (quantity === null || quantity <= 0) {
                    info.blocked = true;
                    report('INVALID_INVOICE_QUANTITY', rem, info, `${info.name}: la factura ${invoice.id} no contiene una cantidad facturada verificable.`, invoice.id);
                    continue;
                } else if (info.kind === 'daily') {
                    const cuts = arr(invoice.cortes);
                    if (!validArray(invoice.cortes)) {
                        info.blocked = true;
                        report('INVALID_LEGACY_PERIOD', rem, info, `${info.name}: no se pueden leer los cortes de la factura ${invoice.id}.`, invoice.id);
                        continue;
                    }
                    if (cuts.length) {
                        for (const cut of cuts) {
                            const start = dayOf(cut.fechaInicio), end = dayOf(cut.fechaCorte);
                            if (start === null || end === null || start > end) {
                                info.blocked = true;
                                report('INVALID_LEGACY_PERIOD', rem, info, `${info.name}: la factura ${invoice.id} tiene un corte sin fechas válidas.`, invoice.id);
                                break;
                            }
                            entry.periods.push({ start, end: targetDate ? Math.min(end, dayOf(targetDate)) : end, quantity });
                        }
                    } else {
                        // The legacy start belongs to this item. Never infer a
                        // second period from invoice.date/max(days) for all items.
                        const start = dayOf(invItem.remFecha ?? invItem.rentalStart);
                        const explicitEnd = dayOf(invItem.rentalEnd);
                        const days = num(invItem.days ?? invItem.dias);
                        if (start !== null && explicitEnd !== null && start <= explicitEnd) entry.periods.push({ start, end: explicitEnd, quantity });
                        else if (start !== null && days !== null && Number.isInteger(days) && days > 0 && info.scheme) {
                            let end = start, counted = 0;
                            while (counted < days) { if (allowedDay(end, info.scheme)) counted++; if (counted < days) end++; }
                            entry.periods.push({ start, end: targetDate ? Math.min(end, dayOf(targetDate)) : end, quantity });
                        } else {
                            info.blocked = true;
                            report('UNKNOWN_LEGACY_PERIOD', rem, info, `${info.name}: la factura ${invoice.id} no permite identificar un período de alquiler seguro; revisa sus fechas antes de generar otro cobro.`, invoice.id);
                        }
                    }
                }
                if (info.blocked) continue;
                if (info.kind === 'daily') {
                    for (const period of entry.periods) {
                        for (let day = Math.max(period.start, windowStart); day <= Math.min(period.end, windowEnd); day++) {
                            // Multiple cuts of the same invoice line describe a
                            // union, not multiple charges for the same quantity.
                            entry.dayQuantities.set(day, Math.max(entry.dayQuantities.get(day) || 0, period.quantity));
                        }
                    }
                }
                entriesByItem.get(info.itemKey).push(entry);
            }
        }

        for (const info of relevant) {
            if (info.blocked) continue;
            const entries = entriesByItem.get(info.itemKey) || [];
            const cohorts = [...info.cohorts].sort((a, b) => (a.type === 'remaining') - (b.type === 'remaining') || (a.date || '').localeCompare(b.date || ''));
            const baseLine = (cohort, quantity, key, baseDays, holidays, hoursStart, hoursEnd, segments) => {
                const chosenDays = overrideNumber(customDays, key, baseDays);
                const chosenHolidays = info.kind === 'daily' ? Math.min(chosenDays, overrideNumber(customFestivos, key, holidays)) : 0;
                const chargedDays = chosenDays - chosenHolidays;
                const dateLabel = cohort.type === 'dev' ? ` (Dev: ${cohort.effectiveDate})` :
                    cohort.effectiveDate !== fechaCorte && info.kind !== 'service' ? ` (Corte: ${cohort.effectiveDate})` : '';
                return { key, dateKey: cohort.dateKey, productId: info.productId, remItemKey: info.itemKey,
                    type: cohort.type, devFecha: cohort.effectiveDate, defaultDevFecha: cohort.defaultDate,
                    remId: rem.id, remFecha: rem.fecha, equipo: `${info.product.name || info.name}${dateLabel}`,
                    cantidad: quantity, diasBase: chosenDays, festivos: chosenHolidays, dias: chargedDays, maxDays: baseDays,
                    tarifaDia: info.rate, subtotal: quantity * chargedDays * info.rate, estado: rem.estado,
                    esquema: info.kind === 'hourly' ? 'Por Horas' : info.kind === 'service' ? 'Cobro Único' : info.scheme,
                    isServ: info.kind === 'service', isHora: info.kind === 'hourly', horaInicio: hoursStart, horaFin: hoursEnd,
                    billingCoverage: { version: 1, itemKey: info.itemKey, productId: info.productId, kind: info.kind,
                        cohort: { type: cohort.type, date: cohort.date }, segments,
                        ...(info.kind === 'hourly' ? { hourly: { start: hoursStart, end: hoursEnd, hours: baseDays } } : {}) } };
            };

            if (info.kind === 'daily') {
                const pending = new Map(cohorts.map(cohort => [cohort.dateKey, new Map()]));
                let allocationInvalid = false;
                for (let day = windowStart; day <= windowEnd; day++) {
                    const active = cohorts.filter(cohort => day >= cohort.start && day <= cohort.end);
                    if (!active.length) continue;
                    const quantities = new Map(active.map(cohort => [cohort.dateKey, cohort.quantity]));
                    const apply = entry => {
                        let available = entry.dayQuantities.get(day) || 0;
                        if (available <= EPSILON) return;
                        const targets = entry.targetDate ? active.filter(cohort => cohort.type === 'dev' && cohort.date === entry.targetDate) : active;
                        if (entry.targetDate && !cohorts.some(cohort => cohort.type === 'dev' && cohort.date === entry.targetDate)) {
                            // A specific historic return outside this window is
                            // harmless. A changed return that overlaps it is not.
                            if (dayOf(entry.targetDate) >= windowStart) allocationInvalid = true;
                            return;
                        }
                        for (const cohort of targets) {
                            const remaining = quantities.get(cohort.dateKey) || 0;
                            const used = Math.min(remaining, available);
                            quantities.set(cohort.dateKey, remaining - used);
                            available -= used;
                            if (available <= EPSILON) break;
                        }
                    };
                    entries.filter(entry => entry.targetDate).forEach(apply);
                    entries.filter(entry => !entry.targetDate).forEach(apply);
                    for (const cohort of active) {
                        const quantity = quantities.get(cohort.dateKey) || 0;
                        if (quantity > EPSILON) {
                            const key = String(Math.round(quantity * 1e8) / 1e8);
                            const grouped = pending.get(cohort.dateKey);
                            if (!grouped.has(key)) grouped.set(key, { quantity, days: [] });
                            grouped.get(key).days.push(day);
                        }
                    }
                }
                if (allocationInvalid) {
                    report('UNMATCHED_RETURN_COVERAGE', rem, info, `${info.name}: una devolución facturada no coincide con el historial actual; revisa su asignación antes de cobrarla.`);
                    continue;
                }
                for (const cohort of cohorts) {
                    for (const group of pending.get(cohort.dateKey).values()) {
                        const billable = group.days.filter(day => allowedDay(day, info.scheme));
                        if (!billable.length) continue;
                        const key = `${cohort.dateKey}:qty:${group.quantity}`;
                        const holidays = aplicarFestivos ? billable.filter(day => isHoliday(textOf(day))).length : 0;
                        lineas.push(baseLine(cohort, group.quantity, key, billable.length, holidays,
                            customHorasInicio[key] ?? info.item.horaInicio ?? '', customHorasFin[key] ?? info.item.horaFin ?? '',
                            segmentsFromDays(group.days, group.quantity)));
                    }
                }
            } else {
                const quantities = new Map(cohorts.map(cohort => [cohort.dateKey, cohort.quantity]));
                let uncertainHours = false;
                for (const entry of [...entries.filter(value => value.targetDate), ...entries.filter(value => !value.targetDate)]) {
                    let available = entry.quantity || 0;
                    const targets = entry.targetDate ? cohorts.filter(cohort => cohort.type === 'dev' && cohort.date === entry.targetDate) : cohorts;
                    for (const cohort of targets) {
                        if (available <= EPSILON) break;
                        const remaining = quantities.get(cohort.dateKey) || 0;
                        if (remaining <= EPSILON) continue;
                        const key = `${cohort.dateKey}:qty:${cohort.quantity}`;
                        const hStart = customHorasInicio[key] ?? info.item.horaInicio ?? '';
                        const hEnd = customHorasFin[key] ?? info.item.horaFin ?? '';
                        const calculated = hStart && hEnd ? num(calculateHours(hStart, hEnd)) : null;
                        const expected = calculated > 0 ? calculated : num(info.item.horasCalculadas || info.item.dias) || 1;
                        if (info.kind === 'hourly') {
                            const snapshot = entry.hourlySnapshot;
                            const storedHours = snapshot ? num(snapshot.hours) : entry.hours;
                            const changedClock = snapshot && ((snapshot.start || '') !== hStart || (snapshot.end || '') !== hEnd);
                            const changedHours = storedHours === null || Math.abs(storedHours - expected) > EPSILON;
                            if ((entry.exact && (changedClock || changedHours)) || (!entry.exact && (storedHours === null || storedHours + EPSILON < expected))) {
                                uncertainHours = true;
                                continue;
                            }
                        }
                        const used = Math.min(remaining, available);
                        quantities.set(cohort.dateKey, remaining - used);
                        available -= used;
                    }
                }
                if (uncertainHours) {
                    report('PARTIAL_HOURLY_COVERAGE', rem, info, `${info.name}: las horas o el horario actuales difieren de lo facturado, o su cobertura es parcial; revisa el evento antes de emitir otro cobro.`);
                    continue;
                }
                for (const cohort of cohorts) {
                    const remaining = quantities.get(cohort.dateKey) || 0;
                    if (remaining <= EPSILON) continue;
                    const key = `${cohort.dateKey}:qty:${remaining}`;
                    const hStart = customHorasInicio[key] ?? info.item.horaInicio ?? '';
                    const hEnd = customHorasFin[key] ?? info.item.horaFin ?? '';
                    const calculated = hStart && hEnd ? num(calculateHours(hStart, hEnd)) : null;
                    const baseDays = info.kind === 'service' ? 1 : (calculated > 0 ? calculated : num(info.item.horasCalculadas || info.item.dias) || 1);
                    const segments = [{ start: textOf(cohort.start), end: textOf(cohort.end), quantity: remaining }];
                    lineas.push(baseLine(cohort, remaining, key, baseDays, 0, hStart, hEnd, segments));
                }
            }
        }
    }
    return { lineas, issues };
}
