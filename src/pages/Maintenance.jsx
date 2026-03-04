import React, { useState } from 'react';
import { Wrench, Plus, CheckCircle, Clock, AlertTriangle, X } from 'lucide-react';
import { useAppContext } from '../context/AppContext';
import { format } from 'date-fns';

const STATUS_CONFIG = {
    'Completado': { color: '#10b981', Icon: CheckCircle },
    'En Proceso': { color: '#f97316', Icon: Clock },
    'Pendiente': { color: '#ef4444', Icon: AlertTriangle },
};

const TYPE_CONFIG = {
    'Preventivo': '#3b82f6',
    'Correctivo': '#ef4444',
    'Predictivo': '#8b5cf6',
};

export default function Maintenance() {
    const { maintenances, addMaintenance, products } = useAppContext();
    const [showModal, setShowModal] = useState(false);
    const [form, setForm] = useState({
        productId: '', type: 'Preventivo', description: '', status: 'Pendiente', cost: ''
    });

    // KPIs
    const completed = maintenances.filter(m => m.status === 'Completado').length;
    const inProgress = maintenances.filter(m => m.status === 'En Proceso').length;
    const pending = maintenances.filter(m => m.status === 'Pendiente').length;
    const totalCost = maintenances.reduce((s, m) => s + (Number(m.cost) || 0), 0);

    const handleSubmit = (e) => {
        e.preventDefault();
        addMaintenance({ ...form, cost: Number(form.cost) || 0 });
        setForm({ productId: '', type: 'Preventivo', description: '', status: 'Pendiente', cost: '' });
        setShowModal(false);
    };

    return (
        <>
            {/* Header */}
            <div className="flex justify-between items-center mb-6">
                <div>
                    <h1>Mantenimientos</h1>
                    <p className="text-muted">Registro de mantenimientos preventivos y correctivos</p>
                </div>
                <button className="btn btn-primary" onClick={() => setShowModal(true)}
                    style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                    <Plus size={16} /> Registrar Mantenimiento
                </button>
            </div>

            {/* KPI Cards */}
            <div className="grid-cards" style={{ gridTemplateColumns: 'repeat(4, 1fr)', marginBottom: '1.5rem' }}>
                <div className="stat-card green">
                    <div className="icon-wrapper green"><CheckCircle size={24} /></div>
                    <div>
                        <div className="stat-value">{completed}</div>
                        <div className="stat-label">Completados</div>
                    </div>
                </div>
                <div className="stat-card orange">
                    <div className="icon-wrapper orange"><Clock size={24} /></div>
                    <div>
                        <div className="stat-value">{inProgress}</div>
                        <div className="stat-label">En Proceso</div>
                    </div>
                </div>
                <div className="stat-card red">
                    <div className="icon-wrapper red"><AlertTriangle size={24} /></div>
                    <div>
                        <div className="stat-value">{pending}</div>
                        <div className="stat-label">Pendientes</div>
                    </div>
                </div>
                <div className="stat-card blue">
                    <div className="icon-wrapper blue"><Wrench size={24} /></div>
                    <div>
                        <div className="stat-value">${totalCost.toLocaleString()}</div>
                        <div className="stat-label">Costo Total</div>
                    </div>
                </div>
            </div>

            {/* Table */}
            <div className="glass-panel p-6">
                <h3 className="mb-4">Historial de Mantenimientos</h3>
                {maintenances.length === 0 ? (
                    <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-muted)' }}>
                        <Wrench size={48} style={{ opacity: 0.3, marginBottom: '1rem' }} />
                        <p>No hay mantenimientos registrados</p>
                    </div>
                ) : (
                    <div style={{ overflowX: 'auto' }}>
                        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                            <thead>
                                <tr style={{ borderBottom: '1px solid var(--surface-border)' }}>
                                    {['ID', 'Equipo', 'Tipo', 'Descripción', 'Estado', 'Fecha', 'Costo'].map(h => (
                                        <th key={h} style={{ padding: '0.75rem 1rem', textAlign: 'left', fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>{h}</th>
                                    ))}
                                </tr>
                            </thead>
                            <tbody>
                                {maintenances.map(m => {
                                    const product = products.find(p => p.id === m.productId);
                                    const { color, Icon } = STATUS_CONFIG[m.status] || STATUS_CONFIG['Pendiente'];
                                    return (
                                        <tr key={m.id} style={{ borderBottom: '1px solid var(--surface-border)', transition: 'background 0.15s' }}
                                            onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.03)'}
                                            onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                                            <td style={{ padding: '0.75rem 1rem', fontFamily: 'monospace', fontSize: '0.8rem', color: 'var(--text-muted)' }}>{m.id}</td>
                                            <td style={{ padding: '0.75rem 1rem', fontWeight: 500 }}>{product?.name || m.productId}</td>
                                            <td style={{ padding: '0.75rem 1rem' }}>
                                                <span style={{ padding: '0.2rem 0.6rem', borderRadius: 20, background: `${TYPE_CONFIG[m.type] || '#64748b'}22`, color: TYPE_CONFIG[m.type] || '#64748b', fontSize: '0.75rem', fontWeight: 600 }}>
                                                    {m.type}
                                                </span>
                                            </td>
                                            <td style={{ padding: '0.75rem 1rem', fontSize: '0.85rem', maxWidth: 220, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{m.description}</td>
                                            <td style={{ padding: '0.75rem 1rem' }}>
                                                <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.3rem', padding: '0.2rem 0.6rem', borderRadius: 20, background: `${color}22`, color, fontSize: '0.75rem', fontWeight: 600 }}>
                                                    <Icon size={12} /> {m.status}
                                                </span>
                                            </td>
                                            <td style={{ padding: '0.75rem 1rem', fontSize: '0.85rem', color: 'var(--text-muted)' }}>{m.date}</td>
                                            <td style={{ padding: '0.75rem 1rem', fontWeight: 600, color: '#10b981' }}>${(m.cost || 0).toLocaleString()}</td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>

            {/* Modal */}
            {showModal && (
                <div style={{ position: 'fixed', inset: 0, background: 'rgba(15, 23, 42, 0.6)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '1rem' }}>
                    <div style={{ background: '#ffffff', borderRadius: '16px', boxShadow: '0 20px 40px rgba(0,0,0,0.15)', width: '100%', maxWidth: 480, display: 'flex', flexDirection: 'column' }}>
                        <div style={{ padding: '1.25rem 1.5rem', borderBottom: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <h3 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '0.6rem', color: '#1e293b', fontSize: '1.1rem' }}>
                                <div style={{ background: '#eff6ff', padding: '0.4rem', borderRadius: '8px', display: 'flex' }}><Wrench size={18} style={{ color: '#3b82f6' }} /></div>
                                Nuevo Mantenimiento
                            </h3>
                            <button onClick={() => setShowModal(false)} style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '50%', width: 30, height: 30, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: '#64748b' }}><X size={16} /></button>
                        </div>
                        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1rem', padding: '1.5rem', margin: 0 }}>
                            <div>
                                <label style={{ display: 'block', fontSize: '0.8rem', color: '#475569', fontWeight: 600, marginBottom: '0.4rem' }}>Equipo</label>
                                <select value={form.productId} onChange={e => setForm(f => ({ ...f, productId: e.target.value }))} required
                                    style={{ width: '100%', padding: '0.6rem 0.75rem', background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: 8, color: '#1e293b', fontSize: '0.85rem', outline: 'none', cursor: 'pointer' }}>
                                    <option value="">Seleccionar equipo...</option>
                                    {products.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                                </select>
                            </div>
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                                <div>
                                    <label style={{ display: 'block', fontSize: '0.8rem', color: '#475569', fontWeight: 600, marginBottom: '0.4rem' }}>Tipo</label>
                                    <select value={form.type} onChange={e => setForm(f => ({ ...f, type: e.target.value }))}
                                        style={{ width: '100%', padding: '0.6rem 0.75rem', background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: 8, color: '#1e293b', fontSize: '0.85rem', outline: 'none', cursor: 'pointer' }}>
                                        <option>Preventivo</option>
                                        <option>Correctivo</option>
                                        <option>Predictivo</option>
                                    </select>
                                </div>
                                <div>
                                    <label style={{ display: 'block', fontSize: '0.8rem', color: '#475569', fontWeight: 600, marginBottom: '0.4rem' }}>Estado</label>
                                    <select value={form.status} onChange={e => setForm(f => ({ ...f, status: e.target.value }))}
                                        style={{ width: '100%', padding: '0.6rem 0.75rem', background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: 8, color: '#1e293b', fontSize: '0.85rem', outline: 'none', cursor: 'pointer' }}>
                                        <option>Pendiente</option>
                                        <option>En Proceso</option>
                                        <option>Completado</option>
                                    </select>
                                </div>
                            </div>
                            <div>
                                <label style={{ display: 'block', fontSize: '0.8rem', color: '#475569', fontWeight: 600, marginBottom: '0.4rem' }}>Descripción</label>
                                <textarea value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} required rows={3}
                                    placeholder="Descripción del mantenimiento..."
                                    style={{ width: '100%', padding: '0.6rem 0.75rem', background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: 8, color: '#1e293b', fontSize: '0.85rem', outline: 'none', resize: 'vertical', boxSizing: 'border-box' }} />
                            </div>
                            <div>
                                <label style={{ display: 'block', fontSize: '0.8rem', color: '#475569', fontWeight: 600, marginBottom: '0.4rem' }}>Costo ($)</label>
                                <input type="number" min="0" value={form.cost} onChange={e => setForm(f => ({ ...f, cost: e.target.value }))} placeholder="0"
                                    style={{ width: '100%', padding: '0.6rem 0.75rem', background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: 8, color: '#1e293b', fontSize: '0.85rem', outline: 'none', boxSizing: 'border-box' }} />
                            </div>
                            <div style={{ padding: '1rem', background: '#f8fafc', borderTop: '1px solid #e2e8f0', borderRadius: '0 0 16px 16px', display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', margin: '0.5rem -1.5rem -1.5rem -1.5rem' }}>
                                <button type="button" className="btn btn-secondary" onClick={() => setShowModal(false)} style={{ background: '#ffffff', border: '1px solid #cbd5e1', color: '#475569' }}>Cancelar</button>
                                <button type="submit" className="btn btn-primary">Guardar</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </>
    );
}
