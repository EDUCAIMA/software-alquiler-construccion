import React, { useState, useMemo, useRef, useEffect } from 'react';
import {
    X, Download, Filter, Calendar, Users, Package, DollarSign,
    CheckCircle, Clock, Truck, AlertTriangle, FileText, BarChart2,
    RefreshCw, Layers, ArrowUpRight, Search, Check, ChevronDown
} from 'lucide-react';
import { format, parseISO, startOfMonth, endOfMonth, subMonths, startOfYear, endOfYear, isWithinInterval } from 'date-fns';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { applyStandardLayout } from './pdfTheme';

const fmtCOP = n => `$${Math.round(Number(n) || 0).toLocaleString('es-CO')}`;

const MAPA_CATEGORIAS = {
    'Heavy Machinery': 'Maquinaria Pesada',
    'heavy machinery': 'Maquinaria Pesada',
    'Machinery': 'Maquinaria',
    'machinery': 'Maquinaria',
    'maquinaria pesada': 'Maquinaria Pesada',
    'Power Tools': 'Herramientas Eléctricas',
    'power tools': 'Herramientas Eléctricas',
    'herramientas electricas': 'Herramientas Eléctricas',
    'herramientas eléctricas': 'Herramientas Eléctricas',
    'Structures': 'Estructuras y Andamios',
    'structures': 'Estructuras y Andamios',
    'estructuras y andamios': 'Estructuras y Andamios',
    'Equipment': 'Equipos',
    'equipment': 'Equipos',
    'Tools': 'Herramientas',
    'tools': 'Herramientas',
    'Other': 'Otros',
    'other': 'Otros',
    'otro': 'Otros',
    'General': 'General',
    'general': 'General',
    'Servicio': 'Servicio',
    'servicio': 'Servicio',
    'Service': 'Servicio',
    'service': 'Servicio'
};

const traducirCategoria = (cat) => {
    if (!cat) return 'General';
    const c = String(cat).trim();
    return MAPA_CATEGORIAS[c] || MAPA_CATEGORIAS[c.toLowerCase()] || c;
};

const MESES_ES = ['ENE', 'FEB', 'MAR', 'ABR', 'MAY', 'JUN', 'JUL', 'AGO', 'SEP', 'OCT', 'NOV', 'DIC'];
const formatearFechaMesLetras = (fechaStr) => {
    if (!fechaStr) return '';
    const parts = fechaStr.includes('-') ? fechaStr.split('-') : (fechaStr.includes('/') ? fechaStr.split('/') : []);
    if (parts.length === 3) {
        if (parts[0].length === 4) {
            const [yyyy, mm, dd] = parts;
            const mIdx = parseInt(mm, 10) - 1;
            const mesTxt = MESES_ES[mIdx] || mm;
            return `${dd}-${mesTxt}-${yyyy}`;
        } else {
            const [dd, mm, yyyy] = parts;
            const mIdx = parseInt(mm, 10) - 1;
            const mesTxt = MESES_ES[mIdx] || mm;
            return `${dd}-${mesTxt}-${yyyy}`;
        }
    }
    return fechaStr;
};

