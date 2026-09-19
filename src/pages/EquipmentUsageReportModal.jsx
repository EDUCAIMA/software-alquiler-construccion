import React, { useState, useMemo } from 'react';
import {
    X, Download, Calendar, Filter, CheckSquare, Square, Search,
    Package, BarChart2, Clock, ChevronDown, ChevronUp, Layers,
    TrendingUp, Building2, Check, RefreshCw, AlertCircle
} from 'lucide-react';
import {
    format,
    startOfMonth,
    endOfMonth,
    subMonths,
    startOfYear,
    endOfYear,
    differenceInCalendarDays,
    isValid,
    parseISO
} from 'date-fns';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { applyStandardLayout } from './pdfTheme';

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

export default function EquipmentUsageReportModal({
    onClose,
    products = [],
    remisiones = [],
    clients = [],
    settings = {}
}) {
    // ─── Estados de Filtro de Fechas ─────────────────────────────────────────
    const today = new Date();
    const hoyStr = format(today, 'yyyy-MM-dd');
    const [fechaDesde, setFechaDesde] = useState(format(startOfMonth(today), 'yyyy-MM-dd'));
    const [fechaHasta, setFechaHasta] = useState(format(endOfMonth(today), 'yyyy-MM-dd'));

    // ─── Estados de Selección Múltiple de Ítems ──────────────────────────────
    // Por defecto todos los productos están seleccionados
    const [selectedIds, setSelectedIds] = useState(() => new Set(products.map(p => p.id)));
    const [itemSearch, setItemSearch] = useState('');
    const [categoryFilter, setCategoryFilter] = useState('Todas');
    const [showItemPicker, setShowItemPicker] = useState(false);
    const [expandedItem, setExpandedItem] = useState(null);

    // Categorías únicas de productos
    const categorias = useMemo(() => {
        const cats = new Set(products.map(p => p.category || 'General').filter(Boolean));
        return ['Todas', ...Array.from(cats).sort()];
    }, [products]);

    // Presets de Fechas
    const aplicarPreset = (preset) => {
        const ahora = new Date();
        if (preset === 'esteMes') {
            setFechaDesde(format(startOfMonth(ahora), 'yyyy-MM-dd'));
            setFechaHasta(format(endOfMonth(ahora), 'yyyy-MM-dd'));
        } else if (preset === 'mesAnterior') {
            const ant = subMonths(ahora, 1);
            setFechaDesde(format(startOfMonth(ant), 'yyyy-MM-dd'));
            setFechaHasta(format(endOfMonth(ant), 'yyyy-MM-dd'));
        } else if (preset === 'ultimos3Meses') {
            const tres = subMonths(ahora, 2);
            setFechaDesde(format(startOfMonth(tres), 'yyyy-MM-dd'));
            setFechaHasta(format(endOfMonth(ahora), 'yyyy-MM-dd'));
        } else if (preset === 'esteAno') {
            setFechaDesde(format(startOfYear(ahora), 'yyyy-MM-dd'));
            setFechaHasta(format(endOfYear(ahora), 'yyyy-MM-dd'));
        } else if (preset === 'todos') {
            setFechaDesde('');
            setFechaHasta('');
        }
    };

    // Manejadores de Selección de Ítems
    const handleToggleItem = (id) => {
        setSelectedIds(prev => {
            const next = new Set(prev);
            if (next.has(id)) next.delete(id);
            else next.add(id);
            return next;
        });
    };

    const handleSelectAllFiltered = () => {
        setSelectedIds(prev => {
            const next = new Set(prev);
            filteredProductsForPicker.forEach(p => next.add(p.id));
            return next;
        });
    };

    const handleDeselectAllFiltered = () => {
        setSelectedIds(prev => {
            const next = new Set(prev);
            filteredProductsForPicker.forEach(p => next.delete(p.id));
            return next;
        });
    };

    const handleSelectAll = () => {
        setSelectedIds(new Set(products.map(p => p.id)));
    };

    const handleDeselectAll = () => {
        setSelectedIds(new Set());
    };

    // Productos filtrados dentro del picker modal/desplegable
    const filteredProductsForPicker = useMemo(() => {
        return products.filter(p => {
            const matchesCat = categoryFilter === 'Todas' || (p.category || 'General') === categoryFilter;
            const q = itemSearch.toLowerCase().trim();
            const matchesText = !q || (p.name || '').toLowerCase().includes(q) || (p.id || '').toLowerCase().includes(q);
            return matchesCat && matchesText;
        });
    }, [products, categoryFilter, itemSearch]);

    // ─── CÁLCULO DE DÍAS Y UTILIZACIÓN DE EQUIPOS ─────────────────────────────
    const usageData = useMemo(() => {
        const windowStart = fechaDesde || '1970-01-01';
        const windowEnd = fechaHasta || hoyStr;

        // Mapeo inicial de todos los productos seleccionados
        const resultMap = new Map();
        products.forEach(p => {
            if (!selectedIds.has(p.id)) return;
            resultMap.set(p.id, {
                id: p.id,
                name: p.name || 'Sin nombre',
                category: p.category || 'General',
                tipoPropiedad: p.tipoPropiedad || 'Propio',
                proveedor: p.proveedor || '',
                totalStock: Number(p.totalStock) || 1,
                despachosCount: 0,
                unidadesDespachadas: 0,
                diasUsoTotal: 0,
                diasEquipoTotal: 0,
                obrasMap: new Map(), // obraKey -> { obraName, clientName, dias }
                detalles: []
            });
        });

        // Recorrer todas las remisiones
        (remisiones || []).forEach(rem => {
            const remFecha = rem.fecha;
            if (!remFecha) return;

            (rem.items || []).forEach(it => {
                const prodId = it.productId;
                if (!prodId || !resultMap.has(prodId)) return;

                const itemRec = resultMap.get(prodId);
                const cantTotal = Number(it.cantidad) || 0;
                if (cantTotal <= 0) return;

                const devs = Array.isArray(it.devoluciones) ? it.devoluciones : [];
                let totalDevueltas = 0;

                // 1. Procesar devoluciones registradas con fecha
                devs.forEach(dev => {
                    const cantDev = Number(dev.cantidad) || 0;
                    if (cantDev <= 0) return;
                    totalDevueltas += cantDev;

                    const devFecha = dev.fecha || hoyStr;
                    const rentalStart = remFecha;
                    const rentalEnd = devFecha >= rentalStart ? devFecha : rentalStart;

                    // Intersección con el período seleccionado [windowStart, windowEnd]
                    const effStart = rentalStart > windowStart ? rentalStart : windowStart;
                    const effEnd = rentalEnd < windowEnd ? rentalEnd : windowEnd;

                    if (effStart <= effEnd) {
                        const d1 = new Date(effStart + 'T00:00:00');
                        const d2 = new Date(effEnd + 'T00:00:00');
                        const dias = Math.max(1, differenceInCalendarDays(d2, d1) + 1);
                        const diasEquipo = dias * cantDev;

                        itemRec.diasUsoTotal += dias;
                        itemRec.diasEquipoTotal += diasEquipo;
                        itemRec.unidadesDespachadas += cantDev;
                        itemRec.despachosCount += 1;

                        const obraKey = `${rem.clientId || ''}-${rem.obraId || rem.obraName || ''}`;
                        if (!itemRec.obrasMap.has(obraKey)) {
                            itemRec.obrasMap.set(obraKey, {
                                clientName: rem.clientName || 'Cliente',
                                obraName: rem.obraName || 'Obra',
                                dias: 0
                            });
                        }
                        itemRec.obrasMap.get(obraKey).dias += dias;

                        itemRec.detalles.push({
                            remId: rem.id,
                            clientName: rem.clientName || 'Cliente',
                            obraName: rem.obraName || 'Obra',
                            fechaDespacho: remFecha,
                            fechaDevolucion: devFecha,
                            cantidad: cantDev,
                            dias,
                            diasEquipo,
                            estado: 'Devuelto'
                        });
                    }
                });

                // 2. Procesar unidades pendientes que aún siguen en campo
                const cantDevueltaEnRem = Number(it.cantidadDevuelta) || 0;
                const pendientes = Math.max(0, cantTotal - Math.max(totalDevueltas, cantDevueltaEnRem));

                if (pendientes > 0) {
                    const rentalStart = remFecha;
                    const rentalEnd = hoyStr; // siguen en campo hoy

                    const effStart = rentalStart > windowStart ? rentalStart : windowStart;
                    const effEnd = rentalEnd < windowEnd ? rentalEnd : windowEnd;

                    if (effStart <= effEnd) {
                        const d1 = new Date(effStart + 'T00:00:00');
                        const d2 = new Date(effEnd + 'T00:00:00');
                        const dias = Math.max(1, differenceInCalendarDays(d2, d1) + 1);
                        const diasEquipo = dias * pendientes;

                        itemRec.diasUsoTotal += dias;
                        itemRec.diasEquipoTotal += diasEquipo;
                        itemRec.unidadesDespachadas += pendientes;
                        itemRec.despachosCount += 1;

                        const obraKey = `${rem.clientId || ''}-${rem.obraId || rem.obraName || ''}`;
                        if (!itemRec.obrasMap.has(obraKey)) {
                            itemRec.obrasMap.set(obraKey, {
                                clientName: rem.clientName || 'Cliente',
                                obraName: rem.obraName || 'Obra',
                                dias: 0
                            });
                        }
                        itemRec.obrasMap.get(obraKey).dias += dias;

                        itemRec.detalles.push({
                            remId: rem.id,
                            clientName: rem.clientName || 'Cliente',
                            obraName: rem.obraName || 'Obra',
                            fechaDespacho: remFecha,
                            fechaDevolucion: 'En obra (Activo)',
                            cantidad: pendientes,
                            dias,
                            diasEquipo,
                            estado: 'En campo'
                        });
                    }
                }
            });
        });

        // Convertir mapa a lista y ordenar por mayor número de días de uso
        return Array.from(resultMap.values()).sort((a, b) => b.diasEquipoTotal - a.diasEquipoTotal || b.diasUsoTotal - a.diasUsoTotal);
    }, [products, remisiones, selectedIds, fechaDesde, fechaHasta, hoyStr]);

    // Métricas Globales
    const summary = useMemo(() => {
        const totalEquipos = usageData.length;
        const totalDespachos = usageData.reduce((s, r) => s + r.despachosCount, 0);
        const totalDiasEquipo = usageData.reduce((s, r) => s + r.diasEquipoTotal, 0);
        const totalDiasUso = usageData.reduce((s, r) => s + r.diasUsoTotal, 0);
        const equipoTop = usageData[0]?.diasEquipoTotal > 0 ? usageData[0] : null;

        return {
            totalEquipos,
            totalDespachos,
            totalDiasEquipo,
            totalDiasUso,
            equipoTop
        };
    }, [usageData]);

    // ─── EXPORTACIÓN A PDF INSTITUCIONAL ─────────────────────────────────────
    const handleExportPDF = () => {
        const doc = new jsPDF({ orientation: 'landscape', format: 'letter', unit: 'mm' });
        const W = doc.internal.pageSize.getWidth();
        const H = doc.internal.pageSize.getHeight();
        const margin = 10;

        // 1. Encabezado institucional con { skipFooter: true }
        let y = applyStandardLayout(doc, 'Reporte de Utilización de Equipos', settings, '', { skipFooter: true });

        // 2. Cuadro de Parámetros del Reporte
        const fDesde = formatearFechaMesLetras(fechaDesde);
        const fHasta = formatearFechaMesLetras(fechaHasta);
        const periodoTxt = fDesde && fHasta ? `${fDesde} al ${fHasta}` : (fDesde ? `Desde ${fDesde}` : (fHasta ? `Hasta ${fHasta}` : 'Histórico completo'));

        doc.setFillColor(248, 250, 252);
        doc.setDrawColor(226, 232, 240);
        doc.setLineWidth(0.3);
        doc.roundedRect(margin, y + 2, W - (margin * 2), 14, 2, 2, 'FD');

        doc.setFontSize(8.5);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(30, 41, 59);
        doc.text(`Período de Análisis:`, margin + 4, y + 8);

        doc.setFont('helvetica', 'normal');
        doc.setTextColor(71, 85, 105);
        doc.text(periodoTxt, margin + 35, y + 8);

        doc.setFont('helvetica', 'bold');
        doc.setTextColor(30, 41, 59);
        doc.text(`Equipos Seleccionados:`, margin + 115, y + 8);

        doc.setFont('helvetica', 'normal');
        doc.setTextColor(71, 85, 105);
        doc.text(`${selectedIds.size} de ${products.length} ítems`, margin + 152, y + 8);

        doc.setFont('helvetica', 'bold');
        doc.setTextColor(30, 41, 59);
        doc.text(`Total Días-Equipo:`, margin + 195, y + 8);

        doc.setFont('helvetica', 'bold');
        doc.setTextColor(35, 101, 171);
        doc.text(`${summary.totalDiasEquipo.toLocaleString()} días`, margin + 225, y + 8);

        // 3. Preparación de datos de tabla
        const tableBody = usageData.map(item => {
            const obrasList = Array.from(item.obrasMap.values())
                .map(o => `${o.obraName} (${o.dias}d)`)
                .slice(0, 3)
                .join(', ');

            return [
                item.name,
                item.category,
                item.tipoPropiedad === 'Terceros' ? `Terceros${item.proveedor ? ` (${item.proveedor})` : ''}` : 'Propio',
                item.despachosCount.toString(),
                item.unidadesDespachadas.toString(),
                `${item.diasUsoTotal} días`,
                `${item.diasEquipoTotal} d-eq`,
                obrasList || 'Sin despachos en período'
            ];
        });

        // 4. Tabla autoTable
        autoTable(doc, {
            startY: y + 19,
            margin: { left: margin, right: margin },
            head: [['Equipo / Herramienta', 'Categoría', 'Propiedad', 'Despachos', 'Cant.', 'Días en Obra', 'Días-Equipo', 'Obras / Clientes Principales']],
            body: tableBody,
            headStyles: { fillColor: [35, 101, 171], textColor: 255, fontStyle: 'bold', fontSize: 8 },
            bodyStyles: { fontSize: 7.5, textColor: [30, 41, 59] },
            alternateRowStyles: { fillColor: [248, 250, 252] },
            columnStyles: {
                0: { cellWidth: 55 },
                1: { cellWidth: 32 },
                2: { cellWidth: 28 },
                3: { cellWidth: 20, halign: 'center' },
                4: { cellWidth: 16, halign: 'center' },
                5: { cellWidth: 25, halign: 'center', fontStyle: 'bold' },
                6: { cellWidth: 25, halign: 'center', fontStyle: 'bold', textColor: [35, 101, 171] },
                7: { cellWidth: 'auto' }
            },
            foot: [[
                'TOTALES',
                '',
                '',
                summary.totalDespachos.toString(),
                usageData.reduce((s, r) => s + r.unidadesDespachadas, 0).toString(),
                `${summary.totalDiasUso.toLocaleString()} días`,
                `${summary.totalDiasEquipo.toLocaleString()} d-eq`,
                ''
            ]],
            footStyles: { fillColor: [241, 245, 249], textColor: [30, 41, 59], fontStyle: 'bold', fontSize: 8 }
        });

        // 5. Pie de página en todas las páginas sin sobreescritura
        const pageCount = doc.internal.getNumberOfPages();
        for (let i = 1; i <= pageCount; i++) {
            doc.setPage(i);
            doc.setFontSize(6.5);
            doc.setTextColor(100, 116, 139);
            doc.setFont('helvetica', 'normal');
            const generationInfo = `Página ${i} de ${pageCount}  |  Generado por Sistema de Gestión ${settings?.shortName || 'CIELO'} el ${format(new Date(), 'dd/MM/yyyy HH:mm')}`;
            doc.text(generationInfo, W / 2, H - 8, { align: 'center' });
        }

        const fechaNombre = format(new Date(), 'dd-MM-yyyy');
        doc.save(`Reporte_Uso_Equipos_${settings?.shortName || 'CIELO'}_${fechaNombre}.pdf`);
    };

    return (
        <div className="modal-overlay" onClick={onClose} style={{ zIndex: 1100, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <div
                className="modal-content fadeIn"
                onClick={e => e.stopPropagation()}
                style={{
                    maxWidth: '96%',
                    width: 1350,
                    padding: 0,
                    overflow: 'hidden',
                    height: '92vh',
                    display: 'flex',
                    flexDirection: 'column',
                    borderRadius: 16,
                    background: '#ffffff',
                    boxShadow: '0 20px 40px -15px rgba(0,0,0,0.15)'
                }}
            >
                {/* ── HEADER ── */}
                <div style={{
                    padding: '1.25rem 1.5rem',
                    background: 'linear-gradient(135deg, #1E293B 0%, #0F172A 100%)',
                    color: 'white',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    borderBottom: '1px solid rgba(255,255,255,0.1)'
                }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.85rem' }}>
                        <div style={{
                            width: 44,
                            height: 44,
                            borderRadius: 12,
                            background: 'rgba(37, 99, 235, 0.2)',
                            border: '1px solid rgba(59, 130, 246, 0.4)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center'
                        }}>
                            <BarChart2 size={24} color="#60A5FA" />
                        </div>
                        <div>
                            <h2 style={{ margin: 0, fontSize: '1.25rem', fontWeight: 800, letterSpacing: '-0.02em', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                Reporte de Uso y Días de Alquiler
                                <span style={{ fontSize: '0.75rem', padding: '0.2rem 0.6rem', borderRadius: 999, background: '#2563EB', fontWeight: 700 }}>
                                    MÁQUINAS Y HERRAMIENTAS
                                </span>
                            </h2>
                            <p style={{ margin: 0, fontSize: '0.82rem', color: '#94A3B8' }}>
                                Consulta los días utilizados, rotación y destinos en obra por período e ítems seleccionados
                            </p>
                        </div>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                        <button
                            onClick={handleExportPDF}
                            style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: '0.5rem',
                                padding: '0.55rem 1.1rem',
                                borderRadius: 8,
                                background: '#2563EB',
                                color: 'white',
                                border: 'none',
                                fontWeight: 700,
                                fontSize: '0.85rem',
                                cursor: 'pointer',
                                transition: 'all 0.2s',
                                boxShadow: '0 2px 4px rgba(37, 99, 235, 0.3)'
                            }}
                            onMouseEnter={e => e.currentTarget.style.background = '#1D4ED8'}
                            onMouseLeave={e => e.currentTarget.style.background = '#2563EB'}
                        >
                            <Download size={16} />
                            Exportar PDF
                        </button>

                        <button
                            onClick={onClose}
                            style={{
                                background: 'rgba(255,255,255,0.1)',
                                border: 'none',
                                borderRadius: '50%',
                                width: 36,
                                height: 36,
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                cursor: 'pointer',
                                color: '#94A3B8',
                                transition: 'all 0.2s'
                            }}
                            onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.2)'; e.currentTarget.style.color = '#fff'; }}
                            onMouseLeave={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.1)'; e.currentTarget.style.color = '#94A3B8'; }}
                        >
                            <X size={20} />
                        </button>
                    </div>
                </div>

                {/* ── FILTROS Y CONTROLES ── */}
                <div style={{
                    padding: '1rem 1.5rem',
                    background: '#F8FAFC',
                    borderBottom: '1px solid #E2E8F0',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '0.85rem'
                }}>
                    {/* Fila 1: Fechas y Presets */}
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.75rem' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', color: '#1E293B', fontWeight: 700, fontSize: '0.85rem' }}>
                                <Calendar size={16} color="#2563EB" />
                                Rango de Fechas:
                            </div>

                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                                <input
                                    type="date"
                                    value={fechaDesde}
                                    onChange={e => setFechaDesde(e.target.value)}
                                    style={{
                                        padding: '0.35rem 0.6rem',
                                        borderRadius: 6,
                                        border: '1px solid #CBD5E1',
                                        fontSize: '0.82rem',
                                        background: 'white',
                                        color: '#334155'
                                    }}
                                />
                                <span style={{ color: '#94A3B8', fontSize: '0.82rem' }}>a</span>
                                <input
                                    type="date"
                                    value={fechaHasta}
                                    onChange={e => setFechaHasta(e.target.value)}
                                    style={{
                                        padding: '0.35rem 0.6rem',
                                        borderRadius: 6,
                                        border: '1px solid #CBD5E1',
                                        fontSize: '0.82rem',
                                        background: 'white',
                                        color: '#334155'
                                    }}
                                />
                            </div>

                            {/* Botones Presets */}
                            <div style={{ display: 'flex', gap: '0.35rem' }}>
                                {[
                                    { id: 'esteMes', label: 'Este Mes' },
                                    { id: 'mesAnterior', label: 'Mes Anterior' },
                                    { id: 'ultimos3Meses', label: 'Últimos 3 Meses' },
                                    { id: 'esteAno', label: 'Este Año' },
                                    { id: 'todos', label: 'Histórico' }
                                ].map(p => (
                                    <button
                                        key={p.id}
                                        onClick={() => aplicarPreset(p.id)}
                                        style={{
                                            padding: '0.3rem 0.6rem',
                                            borderRadius: 6,
                                            border: '1px solid #E2E8F0',
                                            background: '#FFFFFF',
                                            fontSize: '0.75rem',
                                            fontWeight: 600,
                                            color: '#475569',
                                            cursor: 'pointer',
                                            transition: 'all 0.15s'
                                        }}
                                        onMouseEnter={e => { e.currentTarget.style.borderColor = '#2563EB'; e.currentTarget.style.color = '#2563EB'; }}
                                        onMouseLeave={e => { e.currentTarget.style.borderColor = '#E2E8F0'; e.currentTarget.style.color = '#475569'; }}
                                    >
                                        {p.label}
                                    </button>
                                ))}
                            </div>
                        </div>

                        {/* Botón Selector Múltiple de Ítems */}
                        <div style={{ position: 'relative' }}>
                            <button
                                onClick={() => setShowItemPicker(prev => !prev)}
                                style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '0.5rem',
                                    padding: '0.45rem 0.9rem',
                                    borderRadius: 8,
                                    border: selectedIds.size === products.length ? '1px solid #CBD5E1' : '1px solid #2563EB',
                                    background: selectedIds.size === products.length ? '#FFFFFF' : '#EFF6FF',
                                    color: selectedIds.size === products.length ? '#334155' : '#1D4ED8',
                                    fontWeight: 700,
                                    fontSize: '0.82rem',
                                    cursor: 'pointer',
                                    boxShadow: '0 1px 2px rgba(0,0,0,0.05)'
                                }}
                            >
                                <Package size={16} />
                                <span>
                                    {selectedIds.size === products.length
                                        ? `Todos los Equipos (${products.length})`
                                        : `${selectedIds.size} de ${products.length} Equipos Seleccionados`}
                                </span>
                                {showItemPicker ? <ChevronUp size={15} /> : <ChevronDown size={15} />}
                            </button>

                            {/* Dropdown / Modal flotante de selección de ítems */}
                            {showItemPicker && (
                                <div style={{
                                    position: 'absolute',
                                    right: 0,
                                    top: '100%',
                                    marginTop: 6,
                                    width: 480,
                                    background: 'white',
                                    borderRadius: 12,
                                    border: '1px solid #E2E8F0',
                                    boxShadow: '0 15px 30px -5px rgba(0,0,0,0.2)',
                                    zIndex: 1200,
                                    padding: '1rem',
                                    display: 'flex',
                                    flexDirection: 'column',
                                    gap: '0.75rem'
                                }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                        <span style={{ fontWeight: 800, fontSize: '0.85rem', color: '#1E293B' }}>
                                            Selección Múltiple de Equipos
                                        </span>
                                        <div style={{ display: 'flex', gap: '0.4rem' }}>
                                            <button
                                                onClick={handleSelectAll}
                                                style={{ fontSize: '0.72rem', color: '#2563EB', background: 'none', border: 'none', fontWeight: 700, cursor: 'pointer' }}
                                            >
                                                Marcar Todos
                                            </button>
                                            <span style={{ color: '#CBD5E1' }}>|</span>
                                            <button
                                                onClick={handleDeselectAll}
                                                style={{ fontSize: '0.72rem', color: '#DC2626', background: 'none', border: 'none', fontWeight: 700, cursor: 'pointer' }}
                                            >
                                                Desmarcar Todos
                                            </button>
                                        </div>
                                    </div>

                                    {/* Buscador y filtro categoría */}
                                    <div style={{ display: 'grid', gridTemplateColumns: '1.4fr 1fr', gap: '0.5rem' }}>
                                        <div style={{ position: 'relative' }}>
                                            <Search size={14} style={{ position: 'absolute', left: 8, top: '50%', transform: 'translateY(-50%)', color: '#94A3B8' }} />
                                            <input
                                                type="text"
                                                placeholder="Buscar equipo..."
                                                value={itemSearch}
                                                onChange={e => setItemSearch(e.target.value)}
                                                style={{
                                                    width: '100%',
                                                    padding: '0.35rem 0.5rem 0.35rem 1.7rem',
                                                    borderRadius: 6,
                                                    border: '1px solid #CBD5E1',
                                                    fontSize: '0.78rem'
                                                }}
                                            />
                                        </div>
                                        <select
                                            value={categoryFilter}
                                            onChange={e => setCategoryFilter(e.target.value)}
                                            style={{
                                                padding: '0.35rem 0.5rem',
                                                borderRadius: 6,
                                                border: '1px solid #CBD5E1',
                                                fontSize: '0.78rem',
                                                background: 'white'
                                            }}
                                        >
                                            {categorias.map(c => (
                                                <option key={c} value={c}>{c}</option>
                                            ))}
                                        </select>
                                    </div>

                                    {/* Lista de Checkboxes */}
                                    <div style={{ maxHeight: 250, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '0.35rem', border: '1px solid #F1F5F9', borderRadius: 8, padding: '0.4rem' }}>
                                        {filteredProductsForPicker.length === 0 ? (
                                            <div style={{ padding: '1rem', textAlign: 'center', color: '#94A3B8', fontSize: '0.8rem' }}>
                                                No se encontraron equipos con el filtro
                                            </div>
                                        ) : (
                                            filteredProductsForPicker.map(p => {
                                                const isChecked = selectedIds.has(p.id);
                                                return (
                                                    <div
                                                        key={p.id}
                                                        onClick={() => handleToggleItem(p.id)}
                                                        style={{
                                                            display: 'flex',
                                                            alignItems: 'center',
                                                            gap: '0.6rem',
                                                            padding: '0.35rem 0.5rem',
                                                            borderRadius: 6,
                                                            background: isChecked ? '#F0F9FF' : 'transparent',
                                                            cursor: 'pointer',
                                                            transition: 'background 0.15s'
                                                        }}
                                                    >
                                                        {isChecked ? (
                                                            <CheckSquare size={16} color="#0284C7" />
                                                        ) : (
                                                            <Square size={16} color="#94A3B8" />
                                                        )}
                                                        <div style={{ flex: 1, minWidth: 0 }}>
                                                            <div style={{ fontSize: '0.8rem', fontWeight: 600, color: isChecked ? '#0369A1' : '#334155', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                                                {p.name}
                                                            </div>
                                                            <div style={{ fontSize: '0.7rem', color: '#64748B' }}>
                                                                {p.category || 'General'} · {p.tipoPropiedad === 'Terceros' ? 'Terceros' : 'Propio'}
                                                            </div>
                                                        </div>
                                                    </div>
                                                );
                                            })
                                        )}
                                    </div>

                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px solid #E2E8F0', paddingTop: '0.5rem' }}>
                                        <span style={{ fontSize: '0.75rem', color: '#64748B' }}>
                                            {selectedIds.size} de {products.length} seleccionados
                                        </span>
                                        <button
                                            onClick={() => setShowItemPicker(false)}
                                            style={{
                                                padding: '0.35rem 0.8rem',
                                                borderRadius: 6,
                                                background: '#1E293B',
                                                color: 'white',
                                                border: 'none',
                                                fontSize: '0.75rem',
                                                fontWeight: 700,
                                                cursor: 'pointer'
                                            }}
                                        >
                                            Aplicar Selección
                                        </button>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                </div>

                {/* ── KPI METRICS CARDS ── */}
                <div style={{
                    padding: '0.85rem 1.5rem',
                    background: '#FFFFFF',
                    borderBottom: '1px solid #E2E8F0',
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
                    gap: '1rem'
                }}>
                    <div style={{ background: '#F8FAFC', padding: '0.75rem 1rem', borderRadius: 10, border: '1px solid #E2E8F0', display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                        <div style={{ width: 38, height: 38, borderRadius: 8, background: '#EFF6FF', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                            <Package size={20} color="#2563EB" />
                        </div>
                        <div>
                            <div style={{ fontSize: '0.72rem', fontWeight: 600, color: '#64748B', textTransform: 'uppercase' }}>Equipos Analizados</div>
                            <div style={{ fontSize: '1.25rem', fontWeight: 800, color: '#1E293B' }}>{summary.totalEquipos} <span style={{ fontSize: '0.78rem', color: '#94A3B8', fontWeight: 500 }}>de {products.length}</span></div>
                        </div>
                    </div>

                    <div style={{ background: '#F8FAFC', padding: '0.75rem 1rem', borderRadius: 10, border: '1px solid #E2E8F0', display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                        <div style={{ width: 38, height: 38, borderRadius: 8, background: '#ECFDF5', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                            <TrendingUp size={20} color="#059669" />
                        </div>
                        <div>
                            <div style={{ fontSize: '0.72rem', fontWeight: 600, color: '#64748B', textTransform: 'uppercase' }}>Despachos / Alquileres</div>
                            <div style={{ fontSize: '1.25rem', fontWeight: 800, color: '#065F46' }}>{summary.totalDespachos}</div>
                        </div>
                    </div>

                    <div style={{ background: '#F8FAFC', padding: '0.75rem 1rem', borderRadius: 10, border: '1px solid #E2E8F0', display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                        <div style={{ width: 38, height: 38, borderRadius: 8, background: '#F0F9FF', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                            <Clock size={20} color="#0284C7" />
                        </div>
                        <div>
                            <div style={{ fontSize: '0.72rem', fontWeight: 600, color: '#64748B', textTransform: 'uppercase' }}>Días en Obra Totales</div>
                            <div style={{ fontSize: '1.25rem', fontWeight: 800, color: '#0369A1' }}>{summary.totalDiasUso.toLocaleString()} <span style={{ fontSize: '0.78rem', color: '#64748B', fontWeight: 500 }}>días</span></div>
                        </div>
                    </div>

                    <div style={{ background: '#F8FAFC', padding: '0.75rem 1rem', borderRadius: 10, border: '1px solid #E2E8F0', display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                        <div style={{ width: 38, height: 38, borderRadius: 8, background: '#FDF4FF', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                            <Layers size={20} color="#A855F7" />
                        </div>
                        <div>
                            <div style={{ fontSize: '0.72rem', fontWeight: 600, color: '#64748B', textTransform: 'uppercase' }}>Días-Equipo (Acumulados)</div>
                            <div style={{ fontSize: '1.25rem', fontWeight: 800, color: '#7E22CE' }}>{summary.totalDiasEquipo.toLocaleString()} <span style={{ fontSize: '0.78rem', color: '#9333EA', fontWeight: 500 }}>d-eq</span></div>
                        </div>
                    </div>
                </div>

                {/* ── TABLA PRINCIPAL DE RESULTADOS ── */}
                <div style={{ flex: 1, overflowY: 'auto', padding: '1rem 1.5rem' }}>
                    {usageData.length === 0 ? (
                        <div style={{
                            display: 'flex',
                            flexDirection: 'column',
                            alignItems: 'center',
                            justifyContent: 'center',
                            height: '100%',
                            color: '#94A3B8',
                            gap: '0.5rem'
                        }}>
                            <AlertCircle size={40} color="#CBD5E1" />
                            <p style={{ margin: 0, fontWeight: 600 }}>No hay datos para los filtros de fecha y equipos seleccionados.</p>
                            <p style={{ margin: 0, fontSize: '0.8rem' }}>Intenta ampliar el rango de fechas o seleccionar más ítems.</p>
                        </div>
                    ) : (
                        <div style={{ border: '1px solid #E2E8F0', borderRadius: 10, overflow: 'hidden', boxShadow: '0 1px 3px rgba(0,0,0,0.02)' }}>
                            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.82rem' }}>
                                <thead>
                                    <tr style={{ background: '#1E293B', color: 'white', fontWeight: 700 }}>
                                        <th style={{ padding: '0.75rem 1rem' }}>Equipo / Herramienta</th>
                                        <th style={{ padding: '0.75rem 0.75rem' }}>Categoría</th>
                                        <th style={{ padding: '0.75rem 0.75rem' }}>Propiedad</th>
                                        <th style={{ padding: '0.75rem 0.75rem', textAlign: 'center' }}>Despachos</th>
                                        <th style={{ padding: '0.75rem 0.75rem', textAlign: 'center' }}>Cant. Unds</th>
                                        <th style={{ padding: '0.75rem 0.75rem', textAlign: 'center' }}>Días en Obra</th>
                                        <th style={{ padding: '0.75rem 0.75rem', textAlign: 'center' }}>Días-Equipo</th>
                                        <th style={{ padding: '0.75rem 1rem' }}>Destinos / Obras</th>
                                        <th style={{ padding: '0.75rem 0.75rem', textAlign: 'center' }}>Detalle</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {usageData.map((item, idx) => {
                                        const isExpanded = expandedItem === item.id;
                                        const obras = Array.from(item.obrasMap.values());

                                        return (
                                            <React.Fragment key={item.id}>
                                                <tr style={{
                                                    background: idx % 2 === 0 ? '#FFFFFF' : '#F8FAFC',
                                                    borderBottom: '1px solid #E2E8F0',
                                                    transition: 'background 0.15s'
                                                }}>
                                                    <td style={{ padding: '0.75rem 1rem', fontWeight: 700, color: '#1E293B' }}>
                                                        {item.name}
                                                    </td>
                                                    <td style={{ padding: '0.75rem 0.75rem', color: '#64748B' }}>
                                                        <span style={{
                                                            fontSize: '0.72rem',
                                                            padding: '0.2rem 0.5rem',
                                                            borderRadius: 6,
                                                            background: '#F1F5F9',
                                                            color: '#475569',
                                                            fontWeight: 600
                                                        }}>
                                                            {item.category}
                                                        </span>
                                                    </td>
                                                    <td style={{ padding: '0.75rem 0.75rem' }}>
                                                        <span style={{
                                                            fontSize: '0.72rem',
                                                            padding: '0.2rem 0.5rem',
                                                            borderRadius: 6,
                                                            background: item.tipoPropiedad === 'Terceros' ? '#FEF3C7' : '#E0F2FE',
                                                            color: item.tipoPropiedad === 'Terceros' ? '#B45309' : '#0369A1',
                                                            fontWeight: 700
                                                        }}>
                                                            {item.tipoPropiedad === 'Terceros' ? 'Terceros' : 'Propio'}
                                                        </span>
                                                    </td>
                                                    <td style={{ padding: '0.75rem 0.75rem', textAlign: 'center', fontWeight: 700, color: '#334155' }}>
                                                        {item.despachosCount}
                                                    </td>
                                                    <td style={{ padding: '0.75rem 0.75rem', textAlign: 'center', color: '#64748B' }}>
                                                        {item.unidadesDespachadas}
                                                    </td>
                                                    <td style={{ padding: '0.75rem 0.75rem', textAlign: 'center', fontWeight: 800, color: '#0284C7', fontSize: '0.9rem' }}>
                                                        {item.diasUsoTotal} <span style={{ fontSize: '0.72rem', fontWeight: 500 }}>días</span>
                                                    </td>
                                                    <td style={{ padding: '0.75rem 0.75rem', textAlign: 'center', fontWeight: 800, color: '#7E22CE', fontSize: '0.9rem' }}>
                                                        {item.diasEquipoTotal} <span style={{ fontSize: '0.72rem', fontWeight: 500 }}>d-eq</span>
                                                    </td>
                                                    <td style={{ padding: '0.75rem 1rem', fontSize: '0.76rem', color: '#475569' }}>
                                                        {obras.length === 0 ? (
                                                            <span style={{ color: '#94A3B8' }}>Sin despachos en el período</span>
                                                        ) : (
                                                            obras.slice(0, 2).map((o, oi) => (
                                                                <span key={oi} style={{ display: 'inline-block', marginRight: 6 }}>
                                                                    <strong>{o.obraName}</strong> ({o.dias}d)
                                                                    {oi < Math.min(obras.length, 2) - 1 ? ' · ' : ''}
                                                                </span>
                                                            ))
                                                        )}
                                                        {obras.length > 2 && (
                                                            <span style={{ color: '#2563EB', fontWeight: 600 }}> +{obras.length - 2} más</span>
                                                        )}
                                                    </td>
                                                    <td style={{ padding: '0.75rem 0.75rem', textAlign: 'center' }}>
                                                        {item.detalles.length > 0 && (
                                                            <button
                                                                onClick={() => setExpandedItem(isExpanded ? null : item.id)}
                                                                style={{
                                                                    background: isExpanded ? '#EFF6FF' : '#F8FAFC',
                                                                    border: '1px solid #CBD5E1',
                                                                    borderRadius: 6,
                                                                    padding: '0.25rem 0.5rem',
                                                                    fontSize: '0.72rem',
                                                                    fontWeight: 700,
                                                                    color: isExpanded ? '#2563EB' : '#475569',
                                                                    cursor: 'pointer',
                                                                    display: 'inline-flex',
                                                                    alignItems: 'center',
                                                                    gap: '0.3rem'
                                                                }}
                                                            >
                                                                {isExpanded ? 'Ocultar' : `Ver (${item.detalles.length})`}
                                                                {isExpanded ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
                                                            </button>
                                                        )}
                                                    </td>
                                                </tr>

                                                {/* Detalle Desplegable por Despacho / Remisión */}
                                                {isExpanded && (
                                                    <tr style={{ background: '#F1F5F9' }}>
                                                        <td colSpan={9} style={{ padding: '0.75rem 1.5rem' }}>
                                                            <div style={{ background: 'white', borderRadius: 8, border: '1px solid #E2E8F0', padding: '0.75rem', boxShadow: 'inset 0 1px 3px rgba(0,0,0,0.03)' }}>
                                                                <div style={{ fontSize: '0.78rem', fontWeight: 800, color: '#1E293B', marginBottom: '0.5rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                                                                    <Building2 size={14} color="#2563EB" />
                                                                    Historial de Despachos y Días de Alquiler para: {item.name}
                                                                </div>

                                                                <table style={{ width: '100%', fontSize: '0.75rem', borderCollapse: 'collapse' }}>
                                                                    <thead>
                                                                        <tr style={{ background: '#F8FAFC', color: '#64748B', borderBottom: '1px solid #E2E8F0' }}>
                                                                            <th style={{ padding: '0.4rem 0.6rem' }}>Remisión</th>
                                                                            <th style={{ padding: '0.4rem 0.6rem' }}>Cliente</th>
                                                                            <th style={{ padding: '0.4rem 0.6rem' }}>Obra</th>
                                                                            <th style={{ padding: '0.4rem 0.6rem' }}>F. Despacho</th>
                                                                            <th style={{ padding: '0.4rem 0.6rem' }}>F. Devolución</th>
                                                                            <th style={{ padding: '0.4rem 0.6rem', textAlign: 'center' }}>Cant.</th>
                                                                            <th style={{ padding: '0.4rem 0.6rem', textAlign: 'center' }}>Días en Período</th>
                                                                            <th style={{ padding: '0.4rem 0.6rem', textAlign: 'center' }}>Días-Equipo</th>
                                                                            <th style={{ padding: '0.4rem 0.6rem', textAlign: 'center' }}>Estado</th>
                                                                        </tr>
                                                                    </thead>
                                                                    <tbody>
                                                                        {item.detalles.map((det, di) => (
                                                                            <tr key={di} style={{ borderBottom: '1px solid #F1F5F9' }}>
                                                                                <td style={{ padding: '0.4rem 0.6rem', fontWeight: 700, color: '#1E293B' }}>{det.remId}</td>
                                                                                <td style={{ padding: '0.4rem 0.6rem' }}>{det.clientName}</td>
                                                                                <td style={{ padding: '0.4rem 0.6rem', color: '#475569' }}>{det.obraName}</td>
                                                                                <td style={{ padding: '0.4rem 0.6rem' }}>{formatearFechaMesLetras(det.fechaDespacho)}</td>
                                                                                <td style={{ padding: '0.4rem 0.6rem' }}>{det.fechaDevolucion.includes('-') ? formatearFechaMesLetras(det.fechaDevolucion) : det.fechaDevolucion}</td>
                                                                                <td style={{ padding: '0.4rem 0.6rem', textAlign: 'center', fontWeight: 600 }}>{det.cantidad}</td>
                                                                                <td style={{ padding: '0.4rem 0.6rem', textAlign: 'center', fontWeight: 700, color: '#0284C7' }}>{det.dias} d</td>
                                                                                <td style={{ padding: '0.4rem 0.6rem', textAlign: 'center', fontWeight: 700, color: '#7E22CE' }}>{det.diasEquipo} d-eq</td>
                                                                                <td style={{ padding: '0.4rem 0.6rem', textAlign: 'center' }}>
                                                                                    <span style={{
                                                                                        fontSize: '0.7rem',
                                                                                        padding: '0.15rem 0.45rem',
                                                                                        borderRadius: 4,
                                                                                        background: det.estado === 'Devuelto' ? '#DCFCE7' : '#FEF3C7',
                                                                                        color: det.estado === 'Devuelto' ? '#166534' : '#92400E',
                                                                                        fontWeight: 700
                                                                                    }}>
                                                                                        {det.estado}
                                                                                    </span>
                                                                                </td>
                                                                            </tr>
                                                                        ))}
                                                                    </tbody>
                                                                </table>
                                                            </div>
                                                        </td>
                                                    </tr>
                                                )}
                                            </React.Fragment>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>

                {/* ── FOOTER DEL MODAL ── */}
                <div style={{
                    padding: '0.85rem 1.5rem',
                    background: '#F8FAFC',
                    borderTop: '1px solid #E2E8F0',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center'
                }}>
                    <div style={{ fontSize: '0.8rem', color: '#64748B' }}>
                        Mostrando análisis de <strong>{usageData.length}</strong> equipos · <strong>{summary.totalDiasEquipo.toLocaleString()}</strong> días-equipo acumulados
                    </div>
                    <div style={{ display: 'flex', gap: '0.75rem' }}>
                        <button
                            onClick={onClose}
                            style={{
                                padding: '0.5rem 1.25rem',
                                borderRadius: 8,
                                background: 'white',
                                border: '1px solid #CBD5E1',
                                color: '#475569',
                                fontWeight: 700,
                                fontSize: '0.82rem',
                                cursor: 'pointer'
                            }}
                        >
                            Cerrar
                        </button>
                        <button
                            onClick={handleExportPDF}
                            style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: '0.45rem',
                                padding: '0.5rem 1.25rem',
                                borderRadius: 8,
                                background: '#2563EB',
                                border: 'none',
                                color: 'white',
                                fontWeight: 700,
                                fontSize: '0.82rem',
                                cursor: 'pointer'
                            }}
                        >
                            <Download size={15} />
                            Descargar Informe PDF
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}
