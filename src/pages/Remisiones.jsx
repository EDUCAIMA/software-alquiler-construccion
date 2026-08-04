import React, { useState, useMemo } from 'react';
import {
    Plus, Search, Truck, Package, RotateCcw, CheckCircle,
    AlertTriangle, Clock, X, ChevronRight, Filter, FileText,
    MapPin, ArrowDownCircle, Info, CreditCard,
    ChevronLeft, ChevronsLeft, ChevronsRight, ChevronDown, ChevronUp, Trash2, Ban,
    Printer, Download, Activity, TrendingUp, Edit3
} from 'lucide-react';
import { generateRemisionPDF, calcularHorasAlquiler, calcularHoraFin } from './CotizacionesHelpers';
import { useAppContext } from '../context/AppContext';
import { format, differenceInDays } from 'date-fns';
import Swal from 'sweetalert2';
import DevolucionModal from './DevolucionModal';
import EditRemisionModal from './EditRemisionModal';

// ─── Constants ────────────────────────────────────────────────────────────────
const ESTADO_CFG = {
    'Activa': { color: '#2365AB', bg: 'rgba(35, 101, 171,0.12)', Icon: Truck },
    'Parcial': { color: '#f97316', bg: 'rgba(249,115,22,0.12)', Icon: Clock },
    'Cerrada': { color: '#10b981', bg: 'rgba(16,185,129,0.12)', Icon: CheckCircle },
    'Pendiente': { color: '#6366f1', bg: 'rgba(99, 102, 241, 0.12)', Icon: AlertTriangle },
};

