// ─── Caja Menor: consolidación del efectivo ───────────────────────────────────
// El saldo de caja menor se deriva de los movimientos que ya existen en el
// sistema; no se almacena como un número suelto. De esta forma nunca queda
// desincronizado con los pagos, egresos y retiros reales.
//
//   Saldo = pagos recibidos en efectivo
//         − egresos pagados en efectivo
//         − retiros de caja menor

export const METODOS_PAGO = ['Efectivo', 'Transferencia', 'Cheque', 'Tarjeta', 'Otro'];

export const DESTINOS_RETIRO = [
    'Consignación a Banco',
    'Entrega a Gerencia',
    'Reembolso a Empleado',
    'Traslado a Otra Caja',
    'Otro'
];

/** Normaliza una fecha (ISO, timestamp de PG o 'yyyy-MM-dd') a 'yyyy-MM-dd'. */
export const toISODate = (dateStr) => {
    if (!dateStr) return '';
    return String(dateStr).split('T')[0];
};

/** Formatea a 'dd/MM/yyyy' para mostrar en tablas y PDF. */
export const formatFechaCorta = (dateStr) => {
    const iso = toISODate(dateStr);
    const parts = iso.split('-');
    if (parts.length !== 3) return dateStr || '—';
    const [yyyy, mm, dd] = parts;
    return `${dd}/${mm}/${yyyy}`;
};

export const fmtCOP = n => `$${Math.round(Number(n) || 0).toLocaleString('es-CO')}`;

/**
 * Solo el efectivo mueve la caja menor. Los egresos históricos sin método
 * registrado (null) quedan fuera a propósito: nadie verificó cómo se pagaron
 * y asumirlos como efectivo distorsionaría el saldo.
 */
export const esEfectivo = (metodo) =>
    String(metodo || '').trim().toLowerCase() === 'efectivo';

/**
 * Construye el libro de caja menor en orden cronológico ascendente, con el
 * saldo acumulado después de cada movimiento.
 *
 * Cada movimiento: { key, fecha, tipo, origen, referencia, concepto, tercero,
 *                    entrada, salida, saldo }
 */
export function buildMovimientosCajaMenor({
    invoices = [],
    clients = [],
    ingresosCajaMenor = [],
    gastosMantenimiento = [],
    retirosCajaMenor = []
} = {}) {
    const movimientos = [];

    // 1. Abonos en efectivo de las remisiones / cobros
    invoices.forEach(inv => {
        const client = clients.find(c => c.id === inv.clientId);
        const abonos = Array.isArray(inv.abonos) ? inv.abonos : [];
        abonos.forEach((ab, idx) => {
            if (!esEfectivo(ab.metodoPago)) return;
            movimientos.push({
                key: `${inv.id}-AB${idx}`,
                fecha: toISODate(ab.fecha || inv.date),
                tipo: 'Ingreso',
                origen: 'Pago de Remisión',
                referencia: inv.id,
                concepto: `Pago en efectivo — Remisión ${inv.id}${ab.tipo ? ` (${ab.tipo})` : ''}`,
                tercero: client?.name || 'N/A',
                entrada: Number(ab.monto) || 0,
                salida: 0,
            });
        });
    });

    // 2. Ingresos registrados manualmente (no facturados) cobrados en efectivo
    ingresosCajaMenor.forEach(ing => {
        if (!esEfectivo(ing.metodo_pago)) return;
        movimientos.push({
            key: `ING-${ing.id}`,
            fecha: toISODate(ing.fecha_ingreso),
            tipo: 'Ingreso',
            origen: 'Ingreso Directo',
            referencia: ing.referencia_soporte || ing.id,
            concepto: ing.concepto || 'Ingreso directo',
            tercero: ing.origen || '—',
            entrada: Number(ing.monto) || 0,
            salida: 0,
        });
    });

    // 3. Egresos pagados en efectivo
    gastosMantenimiento.forEach(g => {
        if (!esEfectivo(g.metodo_pago)) return;
        movimientos.push({
            key: `GAS-${g.id}`,
            fecha: toISODate(g.fecha_gasto),
            tipo: 'Egreso',
            origen: g.tipo_gasto || 'Egreso',
            referencia: g.referencia_soporte || g.id,
            concepto: g.subtipo_gasto
                ? `${g.subtipo_gasto}${g.descripcion ? ` — ${g.descripcion}` : ''}`
                : (g.descripcion || 'Egreso en efectivo'),
            tercero: g.proveedor_beneficiario || '—',
            entrada: 0,
            salida: Number(g.costo) || 0,
        });
    });

    // 4. Retiros de caja menor
    retirosCajaMenor.forEach(r => {
        movimientos.push({
            key: `RET-${r.id}`,
            fecha: toISODate(r.fecha_retiro),
            tipo: 'Retiro',
            origen: r.destino || 'Retiro de Caja',
            referencia: r.referencia_soporte || r.id,
            concepto: r.concepto || 'Retiro de caja menor',
            tercero: r.responsable || '—',
            entrada: 0,
            salida: Number(r.monto) || 0,
            _raw: r,
        });
    });

    // Orden cronológico; la clave desempata para que el saldo acumulado sea estable
    movimientos.sort((a, b) =>
        (a.fecha || '').localeCompare(b.fecha || '') || a.key.localeCompare(b.key)
    );

    let saldo = 0;
    movimientos.forEach(m => {
        saldo += m.entrada - m.salida;
        m.saldo = saldo;
    });

    return movimientos;
}

/** Totaliza un conjunto de movimientos ya construidos. */
export function resumirMovimientos(movimientos = []) {
    const totalIngresos = movimientos.reduce((s, m) => s + m.entrada, 0);
    const totalEgresos = movimientos
        .filter(m => m.tipo === 'Egreso')
        .reduce((s, m) => s + m.salida, 0);
    const totalRetiros = movimientos
        .filter(m => m.tipo === 'Retiro')
        .reduce((s, m) => s + m.salida, 0);

    return {
        totalIngresos,
        totalEgresos,
        totalRetiros,
        saldo: totalIngresos - totalEgresos - totalRetiros,
    };
}

/** Saldo disponible en caja menor a partir del estado global de la app. */
export function calcularSaldoCajaMenor(data) {
    return resumirMovimientos(buildMovimientosCajaMenor(data)).saldo;
}
