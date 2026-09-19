import React, { useState, useMemo } from 'react';
import {
    X, Download, Calendar, CheckSquare, Square, Search,
    Package, BarChart2, Clock, ChevronDown, ChevronUp, Layers,
    TrendingUp, Building2, AlertCircle
} from 'lucide-react';
import {
    format,
    startOfMonth,
    endOfMonth,
    subMonths,
    startOfYear,
    endOfYear,
    differenceInCalendarDays
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
    const [selectedIds, setSelectedIds] = useState(() => new Set(products.map(p => p.id)));
    const [itemSearch, setItemSearch] = useState('');
    const [categoryFilter, setCategoryFilter] = useState('Todas');
    const [showItemPicker, setShowItemPicker] = useState(false);
    const [expandedItem, setExpandedItem] = useState(null);

    // Categorías únicas
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

    const handleSelectAll = () => {
        setSelectedIds(new Set(products.map(p => p.id)));
    };

    const handleDeselectAll = () => {
        setSelectedIds(new Set());
    };

    // Productos filtrados dentro del desplegable
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
                obrasMap: new Map(),
                detalles: []
            });
        });

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

                // 1. Devoluciones con fecha registrada
                devs.forEach(dev => {
                    const cantDev = Number(dev.cantidad) || 0;
                    if (cantDev <= 0) return;
                    totalDevueltas += cantDev;

                    const devFecha = dev.fecha || hoyStr;
                    const rentalStart = remFecha;
                    const rentalEnd = devFecha >= rentalStart ? devFecha : rentalStart;

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

                // 2. Unidades pendientes en campo
                const cantDevueltaEnRem = Number(it.cantidadDevuelta) || 0;
                const pendientes = Math.max(0, cantTotal - Math.max(totalDevueltas, cantDevueltaEnRem));

                if (pendientes > 0) {
                    const rentalStart = remFecha;
                    const rentalEnd = hoyStr;

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
                            fechaDevolucion: 'En obra',
                            cantidad: pendientes,
                            dias,
                            diasEquipo,
                            estado: 'En campo'
                        });
                    }
                }
            });
        });

        return Array.from(resultMap.values()).sort((a, b) => b.diasEquipoTotal - a.diasEquipoTotal || b.diasUsoTotal - a.diasUsoTotal);
    }, [products, remisiones, selectedIds, fechaDesde, fechaHasta, hoyStr]);

    // Métricas Globales
    const summary = useMemo(() => {
        const totalEquipos = usageData.length;
        const totalDespachos = usageData.reduce((s, r) => s + r.despachosCount, 0);
        const totalDiasEquipo = usageData.reduce((s, r) => s + r.diasEquipoTotal, 0);
        const totalDiasUso = usageData.reduce((s, r) => s + r.diasUsoTotal, 0);

        return {
            totalEquipos,
            totalDespachos,
            totalDiasEquipo,
            totalDiasUso
        };
    }, [usageData]);

    // ─── EXPORTACIÓN A PDF INSTITUCIONAL ─────────────────────────────────────
    const handleExportPDF = () => {
        const doc = new jsPDF({ orientation: 'landscape', format: 'letter', unit: 'mm' });
        const W = doc.internal.pageSize.getWidth();
        const H = doc.internal.pageSize.getHeight();
        const margin = 10;

        let y = applyStandardLayout(doc, 'Reporte de Utilización de Equipos', settings, '', { skipFooter: true });

        const fDesde = formatearFechaMesLetras(fechaDesde);
        const fHasta = formatearFechaMesLetras(fechaHasta);
        const periodoTxt = fDesde && fHasta ? `${fDesde} al ${fHasta}` : (fDesde ? `Desde ${fDesde}` : (fHasta ? `Hasta ${fHasta}` : 'Histórico completo'));

        // Cuadro de Parámetros del Reporte
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

        const tableBody = usageData.map(item => [
            item.name,
            item.category,
            item.tipoPropiedad === 'Terceros' ? `Terceros${item.proveedor ? ` (${item.proveedor})` : ''}` : 'Propio',
            item.despachosCount.toString(),
            item.unidadesDespachadas.toString(),
            `${item.diasUsoTotal} días`,
            `${item.diasEquipoTotal} d-eq`
        ]);

        autoTable(doc, {
            startY: y + 19,
            margin: { left: margin, right: margin },
            head: [['Equipo / Herramienta', 'Categoría', 'Propiedad', 'Despachos', 'Cant.', 'Días en Obra', 'Días-Equipo']],
            body: tableBody,
            headStyles: { fillColor: [35, 101, 171], textColor: 255, fontStyle: 'bold', fontSize: 8 },
            bodyStyles: { fontSize: 8, textColor: [51, 65, 85], font: 'helvetica' },
            alternateRowStyles: { fillColor: [248, 250, 252] },
            columnStyles: {
                0: { cellWidth: 'auto' },
                1: { cellWidth: 45 },
                2: { cellWidth: 40 },
                3: { cellWidth: 25, halign: 'center' },
                4: { cellWidth: 20, halign: 'center' },
                5: { cellWidth: 35, halign: 'center' },
                6: { cellWidth: 35, halign: 'center' }
            },
            foot: [[
                'TOTALES',
                '',
                '',
                summary.totalDespachos.toString(),
                usageData.reduce((s, r) => s + r.unidadesDespachadas, 0).toString(),
                `${summary.totalDiasUso.toLocaleString()} días`,
                `${summary.totalDiasEquipo.toLocaleString()} d-eq`
            ]],
            footStyles: { fillColor: [241, 245, 249], textColor: [30, 41, 59], fontStyle: 'bold', fontSize: 8 }
        });

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

    // Estilo común unificado para todas las celdas de la tabla
    const cellStyle = {
        padding: '0.75rem 0.6rem',
        fontSize: '0.85rem',
        color: '#334155',
        fontFamily: 'inherit',
        verticalAlign: 'middle'
    };

    const cellCenterStyle = {
        ...cellStyle,
        textAlign: 'center'
    };

    return (
        <div className="modal-overlay" onClick={onClose} style={{ zIndex: 1100, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <div
                className="modal-content fadeIn"
                onClick={e => e.stopPropagation()}
                style={{
                    maxWidth: '98%',
                    width: 1380,
                    padding: 0,
                    overflow: 'hidden',
                    height: '90vh',
                    display: 'flex',
                    flexDirection: 'column',
                    borderRadius: 16,
                    background: '#ffffff',
                    boxShadow: '0 20px 40px -15px rgba(0,0,0,0.2)'
                }}
            >
                {/* ── HEADER (Azul Institucional CIELO) ── */}
                <div style={{
                    background: 'linear-gradient(135deg, #104166 0%, #2365AB 100%)',
                    padding: '1.25rem 2rem',
                    color: 'white',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center'
                }}>
                    <div>
                        <h3 style={{ margin: 0, color: 'white', fontSize: '1.25rem', display: 'flex', alignItems: 'center', gap: '0.75rem', fontWeight: 700 }}>
                            <BarChart2 size={22} /> Reporte de Uso y Días de Alquiler
                        </h3>
                        <p style={{ margin: '0.25rem 0 0 0', color: 'rgba(255,255,255,0.8)', fontSize: '0.85rem' }}>
                            Días utilizados, rotación y permanencia en obra de máquinas y herramientas
                        </p>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                        <button
                            onClick={handleExportPDF}
                            style={{
                                background: 'rgba(255,255,255,0.15)',
                                color: 'white',
                                border: '1px solid rgba(255,255,255,0.3)',
                                padding: '0.45rem 0.9rem',
                                borderRadius: 8,
                                display: 'flex',
                                alignItems: 'center',
                                gap: '0.4rem',
                                fontWeight: 700,
                                fontSize: '0.8rem',
                                cursor: 'pointer',
                                transition: 'all 0.2s'
                            }}
                            onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.25)'}
                            onMouseLeave={e => e.currentTarget.style.background = 'rgba(255,255,255,0.15)'}
                            title="Descargar reporte en PDF"
                        >
                            <Download size={16} /> Descargar PDF
                        </button>
                        <button
                            onClick={onClose}
                            style={{
                                background: 'rgba(255,255,255,0.1)',
                                border: 'none',
                                borderRadius: '50%',
                                width: 32,
                                height: 32,
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                cursor: 'pointer',
                                color: 'white',
                                transition: 'all 0.2s'
                            }}
                            onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.2)'}
                            onMouseLeave={e => e.currentTarget.style.background = 'rgba(255,255,255,0.1)'}
                        >
                            <X size={18} />
                        </button>
                    </div>
                </div>

                {/* ── FILTROS (Período y Selección Múltiple) ── */}
                <div style={{
                    padding: '0.9rem 2rem',
                    background: '#F8FAFC',
                    borderBottom: '1px solid #E2E8F0',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    flexWrap: 'wrap',
                    gap: '0.75rem'
                }}>
                    {/* Rango de Fechas */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', flexWrap: 'wrap' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', color: '#1E293B', fontWeight: 700, fontSize: '0.85rem' }}>
                            <Calendar size={16} color="#2365AB" />
                            Fechas:
                        </div>
                        <input
                            type="date"
                            value={fechaDesde}
                            onChange={e => setFechaDesde(e.target.value)}
                            style={{
                                padding: '0.4rem 0.6rem',
                                borderRadius: 8,
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
                                padding: '0.4rem 0.6rem',
                                borderRadius: 8,
                                border: '1px solid #CBD5E1',
                                fontSize: '0.82rem',
                                background: 'white',
                                color: '#334155'
                            }}
                        />

                        {/* Presets Rápidos */}
                        <div style={{ display: 'flex', gap: '0.3rem' }}>
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
                                        padding: '0.35rem 0.65rem',
                                        borderRadius: 6,
                                        border: '1px solid #CBD5E1',
                                        background: '#FFFFFF',
                                        fontSize: '0.75rem',
                                        fontWeight: 600,
                                        color: '#475569',
                                        cursor: 'pointer',
                                        transition: 'all 0.15s'
                                    }}
                                    onMouseEnter={e => { e.currentTarget.style.borderColor = '#2365AB'; e.currentTarget.style.color = '#2365AB'; }}
                                    onMouseLeave={e => { e.currentTarget.style.borderColor = '#CBD5E1'; e.currentTarget.style.color = '#475569'; }}
                                >
                                    {p.label}
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Selector Múltiple de Ítems */}
                    <div style={{ position: 'relative' }}>
                        <button
                            onClick={() => setShowItemPicker(prev => !prev)}
                            style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: '0.5rem',
                                padding: '0.45rem 0.9rem',
                                borderRadius: 8,
                                border: '1px solid #2365AB',
                                background: selectedIds.size === products.length ? '#FFFFFF' : '#F0F7FF',
                                color: '#2365AB',
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

                        {/* Desplegable de Checkboxes */}
                        {showItemPicker && (
                            <div style={{
                                position: 'absolute',
                                right: 0,
                                top: '100%',
                                marginTop: 6,
                                width: 440,
                                background: 'white',
                                borderRadius: 12,
                                border: '1px solid #CBD5E1',
                                boxShadow: '0 15px 30px -5px rgba(0,0,0,0.15)',
                                zIndex: 1200,
                                padding: '1rem',
                                display: 'flex',
                                flexDirection: 'column',
                                gap: '0.75rem'
                            }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                    <span style={{ fontWeight: 700, fontSize: '0.85rem', color: '#1E293B' }}>
                                        Filtrar Equipos
                                    </span>
                                    <div style={{ display: 'flex', gap: '0.5rem' }}>
                                        <button
                                            onClick={handleSelectAll}
                                            style={{ fontSize: '0.75rem', color: '#2365AB', background: 'none', border: 'none', fontWeight: 700, cursor: 'pointer' }}
                                        >
                                            Marcar Todos
                                        </button>
                                        <span style={{ color: '#CBD5E1' }}>|</span>
                                        <button
                                            onClick={handleDeselectAll}
                                            style={{ fontSize: '0.75rem', color: '#64748B', background: 'none', border: 'none', fontWeight: 700, cursor: 'pointer' }}
                                        >
                                            Desmarcar Todos
                                        </button>
                                    </div>
                                </div>

                                <div style={{ display: 'grid', gridTemplateColumns: '1.4fr 1fr', gap: '0.5rem' }}>
                                    <div style={{ position: 'relative' }}>
                                        <Search size={14} style={{ position: 'absolute', left: 8, top: '50%', transform: 'translateY(-50%)', color: '#94A3B8' }} />
                                        <input
                                            type="text"
                                            placeholder="Buscar..."
                                            value={itemSearch}
                                            onChange={e => setItemSearch(e.target.value)}
                                            style={{
                                                width: '100%',
                                                padding: '0.35rem 0.5rem 0.35rem 1.7rem',
                                                borderRadius: 6,
                                                border: '1px solid #CBD5E1',
                                                fontSize: '0.8rem'
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
                                            fontSize: '0.8rem',
                                            background: 'white'
                                        }}
                                    >
                                        {categorias.map(c => (
                                            <option key={c} value={c}>{c}</option>
                                        ))}
                                    </select>
                                </div>

                                <div style={{ maxHeight: 220, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '0.25rem', border: '1px solid #F1F5F9', borderRadius: 8, padding: '0.4rem' }}>
                                    {filteredProductsForPicker.length === 0 ? (
                                        <div style={{ padding: '1rem', textAlign: 'center', color: '#94A3B8', fontSize: '0.8rem' }}>
                                            No se encontraron equipos
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
                                                        gap: '0.5rem',
                                                        padding: '0.35rem 0.5rem',
                                                        borderRadius: 6,
                                                        background: isChecked ? '#F0F7FF' : 'transparent',
                                                        cursor: 'pointer'
                                                    }}
                                                >
                                                    {isChecked ? (
                                                        <CheckSquare size={16} color="#2365AB" />
                                                    ) : (
                                                        <Square size={16} color="#94A3B8" />
                                                    )}
                                                    <div style={{ flex: 1, minWidth: 0, fontSize: '0.82rem', color: '#334155', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                                        {p.name}
                                                    </div>
                                                </div>
                                            );
                                        })
                                    )}
                                </div>

                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px solid #E2E8F0', paddingTop: '0.5rem' }}>
                                    <span style={{ fontSize: '0.75rem', color: '#64748B' }}>
                                        {selectedIds.size} seleccionados
                                    </span>
                                    <button
                                        onClick={() => setShowItemPicker(false)}
                                        style={{
                                            padding: '0.35rem 0.8rem',
                                            borderRadius: 6,
                                            background: '#2365AB',
                                            color: 'white',
                                            border: 'none',
                                            fontSize: '0.75rem',
                                            fontWeight: 700,
                                            cursor: 'pointer'
                                        }}
                                    >
                                        Listo
                                    </button>
                                </div>
                            </div>
                        )}
                    </div>
                </div>

                {/* ── KPI METRICS CARDS (Estilo Limpio y Unificado) ── */}
                <div style={{
                    padding: '0.85rem 2rem',
                    background: '#FFFFFF',
                    borderBottom: '1px solid #E2E8F0',
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
                    gap: '1rem'
                }}>
                    <div style={{ background: '#FFFFFF', padding: '0.75rem 1rem', borderRadius: 8, border: '1px solid #E2E8F0', display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                        <div style={{ width: 36, height: 36, borderRadius: 8, background: 'rgba(35, 101, 171, 0.08)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                            <Package size={18} color="#2365AB" />
                        </div>
                        <div>
                            <div style={{ fontSize: '0.72rem', fontWeight: 600, color: '#64748B', textTransform: 'uppercase' }}>Equipos Analizados</div>
                            <div style={{ fontSize: '1.25rem', fontWeight: 700, color: '#1E293B' }}>{summary.totalEquipos} <span style={{ fontSize: '0.75rem', color: '#94A3B8', fontWeight: 400 }}>de {products.length}</span></div>
                        </div>
                    </div>

                    <div style={{ background: '#FFFFFF', padding: '0.75rem 1rem', borderRadius: 8, border: '1px solid #E2E8F0', display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                        <div style={{ width: 36, height: 36, borderRadius: 8, background: 'rgba(35, 101, 171, 0.08)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                            <TrendingUp size={18} color="#2365AB" />
                        </div>
                        <div>
                            <div style={{ fontSize: '0.72rem', fontWeight: 600, color: '#64748B', textTransform: 'uppercase' }}>Despachos / Alquileres</div>
                            <div style={{ fontSize: '1.25rem', fontWeight: 700, color: '#1E293B' }}>{summary.totalDespachos}</div>
                        </div>
                    </div>

                    <div style={{ background: '#FFFFFF', padding: '0.75rem 1rem', borderRadius: 8, border: '1px solid #E2E8F0', display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                        <div style={{ width: 36, height: 36, borderRadius: 8, background: 'rgba(35, 101, 171, 0.08)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                            <Clock size={18} color="#2365AB" />
                        </div>
                        <div>
                            <div style={{ fontSize: '0.72rem', fontWeight: 600, color: '#64748B', textTransform: 'uppercase' }}>Días en Obra Totales</div>
                            <div style={{ fontSize: '1.25rem', fontWeight: 700, color: '#1E293B' }}>{summary.totalDiasUso.toLocaleString()} <span style={{ fontSize: '0.75rem', color: '#64748B', fontWeight: 400 }}>días</span></div>
                        </div>
                    </div>

                    <div style={{ background: '#FFFFFF', padding: '0.75rem 1rem', borderRadius: 8, border: '1px solid #E2E8F0', display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                        <div style={{ width: 36, height: 36, borderRadius: 8, background: 'rgba(35, 101, 171, 0.08)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                            <Layers size={18} color="#2365AB" />
                        </div>
                        <div>
                            <div style={{ fontSize: '0.72rem', fontWeight: 600, color: '#64748B', textTransform: 'uppercase' }}>Días-Equipo Acumulados</div>
                            <div style={{ fontSize: '1.25rem', fontWeight: 700, color: '#1E293B' }}>{summary.totalDiasEquipo.toLocaleString()} <span style={{ fontSize: '0.75rem', color: '#64748B', fontWeight: 400 }}>d-eq</span></div>
                        </div>
                    </div>
                </div>

                {/* ── TABLA PRINCIPAL DE RESULTADOS (Mismo tipo de letra, tamaño y color en todas las columnas) ── */}
                <div style={{ flex: 1, overflowY: 'auto', padding: '1rem 2rem' }}>
                    {usageData.length === 0 ? (
                        <div style={{ padding: '4rem', textAlign: 'center', color: '#94a3b8' }}>
                            <div style={{ opacity: 0.2, marginBottom: '1rem' }}><AlertCircle size={48} /></div>
                            No hay datos para los filtros de fecha y equipos seleccionados.
                        </div>
                    ) : (
                        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                            <thead>
                                <tr style={{ background: '#2365AB', textAlign: 'left' }}>
                                    <th style={{ padding: '0.75rem 0.6rem', fontSize: '0.75rem', color: 'white', textTransform: 'uppercase', fontWeight: 700, borderTopLeftRadius: '8px', borderBottomLeftRadius: '8px' }}>Equipo / Herramienta</th>
                                    <th style={{ padding: '0.75rem 0.6rem', fontSize: '0.75rem', color: 'white', textTransform: 'uppercase', fontWeight: 700 }}>Categoría</th>
                                    <th style={{ padding: '0.75rem 0.6rem', fontSize: '0.75rem', color: 'white', textTransform: 'uppercase', fontWeight: 700 }}>Propiedad</th>
                                    <th style={{ padding: '0.75rem 0.6rem', fontSize: '0.75rem', color: 'white', textTransform: 'uppercase', fontWeight: 700, textAlign: 'center' }}>Despachos</th>
                                    <th style={{ padding: '0.75rem 0.6rem', fontSize: '0.75rem', color: 'white', textTransform: 'uppercase', fontWeight: 700, textAlign: 'center' }}>Cant.</th>
                                    <th style={{ padding: '0.75rem 0.6rem', fontSize: '0.75rem', color: 'white', textTransform: 'uppercase', fontWeight: 700, textAlign: 'center' }}>Días en Obra</th>
                                    <th style={{ padding: '0.75rem 0.6rem', fontSize: '0.75rem', color: 'white', textTransform: 'uppercase', fontWeight: 700, textAlign: 'center' }}>Días-Equipo</th>
                                    <th style={{ padding: '0.75rem 0.6rem', fontSize: '0.75rem', color: 'white', textTransform: 'uppercase', fontWeight: 700, textAlign: 'center', borderTopRightRadius: '8px', borderBottomRightRadius: '8px' }}>Detalle</th>
                                </tr>
                            </thead>
                            <tbody>
                                {usageData.map((item, idx) => {
                                    const isExpanded = expandedItem === item.id;
                                    const propiedadTexto = item.tipoPropiedad === 'Terceros' ? `Terceros${item.proveedor ? ` (${item.proveedor})` : ''}` : 'Propio';

                                    return (
                                        <React.Fragment key={item.id}>
                                            <tr style={{
                                                borderBottom: '1px solid #f1f5f9',
                                                background: idx % 2 === 0 ? '#FFFFFF' : '#F8FAFC'
                                            }}>
                                                <td style={cellStyle}>
                                                    {item.name}
                                                </td>
                                                <td style={cellStyle}>
                                                    {item.category}
                                                </td>
                                                <td style={cellStyle}>
                                                    {propiedadTexto}
                                                </td>
                                                <td style={cellCenterStyle}>
                                                    {item.despachosCount}
                                                </td>
                                                <td style={cellCenterStyle}>
                                                    {item.unidadesDespachadas}
                                                </td>
                                                <td style={cellCenterStyle}>
                                                    {item.diasUsoTotal} días
                                                </td>
                                                <td style={cellCenterStyle}>
                                                    {item.diasEquipoTotal} d-eq
                                                </td>
                                                <td style={cellCenterStyle}>
                                                    {item.detalles.length > 0 && (
                                                        <button
                                                            onClick={() => setExpandedItem(isExpanded ? null : item.id)}
                                                            style={{
                                                                background: '#FFFFFF',
                                                                border: '1px solid #CBD5E1',
                                                                borderRadius: 6,
                                                                padding: '0.25rem 0.5rem',
                                                                fontSize: '0.78rem',
                                                                fontWeight: 600,
                                                                color: '#2365AB',
                                                                cursor: 'pointer',
                                                                display: 'inline-flex',
                                                                alignItems: 'center',
                                                                gap: '0.25rem'
                                                            }}
                                                        >
                                                            {isExpanded ? 'Ocultar' : `Ver (${item.detalles.length})`}
                                                            {isExpanded ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
                                                        </button>
                                                    )}
                                                </td>
                                            </tr>

                                            {/* Subtabla de Detalle con el mismo estilo unificado */}
                                            {isExpanded && (
                                                <tr style={{ background: '#F8FAFC' }}>
                                                    <td colSpan={8} style={{ padding: '0.75rem 1.5rem' }}>
                                                        <div style={{ background: 'white', borderRadius: 8, border: '1px solid #E2E8F0', padding: '0.75rem' }}>
                                                            <div style={{ fontSize: '0.82rem', fontWeight: 700, color: '#1E293B', marginBottom: '0.5rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                                                                <Building2 size={14} color="#2365AB" />
                                                                Historial de Despachos: {item.name}
                                                            </div>

                                                            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                                                                <thead>
                                                                    <tr style={{ borderBottom: '1px solid #E2E8F0', textAlign: 'left', background: '#F1F5F9' }}>
                                                                        <th style={{ padding: '0.4rem 0.5rem', fontSize: '0.75rem', color: '#64748B', fontWeight: 700 }}>Remisión</th>
                                                                        <th style={{ padding: '0.4rem 0.5rem', fontSize: '0.75rem', color: '#64748B', fontWeight: 700 }}>Cliente</th>
                                                                        <th style={{ padding: '0.4rem 0.5rem', fontSize: '0.75rem', color: '#64748B', fontWeight: 700 }}>Obra</th>
                                                                        <th style={{ padding: '0.4rem 0.5rem', fontSize: '0.75rem', color: '#64748B', fontWeight: 700 }}>F. Despacho</th>
                                                                        <th style={{ padding: '0.4rem 0.5rem', fontSize: '0.75rem', color: '#64748B', fontWeight: 700 }}>F. Devolución</th>
                                                                        <th style={{ padding: '0.4rem 0.5rem', fontSize: '0.75rem', color: '#64748B', fontWeight: 700, textAlign: 'center' }}>Cant.</th>
                                                                        <th style={{ padding: '0.4rem 0.5rem', fontSize: '0.75rem', color: '#64748B', fontWeight: 700, textAlign: 'center' }}>Días en Período</th>
                                                                        <th style={{ padding: '0.4rem 0.5rem', fontSize: '0.75rem', color: '#64748B', fontWeight: 700, textAlign: 'center' }}>Días-Equipo</th>
                                                                        <th style={{ padding: '0.4rem 0.5rem', fontSize: '0.75rem', color: '#64748B', fontWeight: 700, textAlign: 'center' }}>Estado</th>
                                                                    </tr>
                                                                </thead>
                                                                <tbody>
                                                                    {item.detalles.map((det, di) => (
                                                                        <tr key={di} style={{ borderBottom: '1px solid #F1F5F9' }}>
                                                                            <td style={{ ...cellStyle, padding: '0.4rem 0.5rem' }}>{det.remId}</td>
                                                                            <td style={{ ...cellStyle, padding: '0.4rem 0.5rem' }}>{det.clientName}</td>
                                                                            <td style={{ ...cellStyle, padding: '0.4rem 0.5rem' }}>{det.obraName}</td>
                                                                            <td style={{ ...cellStyle, padding: '0.4rem 0.5rem' }}>{formatearFechaMesLetras(det.fechaDespacho)}</td>
                                                                            <td style={{ ...cellStyle, padding: '0.4rem 0.5rem' }}>{det.fechaDevolucion.includes('-') ? formatearFechaMesLetras(det.fechaDevolucion) : det.fechaDevolucion}</td>
                                                                            <td style={{ ...cellCenterStyle, padding: '0.4rem 0.5rem' }}>{det.cantidad}</td>
                                                                            <td style={{ ...cellCenterStyle, padding: '0.4rem 0.5rem' }}>{det.dias} días</td>
                                                                            <td style={{ ...cellCenterStyle, padding: '0.4rem 0.5rem' }}>{det.diasEquipo} d-eq</td>
                                                                            <td style={{ ...cellCenterStyle, padding: '0.4rem 0.5rem' }}>{det.estado}</td>
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
                    )}
                </div>

                {/* ── FOOTER DEL MODAL ── */}
                <div style={{
                    padding: '1rem 2rem',
                    background: '#F8FAFC',
                    borderTop: '1px solid #E2E8F0',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center'
                }}>
                    <div style={{ fontSize: '0.85rem', color: '#64748B' }}>
                        Total: <strong>{usageData.length}</strong> equipos analizados · <strong>{summary.totalDiasEquipo.toLocaleString()}</strong> días-equipo acumulados
                    </div>
                    <div style={{ display: 'flex', gap: '0.75rem' }}>
                        <button
                            className="btn btn-secondary"
                            onClick={onClose}
                            style={{
                                padding: '0.5rem 1.25rem',
                                borderRadius: 8,
                                background: 'white',
                                border: '1px solid #CBD5E1',
                                color: '#475569',
                                fontWeight: 700,
                                fontSize: '0.85rem',
                                cursor: 'pointer'
                            }}
                        >
                            Cerrar
                        </button>
                        <button
                            className="btn btn-primary"
                            onClick={handleExportPDF}
                            style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: '0.45rem',
                                padding: '0.5rem 1.25rem',
                                borderRadius: 8,
                                background: '#2365AB',
                                border: 'none',
                                color: 'white',
                                fontWeight: 700,
                                fontSize: '0.85rem',
                                cursor: 'pointer'
                            }}
                        >
                            <Download size={16} />
                            Descargar Informe PDF
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}