export default function ReportesRemisionesModal({
    onClose,
    remisiones = [],
    clients = [],
    products = [],
    invoices = [],
    settings = {},
    initialReportType = 'cartera'
}) {
    // ─── Estados de Filtros (Solo Período de Fecha) ───────────────────────────
    const today = new Date();
    const [fechaDesde, setFechaDesde] = useState(format(startOfMonth(today), 'yyyy-MM-dd'));
    const [fechaHasta, setFechaHasta] = useState(format(endOfMonth(today), 'yyyy-MM-dd'));
    const [reportType, setReportType] = useState(initialReportType || 'cartera'); // 'cartera' | 'ingresos' | 'detallado' | 'equipos'
    const [soloConDeuda, setSoloConDeuda] = useState(true);

    const fDesde = formatearFechaMesLetras(fechaDesde);
    const fHasta = formatearFechaMesLetras(fechaHasta);
    const periodoStr = fDesde && fHasta ? `${fDesde} al ${fHasta}` : (fDesde ? `Desde ${fDesde}` : (fHasta ? `Hasta ${fHasta}` : 'Histórico completo'));

    // Presets de fecha rápida
    const aplicarPresetFechas = (preset) => {
        const ahora = new Date();
        if (preset === 'esteMes') {
            setFechaDesde(format(startOfMonth(ahora), 'yyyy-MM-dd'));
            setFechaHasta(format(endOfMonth(ahora), 'yyyy-MM-dd'));
        } else if (preset === 'mesAnterior') {
            const mesAnt = subMonths(ahora, 1);
            setFechaDesde(format(startOfMonth(mesAnt), 'yyyy-MM-dd'));
            setFechaHasta(format(endOfMonth(mesAnt), 'yyyy-MM-dd'));
        } else if (preset === 'esteAno') {
            setFechaDesde(format(startOfYear(ahora), 'yyyy-MM-dd'));
            setFechaHasta(format(endOfYear(ahora), 'yyyy-MM-dd'));
        } else if (preset === 'todos') {
            setFechaDesde('');
            setFechaHasta('');
        }
    };

    // ─── Filtrado de Remisiones por Período de Fecha ───────────────────────────
    const remisionesFiltradas = useMemo(() => {
        return remisiones.filter(r => {
            if (fechaDesde && r.fecha < fechaDesde) return false;
            if (fechaHasta && r.fecha > fechaHasta) return false;
            return true;
        });
    }, [remisiones, fechaDesde, fechaHasta]);

    // ─── Cálculo de Métricas y Datos del Reporte (Solo Financieros) ───────────
    const metricas = useMemo(() => {
        const facturasPeriodo = (invoices || []).filter(inv => {
            if (fechaDesde && inv.date < fechaDesde) return false;
            if (fechaHasta && inv.date > fechaHasta) return false;
            return true;
        });

        const totalFacturado = facturasPeriodo.reduce((s, inv) => s + (Number(inv.amount) || 0), 0);
        const totalPagado = facturasPeriodo.reduce((s, inv) => {
            if (inv.status === 'Paid' || inv.status === 'Pagada') return s + (Number(inv.amount) || 0);
            return s + (Number(inv.paidAmount) || 0);
        }, 0);
        const saldoPendiente = Math.max(0, totalFacturado - totalPagado);

        return {
            totalFacturado,
            totalPagado,
            saldoPendiente
        };
    }, [invoices, fechaDesde, fechaHasta]);

    // ─── Resumen por Cliente y Obra (para pestaña de ingresos) ──────────────────
    const clientesResumen = useMemo(() => {
        const map = new Map();

        // 1. Recorrer remisiones del período para asociar obras y clientes
        remisionesFiltradas.forEach(r => {
            const cId = r.clientId;
            if (!cId) return;
            if (!map.has(cId)) {
                const cl = clients.find(c => c.id === cId);
                map.set(cId, {
                    cId,
                    client: cl || { name: cId, nit: '—' },
                    obrasSet: new Set(),
                    ingresosFacturados: 0,
                    ingresosCobrados: 0
                });
            }
            const item = map.get(cId);
            const cl = clients.find(c => c.id === cId);
            const ob = cl?.obras?.find(o => o.id === r.obraId);
            if (ob?.nombre) item.obrasSet.add(ob.nombre);
            else if (r.obraNombre) item.obrasSet.add(r.obraNombre);
        });

        // 2. Recorrer facturas en el período
        (invoices || []).forEach(inv => {
            if (fechaDesde && inv.date < fechaDesde) return false;
            if (fechaHasta && inv.date > fechaHasta) return false;
            const cId = inv.clientId;
            if (!cId) return;

            if (!map.has(cId)) {
                const cl = clients.find(c => c.id === cId);
                map.set(cId, {
                    cId,
                    client: cl || { name: cId, nit: '—' },
                    obrasSet: new Set(),
                    ingresosFacturados: 0,
                    ingresosCobrados: 0
                });
            }

            const item = map.get(cId);
            const cl = clients.find(c => c.id === cId);
            if (inv.obraId) {
                const ob = cl?.obras?.find(o => o.id === inv.obraId);
                if (ob?.nombre) item.obrasSet.add(ob.nombre);
            } else if (inv.obra) {
                item.obrasSet.add(inv.obra);
            }

            const amt = Number(inv.amount) || 0;
            const paid = (inv.status === 'Paid' || inv.status === 'Pagada') ? amt : (Number(inv.paidAmount) || 0);
            item.ingresosFacturados += amt;
            item.ingresosCobrados += paid;
        });

        return Array.from(map.values()).map(val => {
            const cl = val.client;
            let obraText = Array.from(val.obrasSet).filter(Boolean).join(', ');
            if (!obraText && cl?.obras?.length) {
                obraText = cl.obras.map(o => o.nombre).filter(Boolean).join(', ');
            }
            return {
                ...val,
                obraText: obraText || cl?.obra || '—'
            };
        }).sort((a, b) => b.ingresosFacturados - a.ingresosFacturados);
    }, [remisionesFiltradas, clients, invoices, fechaDesde, fechaHasta]);

    // ─── Resumen por Ítems / Equipos ──────────────────────────────────────────
    const equiposResumen = useMemo(() => {
        const prodMap = new Map();

        remisionesFiltradas.forEach(r => {
            (r.items || []).forEach(it => {
                const pId = it.productId || it.nombre;
                if (!prodMap.has(pId)) {
                    const prod = products.find(p => p.id === pId);
                    prodMap.set(pId, {
                        id: pId,
                        nombre: it.nombre || prod?.name || pId,
                        categoria: traducirCategoria(prod?.category || it.category),
                        vecesAlquilado: 0,
                        totalDespachado: 0,
                        totalDevuelto: 0,
                        enCampo: 0
                    });
                }

                const rec = prodMap.get(pId);
                rec.vecesAlquilado += 1;
                const c = Number(it.cantidad) || 0;
                const cd = Number(it.cantidadDevuelta) || 0;
                rec.totalDespachado += c;
                rec.totalDevuelto += cd;
                rec.enCampo += Math.max(0, c - cd);
            });
        });

        return Array.from(prodMap.values()).sort((a, b) => b.totalDespachado - a.totalDespachado);
    }, [remisionesFiltradas, products]);

    // ─── Resumen de Cartera y Deudas de Clientes (Quién debe y cuánto) ────────
    const carteraResumen = useMemo(() => {
        const mapped = clients.map(c => {
            const clientInvs = (invoices || []).filter(i => 
                i.clientId === c.id && (i.status === 'Pending' || i.status === 'Partial')
            );
            const invDebt = clientInvs.reduce((s, i) => s + (Number(i.amount) - (Number(i.paidAmount) || 0)), 0);
            const totalDeuda = Math.max(Number(c.debt) || 0, invDebt);

            return {
                client: c,
                totalDeuda,
                invDebt,
                pendingInvoices: clientInvs,
                facturasCount: clientInvs.length,
                facturasStr: clientInvs.map(i => i.id).join(', ')
            };
        });

        const filtered = soloConDeuda 
            ? mapped.filter(item => item.totalDeuda > 0)
            : mapped;

        return filtered.sort((a, b) => b.totalDeuda - a.totalDeuda);
    }, [clients, invoices, soloConDeuda]);

    const metricasCartera = useMemo(() => {
        const totalCartera = carteraResumen.reduce((s, c) => s + c.totalDeuda, 0);
        const clientesConDeudaCount = carteraResumen.filter(c => c.totalDeuda > 0).length;
        const totalFacturasPendientes = carteraResumen.reduce((s, c) => s + c.facturasCount, 0);
        return {
            totalCartera,
            clientesConDeudaCount,
            totalFacturasPendientes
        };
    }, [carteraResumen]);

    // ─── Generación de PDF ────────────────────────────────────────────────────
    const exportarPDF = () => {
        try {
            const doc = new jsPDF({ orientation: 'portrait', format: 'letter', unit: 'mm' });
            const W = doc.internal.pageSize.getWidth();
            const H = doc.internal.pageSize.getHeight();
            const margin = 10;

            // Encabezado institucional con título centrado
            const nroDoc = format(new Date(), 'yyyyMMdd-HHmm');
            let y = applyStandardLayout(
                doc,
                reportType === 'cartera'
                    ? 'ESTADO DE CARTERA Y SALDOS PENDIENTES'
                    : (reportType === 'ingresos'
                        ? 'CONSOLIDADO DE INGRESOS POR CLIENTE'
                        : 'INFORME DE REMISIONES Y ALQUILER'),
                settings,
                nroDoc,
                { skipFooter: true, centerTitle: true }
            );

            // Cuadro de Parámetros del Reporte (Solo Período con mes en letras, sin texto redundante)
            const badgeText = `Período: ${periodoStr}`;

            doc.setFontSize(8);
            doc.setFont('helvetica', 'bold');
            const badgeTextW = doc.getTextWidth(badgeText);
            const badgeW = Math.min(W - margin * 2, badgeTextW + 14);
            const badgeH = 6;
            const badgeX = (W - badgeW) / 2;

            doc.setFillColor(239, 246, 255);
            doc.setDrawColor(191, 219, 254);
            doc.setLineWidth(0.2);
            doc.roundedRect(badgeX, y, badgeW, badgeH, 1.5, 1.5, 'FD');

            doc.setTextColor(35, 101, 171);
            doc.text(badgeText, W / 2, y + 4.2, { align: 'center' });

            y += badgeH + 5;

            // Tabla de Resumen Ejecutivo / Métricas
            if (reportType === 'cartera') {
                autoTable(doc, {
                    startY: y,
                    margin: { left: margin, right: margin },
                    head: [['TOTAL CARTERA POR COBRAR', 'CLIENTES CON SALDO DEUDOR', 'FACTURAS PENDIENTES', 'TOTAL CLIENTES EVALUADOS']],
                    body: [[
                        fmtCOP(metricasCartera.totalCartera),
                        `${metricasCartera.clientesConDeudaCount} clientes`,
                        `${metricasCartera.totalFacturasPendientes} facturas`,
                        `${carteraResumen.length} clientes`
                    ]],
                    theme: 'plain',
                    headStyles: {
                        fillColor: [35, 101, 171],
                        textColor: 255,
                        fontSize: 7.5,
                        fontStyle: 'bold',
                        halign: 'center'
                    },
                    styles: {
                        fontSize: 8,
                        halign: 'center',
                        fontStyle: 'bold',
                        textColor: [30, 41, 59],
                        cellPadding: 2.5,
                        lineWidth: 0.1,
                        lineColor: [203, 213, 225]
                    },
                    columnStyles: {
                        0: { textColor: [35, 101, 171] }
                    }
                });
            } else {
                autoTable(doc, {
                    startY: y,
                    margin: { left: margin, right: margin },
                    head: [['TOTAL FACTURADO', 'TOTAL RECAUDADO / COBRADO', 'SALDO PENDIENTE']],
                    body: [[
                        fmtCOP(metricas.totalFacturado),
                        fmtCOP(metricas.totalPagado),
                        fmtCOP(metricas.saldoPendiente)
                    ]],
                    theme: 'plain',
                    headStyles: {
                        fillColor: [35, 101, 171],
                        textColor: 255,
                        fontSize: 7.5,
                        fontStyle: 'bold',
                        halign: 'center'
                    },
                    styles: {
                        fontSize: 8,
                        halign: 'center',
                        fontStyle: 'bold',
                        textColor: [30, 41, 59],
                        cellPadding: 2.5,
                        lineWidth: 0.1,
                        lineColor: [203, 213, 225]
                    },
                    columnStyles: {
                        0: { textColor: [35, 101, 171] },
                        1: { textColor: [16, 185, 129] },
                        2: { textColor: [35, 101, 171] }
                    }
                });
            }

            y = doc.lastAutoTable.finalY + 6;

            // Sección según tipo de reporte seleccionado
            if (reportType === 'cartera') {
                doc.setFont('helvetica', 'bold');
                doc.setFontSize(8.5);
                doc.setTextColor(35, 101, 171);
                doc.text('ESTADO DE CARTERA Y SALDOS PENDIENTES POR CLIENTE', margin, y);
                y += 3.5;

                autoTable(doc, {
                    startY: y,
                    margin: { left: margin, right: margin, bottom: 22 },
                    head: [['#', 'CLIENTE / RAZÓN SOCIAL', 'FACTURAS PENDIENTES', 'TOTAL DEUDA (COP)']],
                    body: carteraResumen.map((cr, idx) => [
                        idx + 1,
                        cr.client?.name?.toUpperCase() || '—',
                        cr.facturasStr || (cr.totalDeuda > 0 ? 'Saldo registrado' : 'Al día'),
                        cr.totalDeuda > 0 ? fmtCOP(cr.totalDeuda) : '$0 (Al día)'
                    ]),
                    foot: [[
                        '',
                        'TOTAL CARTERA POR COBRAR:',
                        `${metricasCartera.totalFacturasPendientes} facturas pendientes`,
                        fmtCOP(metricasCartera.totalCartera)
                    ]],
                    theme: 'plain',
                    headStyles: { fillColor: [241, 245, 249], textColor: [30, 41, 59], fontSize: 7.5, fontStyle: 'bold', lineWidth: 0.1, lineColor: [203, 213, 225] },
                    footStyles: { fillColor: [239, 246, 255], textColor: [35, 101, 171], fontSize: 7.5, fontStyle: 'bold', lineWidth: 0.2, lineColor: [191, 219, 254] },
                    styles: { fontSize: 7, cellPadding: 2.2, lineWidth: 0.1, lineColor: [226, 232, 240] },
                    columnStyles: {
                        0: { halign: 'center', cellWidth: 10 },
                        1: { halign: 'left', cellWidth: 90 },
                        2: { halign: 'center', cellWidth: 50 },
                        3: { halign: 'right', fontStyle: 'bold', textColor: [35, 101, 171], cellWidth: 45 }
                    }
                });
            } else if (reportType === 'ingresos') {
                // Reporte consolidado de ingresos por cliente y obra
                doc.setFont('helvetica', 'bold');
                doc.setFontSize(8.5);
                doc.setTextColor(30, 41, 59);
                doc.text('CONSOLIDADO DE INGRESOS POR CLIENTE Y OBRA', margin, y);
                y += 3;

                const totalFact = clientesResumen.reduce((s, c) => s + c.ingresosFacturados, 0);
                const totalCobr = clientesResumen.reduce((s, c) => s + c.ingresosCobrados, 0);
                const totalSald = clientesResumen.reduce((s, c) => s + Math.max(0, c.ingresosFacturados - c.ingresosCobrados), 0);

                autoTable(doc, {
                    startY: y,
                    margin: { left: margin, right: margin, bottom: 22 },
                    head: [['#', 'CLIENTE / RAZÓN SOCIAL', 'OBRA', 'TOTAL FACTURADO', 'TOTAL COBRADO', 'SALDO PENDIENTE']],
                    body: clientesResumen.map((cr, idx) => [
                        idx + 1,
                        cr.client?.name?.toUpperCase() || '—',
                        cr.obraText || '—',
                        fmtCOP(cr.ingresosFacturados),
                        fmtCOP(cr.ingresosCobrados),
                        fmtCOP(Math.max(0, cr.ingresosFacturados - cr.ingresosCobrados))
                    ]),
                    foot: [[
                        '',
                        'TOTALES CONSOLIDADOS:',
                        '',
                        fmtCOP(totalFact),
                        fmtCOP(totalCobr),
                        fmtCOP(totalSald)
                    ]],
                    theme: 'plain',
                    headStyles: { fillColor: [241, 245, 249], textColor: [30, 41, 59], fontSize: 7.5, fontStyle: 'bold', lineWidth: 0.1, lineColor: [203, 213, 225] },
                    footStyles: { fillColor: [248, 250, 252], textColor: [30, 41, 59], fontSize: 7.5, fontStyle: 'bold', lineWidth: 0.2, lineColor: [203, 213, 225] },
                    styles: { fontSize: 7, cellPadding: 2, lineWidth: 0.1, lineColor: [226, 232, 240] },
                    columnStyles: {
                        0: { halign: 'center', cellWidth: 8 },
                        1: { halign: 'left', cellWidth: 60 },
                        2: { halign: 'left', cellWidth: 45 },
                        3: { halign: 'right', fontStyle: 'bold', textColor: [35, 101, 171], cellWidth: 27 },
                        4: { halign: 'right', fontStyle: 'bold', textColor: [16, 185, 129], cellWidth: 27 },
                        5: { halign: 'right', fontStyle: 'bold', textColor: [35, 101, 171], cellWidth: 28 }
                    }
                });
            } else if (reportType === 'equipos') {
                // Reporte enfocado a rotación de ítems
                doc.setFont('helvetica', 'bold');
                doc.setFontSize(8.5);
                doc.setTextColor(30, 41, 59);
                doc.text('UTILIZACIÓN Y ROTACIÓN DE ÍTEMS / EQUIPOS EN ALQUILER', margin, y);
                y += 3;

                autoTable(doc, {
                    startY: y,
                    margin: { left: margin, right: margin, bottom: 22 },
                    head: [['#', 'EQUIPO / DESCRIPCIÓN', 'CATEGORÍA', 'DESPACHOS', 'CANTIDAD\nDESPACHADA', 'CANTIDAD\nDEVUELTA', 'SALDO EN\nOBRA']],
                    body: equiposResumen.map((eq, idx) => [
                        idx + 1,
                        eq.nombre.toUpperCase(),
                        eq.categoria,
                        eq.vecesAlquilado,
                        eq.totalDespachado,
                        eq.totalDevuelto,
                        eq.enCampo
                    ]),
                    theme: 'plain',
                    headStyles: { fillColor: [241, 245, 249], textColor: [30, 41, 59], fontSize: 7, fontStyle: 'bold', lineWidth: 0.1, lineColor: [203, 213, 225], halign: 'center', valign: 'middle' },
                    styles: { fontSize: 7, cellPadding: 2, lineWidth: 0.1, lineColor: [226, 232, 240] },
                    columnStyles: {
                        0: { halign: 'center', cellWidth: 8 },
                        1: { halign: 'left', cellWidth: 70 },
                        2: { halign: 'center', cellWidth: 22 },
                        3: { halign: 'center', cellWidth: 23 },
                        4: { halign: 'center', cellWidth: 24 },
                        5: { halign: 'center', cellWidth: 24 },
                        6: { halign: 'center', fontStyle: 'bold', cellWidth: 24 }
                    }
                });
            } else {
                // Reporte Detallado de Remisiones
                doc.setFont('helvetica', 'bold');
                doc.setFontSize(8.5);
                doc.setTextColor(30, 41, 59);
                doc.text('DETALLE INDIVIDUAL DE REMISIONES', margin, y);
                y += 3;

                autoTable(doc, {
                    startY: y,
                    margin: { left: margin, right: margin, bottom: 22 },
                    head: [['REMISIÓN', 'FECHA', 'CLIENTE', 'OBRA / DESTINO', 'ESTADO', 'ÍTEMS DESPACHADOS', 'DEV.', 'EN CAMPO']],
                    body: remisionesFiltradas.map(rem => {
                        const cl = clients.find(c => c.id === rem.clientId);
                        const ob = cl?.obras?.find(o => o.id === rem.obraId);
                        
                        let desp = 0;
                        let dev = 0;
                        const itemsTxt = (rem.items || []).map(it => {
                            const cant = Number(it.cantidad) || 0;
                            const d = Number(it.cantidadDevuelta) || 0;
                            desp += cant;
                            dev += d;
                            return `${it.nombre || it.productId} (${cant})`;
                        }).join(', ');

                        return [
                            rem.id.split('-').pop(),
                            rem.fecha,
                            cl?.name?.substring(0, 24) || rem.clientId,
                            ob?.nombre?.substring(0, 20) || '—',
                            rem.estado,
                            itemsTxt.substring(0, 40) + (itemsTxt.length > 40 ? '...' : ''),
                            dev,
                            Math.max(0, desp - dev)
                        ];
                    }),
                    theme: 'plain',
                    headStyles: { fillColor: [241, 245, 249], textColor: [30, 41, 59], fontSize: 7.5, fontStyle: 'bold', lineWidth: 0.1, lineColor: [203, 213, 225] },
                    styles: { fontSize: 6.8, cellPadding: 2, lineWidth: 0.1, lineColor: [226, 232, 240] },
                    columnStyles: {
                        0: { halign: 'center', cellWidth: 16, fontStyle: 'bold' },
                        1: { halign: 'center', cellWidth: 18 },
                        2: { halign: 'left', cellWidth: 40 },
                        3: { halign: 'left', cellWidth: 32 },
                        4: { halign: 'center', cellWidth: 18 },
                        5: { halign: 'left', cellWidth: 43 },
                        6: { halign: 'center', cellWidth: 14 },
                        7: { halign: 'center', cellWidth: 14, fontStyle: 'bold' }
                    }
                });
            }

            // Pie de página institucional completo en todas las páginas
            const pageCount = doc.internal.getNumberOfPages();
            const companyTitle = settings?.companyName?.toUpperCase() || 'CIELO ALQUILER DE EQUIPOS Y HERRAMIENTAS';
            const nitText = settings?.nit ? `NIT. ${settings.nit}` : 'NIT. 700.112.495 - 2';
            const addressText = settings?.address || 'Calle 14 No. 3 - 62 Pitalito / Huila - Colombia';
            const phoneText = settings?.phone || '3214010834';
            const emailText = settings?.email || 'andresfbol11@gmail.com';

            for (let i = 1; i <= pageCount; i++) {
                doc.setPage(i);

                // Línea divisoria superior del pie de página
                doc.setDrawColor(226, 232, 240);
                doc.setLineWidth(0.3);
                doc.line(margin, H - 18, W - margin, H - 18);

                // Línea 1: Empresa y NIT
                doc.setFontSize(7.5);
                doc.setFont('helvetica', 'bold');
                doc.setTextColor(30, 41, 59);
                doc.text(`${companyTitle}  |  ${nitText}`, W / 2, H - 13.5, { align: 'center' });

                // Línea 2: Dirección y Contacto
                doc.setFontSize(7);
                doc.setFont('helvetica', 'normal');
                doc.setTextColor(71, 85, 105);
                doc.text(`${addressText}  |  Tel: ${phoneText}  |  ${emailText}`, W / 2, H - 9.5, { align: 'center' });

                // Línea 3: Paginación y auditoría
                doc.setFontSize(6.5);
                doc.setTextColor(148, 163, 184);
                const footerText = `Página ${i} de ${pageCount}  |  Informe generado por Sistema ${settings?.shortName || 'CIELO'} el ${format(new Date(), 'dd/MM/yyyy HH:mm')}`;
                doc.text(footerText, W / 2, H - 5.5, { align: 'center' });
            }

            const fileName = reportType === 'cartera'
                ? `Estado_Cartera_${format(new Date(), 'yyyy-MM-dd')}.pdf`
                : (reportType === 'ingresos'
                    ? `Consolidado_Ingresos_${format(new Date(), 'yyyy-MM-dd')}.pdf`
                    : `Informe_Remisiones_${format(new Date(), 'yyyy-MM-dd')}.pdf`);
            doc.save(fileName);
        } catch (error) {
            console.error('Error generando PDF de reporte:', error);
            alert('Error al generar el PDF del reporte.');
        }
    };

    const inputStyle = {
        padding: '0.55rem 0.75rem',
        background: '#ffffff',
        border: '1px solid #cbd5e1',
        borderRadius: 8,
        color: '#1e293b',
        fontSize: '0.85rem',
        outline: 'none',
        width: '100%',
        boxSizing: 'border-box'
    };

    return (
        <div onClick={onClose} style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(15, 23, 42, 0.65)',
            backdropFilter: 'blur(5px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1100,
            padding: '1.5rem'
        }}>
            <div onClick={e => e.stopPropagation()} style={{
                background: '#ffffff',
                borderRadius: '16px',
                boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
                width: '100%',
                maxWidth: 1100,
                maxHeight: '92vh',
                display: 'flex',
                flexDirection: 'column',
                overflow: 'hidden'
            }}>
                {/* Header Modal */}
                <div style={{
                    padding: '1.25rem 2rem',
                    borderBottom: '1px solid #e2e8f0',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    background: 'linear-gradient(to right, #f8fafc, #ffffff)'
                }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.85rem' }}>
                        <div style={{
                            background: 'rgba(35, 101, 171, 0.1)',
                            padding: '0.6rem',
                            borderRadius: '12px',
                            color: '#2365AB'
                        }}>
                            <BarChart2 size={24} />
                        </div>
                        <div>
                            <h3 style={{ margin: 0, color: '#104166', fontSize: '1.25rem', fontWeight: 800 }}>
                                {reportType === 'cartera' ? 'ESTADO DE CARTERA Y SALDOS PENDIENTES' : 'Generador de Informes y Reportes'}
                            </h3>
                            <p style={{ margin: 0, fontSize: '0.8rem', color: '#64748b' }}>
                                {reportType === 'cartera' ? `Nro - ${format(new Date(), 'yyyyMMdd-HHmm')} | Período: ${periodoStr}` : 'Filtros personalizados por período, ingresos y exportación a PDF'}
                            </p>
                        </div>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                        <button
                            onClick={exportarPDF}
                            className="btn btn-primary"
                            style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: '0.5rem',
                                background: '#2365AB',
                                color: 'white',
                                padding: '0.6rem 1.25rem',
                                borderRadius: '8px',
                                fontWeight: 700,
                                fontSize: '0.85rem',
                                boxShadow: '0 4px 6px -1px rgba(35, 101, 171, 0.2)'
                            }}
                        >
                            <Download size={16} /> Descargar PDF
                        </button>
                        <button
                            onClick={onClose}
                            style={{
                                background: '#f1f5f9',
                                border: 'none',
                                borderRadius: '50%',
                                width: 34,
                                height: 34,
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                cursor: 'pointer',
                                color: '#64748b'
                            }}
                        >
                            <X size={18} />
                        </button>
                    </div>
                </div>

                {/* Panel de Contenido Desplazable */}
                <div style={{ padding: '1.5rem 2rem', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                    
                    {/* ─── FILTRO POR PERÍODO DE FECHAS ──────────────────────────── */}
                    <div style={{
                        background: '#f8fafc',
                        border: '1px solid #e2e8f0',
                        borderRadius: '12px',
                        padding: '1.25rem',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '1rem'
                    }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.75rem' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.85rem', fontWeight: 700, color: '#334155' }}>
                                <Calendar size={16} style={{ color: '#2365AB' }} />
                                Período de Fecha
                            </div>
                            {/* Presets de Fecha */}
                            <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap' }}>
                                <button
                                    onClick={() => aplicarPresetFechas('esteMes')}
                                    style={{ background: '#e2e8f0', border: 'none', padding: '0.3rem 0.75rem', borderRadius: '6px', fontSize: '0.75rem', fontWeight: 600, color: '#334155', cursor: 'pointer' }}
                                >
                                    Este Mes
                                </button>
                                <button
                                    onClick={() => aplicarPresetFechas('mesAnterior')}
                                    style={{ background: '#e2e8f0', border: 'none', padding: '0.3rem 0.75rem', borderRadius: '6px', fontSize: '0.75rem', fontWeight: 600, color: '#334155', cursor: 'pointer' }}
                                >
                                    Mes Anterior
                                </button>
                                <button
                                    onClick={() => aplicarPresetFechas('esteAno')}
                                    style={{ background: '#e2e8f0', border: 'none', padding: '0.3rem 0.75rem', borderRadius: '6px', fontSize: '0.75rem', fontWeight: 600, color: '#334155', cursor: 'pointer' }}
                                >
                                    Año en Curso
                                </button>
                                <button
                                    onClick={() => aplicarPresetFechas('todos')}
                                    style={{ background: '#e2e8f0', border: 'none', padding: '0.3rem 0.75rem', borderRadius: '6px', fontSize: '0.75rem', fontWeight: 600, color: '#334155', cursor: 'pointer' }}
                                >
                                    Histórico Completo
                                </button>
                            </div>
                        </div>

                        {/* Controles de Entrada de Fechas */}
                        <div style={{
                            display: 'grid',
                            gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
                            gap: '1rem'
                        }}>
                            <div>
                                <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 700, color: '#64748b', marginBottom: '0.35rem' }}>
                                    Fecha Desde
                                </label>
                                <input
                                    type="date"
                                    value={fechaDesde}
                                    onChange={e => setFechaDesde(e.target.value)}
                                    style={inputStyle}
                                />
                            </div>

                            <div>
                                <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 700, color: '#64748b', marginBottom: '0.35rem' }}>
                                    Fecha Hasta
                                </label>
                                <input
                                    type="date"
                                    value={fechaHasta}
                                    onChange={e => setFechaHasta(e.target.value)}
                                    style={inputStyle}
                                />
                            </div>
                        </div>
                    </div>

                    {/* ─── TARJETAS DE KPIS / RESUMEN ────────────────────────────── */}
                    {reportType === 'cartera' ? (
                        <div style={{
                            display: 'grid',
                            gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
                            gap: '0.75rem'
                        }}>
                            <div style={{ background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: '12px', padding: '1rem', textAlign: 'center' }}>
                                <div style={{ fontSize: '0.7rem', color: '#1e40af', fontWeight: 700, textTransform: 'uppercase' }}>Total Cartera Pendiente</div>
                                <div style={{ fontSize: '1.4rem', fontWeight: 900, color: '#2365AB', marginTop: 4 }}>{fmtCOP(metricasCartera.totalCartera)}</div>
                            </div>

                            <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '12px', padding: '1rem', textAlign: 'center' }}>
                                <div style={{ fontSize: '0.7rem', color: '#64748b', fontWeight: 700, textTransform: 'uppercase' }}>Clientes con Deuda</div>
                                <div style={{ fontSize: '1.4rem', fontWeight: 800, color: '#2365AB', marginTop: 4 }}>{metricasCartera.clientesConDeudaCount}</div>
                            </div>

                            <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '12px', padding: '1rem', textAlign: 'center' }}>
                                <div style={{ fontSize: '0.7rem', color: '#64748b', fontWeight: 700, textTransform: 'uppercase' }}>Facturas por Cobrar</div>
                                <div style={{ fontSize: '1.4rem', fontWeight: 800, color: '#2563eb', marginTop: 4 }}>{metricasCartera.totalFacturasPendientes}</div>
                            </div>

                            <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '12px', padding: '1rem', textAlign: 'center' }}>
                                <div style={{ fontSize: '0.7rem', color: '#64748b', fontWeight: 700, textTransform: 'uppercase' }}>Mayor Deudor Actual</div>
                                <div style={{ fontSize: '0.95rem', fontWeight: 800, color: '#1e293b', marginTop: 4, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={carteraResumen[0]?.client?.name || 'Ninguno'}>
                                    {carteraResumen[0]?.client?.name || 'Ninguno'}
                                </div>
                                <div style={{ fontSize: '0.8rem', color: '#2365AB', fontWeight: 700 }}>
                                    {carteraResumen[0] ? fmtCOP(carteraResumen[0].totalDeuda) : '$0'}
                                </div>
                            </div>
                        </div>
                    ) : (
                        <div style={{
                            display: 'grid',
                            gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
                            gap: '1rem'
                        }}>
                            <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '12px', padding: '1.15rem', textAlign: 'center', boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
                                <div style={{ fontSize: '0.75rem', color: '#64748b', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em' }}>Total Facturado (COP)</div>
                                <div style={{ fontSize: '1.5rem', fontWeight: 900, color: '#2365AB', marginTop: 4 }}>{fmtCOP(metricas.totalFacturado)}</div>
                                <div style={{ fontSize: '0.72rem', color: '#94a3b8', marginTop: 3 }}>Valor total generado en el período</div>
                            </div>

                            <div style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: '12px', padding: '1.15rem', textAlign: 'center', boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
                                <div style={{ fontSize: '0.75rem', color: '#166534', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em' }}>Total Recaudado / Cobrado (COP)</div>
                                <div style={{ fontSize: '1.5rem', fontWeight: 900, color: '#10b981', marginTop: 4 }}>{fmtCOP(metricas.totalPagado)}</div>
                                <div style={{ fontSize: '0.72rem', color: '#15803d', marginTop: 3 }}>Dinero efectivamente cobrado</div>
                            </div>

                            <div style={{ background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: '12px', padding: '1.15rem', textAlign: 'center', boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
                                <div style={{ fontSize: '0.75rem', color: '#1e40af', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em' }}>Saldo Pendiente (COP)</div>
                                <div style={{ fontSize: '1.5rem', fontWeight: 900, color: '#2365AB', marginTop: 4 }}>{fmtCOP(metricas.saldoPendiente)}</div>
                                <div style={{ fontSize: '0.72rem', color: '#3b82f6', marginTop: 3 }}>Diferencia pendiente por cobrar</div>
                            </div>
                        </div>
                    )}

                    {/* ─── PESTAÑAS DE VISTA PREVIA ──────────────────────────────── */}
                    <div style={{ display: 'flex', borderBottom: '1px solid #e2e8f0', gap: '0.75rem', flexWrap: 'wrap' }}>
                        <button
                            onClick={() => setReportType('cartera')}
                            style={{
                                background: reportType === 'cartera' ? 'rgba(35, 101, 171, 0.08)' : 'none',
                                border: 'none',
                                padding: '0.6rem 0.75rem',
                                borderRadius: '6px 6px 0 0',
                                fontSize: '0.85rem',
                                fontWeight: 700,
                                cursor: 'pointer',
                                color: reportType === 'cartera' ? '#2365AB' : '#64748b',
                                borderBottom: reportType === 'cartera' ? '2px solid #2365AB' : '2px solid transparent',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '0.35rem'
                            }}
                        >
                            <DollarSign size={15} style={{ color: reportType === 'cartera' ? '#2365AB' : '#64748b' }} />
                            Cartera y Deudas ({carteraResumen.length})
                        </button>
                        <button
                            onClick={() => setReportType('ingresos')}
                            style={{
                                background: 'none',
                                border: 'none',
                                padding: '0.6rem 0.5rem',
                                fontSize: '0.85rem',
                                fontWeight: 700,
                                cursor: 'pointer',
                                color: reportType === 'ingresos' ? '#2365AB' : '#64748b',
                                borderBottom: reportType === 'ingresos' ? '2px solid #2365AB' : '2px solid transparent'
                            }}
                        >
                            Consolidado de Ingresos por Cliente ({clientesResumen.length})
                        </button>
                        <button
                            onClick={() => setReportType('detallado')}
                            style={{
                                background: 'none',
                                border: 'none',
                                padding: '0.6rem 0.5rem',
                                fontSize: '0.85rem',
                                fontWeight: 700,
                                cursor: 'pointer',
                                color: reportType === 'detallado' ? '#2365AB' : '#64748b',
                                borderBottom: reportType === 'detallado' ? '2px solid #2365AB' : '2px solid transparent'
                            }}
                        >
                            Vista Detallada Remisiones ({remisionesFiltradas.length})
                        </button>
                        <button
                            onClick={() => setReportType('equipos')}
                            style={{
                                background: 'none',
                                border: 'none',
                                padding: '0.6rem 0.5rem',
                                fontSize: '0.85rem',
                                fontWeight: 700,
                                cursor: 'pointer',
                                color: reportType === 'equipos' ? '#2365AB' : '#64748b',
                                borderBottom: reportType === 'equipos' ? '2px solid #2365AB' : '2px solid transparent'
                            }}
                        >
                            Rotación de Equipos ({equiposResumen.length})
                        </button>
                    </div>

                    {/* ─── TABLA DE VISTA PREVIA ─────────────────────────────────── */}
                    <div style={{
                        border: '1px solid #e2e8f0',
                        borderRadius: '12px',
                        overflowX: 'auto',
                        maxHeight: '340px'
                    }}>
                        {reportType === 'detallado' && (
                            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8rem' }}>
                                <thead style={{ background: '#f8fafc', position: 'sticky', top: 0, zIndex: 10 }}>
                                    <tr style={{ borderBottom: '1px solid #e2e8f0', color: '#64748b', textTransform: 'uppercase', fontSize: '0.7rem' }}>
                                        <th style={{ padding: '0.75rem', textAlign: 'center' }}>Remisión</th>
                                        <th style={{ padding: '0.75rem', textAlign: 'center' }}>Fecha</th>
                                        <th style={{ padding: '0.75rem', textAlign: 'left' }}>Cliente</th>
                                        <th style={{ padding: '0.75rem', textAlign: 'left' }}>Obra</th>
                                        <th style={{ padding: '0.75rem', textAlign: 'center' }}>Estado</th>
                                        <th style={{ padding: '0.75rem', textAlign: 'left' }}>Equipos Despachados</th>
                                        <th style={{ padding: '0.75rem', textAlign: 'center' }}>Devueltos</th>
                                        <th style={{ padding: '0.75rem', textAlign: 'center' }}>En Obra</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {remisionesFiltradas.length === 0 ? (
                                        <tr>
                                            <td colSpan={8} style={{ padding: '2rem', textAlign: 'center', color: '#94a3b8' }}>
                                                No se encontraron remisiones con los filtros seleccionados.
                                            </td>
                                        </tr>
                                    ) : (
                                        remisionesFiltradas.map(rem => {
                                            const cl = clients.find(c => c.id === rem.clientId);
                                            const ob = cl?.obras?.find(o => o.id === rem.obraId);
                                            const totalDesp = (rem.items || []).reduce((s, i) => s + (Number(i.cantidad) || 0), 0);
                                            const totalDev = (rem.items || []).reduce((s, i) => s + (Number(i.cantidadDevuelta) || 0), 0);
                                            const enObra = Math.max(0, totalDesp - totalDev);

                                            return (
                                                <tr key={rem.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                                                    <td style={{ padding: '0.75rem', textAlign: 'center', fontWeight: 800, color: '#2365AB' }}>
                                                        {rem.id.split('-').pop()}
                                                    </td>
                                                    <td style={{ padding: '0.75rem', textAlign: 'center', color: '#64748b' }}>
                                                        {rem.fecha}
                                                    </td>
                                                    <td style={{ padding: '0.75rem', fontWeight: 600 }}>
                                                        {cl?.name || rem.clientId}
                                                    </td>
                                                    <td style={{ padding: '0.75rem', color: '#64748b' }}>
                                                        {ob?.nombre || '—'}
                                                    </td>
                                                    <td style={{ padding: '0.75rem', textAlign: 'center' }}>
                                                        <span style={{
                                                            fontSize: '0.7rem',
                                                            fontWeight: 700,
                                                            padding: '2px 8px',
                                                            borderRadius: 999,
                                                            background: rem.estado === 'Activa' ? 'rgba(35, 101, 171, 0.1)' : rem.estado === 'Cerrada' ? 'rgba(16, 185, 129, 0.1)' : 'rgba(249, 115, 22, 0.1)',
                                                            color: rem.estado === 'Activa' ? '#2365AB' : rem.estado === 'Cerrada' ? '#10b981' : '#f97316'
                                                        }}>
                                                            {rem.estado}
                                                        </span>
                                                    </td>
                                                    <td style={{ padding: '0.75rem' }}>
                                                        {(rem.items || []).map((it, idx) => (
                                                            <div key={idx} style={{ fontSize: '0.75rem', color: '#334155' }}>
                                                                • {it.nombre || it.productId} <strong>({it.cantidad})</strong>
                                                            </div>
                                                        ))}
                                                    </td>
                                                    <td style={{ padding: '0.75rem', textAlign: 'center', color: '#10b981', fontWeight: 700 }}>
                                                        {totalDev}
                                                    </td>
                                                    <td style={{ padding: '0.75rem', textAlign: 'center', color: enObra > 0 ? '#f97316' : '#64748b', fontWeight: 700 }}>
                                                        {enObra}
                                                    </td>
                                                </tr>
                                            );
                                        })
                                    )}
                                </tbody>
                            </table>
                        )}

                        {reportType === 'ingresos' && (
                            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8rem' }}>
                                <thead style={{ background: '#f8fafc', position: 'sticky', top: 0, zIndex: 10 }}>
                                    <tr style={{ borderBottom: '1px solid #e2e8f0', color: '#64748b', textTransform: 'uppercase', fontSize: '0.7rem' }}>
                                        <th style={{ padding: '0.75rem', textAlign: 'center', width: 40 }}>#</th>
                                        <th style={{ padding: '0.75rem', textAlign: 'left' }}>Cliente / Empresa</th>
                                        <th style={{ padding: '0.75rem', textAlign: 'left' }}>Obra</th>
                                        <th style={{ padding: '0.75rem', textAlign: 'right' }}>Total Facturado</th>
                                        <th style={{ padding: '0.75rem', textAlign: 'right' }}>Total Cobrado</th>
                                        <th style={{ padding: '0.75rem', textAlign: 'right' }}>Saldo Pendiente</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {clientesResumen.length === 0 ? (
                                        <tr>
                                            <td colSpan={6} style={{ padding: '2rem', textAlign: 'center', color: '#94a3b8' }}>
                                                Sin datos de clientes e ingresos en el período seleccionado.
                                            </td>
                                        </tr>
                                    ) : (
                                        clientesResumen.map((cr, idx) => (
                                            <tr key={idx} style={{ borderBottom: '1px solid #f1f5f9' }}>
                                                <td style={{ padding: '0.75rem', textAlign: 'center', color: '#94a3b8', fontWeight: 600 }}>
                                                    {idx + 1}
                                                </td>
                                                <td style={{ padding: '0.75rem', fontWeight: 700, color: '#1e293b' }}>
                                                    {cr.client?.name}
                                                </td>
                                                <td style={{ padding: '0.75rem', color: '#475569' }}>
                                                    {cr.obraText}
                                                </td>
                                                <td style={{ padding: '0.75rem', textAlign: 'right', fontWeight: 700, color: '#2365AB' }}>
                                                    {fmtCOP(cr.ingresosFacturados)}
                                                </td>
                                                <td style={{ padding: '0.75rem', textAlign: 'right', fontWeight: 700, color: '#10b981' }}>
                                                    {fmtCOP(cr.ingresosCobrados)}
                                                </td>
                                                <td style={{ padding: '0.75rem', textAlign: 'right', fontWeight: 700, color: (cr.ingresosFacturados - cr.ingresosCobrados) > 0 ? '#2365AB' : '#64748b' }}>
                                                    {fmtCOP(Math.max(0, cr.ingresosFacturados - cr.ingresosCobrados))}
                                                </td>
                                            </tr>
                                        ))
                                    )}
                                </tbody>
                                {clientesResumen.length > 0 && (
                                    <tfoot style={{ background: '#f8fafc', borderTop: '2px solid #cbd5e1', fontWeight: 800 }}>
                                        <tr>
                                            <td colSpan={3} style={{ padding: '0.75rem', textAlign: 'right', color: '#334155' }}>
                                                TOTALES CONSOLIDADOS:
                                            </td>
                                            <td style={{ padding: '0.75rem', textAlign: 'right', color: '#2365AB' }}>
                                                {fmtCOP(clientesResumen.reduce((s, c) => s + c.ingresosFacturados, 0))}
                                            </td>
                                            <td style={{ padding: '0.75rem', textAlign: 'right', color: '#10b981' }}>
                                                {fmtCOP(clientesResumen.reduce((s, c) => s + c.ingresosCobrados, 0))}
                                            </td>
                                            <td style={{ padding: '0.75rem', textAlign: 'right', color: '#2365AB' }}>
                                                {fmtCOP(clientesResumen.reduce((s, c) => s + Math.max(0, c.ingresosFacturados - c.ingresosCobrados), 0))}
                                            </td>
                                        </tr>
                                    </tfoot>
                                )}
                            </table>
                        )}

                        {reportType === 'equipos' && (
                            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8rem' }}>
                                <thead style={{ background: '#f8fafc', position: 'sticky', top: 0, zIndex: 10 }}>
                                    <tr style={{ borderBottom: '1px solid #e2e8f0', color: '#64748b', textTransform: 'uppercase', fontSize: '0.7rem' }}>
                                        <th style={{ padding: '0.75rem', textAlign: 'left' }}>Equipo / Ítem</th>
                                        <th style={{ padding: '0.75rem', textAlign: 'center' }}>Categoría</th>
                                        <th style={{ padding: '0.75rem', textAlign: 'center' }}>Veces Despachado</th>
                                        <th style={{ padding: '0.75rem', textAlign: 'center' }}>Total Despachado</th>
                                        <th style={{ padding: '0.75rem', textAlign: 'center' }}>Total Devuelto</th>
                                        <th style={{ padding: '0.75rem', textAlign: 'center' }}>Saldo en Obra</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {equiposResumen.length === 0 ? (
                                        <tr>
                                            <td colSpan={6} style={{ padding: '2rem', textAlign: 'center', color: '#94a3b8' }}>
                                                Sin datos de ítems o equipos para los filtros aplicados.
                                            </td>
                                        </tr>
                                    ) : (
                                        equiposResumen.map((eq, idx) => (
                                            <tr key={idx} style={{ borderBottom: '1px solid #f1f5f9' }}>
                                                <td style={{ padding: '0.75rem', fontWeight: 700, color: '#1e293b' }}>
                                                    {eq.nombre}
                                                </td>
                                                <td style={{ padding: '0.75rem', textAlign: 'center', color: '#64748b' }}>
                                                    {eq.categoria}
                                                </td>
                                                <td style={{ padding: '0.75rem', textAlign: 'center', fontWeight: 600 }}>
                                                    {eq.vecesAlquilado}
                                                </td>
                                                <td style={{ padding: '0.75rem', textAlign: 'center', fontWeight: 700 }}>
                                                    {eq.totalDespachado}
                                                </td>
                                                <td style={{ padding: '0.75rem', textAlign: 'center', color: '#10b981', fontWeight: 700 }}>
                                                    {eq.totalDevuelto}
                                                </td>
                                                <td style={{ padding: '0.75rem', textAlign: 'center', color: eq.enCampo > 0 ? '#f97316' : '#64748b', fontWeight: 800 }}>
                                                    {eq.enCampo}
                                                </td>
                                            </tr>
                                        ))
                                    )}
                                </tbody>
                            </table>
                        )}

                        {reportType === 'cartera' && (
                            <div>
                                {/* Encabezado Centrado de Cartera */}
                                <div style={{ textAlign: 'center', padding: '0.85rem 1rem', background: '#f8fafc', borderBottom: '1px solid #e2e8f0' }}>
                                    <div style={{ fontSize: '1.05rem', fontWeight: 800, color: '#2365AB', letterSpacing: '0.02em' }}>
                                        ESTADO DE CARTERA Y SALDOS PENDIENTES
                                    </div>
                                    <div style={{ fontSize: '0.82rem', fontWeight: 700, color: '#64748b', marginTop: 2 }}>
                                        Nro - {format(new Date(), 'yyyyMMdd-HHmm')}
                                    </div>
                                </div>

                                {/* Control de Filtro de Cartera */}
                                <div style={{
                                    display: 'flex',
                                    justifyContent: 'space-between',
                                    alignItems: 'center',
                                    padding: '0.75rem 1rem',
                                    background: '#f8fafc',
                                    borderBottom: '1px solid #e2e8f0'
                                }}>
                                    <div style={{ fontSize: '0.8rem', color: '#334155', fontWeight: 600 }}>
                                        Mostrando <strong>{carteraResumen.length}</strong> clientes {soloConDeuda ? 'con saldo pendiente' : 'en total'}.
                                    </div>
                                    <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.8rem', fontWeight: 700, color: '#334155', cursor: 'pointer' }}>
                                        <input
                                            type="checkbox"
                                            checked={soloConDeuda}
                                            onChange={e => setSoloConDeuda(e.target.checked)}
                                            style={{ width: 16, height: 16, accentColor: '#2365AB', cursor: 'pointer' }}
                                        />
                                        Solo clientes con saldo pendiente
                                    </label>
                                </div>

                                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8rem' }}>
                                    <thead style={{ background: '#f8fafc', position: 'sticky', top: 0, zIndex: 10 }}>
                                        <tr style={{ borderBottom: '1px solid #e2e8f0', color: '#64748b', textTransform: 'uppercase', fontSize: '0.7rem' }}>
                                            <th style={{ padding: '0.75rem', textAlign: 'center', width: 40 }}>#</th>
                                            <th style={{ padding: '0.75rem', textAlign: 'left' }}>Cliente / Razón Social</th>
                                            <th style={{ padding: '0.75rem', textAlign: 'center' }}>Facturas Pendientes</th>
                                            <th style={{ padding: '0.75rem', textAlign: 'right' }}>Total Deuda (COP)</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {carteraResumen.length === 0 ? (
                                            <tr>
                                                <td colSpan={4} style={{ padding: '2.5rem', textAlign: 'center', color: '#94a3b8' }}>
                                                    {soloConDeuda ? '🎉 ¡Excelente! No hay clientes con saldo pendiente de pago.' : 'No se encontraron clientes.'}
                                                </td>
                                            </tr>
                                        ) : (
                                            carteraResumen.map((item, idx) => (
                                                <tr key={item.client.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                                                    <td style={{ padding: '0.75rem', textAlign: 'center', color: '#94a3b8', fontWeight: 600 }}>
                                                        {idx + 1}
                                                    </td>
                                                    <td style={{ padding: '0.75rem', fontWeight: 700, color: '#1e293b' }}>
                                                        {item.client.name}
                                                    </td>
                                                    <td style={{ padding: '0.75rem', textAlign: 'center' }}>
                                                        {item.pendingInvoices.length > 0 ? (
                                                            <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap', justifyContent: 'center' }}>
                                                                {item.pendingInvoices.map(inv => {
                                                                    const invSaldo = Number(inv.amount) - (Number(inv.paidAmount) || 0);
                                                                    return (
                                                                        <span
                                                                            key={inv.id}
                                                                            style={{
                                                                                background: '#eff6ff',
                                                                                color: '#1d4ed8',
                                                                                border: '1px solid #bfdbfe',
                                                                                padding: '2px 6px',
                                                                                borderRadius: '4px',
                                                                                fontSize: '0.72rem',
                                                                                fontWeight: 700
                                                                            }}
                                                                            title={`Factura ${inv.id}: Saldo pendiente ${fmtCOP(invSaldo)}`}
                                                                        >
                                                                            {inv.id}
                                                                        </span>
                                                                    );
                                                                })}
                                                            </div>
                                                        ) : (
                                                            <span style={{ color: item.totalDeuda > 0 ? '#2365AB' : '#94a3b8', fontSize: '0.75rem', fontStyle: item.totalDeuda > 0 ? 'italic' : 'normal' }}>
                                                                {item.totalDeuda > 0 ? 'Saldo registrado' : '—'}
                                                            </span>
                                                        )}
                                                    </td>
                                                    <td style={{ padding: '0.75rem', textAlign: 'right', fontWeight: 800, color: item.totalDeuda > 0 ? '#2365AB' : '#10b981', fontSize: '0.9rem' }}>
                                                        {item.totalDeuda > 0 ? fmtCOP(item.totalDeuda) : '✓ Al Día'}
                                                    </td>
                                                </tr>
                                            ))
                                        )}
                                    </tbody>
                                    {carteraResumen.length > 0 && (
                                        <tfoot>
                                            <tr style={{ background: '#eff6ff', borderTop: '2px solid #bfdbfe' }}>
                                                <td colSpan={3} style={{ padding: '0.85rem 1rem', textAlign: 'right', fontWeight: 800, color: '#1e40af', textTransform: 'uppercase', fontSize: '0.75rem' }}>
                                                    Gran Total Cartera Pendiente:
                                                </td>
                                                <td style={{ padding: '0.85rem 1rem', textAlign: 'right', fontWeight: 900, color: '#2365AB', fontSize: '1.05rem' }}>
                                                    {fmtCOP(metricasCartera.totalCartera)}
                                                </td>
                                            </tr>
                                        </tfoot>
                                    )}
                                </table>
                            </div>
                        )}
                    </div>
                </div>

                {/* Footer Modal */}
                <div style={{
                    padding: '1rem 2rem',
                    borderTop: '1px solid #e2e8f0',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    background: '#f8fafc'
                }}>
                    <div style={{ fontSize: '0.8rem', color: '#64748b' }}>
                        {reportType === 'cartera' ? (
                            <>Mostrando <strong>{carteraResumen.length}</strong> clientes evaluados. Total cartera por cobrar: <strong style={{ color: '#2365AB' }}>{fmtCOP(metricasCartera.totalCartera)}</strong>.</>
                        ) : (
                            <>Mostrando <strong>{remisionesFiltradas.length}</strong> remisiones con <strong>{metricas.totalEquiposEnCampo}</strong> equipos en campo.</>
                        )}
                    </div>
                    <div style={{ display: 'flex', gap: '0.75rem' }}>
                        <button
                            onClick={onClose}
                            className="btn btn-secondary"
                            style={{ padding: '0.55rem 1.25rem' }}
                        >
                            Cerrar
                        </button>
                        <button
                            onClick={exportarPDF}
                            className="btn btn-primary"
                            style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: '0.5rem',
                                background: '#2365AB',
                                color: 'white',
                                padding: '0.55rem 1.25rem',
                                borderRadius: '8px',
                                fontWeight: 700
                            }}
                        >
                            <Download size={16} /> Generar y Descargar PDF
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}
