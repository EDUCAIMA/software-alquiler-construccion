import React, { useState, useMemo } from 'react';
import { format } from 'date-fns';
import {
    FilePlus, CheckCircle, X, ChevronRight,
    MapPin, Package, Truck, Search, Plus, Minus, Trash2
} from 'lucide-react';
import { fmtCOP } from './CotizacionesHelpers';
import { useAppContext } from '../context/AppContext';

export default function NuevaCotizacionModal({ onClose, onSave, clients, products, initialData }) {
    const [step, setStep] = useState(1);
    const [clientId, setClientId] = useState(initialData?.clientId || '');
    const [obraId, setObraId] = useState(initialData?.obraId || '');
    const { settings } = useAppContext();
    const [respTransporte, setRespTransporte] = useState(initialData?.responsableTransporte || settings?.shortName || 'CIELO');
    const [transporte, setTransporte] = useState(initialData?.transporte || 0);
    const [notas, setNotas] = useState(initialData?.notas || '');
    const [items, setItems] = useState(initialData?.items ? [...initialData.items] : []);
    const [searchTerm, setSearchTerm] = useState('');
    const [defaultDays, setDefaultDays] = useState(1);

    const selectedClient = clients.find(c => c.id === clientId);
    const obras = selectedClient?.obras || [];

    const filteredProducts = useMemo(() => {
        return (products || []).filter(p => 
            p.estado !== 'Dado de baja' && 
            (p.name.toLowerCase().includes(searchTerm.toLowerCase()) || p.id.toLowerCase().includes(searchTerm.toLowerCase()))
        );
    }, [products, searchTerm]);

    const subtotal = items.reduce((s, i) => s + (Number(i.cantidad) || 0) * (Number(i.dias) || 0) * (Number(i.tarifaDia) || 0), 0);
    const porcIVA = selectedClient?.responsableIVA ? (Number(selectedClient?.porcIVA) || 0) : 0;
    const porcRet = Number(selectedClient?.porcRetencion) || 0;
    const iva = Math.round(subtotal * porcIVA / 100);
    const ret = Math.round(subtotal * porcRet / 100);
    const total = subtotal + iva + ret + (Number(transporte) || 0);

    const handleProductClick = (prod) => {
        const existingIdx = items.findIndex(i => i.productId === prod.id);
        if (existingIdx >= 0) {
            const newItems = [...items];
            newItems[existingIdx].cantidad += 1;
            setItems(newItems);
        } else {
            setItems([...items, {
                productId: prod.id,
                nombre: prod.name,
                cantidad: 1,
                dias: defaultDays,
                tarifaDia: Number(prod.value) || 0
            }]);
        }
    };

    const updateItemQty = (idx, delta) => {
        const newItems = [...items];
        newItems[idx].cantidad = Math.max(1, newItems[idx].cantidad + delta);
        setItems(newItems);
    };

    const updateItemDays = (idx, days) => {
        const newItems = [...items];
        newItems[idx].dias = Math.max(1, Number(days) || 1);
        setItems(newItems);
    };

    const removeItem = (idx) => {
        setItems(items.filter((_, i) => i !== idx));
    };

    const handleSave = () => {
        if (!clientId || !obraId || items.length === 0) return;
        onSave({
            clientId, obraId, 
            responsableTransporte: respTransporte,
            transporte: Number(transporte) || 0,
            notas, items,
            validezDias: 15, // Default as requested to remove field
            metodoPago: 'Crédito 30 días', // Default as requested to remove field
            plazoEntrega: '24 horas' // Default as requested to remove field
        });
        onClose();
    };

    const IS = {
        width: '100%', padding: '0.65rem 0.8rem', boxSizing: 'border-box',
        background: '#f8fafc', border: '1px solid #e2e8f0',
        borderRadius: 8, color: '#1e293b', fontSize: '0.85rem', outline: 'none'
    };

    if (step === 2) {
        return (
            <div style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.7)', backdropFilter: 'blur(8px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '2rem' }}>
                <div 
                onClick={e => e.stopPropagation()}
                style={{ background: '#ffffff', borderRadius: 20, boxShadow: '0 25px 50px -12px rgba(0,0,0,0.25)', width: '100%', maxWidth: 800, maxHeight: '90vh', display: 'flex', flexDirection: 'column' }}>
                    <div style={{ padding: '1.5rem 2rem', borderBottom: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#f8fafc', borderTopLeftRadius: 20, borderTopRightRadius: 20 }}>
                        <h3 style={{ margin: 0, color: '#1e293b', fontSize: '1.25rem', fontWeight: 800 }}>Resumen de Cotización</h3>
                        <button onClick={() => setStep(1)} style={{ background: 'none', border: 'none', color: '#64748b', cursor: 'pointer', fontWeight: 600 }}>← Volver a editar</button>
                    </div>
                    <div style={{ padding: '2rem', overflowY: 'auto' }}>
                        <div style={{ background: '#f1f5f9', borderRadius: 12, padding: '1.25rem', marginBottom: '1.5rem', display: 'flex', justifyContent: 'space-between' }}>
                            <div>
                                <div style={{ fontSize: '0.75rem', color: '#64748b', fontWeight: 700, textTransform: 'uppercase' }}>Cliente</div>
                                <div style={{ fontWeight: 800, color: '#1e293b', fontSize: '1.1rem' }}>{selectedClient?.name}</div>
                            </div>
                            <div style={{ textAlign: 'right' }}>
                                <div style={{ fontSize: '0.75rem', color: '#64748b', fontWeight: 700, textTransform: 'uppercase' }}>Obra</div>
                                <div style={{ fontWeight: 800, color: '#1e293b', fontSize: '1.1rem' }}>{obras.find(o => o.id === obraId)?.nombre}</div>
                            </div>
                        </div>

                        <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: '1.5rem' }}>
                            <thead>
                                <tr style={{ borderBottom: '2px solid #e2e8f0' }}>
                                    <th style={{ textAlign: 'left', padding: '0.75rem', fontSize: '0.75rem', color: '#64748b' }}>EQUIPO</th>
                                    <th style={{ textAlign: 'center', padding: '0.75rem', fontSize: '0.75rem', color: '#64748b' }}>CANT.</th>
                                    <th style={{ textAlign: 'center', padding: '0.75rem', fontSize: '0.75rem', color: '#64748b' }}>DÍAS</th>
                                    <th style={{ textAlign: 'right', padding: '0.75rem', fontSize: '0.75rem', color: '#64748b' }}>SUBTOTAL</th>
                                </tr>
                            </thead>
                            <tbody>
                                {items.map((item, i) => (
                                    <tr key={i} style={{ borderBottom: '1px solid #f1f5f9' }}>
                                        <td style={{ padding: '0.75rem', fontWeight: 600 }}>{item.nombre}</td>
                                        <td style={{ padding: '0.75rem', textAlign: 'center' }}>{item.cantidad}</td>
                                        <td style={{ padding: '0.75rem', textAlign: 'center' }}>{item.dias}</td>
                                        <td style={{ padding: '0.75rem', textAlign: 'right', fontWeight: 700 }}>{fmtCOP(item.cantidad * item.dias * item.tarifaDia)}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>

                        <div style={{ background: '#1e293b', borderRadius: 16, padding: '1.5rem', color: 'white' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                                <span style={{ opacity: 0.7 }}>Subtotal</span>
                                <span>{fmtCOP(subtotal)}</span>
                            </div>
                            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                                <span style={{ opacity: 0.7 }}>IVA ({porcIVA}%)</span>
                                <span>{fmtCOP(iva)}</span>
                            </div>
                            {ret > 0 && (
                                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                                    <span style={{ opacity: 0.7 }}>Retención ({porcRet}%)</span>
                                    <span>-{fmtCOP(ret)}</span>
                                </div>
                            )}
                            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '1rem' }}>
                                <span style={{ opacity: 0.7 }}>Transporte</span>
                                <span>{fmtCOP(Number(transporte))}</span>
                            </div>
                            <div style={{ borderTop: '1px solid rgba(255,255,255,0.1)', paddingTop: '1rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                <span style={{ fontSize: '1.1rem', fontWeight: 600 }}>Total Estimado</span>
                                <span style={{ fontSize: '1.8rem', fontWeight: 900, color: '#10b981' }}>{fmtCOP(total)}</span>
                            </div>
                        </div>
                    </div>
                    <div style={{ padding: '1.5rem 2rem', borderTop: '1px solid #e2e8f0', display: 'flex', gap: '1rem' }}>
                        <button onClick={() => setStep(1)} style={{ flex: 1, padding: '0.75rem', borderRadius: 10, border: '1px solid #e2e8f0', background: 'white', fontWeight: 700, cursor: 'pointer' }}>Editar Detalles</button>
                        <button onClick={handleSave} style={{ flex: 2, padding: '0.75rem', borderRadius: 10, border: 'none', background: '#2365AB', color: 'white', fontWeight: 800, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem' }}>
                            <CheckCircle size={20} /> Confirmar y Generar
                        </button>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.7)', backdropFilter: 'blur(8px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '1.5rem' }}>
            <div 
                onClick={e => e.stopPropagation()}
                style={{ background: '#ffffff', borderRadius: 24, boxShadow: '0 25px 50px -12px rgba(0,0,0,0.25)', width: '100%', maxWidth: 1240, height: '92vh', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
                
                {/* Header */}
                <div style={{ padding: '1.25rem 2.5rem', borderBottom: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#f8fafc' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                        <div style={{ background: '#2365AB', color: 'white', padding: '0.6rem', borderRadius: 12 }}><FilePlus size={24} /></div>
                        <div>
                            <h2 style={{ margin: 0, fontSize: '1.4rem', fontWeight: 900, color: '#1e293b' }}>Nueva Cotización</h2>
                            <p style={{ margin: 0, fontSize: '0.8rem', color: '#64748b' }}>Configure el cliente y seleccione los equipos para la propuesta.</p>
                        </div>
                    </div>
                    <button onClick={onClose} style={{ background: '#f1f5f9', border: 'none', borderRadius: '50%', width: 40, height: 40, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: '#64748b' }}><X size={20} /></button>
                </div>

                <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
                    
                    {/* Left Panel: Configuration & Product Grid */}
                    <div style={{ flex: 2, display: 'flex', flexDirection: 'column', borderRight: '1px solid #e2e8f0', background: '#ffffff' }}>
                        
                        {/* Config Area */}
                        <div style={{ padding: '1.5rem 2.5rem', borderBottom: '1px solid #f1f5f9', display: 'grid', gridTemplateColumns: '2fr 1fr 1fr', gap: '1.25rem', alignItems: 'end' }}>
                            <div>
                                <label style={{ fontSize: '0.75rem', fontWeight: 800, color: '#64748b', display: 'block', marginBottom: '0.5rem', textTransform: 'uppercase' }}>Cliente *</label>
                                <select value={clientId} onChange={e => { setClientId(e.target.value); setObraId(''); }} style={IS}>
                                    <option value="">Seleccione Cliente</option>
                                    {clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                                </select>
                            </div>
                            <div>
                                <label style={{ fontSize: '0.75rem', fontWeight: 800, color: '#64748b', display: 'block', marginBottom: '0.5rem', textTransform: 'uppercase' }}>Obra *</label>
                                <select value={obraId} onChange={e => setObraId(e.target.value)} disabled={!clientId} style={IS}>
                                    <option value="">Seleccione Obra</option>
                                    {obras.map(o => <option key={o.id} value={o.id}>{o.nombre}</option>)}
                                </select>
                            </div>
                            <div>
                                <label style={{ fontSize: '0.75rem', fontWeight: 800, color: '#64748b', display: 'block', marginBottom: '0.5rem', textTransform: 'uppercase' }}>Transporte ($)</label>
                                <input type="number" value={transporte} onChange={e => setTransporte(e.target.value)} style={IS} placeholder="0" />
                            </div>
                        </div>

                        {/* Product Grid Area */}
                        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
                            <div style={{ padding: '1rem 2.5rem', background: '#f8fafc', display: 'flex', alignItems: 'center', gap: '1rem', borderBottom: '1px solid #e2e8f0' }}>
                                <div style={{ position: 'relative', flex: 1 }}>
                                    <Search size={18} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }} />
                                    <input 
                                        value={searchTerm} 
                                        onChange={e => setSearchTerm(e.target.value)}
                                        placeholder="Buscar equipos o herramientas por nombre o código..." 
                                        style={{ ...IS, paddingLeft: '2.8rem', background: 'white' }} 
                                    />
                                </div>
                            </div>

                            <div style={{ flex: 1, overflowY: 'auto', padding: '1.5rem 2.5rem', display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: '1rem', alignContent: 'start' }}>
                                {filteredProducts.map(p => {
                                    const inList = items.find(i => i.productId === p.id);
                                    return (
                                        <div 
                                            key={p.id} 
                                            onClick={() => handleProductClick(p)}
                                            style={{ 
                                                padding: '0.5rem', borderRadius: 12, border: inList ? '2px solid #2365AB' : '1px solid #e2e8f0', 
                                                cursor: 'pointer', transition: 'all 0.2s', background: inList ? '#eff6ff' : 'white',
                                                display: 'flex', flexDirection: 'column', gap: '0.4rem', width: '100%',
                                                boxShadow: inList ? '0 4px 10px rgba(35, 101, 171, 0.08)' : '0 1px 3px rgba(0,0,0,0.02)'
                                            }}
                                            onMouseEnter={e => {
                                                e.currentTarget.style.borderColor = '#2365AB';
                                                e.currentTarget.style.boxShadow = '0 4px 12px rgba(0,0,0,0.05)';
                                            }}
                                            onMouseLeave={e => {
                                                e.currentTarget.style.borderColor = inList ? '#2365AB' : '#e2e8f0';
                                                e.currentTarget.style.boxShadow = inList ? '0 4px 10px rgba(35, 101, 171, 0.08)' : '0 1px 3px rgba(0,0,0,0.02)';
                                            }}
                                        >
                                            {/* Imagen del Producto - Más compacta */}
                                            <div style={{ 
                                                width: '100%', height: '85px', background: '#f8fafc', borderRadius: 8, 
                                                overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center',
                                                border: '1px solid #f1f5f9'
                                            }}>
                                                {p.image ? (
                                                    <img src={p.image} alt={p.name} style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
                                                ) : (
                                                    <Package size={28} color="#cbd5e1" strokeWidth={1.5} />
                                                )}
                                            </div>

                                            <div>
                                                <div style={{ fontSize: '0.8rem', fontWeight: 700, color: '#1e293b', lineHeight: 1.1, marginBottom: '0.2rem', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>{p.name}</div>
                                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                                    <div style={{ fontSize: '0.85rem', fontWeight: 800, color: '#10b981' }}>{fmtCOP(p.value)}<span style={{ fontSize: '0.6rem', color: '#64748b', fontWeight: 400 }}>/d</span></div>
                                                    {inList && (
                                                        <div style={{ background: '#2365AB', color: 'white', width: 22, height: 22, borderRadius: '6px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.7rem', fontWeight: 800 }}>
                                                            {inList.cantidad}
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    </div>

                    {/* Right Panel: Selected Items & Totals */}
                    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', background: '#f8fafc' }}>
                        <div style={{ padding: '1.5rem', borderBottom: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <h4 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '0.5rem', color: '#1e293b' }}>
                                <Package size={18} /> Equipos Seleccionados ({items.length})
                            </h4>
                            {items.length > 0 && <button onClick={() => setItems([])} style={{ background: 'none', border: 'none', color: '#ef4444', fontSize: '0.75rem', fontWeight: 600, cursor: 'pointer' }}>Vaciar lista</button>}
                        </div>

                        <div style={{ flex: 1, overflowY: 'auto', padding: '1rem' }}>
                            {items.length === 0 ? (
                                <div style={{ height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: '#94a3b8', textAlign: 'center' }}>
                                    <Package size={48} style={{ marginBottom: '1rem', opacity: 0.2 }} />
                                    <p style={{ fontSize: '0.9rem' }}>Haz clic en los equipos de la izquierda para agregarlos a la cotización.</p>
                                </div>
                            ) : (
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                                    {items.map((item, idx) => (
                                        <div key={idx} style={{ background: 'white', padding: '1rem', borderRadius: 16, border: '1px solid #e2e8f0', boxShadow: '0 2px 4px rgba(0,0,0,0.02)' }}>
                                            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.75rem' }}>
                                                <div style={{ fontWeight: 700, fontSize: '0.85rem', color: '#1e293b' }}>{item.nombre}</div>
                                                <button onClick={() => removeItem(idx)} style={{ background: 'none', border: 'none', color: '#cbd5e1', cursor: 'pointer' }}><Trash2 size={16} /></button>
                                            </div>
                                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                                    <div style={{ fontSize: '0.7rem', color: '#64748b', fontWeight: 600 }}>Cant:</div>
                                                    <div style={{ display: 'flex', alignItems: 'center', background: '#f1f5f9', borderRadius: 8, padding: '2px' }}>
                                                        <button onClick={() => updateItemQty(idx, -1)} style={{ background: 'white', border: 'none', width: 24, height: 24, borderRadius: 6, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Minus size={12} /></button>
                                                        <span style={{ width: 30, textAlign: 'center', fontWeight: 800, fontSize: '0.85rem' }}>{item.cantidad}</span>
                                                        <button onClick={() => updateItemQty(idx, 1)} style={{ background: 'white', border: 'none', width: 24, height: 24, borderRadius: 6, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Plus size={12} /></button>
                                                    </div>
                                                </div>
                                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                                    <div style={{ fontSize: '0.7rem', color: '#64748b', fontWeight: 600 }}>Días:</div>
                                                    <input 
                                                        type="number" 
                                                        min="1" 
                                                        value={item.dias} 
                                                        onChange={(e) => updateItemDays(idx, e.target.value)} 
                                                        style={{ width: '100%', padding: '0.3rem', border: '1px solid #e2e8f0', borderRadius: 8, textAlign: 'center', fontWeight: 700, fontSize: '0.85rem' }} 
                                                    />
                                                </div>
                                            </div>
                                            <div style={{ marginTop: '0.75rem', textAlign: 'right', borderTop: '1px dashed #f1f5f9', paddingTop: '0.5rem', fontWeight: 800, color: '#2365AB' }}>
                                                {fmtCOP(item.cantidad * item.dias * item.tarifaDia)}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>

                        {/* Totals Section */}
                        <div style={{ padding: '1.5rem', background: 'white', borderTop: '1px solid #e2e8f0' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem', fontSize: '0.85rem', color: '#64748b' }}>
                                <span>Subtotal</span>
                                <span style={{ fontWeight: 600, color: '#1e293b' }}>{fmtCOP(subtotal)}</span>
                            </div>
                            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '1rem', fontSize: '1.2rem', fontWeight: 900, color: '#1e293b' }}>
                                <span>Total Estimado</span>
                                <span style={{ color: '#10b981' }}>{fmtCOP(total)}</span>
                            </div>
                            <button 
                                disabled={!clientId || !obraId || items.length === 0}
                                onClick={() => setStep(2)}
                                style={{ 
                                    width: '100%', padding: '1rem', borderRadius: 16, border: 'none', 
                                    background: (!clientId || !obraId || items.length === 0) ? '#cbd5e1' : '#2365AB', 
                                    color: 'white', fontWeight: 800, fontSize: '1rem', cursor: 'pointer',
                                    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem',
                                    transition: 'all 0.2s'
                                }}
                            >
                                Siguiente Paso <ChevronRight size={20} />
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
