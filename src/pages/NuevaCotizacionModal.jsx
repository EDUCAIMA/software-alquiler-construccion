import React, { useState } from 'react';
import {
    FilePlus, CheckCircle, X, ChevronRight, Plus,
    MapPin, Package, Truck, CreditCard, Clock
} from 'lucide-react';
import { fmtCOP } from './cotizacionesUtils';

// Componente independiente para evitar re-renders en cascada desde Cotizaciones.jsx
export default function NuevaCotizacionModal({ onClose, onSave, clients, products }) {
    const [step, setStep] = useState(1);
    const [clientId, setClientId] = useState('');
    const [obraId, setObraId] = useState('');
    const [validez, setValidez] = useState(15);
    const [metodoPago, setMetodoPago] = useState('Crédito 30 días');
    const [respTransporte, setRespTransporte] = useState('CIELO');
    const [plazoEntrega, setPlazoEntrega] = useState('24 horas');
    const [transporte, setTransporte] = useState(0);
    const [notas, setNotas] = useState('');
    const [items, setItems] = useState([]);
    const [selProd, setSelProd] = useState('');
    const [selCant, setSelCant] = useState(1);
    const [selDias, setSelDias] = useState(1);

    const selectedClient = clients.find(c => c.id === clientId);
    const obras = selectedClient?.obras || [];

    // Cálculos con protección total contra NaN/undefined
    const subtotal = items.reduce((s, i) => s + (Number(i.cantidad) || 0) * (Number(i.dias) || 0) * (Number(i.tarifaDia) || 0), 0);
    const porcIVA = Number(selectedClient?.porcIVA) || 0;
    const porcRet = Number(selectedClient?.porcRetencion) || 0;
    const iva = Math.round(subtotal * porcIVA / 100);
    const ret = Math.round(subtotal * porcRet / 100);
    const total = subtotal + iva - ret + (Number(transporte) || 0);

    const addItem = () => {
        if (!selProd) return;
        const prod = products.find(p => p.id === selProd);
        if (!prod) return;
        const tarifaDia = Number(prod.value) || 0;
        const cantidad = Number(selCant) || 1;
        const dias = Number(selDias) || 1;
        const ex = items.findIndex(i => i.productId === selProd);
        if (ex >= 0) {
            const u = items.map((item, idx) => idx === ex ? { ...item, cantidad: item.cantidad + cantidad } : item);
            setItems(u);
        } else {
            setItems(prev => [...prev, {
                productId: selProd,
                nombre: prod.name || selProd,
                cantidad,
                dias,
                tarifaDia
            }]);
        }
        setSelProd('');
        setSelCant(1);
        setSelDias(1);
    };

    const handleSave = () => {
        if (!clientId || !obraId || items.length === 0) return;
        onSave({
            clientId, obraId, validezDias: Number(validez) || 15,
            metodoPago, responsableTransporte: respTransporte,
            plazoEntrega, transporte: Number(transporte) || 0,
            notas, items
        });
        onClose();
    };

    const IS = {
        width: '100%', padding: '0.65rem 0.8rem', boxSizing: 'border-box',
        background: 'var(--background)', border: '1px solid var(--surface-border)',
        borderRadius: 8, color: 'var(--text-primary)', fontSize: '0.85rem', outline: 'none'
    };
    const SS = { ...IS, cursor: 'pointer' };

    // Filtrar productos activos
    const productosActivos = (products || []).filter(p => p.estado !== 'Dado de baja');

    return (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.6)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '2rem 1rem 1rem' }}>
            <div style={{ background: '#ffffff', borderRadius: 16, boxShadow: '0 20px 40px rgba(0,0,0,0.15)', width: '100%', maxWidth: 720, maxHeight: '85vh', display: 'flex', flexDirection: 'column', marginTop: '3vh' }}>

                {/* Header */}
                <div style={{ padding: '1.25rem 2rem', borderBottom: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div>
                        <h3 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '0.75rem', color: '#1e293b', fontSize: '1.2rem', marginBottom: '0.5rem' }}>
                            <div style={{ background: 'rgba(59,130,246,0.1)', padding: '0.5rem', borderRadius: 10, display: 'flex' }}>
                                <FilePlus size={20} style={{ color: '#3b82f6' }} />
                            </div>
                            Nueva Cotización
                        </h3>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                            {['Comercial', 'Equipos', 'Condiciones', 'Resumen'].map((s, i) => (
                                <React.Fragment key={s}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                                        <div style={{ width: 22, height: 22, borderRadius: '50%', background: step > i + 1 ? '#10b981' : step === i + 1 ? '#3b82f6' : '#e2e8f0', color: step > i ? 'white' : '#64748b', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.7rem', fontWeight: 700 }}>
                                            {step > i + 1 ? '✓' : i + 1}
                                        </div>
                                        <span style={{ fontSize: '0.75rem', color: step === i + 1 ? '#3b82f6' : '#64748b', fontWeight: step === i + 1 ? 700 : 500 }}>{s}</span>
                                    </div>
                                    {i < 3 && <div style={{ width: 24, height: 2, background: step > i + 1 ? '#10b981' : '#e2e8f0', borderRadius: 2 }} />}
                                </React.Fragment>
                            ))}
                        </div>
                    </div>
                    <button onClick={onClose} style={{ background: '#f1f5f9', border: 'none', borderRadius: '50%', width: 32, height: 32, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: '#64748b', alignSelf: 'flex-start' }}>
                        <X size={18} />
                    </button>
                </div>

                <div style={{ padding: '1.5rem 2rem', overflowY: 'auto' }}>

                    {/* ─── Paso 1: Comercial ─── */}
                    {step === 1 && (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                                <div>
                                    <label style={{ fontSize: '0.8rem', color: '#64748b', fontWeight: 600, display: 'block', marginBottom: '0.4rem' }}>Cliente *</label>
                                    <select value={clientId} onChange={e => { setClientId(e.target.value); setObraId(''); }} style={SS}>
                                        <option value="">— Seleccionar —</option>
                                        {(clients || []).map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                                    </select>
                                </div>
                                <div>
                                    <label style={{ fontSize: '0.8rem', color: '#64748b', fontWeight: 600, display: 'block', marginBottom: '0.4rem' }}>Obra *</label>
                                    <select value={obraId} onChange={e => setObraId(e.target.value)} disabled={!selectedClient} style={SS}>
                                        <option value="">— Seleccionar —</option>
                                        {obras.map(o => <option key={o.id} value={o.id}>{o.nombre}</option>)}
                                    </select>
                                </div>
                            </div>
                            {selectedClient && (
                                <div style={{ background: 'linear-gradient(135deg,#3b82f6,#2563eb)', borderRadius: 12, padding: '1rem 1.25rem', display: 'flex', gap: '2rem', boxShadow: '0 4px 12px rgba(59,130,246,0.2)' }}>
                                    {[['IVA', `${selectedClient.porcIVA || 0}%`], ['Retención', `${selectedClient.porcRetencion || 0}%`], ['Régimen', selectedClient.regimen || 'N/A']].map(([k, v]) => (
                                        <div key={k}>
                                            <div style={{ fontSize: '0.7rem', color: 'rgba(255,255,255,0.8)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em' }}>{k}</div>
                                            <div style={{ fontWeight: 800, color: 'white', fontSize: '1.1rem', marginTop: '0.2rem' }}>{v}</div>
                                        </div>
                                    ))}
                                </div>
                            )}
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                                <div>
                                    <label style={{ fontSize: '0.8rem', color: '#64748b', fontWeight: 600, display: 'block', marginBottom: '0.4rem' }}>Validez (días)</label>
                                    <input type="number" min="1" value={validez} onChange={e => setValidez(e.target.value)} style={IS} />
                                </div>
                                <div>
                                    <label style={{ fontSize: '0.8rem', color: '#64748b', fontWeight: 600, display: 'block', marginBottom: '0.4rem' }}>Plazo de Entrega</label>
                                    <select value={plazoEntrega} onChange={e => setPlazoEntrega(e.target.value)} style={SS}>
                                        {['24 horas', '48 horas', '72 horas', 'A convenir'].map(v => <option key={v}>{v}</option>)}
                                    </select>
                                </div>
                            </div>
                            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '1rem', marginTop: '1rem' }}>
                                <button style={{ minWidth: 120, padding: '0.65rem 1.25rem', borderRadius: 8, background: '#f1f5f9', border: 'none', cursor: 'pointer', fontWeight: 600, color: '#64748b' }} onClick={onClose}>Cancelar</button>
                                <button disabled={!clientId || !obraId} onClick={() => setStep(2)}
                                    style={{ minWidth: 140, padding: '0.65rem 1.25rem', borderRadius: 8, background: '#3b82f6', color: 'white', border: 'none', cursor: (!clientId || !obraId) ? 'not-allowed' : 'pointer', fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem', opacity: (!clientId || !obraId) ? 0.5 : 1 }}>
                                    Equipos <ChevronRight size={16} />
                                </button>
                            </div>
                        </div>
                    )}

                    {/* ─── Paso 2: Equipos ─── */}
                    {step === 2 && (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                            <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 12, padding: '1.25rem' }}>
                                <div style={{ fontSize: '0.85rem', fontWeight: 700, color: '#1e293b', marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                    <Package size={16} color="#3b82f6" /> Agregar Equipo
                                </div>
                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 80px 80px auto', gap: '1rem', alignItems: 'end' }}>
                                    <div>
                                        <label style={{ fontSize: '0.8rem', color: '#64748b', fontWeight: 600, display: 'block', marginBottom: '0.4rem' }}>Equipo</label>
                                        <select value={selProd} onChange={e => setSelProd(e.target.value)} style={SS}>
                                            <option value="">Seleccionar…</option>
                                            {productosActivos.map(p => (
                                                <option key={p.id} value={p.id}>
                                                    {p.name} — {fmtCOP(Number(p.value) || 0)}/día
                                                </option>
                                            ))}
                                        </select>
                                    </div>
                                    <div>
                                        <label style={{ fontSize: '0.8rem', color: '#64748b', fontWeight: 600, display: 'block', marginBottom: '0.4rem' }}>Cant.</label>
                                        <input type="number" min="1" value={selCant} onChange={e => setSelCant(Number(e.target.value) || 1)} style={IS} />
                                    </div>
                                    <div>
                                        <label style={{ fontSize: '0.8rem', color: '#64748b', fontWeight: 600, display: 'block', marginBottom: '0.4rem' }}>Días</label>
                                        <input type="number" min="1" value={selDias} onChange={e => setSelDias(Number(e.target.value) || 1)} style={IS} />
                                    </div>
                                    <button onClick={addItem} disabled={!selProd}
                                        style={{ height: 42, padding: '0 1rem', background: selProd ? '#3b82f6' : '#e2e8f0', color: selProd ? 'white' : '#94a3b8', border: 'none', borderRadius: 8, cursor: selProd ? 'pointer' : 'not-allowed', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700 }}>
                                        <Plus size={18} />
                                    </button>
                                </div>
                            </div>

                            {items.length > 0 ? (
                                <div style={{ border: '1px solid #e2e8f0', borderRadius: 12, overflow: 'hidden' }}>
                                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
                                        <thead>
                                            <tr style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0' }}>
                                                {['Equipo', 'Cant.', 'Días', 'Tarifa/día', 'Subtotal', ''].map(h => (
                                                    <th key={h} style={{ padding: '0.75rem 1rem', textAlign: 'left', fontSize: '0.7rem', color: '#64748b', fontWeight: 700, textTransform: 'uppercase' }}>{h}</th>
                                                ))}
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {items.map((item, idx) => (
                                                <tr key={idx} style={{ borderBottom: '1px solid #f1f5f9' }}>
                                                    <td style={{ padding: '0.75rem 1rem', fontWeight: 600, color: '#1e293b' }}>{item.nombre}</td>
                                                    <td style={{ padding: '0.75rem 1rem' }}>{item.cantidad}</td>
                                                    <td style={{ padding: '0.75rem 1rem' }}>{item.dias}</td>
                                                    <td style={{ padding: '0.75rem 1rem', color: '#10b981', fontWeight: 500 }}>{fmtCOP(Number(item.tarifaDia) || 0)}</td>
                                                    <td style={{ padding: '0.75rem 1rem', fontWeight: 700, color: '#1e293b' }}>{fmtCOP((Number(item.cantidad) || 0) * (Number(item.dias) || 0) * (Number(item.tarifaDia) || 0))}</td>
                                                    <td style={{ padding: '0.75rem 1rem', textAlign: 'right' }}>
                                                        <button onClick={() => setItems(prev => prev.filter((_, i) => i !== idx))}
                                                            style={{ background: '#fee2e2', border: 'none', cursor: 'pointer', color: '#ef4444', display: 'inline-flex', padding: '0.4rem', borderRadius: 6 }}>
                                                            <X size={14} />
                                                        </button>
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            ) : (
                                <div style={{ textAlign: 'center', padding: '2rem', color: '#94a3b8', border: '2px dashed #e2e8f0', borderRadius: 12, fontSize: '0.9rem', fontWeight: 500 }}>
                                    No hay equipos agregados.<br />Selecciona un equipo arriba y haz clic en +
                                </div>
                            )}

                            <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '1rem' }}>
                                <button onClick={() => setStep(1)} style={{ minWidth: 120, padding: '0.65rem 1.25rem', borderRadius: 8, background: '#f1f5f9', border: 'none', cursor: 'pointer', fontWeight: 600, color: '#64748b' }}>← Atrás</button>
                                <button disabled={items.length === 0} onClick={() => setStep(3)}
                                    style={{ minWidth: 140, padding: '0.65rem 1.25rem', borderRadius: 8, background: '#3b82f6', color: 'white', border: 'none', cursor: items.length === 0 ? 'not-allowed' : 'pointer', fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem', opacity: items.length === 0 ? 0.5 : 1 }}>
                                    Condiciones <ChevronRight size={16} />
                                </button>
                            </div>
                        </div>
                    )}

                    {/* ─── Paso 3: Condiciones ─── */}
                    {step === 3 && (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                                <div>
                                    <label style={{ fontSize: '0.8rem', color: '#64748b', fontWeight: 600, display: 'block', marginBottom: '0.4rem' }}>Método de Pago</label>
                                    <select value={metodoPago} onChange={e => setMetodoPago(e.target.value)} style={SS}>
                                        {['Contado', 'Crédito 15 días', 'Crédito 30 días', 'Crédito 45 días', 'Crédito 60 días'].map(v => <option key={v}>{v}</option>)}
                                    </select>
                                </div>
                                <div>
                                    <label style={{ fontSize: '0.8rem', color: '#64748b', fontWeight: 600, display: 'block', marginBottom: '0.4rem' }}>Responsable del Transporte</label>
                                    <select value={respTransporte} onChange={e => setRespTransporte(e.target.value)} style={SS}>
                                        {['CIELO', 'Cliente', 'Tercero / Fletadora'].map(v => <option key={v}>{v}</option>)}
                                    </select>
                                </div>
                            </div>
                            <div>
                                <label style={{ fontSize: '0.8rem', color: '#64748b', fontWeight: 600, display: 'block', marginBottom: '0.4rem' }}>Costo Transporte ($)</label>
                                <input type="number" min="0" value={transporte} onChange={e => setTransporte(e.target.value)} style={IS} />
                            </div>
                            <div>
                                <label style={{ fontSize: '0.8rem', color: '#64748b', fontWeight: 600, display: 'block', marginBottom: '0.4rem' }}>Notas Adicionales</label>
                                <textarea value={notas} onChange={e => setNotas(e.target.value)} rows={4} style={{ ...IS, resize: 'vertical' }} placeholder="Condiciones especiales, descuentos, observaciones…" />
                            </div>
                            <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '1rem' }}>
                                <button onClick={() => setStep(2)} style={{ minWidth: 120, padding: '0.65rem 1.25rem', borderRadius: 8, background: '#f1f5f9', border: 'none', cursor: 'pointer', fontWeight: 600, color: '#64748b' }}>← Atrás</button>
                                <button onClick={() => setStep(4)} style={{ minWidth: 140, padding: '0.65rem 1.25rem', borderRadius: 8, background: '#3b82f6', color: 'white', border: 'none', cursor: 'pointer', fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem' }}>
                                    Revisar <ChevronRight size={16} />
                                </button>
                            </div>
                        </div>
                    )}

                    {/* ─── Paso 4: Resumen ─── */}
                    {step === 4 && (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                            <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 12, padding: '1.25rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                <div>
                                    <div style={{ fontWeight: 800, fontSize: '1.1rem', color: '#1e293b' }}>{selectedClient?.name}</div>
                                    <div style={{ fontSize: '0.85rem', color: '#64748b', marginTop: 4, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                        <MapPin size={14} /> {obras.find(o => o.id === obraId)?.nombre || obraId}
                                    </div>
                                </div>
                                <div style={{ background: '#e0e7ff', color: '#4f46e5', padding: '0.4rem 0.8rem', borderRadius: 8, fontSize: '0.8rem', fontWeight: 700 }}>Validez: {validez} días</div>
                            </div>

                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: '1rem' }}>
                                {[
                                    { k: 'Método Pago', v: metodoPago, c: '#3b82f6', Ic: CreditCard },
                                    { k: 'Transporte', v: fmtCOP(Number(transporte) || 0), c: '#f97316', Ic: Truck },
                                    { k: 'Entrega', v: plazoEntrega, c: '#10b981', Ic: Clock },
                                ].map(({ k, v, c, Ic }) => (
                                    <div key={k} style={{ border: '1px solid #e2e8f0', borderRadius: 10, padding: '0.85rem', display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                                        <div style={{ background: `${c}20`, padding: '0.5rem', borderRadius: 8 }}><Ic size={18} color={c} /></div>
                                        <div>
                                            <div style={{ fontSize: '0.7rem', color: '#64748b', fontWeight: 600, textTransform: 'uppercase' }}>{k}</div>
                                            <div style={{ fontWeight: 700, color: '#1e293b', marginTop: 2, fontSize: '0.9rem' }}>{v}</div>
                                        </div>
                                    </div>
                                ))}
                            </div>

                            <div style={{ border: '1px solid #e2e8f0', borderRadius: 12, overflow: 'hidden' }}>
                                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
                                    <thead>
                                        <tr style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0' }}>
                                            {['Equipo', 'Cant.', 'Días', 'Tarifa/día', 'Subtotal'].map(h => (
                                                <th key={h} style={{ padding: '0.75rem 1rem', textAlign: 'left', color: '#64748b', fontSize: '0.7rem', fontWeight: 700, textTransform: 'uppercase' }}>{h}</th>
                                            ))}
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {items.map((item, idx) => (
                                            <tr key={idx} style={{ borderBottom: '1px solid #f1f5f9' }}>
                                                <td style={{ padding: '0.75rem 1rem', fontWeight: 600, color: '#1e293b' }}>{item.nombre}</td>
                                                <td style={{ padding: '0.75rem 1rem' }}>{item.cantidad}</td>
                                                <td style={{ padding: '0.75rem 1rem' }}>{item.dias}</td>
                                                <td style={{ padding: '0.75rem 1rem' }}>{fmtCOP(Number(item.tarifaDia) || 0)}</td>
                                                <td style={{ padding: '0.75rem 1rem', fontWeight: 700, color: '#10b981' }}>{fmtCOP((Number(item.cantidad) || 0) * (Number(item.dias) || 0) * (Number(item.tarifaDia) || 0))}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>

                            <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: '2rem', alignItems: 'center', background: '#f8fafc', padding: '1.25rem', borderRadius: 12, border: '1px solid #e2e8f0' }}>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem', fontSize: '0.9rem' }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between' }}><span style={{ color: '#64748b' }}>Subtotal alquiler</span><span style={{ fontWeight: 600 }}>{fmtCOP(subtotal)}</span></div>
                                    <div style={{ display: 'flex', justifyContent: 'space-between' }}><span style={{ color: '#64748b' }}>+ IVA {porcIVA}%</span><span style={{ fontWeight: 600 }}>{fmtCOP(iva)}</span></div>
                                    <div style={{ display: 'flex', justifyContent: 'space-between' }}><span style={{ color: '#64748b' }}>— Retención {porcRet}%</span><span style={{ fontWeight: 600, color: '#ef4444' }}>-{fmtCOP(ret)}</span></div>
                                    <div style={{ display: 'flex', justifyContent: 'space-between' }}><span style={{ color: '#64748b' }}>+ Transporte</span><span style={{ fontWeight: 600 }}>{fmtCOP(Number(transporte) || 0)}</span></div>
                                </div>
                                <div style={{ background: 'linear-gradient(135deg,#10b981,#059669)', borderRadius: 12, padding: '1.25rem 2rem', textAlign: 'center', boxShadow: '0 4px 14px rgba(16,185,129,0.3)' }}>
                                    <div style={{ fontSize: '0.7rem', color: 'rgba(255,255,255,0.85)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em' }}>Total Estimado</div>
                                    <div style={{ fontSize: '1.6rem', fontWeight: 900, color: 'white', marginTop: 4 }}>{fmtCOP(total)}</div>
                                </div>
                            </div>

                            <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '1rem' }}>
                                <button onClick={() => setStep(3)} style={{ minWidth: 120, padding: '0.65rem 1.25rem', borderRadius: 8, background: '#f1f5f9', border: 'none', cursor: 'pointer', fontWeight: 600, color: '#64748b' }}>← Atrás</button>
                                <button onClick={handleSave} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', minWidth: 180, justifyContent: 'center', padding: '0.65rem 1.5rem', borderRadius: 8, background: '#3b82f6', color: 'white', border: 'none', cursor: 'pointer', fontWeight: 700 }}>
                                    <FilePlus size={18} /> Generar Cotización
                                </button>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
