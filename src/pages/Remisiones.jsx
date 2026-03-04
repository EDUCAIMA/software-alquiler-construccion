import React, { useState, useMemo } from 'react';
import {
    Plus, Search, Truck, Package, RotateCcw, CheckCircle,
    AlertTriangle, Clock, X, ChevronRight, Filter, FileText,
    MapPin, ArrowDownCircle, Info
} from 'lucide-react';
import { useAppContext } from '../context/AppContext';
import { format, differenceInDays } from 'date-fns';

// ─── Constants ────────────────────────────────────────────────────────────────
const ESTADO_CFG = {
    'Activa': { color: '#3b82f6', bg: 'rgba(59,130,246,0.12)', Icon: Truck },
    'Parcial': { color: '#f97316', bg: 'rgba(249,115,22,0.12)', Icon: Clock },
    'Cerrada': { color: '#10b981', bg: 'rgba(16,185,129,0.12)', Icon: CheckCircle },
};

// ─── Helpers ──────────────────────────────────────────────────────────────────
const sField = (label, value, color) => (
    <div style={{ background: 'rgba(255,255,255,0.04)', borderRadius: 8, padding: '0.5rem 0.75rem' }}>
        <div style={{ fontSize: '0.63rem', color: '#94a3b8', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>{label}</div>
        <div style={{ fontSize: '0.9rem', fontWeight: 700, color: color || 'var(--text-primary)', marginTop: 2 }}>{value}</div>
    </div>
);

// ─── Modal: Nueva Remisión ────────────────────────────────────────────────────
function NuevaRemisionModal({ onClose, onSave, clients, products, maintenances }) {
    const [step, setStep] = useState(1);
    const [clientId, setClientId] = useState('');
    const [obraId, setObraId] = useState('');
    const [fecha, setFecha] = useState(format(new Date(), 'yyyy-MM-dd'));
    const [transporte, setTransporte] = useState(0);
    const [notas, setNotas] = useState('');
    const [items, setItems] = useState([]);
    const [selProd, setSelProd] = useState('');
    const [selCant, setSelCant] = useState(1);
    const [blockError, setBlockError] = useState('');

    const selectedClient = clients.find(c => c.id === clientId);
    const obrasDisp = selectedClient?.obras || [];

    const addItem = () => {
        if (!selProd || selCant < 1) return;
        const prod = products.find(p => p.id === selProd);
        if (!prod) return;
        // Check maintenance block
        const hasPending = maintenances.some(
            m => m.productId === selProd && (m.status === 'Pendiente' || m.status === 'En Proceso')
        );
        if (hasPending) {
            setBlockError(`⛔ BLOQUEO: "${prod.name}" tiene un mantenimiento pendiente o en proceso. Resuelva el mantenimiento antes de despachar.`);
            return;
        }
        if (selCant > prod.availableStock) {
            setBlockError(`Stock insuficiente. Disponible: ${prod.availableStock}`);
            return;
        }
        setBlockError('');
        const existing = items.findIndex(i => i.productId === selProd);
        if (existing >= 0) {
            const updated = [...items];
            updated[existing].cantidad += selCant;
            setItems(updated);
        } else {
            setItems(prev => [...prev, { productId: selProd, nombre: prod.name, cantidad: selCant, tarifaDia: prod.value }]);
        }
        setSelProd(''); setSelCant(1);
    };

    const removeItem = (idx) => setItems(items.filter((_, i) => i !== idx));

    const handleSave = () => {
        if (!clientId || !obraId || items.length === 0) return;
        onSave({ clientId, obraId, fecha, transporte: Number(transporte), notas, items });
        onClose();
    };

    const IS = { width: '100%', padding: '0.65rem 0.8rem', boxSizing: 'border-box', background: 'var(--background)', border: '1px solid var(--surface-border)', borderRadius: 8, color: 'var(--text-primary)', fontSize: '0.85rem', outline: 'none' };
    const SS = { ...IS, cursor: 'pointer' };

    return (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(15, 23, 42, 0.6)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '2rem 1rem 1rem 1rem' }}>
            <div style={{ background: '#ffffff', borderRadius: '16px', boxShadow: '0 20px 40px rgba(0,0,0,0.15)', width: '100%', maxWidth: 720, maxHeight: '85vh', display: 'flex', flexDirection: 'column', marginTop: '3vh' }}>
                {/* Header */}
                <div style={{ padding: '1.25rem 2rem', borderBottom: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div>
                        <h3 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '0.75rem', color: '#1e293b', fontSize: '1.2rem', marginBottom: '0.5rem' }}>
                            <div style={{ background: 'rgba(59,130,246,0.1)', padding: '0.5rem', borderRadius: '10px', display: 'flex' }}>
                                <Truck size={20} style={{ color: '#3b82f6' }} />
                            </div>
                            Nueva Remisión de Despacho
                        </h3>
                        {/* Step indicator */}
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                            {['Destino', 'Equipos', 'Confirmar'].map((s, i) => (
                                <React.Fragment key={s}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                                        <div style={{ width: 22, height: 22, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.7rem', fontWeight: 700, background: step > i + 1 ? '#10b981' : step === i + 1 ? '#3b82f6' : '#e2e8f0', color: step > i ? 'white' : '#64748b' }}>
                                            {step > i + 1 ? '✓' : i + 1}
                                        </div>
                                        <span style={{ fontSize: '0.75rem', color: step === i + 1 ? '#3b82f6' : '#64748b', fontWeight: step === i + 1 ? 700 : 500 }}>{s}</span>
                                    </div>
                                    {i < 2 && <div style={{ width: 24, height: 2, background: step > i + 1 ? '#10b981' : '#e2e8f0', borderRadius: 2 }} />}
                                </React.Fragment>
                            ))}
                        </div>
                    </div>
                    <button onClick={onClose} style={{ background: '#f1f5f9', border: 'none', borderRadius: '50%', width: 32, height: 32, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: '#64748b', transition: 'all 0.2s', alignSelf: 'flex-start' }} onMouseEnter={e => e.currentTarget.style.background = '#e2e8f0'} onMouseLeave={e => e.currentTarget.style.background = '#f1f5f9'}><X size={18} /></button>
                </div>

                <div style={{ padding: '1.5rem 2rem', overflowY: 'auto' }}>
                    {/* Step 1: Destino */}
                    {step === 1 && (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                            <div>
                                <label style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', fontWeight: 600, display: 'block', marginBottom: '0.4rem' }}>Cliente *</label>
                                <select value={clientId} onChange={e => { setClientId(e.target.value); setObraId(''); }} style={SS}>
                                    <option value="">— Seleccionar cliente —</option>
                                    {clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                                </select>
                            </div>
                            {selectedClient && (
                                <div>
                                    <label style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', fontWeight: 600, display: 'block', marginBottom: '0.4rem' }}>Obra / Destino *</label>
                                    <select value={obraId} onChange={e => setObraId(e.target.value)} style={SS}>
                                        <option value="">— Seleccionar obra —</option>
                                        {obrasDisp.map(o => <option key={o.id} value={o.id}>{o.nombre} – {o.ubicacion}</option>)}
                                    </select>
                                </div>
                            )}
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                                <div>
                                    <label style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', fontWeight: 600, display: 'block', marginBottom: '0.4rem' }}>Fecha de Despacho</label>
                                    <input type="date" value={fecha} onChange={e => setFecha(e.target.value)} style={IS} />
                                </div>
                                <div>
                                    <label style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', fontWeight: 600, display: 'block', marginBottom: '0.4rem' }}>Costo Transporte ($)</label>
                                    <input type="number" min="0" value={transporte} onChange={e => setTransporte(e.target.value)} style={IS} />
                                </div>
                            </div>
                            <div>
                                <label style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', fontWeight: 600, display: 'block', marginBottom: '0.4rem' }}>Notas</label>
                                <textarea value={notas} onChange={e => setNotas(e.target.value)} rows={3} placeholder="Instrucciones especiales, horario de entrega..."
                                    style={{ ...IS, resize: 'vertical' }} />
                            </div>
                            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '1rem', marginTop: '1rem' }}>
                                <button className="btn btn-secondary" onClick={onClose} style={{ minWidth: 120 }}>Cancelar</button>
                                <button className="btn btn-primary" disabled={!clientId || !obraId} onClick={() => setStep(2)} style={{ minWidth: 140, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem' }}>
                                    Siguiente <ChevronRight size={16} />
                                </button>
                            </div>
                        </div>
                    )}

                    {/* Step 2: Equipos */}
                    {step === 2 && (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                            {/* Client summary bar */}
                            <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 12, padding: '1rem', display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                                <div style={{ background: '#e0e7ff', padding: '0.4rem', borderRadius: '50%', display: 'flex' }}><MapPin size={16} style={{ color: '#4f46e5' }} /></div>
                                <span style={{ fontWeight: 700, fontSize: '0.9rem', color: '#1e293b' }}>{selectedClient?.name}</span>
                                <span style={{ color: '#64748b', fontSize: '0.85rem' }}>→ {obrasDisp.find(o => o.id === obraId)?.nombre}</span>
                            </div>

                            {/* Add item */}
                            <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 12, padding: '1.25rem' }}>
                                <div style={{ fontSize: '0.85rem', fontWeight: 700, color: '#1e293b', marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                    <Package size={16} color="#3b82f6" /> Agregar Equipo
                                </div>
                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 80px auto', gap: '1rem', alignItems: 'end' }}>
                                    <div>
                                        <label style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', fontWeight: 600, display: 'block', marginBottom: '0.4rem' }}>Equipo / Herramienta</label>
                                        <select value={selProd} onChange={e => { setSelProd(e.target.value); setBlockError(''); }} style={SS}>
                                            <option value="">Seleccionar...</option>
                                            {products.filter(p => p.availableStock > 0).map(p => (
                                                <option key={p.id} value={p.id}>{p.name} (Disp: {p.availableStock} | ${p.value.toLocaleString()}/día)</option>
                                            ))}
                                        </select>
                                    </div>
                                    <div>
                                        <label style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', fontWeight: 600, display: 'block', marginBottom: '0.4rem' }}>Cant.</label>
                                        <input type="number" min="1" value={selCant} onChange={e => setSelCant(Number(e.target.value) || 1)} style={IS} />
                                    </div>
                                    <button className="btn btn-primary" onClick={addItem} style={{ height: 42, padding: '0 1rem', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Plus size={18} /></button>
                                </div>
                                {blockError && (
                                    <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.5rem', marginTop: '1rem', background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 8, padding: '0.75rem' }}>
                                        <AlertTriangle size={16} style={{ color: '#ef4444', flexShrink: 0, marginTop: 1 }} />
                                        <span style={{ fontSize: '0.85rem', color: '#b91c1c', fontWeight: 500 }}>{blockError}</span>
                                    </div>
                                )}
                            </div>

                            {/* Items list */}
                            {items.length > 0 ? (
                                <div style={{ border: '1px solid #e2e8f0', borderRadius: 12, overflow: 'hidden' }}>
                                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
                                        <thead>
                                            <tr style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0' }}>
                                                {['Equipo', 'Cant.', 'Tarifa/día', 'Acción'].map(h => (
                                                    <th key={h} style={{ padding: '0.75rem 1rem', textAlign: 'left', fontSize: '0.7rem', color: '#64748b', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em' }}>{h}</th>
                                                ))}
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {items.map((item, idx) => (
                                                <tr key={idx} style={{ borderBottom: '1px solid #f1f5f9' }}>
                                                    <td style={{ padding: '0.75rem 1rem', fontWeight: 600, color: '#1e293b' }}>{item.nombre}</td>
                                                    <td style={{ padding: '0.75rem 1rem' }}>{item.cantidad}</td>
                                                    <td style={{ padding: '0.75rem 1rem', color: '#10b981', fontWeight: 500 }}>${item.tarifaDia?.toLocaleString()}</td>
                                                    <td style={{ padding: '0.75rem 1rem', textAlign: 'right' }}>
                                                        <button onClick={() => removeItem(idx)} style={{ background: '#fee2e2', border: 'none', cursor: 'pointer', color: '#ef4444', display: 'inline-flex', padding: '0.4rem', borderRadius: 6, transition: 'all 0.2s' }} onMouseEnter={e => e.currentTarget.style.background = '#fecaca'} onMouseLeave={e => e.currentTarget.style.background = '#fee2e2'}><X size={14} /></button>
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            ) : (
                                <div style={{ textAlign: 'center', padding: '2rem', color: '#94a3b8', border: '2px dashed #e2e8f0', borderRadius: 12, fontSize: '0.9rem', fontWeight: 500 }}>
                                    Agrega al menos un equipo a la remisión
                                </div>
                            )}

                            <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '1rem' }}>
                                <button className="btn btn-secondary" onClick={() => setStep(1)} style={{ minWidth: 120 }}>← Atrás</button>
                                <button className="btn btn-primary" disabled={items.length === 0} onClick={() => setStep(3)} style={{ minWidth: 140, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem' }}>Revisar <ChevronRight size={16} /></button>
                            </div>
                        </div>
                    )}

                    {/* Step 3: Confirmar */}
                    {step === 3 && (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                            {/* Summary boxes */}
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '1rem' }}>
                                {[
                                    ['Cliente', selectedClient?.name, '#3b82f6'],
                                    ['Obra', obrasDisp.find(o => o.id === obraId)?.nombre || obraId, '#f97316'],
                                    ['Fecha', fecha, '#10b981']
                                ].map(([k, v, c]) => (
                                    <div key={k} style={{ border: '1px solid #e2e8f0', borderRadius: 10, padding: '0.85rem' }}>
                                        <div style={{ fontSize: '0.7rem', color: '#64748b', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>{k}</div>
                                        <div style={{ fontWeight: 700, color: c, marginTop: 4, fontSize: '0.9rem' }}>{v}</div>
                                    </div>
                                ))}
                            </div>

                            <div style={{ border: '1px solid #e2e8f0', borderRadius: 12, overflow: 'hidden' }}>
                                <div style={{ background: '#f8fafc', padding: '0.85rem 1rem', fontSize: '0.75rem', fontWeight: 700, color: '#1e293b', textTransform: 'uppercase', borderBottom: '1px solid #e2e8f0' }}>
                                    Equipos a despachar
                                </div>
                                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
                                    <tbody>
                                        {items.map((item, idx) => (
                                            <tr key={idx} style={{ borderBottom: '1px solid #f1f5f9' }}>
                                                <td style={{ padding: '0.75rem 1rem', fontWeight: 600, color: '#1e293b' }}>{item.nombre}</td>
                                                <td style={{ padding: '0.75rem 1rem', color: '#64748b' }}>{item.cantidad} unidad(es)</td>
                                                <td style={{ padding: '0.75rem 1rem', fontWeight: 500, color: '#10b981', textAlign: 'right' }}>${(item.tarifaDia * item.cantidad).toLocaleString()}/día</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>

                            {transporte > 0 && (
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#fff7ed', border: '1px solid #ffedd5', borderRadius: 10, padding: '1rem 1.25rem' }}>
                                    <span style={{ fontSize: '0.85rem', color: '#9a3412', fontWeight: 600 }}>Costo de Transporte</span>
                                    <span style={{ fontWeight: 800, color: '#f97316', fontSize: '1.05rem' }}>${Number(transporte).toLocaleString()}</span>
                                </div>
                            )}

                            {notas && (
                                <div style={{ display: 'flex', gap: '0.75rem', background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 10, padding: '1rem' }}>
                                    <Info size={16} style={{ color: '#64748b', flexShrink: 0, marginTop: 2 }} />
                                    <span style={{ fontSize: '0.85rem', color: '#475569', lineHeight: 1.5 }}>{notas}</span>
                                </div>
                            )}

                            <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '1rem' }}>
                                <button className="btn btn-secondary" onClick={() => setStep(2)} style={{ minWidth: 120 }}>← Atrás</button>
                                <button className="btn btn-primary" onClick={handleSave} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem', minWidth: 180 }}>
                                    <Truck size={18} /> Despachar Remisión
                                </button>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}

// ─── Modal: Devolución PEPS ───────────────────────────────────────────────────
function DevolucionModal({ clientId, obraId, onClose, onSave, remisiones, products, clients }) {
    const client = clients.find(c => c.id === clientId);
    const obra = client?.obras?.find(o => o.id === obraId);

    // Construir totales en campo por producto (de remisiones activas/parciales)
    const enCampo = useMemo(() => {
        const map = {};
        remisiones
            .filter(r => r.clientId === clientId && r.obraId === obraId && (r.estado === 'Activa' || r.estado === 'Parcial'))
            .forEach(r => {
                r.items.forEach(item => {
                    const pend = item.cantidad - item.cantidadDevuelta;
                    if (pend > 0) map[item.productId] = (map[item.productId] || 0) + pend;
                });
            });
        return Object.entries(map).map(([productId, cantidad]) => {
            const prod = products.find(p => p.id === productId);
            return { productId, nombre: prod?.name || productId, enCampo: cantidad, aDevolver: 0 };
        });
    }, [remisiones, clientId, obraId, products]);

    const [quantities, setQuantities] = useState(() => Object.fromEntries(enCampo.map(i => [i.productId, 0])));
    const [fechaDevolucion] = useState(format(new Date(), 'yyyy-MM-dd'));

    const setQ = (productId, val) => {
        const item = enCampo.find(i => i.productId === productId);
        setQuantities(prev => ({ ...prev, [productId]: Math.min(Number(val) || 0, item?.enCampo || 0) }));
    };

    const totalADevolver = Object.values(quantities).reduce((s, v) => s + v, 0);

    // PEPS simulation for display
    const pepsPreview = useMemo(() => {
        const preview = [];
        const rems = remisiones
            .filter(r => r.clientId === clientId && r.obraId === obraId && (r.estado === 'Activa' || r.estado === 'Parcial'))
            .sort((a, b) => a.fecha.localeCompare(b.fecha));

        const workQuantities = { ...quantities };

        for (const rem of rems) {
            const remItems = [];
            for (const item of rem.items) {
                if (!workQuantities[item.productId]) continue;
                const pendiente = item.cantidad - item.cantidadDevuelta;
                if (pendiente <= 0) continue;
                const descuento = Math.min(workQuantities[item.productId], pendiente);
                if (descuento > 0) {
                    remItems.push({ nombre: products.find(p => p.id === item.productId)?.name || item.productId, descuento, pendiente });
                    workQuantities[item.productId] -= descuento;
                }
            }
            if (remItems.length > 0) {
                const totalRem = rem.items.reduce((s, i) => s + i.cantidad, 0);
                const totalDev = rem.items.reduce((s, i) => s + i.cantidadDevuelta, 0) + remItems.reduce((s, i) => s + i.descuento, 0);
                preview.push({ id: rem.id, fecha: rem.fecha, items: remItems, seCierra: totalDev >= totalRem });
            }
        }
        return preview;
    }, [quantities, remisiones, clientId, obraId, products]);

    const handleSave = () => {
        const devoluciones = Object.entries(quantities)
            .filter(([, v]) => v > 0)
            .map(([productId, cantidad]) => ({ productId, cantidad }));
        if (devoluciones.length === 0) return;
        onSave(devoluciones);
        onClose();
    };

    const inputStyle = { width: '100%', padding: '0.55rem 0.75rem', background: '#ffffff', border: '1px solid #cbd5e1', borderRadius: '8px', color: '#1e293b', fontSize: '0.875rem', textAlign: 'center', boxSizing: 'border-box', outline: 'none' };

    return (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(15, 23, 42, 0.6)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'flex-start', justifyContent: 'center', zIndex: 1100, padding: '1rem' }}>
            <div style={{ background: '#ffffff', borderRadius: '16px', boxShadow: '0 20px 40px rgba(0,0,0,0.15)', width: '100%', maxWidth: 650, maxHeight: '85vh', display: 'flex', flexDirection: 'column', marginTop: '6vh', transition: 'height 0.2s ease-out' }}>
                {/* Header */}
                <div style={{ padding: '1.25rem 2rem', borderBottom: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                        <div style={{ background: 'rgba(249,115,22,0.1)', padding: '0.6rem', borderRadius: '12px', display: 'flex' }}>
                            <RotateCcw size={22} style={{ color: '#f97316' }} />
                        </div>
                        <div>
                            <h3 style={{ margin: 0, color: '#1e293b', fontSize: '1.15rem' }}>Registrar Devolución — Lógica PEPS</h3>
                            <div style={{ fontSize: '0.8rem', color: '#64748b', marginTop: '0.2rem', fontWeight: 500 }}>
                                Cliente: <span style={{ color: '#1e293b', fontWeight: 600 }}>{client?.name}</span> &nbsp;→&nbsp; Obra: <span style={{ color: '#1e293b', fontWeight: 600 }}>{obra?.nombre}</span>
                            </div>
                        </div>
                    </div>
                    <button onClick={onClose} style={{ background: '#f1f5f9', border: 'none', borderRadius: '50%', width: 32, height: 32, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: '#64748b', transition: 'all 0.2s', alignSelf: 'flex-start' }} onMouseEnter={e => e.currentTarget.style.background = '#e2e8f0'} onMouseLeave={e => e.currentTarget.style.background = '#f1f5f9'}><X size={18} /></button>
                </div>

                <div style={{ padding: '1.5rem 2rem', overflowY: 'auto', flex: 1 }}>
                    {enCampo.length === 0 ? (
                        <div style={{ textAlign: 'center', padding: '3rem 2rem', color: '#94a3b8', border: '2px dashed #cbd5e1', borderRadius: '12px', background: '#f8fafc' }}>
                            <Package size={32} style={{ opacity: 0.4, margin: '0 auto 0.75rem auto', display: 'block' }} />
                            <div style={{ fontSize: '0.95rem', fontWeight: 600, color: '#64748b' }}>No hay equipos activos en esta obra.</div>
                            <div style={{ fontSize: '0.8rem', marginTop: '0.3rem' }}>Todos los equipos despachados ya han sido devueltos.</div>
                        </div>
                    ) : (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                            {/* Quantities to return */}
                            <div>
                                <h4 style={{ margin: 0, fontSize: '0.85rem', color: '#f97316', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.75rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                                    <ArrowDownCircle size={16} /> Ingresa cantidad a devolver por equipo
                                </h4>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                                    {enCampo.map(item => (
                                        <div key={item.productId} style={{ display: 'grid', gridTemplateColumns: '1fr auto 90px', gap: '1rem', alignItems: 'center', background: '#f8fafc', borderRadius: '10px', padding: '0.75rem 1.25rem', border: '1px solid #e2e8f0', transition: 'all 0.2s', ...(quantities[item.productId] > 0 ? { borderColor: '#f97316', background: 'rgba(249,115,22,0.03)' } : {}) }}>
                                            <div style={{ fontWeight: 700, fontSize: '0.9rem', color: '#1e293b' }}>{item.nombre}</div>
                                            <div style={{ fontSize: '0.75rem', padding: '0.2rem 0.6rem', borderRadius: '6px', background: '#e0e7ff', color: '#4f46e5', fontWeight: 700 }}>{item.enCampo} en campo</div>
                                            <input type="number" min="0" max={item.enCampo} value={quantities[item.productId] || ''} onChange={e => setQ(item.productId, e.target.value)} style={{ ...inputStyle, borderColor: quantities[item.productId] > 0 ? '#f97316' : '#cbd5e1' }} placeholder="0" />
                                        </div>
                                    ))}
                                </div>
                            </div>

                            {/* PEPS Preview */}
                            {pepsPreview.length > 0 && (
                                <div style={{ background: '#fff7ed', border: '1px solid #fed7aa', borderRadius: '12px', padding: '1.25rem', marginTop: '0.5rem' }}>
                                    <h4 style={{ margin: 0, fontSize: '0.75rem', color: '#9a3412', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                                        <FileText size={15} /> Resultado PEPS — Remisiones afectadas
                                    </h4>
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
                                        {pepsPreview.map(p => (
                                            <div key={p.id} style={{ background: '#ffffff', borderRadius: '8px', padding: '0.75rem 1rem', border: '1px solid #fdba74', borderLeft: `4px solid ${p.seCierra ? '#10b981' : '#f97316'}`, boxShadow: '0 1px 2px rgba(0,0,0,0.02)' }}>
                                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                                                    <span style={{ fontWeight: 800, fontSize: '0.85rem', fontFamily: 'monospace', color: '#ea580c' }}>{p.id}</span>
                                                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                                                        <span style={{ fontSize: '0.75rem', color: '#64748b', fontWeight: 600 }}>{p.fecha}</span>
                                                        {p.seCierra && <span style={{ fontSize: '0.65rem', padding: '0.15rem 0.4rem', borderRadius: '4px', background: '#dcfce7', color: '#166534', fontWeight: 800 }}>✓ SE CIERRA</span>}
                                                    </div>
                                                </div>
                                                {p.items.map((it, i) => (
                                                    <div key={i} style={{ fontSize: '0.8rem', color: '#475569', display: 'flex', alignItems: 'center', gap: '0.3rem', marginTop: '0.2rem' }}>
                                                        <span style={{ color: '#cbd5e1' }}>└</span>
                                                        <span style={{ fontWeight: 600, color: '#1e293b' }}>{it.nombre}:</span>
                                                        devuelve <strong style={{ color: '#ea580c' }}>{it.descuento}</strong> de {it.pendiente}
                                                    </div>
                                                ))}
                                            </div>
                                        ))}
                                    </div>
                                    <p style={{ fontSize: '0.7rem', color: '#9a3412', marginTop: '1rem', textAlign: 'center', fontStyle: 'italic' }}>
                                        La Lógica PEPS asegura que los equipos devueltos se descuenten primero de las remisiones más antiguas.
                                    </p>
                                </div>
                            )}
                        </div>
                    )}
                </div>

                <div style={{ padding: '1.25rem 2rem', background: '#f8fafc', borderTop: '1px solid #e2e8f0', display: 'flex', gap: '1rem', justifyContent: 'space-between', alignItems: 'center', borderBottomLeftRadius: '16px', borderBottomRightRadius: '16px' }}>
                    <div style={{ fontSize: '0.85rem', color: '#64748b', fontWeight: 600 }}>
                        Total a devolver: <span style={{ color: '#1e293b', fontWeight: 800, fontSize: '1rem' }}>{totalADevolver}</span> ud(s)
                    </div>
                    <div style={{ display: 'flex', gap: '0.75rem' }}>
                        <button className="btn btn-secondary" onClick={onClose} style={{ minWidth: 100 }}>Cancelar</button>
                        <button className="btn btn-primary" disabled={totalADevolver === 0} onClick={handleSave}
                            style={{ background: totalADevolver === 0 ? '#cbd5e1' : '#f97316', border: 'none', display: 'flex', alignItems: 'center', gap: '0.4rem', boxShadow: totalADevolver === 0 ? 'none' : '0 4px 14px rgba(249,115,22,0.3)', color: 'white', fontWeight: 600, padding: '0.6rem 1.25rem', borderRadius: '8px', cursor: totalADevolver === 0 ? 'not-allowed' : 'pointer', transition: 'all 0.2s' }}>
                            <RotateCcw size={16} /> Procesar Devolución
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}

// ─── MAIN COMPONENT ───────────────────────────────────────────────────────────
export default function Remisiones() {
    const { clients, products, remisiones, addRemision, registrarDevolucion, maintenances } = useAppContext();

    const [search, setSearch] = useState('');
    const [filterEstado, setFilterEstado] = useState('Todos');
    const [filterClient, setFilterClient] = useState('');
    const [showNueva, setShowNueva] = useState(false);
    const [devolucionTarget, setDevolucionTarget] = useState(null); // { clientId, obraId }
    const [blockMsg, setBlockMsg] = useState('');

    // KPIs
    const activas = remisiones.filter(r => r.estado === 'Activa').length;
    const parciales = remisiones.filter(r => r.estado === 'Parcial').length;
    const cerradas = remisiones.filter(r => r.estado === 'Cerrada').length;
    const totalTransporte = remisiones.reduce((s, r) => s + (r.transporte || 0), 0);
    const totalEquiposEnCampo = useMemo(() => {
        let total = 0;
        remisiones.filter(r => r.estado !== 'Cerrada').forEach(r => {
            r.items.forEach(item => { total += item.cantidad - item.cantidadDevuelta; });
        });
        return total;
    }, [remisiones]);

    // Filtered
    const filtered = useMemo(() => {
        return remisiones.filter(r => {
            const client = clients.find(c => c.id === r.clientId);
            const obra = client?.obras?.find(o => o.id === r.obraId);
            const q = search.toLowerCase();
            const matchQ = r.id.toLowerCase().includes(q) || client?.name?.toLowerCase().includes(q) || obra?.nombre?.toLowerCase().includes(q);
            const matchE = filterEstado === 'Todos' || r.estado === filterEstado;
            const matchC = !filterClient || r.clientId === filterClient;
            return matchQ && matchE && matchC;
        }).sort((a, b) => b.fecha.localeCompare(a.fecha));
    }, [remisiones, search, filterEstado, filterClient, clients]);

    const handleSaveRemision = (data) => {
        try {
            setBlockMsg('');
            addRemision(data);
        } catch (e) {
            setBlockMsg(e.message);
        }
    };

    const inputStyle = {
        padding: '0.55rem 0.75rem', background: 'rgba(255,255,255,0.06)',
        border: '1px solid var(--surface-border)', borderRadius: 8,
        color: 'var(--text-primary)', fontSize: '0.875rem', outline: 'none',
    };

    return (
        <>
            {/* Page Header */}
            <div className="flex justify-between items-center mb-6">
                <div>
                    <h1>Remisiones</h1>
                    <p className="text-muted">Control de despachos, devoluciones y lógica PEPS</p>
                </div>
                <button className="btn btn-primary" onClick={() => setShowNueva(true)} style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                    <Plus size={18} /> Nueva Remisión
                </button>
            </div>

            {/* Block Message */}
            {blockMsg && (
                <div style={{ display: 'flex', gap: '0.75rem', background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: 10, padding: '1rem 1.25rem', marginBottom: '1.25rem' }}>
                    <AlertTriangle size={18} style={{ color: '#ef4444', flexShrink: 0, marginTop: 2 }} />
                    <div>
                        <div style={{ fontWeight: 700, color: '#ef4444', marginBottom: 2 }}>Despacho Bloqueado</div>
                        <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>{blockMsg}</div>
                    </div>
                    <button onClick={() => setBlockMsg('')} style={{ marginLeft: 'auto', background: 'none', border: 'none', cursor: 'pointer', color: '#ef4444', display: 'flex', alignSelf: 'flex-start' }}><X size={16} /></button>
                </div>
            )}

            {/* KPIs */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '1rem', marginBottom: '1.5rem' }}>
                <div className="stat-card blue">
                    <div className="icon-wrapper blue"><Truck size={20} /></div>
                    <div><div className="stat-value">{activas}</div><div className="stat-label">Remisiones Activas</div></div>
                </div>
                <div className="stat-card orange">
                    <div className="icon-wrapper orange"><Clock size={20} /></div>
                    <div><div className="stat-value">{parciales}</div><div className="stat-label">Devol. Parcial</div></div>
                </div>
                <div className="stat-card green">
                    <div className="icon-wrapper green"><CheckCircle size={20} /></div>
                    <div><div className="stat-value">{cerradas}</div><div className="stat-label">Cerradas</div></div>
                </div>
                <div className="stat-card blue">
                    <div className="icon-wrapper blue"><Package size={20} /></div>
                    <div><div className="stat-value">{totalEquiposEnCampo}</div><div className="stat-label">Equipos en Campo</div></div>
                </div>
                <div className="stat-card orange">
                    <div className="icon-wrapper orange"><Truck size={20} /></div>
                    <div><div className="stat-value">${totalTransporte.toLocaleString()}</div><div className="stat-label">Costo Transporte</div></div>
                </div>
            </div>

            {/* Filters */}
            <div className="glass-panel p-6 mb-6" style={{ display: 'flex', gap: '0.75rem', alignItems: 'center', flexWrap: 'wrap' }}>
                <div style={{ position: 'relative', flex: 1, minWidth: 200 }}>
                    <Search size={15} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                    <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Buscar por ID, cliente u obra…"
                        style={{ ...inputStyle, paddingLeft: '2rem', width: '100%', boxSizing: 'border-box' }} />
                </div>
                <select value={filterEstado} onChange={e => setFilterEstado(e.target.value)} style={{ ...inputStyle, minWidth: 140 }}>
                    <option>Todos</option><option>Activa</option><option>Parcial</option><option>Cerrada</option>
                </select>
                <select value={filterClient} onChange={e => setFilterClient(e.target.value)} style={{ ...inputStyle, minWidth: 180 }}>
                    <option value="">Todos los clientes</option>
                    {clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
                <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>{filtered.length} registro(s)</span>
            </div>

            {/* Table */}
            <div className="glass-panel p-6">
                <div style={{ overflowX: 'auto' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                        <thead>
                            <tr style={{ borderBottom: '1px solid var(--surface-border)' }}>
                                {['ID', 'Cliente / Obra', 'Fecha', 'Equipos', 'Transporte', 'Estado', 'Días activo', 'Acciones'].map(h => (
                                    <th key={h} style={{ padding: '0.75rem 0.85rem', textAlign: 'left', fontSize: '0.7rem', color: 'var(--text-muted)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', whiteSpace: 'nowrap' }}>{h}</th>
                                ))}
                            </tr>
                        </thead>
                        <tbody>
                            {filtered.map(rem => {
                                const client = clients.find(c => c.id === rem.clientId);
                                const obra = client?.obras?.find(o => o.id === rem.obraId);
                                const cfg = ESTADO_CFG[rem.estado] || ESTADO_CFG['Activa'];
                                const dias = rem.estado !== 'Cerrada' ? differenceInDays(new Date(), new Date(rem.fecha)) : '—';
                                const totalItems = rem.items.reduce((s, i) => s + i.cantidad, 0);
                                const totalDev = rem.items.reduce((s, i) => s + i.cantidadDevuelta, 0);
                                const canReturn = rem.estado !== 'Cerrada';
                                return (
                                    <tr key={rem.id} style={{ borderBottom: '1px solid var(--surface-border)' }}
                                        onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.02)'}
                                        onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                                    >
                                        <td style={{ padding: '0.85rem', fontWeight: 700, fontFamily: 'monospace', color: '#3b82f6', fontSize: '0.82rem' }}>{rem.id}</td>
                                        <td style={{ padding: '0.85rem' }}>
                                            <div style={{ fontWeight: 700, fontSize: '0.875rem' }}>{client?.name || rem.clientId}</div>
                                            <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: 3 }}>
                                                <MapPin size={10} /> {obra?.nombre || rem.obraId}
                                            </div>
                                        </td>
                                        <td style={{ padding: '0.85rem', color: 'var(--text-muted)', fontSize: '0.82rem' }}>{rem.fecha}</td>
                                        <td style={{ padding: '0.85rem' }}>
                                            <div style={{ fontSize: '0.82rem' }}>{totalItems} unds. / {totalDev} devueltas</div>
                                            <div style={{ height: 4, background: 'var(--surface-border)', borderRadius: 999, width: 80, marginTop: 4, overflow: 'hidden' }}>
                                                <div style={{ height: '100%', width: `${totalItems > 0 ? Math.round(totalDev / totalItems * 100) : 0}%`, background: '#10b981', borderRadius: 999 }} />
                                            </div>
                                        </td>
                                        <td style={{ padding: '0.85rem', fontWeight: 600, color: '#f97316' }}>
                                            {rem.transporte > 0 ? `$${rem.transporte.toLocaleString()}` : '—'}
                                        </td>
                                        <td style={{ padding: '0.85rem' }}>
                                            <span style={{ padding: '3px 10px', borderRadius: 999, background: cfg.bg, color: cfg.color, fontWeight: 700, fontSize: '0.72rem', border: `1px solid ${cfg.color}30` }}>
                                                {rem.estado}
                                            </span>
                                        </td>
                                        <td style={{ padding: '0.85rem', fontWeight: 600, color: rem.estado !== 'Cerrada' && dias > 30 ? '#ef4444' : 'var(--text-primary)' }}>
                                            {rem.estado !== 'Cerrada' ? `${dias}d` : '—'}
                                        </td>
                                        <td style={{ padding: '0.85rem' }}>
                                            {canReturn && (
                                                <button
                                                    onClick={() => setDevolucionTarget({ clientId: rem.clientId, obraId: rem.obraId })}
                                                    className="btn btn-secondary btn-sm"
                                                    style={{ fontSize: '0.75rem', display: 'flex', alignItems: 'center', gap: 4 }}>
                                                    <RotateCcw size={13} /> Devolución
                                                </button>
                                            )}
                                        </td>
                                    </tr>
                                );
                            })}
                            {filtered.length === 0 && (
                                <tr><td colSpan={8} style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-muted)' }}>No se encontraron remisiones</td></tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Modals */}
            {showNueva && (
                <NuevaRemisionModal
                    onClose={() => { setShowNueva(false); }}
                    onSave={handleSaveRemision}
                    clients={clients}
                    products={products}
                    maintenances={maintenances}
                />
            )}
            {devolucionTarget && (
                <DevolucionModal
                    {...devolucionTarget}
                    remisiones={remisiones}
                    products={products}
                    clients={clients}
                    onClose={() => setDevolucionTarget(null)}
                    onSave={(devoluciones) => registrarDevolucion(devolucionTarget.clientId, devolucionTarget.obraId, devoluciones)}
                />
            )}
        </>
    );
}
