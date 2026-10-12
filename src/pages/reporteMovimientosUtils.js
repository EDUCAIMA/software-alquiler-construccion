import {
    buildMovimientosCajaMenor, esEfectivo, resumirMovimientos, toISODate
} from './cajaMenorUtils.js';

const enPeriodo = (fecha, fechaDesde, fechaHasta) => {
    const iso = toISODate(fecha);
    if (!iso) return false;
    if (fechaDesde && iso < fechaDesde) return false;
    if (fechaHasta && iso > fechaHasta) return false;
    return true;
};

const nombreProducto = (item, products) => {
    const product = products.find(p => String(p.id) === String(item.productId));
    return item.nombre || item.name || product?.name || item.productId || 'Equipo sin identificar';
};

const esServicioReporte = (item = {}, product = {}) => {
    const descriptor = [
        item.category, item.tipoCobro, item.esquemaCobro, item.nombre, item.name,
        product.category, product.tipoCobro, product.esquemaCobro, product.name
    ].filter(Boolean).join(' ').toLowerCase();
    return ['servicio', 'servio ', 'única vez', 'unica vez', 'mano de obra',
        'transporte', 'entrega', 'recogida', 'flete', 'acarreo', 'armado',
        'desarmado', 'depósito', 'deposito', 'cargo por']
        .some(term => descriptor.includes(term));
};

export function buildMovimientosEquipos({
    remisiones = [], clients = [], products = [], fechaDesde = '', fechaHasta = ''
} = {}) {
    const movimientos = [];

    remisiones
        .filter(remision => remision.estado !== 'Cancelada')
        .forEach(remision => {
            const client = clients.find(c => String(c.id) === String(remision.clientId));
            const obra = (client?.obras || []).find(o => String(o.id) === String(remision.obraId));

            (remision.items || []).forEach((item, itemIndex) => {
                const product = products.find(p => String(p.id) === String(item.productId));
                if (esServicioReporte(item, product)) return;

                const equipo = nombreProducto(item, products);
                const cantidadSalida = Math.max(0, Number(item.cantidad) || 0);
                if (cantidadSalida > 0 && enPeriodo(remision.fecha, fechaDesde, fechaHasta)) {
                    movimientos.push({
                        key: `SAL-${remision.id}-${itemIndex}`,
                        fecha: toISODate(remision.fecha),
                        hora: remision.hora || item.horaInicio || '',
                        tipo: 'Salida',
                        equipo,
                        cantidad: cantidadSalida,
                        referencia: remision.id,
                        cliente: client?.name || remision.clientId || 'N/A',
                        obra: obra?.nombre || remision.obraNombre || remision.obraId || '—'
                    });
                }

                const devoluciones = Array.isArray(item.devoluciones) ? item.devoluciones : [];
                devoluciones.forEach((devolucion, devolucionIndex) => {
                    const cantidadEntrada = Math.max(0, Number(devolucion.cantidad) || 0);
                    if (!(cantidadEntrada > 0) || !enPeriodo(devolucion.fecha, fechaDesde, fechaHasta)) return;
                    movimientos.push({
                        key: `ENT-${remision.id}-${itemIndex}-${devolucionIndex}`,
                        fecha: toISODate(devolucion.fecha),
                        hora: devolucion.hora || '',
                        tipo: 'Entrada',
                        equipo,
                        cantidad: cantidadEntrada,
                        referencia: remision.id,
                        cliente: client?.name || remision.clientId || 'N/A',
                        obra: obra?.nombre || remision.obraNombre || remision.obraId || '—'
                    });
                });
            });
        });

    return movimientos.sort((a, b) =>
        a.fecha.localeCompare(b.fecha) ||
        (a.hora || '').localeCompare(b.hora || '') ||
        a.tipo.localeCompare(b.tipo) ||
        a.key.localeCompare(b.key)
    );
}

