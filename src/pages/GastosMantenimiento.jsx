import React, { useState } from 'react';
import { Calculator, Plus, Trash2, Edit3, X, TrendingUp, AlertTriangle, CheckCircle, Clock } from 'lucide-react';
import { useAppContext } from '../context/AppContext';
import { format } from 'date-fns';

const TIPO_CONFIG = {
    'Consumo': { color: '#06b6d4', label: 'Consumo' },
    'Mantenimiento Preventivo': { color: '#2365AB', label: 'Mantenimiento Preventivo' },
    'Reparación': { color: '#ef4444', label: 'Reparación' },
    'Repuestos': { color: '#8b5cf6', label: 'Repuestos' },
    'Otros': { color: '#64748b', label: 'Otros' }
};

export default function GastosMantenimiento() {
    const { 
        gastosMantenimiento, 
        addGastoMantenimiento, 
        editGastoMantenimiento, 
        deleteGastoMantenimiento, 
        products 
    } = useAppContext();

    const [showModal, setShowModal] = useState(false);
    const [editingId, setEditingId] = useState(null);
    const [form, setForm] = useState({
        id_maquina: '', 
        tipo_gasto: 'Mantenimiento Preventivo', 
        descripcion: '', 
        costo: '', 
        fecha_gasto: format(new Date(), 'yyyy-MM-dd')
    });
    
    const [search, setSearch] = useState('');

    // KPIs
    const totalGasto = gastosMantenimiento.reduce((s, g) => s + (Number(g.costo) || 0), 0);
    const totalRegistros = gastosMantenimiento.length;
    const gastoPromedio = totalRegistros > 0 ? Math.round(totalGasto / totalRegistros) : 0;
    const gastoReparaciones = gastosMantenimiento
        .filter(g => g.tipo_gasto === 'Reparación')
        .reduce((s, g) => s + (Number(g.costo) || 0), 0);

    // Filtered data
    const filteredGastos = gastosMantenimiento.filter(g => {
        const query = search.toLowerCase();
        const product = products.find(p => p.id === g.id_maquina);
        return (
            g.tipo_gasto.toLowerCase().includes(query) ||
            (g.descripcion && g.descripcion.toLowerCase().includes(query)) ||
            (product && product.name.toLowerCase().includes(query)) ||
            g.id.toLowerCase().includes(query)
        );
    });

    const handleSubmit = async (e) => {
        e.preventDefault();
        const payload = {
            id_maquina: form.id_maquina || null,
            tipo_gasto: form.tipo_gasto,
            descripcion: form.descripcion,
            costo: Number(form.costo) || 0,
            fecha_gasto: form.fecha_gasto
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
            tipo_gasto: gasto.tipo_gasto,
            descripcion: gasto.descripcion || '',
            costo: gasto.costo,
            fecha_gasto: format(new Date(gasto.fecha_gasto), 'yyyy-MM-dd')
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
            tipo_gasto: 'Mantenimiento Preventivo', 
            descripcion: '', 
            costo: '', 
            fecha_gasto: format(new Date(), 'yyyy-MM-dd')
        });
        setShowModal(false);
    };

    return (
        <>
            {/* Header */}
            <div className="flex justify-between items-center mb-6">
                <div>
                    <h1>Gastos de Mantenimiento</h1>
                    <p className="text-muted">Registro y control de egresos destinados al mantenimiento y consumo de equipos</p>
                </div>
                <button className="btn btn-primary" onClick={() => setShowModal(true)}
                    style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                    <Plus size={16} /> Registrar Gasto
                </button>
            </div>

            {/* KPI Cards */}
            <div className="grid-cards" style={{ gridTemplateColumns: 'repeat(4, 1fr)', marginBottom: '1.5rem', gap: '1rem' }}>
                <div className="stat-card blue">
                    <div className="icon-wrapper blue"><Calculator size={24} /></div>
                    <div>
                        <div className="stat-value">${totalGasto.toLocaleString()}</div>
                        <div className="stat-label">Gasto Total</div>
                    </div>
                </div>
                <div className="stat-card orange">
                    <div className="icon-wrapper orange"><TrendingUp size={24} /></div>
                    <div>
                        <div className="stat-value">{totalRegistros}</div>
                        <div className="stat-label">Total Transacciones</div>
                    </div>
                </div>
                <div className="stat-card purple">
                    <div className="icon-wrapper purple"><Clock size={24} /></div>
                    <div>
                        <div className="stat-value">${gastoPromedio.toLocaleString()}</div>
                        <div className="stat-label">Gasto Promedio</div>
                    </div>
                </div>
                <div className="stat-card red">
                    <div className="icon-wrapper red"><AlertTriangle size={24} /></div>
                    <div>
                        <div className="stat-value">${gastoReparaciones.toLocaleString()}</div>
                        <div className="stat-label">Gastos por Reparación</div>
                    </div>
                </div>
            </div>

            {/* Filters & Table */}
            <div className="glass-panel p-6">
                <div className="flex justify-between items-center mb-4 gap-4 flex-wrap">
                    <h3 style={{ margin: 0 }}>Historial de Egresos</h3>
                    <input 
                        type="text" 
                        placeholder="Buscar por tipo, máquina o descripción..." 
                        value={search}
                        onChange={e => setSearch(e.target.value)}
                        style={{
                            padding: '0.5rem 0.75rem',
                            borderRadius: '8px',
                            border: '1px solid var(--surface-border)',
                            background: '#ffffff',
                            color: 'var(--text-primary)',
                            fontSize: '0.85rem',
                            outline: 'none',
                            minWidth: '280px'
                        }}
                    />
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
                                    {['ID', 'Equipo Relacionado', 'Tipo de Gasto', 'Descripción', 'Costo', 'Fecha Gasto', 'Acciones'].map(h => (
                                        <th key={h} style={{ padding: '0.75rem 1rem', textAlign: 'left', fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>{h}</th>
                                    ))}
                                </tr>
                            </thead>
                            <tbody>
                                {filteredGastos.map(g => {
                                    const product = products.find(p => p.id === g.id_maquina);
                                    const config = TIPO_CONFIG[g.tipo_gasto] || TIPO_CONFIG['Otros'];
                                    return (
                                        <tr key={g.id} style={{ borderBottom: '1px solid var(--surface-border)', transition: 'background 0.15s' }}
                                            onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.03)'}
                                            onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                                            <td style={{ padding: '0.75rem 1rem', fontFamily: 'monospace', fontSize: '0.8rem', color: 'var(--text-muted)' }}>{g.id}</td>
                                            <td style={{ padding: '0.75rem 1rem', fontWeight: 500 }}>
                                                {product ? (
                                                    <span style={{ display: 'flex', flexDirection: 'column' }}>
                                                        <span>{product.name}</span>
                                                        <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontFamily: 'monospace' }}>ID: {product.id}</span>
                                                    </span>
                                                ) : (
                                                    <span style={{ color: 'var(--text-muted)', fontStyle: 'italic' }}>Gasto General (Sin Máquina)</span>
                                                )}
                                            </td>
                                            <td style={{ padding: '0.75rem 1rem' }}>
                                                <span style={{ padding: '0.2rem 0.6rem', borderRadius: 20, background: `${config.color}22`, color: config.color, fontSize: '0.75rem', fontWeight: 600, whiteSpace: 'nowrap' }}>
                                                    {config.label}
                                                </span>
                                            </td>
                                            <td style={{ padding: '0.75rem 1rem', fontSize: '0.85rem', maxWidth: 250, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={g.descripcion}>
                                                {g.descripcion || <span style={{ color: 'var(--text-muted)', fontStyle: 'italic' }}>Sin descripción</span>}
                                            </td>
                                            <td style={{ padding: '0.75rem 1rem', fontWeight: 600, color: 'var(--text-primary)' }}>
                                                ${(g.costo || 0).toLocaleString()}
                                            </td>
                                            <td style={{ padding: '0.75rem 1rem', fontSize: '0.85rem', color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>
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
                            <div>
                                <label style={{ display: 'block', fontSize: '0.8rem', color: '#263777', fontWeight: 600, marginBottom: '0.4rem' }}>Equipo Relacionado (Opcional)</label>
                                <select value={form.id_maquina} onChange={e => setForm(f => ({ ...f, id_maquina: e.target.value }))}
                                    style={{ width: '100%', padding: '0.6rem 0.75rem', background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: 8, color: '#104166', fontSize: '0.85rem', outline: 'none', cursor: 'pointer' }}>
                                    <option value="">Gasto General (Sin equipo específico)</option>
                                    {products.map(p => <option key={p.id} value={p.id}>{p.name} (ID: {p.id})</option>)}
                                </select>
                            </div>
                            
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                                <div>
                                    <label style={{ display: 'block', fontSize: '0.8rem', color: '#263777', fontWeight: 600, marginBottom: '0.4rem' }}>Tipo de Gasto</label>
                                    <select value={form.tipo_gasto} onChange={e => setForm(f => ({ ...f, tipo_gasto: e.target.value }))} required
                                        style={{ width: '100%', padding: '0.6rem 0.75rem', background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: 8, color: '#104166', fontSize: '0.85rem', outline: 'none', cursor: 'pointer' }}>
                                        {Object.keys(TIPO_CONFIG).map(k => <option key={k}>{k}</option>)}
                                    </select>
                                </div>
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
                            </div>
                            
                            <div>
                                <label style={{ display: 'block', fontSize: '0.8rem', color: '#263777', fontWeight: 600, marginBottom: '0.4rem' }}>Descripción</label>
                                <textarea value={form.descripcion} onChange={e => setForm(f => ({ ...f, descripcion: e.target.value }))} required rows={3}
                                    placeholder="Detalles sobre el gasto..."
                                    style={{ width: '100%', padding: '0.6rem 0.75rem', background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: 8, color: '#104166', fontSize: '0.85rem', outline: 'none', resize: 'vertical', boxSizing: 'border-box' }} />
                            </div>
                            
                            <div>
                                <label style={{ display: 'block', fontSize: '0.8rem', color: '#263777', fontWeight: 600, marginBottom: '0.4rem' }}>Costo ($)</label>
                                <input type="number" min="0" value={form.costo} onChange={e => setForm(f => ({ ...f, costo: e.target.value }))} placeholder="0" required
                                    style={{ width: '100%', padding: '0.6rem 0.75rem', background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: 8, color: '#104166', fontSize: '0.85rem', outline: 'none', boxSizing: 'border-box' }} />
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
