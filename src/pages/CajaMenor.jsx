import React, { useState, useMemo } from 'react';
import {
    Wallet, TrendingUp, TrendingDown, ArrowUpFromLine, Download,
    Edit3, Trash2, Banknote
} from 'lucide-react';
import { format } from 'date-fns';
import Swal from 'sweetalert2';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { useAppContext } from '../context/AppContext';
import { applyStandardLayout } from './pdfTheme';
import RetiroCajaMenorModal from './RetiroCajaMenorModal';
import {
    buildMovimientosCajaMenor, resumirMovimientos, fmtCOP, formatFechaCorta
} from './cajaMenorUtils';

const CELL_TEXT = { color: '#104166', fontSize: '0.85rem', fontWeight: 'normal' };

const TIPO_CFG = {
    'Ingreso': { color: '#10b981', bg: 'rgba(16,185,129,0.12)' },
    'Egreso': { color: '#ef4444', bg: 'rgba(239,68,68,0.12)' },
    'Retiro': { color: '#f97316', bg: 'rgba(249,115,22,0.12)' },
};

export default function CajaMenor() {
    const {
        invoices = [], clients = [], ingresosCajaMenor = [],
        gastosMantenimiento = [], retirosCajaMenor = [],
        deleteRetiroCajaMenor, settings
    } = useAppContext();

    const [showRetiroModal, setShowRetiroModal] = useState(false);
    const [editingRetiro, setEditingRetiro] = useState(null);

    const [filtroFechaInicio, setFiltroFechaInicio] = useState('');
    const [filtroFechaFin, setFiltroFechaFin] = useState('');
    const [filtroTipo, setFiltroTipo] = useState('Todos');
    const [search, setSearch] = useState('');

    // Libro completo en orden cronológico, con saldo acumulado por movimiento.
    const movimientos = useMemo(() => buildMovimientosCajaMenor({
        invoices, clients, ingresosCajaMenor, gastosMantenimiento, retirosCajaMenor
    }), [invoices, clients, ingresosCajaMenor, gastosMantenimiento, retirosCajaMenor]);

    // Saldo real de la caja: siempre sobre el libro completo, nunca sobre el filtro.
    const { saldo: saldoActual } = useMemo(() => resumirMovimientos(movimientos), [movimientos]);

    const movimientosFiltrados = useMemo(() => {
        const query = search.trim().toLowerCase();
        return movimientos.filter(m => {
            const matchesStart = !filtroFechaInicio || m.fecha >= filtroFechaInicio;
            const matchesEnd = !filtroFechaFin || m.fecha <= filtroFechaFin;
            const matchesTipo = filtroTipo === 'Todos' || m.tipo === filtroTipo;
            const matchesSearch = !query || (
                m.concepto.toLowerCase().includes(query) ||
                m.tercero.toLowerCase().includes(query) ||
                String(m.referencia).toLowerCase().includes(query) ||
                m.origen.toLowerCase().includes(query)
            );
            return matchesStart && matchesEnd && matchesTipo && matchesSearch;
        });
    }, [movimientos, filtroFechaInicio, filtroFechaFin, filtroTipo, search]);

    // Totales del periodo consultado (el saldo global se muestra aparte).
    const resumenPeriodo = useMemo(() => resumirMovimientos(movimientosFiltrados), [movimientosFiltrados]);

    // Extracto bancario: más recientes arriba, con el saldo vigente a ese movimiento.
    const filasTabla = useMemo(() => [...movimientosFiltrados].reverse(), [movimientosFiltrados]);

    const hayFiltros = filtroFechaInicio || filtroFechaFin || filtroTipo !== 'Todos' || search;

    const handleEditRetiro = (mov) => {
        setEditingRetiro(mov._raw);
        setShowRetiroModal(true);
    };

    const handleDeleteRetiro = async (mov) => {
        const { isConfirmed } = await Swal.fire({
            title: '¿Eliminar el retiro?',
            html: `Se eliminará el retiro de <b>${fmtCOP(mov.salida)}</b> y el dinero volverá al saldo de la caja menor.`,
            icon: 'warning',
            showCancelButton: true,
            confirmButtonText: 'Sí, eliminar',
            cancelButtonText: 'Cancelar',
            confirmButtonColor: '#ef4444',
            cancelButtonColor: '#64748b'
        });
        if (!isConfirmed) return;
        try {
            await deleteRetiroCajaMenor(mov._raw.id);
        } catch (error) {
            console.error('Error eliminando retiro:', error);
            Swal.fire('Error', 'No se pudo eliminar el retiro.', 'error');
        }
    };

    const closeRetiroModal = () => {
        setShowRetiroModal(false);
        setEditingRetiro(null);
    };

    const exportToCSV = () => {
        const headers = ['Fecha', 'Tipo', 'Origen', 'Referencia', 'Concepto', 'Tercero', 'Entrada', 'Salida', 'Saldo'];
        const rows = filasTabla.map(m => [
            formatFechaCorta(m.fecha), m.tipo, m.origen, m.referencia,
            (m.concepto || '').replace(/"/g, '""'), m.tercero,
            m.entrada || 0, m.salida || 0, m.saldo
        ]);
        let csvContent = 'data:text/csv;charset=utf-8,﻿';
        csvContent += headers.map(h => `"${h}"`).join(',') + '\n';
        csvContent += rows.map(r => r.map(v => `"${v}"`).join(',')).join('\n');
        const link = document.createElement('a');
        link.setAttribute('href', encodeURI(csvContent));
        link.setAttribute('download', `caja_menor_${format(new Date(), 'yyyyMMdd_HHmmss')}.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    const exportToPDF = () => {
        const doc = new jsPDF();
        const margin = 10;
        let y = applyStandardLayout(doc, 'Libro de Caja Menor', settings);

        doc.setTextColor(100, 116, 139); doc.setFontSize(9); doc.setFont('helvetica', 'normal');
        doc.text('Control de efectivo: ingresos, egresos y retiros de caja menor', margin, y + 8);

        const filterSummary = [];
        if (filtroFechaInicio) filterSummary.push(`Desde: ${filtroFechaInicio}`);
        if (filtroFechaFin) filterSummary.push(`Hasta: ${filtroFechaFin}`);
        if (filtroTipo !== 'Todos') filterSummary.push(`Tipo: ${filtroTipo}`);
        if (search) filterSummary.push(`Busqueda: "${search}"`);
        if (filterSummary.length > 0) {
            doc.text(`Filtros: ${filterSummary.join('  |  ')}`, margin, y + 13);
            y += 5;
        }

        doc.setTextColor(30, 41, 59); doc.setFontSize(11); doc.setFont('helvetica', 'bold');
        doc.text(`SALDO ACTUAL EN CAJA MENOR: ${fmtCOP(saldoActual)}`, margin, y + 15);

        autoTable(doc, {
            startY: y + 21,
            head: [['Fecha', 'Tipo', 'Origen', 'Ref.', 'Concepto', 'Tercero', 'Entrada', 'Salida', 'Saldo']],
            body: [
                ...filasTabla.map(m => [
                    formatFechaCorta(m.fecha), m.tipo, m.origen, m.referencia,
                    m.concepto, m.tercero,
                    m.entrada ? fmtCOP(m.entrada) : '—',
                    m.salida ? fmtCOP(m.salida) : '—',
                    fmtCOP(m.saldo)
                ]),
                ['', '', '', '', '', 'TOTALES DEL PERIODO:',
                    fmtCOP(resumenPeriodo.totalIngresos),
                    fmtCOP(resumenPeriodo.totalEgresos + resumenPeriodo.totalRetiros),
                    '—']
            ],
            headStyles: { fillColor: [30, 41, 59], textColor: 255, fontSize: 8 },
            styles: { fontSize: 7, cellPadding: 2.5 },
            columnStyles: { 4: { cellWidth: 38 } },
            margin: { left: margin, right: margin },
        });

        doc.save(`Caja_Menor_${format(new Date(), 'yyyyMMdd_HHmmss')}.pdf`);
    };

    return (
        <>
            {/* Header */}
            <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end', marginBottom: '1.5rem' }}>
                <button className="btn btn-primary" onClick={() => setShowRetiroModal(true)}
                    style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', background: '#f97316', border: 'none' }}>
                    <ArrowUpFromLine size={16} /> Retiro de Caja Menor
                </button>
            </div>

            {/* Saldo real + totales del periodo */}
            <div className="grid-cards" style={{ gridTemplateColumns: 'repeat(4, 1fr)', marginBottom: '1.5rem', gap: '0.75rem' }}>
                <div className="stat-card blue" style={{ padding: '0.85rem 1rem', flexDirection: 'row', alignItems: 'center', gap: '0.75rem', borderWidth: 2 }}>
                    <div className="icon-wrapper blue" style={{ width: '38px', height: '38px', minWidth: '38px', borderRadius: '10px', margin: 0 }}><Wallet size={18} /></div>
                    <div>
                        <div className="stat-value" style={{ fontSize: '1.25rem', lineHeight: 1.2, color: saldoActual < 0 ? '#ef4444' : undefined }}>{fmtCOP(saldoActual)}</div>
                        <div className="stat-label" style={{ fontSize: '0.75rem', color: 'var(--text-muted)', margin: 0 }}>Saldo Real en Caja Menor</div>
                    </div>
                </div>
                <div className="stat-card green" style={{ padding: '0.85rem 1rem', flexDirection: 'row', alignItems: 'center', gap: '0.75rem' }}>
                    <div className="icon-wrapper green" style={{ width: '38px', height: '38px', minWidth: '38px', borderRadius: '10px', margin: 0 }}><TrendingUp size={18} /></div>
                    <div>
                        <div className="stat-value" style={{ fontSize: '1.15rem', lineHeight: 1.2 }}>{fmtCOP(resumenPeriodo.totalIngresos)}</div>
                        <div className="stat-label" style={{ fontSize: '0.75rem', color: 'var(--text-muted)', margin: 0 }}>Entradas en Efectivo{hayFiltros ? ' (periodo)' : ''}</div>
                    </div>
                </div>
                <div className="stat-card red" style={{ padding: '0.85rem 1rem', flexDirection: 'row', alignItems: 'center', gap: '0.75rem' }}>
                    <div className="icon-wrapper red" style={{ width: '38px', height: '38px', minWidth: '38px', borderRadius: '10px', margin: 0 }}><TrendingDown size={18} /></div>
                    <div>
                        <div className="stat-value" style={{ fontSize: '1.15rem', lineHeight: 1.2 }}>{fmtCOP(resumenPeriodo.totalEgresos)}</div>
                        <div className="stat-label" style={{ fontSize: '0.75rem', color: 'var(--text-muted)', margin: 0 }}>Gastos en Efectivo{hayFiltros ? ' (periodo)' : ''}</div>
                    </div>
                </div>
                <div className="stat-card orange" style={{ padding: '0.85rem 1rem', flexDirection: 'row', alignItems: 'center', gap: '0.75rem' }}>
                    <div className="icon-wrapper orange" style={{ width: '38px', height: '38px', minWidth: '38px', borderRadius: '10px', margin: 0 }}><ArrowUpFromLine size={18} /></div>
                    <div>
                        <div className="stat-value" style={{ fontSize: '1.15rem', lineHeight: 1.2 }}>{fmtCOP(resumenPeriodo.totalRetiros)}</div>
                        <div className="stat-label" style={{ fontSize: '0.75rem', color: 'var(--text-muted)', margin: 0 }}>Retiros de Caja{hayFiltros ? ' (periodo)' : ''}</div>
                    </div>
                </div>
            </div>

            {/* Filtros y libro de movimientos */}
            <div className="glass-panel p-6">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem', flexWrap: 'wrap', gap: '1rem' }}>
                    <div>
                        <h3 style={{ margin: 0, color: '#104166', fontWeight: 700 }}>Movimientos de Caja Menor</h3>
                        <p style={{ margin: '0.25rem 0 0', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                            Todo pago recibido en efectivo entra aquí automáticamente; los gastos pagados en efectivo y los retiros lo descuentan.
                        </p>
                    </div>
                    <div style={{ display: 'flex', gap: '0.5rem' }}>
                        <button onClick={exportToCSV} className="btn btn-secondary" style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.8rem', padding: '0.4rem 0.75rem', background: '#f8fafc', border: '1px solid #cbd5e1', cursor: 'pointer' }}>
                            <Download size={14} /> Descargar CSV
                        </button>
                        <button onClick={exportToPDF} className="btn btn-secondary" style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.8rem', padding: '0.4rem 0.75rem', background: '#eff6ff', border: '1px solid #bfdbfe', color: '#1d4ed8', cursor: 'pointer' }}>
                            <Download size={14} /> Descargar PDF
                        </button>
                    </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '0.75rem', marginBottom: '1.5rem', background: 'rgba(255, 255, 255, 0.02)', padding: '1rem', borderRadius: '12px', border: '1px solid var(--surface-border)' }}>
                    <div>
                        <label style={{ display: 'block', fontSize: '0.75rem', color: '#104166', fontWeight: 700, marginBottom: '0.25rem' }}>Fecha Inicio</label>
                        <input type="date" value={filtroFechaInicio} onChange={e => setFiltroFechaInicio(e.target.value)}
                            style={{ width: '100%', padding: '0.4rem 0.6rem', border: '1px solid var(--surface-border)', borderRadius: '6px', background: '#ffffff', color: '#104166', fontSize: '0.8rem', outline: 'none', boxSizing: 'border-box' }} />
                    </div>
                    <div>
                        <label style={{ display: 'block', fontSize: '0.75rem', color: '#104166', fontWeight: 700, marginBottom: '0.25rem' }}>Fecha Fin</label>
                        <input type="date" value={filtroFechaFin} onChange={e => setFiltroFechaFin(e.target.value)}
                            style={{ width: '100%', padding: '0.4rem 0.6rem', border: '1px solid var(--surface-border)', borderRadius: '6px', background: '#ffffff', color: '#104166', fontSize: '0.8rem', outline: 'none', boxSizing: 'border-box' }} />
                    </div>
                    <div>
                        <label style={{ display: 'block', fontSize: '0.75rem', color: '#104166', fontWeight: 700, marginBottom: '0.25rem' }}>Tipo de Movimiento</label>
                        <select value={filtroTipo} onChange={e => setFiltroTipo(e.target.value)}
                            style={{ width: '100%', padding: '0.4rem 0.6rem', border: '1px solid var(--surface-border)', borderRadius: '6px', background: '#ffffff', color: '#104166', fontSize: '0.8rem', outline: 'none', cursor: 'pointer', boxSizing: 'border-box' }}>
                            <option value="Todos">Todos los movimientos</option>
                            <option value="Ingreso">Entradas (pagos en efectivo)</option>
                            <option value="Egreso">Gastos pagados en efectivo</option>
                            <option value="Retiro">Retiros de caja menor</option>
                        </select>
                    </div>
                    <div>
                        <label style={{ display: 'block', fontSize: '0.75rem', color: '#104166', fontWeight: 700, marginBottom: '0.25rem' }}>Texto de Búsqueda</label>
                        <input type="text" placeholder="Buscar por concepto, tercero o referencia..." value={search} onChange={e => setSearch(e.target.value)}
                            style={{ width: '100%', padding: '0.4rem 0.6rem', border: '1px solid var(--surface-border)', borderRadius: '6px', background: '#ffffff', color: '#104166', fontSize: '0.8rem', outline: 'none', boxSizing: 'border-box' }} />
                    </div>
                </div>

                {filasTabla.length === 0 ? (
                    <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-muted)' }}>
                        <Banknote size={48} style={{ opacity: 0.3, marginBottom: '1rem' }} />
                        <p>No hay movimientos de efectivo registrados</p>
                        <p style={{ fontSize: '0.8rem', maxWidth: 460, margin: '0.5rem auto 0' }}>
                            Los pagos de clientes con método <b>Efectivo</b> y los egresos pagados en efectivo aparecerán aquí de forma automática.
                        </p>
                    </div>
                ) : (
                    <div style={{ overflowX: 'auto' }}>
                        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                            <thead>
                                <tr style={{ borderBottom: '1px solid var(--surface-border)' }}>
                                    {['Fecha', 'Tipo', 'Origen', 'Referencia', 'Concepto', 'Tercero', 'Entrada', 'Salida', 'Saldo', 'Acciones'].map(h => (
                                        <th key={h} style={{ padding: '0.75rem 1rem', textAlign: 'left', ...CELL_TEXT, fontWeight: 'bold', textTransform: 'none', whiteSpace: 'nowrap' }}>{h}</th>
                                    ))}
                                </tr>
                            </thead>
                            <tbody>
                                {filasTabla.map(m => {
                                    const cfg = TIPO_CFG[m.tipo];
                                    return (
                                        <tr key={m.key} style={{ borderBottom: '1px solid var(--surface-border)', transition: 'background 0.15s' }}
                                            onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.03)'}
                                            onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                                            <td style={{ padding: '0.75rem 1rem', ...CELL_TEXT, whiteSpace: 'nowrap' }}>{formatFechaCorta(m.fecha)}</td>
                                            <td style={{ padding: '0.75rem 1rem' }}>
                                                <span style={{ padding: '2px 10px', borderRadius: 999, fontSize: '0.72rem', fontWeight: 700, background: cfg.bg, color: cfg.color, whiteSpace: 'nowrap' }}>
                                                    {m.tipo}
                                                </span>
                                            </td>
                                            <td style={{ padding: '0.75rem 1rem', ...CELL_TEXT }}>{m.origen}</td>
                                            <td style={{ padding: '0.75rem 1rem', ...CELL_TEXT }}>{m.referencia}</td>
                                            <td style={{ padding: '0.75rem 1rem', ...CELL_TEXT, maxWidth: 260, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={m.concepto}>{m.concepto}</td>
                                            <td style={{ padding: '0.75rem 1rem', ...CELL_TEXT }}>{m.tercero}</td>
                                            <td style={{ padding: '0.75rem 1rem', ...CELL_TEXT, color: m.entrada ? '#059669' : '#94a3b8', whiteSpace: 'nowrap' }}>{m.entrada ? fmtCOP(m.entrada) : '—'}</td>
                                            <td style={{ padding: '0.75rem 1rem', ...CELL_TEXT, color: m.salida ? '#dc2626' : '#94a3b8', whiteSpace: 'nowrap' }}>{m.salida ? fmtCOP(m.salida) : '—'}</td>
                                            <td style={{ padding: '0.75rem 1rem', ...CELL_TEXT, fontWeight: 700, color: m.saldo < 0 ? '#dc2626' : '#104166', whiteSpace: 'nowrap' }}>{fmtCOP(m.saldo)}</td>
                                            <td style={{ padding: '0.75rem 1rem', whiteSpace: 'nowrap' }}>
                                                {m.tipo === 'Retiro' && (
                                                    <div style={{ display: 'flex', gap: '0.5rem' }}>
                                                        <button onClick={() => handleEditRetiro(m)} style={{ padding: '0.3rem 0.5rem', background: '#f1f5f9', border: '1px solid #cbd5e1', borderRadius: '6px', color: '#263777', display: 'flex', alignItems: 'center', cursor: 'pointer' }} title="Editar retiro">
                                                            <Edit3 size={14} />
                                                        </button>
                                                        <button onClick={() => handleDeleteRetiro(m)} style={{ padding: '0.3rem 0.5rem', background: '#fef2f2', border: '1px solid #fca5a5', borderRadius: '6px', color: '#ef4444', display: 'flex', alignItems: 'center', cursor: 'pointer' }} title="Eliminar retiro">
                                                            <Trash2 size={14} />
                                                        </button>
                                                    </div>
                                                )}
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>

            {showRetiroModal && (
                <RetiroCajaMenorModal onClose={closeRetiroModal} editingRetiro={editingRetiro} />
            )}
        </>
    );
}
