import { readCorteRecords } from './corteDataUtils.js';
const key = value => String(value ?? '');
const isCancelled = status => ['cancelada', 'cancelado', 'anulada', 'anulado', 'canceled', 'cancelled', 'void']
    .includes(String(status || '').toLowerCase());

// El transporte del despacho se factura una sola vez. El estado de pago no
// altera lo que ya tiene factura, igual que en las líneas de alquiler.
export function calculatePendingCorteTransport({ remisiones = [], invoices = [], remIdsConCobro = [], fechaInicio, fechaCorte }) {
    const selected = new Set([...remIdsConCobro].map(key));
    const transportes = [];
    const issues = [];
    if (selected.size === 0) return { transportes, issues, total: 0 };
    const selectedRems = remisiones.filter(rem => selected.has(key(rem.id)));
    const selectedClients = new Set(selectedRems.map(rem => key(rem.clientId)).filter(Boolean));
    const issued = invoices.filter(invoice => !isCancelled(invoice.status) && (
        !invoice.clientId || selectedClients.has(key(invoice.clientId)) ||
        selectedRems.some(rem => rem.facturaId && key(rem.facturaId) === key(invoice.id)) ||
        (readCorteRecords(invoice.items) || []).some(item => selected.has(key(item.remId)))
    )).map(invoice => {
        const cuts = readCorteRecords(invoice.cortes);
        const items = readCorteRecords(invoice.items);
        const allocationLists = cuts?.map(cut => readCorteRecords(cut.transportes));
        if (cuts === null || items === null || allocationLists?.some(list => list === null)) {
            issues.push({ code: 'INVALID_TRANSPORT_HISTORY', invoiceId: invoice.id, itemKey: 'transporte',
                message: `No se puede comprobar el transporte facturado en ${invoice.id}. Revisa sus cortes e ítems antes de cobrar transporte nuevamente.` });
            return null;
        }
        const explicit = cuts.some(cut => cut.transportes !== undefined && cut.transportes !== null && cut.transportes !== '');
        const allocations = allocationLists.flat();
        const remIds = new Set(items.map(item => key(item.remId)).filter(Boolean));
        remisiones.forEach(rem => {
            if (rem.facturaId && key(rem.facturaId) === key(invoice.id)) remIds.add(key(rem.id));
        });
        return { invoice, explicit, allocations, remIds };
    });
    // Sin historial verificable no se presume que el transporte está pendiente.
    if (issues.length > 0) return { transportes, issues, total: 0 };

    for (const rem of remisiones) {
        const amount = Number(rem.transporte) || 0;
        if (!selected.has(key(rem.id)) || amount <= 0 || isCancelled(rem.estado) || !rem.fecha ||
            rem.fecha < fechaInicio || rem.fecha > fechaCorte) continue;
        let billed = 0;
        let ambiguous = false;
        for (const { invoice, explicit, allocations, remIds } of issued) {
            if (explicit) {
                billed += Math.max(0, ...allocations.filter(allocation => key(allocation.remId) === key(rem.id))
                    .map(allocation => Number(allocation.monto) || 0));
            } else if ((Number(invoice.transporte) || 0) > 0 && remIds.has(key(rem.id))) {
                if (remIds.size === 1) billed += Number(invoice.transporte);
                else {
                    ambiguous = true;
                    issues.push({ code: 'AMBIGUOUS_TRANSPORT', remId: rem.id, itemKey: 'transporte', invoiceId: invoice.id,
                        message: `El transporte está incluido en la factura ${invoice.id}, que agrupa varios despachos. No se sumó un nuevo transporte; verifica su distribución.` });
                }
            }
        }
        const pending = Math.max(0, amount - billed);
        if (!ambiguous && pending > 0) transportes.push({ remId: rem.id, monto: pending });
    }
    return { total: transportes.reduce((sum, allocation) => sum + allocation.monto, 0), transportes, issues };
}
