import React, { useState, useMemo } from 'react';
import { RotateCcw, X, Package, ArrowDownCircle, FileText, User, MapPin } from 'lucide-react';
import { format } from 'date-fns';

export default function DevolucionModal({ clientId: initialClientId, obraId: initialObraId, onClose, onSave, remisiones, products, clients }) {
    const [selClientId, setSelClientId] = useState(initialClientId || '');
    const [selObraId, setSelObraId] = useState(initialObraId || '');
    const [fechaDevolucion, setFechaDevolucion] = useState(format(new Date(), 'yyyy-MM-dd'));

    const client = clients.find(c => c.id === selClientId);
    const obra = client?.obras?.find(o => o.id === selObraId);

    // Construir totales en campo por producto (de remisiones activas/parciales)
    const enCampo = useMemo(() => {
        if (!selClientId || !selObraId) return [];
        const map = {};
        remisiones
            .filter(r => r.clientId === selClientId && r.obraId === selObraId && (r.estado === 'Activa' || r.estado === 'Parcial'))
            .forEach(r => {
                r.items.forEach(item => {
                    const prod = products.find(p => p.id === item.productId);
                    const isServ = (item.tipoCobro || '').toLowerCase().includes('servicio') ||
                                   (item.tipoCobro || '').toLowerCase().includes('única') ||
                                   (item.category || '').toLowerCase().includes('servicio') ||
                                   (prod?.category || '').toLowerCase().includes('servicio') ||
                                   (prod?.tipoCobro || '').toLowerCase().includes('servicio') ||
                                   (prod?.esquemaCobro || '').toLowerCase().includes('única');
                    if (isServ) return;

                    const pend = item.cantidad - item.cantidadDevuelta;
                    if (pend > 0) map[item.productId] = (map[item.productId] || 0) + pend;
                });
            });
        return Object.entries(map).map(([productId, cantidad]) => {
            const prod = products.find(p => p.id === productId);
            return { productId, nombre: prod?.name || productId, enCampo: cantidad, aDevolver: 0 };
        });
    }, [remisiones, selClientId, selObraId, products]);

    const [quantities, setQuantities] = useState({});

    // Reset quantities when client/obra changes
    useMemo(() => {
        setQuantities(Object.fromEntries(enCampo.map(i => [i.productId, 0])));
    }, [enCampo]);

    const setQ = (productId, val) => {
        const item = enCampo.find(i => i.productId === productId);
        setQuantities(prev => ({ ...prev, [productId]: Math.min(Number(val) || 0, item?.enCampo || 0) }));
    };

    const totalADevolver = Object.values(quantities).reduce((s, v) => s + v, 0);

    // PEPS simulation for display
    const pepsPreview = useMemo(() => {
        if (!selClientId || !selObraId) return [];
        const preview = [];
        const rems = remisiones
            .filter(r => r.clientId === selClientId && r.obraId === selObraId && (r.estado === 'Activa' || r.estado === 'Parcial'))
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
    }, [quantities, remisiones, selClientId, selObraId, products]);

    const [loading, setLoading] = useState(false);

    const handleDevolverTodo = () => {
        const allQty = {};
        enCampo.forEach(item => {
            allQty[item.productId] = item.enCampo;
        });
        setQuantities(allQty);
    };

    const handleSave = async () => {
        const devoluciones = Object.entries(quantities)
            .filter(([, v]) => v > 0)
            .map(([productId, cantidad]) => ({ productId, cantidad }));
        if (devoluciones.length === 0) return;

        setLoading(true);
        try {
            await onSave(selClientId, selObraId, devoluciones, fechaDevolucion);
            onClose();
        } catch (error) {
            console.error('Error saving return:', error);
            alert('Error al procesar la devolución: ' + error.message);
        } finally {
            setLoading(false);
        }
    };

    const inputStyle = { width: '100%', padding: '0.55rem 0.75rem', background: '#ffffff', border: '1px solid #cbd5e1', borderRadius: '8px', color: '#104166', fontSize: '0.875rem', textAlign: 'center', boxSizing: 'border-box', outline: 'none' };
    const selectStyle = { width: '100%', padding: '0.65rem 0.75rem', background: '#ffffff', border: '1px solid #cbd5e1', borderRadius: '10px', color: '#1e293b', fontSize: '0.9rem', outline: 'none', transition: 'all 0.2s' };

    return (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(15, 23, 42, 0.6)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'flex-start', justifyContent: 'center', zIndex: 1100, padding: '1rem' }}>
            <div style={{ background: '#ffffff', borderRadius: '16px', boxShadow: '0 20px 40px rgba(0,0,0,0.15)', width: '100%', maxWidth: 950, maxHeight: '90vh', display: 'flex', flexDirection: 'column', marginTop: '4vh', transition: 'all 0.2s ease-out' }}>
                {/* Header */}
                <div style={{ padding: '1rem 2rem', borderBottom: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#ffffff', borderTopLeftRadius: '16px', borderTopRightRadius: '16px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                        <RotateCcw size={20} style={{ color: '#f97316' }} />
                        <h3 style={{ margin: 0, color: '#104166', fontSize: '1.1rem', fontWeight: 700 }}>Registrar Devolución</h3>
                    </div>
                    <button onClick={onClose} style={{ background: 'transparent', border: 'none', borderRadius: '50%', width: 32, height: 32, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: '#64748b' }}><X size={18} /></button>
                </div>

                <div style={{ padding: '1.25rem 2rem', overflowY: 'auto', flex: 1 }}>
                    {/* SELECTION AREA */}
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem', marginBottom: '1.5rem', paddingBottom: '1.5rem', borderBottom: '1px solid #f1f5f9' }}>
                        <div>
                            <label style={{ fontSize: '0.7rem', color: '#64748b', fontWeight: 700, display: 'flex', alignItems: 'center', gap: 6, marginBottom: '0.4rem', textTransform: 'uppercase' }}>
                                <User size={12} /> Cliente
                            </label>
                            <select 
                                value={selClientId} 
                                onChange={e => { setSelClientId(e.target.value); setSelObraId(''); }}
                                style={{ ...selectStyle, padding: '0.5rem 0.75rem' }}
                                disabled={!!initialClientId}
                            >
                                <option value="">-- Busca un cliente --</option>
                                {clients
                                    .filter(c => (c.obras || []).some(o => remisiones.some(r => r.clientId === c.id && r.obraId === o.id && (r.estado === 'Activa' || r.estado === 'Parcial'))))
                                    .map(c => <option key={c.id} value={c.id}>{c.name}</option>)
                                }
                            </select>
                        </div>
                        <div>
                            <label style={{ fontSize: '0.7rem', color: '#64748b', fontWeight: 700, display: 'flex', alignItems: 'center', gap: 6, marginBottom: '0.4rem', textTransform: 'uppercase' }}>
                                <MapPin size={12} /> Obra
                            </label>
                            <select 
                                value={selObraId} 
                                onChange={e => setSelObraId(e.target.value)}
                                disabled={!!initialObraId || !selClientId}
                                style={{ ...selectStyle, padding: '0.5rem 0.75rem', background: (!selClientId || initialObraId) ? '#f8fafc' : 'white' }}
                            >
                                <option value="">-- Selecciona obra --</option>
                                {selClientId && (clients.find(c => c.id === selClientId)?.obras || [])
                                    .filter(o => remisiones.some(r => r.clientId === selClientId && r.obraId === o.id && (r.estado === 'Activa' || r.estado === 'Parcial')))
                                    .map(o => <option key={o.id} value={o.id}>{o.nombre}</option>)
                                }
                            </select>
                        </div>
                    </div>

                    {!selClientId || !selObraId ? (
                        <div style={{ textAlign: 'center', padding: '3rem 2rem', color: '#94a3b8' }}>
                            <Package size={40} style={{ opacity: 0.2, margin: '0 auto 1rem auto', display: 'block' }} />
                            <div style={{ fontSize: '0.9rem', fontWeight: 500 }}>Selecciona cliente y obra</div>
                        </div>
                    ) : enCampo.length === 0 ? (
                        <div style={{ textAlign: 'center', padding: '2rem', color: '#94a3b8', border: '1px dashed #cbd5e1', borderRadius: '8px' }}>
                            <div style={{ fontSize: '0.9rem' }}>No hay equipos activos en esta obra.</div>
                        </div>
                    ) : (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                            {/* Header Section: Title + Date */}
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                                    <h4 style={{ margin: 0, fontSize: '0.75rem', color: '#64748b', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                                        Equipos para devolución
                                    </h4>
                                    <button 
                                        type="button"
                                        onClick={handleDevolverTodo}
                                        style={{ 
                                            background: '#f97316', 
                                            border: 'none', 
                                            color: '#ffffff', 
                                            fontWeight: 700, 
                                            fontSize: '0.72rem', 
                                            padding: '0.35rem 0.75rem', 
                                            borderRadius: '6px', 
                                            cursor: 'pointer',
                                            transition: 'all 0.15s ease'
                                        }}
                                        onMouseEnter={e => { e.currentTarget.style.background = '#ea580c'; }}
                                        onMouseLeave={e => { e.currentTarget.style.background = '#f97316'; }}
                                    >
                                        Devolver Todo
                                    </button>
                                </div>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                                    <span style={{ fontSize: '0.75rem', color: '#64748b', fontWeight: 700, textTransform: 'uppercase' }}>Reingreso:</span>
                                    <input 
                                        type="date" 
                                        value={fechaDevolucion} 
                                        onChange={e => setFechaDevolucion(e.target.value)} 
                                        style={{ ...inputStyle, textAlign: 'left', width: '130px', height: '30px', padding: '0 0.5rem', fontSize: '0.85rem' }} 
                                    />
                                </div>
                            </div>

                            {/* Quantities to return Table */}
                            <div>
                                <div style={{ background: '#ffffff', borderRadius: '12px', border: '1px solid #e2e8f0', overflow: 'hidden' }}>
                                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 140px 100px', padding: '0.6rem 1rem', background: '#f8fafc', borderBottom: '1px solid #e2e8f0', fontSize: '0.65rem', color: '#94a3b8', fontWeight: 700, textTransform: 'uppercase' }}>
                                        <span>Descripción</span>
                                        <span style={{ textAlign: 'center' }}>En Campo</span>
                                        <span style={{ textAlign: 'center' }}>Cantidad</span>
                                    </div>
                                    <div style={{ display: 'flex', flexDirection: 'column' }}>
                                        {enCampo.map((item, idx) => (
                                            <div key={item.productId} style={{ 
                                                display: 'grid', 
                                                gridTemplateColumns: '1fr 140px 100px', 
                                                gap: '1rem', 
                                                alignItems: 'center', 
                                                padding: '0.5rem 1rem', 
                                                borderBottom: idx === enCampo.length - 1 ? 'none' : '1px solid #f1f5f9',
                                                background: quantities[item.productId] > 0 ? '#fff7ed' : 'transparent'
                                            }}>
                                                <div style={{ fontWeight: 600, fontSize: '0.85rem', color: '#1e293b' }}>{item.nombre}</div>
                                                <div style={{ textAlign: 'center', fontSize: '0.8rem', color: '#64748b' }}>{item.enCampo} ud.</div>
                                                <input 
                                                    type="number" 
                                                    min="0" 
                                                    max={item.enCampo} 
                                                    value={quantities[item.productId] || ''} 
                                                    onChange={e => setQ(item.productId, e.target.value)} 
                                                    style={{ width: '100%', height: '28px', fontSize: '0.9rem', fontWeight: 700, textAlign: 'center', border: '1px solid #cbd5e1', borderRadius: '4px', outline: 'none' }} 
                                                    placeholder="0" 
                                                />
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            </div>

                            {/* PEPS Preview */}
                            {pepsPreview.length > 0 && (
                                <div style={{ border: '1px solid #e2e8f0', borderRadius: '8px', padding: '1rem', background: '#f8fafc' }}>
                                    <h4 style={{ margin: '0 0 0.75rem 0', fontSize: '0.7rem', color: '#64748b', fontWeight: 700, textTransform: 'uppercase' }}>
                                        Lógica PEPS Aplicada
                                    </h4>
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                                        {pepsPreview.map(p => (
                                            <div key={p.id} style={{ background: '#ffffff', borderRadius: '6px', padding: '0.6rem 0.75rem', border: '1px solid #e2e8f0' }}>
                                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.4rem' }}>
                                                    <span style={{ fontSize: '0.75rem', color: '#64748b', fontWeight: 600 }}>Remisión del {p.fecha}</span>
                                                    {p.seCierra && <span style={{ fontSize: '0.6rem', color: '#10b981', fontWeight: 700 }}>SE CIERRA</span>}
                                                </div>
                                                <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                                                    {p.items.map((it, i) => (
                                                        <div key={i} style={{ fontSize: '0.75rem', color: '#1e293b', display: 'flex', justifyContent: 'space-between' }}>
                                                            <span>{it.nombre}</span>
                                                            <span style={{ fontWeight: 700, color: '#f97316' }}>{it.descuento} ud.</span>
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>
                    )}
                </div>

                <div style={{ padding: '1rem 2rem', background: '#ffffff', borderTop: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottomLeftRadius: '16px', borderBottomRightRadius: '16px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <span style={{ fontSize: '0.85rem', color: '#64748b' }}>Total:</span>
                        <span style={{ color: '#104166', fontWeight: 800, fontSize: '1.25rem' }}>{totalADevolver}</span>
                    </div>
                    <div style={{ display: 'flex', gap: '0.75rem' }}>
                        <button className="btn btn-secondary" onClick={onClose} style={{ height: '40px', padding: '0 1.5rem' }}>Cancelar</button>
                        <button className="btn btn-primary" disabled={totalADevolver === 0 || loading} onClick={handleSave}
                            style={{ background: (totalADevolver === 0 || loading) ? '#cbd5e1' : '#f97316', border: 'none', color: 'white', fontWeight: 700, padding: '0 1.5rem', borderRadius: '8px', cursor: (totalADevolver === 0 || loading) ? 'not-allowed' : 'pointer', height: '40px' }}>
                            {loading ? 'Procesando...' : 'Procesar Devolución'}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}