export function buildResumenMovimientosEquipos(movimientos = []) {
    return movimientos.reduce((totals, movimiento) => {
        if (movimiento.tipo === 'Salida') {
            totals.salidas += 1;
            totals.unidadesSalida += Number(movimiento.cantidad) || 0;
        } else {
            totals.entradas += 1;
            totals.unidadesEntrada += Number(movimiento.cantidad) || 0;
        }
        return totals;
    }, { salidas: 0, entradas: 0, unidadesSalida: 0, unidadesEntrada: 0 });
}

export function buildMovimientosFinancieros({
    invoices = [], clients = [], ingresosCajaMenor = [], gastosMantenimiento = [],
    gastos = [], retirosCajaMenor = [], fechaDesde = '', fechaHasta = ''
} = {}) {
    const movimientos = [];
    const abonosClienteAplicadosPorFactura = new Map();

    // Un abono anticipado se registra como ingreso cuando el cliente entrega el
    // dinero. Si después se aplica a una factura, el paidAmount de esa factura
    // no representa un segundo ingreso y no debe volver a sumarse.
    clients.forEach(client => {
        (Array.isArray(client.abonos) ? client.abonos : []).forEach(abono => {
            const aplicaciones = Array.isArray(abono.aplicaciones) ? abono.aplicaciones : [];
            if (aplicaciones.length > 0) {
                aplicaciones.forEach(aplicacion => {
                    if (!aplicacion.facturaId) return;
                    const acumulado = abonosClienteAplicadosPorFactura.get(String(aplicacion.facturaId)) || 0;
                    abonosClienteAplicadosPorFactura.set(
                        String(aplicacion.facturaId),
                        acumulado + Math.max(0, Number(aplicacion.monto) || 0)
                    );
                });
            } else if (abono.facturaId && abono.aplicado) {
                const acumulado = abonosClienteAplicadosPorFactura.get(String(abono.facturaId)) || 0;
                abonosClienteAplicadosPorFactura.set(
                    String(abono.facturaId),
                    acumulado + Math.max(0, Number(abono.monto) || 0)
                );
            }
        });
    });

    const push = movimiento => {
        if (!enPeriodo(movimiento.fecha, fechaDesde, fechaHasta)) return;
        const monto = Math.max(0, Number(movimiento.monto) || 0);
        if (!(monto > 0)) return;
        movimientos.push({
            ...movimiento,
            fecha: toISODate(movimiento.fecha),
            monto,
            metodoPago: movimiento.metodoPago || 'Sin especificar'
        });
    };

    invoices.forEach(invoice => {
        const client = clients.find(c => String(c.id) === String(invoice.clientId));
        const abonos = Array.isArray(invoice.abonos) ? invoice.abonos : [];
        abonos.forEach((abono, index) => push({
            key: `FAC-${invoice.id}-${index}`,
            fecha: abono.fecha || invoice.paidDate || invoice.date,
            tipo: 'Ingreso',
            origen: 'Pago de remisión',
            referencia: invoice.id,
            concepto: `Pago ${abono.tipo || ''}`.trim(),
            tercero: client?.name || invoice.clientId || 'N/A',
            metodoPago: abono.metodoPago || invoice.paymentMethod,
            monto: abono.monto
        }));

        // Compatibilidad con facturas antiguas que guardaron el acumulado, pero
        // no el historial individual de abonos.
        const aplicadoDesdeAbonosCliente = abonosClienteAplicadosPorFactura.get(String(invoice.id)) || 0;
        const pagoLegacyNoDesglosado = Math.max(
            0,
            (Number(invoice.paidAmount) || 0) - aplicadoDesdeAbonosCliente
        );
        if (abonos.length === 0 && pagoLegacyNoDesglosado > 0) {
            push({
                key: `FAC-LEGACY-${invoice.id}`,
                fecha: invoice.paidDate || invoice.date,
                tipo: 'Ingreso',
                origen: 'Pago de factura',
                referencia: invoice.id,
                concepto: 'Pago registrado sin historial de abonos',
                tercero: client?.name || invoice.clientId || 'N/A',
                metodoPago: invoice.paymentMethod,
                monto: pagoLegacyNoDesglosado
            });
        }
    });

    clients.forEach(client => {
        (Array.isArray(client.abonos) ? client.abonos : []).forEach((abono, index) => push({
            key: `CLI-${client.id}-${abono.id || index}`,
            fecha: abono.fecha || client.joined,
            tipo: 'Ingreso',
            origen: 'Abono de cliente',
            referencia: abono.id || client.id,
            concepto: abono.notas || 'Abono anticipado',
            tercero: client.name || 'N/A',
            metodoPago: abono.metodoPago || 'Efectivo',
            monto: abono.monto
        }));
    });

    ingresosCajaMenor.forEach(ingreso => push({
        key: `ING-${ingreso.id}`,
        fecha: ingreso.fecha_ingreso,
        tipo: 'Ingreso',
        origen: 'Ingreso directo',
        referencia: ingreso.referencia_soporte || ingreso.id,
        concepto: ingreso.concepto || 'Ingreso directo',
        tercero: ingreso.origen || '—',
        metodoPago: ingreso.metodo_pago || 'Efectivo',
        monto: ingreso.monto
    }));

    gastosMantenimiento.forEach(gasto => push({
        key: `GM-${gasto.id}`,
        fecha: gasto.fecha_gasto,
        tipo: 'Gasto',
        origen: gasto.tipo_gasto || 'Gasto operativo',
        referencia: gasto.referencia_soporte || gasto.id,
        concepto: gasto.subtipo_gasto || gasto.descripcion || 'Gasto operativo',
        tercero: gasto.proveedor_beneficiario || '—',
        metodoPago: gasto.metodo_pago,
        monto: gasto.costo
    }));

    gastos.forEach(gasto => push({
        key: `G-${gasto.id}`,
        fecha: gasto.fecha,
        tipo: 'Gasto',
        origen: gasto.categoria || 'Compra / gasto',
        referencia: gasto.id,
        concepto: gasto.concepto || 'Compra / gasto',
        tercero: gasto.proveedor || '—',
        metodoPago: gasto.metodo_pago || gasto.metodoPago,
        monto: (Number(gasto.monto) || 0) + (Number(gasto.iva) || 0)
    }));

    retirosCajaMenor.forEach(retiro => push({
        key: `RET-${retiro.id}`,
        fecha: retiro.fecha_retiro,
        tipo: 'Retiro',
        origen: retiro.destino || 'Retiro de caja',
        referencia: retiro.referencia_soporte || retiro.id,
        concepto: retiro.concepto || 'Retiro de caja menor',
        tercero: retiro.responsable || '—',
        metodoPago: 'Efectivo',
        monto: retiro.monto
    }));

    return movimientos.sort((a, b) =>
        a.fecha.localeCompare(b.fecha) || a.tipo.localeCompare(b.tipo) || a.key.localeCompare(b.key)
    );
}

