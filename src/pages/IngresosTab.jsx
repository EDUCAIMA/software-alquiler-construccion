import React, { useState, useMemo } from 'react';
import { createPortal } from 'react-dom';
import {
    Plus, X, Download, DollarSign, Landmark, Banknote, PiggyBank,
    Edit3, Trash2, TrendingUp, Receipt
} from 'lucide-react';
import { useAppContext } from '../context/AppContext';
import { format } from 'date-fns';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { applyStandardLayout } from './pdfTheme';

const fmtCOP = n => `$${Math.round(n || 0).toLocaleString('es-CO')}`;

const METODOS_PAGO = ['Transferencia', 'Efectivo', 'Cheque', 'Tarjeta', 'Otro'];

// Estilo de texto uniforme para todas las celdas de la tabla: mismo color, mismo tamaño, sin negrilla.
const CELL_TEXT = { color: '#104166', fontSize: '0.85rem', fontWeight: 'normal' };

const safeFormatDate = (dateStr, targetFormat = 'dd/MM/yyyy') => {
    if (!dateStr) return '—';
    const cleanStr = String(dateStr).split('T')[0];
    const parts = cleanStr.split('-');
    if (parts.length === 3) {
        const [yyyy, mm, dd] = parts;
        if (targetFormat === 'yyyy-MM-dd') return `${yyyy}-${mm}-${dd}`;
        if (targetFormat === 'dd/MM/yyyy') return `${dd}/${mm}/${yyyy}`;
    }
    return dateStr;
};

const emptyForm = {
    concepto: '',
    descripcion: '',
    monto: '',
    fecha_ingreso: format(new Date(), 'yyyy-MM-dd'),
    metodo_pago: 'Efectivo',
    origen: '',
    referencia_soporte: ''
};

