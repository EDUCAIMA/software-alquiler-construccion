const list = value => {
    if (Array.isArray(value)) return value;
    if (typeof value === 'string') {
        try { const parsed = JSON.parse(value); return Array.isArray(parsed) ? parsed : []; } catch { return []; }
    }
    return [];
};
const key = value => String(value ?? '');
const isCancelled = status => ['cancelada', 'cancelado', 'anulada', 'anulado', 'canceled', 'cancelled', 'void']
    .includes(String(status || '').toLowerCase());

// El transporte del despacho se factura una sola vez. El estado de pago no
// altera lo que ya tiene factura, igual que en las líneas de alquiler.
export function calculatePendingCorteTransport({ remisiones = [], invoices = [], remIdsConCobro = [], fechaInicio, fechaCorte }) {
    const selected = new Set([...remIdsConCobro].map(key));
    const transportes = [];
    const issues = [];
    const issued = invoices.filter(invoice => !isCancelled(invoice.status)).map(invoice => {
        const cuts = list(invoice.cortes);
        const explicit = cuts.some(cut => Array.isArray(cut.transportes));
        const allocations = cuts.flatMap(cut => list(cut.transportes));
        const remIds = new Set(list(invoice.items).map(item => key(item.remId)).filter(Boolean));
        remisiones.forEach(rem => {
            if (rem.facturaId && key(rem.facturaId) === key(invoice.id)) remIds.add(key(rem.id));
        });
        return { invoice, explicit, allocations, remIds };
    });

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
