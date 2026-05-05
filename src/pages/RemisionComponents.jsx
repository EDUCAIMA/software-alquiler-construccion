import React, { useState } from 'react';
import { Truck, Clock, CheckCircle, AlertTriangle, X, ChevronRight, Package, Plus, MapPin, Info, Printer, Check } from 'lucide-react';
import { format } from 'date-fns';
import { generateRemisionPDF } from './CotizacionesHelpers';

export const ESTADO_CFG = {
    'Activa': { color: '#2365AB', bg: 'rgba(35, 101, 171,0.12)', Icon: Truck },
    'Parcial': { color: '#f97316', bg: 'rgba(249,115,22,0.12)', Icon: Clock },
    'Cerrada': { color: '#10b981', bg: 'rgba(16,185,129,0.12)', Icon: CheckCircle },
    'Pendiente': { color: '#6366f1', bg: 'rgba(99, 102, 241, 0.12)', Icon: AlertTriangle },
    'Cancelada': { color: '#ef4444', bg: 'rgba(239, 68, 68, 0.12)', Icon: X },
};

export function NuevaRemisionModal({ onClose, onSave, clients, products, maintenances, facturaPreload, settings, initialClientId }) {
    const [step, setStep] = useState(facturaPreload ? 2 : 1);
    const [loading, setLoading] = useState(false);
    const [createdRem, setCreatedRem] = useState(null);
    const [clientId, setClientId] = useState(initialClientId || facturaPreload?.clientId || '');
    const [obraId, setObraId] = useState(facturaPreload?.obraId || '');
    const [fecha, setFecha] = useState(format(new Date(), 'yyyy-MM-dd'));
    const [transporte, setTransporte] = useState(0);
    const [notas, setNotas] = useState('');
    const [items, setItems] = useState(() => {
        if (facturaPreload?.items) {
            return facturaPreload.items.map(i => ({
                productId: i.productId,
                nombre: products.find(p => p.id === i.productId)?.name || i.nombre || i.name || i.productId,
                cantidad: i.quantity || i.cantidad || 0,
                tarifaDia: i.price || i.tarifaDia || 0,
            }));
        }
        return [];
    });
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

    const handleSave = async () => {
        if (!clientId || !obraId || items.length === 0) return;
        setLoading(true);
        try {
            const rem = await onSave({ clientId, obraId, fecha, transporte: Number(transporte), notas, items });
            setCreatedRem(rem);
            setStep(4);
        } catch (e) {
            console.error(e);
        } finally {
            setLoading(false);
        }
    };

    const IS = { width: '100%', padding: '0.65rem 0.8rem', boxSizing: 'border-box', background: 'var(--background)', border: '1px solid var(--surface-border)', borderRadius: 8, color: 'var(--text-primary)', fontSize: '0.85rem', outline: 'none' };
    const SS = { ...IS, cursor: 'pointer' };

    return (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(15, 23, 42, 0.6)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 2000, padding: '2rem 1rem 1rem 1rem' }}>
            <div style={{ background: '#ffffff', borderRadius: '16px', boxShadow: '0 20px 40px rgba(0,0,0,0.15)', width: '100%', maxWidth: 720, maxHeight: '85vh', display: 'flex', flexDirection: 'column', marginTop: '3vh' }}>
                {/* Header */}
                <div style={{ padding: '1.25rem 2rem', borderBottom: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div>
                        <h3 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '0.75rem', color: '#104166', fontSize: '1.2rem', marginBottom: '0.5rem' }}>
                            <div style={{ background: 'rgba(35, 101, 171,0.1)', padding: '0.5rem', borderRadius: '10px', display: 'flex' }}>
                                <Truck size={20} style={{ color: '#2365AB' }} />
                            </div>
                            Nueva Remisión de Despacho
                        </h3>
                        {/* Step indicator */}
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                            {['Destino', 'Equipos', 'Confirmar', 'Imprimir'].map((s, i) => (
                                <React.Fragment key={s}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                                        <div style={{ width: 22, height: 22, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.7rem', fontWeight: 700, background: step > i + 1 ? '#10b981' : step === i + 1 ? '#2365AB' : '#e2e8f0', color: step > i ? 'white' : '#64748b' }}>
                                            {step > i + 1 ? '✓' : i + 1}
                                        </div>
                                        <span style={{ fontSize: '0.75rem', color: step === i + 1 ? '#2365AB' : '#64748b', fontWeight: step === i + 1 ? 700 : 500 }}>{s}</span>
                                    </div>
                                    {i < 3 && <div style={{ width: 24, height: 2, background: step > i + 1 ? '#10b981' : '#e2e8f0', borderRadius: 2 }} />}
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
                                <select value={clientId} onChange={e => { setClientId(e.target.value); setObraId(''); }} style={SS} disabled={!!initialClientId}>
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
                                <span style={{ fontWeight: 700, fontSize: '0.9rem', color: '#104166' }}>{selectedClient?.name}</span>
                                <span style={{ color: '#64748b', fontSize: '0.85rem' }}>→ {obrasDisp.find(o => o.id === obraId)?.nombre}</span>
                            </div>

                            {/* Add item */}
                            <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 12, padding: '1.25rem' }}>
                                <div style={{ fontSize: '0.85rem', fontWeight: 700, color: '#104166', marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                    <Package size={16} color="#2365AB" /> Agregar Equipo
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
                                                    <td style={{ padding: '0.75rem 1rem', fontWeight: 600, color: '#104166' }}>{item.nombre}</td>
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
                                    ['Cliente', selectedClient?.name, '#2365AB'],
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
                                <div style={{ background: '#f8fafc', padding: '0.85rem 1rem', fontSize: '0.75rem', fontWeight: 700, color: '#104166', textTransform: 'uppercase', borderBottom: '1px solid #e2e8f0' }}>
                                    Equipos a despachar
                                </div>
                                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
                                    <tbody>
                                        {items.map((item, idx) => (
                                            <tr key={idx} style={{ borderBottom: '1px solid #f1f5f9' }}>
                                                <td style={{ padding: '0.75rem 1rem', fontWeight: 600, color: '#104166' }}>{item.nombre}</td>
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
                                    <span style={{ fontSize: '0.85rem', color: '#263777', lineHeight: 1.5 }}>{notas}</span>
                                </div>
                            )}

                            <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '1rem' }}>
                                <button className="btn btn-secondary" onClick={() => setStep(2)} style={{ minWidth: 120 }}>← Atrás</button>
                                <button className="btn btn-primary" disabled={items.length === 0 || loading} onClick={handleSave} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem', minWidth: 180 }}>
                                    {loading ? 'Procesando...' : <><Truck size={18} /> Despachar Remisión</>}
                                </button>
                            </div>
                        </div>
                    )}

                    {/* Step 4: Finalizado / Imprimir */}
                    {step === 4 && (
                        <div style={{ textAlign: 'center', padding: '2rem 1rem', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1.5rem' }}>
                            <div style={{ background: '#dcfce7', color: '#10b981', width: 64, height: 64, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                <CheckCircle size={32} />
                            </div>
                            <div>
                                <h4 style={{ margin: 0, color: '#104166', fontSize: '1.25rem', marginBottom: '0.5rem' }}>¡Remisión creada con éxito!</h4>
                                <p style={{ color: '#64748b', fontSize: '0.9rem', maxWidth: 400, margin: '0 auto' }}>
                                    La remisión <strong style={{ color: '#2365AB' }}>{createdRem?.id}</strong> ha sido registrada y el inventario ha sido actualizado.
                                </p>
                            </div>

                            <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 16, padding: '1.5rem', width: '100%', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                                <button className="btn btn-secondary" onClick={onClose} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem', height: 48 }}>
                                    Cerrar Ventana
                                </button>
                                <button className="btn btn-primary" onClick={() => generateRemisionPDF(createdRem, selectedClient, obrasDisp.find(o => o.id === obraId), settings)} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem', height: 48 }}>
                                    <Printer size={18} /> Imprimir Remisión
                                </button>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