export default function IngresosTab({ actionSlot }) {
    const {
        invoices = [], clients = [], settings,
        ingresosCajaMenor = [], addIngresoCajaMenor, editIngresoCajaMenor, deleteIngresoCajaMenor,
        actualizarMetodoPagoAbono
    } = useAppContext();

    // Corrección del método de un pago ya registrado, para que los cobros que
    // fueron en efectivo lleguen a la caja menor aunque se hayan grabado mal.
    const [editandoMetodo, setEditandoMetodo] = useState(null);

    const handleCambiarMetodo = async (row, nuevoMetodo) => {
        setEditandoMetodo(null);
        if (nuevoMetodo === (row.metodoPago || '')) return;
        try {
            await actualizarMetodoPagoAbono(row.invoiceId, row.abonoIdx, nuevoMetodo);
        } catch (err) {
            console.error('Error corrigiendo el método de pago:', err);
            alert('No se pudo actualizar el método de pago.');
        }
    };

    const [showModal, setShowModal] = useState(false);
    const [editingId, setEditingId] = useState(null);
    const [form, setForm] = useState(emptyForm);

    const [filtroFechaInicio, setFiltroFechaInicio] = useState('');
    const [filtroFechaFin, setFiltroFechaFin] = useState('');
    const [filtroMetodo, setFiltroMetodo] = useState('Todos');
    const [filtroOrigen, setFiltroOrigen] = useState('Todos');
    const [search, setSearch] = useState('');

    // ─── Unifica pagos de remisiones (abonos) + ingresos de caja menor ────────
    const allIngresos = useMemo(() => {
        const deRemisiones = invoices.flatMap(inv => {
            const client = clients.find(c => c.id === inv.clientId);
            const abonos = Array.isArray(inv.abonos) ? inv.abonos : [];
            return abonos.map((ab, idx) => ({
                key: `${inv.id}-AB${idx}`,
                fecha: ab.fecha || inv.date,
                origenTipo: 'Remisión',
                refId: inv.id,
                cliente: client?.name || 'N/A',
                concepto: `Remisión ${inv.id}`,
                tipoPago: ab.tipo || '—',
                metodoPago: ab.metodoPago || null,
                monto: Number(ab.monto) || 0,
                esManual: false,
                invoiceId: inv.id,
                abonoIdx: idx,
            }));
        });

        const deCajaMenor = ingresosCajaMenor.map(g => ({
            key: g.id,
            fecha: g.fecha_ingreso,
            origenTipo: 'Caja Menor',
            refId: g.id,
            cliente: g.origen || '—',
            concepto: g.concepto,
            tipoPago: 'Contado',
            metodoPago: g.metodo_pago || 'Efectivo',
            monto: Number(g.monto) || 0,
            esManual: true,
            descripcion: g.descripcion,
            referencia: g.referencia_soporte,
            _raw: g,
        }));

        return [...deRemisiones, ...deCajaMenor];
    }, [invoices, clients, ingresosCajaMenor]);

    const filteredIngresos = useMemo(() => {
        return allIngresos.filter(row => {
            const dateVal = row.fecha ? safeFormatDate(row.fecha, 'yyyy-MM-dd') : '';
            const matchesStart = !filtroFechaInicio || dateVal >= filtroFechaInicio;
            const matchesEnd = !filtroFechaFin || dateVal <= filtroFechaFin;
            const matchesMetodo = filtroMetodo === 'Todos' || row.metodoPago === filtroMetodo;
            const matchesOrigen = filtroOrigen === 'Todos' || row.origenTipo === filtroOrigen;
            const query = search.toLowerCase();
            const matchesSearch = !query || (
                row.cliente.toLowerCase().includes(query) ||
                row.concepto.toLowerCase().includes(query) ||
                row.refId.toLowerCase().includes(query)
            );
            return matchesStart && matchesEnd && matchesMetodo && matchesOrigen && matchesSearch;
        }).sort((a, b) => (b.fecha || '').localeCompare(a.fecha || ''));
    }, [allIngresos, filtroFechaInicio, filtroFechaFin, filtroMetodo, filtroOrigen, search]);

    // ─── KPIs ───────────────────────────────────────────────────────────────
    const totalIngresos = filteredIngresos.reduce((s, r) => s + r.monto, 0);
    const totalTransferencia = filteredIngresos.filter(r => r.metodoPago === 'Transferencia').reduce((s, r) => s + r.monto, 0);
    const totalEfectivo = filteredIngresos.filter(r => r.metodoPago === 'Efectivo').reduce((s, r) => s + r.monto, 0);
    const totalCajaMenor = filteredIngresos.filter(r => r.origenTipo === 'Caja Menor').reduce((s, r) => s + r.monto, 0);

    // ─── Modal caja menor ───────────────────────────────────────────────────
    const openNew = () => { setEditingId(null); setForm(emptyForm); setShowModal(true); };
    const openEdit = (row) => {
        setEditingId(row._raw.id);
        setForm({
            concepto: row._raw.concepto || '',
            descripcion: row._raw.descripcion || '',
            monto: row._raw.monto,
            fecha_ingreso: safeFormatDate(row._raw.fecha_ingreso, 'yyyy-MM-dd'),
            metodo_pago: row._raw.metodo_pago || 'Efectivo',
            origen: row._raw.origen || '',
            referencia_soporte: row._raw.referencia_soporte || ''
        });
        setShowModal(true);
    };
    const closeModal = () => { setShowModal(false); setEditingId(null); setForm(emptyForm); };

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!form.concepto || !form.monto) return;
        try {
            if (editingId) {
                await editIngresoCajaMenor(editingId, form);
            } else {
                await addIngresoCajaMenor(form);
            }
            closeModal();
        } catch (err) {
            console.error('Error guardando ingreso de caja menor:', err);
            alert('Ocurrió un error al guardar el ingreso.');
        }
    };

    const handleDelete = async (id) => {
        if (window.confirm('¿Está seguro de que desea eliminar este registro de ingreso?')) {
            try {
                await deleteIngresoCajaMenor(id);
            } catch (err) {
                console.error('Error eliminando ingreso de caja menor:', err);
                alert('No se pudo eliminar el registro.');
            }
        }
    };

    // ─── Exportación ────────────────────────────────────────────────────────
    const exportToCSV = () => {
        const headers = ['Fecha', 'Origen', 'Referencia', 'Cliente', 'Tipo de Pago', 'Método de Pago', 'Monto'];
        const rows = filteredIngresos.map(r => [
            safeFormatDate(r.fecha, 'dd/MM/yyyy'), r.origenTipo, r.refId, r.cliente,
            r.tipoPago, r.metodoPago || 'N/A', r.monto
        ]);
        let csvContent = 'data:text/csv;charset=utf-8,﻿';
        csvContent += headers.map(h => `"${h}"`).join(',') + '\n';
        csvContent += rows.map(r => r.map(val => `"${val}"`).join(',')).join('\n');
        const encodedUri = encodeURI(csvContent);
        const link = document.createElement('a');
        link.setAttribute('href', encodedUri);
        link.setAttribute('download', `reporte_ingresos_${format(new Date(), 'yyyyMMdd_HHmmss')}.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    const exportToPDF = () => {
        const doc = new jsPDF();
        const margin = 10;
        let y = applyStandardLayout(doc, 'Reporte de Ingresos', settings);

        doc.setTextColor(100, 116, 139); doc.setFontSize(9); doc.setFont('helvetica', 'normal');
        doc.text('Ingresos por Remisiones (Cobros) y Caja Menor', margin, y + 8);

        let filterSummary = [];
        if (filtroFechaInicio) filterSummary.push(`Desde: ${filtroFechaInicio}`);
        if (filtroFechaFin) filterSummary.push(`Hasta: ${filtroFechaFin}`);
        if (filtroMetodo !== 'Todos') filterSummary.push(`Método: ${filtroMetodo}`);
        if (filtroOrigen !== 'Todos') filterSummary.push(`Origen: ${filtroOrigen}`);
        if (filterSummary.length > 0) {
            doc.text(`Filtros: ${filterSummary.join('  |  ')}`, margin, y + 13);
            y += 5;
        }

        const bodyData = filteredIngresos.map(r => [
            safeFormatDate(r.fecha, 'dd/MM/yyyy'), r.origenTipo, r.refId,
            r.cliente,
            r.tipoPago, r.metodoPago || 'N/A', fmtCOP(r.monto)
        ]);

        autoTable(doc, {
            startY: y + 17,
            head: [['Fecha', 'Origen', 'Ref.', 'Cliente', 'Tipo', 'Método', 'Monto']],
            body: [
                ...bodyData,
                ['', '', '', '', '', 'TOTAL:', fmtCOP(totalIngresos)]
            ],
            headStyles: { fillColor: [30, 41, 59], textColor: 255, fontSize: 8 },
            styles: { fontSize: 7.5, cellPadding: 3 },
            footStyles: { fontStyle: 'bold', fillColor: [248, 250, 252], textColor: [30, 41, 59] },
            margin: { left: margin, right: margin },
        });

        doc.save(`Reporte_Ingresos_${format(new Date(), 'yyyyMMdd_HHmmss')}.pdf`);
    };

    const actionButton = (
        <button className="btn btn-primary" onClick={openNew} style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
            <PiggyBank size={16} /> Registrar Ingreso de Caja Menor
        </button>
    );

    return (
        <>
            {/* Botón "Registrar Ingreso de Caja Menor": se porta al slot en la fila de pestañas
                (junto a "Remisiones / Cobros" e "Ingresos"); si el slot no está disponible, se
                muestra en su propia fila como respaldo. */}
            {actionSlot ? createPortal(actionButton, actionSlot) : (
                <div className="flex justify-end mb-6">{actionButton}</div>
            )}

            {/* KPI Cards */}
            <div className="grid-cards" style={{ gridTemplateColumns: 'repeat(4, 1fr)', marginBottom: '1.5rem', gap: '0.75rem' }}>
                <div className="stat-card green" style={{ padding: '0.85rem 1rem', flexDirection: 'row', alignItems: 'center', gap: '0.75rem' }}>
                    <div className="icon-wrapper green" style={{ width: '38px', height: '38px', minWidth: '38px', borderRadius: '10px', margin: 0 }}><TrendingUp size={18} /></div>
                    <div>
                        <div className="stat-value" style={{ fontSize: '1.15rem', lineHeight: 1.2 }}>{fmtCOP(totalIngresos)}</div>
                        <div className="stat-label" style={{ fontSize: '0.75rem', color: 'var(--text-muted)', margin: 0 }}>Ingreso Total</div>
                    </div>
                </div>
                <div className="stat-card blue" style={{ padding: '0.85rem 1rem', flexDirection: 'row', alignItems: 'center', gap: '0.75rem' }}>
                    <div className="icon-wrapper blue" style={{ width: '38px', height: '38px', minWidth: '38px', borderRadius: '10px', margin: 0 }}><Landmark size={18} /></div>
                    <div>
                        <div className="stat-value" style={{ fontSize: '1.15rem', lineHeight: 1.2 }}>{fmtCOP(totalTransferencia)}</div>
                        <div className="stat-label" style={{ fontSize: '0.75rem', color: 'var(--text-muted)', margin: 0 }}>Por Transferencia</div>
                    </div>
                </div>
                <div className="stat-card orange" style={{ padding: '0.85rem 1rem', flexDirection: 'row', alignItems: 'center', gap: '0.75rem' }}>
                    <div className="icon-wrapper orange" style={{ width: '38px', height: '38px', minWidth: '38px', borderRadius: '10px', margin: 0 }}><Banknote size={18} /></div>
                    <div>
                        <div className="stat-value" style={{ fontSize: '1.15rem', lineHeight: 1.2 }}>{fmtCOP(totalEfectivo)}</div>
                        <div className="stat-label" style={{ fontSize: '0.75rem', color: 'var(--text-muted)', margin: 0 }}>Por Efectivo / Contado</div>
                    </div>
                </div>
                <div className="stat-card red" style={{ padding: '0.85rem 1rem', flexDirection: 'row', alignItems: 'center', gap: '0.75rem' }}>
                    <div className="icon-wrapper red" style={{ width: '38px', height: '38px', minWidth: '38px', borderRadius: '10px', margin: 0 }}><Receipt size={18} /></div>
                    <div>
                        <div className="stat-value" style={{ fontSize: '1.15rem', lineHeight: 1.2 }}>{fmtCOP(totalCajaMenor)}</div>
                        <div className="stat-label" style={{ fontSize: '0.75rem', color: 'var(--text-muted)', margin: 0 }}>Caja Menor (No Facturado)</div>
                    </div>
                </div>
            </div>

            {/* Filters & Table */}
            <div className="glass-panel p-6">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem', flexWrap: 'wrap', gap: '1rem' }}>
                    <h3 style={{ margin: 0, color: '#104166', fontWeight: 700 }}>Historial de Ingresos</h3>
                    <div style={{ display: 'flex', gap: '0.5rem' }}>
                        <button onClick={exportToCSV} className="btn btn-secondary" style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.8rem', padding: '0.4rem 0.75rem', background: '#f8fafc', border: '1px solid #cbd5e1', cursor: 'pointer' }}>
                            <Download size={14} /> Descargar CSV
                        </button>
                        <button onClick={exportToPDF} className="btn btn-secondary" style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.8rem', padding: '0.4rem 0.75rem', background: '#eff6ff', border: '1px solid #bfdbfe', color: '#1d4ed8', cursor: 'pointer' }}>
                            <Download size={14} /> Descargar PDF
                        </button>
                    </div>
                </div>

                {/* Filter Controls Row */}
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
                        <label style={{ display: 'block', fontSize: '0.75rem', color: '#104166', fontWeight: 700, marginBottom: '0.25rem' }}>Método de Pago</label>
                        <select value={filtroMetodo} onChange={e => setFiltroMetodo(e.target.value)}
                            style={{ width: '100%', padding: '0.4rem 0.6rem', border: '1px solid var(--surface-border)', borderRadius: '6px', background: '#ffffff', color: '#104166', fontSize: '0.8rem', outline: 'none', cursor: 'pointer', boxSizing: 'border-box' }}>
                            <option value="Todos">Todos los métodos</option>
                            {METODOS_PAGO.map(m => <option key={m} value={m}>{m}</option>)}
                        </select>
                    </div>
                    <div>
                        <label style={{ display: 'block', fontSize: '0.75rem', color: '#104166', fontWeight: 700, marginBottom: '0.25rem' }}>Origen</label>
                        <select value={filtroOrigen} onChange={e => setFiltroOrigen(e.target.value)}
                            style={{ width: '100%', padding: '0.4rem 0.6rem', border: '1px solid var(--surface-border)', borderRadius: '6px', background: '#ffffff', color: '#104166', fontSize: '0.8rem', outline: 'none', cursor: 'pointer', boxSizing: 'border-box' }}>
                            <option value="Todos">Todos los orígenes</option>
                            <option value="Remisión">Remisión (Facturado)</option>
                            <option value="Caja Menor">Caja Menor (No Facturado)</option>
                        </select>
                    </div>
                    <div>
                        <label style={{ display: 'block', fontSize: '0.75rem', color: '#104166', fontWeight: 700, marginBottom: '0.25rem' }}>Texto de Búsqueda</label>
                        <input type="text" placeholder="Buscar por cliente, concepto o referencia..." value={search} onChange={e => setSearch(e.target.value)}
                            style={{ width: '100%', padding: '0.4rem 0.6rem', border: '1px solid var(--surface-border)', borderRadius: '6px', background: '#ffffff', color: '#104166', fontSize: '0.8rem', outline: 'none', boxSizing: 'border-box' }} />
                    </div>
                </div>

                {filteredIngresos.length === 0 ? (
                    <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-muted)' }}>
                        <DollarSign size={48} style={{ opacity: 0.3, marginBottom: '1rem' }} />
                        <p>No se encontraron registros de ingresos</p>
                    </div>
                ) : (
                    <div style={{ overflowX: 'auto' }}>
                        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                            <thead>
                                <tr style={{ borderBottom: '1px solid var(--surface-border)' }}>
                                    {['Fecha', 'Origen', 'Referencia', 'Cliente', 'Tipo de Pago', 'Método de Pago', 'Monto', 'Acciones'].map(h => (
                                        <th key={h} style={{ padding: '0.75rem 1rem', textAlign: 'left', ...CELL_TEXT, textTransform: 'none' }}>{h}</th>
                                    ))}
                                </tr>
                            </thead>
                            <tbody>
                                {filteredIngresos.map(row => {
                                    return (
                                        <tr key={row.key} style={{ borderBottom: '1px solid var(--surface-border)', transition: 'background 0.15s' }}
                                            onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.03)'}
                                            onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                                            <td style={{ padding: '0.75rem 1rem', ...CELL_TEXT, whiteSpace: 'nowrap' }}>{safeFormatDate(row.fecha, 'dd/MM/yyyy')}</td>
                                            <td style={{ padding: '0.75rem 1rem', ...CELL_TEXT }}>{row.origenTipo}</td>
                                            <td style={{ padding: '0.75rem 1rem', ...CELL_TEXT }}>{row.refId}</td>
                                            <td style={{ padding: '0.75rem 1rem', ...CELL_TEXT }}>{row.cliente}</td>
                                            <td style={{ padding: '0.75rem 1rem', ...CELL_TEXT }}>{row.tipoPago}</td>
                                            <td style={{ padding: '0.75rem 1rem', ...CELL_TEXT }}>
                                                {editandoMetodo === row.key ? (
                                                    <select
                                                        autoFocus
                                                        defaultValue={row.metodoPago || ''}
                                                        onBlur={() => setEditandoMetodo(null)}
                                                        onChange={e => handleCambiarMetodo(row, e.target.value)}
                                                        style={{ padding: '0.25rem 0.4rem', border: '1px solid #cbd5e1', borderRadius: 6, fontSize: '0.8rem', color: '#104166', background: '#fff', cursor: 'pointer' }}
                                                    >
                                                        <option value="">Sin especificar</option>
                                                        {METODOS_PAGO.map(m => <option key={m} value={m}>{m}</option>)}
                                                    </select>
                                                ) : row.esManual ? (
                                                    row.metodoPago || 'Sin especificar'
                                                ) : (
                                                    <button
                                                        onClick={() => setEditandoMetodo(row.key)}
                                                        title="Clic para corregir el método de pago"
                                                        style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '2px 8px', borderRadius: 999, cursor: 'pointer', fontSize: '0.8rem', fontWeight: row.metodoPago === 'Efectivo' ? 700 : 400, background: row.metodoPago === 'Efectivo' ? 'rgba(249,115,22,0.12)' : '#f1f5f9', color: row.metodoPago === 'Efectivo' ? '#c2410c' : (row.metodoPago ? '#104166' : '#94a3b8'), border: '1px solid ' + (row.metodoPago === 'Efectivo' ? '#fdba74' : '#e2e8f0') }}
                                                    >
                                                        {row.metodoPago === 'Efectivo' && <Banknote size={12} />}
                                                        {row.metodoPago || 'Sin especificar'}
                                                        <Edit3 size={11} style={{ opacity: 0.5 }} />
                                                    </button>
                                                )}
                                            </td>
                                            <td style={{ padding: '0.75rem 1rem', ...CELL_TEXT }}>{fmtCOP(row.monto)}</td>
                                            <td style={{ padding: '0.75rem 1rem', whiteSpace: 'nowrap' }}>
                                                {row.esManual && (
                                                    <div style={{ display: 'flex', gap: '0.5rem' }}>
                                                        <button onClick={() => openEdit(row)} style={{ padding: '0.3rem 0.5rem', background: '#f1f5f9', border: '1px solid #cbd5e1', borderRadius: '6px', color: '#263777', display: 'flex', alignItems: 'center', cursor: 'pointer' }} title="Editar">
                                                            <Edit3 size={14} />
                                                        </button>
                                                        <button onClick={() => handleDelete(row._raw.id)} style={{ padding: '0.3rem 0.5rem', background: '#fef2f2', border: '1px solid #fca5a5', borderRadius: '6px', color: '#ef4444', display: 'flex', alignItems: 'center', cursor: 'pointer' }} title="Eliminar">
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

            {/* Modal Form: Ingreso de Caja Menor */}
            {showModal && (
                <div style={{ position: 'fixed', inset: 0, background: 'rgba(15, 23, 42, 0.6)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '1rem' }}>
                    <div style={{ background: '#ffffff', borderRadius: '16px', boxShadow: '0 20px 40px rgba(0,0,0,0.15)', width: '100%', maxWidth: 480, display: 'flex', flexDirection: 'column' }}>
                        <div style={{ padding: '1.25rem 1.5rem', borderBottom: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <h3 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '0.6rem', color: '#104166', fontSize: '1.1rem' }}>
                                <div style={{ background: '#eff6ff', padding: '0.4rem', borderRadius: '8px', display: 'flex' }}><PiggyBank size={18} style={{ color: '#2365AB' }} /></div>
                                {editingId ? 'Editar Ingreso de Caja Menor' : 'Nuevo Ingreso de Caja Menor'}
                            </h3>
                            <button onClick={closeModal} style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '50%', width: 30, height: 30, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: '#64748b' }}><X size={16} /></button>
                        </div>
                        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1rem', padding: '1.5rem', margin: 0 }}>
                            <div>
                                <label style={{ display: 'block', fontSize: '0.8rem', color: '#263777', fontWeight: 600, marginBottom: '0.4rem' }}>Concepto *</label>
                                <input type="text" value={form.concepto} onChange={e => setForm(f => ({ ...f, concepto: e.target.value }))} required
                                    placeholder="Ej. Venta de chatarra, alquiler puntual sin factura..."
                                    style={{ width: '100%', padding: '0.6rem 0.75rem', background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: 8, color: '#104166', fontSize: '0.85rem', outline: 'none', boxSizing: 'border-box' }} />
                            </div>
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                                <div>
                                    <label style={{ display: 'block', fontSize: '0.8rem', color: '#263777', fontWeight: 600, marginBottom: '0.4rem' }}>Fecha de Ingreso</label>
                                    <input type="date" value={form.fecha_ingreso} onChange={e => setForm(f => ({ ...f, fecha_ingreso: e.target.value }))} required
                                        style={{ width: '100%', padding: '0.6rem 0.75rem', background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: 8, color: '#104166', fontSize: '0.85rem', outline: 'none', boxSizing: 'border-box' }} />
                                </div>
                                <div>
                                    <label style={{ display: 'block', fontSize: '0.8rem', color: '#263777', fontWeight: 600, marginBottom: '0.4rem' }}>Monto ($) *</label>
                                    <input type="number" min="0" value={form.monto} onChange={e => setForm(f => ({ ...f, monto: e.target.value }))} placeholder="0" required
                                        style={{ width: '100%', padding: '0.6rem 0.75rem', background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: 8, color: '#104166', fontSize: '0.85rem', outline: 'none', boxSizing: 'border-box' }} />
                                </div>
                            </div>
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                                <div>
                                    <label style={{ display: 'block', fontSize: '0.8rem', color: '#263777', fontWeight: 600, marginBottom: '0.4rem' }}>Método de Pago</label>
                                    <select value={form.metodo_pago} onChange={e => setForm(f => ({ ...f, metodo_pago: e.target.value }))}
                                        style={{ width: '100%', padding: '0.6rem 0.75rem', background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: 8, color: '#104166', fontSize: '0.85rem', outline: 'none', cursor: 'pointer', boxSizing: 'border-box' }}>
                                        {METODOS_PAGO.map(m => <option key={m} value={m}>{m}</option>)}
                                    </select>
                                </div>
                                <div>
                                    <label style={{ display: 'block', fontSize: '0.8rem', color: '#263777', fontWeight: 600, marginBottom: '0.4rem' }}>Origen / Quién Paga</label>
                                    <input type="text" value={form.origen} onChange={e => setForm(f => ({ ...f, origen: e.target.value }))} placeholder="Nombre de quien paga..."
                                        style={{ width: '100%', padding: '0.6rem 0.75rem', background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: 8, color: '#104166', fontSize: '0.85rem', outline: 'none', boxSizing: 'border-box' }} />
                                </div>
                            </div>
                            <div>
                                <label style={{ display: 'block', fontSize: '0.8rem', color: '#263777', fontWeight: 600, marginBottom: '0.4rem' }}>Referencia Soporte</label>
                                <input type="text" value={form.referencia_soporte} onChange={e => setForm(f => ({ ...f, referencia_soporte: e.target.value }))} placeholder="Nº recibo, consignación, etc..."
                                    style={{ width: '100%', padding: '0.6rem 0.75rem', background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: 8, color: '#104166', fontSize: '0.85rem', outline: 'none', boxSizing: 'border-box' }} />
                            </div>
                            <div>
                                <label style={{ display: 'block', fontSize: '0.8rem', color: '#263777', fontWeight: 600, marginBottom: '0.4rem' }}>Descripción</label>
                                <textarea value={form.descripcion} onChange={e => setForm(f => ({ ...f, descripcion: e.target.value }))} rows={3}
                                    placeholder="Detalles sobre el ingreso..."
                                    style={{ width: '100%', padding: '0.6rem 0.75rem', background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: 8, color: '#104166', fontSize: '0.85rem', outline: 'none', resize: 'vertical', boxSizing: 'border-box' }} />
                            </div>
                            <div style={{ padding: '1rem', background: '#f8fafc', borderTop: '1px solid #e2e8f0', borderRadius: '0 0 16px 16px', display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', margin: '0.5rem -1.5rem -1.5rem -1.5rem' }}>
                                <button type="button" className="btn btn-secondary" onClick={closeModal} style={{ background: '#ffffff', border: '1px solid #cbd5e1', color: '#263777' }}>Cancelar</button>
                                <button type="submit" className="btn btn-primary">{editingId ? 'Guardar Cambios' : 'Registrar Ingreso'}</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </>
    );
}
