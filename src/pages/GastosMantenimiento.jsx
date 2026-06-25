import React, { useState } from 'react';
import { Calculator, Plus, Trash2, Edit3, X, TrendingUp, AlertTriangle, Clock, Package, Wrench, Receipt } from 'lucide-react';
import { useAppContext } from '../context/AppContext';
import { format } from 'date-fns';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { applyStandardLayout } from './pdfTheme';

const CATEGORIES_MAP = {
    'Compra de Máquina o Herramienta': [
        'Maquinaria Pesada',
        'Herramientas Eléctricas',
        'Estructuras y Andamios',
        'Repuestos de Inventario',
        'Otros'
    ],
    'Mantenimiento': [
        'Mantenimiento Preventivo',
        'Reparación Correctiva',
        'Mantenimiento Predictivo',
        'Calibración / Ajuste',
        'Otros'
    ],
    'Gastos de Sostenimiento': [
        'Alimentación / Refrigerios',
        'Tinto / Cafetería',
        'Transporte / Viáticos',
        'Combustible / Lubricantes',
        'Limpieza y Aseo',
        'Otros'
    ],
    'Servicios': [
        'Energía Eléctrica',
        'Agua / Alcantarillado',
        'Internet / Telefonía',
        'Gas',
        'Servicios de Soporte',
        'Otros'
    ],
    'Arriendo': [
        'Arriendo de Local / Bodega',
        'Arriendo de Equipos Externos',
        'Arriendo de Vehículos',
        'Otros'
    ],
    'Nómina': [
        'Salario de Operarios',
        'Salario Administrativo',
        'Horas Extra',
        'Seguridad Social / Prestaciones',
        'Mano de Obra Externa / Contratistas',
        'Otros'
    ],
    'Otros Gastos': [
        'Papelería / Oficina',
        'Impuestos / Tasas',
        'Seguros',
        'Imprevistos',
        'Varios'
    ]
};

const TIPO_CONFIG = {
    'Compra de Máquina o Herramienta': { color: '#8b5cf6', label: 'Compra de Máquina o Herramienta' },
    'Mantenimiento': { color: '#2365AB', label: 'Mantenimiento' },
    'Gastos de Sostenimiento': { color: '#f97316', label: 'Sostenimiento' },
    'Servicios': { color: '#eab308', label: 'Servicios' },
    'Arriendo': { color: '#ec4899', label: 'Arriendo' },
    'Nómina': { color: '#10b981', label: 'Nómina' },
    'Otros Gastos': { color: '#64748b', label: 'Otros Gastos' }
};

