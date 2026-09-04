import React, { useState, useMemo } from 'react';
import { format } from 'date-fns';
import {
    FilePlus, CheckCircle, X, ChevronRight, ChevronDown,
    MapPin, Package, Search, Plus, Minus, Trash2, Flame
} from 'lucide-react';
import { fmtCOP, calcularHorasAlquiler, calcularHoraFin } from './CotizacionesHelpers';
import { useAppContext } from '../context/AppContext';
import Swal from 'sweetalert2';

export default function NuevaCotizacionModal({ onClose, onSave, clients, products, initialData }) {
    const { remisiones = [], cotizaciones = [] } = useAppContext();
    const [step, setStep] = useState(1);
    const [clientId, setClientId] = useState(initialData?.clientId || '');
    const [obraId, setObraId] = useState(initialData?.obraId || '');
    const [clientSearch, setClientSearch] = useState(() => {
        if (initialData?.clientId) {
            const found = (clients || []).find(c => c.id === initialData.clientId);
            return found?.name || '';
        }
        return '';
    });
    const [clientDropdownOpen, setClientDropdownOpen] = useState(false);
    const [notas, setNotas] = useState(initialData?.notas || 'Cotización sujeto a disponibilidad de equipos.');
    const [items, setItems] = useState(initialData?.items ? [...initialData.items] : []);
    const [searchTerm, setSearchTerm] = useState('');
    const [filterPropiedad, setFilterPropiedad] = useState('Todos'); // 'Todos' | 'Propio' | 'Terceros'
    const [defaultDays, setDefaultDays] = useState(1);

    const selectedClient = clients.find(c => c.id === clientId);
    const obras = selectedClient?.obras || [];

    // ─── Mapa de Popularidad / Veces Alquilado ──────────────────────────────────
    // Se computa la cantidad total alquilada y despachada para cada producto
    const popularidadMap = useMemo(() => {
        const counts = new Map();

        // 1. Contabilizar desde Remisiones (despachos reales / alquileres en curso e históricos)
        (remisiones || []).forEach(rem => {
            (rem.items || []).forEach(it => {
                const pId = it.productId;
                const qty = Number(it.cantidad) || 1;
                if (pId) {
                    counts.set(pId, (counts.get(pId) || 0) + qty);
                }
                // Si el item tiene nombre pero no productId exacto, buscar por coincidencia
                if (it.nombre) {
                    const normName = it.nombre.trim().toLowerCase();
                    counts.set(normName, (counts.get(normName) || 0) + qty);
                }
            });
        });

        // 2. Contabilizar también desde Cotizaciones Aprobadas / Activas
        (cotizaciones || []).forEach(cot => {
            if (['Aprobada', 'Facturada', 'En Ejecución', 'Activa', 'Completada'].includes(cot.estado)) {
                (cot.items || []).forEach(it => {
                    const pId = it.productId;
                    const qty = Number(it.cantidad) || 1;
                    if (pId) {
                        counts.set(pId, (counts.get(pId) || 0) + qty);
                    }
                });
            }
        });

        return counts;
    }, [remisiones, cotizaciones]);

    const filteredClients = useMemo(() => {
        if (!clients || !Array.isArray(clients)) return [];
        const query = clientSearch.trim().toLowerCase();
        return clients.filter(c => 
            (c.name || '').toLowerCase().includes(query) ||
            (c.nit || c.cedula || c.documento || '').toLowerCase().includes(query) ||
            (c.phone || c.telefono || '').toLowerCase().includes(query)
        );
    }, [clients, clientSearch]);

    const handleSelectClient = (c) => {
        setClientId(c.id);
        setObraId('');
        setClientSearch(c.name);
        setClientDropdownOpen(false);
    };

    const filteredProducts = useMemo(() => {
        const list = (products || []).filter(p => {
            const isBaja = p.estado === 'Dado de baja';
            const matchesQuery = p.name.toLowerCase().includes(searchTerm.toLowerCase()) || p.id.toLowerCase().includes(searchTerm.toLowerCase());
            const isTerceros = p.tipoPropiedad === 'Terceros';
            const matchesPropiedad = filterPropiedad === 'Todos' ? true : (filterPropiedad === 'Propio' ? !isTerceros : isTerceros);
            return !isBaja && matchesQuery && matchesPropiedad;
        });

        // Ordenamiento dinámico descendente: primero los más alquilados
        return list.sort((a, b) => {
            const countA = popularidadMap.get(a.id) || popularidadMap.get((a.name || '').trim().toLowerCase()) || 0;
            const countB = popularidadMap.get(b.id) || popularidadMap.get((b.name || '').trim().toLowerCase()) || 0;
            
            if (countB !== countA) {
                return countB - countA; // Mayor número de alquileres primero
            }
            // Si tienen la misma cantidad de alquileres, ordenar alfabéticamente
            return (a.name || '').localeCompare(b.name || '', 'es', { sensitivity: 'base' });
        });
    }, [products, searchTerm, filterPropiedad, popularidadMap]);

    const subtotal = items.reduce((s, i) => {
        const prod = (products || []).find(p => p && p.id === i.productId);
        const isServ = (i.tipoCobro || '').toLowerCase().includes('servicio') ||
                       (i.tipoCobro || '').toLowerCase().includes('única') ||
                       (i.category || '').toLowerCase().includes('servicio') ||
                       (prod?.category || '').toLowerCase().includes('servicio') ||
                       (prod?.tipoCobro || '').toLowerCase().includes('servicio') ||
                       (prod?.esquemaCobro || '').toLowerCase().includes('única');
        return s + (Number(i.cantidad) || 0) * (isServ ? 1 : (Number(i.dias) || 0)) * (Number(i.tarifaDia) || 0);
    }, 0);
    const porcIVA = selectedClient?.responsableIVA ? (Number(selectedClient?.porcIVA) || 0) : 0;
    const porcRet = Number(selectedClient?.porcRetencion) || 0;
    const iva = Math.round(subtotal * porcIVA / 100);
    const ret = Math.round(subtotal * porcRet / 100);
    const total = subtotal + iva + ret;

    const handleProductClick = (prod) => {
        const isServ = (prod.category || '').toLowerCase().includes('servicio') ||
                       (prod.tipoCobro || '').toLowerCase().includes('servicio') ||
                       (prod.esquemaCobro || '').toLowerCase().includes('única');
        const existingIdx = items.findIndex(i => i.productId === prod.id);
        if (existingIdx >= 0) {
            const newItems = [...items];
            const nextQty = newItems[existingIdx].cantidad + 1;
            if (!isServ && nextQty > prod.availableStock) {
                Swal.fire({
                    title: 'Stock Insuficiente',
                    text: `No hay más stock disponible de este equipo en bodega (Máximo: ${prod.availableStock}).`,
                    icon: 'warning',
                    confirmButtonColor: '#2365AB'
                });
                return;
            }
            newItems[existingIdx].cantidad = nextQty;
            setItems(newItems);
        } else {
            if (!isServ && prod.availableStock < 1) {
                Swal.fire({
                    title: 'Equipo Agotado',
                    text: 'No hay stock disponible de este equipo en bodega.',
                    icon: 'error',
                    confirmButtonColor: '#ef4444'
                });
                return;
            }
            setItems([...items, {
                productId: prod.id,
                nombre: prod.name,
                cantidad: 1,
                dias: isServ ? 1 : defaultDays,
                tarifaDia: Number(prod.value) || 0,
                tipoCobro: prod.tipoCobro,
                category: prod.category
            }]);
        }
    };

    const updateItemQty = (idx, delta) => {
        const newItems = [...items];
        const prod = (products || []).find(p => p && p.id === newItems[idx].productId);
        const isServ = (newItems[idx].tipoCobro || '').toLowerCase().includes('servicio') ||
                       (newItems[idx].category || '').toLowerCase().includes('servicio') ||
                       (prod?.category || '').toLowerCase().includes('servicio') ||
                       (prod?.tipoCobro || '').toLowerCase().includes('servicio') ||
                       (prod?.esquemaCobro || '').toLowerCase().includes('única');
        const curr = Number(newItems[idx].cantidad) || 0;
        const nextQty = curr + delta;
        if (!isServ && prod && nextQty > prod.availableStock) {
            Swal.fire({
                title: 'Stock Insuficiente',
                text: `No hay más stock disponible de este equipo en bodega (Máximo: ${prod.availableStock}).`,
                icon: 'warning',
                confirmButtonColor: '#2365AB'
            });
            return;
        }
        newItems[idx].cantidad = Math.max(1, nextQty);
        setItems(newItems);
    };

    const setItemQtyDirect = (idx, val) => {
        const newItems = [...items];
        const prod = (products || []).find(p => p && p.id === newItems[idx].productId);
        const isServ = (newItems[idx].tipoCobro || '').toLowerCase().includes('servicio') ||
                       (newItems[idx].category || '').toLowerCase().includes('servicio') ||
                       (prod?.category || '').toLowerCase().includes('servicio') ||
                       (prod?.tipoCobro || '').toLowerCase().includes('servicio') ||
                       (prod?.esquemaCobro || '').toLowerCase().includes('única');
        
        let newQty = val === '' ? '' : Math.max(1, parseInt(val, 10) || 1);
        if (!isServ && prod && typeof newQty === 'number') {
            if (newQty > prod.availableStock) {
                newQty = prod.availableStock;
                Swal.fire({
                    title: 'Stock Excedido',
                    text: `La cantidad máxima disponible en bodega para este equipo es de ${prod.availableStock} unidades.`,
                    icon: 'warning',
                    confirmButtonColor: '#2365AB'
                });
            }
        }
        newItems[idx].cantidad = newQty;
        setItems(newItems);
    };

    const updateItemDays = (idx, days) => {
        const newItems = [...items];
        const prod = (products || []).find(p => p && p.id === newItems[idx].productId);
        const isServ = (newItems[idx].tipoCobro || '').toLowerCase().includes('servicio') ||
                       (newItems[idx].category || '').toLowerCase().includes('servicio') ||
                       (prod?.category || '').toLowerCase().includes('servicio') ||
                       (prod?.tipoCobro || '').toLowerCase().includes('servicio') ||
                       (prod?.esquemaCobro || '').toLowerCase().includes('única');
        const isHora = (newItems[idx].tipoCobro || '').toLowerCase() === 'hora' || (prod?.tipoCobro || '').toLowerCase() === 'hora';

        const numVal = isServ ? 1 : Math.max(0.5, Number(days) || 0.5);
        newItems[idx].dias = numVal;

        if (isHora && newItems[idx].horaInicio) {
            const hFin = calcularHoraFin(newItems[idx].horaInicio, numVal);
            if (hFin) newItems[idx].horaFin = hFin;
        }
        setItems(newItems);
    };

    const removeItem = (idx) => {
        setItems(items.filter((_, i) => i !== idx));
    };

    const handleSave = () => {
        if (!clientId || !obraId || items.length === 0) return;
        onSave({
            clientId, obraId, 
            notas, items,
            validezDias: initialData?.validezDias || 15, // Default as requested to remove field
            metodoPago: initialData?.metodoPago || 'Crédito 30 días', // Default as requested to remove field
            plazoEntrega: initialData?.plazoEntrega || '24 horas' // Default as requested to remove field
        });
        onClose();
    };

    const IS = {
        width: '100%', padding: '0.65rem 0.8rem', boxSizing: 'border-box',
        background: '#f8fafc', border: '1px solid #e2e8f0',
        borderRadius: 8, color: '#1e293b', fontSize: '0.85rem', outline: 'none'
    };

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
                        <div style={{ padding: '1.5rem 2.5rem', borderBottom: '1px solid #f1f5f9', display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '1.25rem', alignItems: 'end' }}>
                            <div>
                                <label style={{ fontSize: '0.75rem', fontWeight: 800, color: '#64748b', display: 'block', marginBottom: '0.5rem', textTransform: 'uppercase' }}>Cliente *</label>
                                <div style={{ position: 'relative' }}>
                                    <input
                                        type="text"
                                        value={clientSearch}
                                        onChange={e => {
                                            setClientSearch(e.target.value);
                                            setClientId('');
                                            setObraId('');
                                            setClientDropdownOpen(true);
                                        }}
                                        onFocus={() => setClientDropdownOpen(true)}
                                        onClick={() => setClientDropdownOpen(true)}
                                        onBlur={() => {
                                            window.setTimeout(() => setClientDropdownOpen(false), 150);
                                        }}
                                        onKeyDown={e => {
                                            if (e.key === 'Enter' && filteredClients.length > 0) {
                                                e.preventDefault();
                                                handleSelectClient(filteredClients[0]);
                                            }
                                        }}
                                        placeholder="Buscar o seleccionar cliente..."
                                        autoComplete="off"
                                        style={{
                                            ...IS,
                                            paddingRight: '2.4rem',
                                            background: '#ffffff'
                                        }}
                                    />
                                    <ChevronDown
                                        size={16}
                                        style={{
                                            position: 'absolute',
                                            right: '0.85rem',
                                            top: '50%',
                                            transform: 'translateY(-50%)',
                                            color: '#64748b',
                                            pointerEvents: 'none'
                                        }}
                                    />
                                    {clientDropdownOpen && (
                                        <div style={{
                                            position: 'absolute',
                                            top: 'calc(100% + 4px)',
                                            left: 0,
                                            right: 0,
                                            zIndex: 100,
                                            maxHeight: 260,
                                            overflowY: 'auto',
                                            background: '#ffffff',
                                            border: '1px solid #cbd5e1',
                                            borderRadius: '12px',
                                            boxShadow: '0 12px 24px rgba(15, 23, 42, 0.15)'
                                        }}>
                                            {filteredClients.length > 0 ? filteredClients.map(c => (
                                                <button
                                                    key={c.id}
                                                    type="button"
                                                    onMouseDown={e => e.preventDefault()}
                                                    onClick={() => handleSelectClient(c)}
                                                    style={{
                                                        width: '100%',
                                                        border: 'none',
                                                        background: clientId === c.id ? '#eff6ff' : 'transparent',
                                                        padding: '0.75rem 1rem',
                                                        textAlign: 'left',
                                                        cursor: 'pointer',
                                                        borderBottom: '1px solid #f1f5f9',
                                                        color: clientId === c.id ? '#2365AB' : '#1e293b',
                                                        fontWeight: clientId === c.id ? 800 : 600,
                                                        fontSize: '0.85rem',
                                                        display: 'flex',
                                                        justifyContent: 'space-between',
                                                        alignItems: 'center'
                                                    }}
                                                    onMouseEnter={e => e.currentTarget.style.background = '#f8fafc'}
                                                    onMouseLeave={e => e.currentTarget.style.background = clientId === c.id ? '#eff6ff' : 'transparent'}
                                                >
                                                    <span>{c.name}</span>
                                                    {(c.nit || c.cedula || c.documento) && (
                                                        <span style={{ fontSize: '0.75rem', color: '#94a3b8', fontWeight: 500 }}>
                                                            {c.nit || c.cedula || c.documento}
                                                        </span>
                                                    )}
                                                </button>
                                            )) : (
                                                <div style={{ padding: '0.85rem', fontSize: '0.85rem', color: '#94a3b8', textAlign: 'center' }}>
                                                    No se encontraron clientes
                                                </div>
                                            )}
                                        </div>
                                    )}
                                </div>
                            </div>
                            <div>
                                <label style={{ fontSize: '0.75rem', fontWeight: 800, color: '#64748b', display: 'block', marginBottom: '0.5rem', textTransform: 'uppercase' }}>Obra *</label>
                                <select value={obraId} onChange={e => setObraId(e.target.value)} disabled={!clientId} style={IS}>
                                    <option value="">Seleccione Obra</option>
                                    {obras.map(o => <option key={o.id} value={o.id}>{o.nombre}</option>)}
                                </select>
                            </div>
                        </div>

                        {/* Product Grid Area */}
                        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
                            <div style={{ padding: '1rem 2.5rem', background: '#f8fafc', display: 'flex', alignItems: 'center', gap: '1rem', borderBottom: '1px solid #e2e8f0', flexWrap: 'wrap' }}>
                                <div style={{ position: 'relative', flex: 1, minWidth: 200 }}>
                                    <Search size={18} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }} />
                                    <input 
                                        value={searchTerm} 
                                        onChange={e => setSearchTerm(e.target.value)}
                                        placeholder="Buscar por nombre o código..." 
                                        style={{ ...IS, paddingLeft: '2.8rem', background: 'white' }} 
                                    />
                                </div>
                                <div style={{ display: 'flex', gap: '0.3rem', background: '#e2e8f0', padding: '3px', borderRadius: 10 }}>
                                    <button
                                        type="button"
                                        onClick={() => setFilterPropiedad('Todos')}
                                        style={{
                                            padding: '0.35rem 0.65rem',
                                            borderRadius: 8,
                                            border: 'none',
                                            background: filterPropiedad === 'Todos' ? 'white' : 'transparent',
                                            color: filterPropiedad === 'Todos' ? '#1e293b' : '#64748b',
                                            fontWeight: 700,
                                            fontSize: '0.75rem',
                                            cursor: 'pointer',
                                            boxShadow: filterPropiedad === 'Todos' ? '0 1px 3px rgba(0,0,0,0.1)' : 'none'
                                        }}
                                    >
                                        Todos
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => setFilterPropiedad('Propio')}
                                        style={{
                                            padding: '0.35rem 0.65rem',
                                            borderRadius: 8,
                                            border: 'none',
                                            background: filterPropiedad === 'Propio' ? '#2365AB' : 'transparent',
                                            color: filterPropiedad === 'Propio' ? 'white' : '#64748b',
                                            fontWeight: 700,
                                            fontSize: '0.75rem',
                                            cursor: 'pointer',
                                            boxShadow: filterPropiedad === 'Propio' ? '0 1px 3px rgba(0,0,0,0.1)' : 'none'
                                        }}
                                    >
                                        Propio
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => setFilterPropiedad('Terceros')}
                                        style={{
                                            padding: '0.35rem 0.65rem',
                                            borderRadius: 8,
                                            border: 'none',
                                            background: filterPropiedad === 'Terceros' ? '#d97706' : 'transparent',
                                            color: filterPropiedad === 'Terceros' ? 'white' : '#64748b',
                                            fontWeight: 700,
                                            fontSize: '0.75rem',
                                            cursor: 'pointer',
                                            boxShadow: filterPropiedad === 'Terceros' ? '0 1px 3px rgba(0,0,0,0.1)' : 'none'
                                        }}
                                    >
                                        Terceros
                                    </button>
                                </div>
                            </div>

                            <div style={{ flex: 1, overflowY: 'auto', padding: '1.5rem 2.5rem', display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: '1rem', alignContent: 'start' }}>
                                {filteredProducts.map(p => {
                                    const inList = items.find(i => i.productId === p.id);
                                    const isTerceros = p.tipoPropiedad === 'Terceros';
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
                                                <div style={{ fontSize: '0.8rem', fontWeight: 700, color: '#1e293b', lineHeight: 1.1, marginBottom: '0.35rem', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>{p.name}</div>
                                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '0.35rem' }}>
                                                    <div style={{ fontSize: '0.82rem', fontWeight: 800, color: '#10b981', whiteSpace: 'nowrap' }}>
                                                        {fmtCOP(p.value)}<span style={{ fontSize: '0.6rem', color: '#64748b', fontWeight: 400 }}>/d</span>
                                                    </div>
                                                    
                                                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                                                        {/* Tarjeta de Stock Disponible con borde de 0.2px */}
                                                        <span style={{
                                                            fontSize: '0.65rem',
                                                            fontWeight: 700,
                                                            padding: '1px 5px',
                                                            borderRadius: 4,
                                                            background: '#ffffff',
                                                            color: (p.availableStock ?? p.stock) > 0 ? '#10b981' : '#ef4444',
                                                            border: (p.availableStock ?? p.stock) > 0 ? '0.2px solid #10b981' : '0.2px solid #ef4444',
                                                            lineHeight: '1.2',
                                                            whiteSpace: 'nowrap',
                                                            display: 'inline-block'
                                                        }}>
                                                            {(p.availableStock ?? p.stock ?? 0)} disp.
                                                        </span>

                                                        {inList && (
                                                            <div style={{ background: '#2365AB', color: 'white', minWidth: 20, height: 20, padding: '0 4px', borderRadius: '5px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.68rem', fontWeight: 800 }}>
                                                                {inList.cantidad}
                                                            </div>
                                                        )}
                                                    </div>
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
                                    {items.map((item, idx) => {
                                        const prod = (products || []).find(p => p && p.id === item.productId);
                                        const isTerceros = prod?.tipoPropiedad === 'Terceros';
                                        const isServ = (item.tipoCobro || '').toLowerCase().includes('servicio') ||
                                                       (item.tipoCobro || '').toLowerCase().includes('única') ||
                                                       (item.category || '').toLowerCase().includes('servicio') ||
                                                       (prod?.category || '').toLowerCase().includes('servicio') ||
                                                       (prod?.tipoCobro || '').toLowerCase().includes('servicio') ||
                                                       (prod?.esquemaCobro || '').toLowerCase().includes('única');
                                        const isHora = (item.tipoCobro || '').toLowerCase() === 'hora' || (prod?.tipoCobro || '').toLowerCase() === 'hora';
                                        const lineTotal = item.cantidad * (isServ ? 1 : item.dias) * item.tarifaDia;

                                        const handleTimeChange = (field, val) => {
                                            if (!val || !/^\d{2}:\d{2}$/.test(val)) return;
                                            const newItems = [...items];
                                            const curItem = { ...newItems[idx], [field]: val };

                                            if (field === 'horaInicio') {
                                                if (curItem.horaFin && /^\d{2}:\d{2}$/.test(curItem.horaFin)) {
                                                    const hrs = calcularHorasAlquiler(val, curItem.horaFin);
                                                    if (hrs > 0) curItem.dias = hrs;
                                                } else if (curItem.dias > 0) {
                                                    const hFin = calcularHoraFin(val, curItem.dias);
                                                    if (hFin) curItem.horaFin = hFin;
                                                }
                                            } else if (field === 'horaFin') {
                                                if (curItem.horaInicio && /^\d{2}:\d{2}$/.test(curItem.horaInicio)) {
                                                    const hrs = calcularHorasAlquiler(curItem.horaInicio, val);
                                                    if (hrs > 0) curItem.dias = hrs;
                                                }
                                            }

                                            newItems[idx] = curItem;
                                            setItems(newItems);
                                        };

                                        return (
                                            <div key={idx} style={{ background: 'white', padding: '1rem', borderRadius: 16, border: '1px solid #e2e8f0', boxShadow: '0 2px 4px rgba(0,0,0,0.02)' }}>
                                                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.75rem', alignItems: 'center' }}>
                                                    <div style={{ fontWeight: 700, fontSize: '0.85rem', color: '#1e293b', display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                                                        <span>{item.nombre}</span>
                                                        <span style={{
                                                            fontSize: '0.65rem', fontWeight: 700, padding: '1px 6px', borderRadius: 6,
                                                            background: isTerceros ? '#fef3c7' : '#e0f2fe',
                                                            color: isTerceros ? '#b45309' : '#0369a1',
                                                            border: isTerceros ? '1px solid #fde68a' : '1px solid #bae6fd'
                                                        }}>
                                                            {isTerceros ? `Terceros${prod?.proveedor ? ` (${prod.proveedor})` : ''}` : 'Propio'}
                                                        </span>
                                                        {isServ && (
                                                            <span style={{ fontSize: '0.65rem', background: '#e0f2fe', color: '#0369a1', padding: '2px 6px', borderRadius: 6, fontWeight: 700 }}>
                                                                Cobro Único
                                                            </span>
                                                        )}
                                                        {isHora && (
                                                            <span style={{ fontSize: '0.65rem', background: '#fef3c7', color: '#b45309', padding: '2px 6px', borderRadius: 6, fontWeight: 700 }}>
                                                                Cobro por Horas
                                                            </span>
                                                        )}
                                                    </div>
                                                    <button onClick={() => removeItem(idx)} style={{ background: 'none', border: 'none', color: '#cbd5e1', cursor: 'pointer' }}><Trash2 size={16} /></button>
                                                </div>

                                                {isHora && (
                                                    <div style={{ background: '#f8fafc', padding: '0.65rem', borderRadius: 10, border: '1px solid #e2e8f0', marginBottom: '0.75rem', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem' }}>
                                                        <div>
                                                            <label style={{ fontSize: '0.68rem', color: '#64748b', fontWeight: 700, display: 'block', marginBottom: 2 }}>HORA ALQUILER (INICIO)</label>
                                                            <input type="time" value={item.horaInicio || ''} onChange={e => handleTimeChange('horaInicio', e.target.value)} style={{ width: '100%', padding: '0.3rem', border: '1px solid #cbd5e1', borderRadius: 6, fontSize: '0.8rem', fontWeight: 600 }} />
                                                        </div>
                                                        <div>
                                                            <label style={{ fontSize: '0.68rem', color: '#64748b', fontWeight: 700, display: 'block', marginBottom: 2 }}>HORA DEVOLUCIÓN (FIN)</label>
                                                            <input type="time" value={item.horaFin || ''} onChange={e => handleTimeChange('horaFin', e.target.value)} style={{ width: '100%', padding: '0.3rem', border: '1px solid #cbd5e1', borderRadius: 6, fontSize: '0.8rem', fontWeight: 600 }} />
                                                        </div>
                                                    </div>
                                                )}

                                                <div style={{ display: 'grid', gridTemplateColumns: isServ ? '1fr' : '1fr 1fr', gap: '1rem' }}>
                                                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                                        <div style={{ fontSize: '0.7rem', color: '#64748b', fontWeight: 600 }}>Cant:</div>
                                                        <input 
                                                            type="number" 
                                                            min="1" 
                                                            value={item.cantidad} 
                                                            onChange={(e) => setItemQtyDirect(idx, e.target.value)}
                                                            onBlur={() => {
                                                                if (!item.cantidad || item.cantidad < 1) setItemQtyDirect(idx, 1);
                                                            }}
                                                            style={{ width: '100%', padding: '0.3rem', border: '1px solid #e2e8f0', borderRadius: 8, textAlign: 'center', fontWeight: 700, fontSize: '0.85rem' }} 
                                                        />
                                                    </div>
                                                    {!isServ && (
                                                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                                            <div style={{ fontSize: '0.7rem', color: '#64748b', fontWeight: 600 }}>{isHora ? 'Horas:' : 'Días:'}</div>
                                                            <input 
                                                                type="number" 
                                                                step="0.5"
                                                                min="0.5" 
                                                                value={item.dias} 
                                                                onChange={(e) => updateItemDays(idx, e.target.value)} 
                                                                style={{ width: '100%', padding: '0.3rem', border: '1px solid #e2e8f0', borderRadius: 8, textAlign: 'center', fontWeight: 700, fontSize: '0.85rem' }} 
                                                            />
                                                        </div>
                                                    )}
                                                </div>
                                                <div style={{ marginTop: '0.75rem', textAlign: 'right', borderTop: '1px dashed #f1f5f9', paddingTop: '0.5rem', fontWeight: 800, color: '#2365AB' }}>
                                                    {fmtCOP(lineTotal)}
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            )}
                        </div>

                        {/* Totals Section */}
                        <div style={{ padding: '1.5rem', background: 'white', borderTop: '1px solid #e2e8f0' }}>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem', marginBottom: '1rem' }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', color: '#64748b' }}>
                                    <span>Subtotal</span>
                                    <span style={{ fontWeight: 600, color: '#1e293b' }}>{fmtCOP(subtotal)}</span>
                                </div>
                                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', color: '#64748b' }}>
                                    <span>IVA ({porcIVA}%)</span>
                                    <span style={{ fontWeight: 600, color: '#1e293b' }}>{fmtCOP(iva)}</span>
                                </div>
                                {ret > 0 && (
                                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', color: '#64748b' }}>
                                        <span>Retención ({porcRet}%)</span>
                                        <span style={{ fontWeight: 600, color: '#991b1b' }}>-{fmtCOP(ret)}</span>
                                    </div>
                                )}
                                <div style={{ height: '1px', background: '#e2e8f0', margin: '0.4rem 0' }}></div>
                                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '1.25rem', fontWeight: 900, color: '#1e293b' }}>
                                    <span>Total</span>
                                    <span style={{ color: '#10b981' }}>{fmtCOP(total)}</span>
                                </div>
                            </div>
                            <button 
                                disabled={!clientId || !obraId || items.length === 0}
                                onClick={handleSave}
                                style={{ 
                                    width: '100%', padding: '1rem', borderRadius: 16, border: 'none', 
                                    background: (!clientId || !obraId || items.length === 0) ? '#cbd5e1' : '#2365AB', 
                                    color: 'white', fontWeight: 800, fontSize: '1.1rem', cursor: 'pointer',
                                    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem',
                                    transition: 'all 0.2s', boxShadow: (!clientId || !obraId || items.length === 0) ? 'none' : '0 10px 15px -3px rgba(35, 101, 171, 0.3)'
                                }}
                            >
                                <CheckCircle size={22} /> Confirmar y Generar
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