export function buildResumenFinanciero(movimientos = [], cajaData = {}) {
    const resumen = movimientos.reduce((totals, movimiento) => {
        if (movimiento.tipo === 'Ingreso') {
            totals.ingresos += movimiento.monto;
            if (esEfectivo(movimiento.metodoPago)) totals.ingresosEfectivo += movimiento.monto;
            else totals.ingresosCuenta += movimiento.monto;
        } else if (movimiento.tipo === 'Gasto') {
            totals.gastos += movimiento.monto;
            if (esEfectivo(movimiento.metodoPago)) totals.gastosEfectivo += movimiento.monto;
            else if (movimiento.metodoPago !== 'Sin especificar') totals.gastosCuenta += movimiento.monto;
            else totals.gastosSinMetodo += movimiento.monto;
        } else if (movimiento.tipo === 'Retiro') {
            totals.retiros += movimiento.monto;
        }
        return totals;
    }, {
        ingresos: 0,
        ingresosEfectivo: 0,
        ingresosCuenta: 0,
        gastos: 0,
        gastosEfectivo: 0,
        gastosCuenta: 0,
        gastosSinMetodo: 0,
        retiros: 0,
        saldoCajaMenor: 0
    });

    resumen.saldoCajaMenor = resumirMovimientos(buildMovimientosCajaMenor(cajaData)).saldo;
    return resumen;
}