export default function GastosMantenimiento() {
    const { 
        gastosMantenimiento, 
        addGastoMantenimiento, 
        editGastoMantenimiento, 
        deleteGastoMantenimiento, 
        products,
        settings
    } = useAppContext();

    const [showModal, setShowModal] = useState(false);
    const [editingId, setEditingId] = useState(null);
    const [form, setForm] = useState({
        id_maquina: '', 
        tipo_gasto: 'Mantenimiento', 
        subtipo_gasto: 'Mantenimiento Preventivo', 
        descripcion: '', 
        costo: '', 
        fecha_gasto: format(new Date(), 'yyyy-MM-dd'),
        proveedor_beneficiario: '',
        referencia_soporte: ''
    });
    
    const [search, setSearch] = useState('');
    const [filtroFechaInicio, setFiltroFechaInicio] = useState('');
    const [filtroFechaFin, setFiltroFechaFin] = useState('');
    const [filtroCategoria, setFiltroCategoria] = useState('Todos');
    const [filtroSubcategoria, setFiltroSubcategoria] = useState('Todos');

    // Filtered data
    const filteredGastos = gastosMantenimiento.filter(g => {
        const query = search.toLowerCase();
        
        // Text search match
        const matchesSearch = (
            g.tipo_gasto.toLowerCase().includes(query) ||
            (g.subtipo_gasto && g.subtipo_gasto.toLowerCase().includes(query)) ||
            (g.descripcion && g.descripcion.toLowerCase().includes(query)) ||
            (g.proveedor_beneficiario && g.proveedor_beneficiario.toLowerCase().includes(query)) ||
            (g.referencia_soporte && g.referencia_soporte.toLowerCase().includes(query)) ||
            g.id.toLowerCase().includes(query)
        );
        
        // Date range match
        const dateVal = g.fecha_gasto ? format(new Date(g.fecha_gasto), 'yyyy-MM-dd') : '';
        const matchesStartDate = !filtroFechaInicio || dateVal >= filtroFechaInicio;
        const matchesEndDate = !filtroFechaFin || dateVal <= filtroFechaFin;
        
        // Category match
        const matchesCategory = filtroCategoria === 'Todos' || g.tipo_gasto === filtroCategoria;
        
        // Subcategory match
        const matchesSubcategory = filtroSubcategoria === 'Todos' || g.subtipo_gasto === filtroSubcategoria;
        
        return matchesSearch && matchesStartDate && matchesEndDate && matchesCategory && matchesSubcategory;
    });

    // KPIs based on filtered data
    const totalGasto = filteredGastos.reduce((s, g) => s + (Number(g.costo) || 0), 0);
    const gastoInventario = filteredGastos
        .filter(g => g.tipo_gasto === 'Compra de Inventario' || g.tipo_gasto === 'Compra de Máquina o Herramienta')
        .reduce((s, g) => s + (Number(g.costo) || 0), 0);
    const gastoMantenimiento = filteredGastos
        .filter(g => g.tipo_gasto === 'Mantenimiento')
        .reduce((s, g) => s + (Number(g.costo) || 0), 0);
    const gastoOperativos = filteredGastos
        .filter(g => g.tipo_gasto !== 'Compra de Inventario' && g.tipo_gasto !== 'Compra de Máquina o Herramienta' && g.tipo_gasto !== 'Mantenimiento')
        .reduce((s, g) => s + (Number(g.costo) || 0), 0);

    const handleSubmit = async (e) => {
        e.preventDefault();
        const payload = {
            id_maquina: form.id_maquina || null,
            tipo_gasto: form.tipo_gasto,
            subtipo_gasto: form.subtipo_gasto,
            descripcion: form.descripcion,
            costo: Number(form.costo) || 0,
            fecha_gasto: form.fecha_gasto,
            proveedor_beneficiario: form.proveedor_beneficiario || '',
            referencia_soporte: form.referencia_soporte || ''
        };

        try {
            if (editingId) {
                await editGastoMantenimiento(editingId, payload);
            } else {
                await addGastoMantenimiento(payload);
            }
            closeForm();
        } catch (error) {
            console.error("Error saving expense:", error);
            alert("Ocurrió un error al guardar el gasto.");
        }
    };

    const openEdit = (gasto) => {
        setEditingId(gasto.id);
        setForm({
            id_maquina: gasto.id_maquina || '',
            tipo_gasto: gasto.tipo_gasto || 'Mantenimiento',
            subtipo_gasto: gasto.subtipo_gasto || (CATEGORIES_MAP[gasto.tipo_gasto || 'Mantenimiento']?.[0] || ''),
            descripcion: gasto.descripcion || '',
            costo: gasto.costo,
            fecha_gasto: format(new Date(gasto.fecha_gasto), 'yyyy-MM-dd'),
            proveedor_beneficiario: gasto.proveedor_beneficiario || '',
            referencia_soporte: gasto.referencia_soporte || ''
        });
        setShowModal(true);
    };

    const handleDelete = async (id) => {
        if (window.confirm("¿Está seguro de que desea eliminar este registro de gasto?")) {
            try {
                await deleteGastoMantenimiento(id);
            } catch (error) {
                console.error("Error deleting expense:", error);
                alert("No se pudo eliminar el registro.");
            }
        }
    };

    const closeForm = () => {
        setEditingId(null);
        setForm({
            id_maquina: '', 
            tipo_gasto: 'Mantenimiento', 
            subtipo_gasto: 'Mantenimiento Preventivo', 
            descripcion: '', 
            costo: '', 
            fecha_gasto: format(new Date(), 'yyyy-MM-dd'),
            proveedor_beneficiario: '',
            referencia_soporte: ''
        });
        setShowModal(false);
    };

    const exportToCSV = () => {
        const headers = ['ID', 'Categoria Principal', 'Subcategoria / Concepto', 'Proveedor / Beneficiario', 'Referencia Soporte', 'Descripcion', 'Costo', 'Fecha Gasto'];
        const rows = filteredGastos.map(g => [
            g.id,
            g.tipo_gasto,
            g.subtipo_gasto || '',
            g.proveedor_beneficiario || '',
            g.referencia_soporte || '',
            (g.descripcion || '').replace(/"/g, '""'),
            g.costo || 0,
            format(new Date(g.fecha_gasto), 'dd/MM/yyyy')
        ]);
        
        let csvContent = "data:text/csv;charset=utf-8,\uFEFF"; 
        csvContent += headers.map(h => `"${h}"`).join(",") + "\n";
        csvContent += rows.map(r => r.map(val => `"${val}"`).join(",")).join("\n");
        
        const encodedUri = encodeURI(csvContent);
        const link = document.createElement("a");
        link.setAttribute("href", encodedUri);
        link.setAttribute("download", `reporte_gastos_${format(new Date(), 'yyyyMMdd_HHmmss')}.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    const exportToPDF = () => {
        const doc = new jsPDF();
        const margin = 10;
        let y = applyStandardLayout(doc, 'Reporte de Gastos', settings);

        doc.setTextColor(100, 116, 139); doc.setFontSize(9); doc.setFont('helvetica', 'normal');
        doc.text('Reporte de Gastos y Costos Operativos Filtrados', margin, y + 8);
        
        let filterSummary = [];
        if (filtroFechaInicio) filterSummary.push(`Desde: ${filtroFechaInicio}`);
        if (filtroFechaFin) filterSummary.push(`Hasta: ${filtroFechaFin}`);
        if (filtroCategoria !== 'Todos') filterSummary.push(`Cat: ${filtroCategoria}`);
        if (filtroSubcategoria !== 'Todos') filterSummary.push(`Subcat: ${filtroSubcategoria}`);
        if (search) filterSummary.push(`Busqueda: "${search}"`);
        
        if (filterSummary.length > 0) {
            doc.text(`Filtros: ${filterSummary.join('  |  ')}`, margin, y + 13);
            y += 5;
        }

        const bodyData = filteredGastos.map(g => [
            g.id,
            g.tipo_gasto,
            g.subtipo_gasto || '—',
            g.proveedor_beneficiario || '—',
            g.referencia_soporte || '—',
            g.descripcion || '—',
            `$${(g.costo || 0).toLocaleString()}`,
            format(new Date(g.fecha_gasto), 'dd/MM/yyyy')
        ]);

        const totalCosto = filteredGastos.reduce((s, g) => s + (Number(g.costo) || 0), 0);

        autoTable(doc, {
            startY: y + 17,
            head: [['ID', 'Categoria', 'Subcategoria', 'Proveedor', 'Ref. Soporte', 'Descripcion', 'Costo', 'Fecha']],
            body: [
                ...bodyData,
                ['', '', '', '', '', 'TOTAL FILTRADO:', `$${totalCosto.toLocaleString()}`, '']
            ],
            headStyles: { fillColor: [30, 41, 59], textColor: 255, fontSize: 8 },
            styles: { fontSize: 7.5, cellPadding: 3 },
            footStyles: { fontStyle: 'bold', fillColor: [248, 250, 252], textColor: [30, 41, 59] },
            margin: { left: margin, right: margin },
        });

        doc.save(`Reporte_Gastos_${format(new Date(), 'yyyyMMdd_HHmmss')}.pdf`);
    };

    return (
        <>
            {/* Header */}
            <div className="flex justify-between items-center mb-6">
                <div>
                    <h1>Gastos y Costos Operativos</h1>
                    <p className="text-muted">Registro y control unificado de mantenimientos, consumos, nómina, refrigerios y gastos generales</p>
                </div>
                <button className="btn btn-primary" onClick={() => setShowModal(true)}
                    style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                    <Plus size={16} /> Registrar Egresos
                </button>
            </div>

            {/* KPI Cards */}
            <div className="grid-cards" style={{ gridTemplateColumns: 'repeat(4, 1fr)', marginBottom: '1.5rem', gap: '0.75rem' }}>
                <div className="stat-card blue" style={{ padding: '0.85rem 1rem', flexDirection: 'row', alignItems: 'center', gap: '0.75rem' }}>
                    <div className="icon-wrapper blue" style={{ width: '38px', height: '38px', minWidth: '38px', borderRadius: '10px', margin: 0 }}><Calculator size={18} /></div>
                    <div>
                        <div className="stat-value" style={{ fontSize: '1.15rem', lineHeight: 1.2 }}>${totalGasto.toLocaleString()}</div>
                        <div className="stat-label" style={{ fontSize: '0.75rem', color: 'var(--text-muted)', margin: 0 }}>Gasto Total</div>
                    </div>
                </div>
                <div className="stat-card green" style={{ padding: '0.85rem 1rem', flexDirection: 'row', alignItems: 'center', gap: '0.75rem' }}>
                    <div className="icon-wrapper green" style={{ width: '38px', height: '38px', minWidth: '38px', borderRadius: '10px', margin: 0 }}><Package size={18} /></div>
                    <div>
                        <div className="stat-value" style={{ fontSize: '1.15rem', lineHeight: 1.2 }}>${gastoInventario.toLocaleString()}</div>
                        <div className="stat-label" style={{ fontSize: '0.75rem', color: 'var(--text-muted)', margin: 0 }}>Compra Inventario</div>
                    </div>
                </div>
                <div className="stat-card orange" style={{ padding: '0.85rem 1rem', flexDirection: 'row', alignItems: 'center', gap: '0.75rem' }}>
                    <div className="icon-wrapper orange" style={{ width: '38px', height: '38px', minWidth: '38px', borderRadius: '10px', margin: 0 }}><Wrench size={18} /></div>
                    <div>
                        <div className="stat-value" style={{ fontSize: '1.15rem', lineHeight: 1.2 }}>${gastoMantenimiento.toLocaleString()}</div>
                        <div className="stat-label" style={{ fontSize: '0.75rem', color: 'var(--text-muted)', margin: 0 }}>Mantenimiento</div>
                    </div>
                </div>
                <div className="stat-card red" style={{ padding: '0.85rem 1rem', flexDirection: 'row', alignItems: 'center', gap: '0.75rem' }}>
                    <div className="icon-wrapper red" style={{ width: '38px', height: '38px', minWidth: '38px', borderRadius: '10px', margin: 0 }}><Receipt size={18} /></div>
                    <div>
                        <div className="stat-value" style={{ fontSize: '1.15rem', lineHeight: 1.2 }}>${gastoOperativos.toLocaleString()}</div>
                        <div className="stat-label" style={{ fontSize: '0.75rem', color: 'var(--text-muted)', margin: 0 }}>Gastos Operativos</div>
                    </div>
                </div>
            </div>

            {/* Filters & Table */}
            <div className="glass-panel p-6">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem', flexWrap: 'wrap', gap: '1rem' }}>
                    <h3 style={{ margin: 0, color: '#104166', fontWeight: 700 }}>Historial de Egresos</h3>
                    
                    {/* Action buttons to Export */}
                    <div style={{ display: 'flex', gap: '0.5rem' }}>
                        <button onClick={exportToCSV} className="btn btn-secondary" style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.8rem', padding: '0.4rem 0.75rem', background: '#f8fafc', border: '1px solid #cbd5e1', cursor: 'pointer' }}>
                            Descargar CSV
                        </button>
                        <button onClick={exportToPDF} className="btn btn-secondary" style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.8rem', padding: '0.4rem 0.75rem', background: '#eff6ff', border: '1px solid #bfdbfe', color: '#1d4ed8', cursor: 'pointer' }}>
                            Descargar PDF
                        </button>
                    </div>
                </div>

                {/* Filter Controls Row */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '0.75rem', marginBottom: '1.5rem', background: 'rgba(255, 255, 255, 0.02)', padding: '1rem', borderRadius: '12px', border: '1px solid var(--surface-border)' }}>
                    <div>
                        <label style={{ display: 'block', fontSize: '0.75rem', color: '#104166', fontWeight: 700, marginBottom: '0.25rem' }}>Fecha Inicio</label>
                        <input 
                            type="date" 
                            value={filtroFechaInicio}
                            onChange={e => setFiltroFechaInicio(e.target.value)}
                            style={{ width: '100%', padding: '0.4rem 0.6rem', border: '1px solid var(--surface-border)', borderRadius: '6px', background: '#ffffff', color: '#104166', fontSize: '0.8rem', outline: 'none', boxSizing: 'border-box' }}
                        />
                    </div>
                    <div>
                        <label style={{ display: 'block', fontSize: '0.75rem', color: '#104166', fontWeight: 700, marginBottom: '0.25rem' }}>Fecha Fin</label>
                        <input 
                            type="date" 
                            value={filtroFechaFin}
                            onChange={e => setFiltroFechaFin(e.target.value)}
                            style={{ width: '100%', padding: '0.4rem 0.6rem', border: '1px solid var(--surface-border)', borderRadius: '6px', background: '#ffffff', color: '#104166', fontSize: '0.8rem', outline: 'none', boxSizing: 'border-box' }}
                        />
                    </div>
                    <div>
                        <label style={{ display: 'block', fontSize: '0.75rem', color: '#104166', fontWeight: 700, marginBottom: '0.25rem' }}>Categoría Principal</label>
                        <select 
                            value={filtroCategoria}
                            onChange={e => {
                                const val = e.target.value;
                                setFiltroCategoria(val);
                                setFiltroSubcategoria('Todos');
                            }}
                            style={{ width: '100%', padding: '0.4rem 0.6rem', border: '1px solid var(--surface-border)', borderRadius: '6px', background: '#ffffff', color: '#104166', fontSize: '0.8rem', outline: 'none', cursor: 'pointer', boxSizing: 'border-box' }}
                        >
                            <option value="Todos">Todas las categorías</option>
                            {Object.keys(CATEGORIES_MAP).map(k => <option key={k} value={k}>{k}</option>)}
                        </select>
                    </div>
                    <div>
                        <label style={{ display: 'block', fontSize: '0.75rem', color: '#104166', fontWeight: 700, marginBottom: '0.25rem' }}>Subcategoría / Concepto</label>
                        <select 
                            value={filtroSubcategoria}
                            onChange={e => setFiltroSubcategoria(e.target.value)}
                            disabled={filtroCategoria === 'Todos'}
                            style={{ width: '100%', padding: '0.4rem 0.6rem', border: '1px solid var(--surface-border)', borderRadius: '6px', background: '#ffffff', color: '#104166', fontSize: '0.8rem', outline: 'none', cursor: 'pointer', boxSizing: 'border-box', opacity: filtroCategoria === 'Todos' ? 0.6 : 1 }}
                        >
                            <option value="Todos">Todas las subcategorías</option>
                            {filtroCategoria !== 'Todos' && (CATEGORIES_MAP[filtroCategoria] || []).map(sk => (
                                <option key={sk} value={sk}>{sk}</option>
                            ))}
                        </select>
                    </div>
                    <div>
                        <label style={{ display: 'block', fontSize: '0.75rem', color: '#104166', fontWeight: 700, marginBottom: '0.25rem' }}>Texto de Búsqueda</label>
                        <input 
                            type="text" 
                            placeholder="Buscar por tipo, subconcepto, máquina, proveedor o descripción..."
                            value={search}
                            onChange={e => setSearch(e.target.value)}
                            style={{ width: '100%', padding: '0.4rem 0.6rem', border: '1px solid var(--surface-border)', borderRadius: '6px', background: '#ffffff', color: '#104166', fontSize: '0.8rem', outline: 'none', boxSizing: 'border-box' }}
                        />
                    </div>
                </div>

                {filteredGastos.length === 0 ? (
                    <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-muted)' }}>
                        <Calculator size={48} style={{ opacity: 0.3, marginBottom: '1rem' }} />
                        <p>No se encontraron registros de gastos</p>
                    </div>
                ) : (
                    <div style={{ overflowX: 'auto' }}>
                        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                            <thead>
                                <tr style={{ borderBottom: '1px solid var(--surface-border)' }}>
                                    {['ID', 'Clasificación Gasto', 'Subconcepto', 'Proveedor / Beneficiario', 'Referencia Soporte', 'Descripción', 'Costo', 'Fecha Gasto', 'Acciones'].map(h => (
                                        <th key={h} style={{ padding: '0.75rem 1rem', textAlign: 'left', fontSize: '0.85rem', color: '#104166', fontWeight: 'bold', textTransform: 'none' }}>{h}</th>
                                    ))}
                                </tr>
                            </thead>
                            <tbody>
                                {filteredGastos.map(g => {
                                    const config = TIPO_CONFIG[g.tipo_gasto] || TIPO_CONFIG['Otros Gastos'];
                                    return (
                                        <tr key={g.id} style={{ borderBottom: '1px solid var(--surface-border)', transition: 'background 0.15s' }}
                                            onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.03)'}
                                            onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                                            <td style={{ padding: '0.75rem 1rem', fontSize: '0.85rem', color: '#104166', fontWeight: 'normal' }}>{g.id}</td>
                                            <td style={{ padding: '0.75rem 1rem', fontSize: '0.85rem', color: '#104166', fontWeight: 'normal' }}>
                                                {config.label}
                                            </td>
                                            <td style={{ padding: '0.75rem 1rem', fontSize: '0.85rem', color: '#104166', fontWeight: 'normal' }}>
                                                {g.subtipo_gasto || 'Sin clasificar'}
                                            </td>
                                            <td style={{ padding: '0.75rem 1rem', fontSize: '0.85rem', color: '#104166', fontWeight: 'normal' }}>
                                                {g.proveedor_beneficiario || 'N/A'}
                                            </td>
                                            <td style={{ padding: '0.75rem 1rem', fontSize: '0.85rem', color: '#104166', fontWeight: 'normal' }}>
                                                {g.referencia_soporte || 'N/A'}
                                            </td>
                                            <td style={{ padding: '0.75rem 1rem', fontSize: '0.85rem', maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: '#104166', fontWeight: 'normal' }} title={g.descripcion}>
                                                {g.descripcion || 'Sin descripción'}
                                            </td>
                                            <td style={{ padding: '0.75rem 1rem', fontSize: '0.85rem', fontWeight: 'normal', color: '#104166' }}>
                                                ${(g.costo || 0).toLocaleString()}
                                            </td>
                                            <td style={{ padding: '0.75rem 1rem', fontSize: '0.85rem', color: '#104166', fontWeight: 'normal', whiteSpace: 'nowrap' }}>
                                                {format(new Date(g.fecha_gasto), 'dd/MM/yyyy')}
                                            </td>
                                            <td style={{ padding: '0.75rem 1rem', whiteSpace: 'nowrap' }}>
                                                <div style={{ display: 'flex', gap: '0.5rem' }}>
                                                    <button onClick={() => openEdit(g)} className="btn btn-secondary" style={{ padding: '0.3rem 0.5rem', background: '#f1f5f9', border: '1px solid #cbd5e1', borderRadius: '6px', color: '#263777', display: 'flex', alignItems: 'center', cursor: 'pointer' }} title="Editar">
                                                        <Edit3 size={14} />
                                                    </button>
                                                    <button onClick={() => handleDelete(g.id)} className="btn btn-danger" style={{ padding: '0.3rem 0.5rem', background: '#fef2f2', border: '1px solid #fca5a5', borderRadius: '6px', color: '#ef4444', display: 'flex', alignItems: 'center', cursor: 'pointer' }} title="Eliminar">
                                                        <Trash2 size={14} />
                                                    </button>
                                                </div>
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>

            {/* Modal Form */}
            {showModal && (
                <div style={{ position: 'fixed', inset: 0, background: 'rgba(15, 23, 42, 0.6)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '1rem' }}>
                    <div style={{ background: '#ffffff', borderRadius: '16px', boxShadow: '0 20px 40px rgba(0,0,0,0.15)', width: '100%', maxWidth: 480, display: 'flex', flexDirection: 'column' }}>
                        <div style={{ padding: '1.25rem 1.5rem', borderBottom: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <h3 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '0.6rem', color: '#104166', fontSize: '1.1rem' }}>
                                <div style={{ background: '#eff6ff', padding: '0.4rem', borderRadius: '8px', display: 'flex' }}><Calculator size={18} style={{ color: '#2365AB' }} /></div>
                                {editingId ? 'Editar Registro de Gasto' : 'Nuevo Registro de Gasto'}
                            </h3>
                            <button onClick={closeForm} style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '50%', width: 30, height: 30, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: '#64748b' }}><X size={16} /></button>
                        </div>
                        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1rem', padding: '1.5rem', margin: 0 }}>
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                                <div>
                                    <label style={{ display: 'block', fontSize: '0.8rem', color: '#263777', fontWeight: 600, marginBottom: '0.4rem' }}>Categoría Principal</label>
                                    <select 
                                        value={form.tipo_gasto} 
                                        onChange={e => {
                                            const val = e.target.value;
                                            const subs = CATEGORIES_MAP[val] || [];
                                            setForm(f => ({ 
                                                ...f, 
                                                tipo_gasto: val, 
                                                subtipo_gasto: subs[0] || '',
                                                id_maquina: ''
                                            }));
                                        }} 
                                        required
                                        style={{ width: '100%', padding: '0.6rem 0.75rem', background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: 8, color: '#104166', fontSize: '0.85rem', outline: 'none', cursor: 'pointer' }}
                                    >
                                        {Object.keys(CATEGORIES_MAP).map(k => <option key={k}>{k}</option>)}
                                    </select>
                                </div>
                                <div>
                                    <label style={{ display: 'block', fontSize: '0.8rem', color: '#263777', fontWeight: 600, marginBottom: '0.4rem' }}>Subcategoría / Concepto</label>
                                    <select 
                                        value={form.subtipo_gasto} 
                                        onChange={e => setForm(f => ({ ...f, subtipo_gasto: e.target.value }))} 
                                        required
                                        style={{ width: '100%', padding: '0.6rem 0.75rem', background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: 8, color: '#104166', fontSize: '0.85rem', outline: 'none', cursor: 'pointer' }}
                                    >
                                        {(CATEGORIES_MAP[form.tipo_gasto] || []).map(sk => <option key={sk}>{sk}</option>)}
                                    </select>
                                </div>
                            </div>
                            
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                                <div>
                                    <label style={{ display: 'block', fontSize: '0.8rem', color: '#263777', fontWeight: 600, marginBottom: '0.4rem' }}>Fecha de Gasto</label>
                                    <input 
                                        type="date" 
                                        value={form.fecha_gasto} 
                                        onChange={e => setForm(f => ({ ...f, fecha_gasto: e.target.value }))} 
                                        required
                                        style={{ width: '100%', padding: '0.6rem 0.75rem', background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: 8, color: '#104166', fontSize: '0.85rem', outline: 'none', boxSizing: 'border-box' }} 
                                    />
                                </div>
                                <div>
                                    <label style={{ display: 'block', fontSize: '0.8rem', color: '#263777', fontWeight: 600, marginBottom: '0.4rem' }}>Costo ($)</label>
                                    <input 
                                        type="number" 
                                        min="0" 
                                        value={form.costo} 
                                        onChange={e => setForm(f => ({ ...f, costo: e.target.value }))} 
                                        placeholder="0" 
                                        required
                                        style={{ width: '100%', padding: '0.6rem 0.75rem', background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: 8, color: '#104166', fontSize: '0.85rem', outline: 'none', boxSizing: 'border-box' }} 
                                    />
                                </div>
                            </div>
                            
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                                <div>
                                    <label style={{ display: 'block', fontSize: '0.8rem', color: '#263777', fontWeight: 600, marginBottom: '0.4rem' }}>Proveedor / Beneficiario</label>
                                    <input 
                                        type="text" 
                                        value={form.proveedor_beneficiario} 
                                        onChange={e => setForm(f => ({ ...f, proveedor_beneficiario: e.target.value }))} 
                                        placeholder="A quién se pagó..."
                                        style={{ width: '100%', padding: '0.6rem 0.75rem', background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: 8, color: '#104166', fontSize: '0.85rem', outline: 'none', boxSizing: 'border-box' }} 
                                    />
                                </div>
                                <div>
                                    <label style={{ display: 'block', fontSize: '0.8rem', color: '#263777', fontWeight: 600, marginBottom: '0.4rem' }}>Referencia Soporte</label>
                                    <input 
                                        type="text" 
                                        value={form.referencia_soporte} 
                                        onChange={e => setForm(f => ({ ...f, referencia_soporte: e.target.value }))} 
                                        placeholder="Nº Factura, recibo, etc..."
                                        style={{ width: '100%', padding: '0.6rem 0.75rem', background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: 8, color: '#104166', fontSize: '0.85rem', outline: 'none', boxSizing: 'border-box' }} 
                                    />
                                </div>
                            </div>
                            
                            <div>
                                <label style={{ display: 'block', fontSize: '0.8rem', color: '#263777', fontWeight: 600, marginBottom: '0.4rem' }}>Descripción</label>
                                <textarea value={form.descripcion} onChange={e => setForm(f => ({ ...f, descripcion: e.target.value }))} required rows={3}
                                    placeholder="Detalles sobre el gasto..."
                                    style={{ width: '100%', padding: '0.6rem 0.75rem', background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: 8, color: '#104166', fontSize: '0.85rem', outline: 'none', resize: 'vertical', boxSizing: 'border-box' }} />
                            </div>
                            
                            <div style={{ padding: '1rem', background: '#f8fafc', borderTop: '1px solid #e2e8f0', borderRadius: '0 0 16px 16px', display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', margin: '0.5rem -1.5rem -1.5rem -1.5rem' }}>
                                <button type="button" className="btn btn-secondary" onClick={closeForm} style={{ background: '#ffffff', border: '1px solid #cbd5e1', color: '#263777' }}>Cancelar</button>
                                <button type="submit" className="btn btn-primary">{editingId ? 'Guardar Cambios' : 'Registrar Gasto'}</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </>
    );
}