// ─── Helpers ──────────────────────────────────────────────────────────────────
const sField = (label, value, color) => (
    <div style={{ background: 'rgba(255,255,255,0.04)', borderRadius: 8, padding: '0.5rem 0.75rem' }}>
        <div style={{ fontSize: '0.63rem', color: '#94a3b8', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>{label}</div>
        <div style={{ fontSize: '0.9rem', fontWeight: 700, color: color || 'var(--text-primary)', marginTop: 2 }}>{value}</div>
    </div>
);

// ─── Modal: Nueva Remisión ────────────────────────────────────────────────────
function NuevaRemisionModal({ onClose, onSave, clients, products, maintenances, facturaPreload, settings }) {
    const [step, setStep] = useState(facturaPreload ? 2 : 1);
    const [loading, setLoading] = useState(false);
    const [createdRem, setCreatedRem] = useState(null);
    const [clientId, setClientId] = useState(facturaPreload?.clientId || '');
    const [obraId, setObraId] = useState(facturaPreload?.obraId || '');
    const [fecha, setFecha] = useState(format(new Date(), 'yyyy-MM-dd'));
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
            setBlockError(`Stock insuficiente. Disponible en bodega: ${prod.availableStock}`);
            return;
        }
        setBlockError('');
        const existing = items.findIndex(i => i.productId === selProd);
        if (existing >= 0) {
            const updated = [...items];
            const totalWanted = updated[existing].cantidad + selCant;
            if (totalWanted > prod.availableStock) {
                setBlockError(`Stock insuficiente. Ya tienes ${updated[existing].cantidad} agregados y el disponible en bodega total es ${prod.availableStock}.`);
                return;
            }
            updated[existing].cantidad = totalWanted;
            setItems(updated);
        } else {
            setItems(prev => [...prev, { 
                productId: selProd, 
                nombre: prod.name, 
                cantidad: selCant, 
                tarifaDia: prod.value,
                tipoCobro: prod.tipoCobro || 'Día',
                horaInicio: '',
                horaFin: '',
                horasCalculadas: 0
            }]);
        }
        setSelProd(''); setSelCant(1);
    };

    const removeItem = (idx) => setItems(items.filter((_, i) => i !== idx));

    const handleSave = async () => {
        if (!clientId || !obraId || items.length === 0) return;
        setLoading(true);
        try {
            const rem = await onSave({ clientId, obraId, fecha, notas, items });
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
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(15, 23, 42, 0.6)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '2rem 1rem 1rem 1rem' }}>
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
                            <div>
                                <label style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', fontWeight: 600, display: 'block', marginBottom: '0.4rem' }}>Fecha de Despacho</label>
                                <input type="date" value={fecha} onChange={e => setFecha(e.target.value)} style={IS} />
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
                                            {items.map((item, idx) => {
                                                const prod = products.find(p => p.id === item.productId);
                                                const isHora = (item.tipoCobro || prod?.tipoCobro || '').toLowerCase() === 'hora';

                                                const handleTimeChange = (field, val) => {
                                                    if ((field === 'horaInicio' || field === 'horaFin') && val && !/^\d{2}:\d{2}$/.test(val)) return;
                                                    const updated = [...items];
                                                    const cur = { ...updated[idx], [field]: val };

                                                    if (field === 'horaInicio') {
                                                        if (cur.horaFin && /^\d{2}:\d{2}$/.test(cur.horaFin)) {
                                                            cur.horasCalculadas = calcularHorasAlquiler(val, cur.horaFin);
                                                        } else if (cur.horasCalculadas > 0) {
                                                            cur.horaFin = calcularHoraFin(val, cur.horasCalculadas);
                                                        }
                                                    } else if (field === 'horaFin') {
                                                        if (cur.horaInicio && /^\d{2}:\d{2}$/.test(cur.horaInicio)) {
                                                            cur.horasCalculadas = calcularHorasAlquiler(cur.horaInicio, val);
                                                        }
                                                    } else if (field === 'horasCalculadas') {
                                                        const numH = Number(val) || 0;
                                                        cur.horasCalculadas = numH;
                                                        if (cur.horaInicio && /^\d{2}:\d{2}$/.test(cur.horaInicio) && numH > 0) {
                                                            cur.horaFin = calcularHoraFin(cur.horaInicio, numH);
                                                        }
                                                    }

                                                    updated[idx] = cur;
                                                    setItems(updated);
                                                };

                                                return (
                                                    <React.Fragment key={idx}>
                                                        <tr style={{ borderBottom: isHora ? 'none' : '1px solid #f1f5f9' }}>
                                                            <td style={{ padding: '0.75rem 1rem', fontWeight: 600, color: '#104166' }}>
                                                                {item.nombre}
                                                                {isHora && (
                                                                    <span style={{ fontSize: '0.65rem', background: '#fef3c7', color: '#b45309', padding: '1px 6px', borderRadius: 4, fontWeight: 700, marginLeft: 6 }}>
                                                                        Por Horas
                                                                    </span>
                                                                )}
                                                            </td>
                                                            <td style={{ padding: '0.75rem 1rem' }}>{item.cantidad}</td>
                                                            <td style={{ padding: '0.75rem 1rem', color: '#10b981', fontWeight: 500 }}>
                                                                ${item.tarifaDia?.toLocaleString()} {isHora ? '/ hora' : '/ día'}
                                                            </td>
                                                            <td style={{ padding: '0.75rem 1rem', textAlign: 'right' }}>
                                                                <button onClick={() => removeItem(idx)} style={{ background: '#fee2e2', border: 'none', cursor: 'pointer', color: '#ef4444', display: 'inline-flex', padding: '0.4rem', borderRadius: 6, transition: 'all 0.2s' }} onMouseEnter={e => e.currentTarget.style.background = '#fecaca'} onMouseLeave={e => e.currentTarget.style.background = '#fee2e2'}><X size={14} /></button>
                                                            </td>
                                                        </tr>
                                                        {isHora && (
                                                            <tr style={{ borderBottom: '1px solid #f1f5f9', background: '#fcfcfd' }}>
                                                                <td colSpan={4} style={{ padding: '0.5rem 1rem 0.8rem 1rem' }}>
                                                                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', background: '#ffffff', padding: '0.5rem 0.75rem', borderRadius: 8, border: '1px solid #e2e8f0', flexWrap: 'wrap' }}>
                                                                        <div style={{ fontSize: '0.75rem', fontWeight: 700, color: '#64748b' }}>Hora Alquiler:</div>
                                                                        <input type="time" value={item.horaInicio || ''} onChange={e => handleTimeChange('horaInicio', e.target.value)} style={{ padding: '0.2rem 0.4rem', border: '1px solid #cbd5e1', borderRadius: 4, fontSize: '0.8rem' }} />
                                                                        <div style={{ fontSize: '0.75rem', fontWeight: 700, color: '#64748b' }}>Horas Servicio:</div>
                                                                        <input type="number" step="0.5" min="0.5" value={item.horasCalculadas || ''} placeholder="0" onChange={e => handleTimeChange('horasCalculadas', e.target.value)} style={{ width: '60px', padding: '0.2rem 0.4rem', border: '1px solid #cbd5e1', borderRadius: 4, fontSize: '0.8rem', textAlign: 'center', fontWeight: 700 }} />
                                                                        <div style={{ fontSize: '0.75rem', fontWeight: 700, color: '#64748b' }}>Hora Devolución:</div>
                                                                        <input type="time" value={item.horaFin || ''} onChange={e => handleTimeChange('horaFin', e.target.value)} style={{ padding: '0.2rem 0.4rem', border: '1px solid #cbd5e1', borderRadius: 4, fontSize: '0.8rem' }} />
                                                                        {item.horasCalculadas > 0 && (
                                                                            <span style={{ fontSize: '0.75rem', fontWeight: 800, color: '#2365AB', background: '#e0f2fe', padding: '2px 8px', borderRadius: 12 }}>
                                                                                ⏱️ {item.horasCalculadas} {item.horasCalculadas === 1 ? 'Hora' : 'Horas'}
                                                                            </span>
                                                                        )}
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


// ─── Modal: Trazabilidad por Cliente/Obra ───────────────────────────────────
function TrazabilidadModal({ clientId, obraId, onClose, remisiones, products, clients }) {
    const client = clients.find(c => c.id === clientId);
    const obra = client?.obras?.find(o => o.id === obraId);

    const timeline = useMemo(() => {
        const events = [];
        const clientRems = (remisiones || []).filter(r => r.clientId === clientId && r.obraId === obraId && r.estado !== 'Cancelada');

        clientRems.forEach(r => {
            // Evento: Despacho (Remisión)
            events.push({
                id: `rem-${r.id}`,
                type: 'despacho',
                date: r.fecha,
                title: `Despacho de Equipos (REM-${r.id})`,
                description: `Se enviaron ${(r.items || []).reduce((s, i) => s + (Number(i.cantidad) || 0), 0)} unidades a la obra.`,
                items: r.items || [],
                icon: Truck,
                color: '#2365AB',
                bg: 'rgba(35, 101, 171, 0.1)'
            });

            // Eventos: Devoluciones detectadas en esta remisión
            r.items.forEach(item => {
                if (item.devoluciones && Array.isArray(item.devoluciones)) {
                    item.devoluciones.forEach((dev, idx) => {
                        events.push({
                            id: `dev-${r.id}-${item.productId}-${idx}`,
                            type: 'devolucion',
                            date: dev.fecha,
                            title: `Devolución: ${item.nombre || item.productId}`,
                            description: `Reingreso a inventario: ${dev.cantidad} unidad(es).`,
                            qty: dev.cantidad,
                            remId: r.id,
                            icon: RotateCcw,
                            color: '#f97316',
                            bg: 'rgba(249, 115, 22, 0.1)'
                        });
                    });
                }
            });
        });

        return events.sort((a, b) => b.date.localeCompare(a.date));
    }, [remisiones, clientId, obraId]);

    return (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(15, 23, 42, 0.6)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1200, padding: '1rem' }}>
            <div style={{ background: '#ffffff', borderRadius: '20px', boxShadow: '0 25px 50px -12px rgba(0,0,0,0.25)', width: '100%', maxWidth: 600, maxHeight: '85vh', display: 'flex', flexDirection: 'column' }}>
                <div style={{ padding: '1.5rem 2rem', borderBottom: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'linear-gradient(to right, #f8fafc, #ffffff)' }}>
                    <div>
                        <h3 style={{ margin: 0, color: '#104166', fontSize: '1.2rem', display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                            <div style={{ background: 'rgba(35,101,171,0.1)', padding: '0.5rem', borderRadius: '10px' }}><TrendingUp size={20} style={{ color: '#2365AB' }} /></div>
                            Línea de Tiempo de Alquiler
                        </h3>
                        <p style={{ margin: '0.25rem 0 0 0', fontSize: '0.8rem', color: '#64748b' }}>
                            Cliente: <strong>{client?.name}</strong> • Obra: <strong>{obra?.nombre}</strong>
                        </p>
                    </div>
                    <button onClick={onClose} style={{ background: '#f1f5f9', border: 'none', borderRadius: '50%', width: 36, height: 36, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: '#64748b' }}><X size={20} /></button>
                </div>

                <div style={{ padding: '2rem', overflowY: 'auto', flex: 1 }}>
                    {timeline.length === 0 ? (
                        <div style={{ textAlign: 'center', padding: '3rem', color: '#94a3b8' }}>
                            <Activity size={40} style={{ opacity: 0.2, marginBottom: '1rem' }} />
                            <p>No se registran movimientos para este cliente y obra.</p>
                        </div>
                    ) : (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                            {timeline.map((event, idx) => (
                                <div key={event.id} style={{ display: 'flex', gap: '1.5rem', position: 'relative' }}>
                                    {/* Line */}
                                    {idx !== timeline.length - 1 && (
                                        <div style={{ position: 'absolute', left: '19px', top: '40px', bottom: '-20px', width: '2px', background: '#e2e8f0', zIndex: 0 }}></div>
                                    )}

                                    {/* Icon container */}
                                    <div style={{ zIndex: 1, flexShrink: 0 }}>
                                        <div style={{ background: event.bg, color: event.color, width: '40px', height: '40px', borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center', border: `1px solid ${event.color}20` }}>
                                            <event.icon size={20} />
                                        </div>
                                    </div>

                                    {/* Content */}
                                    <div style={{ flex: 1, paddingBottom: '2.5rem' }}>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.4rem' }}>
                                            <div style={{ fontWeight: 700, fontSize: '0.95rem', color: '#1e293b' }}>{event.title}</div>
                                            <div style={{ fontSize: '0.75rem', color: '#64748b', fontWeight: 600, background: '#f1f5f9', padding: '0.2rem 0.6rem', borderRadius: '20px' }}>{event.date}</div>
                                        </div>
                                        <p style={{ margin: 0, fontSize: '0.85rem', color: '#64748b', lineHeight: 1.5 }}>{event.description}</p>
                                        
                                        {event.type === 'despacho' && (
                                            <div style={{ marginTop: '0.75rem', display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
                                                {event.items.map((it, i) => (
                                                    <span key={i} style={{ fontSize: '0.7rem', background: '#eff6ff', color: '#2365AB', padding: '0.2rem 0.6rem', borderRadius: '6px', border: '1px solid #dbeafe', fontWeight: 600 }}>
                                                        {it.cantidad}x {it.nombre || it.productId}
                                                    </span>
                                                ))}
                                            </div>
                                        )}
                                        {event.type === 'devolucion' && (
                                            <div style={{ marginTop: '0.5rem', fontSize: '0.7rem', color: '#f97316', fontWeight: 700, fontStyle: 'italic' }}>
                                                Afecta a Remisión {event.remId}
                                            </div>
                                        )}
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                <div style={{ padding: '1.25rem 2rem', background: '#f8fafc', borderTop: '1px solid #e2e8f0', borderRadius: '0 0 20px 20px', textAlign: 'right' }}>
                    <button className="btn btn-secondary" onClick={onClose} style={{ minWidth: 100 }}>Cerrar</button>
                </div>
            </div>
        </div>
    );
}

// ─── Modal: Verificación de Despacho ─────────────────────────────────────────
function VerifyDispatchModal({ rem, onClose, onConfirm, clients, products }) {
    if (!rem) return null;
    const client = clients.find(c => c.id === rem.clientId);
    const obra = client?.obras?.find(o => o.id === rem.obraId);

    return (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(15, 23, 42, 0.75)', backdropFilter: 'blur(8px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1300, padding: '1rem' }}>
            <div className="page-animate" style={{ background: '#ffffff', borderRadius: '24px', boxShadow: '0 25px 50px -12px rgba(0,0,0,0.35)', width: '100%', maxWidth: 550, overflow: 'hidden' }}>
                <div style={{ padding: '1.5rem 2rem', background: 'linear-gradient(135deg, #2365AB, #153e69)', color: 'white' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <h3 style={{ margin: 0, fontSize: '1.25rem', fontWeight: 800 }}>Verificación de Despacho</h3>
                        <button onClick={onClose} style={{ background: 'rgba(255,255,255,0.1)', border: 'none', borderRadius: '50%', width: 32, height: 32, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: 'white' }}><X size={18} /></button>
                    </div>
                </div>

                <div style={{ padding: '2rem' }}>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem', marginBottom: '2rem', padding: '1rem', background: '#f8fafc', borderRadius: '16px', border: '1px solid #e2e8f0' }}>
                        <div>
                            <div style={{ fontSize: '0.7rem', textTransform: 'uppercase', color: '#64748b', fontWeight: 700 }}>Cliente</div>
                            <div style={{ fontSize: '0.95rem', fontWeight: 700 }}>{client?.name || 'N/A'}</div>
                        </div>
                        <div>
                            <div style={{ fontSize: '0.7rem', textTransform: 'uppercase', color: '#64748b', fontWeight: 700 }}>Obra</div>
                            <div style={{ fontSize: '0.95rem', fontWeight: 700 }}>{obra?.nombre || 'N/A'}</div>
                        </div>
                    </div>

                    <h4 style={{ margin: '0 0 1rem 0', fontSize: '0.85rem', color: '#475569', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <Package size={16} /> Equipos a Despachar
                    </h4>
                    
                    <div style={{ maxHeight: '250px', overflowY: 'auto', borderRadius: '12px', border: '1px solid #e2e8f0' }}>
                        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
                            <thead>
                                <tr style={{ background: '#f1f5f9' }}>
                                    <th style={{ padding: '0.75rem', textAlign: 'left' }}>Descripción</th>
                                    <th style={{ padding: '0.75rem', textAlign: 'center' }}>Cant.</th>
                                </tr>
                            </thead>
                            <tbody>
                                {rem.items.map((item, idx) => {
                                    // Buscar nombre en la lista global de productos si no está en el item
                                    const prodInfo = (products || []).find(p => p.id === item.productId);
                                    const displayName = item.nombre || item.name || prodInfo?.nombre || prodInfo?.name || item.productId || 'Equipo Desconocido';
                                    
                                    return (
                                        <tr key={idx} style={{ borderBottom: '1px solid #f1f5f9' }}>
                                            <td style={{ padding: '0.75rem' }}>{displayName}</td>
                                            <td style={{ padding: '0.75rem', textAlign: 'center', fontWeight: 800, color: '#2365AB' }}>{item.cantidad}</td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>

                    <div style={{ marginTop: '2rem', display: 'flex', gap: '1rem' }}>
                        <button onClick={onClose} className="btn btn-secondary" style={{ flex: 1 }}>Cancelar</button>
                        <button onClick={onConfirm} className="btn btn-primary" style={{ flex: 2, background: '#10b981', border: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem' }}>
                            <CheckCircle size={18} /> Confirmar Salida y PDF
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}

// ─── MAIN COMPONENT ───────────────────────────────────────────────────────────
export default function Remisiones() {
    const { clients, products, remisiones, invoices, addRemision, editRemision, registrarDevolucion, maintenances, marcarRemisionCreada, deleteRemision, cancelRemision, settings, globalPreload, setGlobalPreload } = useAppContext();

    const [search, setSearch] = useState('');
    const [filterEstado, setFilterEstado] = useState('Todos');
    const [filterClient, setFilterClient] = useState('');
    const [showNueva, setShowNueva] = useState(false);
    const [facturaPreload, setFacturaPreload] = useState(null);
    const [devolucionTarget, setDevolucionTarget] = useState(null); // { clientId, obraId }
    const [trazabilidadTarget, setTrazabilidadTarget] = useState(null); 
    const [showVerifyModal, setShowVerifyModal] = useState(false);
    const [verifyTarget, setVerifyTarget] = useState(null);
    const [editingRemisionTarget, setEditingRemisionTarget] = useState(null);
    const [blockMsg, setBlockMsg] = useState('');

    React.useEffect(() => {
        if (globalPreload) {
            setFacturaPreload(globalPreload);
            setShowNueva(true);
            setGlobalPreload(null);
        }
    }, [globalPreload, setGlobalPreload]);

    // Facturas pagadas pendientes de remisión
    const pendingInvoices = useMemo(() => {
        return (invoices || []).filter(inv =>
            inv.status === 'Paid' && inv.remisionEnabled === true && !inv.remisionCreada
        );
    }, [invoices]);

    // KPIs
    const activas = (remisiones || []).filter(r => r.estado === 'Activa').length;
    const parciales = (remisiones || []).filter(r => r.estado === 'Parcial').length;
    const cerradas = (remisiones || []).filter(r => r.estado === 'Cerrada').length;
    const totalTransporte = (remisiones || []).reduce((s, r) => s + (Number(r.transporte) || 0), 0);
    const totalEquiposEnCampo = useMemo(() => {
        let total = 0;
        (remisiones || []).filter(r => r.estado !== 'Cerrada').forEach(r => {
            (r.items || []).forEach(item => { 
                total += (Number(item.cantidad) || 0) - (Number(item.cantidadDevuelta) || 0); 
            });
        });
        return total;
    }, [remisiones]);

    // Filtered
    const [sortConfig, setSortConfig] = useState({ key: 'id', direction: 'desc' });

    // Handlers
    const handleFinalizeDispatch = (rem) => {
        setVerifyTarget(rem);
        setShowVerifyModal(true);
    };

    const handleConfirmFinalDispatch = async () => {
        if (!verifyTarget) return;
        const rem = verifyTarget;
        try {
            console.log('🚀 Finalizando Despacho Confirmado para:', rem.id);
            const today = format(new Date(), 'yyyy-MM-dd');
            const client = clients.find(c => c.id === rem.clientId);
            const obra = client?.obras?.find(o => o.id === rem.obraId);
            
            await editRemision(rem.id, { estado: 'Activa', fecha: today });
            generateRemisionPDF({ ...rem, estado: 'Activa', fecha: today }, client, obra, settings);
            
            setShowVerifyModal(false);
            setVerifyTarget(null);
            
            Swal.fire({
                title: '¡Despacho Exitoso!',
                text: `La remisión ${rem.id} ha sido activada y el documento PDF se ha generado correctamente.`,
                icon: 'success',
                confirmButtonColor: '#2365AB',
                confirmButtonText: 'Excelente',
                background: '#ffffff',
                borderRadius: '16px'
            });
        } catch (err) {
            console.error('❌ ERROR FINALIZANDO DESPACHO:', err);
            Swal.fire({
                title: 'Error al Procesar',
                text: err.message,
                icon: 'error',
                confirmButtonColor: '#ef4444'
            });
        }
    };

    const handleSort = (key) => {
        let direction = 'asc';
        if (sortConfig.key === key && sortConfig.direction === 'asc') direction = 'desc';
        setSortConfig({ key, direction });
    };

    // Filter + Sort
    const sortedRemisiones = useMemo(() => {
        const filtered = remisiones.filter(r => {
            const client = clients.find(c => c.id === r.clientId);
            const obra = client?.obras?.find(o => o.id === r.obraId);
            const q = search.toLowerCase();
            const matchSearch = r.id.toLowerCase().includes(q) || client?.name?.toLowerCase()?.includes(q) || obra?.nombre?.toLowerCase()?.includes(q);
            const matchE = filterEstado === 'Todos' || r.estado === filterEstado;
            const matchC = !filterClient || r.clientId === filterClient;
            return matchSearch && matchE && matchC;
        });

        if (sortConfig.key) {
            filtered.sort((a, b) => {
                let aVal, bVal;
                
                if (sortConfig.key === 'clientName') {
                    aVal = (clients.find(x => x.id === a.clientId)?.name || '').toLowerCase();
                    bVal = (clients.find(x => x.id === b.clientId)?.name || '').toLowerCase();
                } else if (sortConfig.key === 'id') {
                    aVal = parseInt(a.id.split('-').pop()) || 0;
                    bVal = parseInt(b.id.split('-').pop()) || 0;
                } else {
                    aVal = a[sortConfig.key] || '';
                    bVal = b[sortConfig.key] || '';
                    if (typeof aVal === 'string') aVal = aVal.toLowerCase();
                    if (typeof bVal === 'string') bVal = bVal.toLowerCase();
                }

                if (aVal < bVal) return sortConfig.direction === 'asc' ? -1 : 1;
                if (aVal > bVal) return sortConfig.direction === 'asc' ? 1 : -1;
                return 0;
            });
        }
        return filtered;
    }, [remisiones, search, filterEstado, filterClient, clients, sortConfig]);

    // Pagination
    const [currentPage, setCurrentPage] = useState(1);
    const [itemsPerPage, setItemsPerPage] = useState(10);

    const paginatedRemisiones = useMemo(() => {
        const start = (currentPage - 1) * itemsPerPage;
        return sortedRemisiones.slice(start, start + itemsPerPage);
    }, [sortedRemisiones, currentPage, itemsPerPage]);

    const totalPages = Math.ceil(sortedRemisiones.length / itemsPerPage);

    const handleSaveRemision = async (data) => {
        try {
            setBlockMsg('');
            const res = await addRemision(data);
            // Si viene de una factura pre-cargada, marcarla como remisión creada
            if (facturaPreload?.id) {
                await marcarRemisionCreada(facturaPreload.id);
            }
            setFacturaPreload(null);
            return res;
        } catch (e) {
            setBlockMsg(e.message);
            throw e;
        }
    };

    const inputStyle = {
        padding: '0.55rem 0.75rem', background: 'rgba(255,255,255,0.06)',
        border: '1px solid var(--surface-border)', borderRadius: 8,
        color: 'var(--text-primary)', fontSize: '0.875rem', outline: 'none',
    };

    return (
        <>
            {/* Header / Top Bar con KPIs integrados */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', gap: '1.5rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '1.5rem', flex: 1 }}>
                    <h1 style={{ margin: 0, whiteSpace: 'nowrap', fontSize: '1.75rem' }}>Remisiones</h1>
                    
                    {/* KPIs en el centro */}
                    <div style={{ display: 'flex', gap: '0.5rem', flex: 1 }}>
                        {[
                            { label: 'Activas', value: activas, color: 'blue' },
                            { label: 'En Campo', value: totalEquiposEnCampo, color: 'blue' },
                            { label: 'Costo Transp.', value: `$${totalTransporte.toLocaleString()}`, color: 'orange' },
                            { label: 'Parciales', value: parciales, color: 'orange' }
                        ].map(({ label, value, color }) => (
                            <div key={label} className={`stat-card ${color}`} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '0.5rem 0.85rem', textAlign: 'center', minWidth: 0, height: 'auto' }}>
                                <div>
                                    <div className="stat-value" style={{ fontSize: '1.1rem', lineHeight: 1.1 }}>{value}</div>
                                    <div className="stat-label" style={{ fontSize: '0.65rem', marginTop: '0.1rem', fontWeight: 700 }}>{label}</div>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>

                <button className="btn btn-primary" onClick={() => { setFacturaPreload(null); setShowNueva(true); }} style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', whiteSpace: 'nowrap', height: 'fit-content', padding: '0.7rem 1.25rem' }}>
                    <Plus size={18} /> Nueva Remisión
                </button>
            </div>

            {/* ─── Facturas Pagadas Pendientes de Remisión ─────────────────────── */}
            {pendingInvoices.length > 0 && (
                <div style={{ background: 'linear-gradient(135deg, rgba(16,185,129,0.08), rgba(5,150,105,0.05))', border: '1px solid rgba(16,185,129,0.3)', borderRadius: 14, padding: '1.25rem 1.5rem', marginBottom: '1.5rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', marginBottom: '1rem' }}>
                        <CreditCard size={18} style={{ color: '#10b981' }} />
                        <span style={{ fontWeight: 700, color: '#10b981', fontSize: '0.95rem' }}>
                            {pendingInvoices.length} Factura(s) Pagada(s) — Listas para Despachar
                        </span>
                        <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginLeft: 'auto' }}>Clic en "Crear Remisión" para despachar</span>
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
                        {pendingInvoices.map(inv => {
                            const client = clients.find(c => c.id === inv.clientId);
                            const obra = client?.obras?.find(o => o.id === inv.obraId);
                            return (
                                <div key={inv.id} style={{ background: 'var(--glass-bg)', border: '1px solid rgba(16,185,129,0.2)', borderRadius: 10, padding: '0.75rem 1.25rem', display: 'flex', alignItems: 'center', gap: '1rem', flexWrap: 'wrap' }}>
                                    <span style={{ fontWeight: 700, fontFamily: 'monospace', color: '#10b981', fontSize: '0.85rem' }}>{inv.id}</span>
                                    {inv.cotizacionId && (
                                        <span style={{ fontSize: '0.7rem', background: 'rgba(99,102,241,0.12)', color: '#6366f1', padding: '2px 8px', borderRadius: 999, border: '1px solid rgba(99,102,241,0.3)', fontWeight: 700 }}>
                                            📋 {inv.cotizacionId}
                                        </span>
                                    )}
                                    <span style={{ fontWeight: 600, fontSize: '0.85rem' }}>{client?.name || 'N/A'}</span>
                                    {obra && <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: 3 }}><MapPin size={11} />{obra.nombre}</span>}
                                    <span style={{ fontWeight: 700, color: '#10b981', fontSize: '0.9rem' }}>${inv.amount?.toLocaleString()}</span>
                                    <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>{inv.items?.length || 0} equipo(s)</span>
                                    <button
                                        className="btn btn-sm"
                                        style={{ marginLeft: 'auto', background: '#10b981', color: 'white', display: 'flex', alignItems: 'center', gap: 5, fontWeight: 700, fontSize: '0.78rem' }}
                                        onClick={() => { setFacturaPreload(inv); setShowNueva(true); }}
                                    >
                                        <Truck size={14} /> Crear Remisión
                                    </button>
                                </div>
                            );
                        })}
                    </div>
                </div>
            )}

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



            {/* Filters */}
            <div className="glass-panel p-6 mb-6" style={{ display: 'flex', gap: '0.75rem', alignItems: 'center', flexWrap: 'wrap' }}>
                <div style={{ position: 'relative', flex: 1, minWidth: 200 }}>
                    <Search size={15} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                    <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Buscar por ID, cliente u obra…"
                        style={{ ...inputStyle, paddingLeft: '2rem', width: '100%', boxSizing: 'border-box' }} />
                </div>
                <select value={filterEstado} onChange={e => setFilterEstado(e.target.value)} style={{ ...inputStyle, minWidth: 140 }}>
                    <option>Todos</option><option>Pendiente</option><option>Activa</option><option>Parcial</option><option>Cerrada</option>
                </select>
                <select value={filterClient} onChange={e => setFilterClient(e.target.value)} style={{ ...inputStyle, minWidth: 180 }}>
                    <option value="">Todos los clientes</option>
                    {clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
            </div>

            {/* Table */}
            <div className="glass-panel p-6">
                <div style={{ overflowX: 'auto' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                        <thead>
                            <tr style={{ borderBottom: '1px solid var(--surface-border)' }}>
                                {[
                                    { label: 'ID', key: 'id' },
                                    { label: 'Cliente', key: 'clientName' },
                                    { label: 'Fecha', key: 'fecha' },
                                    { label: 'Equipos', key: null },
                                    { label: 'Estado', key: 'estado' },
                                    { label: 'Días activo', key: null },
                                    { label: 'Acciones', key: null }
                                ].map(({ label, key }) => (
                                    <th 
                                        key={label} 
                                        onClick={() => key && handleSort(key)}
                                        style={{ 
                                            padding: '0.75rem 0.85rem', textAlign: 'left', fontSize: '0.7rem', color: 'var(--text-muted)', 
                                            fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', whiteSpace: 'nowrap',
                                            cursor: key ? 'pointer' : 'default', userSelect: 'none'
                                        }}
                                    >
                                        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                                            {label}
                                            {key && sortConfig.key === key && (
                                                sortConfig.direction === 'asc' ? <ChevronUp size={12} /> : <ChevronDown size={12} />
                                            )}
                                        </div>
                                    </th>
                                ))}
                            </tr>
                        </thead>
                        <tbody>
                            {paginatedRemisiones.map(rem => {
                                const client = clients.find(c => c.id === rem.clientId);
                                const obra = client?.obras?.find(o => o.id === rem.obraId);
                                const cfg = ESTADO_CFG[rem.estado] || ESTADO_CFG['Activa'];
                                const dias = rem.estado !== 'Cerrada' ? differenceInDays(new Date(), new Date(rem.fecha)) : '—';
                                const totalItems = rem.items?.reduce((s, i) => s + (Number(i.cantidad) || 0), 0) || 0;
                                const totalDev = rem.items?.reduce((s, i) => s + (Number(i.cantidadDevuelta) || 0), 0) || 0;
                                const canReturn = rem.estado !== 'Cerrada' && rem.estado !== 'Cancelada';
                                return (
                                    <tr key={rem.id} style={{ borderBottom: '1px solid var(--surface-border)' }}
                                        onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.02)'}
                                        onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                                    >
                                        <td style={{ padding: '0.85rem' }}>
                                            <div style={{ fontWeight: 800, fontFamily: 'monospace', color: '#2365AB', fontSize: '0.85rem' }}>{rem.id.split('-').pop()}</div>
                                            <div style={{ display: 'flex', gap: 4, marginTop: 4 }}>
                                                {rem.cotizacionId && <span title={`Cotización: ${rem.cotizacionId}`} style={{ fontSize: '0.6rem', padding: '1px 5px', borderRadius: 4, background: 'rgba(99,102,241,0.08)', color: '#6366f1', border: '1px solid rgba(99,102,241,0.2)', fontWeight: 700 }}>📋 {rem.cotizacionId.split('-').pop()}</span>}
                                                {rem.facturaId && <span title={`Factura: ${rem.facturaId}`} style={{ fontSize: '0.6rem', padding: '1px 5px', borderRadius: 4, background: 'rgba(16,185,129,0.08)', color: '#10b981', border: '1px solid rgba(16,185,129,0.2)', fontWeight: 700 }}>📄 {rem.facturaId.split('-').pop()}</span>}
                                            </div>
                                        </td>
                                        <td style={{ padding: '0.85rem' }}>
                                            <div style={{ fontWeight: 700, fontSize: '0.875rem' }}>{client?.name || rem.clientId}</div>
                                        </td>
                                        <td style={{ padding: '0.85rem', color: 'var(--text-muted)', fontSize: '0.82rem' }}>
                                            {format(new Date(rem.fecha + 'T12:00:00'), 'dd/MM/yy')}
                                        </td>
                                        <td style={{ padding: '0.85rem' }}>
                                            <div style={{ fontSize: '0.82rem' }}>{totalItems} unds. / {totalDev} devueltas</div>
                                            <div style={{ height: 4, background: 'var(--surface-border)', borderRadius: 999, width: 80, marginTop: 4, overflow: 'hidden' }}>
                                                <div style={{ height: '100%', width: `${totalItems > 0 ? Math.round(totalDev / totalItems * 100) : 0}%`, background: '#10b981', borderRadius: 999 }} />
                                            </div>
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
                                            <div style={{ display: 'flex', gap: '0.4rem' }}>
                                                {rem.estado === 'Pendiente' && (
                                                    <button
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            handleFinalizeDispatch(rem);
                                                        }}
                                                        id={`btn-finalize-${rem.id}`}
                                                        className="btn btn-primary btn-sm"
                                                        style={{ fontSize: '0.75rem', display: 'flex', alignItems: 'center', gap: 4, background: '#6366f1', border: 'none', padding: '0.4rem 0.8rem' }}>
                                                        <CheckCircle size={13} /> Finalizar Despacho
                                                    </button>
                                                )}
                                                {canReturn && (
                                                    <button
                                                        onClick={() => setDevolucionTarget({ clientId: rem.clientId, obraId: rem.obraId })}
                                                        className="btn btn-secondary btn-sm"
                                                        style={{ fontSize: '0.75rem', display: 'flex', alignItems: 'center', gap: 4 }}>
                                                        <RotateCcw size={13} /> Devolución
                                                    </button>
                                                )}
                                                {rem.estado !== 'Cancelada' && rem.estado !== 'Cerrada' && (
                                                    <button
                                                        onClick={async () => {
                                                            const result = await Swal.fire({
                                                                title: '¿Anular Remisión?',
                                                                text: `¿Está seguro de ANULAR la remisión ${rem.id}? Esto devolverá todo el stock al inventario.`,
                                                                icon: 'warning',
                                                                showCancelButton: true,
                                                                confirmButtonColor: '#f97316',
                                                                cancelButtonColor: '#64748b',
                                                                confirmButtonText: 'Sí, anular',
                                                                cancelButtonText: 'Cancelar'
                                                            });
                                                            if (result.isConfirmed) {
                                                                cancelRemision(rem.id);
                                                                Swal.fire('Anulada', 'La remisión ha sido anulada.', 'success');
                                                            }
                                                        }}
                                                        className="btn btn-sm"
                                                        style={{ background: 'rgba(249,115,22,0.08)', color: '#f97316', border: '1px solid rgba(249,115,22,0.2)', padding: '0.4rem', borderRadius: 6, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                                                        title="Anular Remisión (Retornar Stock)"
                                                    >
                                                        <Ban size={13} />
                                                    </button>
                                                )}
                                                <button
                                                    onClick={() => setEditingRemisionTarget(rem)}
                                                    className="btn btn-sm"
                                                    style={{ background: 'rgba(35, 101, 171, 0.08)', color: '#2365AB', border: '1px solid rgba(35, 101, 171, 0.2)', padding: '0.4rem', borderRadius: 6, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                                                    title="Editar Remisión"
                                                >
                                                    <Edit3 size={13} />
                                                </button>
                                                <button
                                                    onClick={() => generateRemisionPDF(rem, client, obra, settings)}
                                                    className="btn btn-sm"
                                                    style={{ background: 'rgba(35, 101, 171, 0.08)', color: '#2365AB', border: '1px solid rgba(35, 101, 171, 0.2)', padding: '0.4rem', borderRadius: 6, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                                                    title="Imprimir Remisión"
                                                >
                                                    <Printer size={13} />
                                                </button>
                                                <button
                                                    onClick={async () => {
                                                        const result = await Swal.fire({
                                                            title: '¿Eliminar Permanente?',
                                                            text: `¿Está seguro de eliminar la remisión ${rem.id}? Esto devolverá los equipos no devueltos al stock.`,
                                                            icon: 'error',
                                                            showCancelButton: true,
                                                            confirmButtonColor: '#ef4444',
                                                            cancelButtonColor: '#64748b',
                                                            confirmButtonText: 'Sí, eliminar',
                                                            cancelButtonText: 'No, conservar'
                                                        });
                                                        if (result.isConfirmed) {
                                                            try {
                                                                await deleteRemision(rem.id);
                                                                Swal.fire({
                                                                    title: 'Remisión Eliminada',
                                                                    text: `La remisión ${rem.id} fue eliminada correctamente y sus equipos han vuelto al stock disponible del inventario.`,
                                                                    icon: 'success',
                                                                    confirmButtonColor: '#2365AB'
                                                                });
                                                            } catch (err) {
                                                                Swal.fire({
                                                                    title: 'Error al eliminar',
                                                                    text: err.message || 'No se pudo eliminar la remisión.',
                                                                    icon: 'error',
                                                                    confirmButtonColor: '#ef4444'
                                                                });
                                                            }
                                                        }
                                                    }}
                                                    className="btn btn-sm"
                                                    style={{ background: 'rgba(239,68,68,0.08)', color: '#ef4444', border: '1px solid rgba(239,68,68,0.2)', padding: '0.4rem', borderRadius: 6, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                                                    title="Eliminar Remisión"
                                                >
                                                    <Trash2 size={13} />
                                                </button>
                                                <button
                                                    onClick={() => setTrazabilidadTarget({ clientId: rem.clientId, obraId: rem.obraId })}
                                                    className="btn btn-sm"
                                                    style={{ background: 'rgba(99, 102, 241, 0.08)', color: '#6366f1', border: '1px solid rgba(99, 102, 241, 0.2)', padding: '0.4rem', borderRadius: 6, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                                                    title="Ver Trazabilidad (Línea de Tiempo)"
                                                >
                                                    <Activity size={13} />
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                );
                            })}
                            {sortedRemisiones.length === 0 && (
                                <tr><td colSpan={8} style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-muted)' }}>No se encontraron remisiones</td></tr>
                            )}
                        </tbody>
                    </table>
                </div>

                {/* Pagination Controls */}
                <div className="flex justify-between items-center mt-6 py-4 px-2" style={{ borderTop: '1px solid var(--surface-border)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                            <span>Mostrar:</span>
                            <div style={{ position: 'relative' }}>
                                <select 
                                    value={itemsPerPage} 
                                    onChange={e => { setItemsPerPage(Number(e.target.value)); setCurrentPage(1); }}
                                    className="input-base"
                                    style={{ padding: '0.3rem 1.8rem 0.3rem 0.6rem', fontSize: '0.8rem', width: 'auto', minWidth: '70px', height: '32px' }}
                                >
                                    {[5, 10, 20, 50, 100].map(n => <option key={n} value={n}>{n}</option>)}
                                </select>
                                <ChevronDown size={14} style={{ position: 'absolute', right: 6, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none', color: 'var(--text-muted)' }} />
                            </div>
                            <span>por página</span>
                        </div>
                        <div style={{ width: '1px', height: '16px', background: 'var(--surface-border)' }}></div>
                        <div>
                            Mostrando {sortedRemisiones.length > 0 ? (currentPage - 1) * itemsPerPage + 1 : 0} a {Math.min(currentPage * itemsPerPage, sortedRemisiones.length)} de {sortedRemisiones.length} registros
                        </div>
                    </div>

                    <div className="flex items-center gap-2">
                        <button 
                            className="btn btn-secondary btn-sm p-2" 
                            disabled={currentPage === 1}
                            onClick={() => setCurrentPage(1)}
                            title="Primera página"
                        >
                            <ChevronsLeft size={16} />
                        </button>
                        <button 
                            className="btn btn-secondary btn-sm p-2" 
                            disabled={currentPage === 1}
                            onClick={() => setCurrentPage(prev => prev - 1)}
                            title="Página anterior"
                        >
                            <ChevronLeft size={16} />
                        </button>
                        
                        <div className="flex items-center gap-1">
                            {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                                let pageNum;
                                if (totalPages <= 5) pageNum = i + 1;
                                else if (currentPage <= 3) pageNum = i + 1;
                                else if (currentPage >= totalPages - 2) pageNum = totalPages - 4 + i;
                                else pageNum = currentPage - 2 + i;
                                
                                return (
                                    <button 
                                        key={pageNum}
                                        onClick={() => setCurrentPage(pageNum)}
                                        className={`btn btn-sm ${currentPage === pageNum ? 'btn-primary' : 'btn-secondary'}`}
                                        style={{ minWidth: '32px', height: '32px', padding: 0 }}
                                    >
                                        {pageNum}
                                    </button>
                                );
                            })}
                        </div>

                        <button 
                            className="btn btn-secondary btn-sm p-2" 
                            disabled={currentPage === totalPages || totalPages === 0}
                            onClick={() => setCurrentPage(prev => prev + 1)}
                            title="Siguiente página"
                        >
                            <ChevronRight size={16} />
                        </button>
                        <button 
                            className="btn btn-secondary btn-sm p-2" 
                            disabled={currentPage === totalPages || totalPages === 0}
                            onClick={() => setCurrentPage(totalPages)}
                            title="Última página"
                        >
                            <ChevronsRight size={16} />
                        </button>
                    </div>
                </div>
            </div>

            {/* Modals */}
            {showNueva && (
                <NuevaRemisionModal
                    onClose={() => { setShowNueva(false); setFacturaPreload(null); }}
                    onSave={handleSaveRemision}
                    clients={clients}
                    products={products}
                    maintenances={maintenances}
                    facturaPreload={facturaPreload}
                    settings={settings}
                />
            )}
            {devolucionTarget && (
                <DevolucionModal
                    {...devolucionTarget}
                    remisiones={remisiones}
                    products={products}
                    clients={clients}
                    onClose={() => setDevolucionTarget(null)}
                    onSave={(cId, oId, devoluciones, fecha) => registrarDevolucion(cId, oId, devoluciones, fecha)}
                />
            )}

            {trazabilidadTarget && (
                <TrazabilidadModal
                    {...trazabilidadTarget}
                    onClose={() => setTrazabilidadTarget(null)}
                    remisiones={remisiones}
                    products={products}
                    clients={clients}
                />
            )}

            {showVerifyModal && (
                <VerifyDispatchModal
                    rem={verifyTarget}
                    onClose={() => setShowVerifyModal(false)}
                    onConfirm={handleConfirmFinalDispatch}
                    clients={clients}
                    products={products}
                />
            )}

            {editingRemisionTarget && (
                <EditRemisionModal
                    remision={editingRemisionTarget}
                    onClose={() => setEditingRemisionTarget(null)}
                    onSave={editRemision}
                    products={products}
                    clients={clients}
                />
            )}
        </>
    );
}
