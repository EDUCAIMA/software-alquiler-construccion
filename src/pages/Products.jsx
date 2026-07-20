import React, { useState, useRef, useEffect, useMemo } from 'react';
import {
    PackagePlus, UploadCloud,
    AlertTriangle, X, Wrench, Trash2, ArrowDownCircle,
    ShieldCheck, ShieldAlert, Download, Factory, Pencil,
    ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight, ChevronDown, Search, ChevronUp,
    User, MapPin
} from 'lucide-react';
import { useAppContext } from '../context/AppContext';


// ─── DropZone – definido FUERA del componente para evitar re-montaje ─────────
function DropZone({ state, setter, fileInputRef }) {
    const [isDragging, setIsDragging] = useState(false);
    return (
        <div className="input-group mb-2">
            <label className="input-label mb-2">Imagen del Equipo</label>
            <div
                onDragOver={e => { e.preventDefault(); setIsDragging(true); }}
                onDragLeave={e => { e.preventDefault(); setIsDragging(false); }}
                onDrop={e => {
                    e.preventDefault(); setIsDragging(false);
                    const file = e.dataTransfer.files[0];
                    if (file && file.type.startsWith('image/')) handleImageUpload(file, setter);
                }}
                onClick={() => fileInputRef.current?.click()}
                style={{
                    border: `2px dashed ${isDragging ? 'var(--primary)' : 'var(--surface-border)'}`,
                    borderRadius: 12, padding: '1.5rem', textAlign: 'center',
                    backgroundColor: isDragging ? 'rgba(35, 101, 171,0.05)' : '#fafafa',
                    cursor: 'pointer', transition: 'all 0.3s ease',
                    display: 'flex', flexDirection: 'column', alignItems: 'center',
                    justifyContent: 'center', gap: '0.75rem', minHeight: 120
                }}>
                <input type="file" accept="image/*" ref={fileInputRef}
                    onChange={e => handleImageUpload(e.target.files[0], setter)}
                    style={{ display: 'none' }} />
                {state.image ? (
                    <div>
                        <img src={state.image} alt="Preview" style={{ maxWidth: '100%', maxHeight: 90, objectFit: 'contain', borderRadius: 8 }} />
                        <div className="mt-2 text-sm text-primary font-medium">Click para cambiar</div>
                    </div>
                ) : (
                    <>
                        <div style={{ padding: '0.75rem', background: 'rgba(35, 101, 171,0.1)', borderRadius: '50%', color: 'var(--primary)' }}><UploadCloud size={26} /></div>
                        <p style={{ fontWeight: 600, color: 'var(--text-primary)', fontSize: '0.85rem' }}>Arrastra o haz clic</p>
                    </>
                )}
            </div>
        </div>
    );
}

// ─── LifeFields – definido FUERA del componente para evitar re-montaje ────────
function LifeFields({ state, setter }) {
    return (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.6rem' }}>
            <div className="input-group" style={{ margin: 0 }}>
                <label className="input-label">Proveedor</label>
                <input type="text" className="input-base" value={state.proveedor || ''}
                    onChange={e => setter(prev => ({ ...prev, proveedor: e.target.value }))}
                    placeholder="Ej. Ferrasa S.A." />
            </div>
            <div className="input-group" style={{ margin: 0 }}>
                <label className="input-label">Fecha de Compra</label>
                <input type="date" className="input-base" value={state.fechaCompra || ''}
                    onChange={e => setter(prev => ({ ...prev, fechaCompra: e.target.value }))} />
            </div>
            <div className="input-group" style={{ margin: 0 }}>
                <label className="input-label">Costo Adquisición ($)</label>
                <input
                    type="number"
                    className="input-base"
                    value={state.costoAdquisicion || ''}
                    onChange={e => setter(prev => ({ ...prev, costoAdquisicion: e.target.value }))}
                    placeholder="0"
                />
            </div>
            <div className="input-group" style={{ margin: 0 }}>
                <label className="input-label">Próximo Mantenimiento</label>
                <input type="date" className="input-base" value={state.proximoMantenimiento || ''}
                    onChange={e => setter(prev => ({ ...prev, proximoMantenimiento: e.target.value }))} />
            </div>
        </div>
    );
}

// ─── Helper para comprimir imagen ─────────────────────────────────────────────
function handleImageUpload(file, setter) {
    if (file && file.type.startsWith('image/')) {
        const reader = new FileReader();
        reader.onloadend = () => {
            const img = new Image();
            img.onload = () => {
                const canvas = document.createElement('canvas');
                const MAX = 400;
                let { width, height } = img;
                if (width > height) { if (width > MAX) { height *= MAX / width; width = MAX; } }
                else { if (height > MAX) { width *= MAX / height; height = MAX; } }
                canvas.width = width; canvas.height = height;
                canvas.getContext('2d').drawImage(img, 0, 0, width, height);
                setter(prev => ({ ...prev, image: canvas.toDataURL('image/jpeg', 0.7) }));
            };
            img.src = reader.result;
        };
        reader.readAsDataURL(file);
    }
}

// ─── Hoja de Vida Panel ───────────────────────────────────────────────────────
function HojaDeVidaPanel({ product, maintenances, onClose }) {
    const { settings } = useAppContext();
    const prodMantenimientos = (maintenances || []).filter(m => m.productId === product.id);
    const hasPending = prodMantenimientos.some(m => m.estado === 'Pendiente' || m.estado === 'En Proceso');


    const statusColor = s => s === 'Completado' ? '#10b981' : s === 'En Proceso' ? '#f97316' : '#ef4444';

    return (
        <>
            <div style={{ position: 'fixed', right: 0, top: 0, bottom: 0, width: '100%', maxWidth: 480, zIndex: 900, background: '#ffffff', display: 'flex', flexDirection: 'column', boxShadow: '-6px 0 40px rgba(0,0,0,0.35)', overflowY: 'auto', animation: 'slideInRight 0.25s ease' }}>
                {/* Header */}
                <div style={{ background: 'linear-gradient(135deg, #104166, #154272)', padding: '1.5rem 1.75rem', flexShrink: 0 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                        <div>
                            <div style={{ fontSize: '1.2rem', fontWeight: 800, color: 'white', letterSpacing: '0.05em' }}>{settings?.shortName || 'CIELO'}</div>
                            <div style={{ fontSize: '0.75rem', color: 'rgba(255,255,255,0.7)', marginTop: 2 }}>Hoja de Vida del Equipo</div>
                        </div>
                        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                            {hasPending && (
                                <span style={{ padding: '3px 10px', borderRadius: 999, background: 'rgba(239,68,68,0.35)', color: 'white', fontSize: '0.7rem', fontWeight: 700, border: '1px solid rgba(255,255,255,0.25)', display: 'flex', alignItems: 'center', gap: 4 }}>
                                    <AlertTriangle size={10} /> BLOQUEADO
                                </span>
                            )}
                            <button onClick={onClose} style={{ padding: '0.35rem', background: 'rgba(255,255,255,0.15)', border: '1px solid rgba(255,255,255,0.3)', borderRadius: 6, color: 'white', cursor: 'pointer', display: 'flex' }}><X size={16} /></button>
                        </div>
                    </div>
                    <div style={{ marginTop: '1rem', background: 'rgba(255,255,255,0.1)', borderRadius: 10, padding: '0.85rem 1rem', display: 'flex', gap: '1rem', alignItems: 'center' }}>
                        <img src={product.image} alt={product.name} style={{ width: 60, height: 60, objectFit: 'cover', borderRadius: 8, border: '2px solid rgba(255,255,255,0.25)' }} />
                        <div>
                            <div style={{ fontWeight: 800, color: 'white', fontSize: '1rem' }}>{product.name}</div>
                            <div style={{ fontSize: '0.8rem', color: 'rgba(255,255,255,0.7)', marginTop: 2 }}>
                                {String(product.id || '').includes('-') ? String(product.id || '').split('-')[1]?.slice(-2) : String(product.id || '').slice(-2)} · {product.category}
                            </div>
                            <div style={{ marginTop: 6, fontSize: '0.72rem', color: 'rgba(255,255,255,0.6)' }}>Stock: {product.totalStock} total · {product.availableStock} disponibles</div>
                            {product.estado === 'Dado de baja' && (
                                <div style={{ marginTop: 4, fontSize: '0.72rem', fontWeight: 700, color: '#fbbf24' }}>⚠ DADO DE BAJA — {product.fechaBaja}</div>
                            )}
                        </div>
                    </div>
                </div>

                {/* Body */}
                <div style={{ flex: 1, padding: '1.5rem 1.75rem', background: '#f8fafc', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                    <div style={{ background: 'white', border: '1px solid #e2e8f0', borderRadius: 10, overflow: 'hidden', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
                        <div style={{ background: '#f1f5f9', padding: '0.55rem 1rem', borderBottom: '1px solid #e2e8f0', fontSize: '0.68rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.08em', display: 'flex', alignItems: 'center', gap: 6 }}>
                            <Factory size={12} /> Datos de Adquisición
                        </div>
                        <div style={{ padding: '0.85rem 1rem', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.6rem' }}>
                            {[
                                ['Proveedor', product.proveedor || 'N/A'],
                                ['Fecha de Compra', product.fechaCompra || 'N/A'],
                                ['Costo Adquisición', product.costoAdquisicion ? `$${Number(product.costoAdquisicion).toLocaleString()}` : 'N/A'],
                                ['Tarifa Alquiler', `$${(product.value || 0).toLocaleString()} / ${product.tipoCobro || 'Día'}`],
                                ['Esquema Cobro', product.esquemaCobro || 'Calendario'],
                            ].map(([k, v]) => (
                                <div key={k}>
                                    <div style={{ fontSize: '0.68rem', color: '#94a3b8', fontWeight: 600, textTransform: 'uppercase' }}>{k}</div>
                                    <div style={{ fontSize: '0.875rem', fontWeight: 600, color: '#104166', marginTop: 2 }}>{v}</div>
                                </div>
                            ))}
                        </div>
                    </div>

                    {product.estado === 'Dado de baja' && (
                        <div style={{ background: '#fff7ed', border: '1px solid #fed7aa', borderRadius: 10, padding: '0.85rem 1rem', display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                            <ArrowDownCircle size={20} style={{ color: '#f97316' }} />
                            <div>
                                <div style={{ fontSize: '0.7rem', fontWeight: 700, color: '#9a3412', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Equipo Dado de Baja</div>
                                <div style={{ fontSize: '0.85rem', fontWeight: 600, color: '#f97316', marginTop: 2 }}>{product.motivoBaja || 'Sin motivo'} · {product.fechaBaja}</div>
                            </div>
                        </div>
                    )}

                    {product.proximoMantenimiento && (
                        <div style={{ background: hasPending ? '#fef2f2' : '#f0fdf4', border: `1px solid ${hasPending ? '#fecaca' : '#bbf7d0'}`, borderRadius: 10, padding: '0.85rem 1rem', display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                            {hasPending ? <ShieldAlert size={20} style={{ color: '#ef4444' }} /> : <ShieldCheck size={20} style={{ color: '#10b981' }} />}
                            <div>
                                <div style={{ fontSize: '0.7rem', fontWeight: 700, color: hasPending ? '#b91c1c' : '#166534', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                                    {hasPending ? 'Equipo Bloqueado por Mantenimiento' : 'Próximo Mantenimiento'}
                                </div>
                                <div style={{ fontSize: '0.9rem', fontWeight: 700, color: hasPending ? '#ef4444' : '#10b981', marginTop: 2 }}>{product.proximoMantenimiento}</div>
                            </div>
                        </div>
                    )}

                    <div style={{ background: 'white', border: '1px solid #e2e8f0', borderRadius: 10, overflow: 'hidden', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
                        <div style={{ background: '#f1f5f9', padding: '0.55rem 1rem', borderBottom: '1px solid #e2e8f0', fontSize: '0.68rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.08em', display: 'flex', alignItems: 'center', gap: 6 }}>
                            <Wrench size={12} /> Historial de Mantenimientos ({prodMantenimientos.length})
                        </div>
                        {prodMantenimientos.length === 0 ? (
                            <div style={{ padding: '1.5rem', textAlign: 'center', color: '#94a3b8', fontSize: '0.85rem' }}>Sin mantenimientos registrados</div>
                        ) : (
                            <div style={{ display: 'flex', flexDirection: 'column' }}>
                                {prodMantenimientos.map((m, idx) => (
                                    <div key={m.id} style={{ padding: '0.75rem 1rem', borderBottom: idx < prodMantenimientos.length - 1 ? '1px solid #f1f5f9' : 'none', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                        <div>
                                            <div style={{ fontWeight: 600, fontSize: '0.82rem', color: '#104166' }}>{m.type} — {m.description}</div>
                                            <div style={{ fontSize: '0.7rem', color: '#94a3b8', marginTop: 2 }}>{m.date} · Costo: ${(m.cost || 0).toLocaleString()}</div>
                                        </div>
                                        <span style={{ padding: '2px 10px', borderRadius: 999, fontSize: '0.68rem', fontWeight: 700, background: `${statusColor(m.status)}20`, color: statusColor(m.status), border: `1px solid ${statusColor(m.status)}40`, whiteSpace: 'nowrap' }}>{m.status}</span>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>

                </div>
            </div>
            <div style={{ position: 'fixed', inset: 0, zIndex: 899 }} onClick={onClose} />
        </>
    );
}

// ─── Modal: Dar de Baja ───────────────────────────────────────────────────────
function BajaModal({ product, onClose, onConfirm }) {
    const { checkPassword } = useAppContext();
    const [motivo, setMotivo] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const motivos = ['Pérdida total por siniestro', 'Obsolescencia técnica', 'Robo o hurto', 'Deterioro irreparable', 'Venta del equipo', 'Otro'];

    const handleConfirm = async () => {
        const isValid = await checkPassword(password);
        if (!isValid) {
            setError('Contraseña incorrecta');
            return;
        }
        onConfirm(motivo); 
        onClose();
    };
    return (
        <div className="modal-overlay">
            <div className="modal-content fadeIn" style={{ maxWidth: 440, padding: 0, overflow: 'hidden' }}>
                <div style={{ background: 'linear-gradient(135deg, #f97316, #ea580c)', padding: '1.5rem 2rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                        <div style={{ background: 'rgba(255,255,255,0.2)', borderRadius: '50%', width: 44, height: 44, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                            <ArrowDownCircle size={22} color="white" />
                        </div>
                        <div>
                            <div style={{ fontWeight: 800, color: 'white', fontSize: '1.1rem' }}>Dar de Baja</div>
                            <div style={{ fontSize: '0.82rem', color: 'rgba(255,255,255,0.85)', marginTop: 2 }}>{product.name} · {product.id}</div>
                        </div>
                    </div>
                </div>
                <div style={{ padding: '1.5rem 2rem' }}>
                    <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '1.25rem', lineHeight: 1.6 }}>
                        El equipo quedará marcado como <strong>Dado de baja</strong>, su stock disponible se reducirá a 0 y no podrá ser asignado en nuevas remisiones.
                    </p>
                    <div className="input-group">
                        <label className="input-label">Motivo de Baja *</label>
                        <select className="input-base" value={motivo} onChange={e => setMotivo(e.target.value)}>
                            <option value="">— Seleccionar motivo —</option>
                            {motivos.map(m => <option key={m} value={m}>{m}</option>)}
                        </select>
                    </div>
                    <div className="input-group">
                        <label className="input-label">Contraseña para confirmar</label>
                        <input 
                            type="password" 
                            className="input-base" 
                            value={password} 
                            onChange={e => { setPassword(e.target.value); setError(''); }}
                            placeholder="********"
                        />
                    </div>
                    {error && <p style={{ color: '#ef4444', fontSize: '0.8rem', marginTop: '0.5rem', fontWeight: 600 }}>{error}</p>}
                    <div className="modal-actions" style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '1rem' }}>
                        <button className="btn btn-secondary" onClick={onClose}>Cancelar</button>
                        <button
                            disabled={!motivo || !password}
                            onClick={handleConfirm}
                            style={{ background: (motivo && password) ? '#f97316' : '#cbd5e1', color: 'white', border: 'none', borderRadius: 8, padding: '0.6rem 1.5rem', fontWeight: 700, cursor: (motivo && password) ? 'pointer' : 'not-allowed', display: 'flex', alignItems: 'center', gap: 6 }}>
                            <ArrowDownCircle size={16} /> Confirmar Baja
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}

// ─── Modal: Confirmar Eliminación ─────────────────────────────────────────────
function DeleteModal({ product, onClose, onConfirm }) {
    const { checkPassword } = useAppContext();
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');

    const handleConfirm = async () => {
        const isValid = await checkPassword(password);
        if (!isValid) {
            setError('Contraseña incorrecta');
            return;
        }
        onConfirm(); 
        onClose();
    };
    return (
        <div className="modal-overlay">
            <div className="modal-content fadeIn" style={{ maxWidth: 400, padding: 0, overflow: 'hidden' }}>
                <div style={{ background: 'linear-gradient(135deg, #ef4444, #dc2626)', padding: '1.5rem 2rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                        <div style={{ background: 'rgba(255,255,255,0.2)', borderRadius: '50%', width: 44, height: 44, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                            <Trash2 size={22} color="white" />
                        </div>
                        <div>
                            <div style={{ fontWeight: 800, color: 'white', fontSize: '1.1rem' }}>Eliminar Equipo</div>
                            <div style={{ fontSize: '0.82rem', color: 'rgba(255,255,255,0.85)', marginTop: 2 }}>{product.name} · {product.id}</div>
                        </div>
                    </div>
                </div>
                <div style={{ padding: '1.5rem 2rem' }}>
                    <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '1.5rem', lineHeight: 1.6 }}>
                        Esta acción <strong>eliminará permanentemente</strong> el equipo del inventario. No podrá deshacerse.
                    </p>
                    <div className="input-group">
                        <label className="input-label">Contraseña para confirmar</label>
                        <input 
                            type="password" 
                            className="input-base" 
                            value={password} 
                            onChange={e => { setPassword(e.target.value); setError(''); }}
                            placeholder="********"
                        />
                    </div>
                    {error && <p style={{ color: '#ef4444', fontSize: '0.8rem', marginTop: '0.5rem', fontWeight: 600 }}>{error}</p>}
                    <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '1.5rem' }}>
                        <button className="btn btn-secondary" onClick={onClose}>Cancelar</button>
                        <button
                            disabled={!password}
                            onClick={handleConfirm}
                            style={{ background: password ? '#ef4444' : '#fecaca', color: 'white', border: 'none', borderRadius: 8, padding: '0.6rem 1.5rem', fontWeight: 700, cursor: password ? 'pointer' : 'not-allowed', display: 'flex', alignItems: 'center', gap: 6 }}>
                            <Trash2 size={16} /> Eliminar
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}

// ─── Modal: Equipos en Campo (Informe de Préstamo) ───────────────────────────
function FieldInventoryModal({ onClose, products, remisiones, clients }) {
    const [q, setQ] = useState('');

    const equipmentInField = useMemo(() => {
        const report = [];
        remisiones
            .filter(r => r.estado === 'Activa' || r.estado === 'Parcial')
            .forEach(r => {
                const client = clients.find(c => c.id === r.clientId);
                const obra = client?.obras?.find(o => o.id === r.obraId);
                
                r.items.forEach(item => {
                    const pend = item.cantidad - (item.cantidadDevuelta || 0);
                    if (pend > 0) {
                        const prod = products.find(p => p.id === item.productId);
                        report.push({
                            id: r.id,
                            fecha: r.fecha,
                            productId: item.productId,
                            productName: prod?.name || item.productId,
                            clientId: r.clientId,
                            clientName: client?.name || 'N/A',
                            obraName: obra?.nombre || 'N/A',
                            cantidad: pend
                        });
                    }
                });
            });
        
        if (!q) return report;
        const lowQ = q.toLowerCase();
        return report.filter(r => 
            r.productName.toLowerCase().includes(lowQ) || 
            r.clientName.toLowerCase().includes(lowQ) || 
            r.obraName.toLowerCase().includes(lowQ)
        );
    }, [remisiones, products, clients, q]);

    return (
        <div className="modal-overlay" onClick={onClose} style={{ zIndex: 1100, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <div className="modal-content fadeIn" onClick={e => e.stopPropagation()} style={{ maxWidth: '95%', width: 1100, padding: 0, overflow: 'hidden', height: '90vh', display: 'flex', flexDirection: 'column', borderRadius: 16 }}>
                {/* Header */}
                <div style={{ background: 'linear-gradient(135deg, #2365AB, #154272)', padding: '1.5rem 2rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div>
                        <h3 style={{ margin: 0, color: 'white', fontSize: '1.25rem', display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                            <ArrowDownCircle size={22} /> Equipos en Campo
                        </h3>
                        <p style={{ margin: '0.25rem 0 0 0', color: 'rgba(255,255,255,0.7)', fontSize: '0.85rem' }}>
                            Vista detallada de qué equipos tienen los clientes actualmente
                        </p>
                    </div>
                    <button onClick={onClose} style={{ background: 'rgba(255,255,255,0.1)', border: 'none', borderRadius: '50%', width: 32, height: 32, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: 'white' }}><X size={18} /></button>
                </div>

                {/* Filters */}
                <div style={{ padding: '1rem 2rem', borderBottom: '1px solid #e2e8f0', background: '#f8fafc' }}>
                    <div style={{ position: 'relative' }}>
                        <Search size={16} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }} />
                        <input 
                            value={q} 
                            onChange={e => setQ(e.target.value)} 
                            placeholder="Buscar por equipo, cliente u obra..."
                            style={{ width: '100%', padding: '0.65rem 1rem 0.65rem 2.5rem', borderRadius: 10, border: '1px solid #cbd5e1', outline: 'none', fontSize: '0.9rem' }}
                        />
                    </div>
                </div>

                {/* Table Area */}
                <div style={{ flex: 1, overflowY: 'auto', padding: '1rem 2rem' }}>
                    {equipmentInField.length === 0 ? (
                        <div style={{ padding: '4rem', textAlign: 'center', color: '#94a3b8' }}>
                            <div style={{ opacity: 0.2, marginBottom: '1rem' }}><ArrowDownCircle size={48} /></div>
                            No hay equipos en campo que coincidan con la búsqueda.
                        </div>
                    ) : (
                        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                            <thead>
                                <tr style={{ borderBottom: '2px solid #e2e8f0', textAlign: 'left' }}>
                                    <th style={{ padding: '0.75rem 0.5rem', fontSize: '0.75rem', color: '#64748b', textTransform: 'uppercase' }}>Equipo</th>
                                    <th style={{ padding: '0.75rem 0.5rem', fontSize: '0.75rem', color: '#64748b', textTransform: 'uppercase' }}>Cliente</th>
                                    <th style={{ padding: '0.75rem 0.5rem', fontSize: '0.75rem', color: '#64748b', textTransform: 'uppercase' }}>Obra</th>
                                    <th style={{ padding: '0.75rem 0.5rem', fontSize: '0.75rem', color: '#64748b', textTransform: 'uppercase', textAlign: 'center' }}>Cant.</th>
                                    <th style={{ padding: '0.75rem 0.5rem', fontSize: '0.75rem', color: '#64748b', textTransform: 'uppercase' }}>F. Despacho</th>
                                    <th style={{ padding: '0.75rem 0.5rem', fontSize: '0.75rem', color: '#64748b', textTransform: 'uppercase' }}>Remisión</th>
                                </tr>
                            </thead>
                            <tbody>
                                {equipmentInField.map((row, idx) => (
                                    <tr key={idx} style={{ borderBottom: '1px solid #f1f5f9' }}>
                                        <td style={{ padding: '1rem 0.5rem' }}>
                                            <div style={{ fontWeight: 700, color: '#104166', fontSize: '0.9rem' }}>{row.productName}</div>
                                        </td>
                                        <td style={{ padding: '1rem 0.5rem' }}>
                                            <div style={{ fontWeight: 600, color: '#334155', display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.85rem' }}>
                                                <User size={12} color="#2365AB" /> {row.clientName}
                                            </div>
                                        </td>
                                        <td style={{ padding: '1rem 0.5rem' }}>
                                            <div style={{ fontSize: '0.8rem', color: '#64748b', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                                                {row.obraName}
                                            </div>
                                        </td>
                                        <td style={{ padding: '1rem 0.5rem', textAlign: 'center' }}>
                                            <span style={{ color: '#104166', fontWeight: 800, fontSize: '0.9rem' }}>
                                                {row.cantidad}
                                            </span>
                                        </td>
                                        <td style={{ padding: '1rem 0.5rem', fontSize: '0.85rem', color: '#64748b' }}>
                                            {row.fecha}
                                        </td>
                                        <td style={{ padding: '1rem 0.5rem', fontFamily: 'monospace', fontWeight: 600, color: '#2365AB', fontSize: '0.85rem' }}>
                                            {row.id}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    )}
                </div>

                {/* Footer */}
                <div style={{ padding: '1.25rem 2rem', background: '#f8fafc', borderTop: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div style={{ fontSize: '0.85rem', fontWeight: 600, color: '#64748b' }}>

                    </div>
                    <button className="btn btn-primary" onClick={onClose} style={{ minWidth: 100 }}>Cerrar</button>
                </div>
            </div>
        </div>
    );
}

// ─── MAIN COMPONENT ───────────────────────────────────────────────────────────
export default function Products() {
    const { products, addProduct, editProduct, deleteProduct, darDeBajaProduct, maintenances, settings, remisiones, clients } = useAppContext();
    const [showAddModal, setShowAddModal] = useState(false);
    const [showEditModal, setShowEditModal] = useState(false);
    const [showFieldModal, setShowFieldModal] = useState(false);
    const [editingProduct, setEditingProduct] = useState(null);
    const [hojaProduct, setHojaProduct] = useState(null);
    const [bajaProduct, setBajaProduct] = useState(null);
    const [deleteProduct_, setDeleteProduct] = useState(null);
    const [newProduct, setNewProduct] = useState({ name: '', category: '', value: '', tipoCobro: 'Día', esquemaCobro: 'Calendario', image: '', totalStock: 1, proveedor: '', fechaCompra: '', costoAdquisicion: '', proximoMantenimiento: '' });
    const fileInputRef = useRef(null);

    useEffect(() => {
        const h1 = () => setShowFieldModal(true);
        const h2 = () => setShowAddModal(true);
        window.addEventListener('trigger-field-inv', h1);
        window.addEventListener('trigger-new-prod', h2);
        return () => {
            window.removeEventListener('trigger-field-inv', h1);
            window.removeEventListener('trigger-new-prod', h2);
        };
    }, []);

    const [search, setSearch] = useState('');
    const [sortConfig, setSortConfig] = useState({ key: 'id', direction: 'desc' });

    const handleSort = (key) => {
        let direction = 'asc';
        if (sortConfig.key === key && sortConfig.direction === 'asc') direction = 'desc';
        setSortConfig({ key, direction });
    };

    const [currentPage, setCurrentPage] = useState(1);
    const [itemsPerPage, setItemsPerPage] = useState(10);
    
    // Filter + Sort
    const sorted = useMemo(() => {
        const filtered = products.filter(p => {
            const q = search.toLowerCase();
            return (p.name || '').toLowerCase().includes(q) || (p.category || '').toLowerCase().includes(q) || (p.id || '').toLowerCase().includes(q);
        });

        if (sortConfig.key) {
            filtered.sort((a, b) => {
                let aVal, bVal;
                
                if (sortConfig.key === 'estado') {
                    // Calcular estado virtual para ordenamiento
                    const getStatus = (p) => {
                        if (p.estado === 'Dado de baja') return 'BAJA';
                        return p.availableStock > 0 ? 'DISPONIBLE' : 'AGOTADO';
                    };
                    aVal = getStatus(a);
                    bVal = getStatus(b);
                } else {
                    aVal = a[sortConfig.key] || '';
                    bVal = b[sortConfig.key] || '';
                }
                
                if (typeof aVal === 'string') aVal = aVal.toLowerCase();
                if (typeof bVal === 'string') bVal = bVal.toLowerCase();

                if (aVal < bVal) return sortConfig.direction === 'asc' ? -1 : 1;
                if (aVal > bVal) return sortConfig.direction === 'asc' ? 1 : -1;
                return 0;
            });
        }
        return filtered;
    }, [products, search, sortConfig]);

    const paginatedProducts = useMemo(() => {
        const start = (currentPage - 1) * itemsPerPage;
        return sorted.slice(start, start + itemsPerPage);
    }, [sorted, currentPage, itemsPerPage]);

    const totalPages = Math.ceil(sorted.length / itemsPerPage);

    const hasPendingMaint = (productId) =>
        maintenances.some(m => m.productId === productId && (m.status === 'Pendiente' || m.status === 'En Proceso'));

    const handleAddProduct = () => {
        if (newProduct.name) {
            addProduct({ ...newProduct, value: Number(newProduct.value), totalStock: Number(newProduct.totalStock), image: newProduct.image || 'https://placehold.co/150x150/e2e8f0/475569?text=Equipo' });
            setShowAddModal(false);
            setNewProduct({ name: '', category: '', value: '', tipoCobro: 'Día', esquemaCobro: 'Calendario', image: '', totalStock: 1, proveedor: '', fechaCompra: '', costoAdquisicion: '', proximoMantenimiento: '' });
        }
    };

    const handleEditProduct = () => {
        if (editingProduct?.name) {
            editProduct(editingProduct.id, { ...editingProduct, value: Number(editingProduct.value), totalStock: Number(editingProduct.totalStock) });
            setShowEditModal(false); setEditingProduct(null);
        }
    };

    return (
        <>
            {/* Filters */}

            {/* Filters */}
            <div className="glass-panel py-4 px-6 mb-6" style={{ display: 'flex', gap: '0.75rem', alignItems: 'center', flexWrap: 'wrap', background: '#ffffff', border: '1px solid #e2e8f0', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
                <div style={{ position: 'relative', flex: 1, minWidth: 200 }}>
                    <Search size={15} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                    <input 
                        value={search} 
                        onChange={e => { setSearch(e.target.value); setCurrentPage(1); }} 
                        placeholder="Buscar por nombre, categoría o ID…" 
                        style={{ padding: '0.55rem 0.75rem', paddingLeft: '2rem', background: 'rgba(255,255,255,0.06)', border: '1px solid var(--surface-border)', borderRadius: 8, color: 'var(--text-primary)', fontSize: '0.875rem', outline: 'none', width: '100%', boxSizing: 'border-box' }} 
                    />
                </div>
            </div>

            {/* Table */}
            <div className="glass-panel p-6 pb-0">
                <div className="glass-table-container">
                    <table className="glass-table">
                        <thead>
                            <tr style={{ borderBottom: '1px solid var(--surface-border)' }}>
                                {[
                                    { label: 'Cod.', key: 'id', w: '60px' },
                                    { label: 'Imagen', key: null, w: '70px' },
                                    { label: 'Nombre', key: 'name', w: 'auto' },
                                    { label: 'Stock', key: 'totalStock', w: '90px' },
                                    { label: 'Valor', key: 'value', w: '130px' },
                                    { label: 'Días calendario facturables', key: 'esquemaCobro', w: '200px' },
                                    { label: 'Estado', key: 'estado', w: '110px' },
                                    { label: 'Acción', key: null, w: '125px' }
                                ].map(({ label, key, w }) => (
                                    <th 
                                        key={label} 
                                        onClick={() => key && handleSort(key)}
                                        style={{ 
                                            width: w,
                                            padding: '0.4rem 0.75rem', textAlign: 'left', 
                                            fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 600, 
                                            textTransform: 'uppercase', letterSpacing: '0.05em', 
                                            cursor: key ? 'pointer' : 'default', userSelect: 'none'
                                        }}
                                    >
                                        <div style={{ display: 'flex', alignItems: 'center', gap: 4, height: '100%' }}>
                                            <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{label}</span>
                                            <div style={{ width: 14, flexShrink: 0, display: 'flex', alignItems: 'center' }}>
                                                {key && sortConfig.key === key ? (
                                                    sortConfig.direction === 'asc' ? <ChevronUp size={12} /> : <ChevronDown size={12} />
                                                ) : (
                                                    key ? <div style={{ width: 12 }} /> : null
                                                )}
                                            </div>
                                        </div>
                                    </th>
                                ))}
                            </tr>
                        </thead>
                        <tbody>
                            {paginatedProducts.map(p => {
                                const blocked = hasPendingMaint(p.id);
                                const isBaja = p.estado === 'Dado de baja';
                                return (
                                    <tr key={p.id} style={{ opacity: isBaja ? 0.6 : 1 }}>
                                        <td style={{ fontWeight: 600, color: 'var(--primary)' }}>
                                            {String(p.id || '').includes('-') ? String(p.id || '').split('-')[1]?.slice(-2) : String(p.id || '').slice(-2)}
                                        </td>
                                        <td><img src={p.image} alt={p.name} style={{ width: 32, height: 32, objectFit: 'cover', borderRadius: 6, border: '1px solid var(--surface-border)' }} /></td>
                                        <td 
                                            style={{ fontWeight: 600, cursor: 'pointer' }}
                                            onClick={() => setHojaProduct(p)}
                                            className="hover:text-primary transition-colors"
                                        >
                                            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                                {p.name}
                                            </div>
                                            {blocked && (
                                                <span style={{ marginTop: 4, padding: '1px 7px', borderRadius: 999, background: 'rgba(239,68,68,0.12)', color: '#ef4444', fontSize: '0.65rem', fontWeight: 700, border: '1px solid rgba(239,68,68,0.25)', display: 'inline-flex', alignItems: 'center', gap: 3 }}>
                                                    <AlertTriangle size={9} /> BLOQUEADO
                                                </span>
                                            )}
                                            {isBaja && (
                                                <span style={{ marginTop: 4, padding: '1px 7px', borderRadius: 999, background: 'rgba(249,115,22,0.12)', color: '#f97316', fontSize: '0.65rem', fontWeight: 700, border: '1px solid rgba(249,115,22,0.25)', display: 'inline-flex', alignItems: 'center', gap: 3 }}>
                                                    <ArrowDownCircle size={9} /> BAJA
                                                </span>
                                            )}
                                        </td>
                                        <td>
                                            <div style={{ fontWeight: 600, fontSize: '0.82rem', color: 'var(--text-primary)' }}>
                                                {p.availableStock} / {p.totalStock}
                                            </div>
                                        </td>
                                        <td>
                                            <div style={{ fontWeight: 600, color: '#104166' }}>
                                                {(p.tipoCobro === 'Servicio' || p.category === 'Servicio' || p.esquemaCobro === 'Única Vez')
                                                    ? `$${p.value.toLocaleString()} (Única vez)`
                                                    : `$${p.value.toLocaleString()} / ${p.tipoCobro || 'Día'}`}
                                            </div>
                                        </td>
                                        <td>
                                            <div style={{ color: '#475569', fontWeight: 600 }}>
                                                {(p.tipoCobro === 'Servicio' || p.category === 'Servicio' || p.esquemaCobro === 'Única Vez')
                                                    ? 'Cobro Único'
                                                    : (p.esquemaCobro || 'Calendario')}
                                            </div>
                                        </td>
                                        <td>
                                            {isBaja ? (
                                                <div className="badge" style={{ background: '#f97316', color: 'white', fontSize: '0.72rem', boxShadow: '0 2px 4px rgba(249,115,22,0.3)' }}>BAJA</div>
                                            ) : (
                                                <div className={`badge`}
                                                    style={{ 
                                                        background: p.availableStock > 0 ? '#10b981' : '#ef4444', 
                                                        color: 'white',
                                                        boxShadow: p.availableStock > 0 ? '0 2px 4px rgba(16,185,129,0.3)' : '0 2px 4px rgba(239,68,68,0.3)'
                                                    }}>
                                                    {p.availableStock > 0 ? 'DISPONIBLE' : 'AGOTADO'}
                                                </div>
                                            )}
                                        </td>
                                        <td>
                                            <div style={{ display: 'flex', gap: '8px' }}>
                                                {!isBaja && (
                                                    <button 
                                                        onClick={() => { setEditingProduct({ ...p }); setShowEditModal(true); }}
                                                        title="Editar"
                                                        style={{ 
                                                            width: 32, height: 32, padding: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', 
                                                            background: '#2365AB', color: 'white', border: 'none', borderRadius: 6, cursor: 'pointer', transition: 'all 0.2s'
                                                        }}
                                                        onMouseOver={e => e.currentTarget.style.background = '#1a4b80'}
                                                        onMouseOut={e => e.currentTarget.style.background = '#2365AB'}
                                                    >
                                                        <Pencil size={14} />
                                                    </button>
                                                )}
                                                {!isBaja && (
                                                    <button
                                                        onClick={() => setBajaProduct(p)}
                                                        title="Dar de Baja"
                                                        style={{ 
                                                            width: 32, height: 32, padding: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', 
                                                            background: '#f97316', color: 'white', border: 'none', borderRadius: 6, cursor: 'pointer', transition: 'all 0.2s'
                                                        }}
                                                        onMouseOver={e => e.currentTarget.style.background = '#ea580c'}
                                                        onMouseOut={e => e.currentTarget.style.background = '#f97316'}
                                                    >
                                                        <ArrowDownCircle size={14} />
                                                    </button>
                                                )}
                                                <button
                                                    onClick={() => setDeleteProduct(p)}
                                                    title="Eliminar"
                                                    style={{ 
                                                        width: 32, height: 32, padding: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', 
                                                        background: '#ef4444', color: 'white', border: 'none', borderRadius: 6, cursor: 'pointer', transition: 'all 0.2s'
                                                    }}
                                                    onMouseOver={e => e.currentTarget.style.background = '#dc2626'}
                                                    onMouseOut={e => e.currentTarget.style.background = '#ef4444'}
                                                >
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

                {/* Pagination Controls */}
                <div className="flex justify-between items-center mt-4 pt-5 pb-6 px-6" style={{ 
                    borderTop: '1px solid var(--surface-border)', 
                    paddingTop: '1.25rem',
                    flexWrap: 'wrap', 
                    gap: '1rem'
                }}>
                    <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: '1rem', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                            <span>Mostrar:</span>
                            <div style={{ position: 'relative' }}>
                                <select 
                                    value={itemsPerPage} 
                                    onChange={e => { setItemsPerPage(Number(e.target.value)); setCurrentPage(1); }}
                                    className="input-base"
                                    style={{ appearance: 'none', WebkitAppearance: 'none', MozAppearance: 'none', padding: '0.3rem 1.8rem 0.3rem 0.6rem', fontSize: '0.8rem', width: 'auto', minWidth: '70px', height: '32px' }}
                                >
                                    {[5, 10, 20, 50, 100].map(n => <option key={n} value={n}>{n}</option>)}
                                </select>
                                <ChevronDown size={14} style={{ position: 'absolute', right: 6, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none', color: 'var(--text-muted)' }} />
                            </div>
                            <span>por página</span>
                        </div>
                        <div style={{ width: '1px', height: '16px', background: 'var(--surface-border)' }}></div>
                        <div>
                            Mostrando {products.length > 0 ? (currentPage - 1) * itemsPerPage + 1 : 0} a {Math.min(currentPage * itemsPerPage, products.length)} de {products.length} registros
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

            {/* Hoja de Vida */}
            {hojaProduct && <HojaDeVidaPanel product={hojaProduct} maintenances={maintenances} onClose={() => setHojaProduct(null)} />}

            {/* Dar de Baja Modal */}
            {bajaProduct && (
                <BajaModal
                    product={bajaProduct}
                    onClose={() => setBajaProduct(null)}
                    onConfirm={(motivo) => darDeBajaProduct(bajaProduct.id, motivo)}
                />
            )}

            {/* Eliminar Modal */}
            {deleteProduct_ && (
                <DeleteModal
                    product={deleteProduct_}
                    onClose={() => setDeleteProduct(null)}
                    onConfirm={() => deleteProduct(deleteProduct_.id)}
                />
            )}

            {/* Field Inventory Modal */}
            {showFieldModal && (
                <FieldInventoryModal 
                    onClose={() => setShowFieldModal(false)} 
                    products={products} 
                    remisiones={remisiones} 
                    clients={clients} 
                />
            )}

            {/* Add Modal */}
            {showAddModal && (
                <div className="modal-overlay" onClick={() => setShowAddModal(false)} style={{ alignItems: 'flex-start', padding: '2rem 1rem' }}>
                    <div className="modal-content fadeIn" onClick={e => e.stopPropagation()} style={{ maxWidth: 900, width: '100%', maxHeight: '80vh', overflowY: 'auto', marginTop: '2vh' }}>
                        <h3 className="modal-title">Agregar Nuevo Equipo</h3>
                        
                        <div style={{ display: 'grid', gridTemplateColumns: '1.5fr 1fr 0.6fr', gap: '0.75rem', marginBottom: '0.75rem' }}>
                            <div className="input-group" style={{ margin: 0 }}>
                                <label className="input-label">Nombre del Equipo</label>
                                <input type="text" className="input-base" value={newProduct.name}
                                    onChange={e => setNewProduct(prev => ({ ...prev, name: e.target.value }))}
                                    placeholder="Ej. Trompo Mezclador" />
                            </div>
                            <div className="input-group" style={{ margin: 0 }}>
                                <label className="input-label">Categoría</label>
                                <select className="input-base" value={newProduct.category}
                                    onChange={e => {
                                        const cat = e.target.value;
                                        const isServ = cat === 'Servicio';
                                        setNewProduct(prev => ({
                                            ...prev,
                                            category: cat,
                                            tipoCobro: isServ ? 'Servicio' : (prev.tipoCobro === 'Servicio' ? 'Día' : prev.tipoCobro),
                                            esquemaCobro: isServ ? 'Única Vez' : prev.esquemaCobro
                                        }));
                                    }}>
                                    <option value="">Seleccione…</option>
                                    <option value="Heavy Machinery">Maquinaria Pesada</option>
                                    <option value="Power Tools">Herramientas Eléctricas</option>
                                    <option value="Structures">Estructuras y Andamios</option>
                                    <option value="Servicio">Servicio (Cobro Único)</option>
                                    <option value="Other">Otro</option>
                                </select>
                            </div>
                            <div className="input-group" style={{ margin: 0 }}>
                                <label className="input-label">Stock Total</label>
                                <input type="number" min="1" className="input-base" value={newProduct.totalStock}
                                    onChange={e => setNewProduct(prev => ({ ...prev, totalStock: parseInt(e.target.value) || 1 }))} />
                            </div>
                        </div>

                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem', marginBottom: '0.75rem' }}>
                            <div className="input-group" style={{ margin: 0 }}>
                                <label className="input-label">Tarifa Alquiler / Servicio ($)</label>
                                <div style={{ display: 'flex', gap: '0.5rem' }}>
                                    <input type="number" className="input-base" value={newProduct.value}
                                        onChange={e => setNewProduct(prev => ({ ...prev, value: e.target.value }))}
                                        placeholder="Ej. 15000" style={{ flex: 1 }} />
                                    <select className="input-base" style={{ width: 130, padding: '0.6rem' }} value={newProduct.tipoCobro || 'Día'}
                                        onChange={e => {
                                            const tc = e.target.value;
                                            const isServ = tc === 'Servicio' || newProduct.category === 'Servicio';
                                            setNewProduct(prev => ({
                                                ...prev,
                                                tipoCobro: tc,
                                                esquemaCobro: isServ ? 'Única Vez' : prev.esquemaCobro
                                            }));
                                        }}>
                                        <option value="Día">Día</option>
                                        <option value="Hora">Hora</option>
                                        <option value="Servicio">Servicio (Única Vez)</option>
                                    </select>
                                </div>
                            </div>
                            <div className="input-group" style={{ margin: 0 }}>
                                <label className="input-label">Esquema de Cobro</label>
                                {(() => {
                                    const isServ = newProduct.category === 'Servicio' || newProduct.tipoCobro === 'Servicio';
                                    return (
                                        <select className="input-base" 
                                            disabled={isServ}
                                            value={isServ ? 'Única Vez' : (newProduct.esquemaCobro || 'Calendario')}
                                            onChange={e => setNewProduct(prev => ({ ...prev, esquemaCobro: e.target.value }))}
                                            style={{ 
                                                opacity: isServ ? 0.75 : 1, 
                                                cursor: isServ ? 'not-allowed' : 'default', 
                                                background: isServ ? '#f1f5f9' : 'white' 
                                            }}
                                        >
                                            <option value="Calendario">Días Calendario (Todos)</option>
                                            <option value="Lunes-Sábado">Lunes a Sábado</option>
                                            <option value="Lunes-Viernes">Lunes a Viernes</option>
                                            <option value="Única Vez">Única Vez (Cobro Único)</option>
                                        </select>
                                    );
                                })()}
                            </div>
                        </div>
                        <DropZone state={newProduct} setter={setNewProduct} fileInputRef={fileInputRef} />
                        <div style={{ borderTop: '1px solid var(--surface-border)', paddingTop: '0.75rem', marginBottom: '0.5rem', marginTop: '0.75rem', fontSize: '0.7rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.07em' }}>Hoja de Vida del Equipo</div>
                        <LifeFields state={newProduct} setter={setNewProduct} />
                        <div className="modal-actions mt-4" style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem' }}>
                            <button className="btn btn-secondary" onClick={() => setShowAddModal(false)}>Cancelar</button>
                            <button className="btn btn-primary" onClick={handleAddProduct}>Registrar</button>
                        </div>
                    </div>
                </div>
            )}

            {/* Edit Modal */}
            {showEditModal && editingProduct && (
                <div className="modal-overlay" onClick={() => setShowEditModal(false)} style={{ alignItems: 'flex-start', padding: '2rem 1rem' }}>
                    <div className="modal-content fadeIn" onClick={e => e.stopPropagation()} style={{ maxWidth: 900, width: '100%', maxHeight: '80vh', overflowY: 'auto', marginTop: '2vh' }}>
                        <h3 className="modal-title">Editar Equipo — {editingProduct.id}</h3>

                        <div style={{ display: 'grid', gridTemplateColumns: '1.5fr 1fr 0.6fr', gap: '0.75rem', marginBottom: '0.75rem' }}>
                            <div className="input-group" style={{ margin: 0 }}>
                                <label className="input-label">Nombre</label>
                                <input type="text" className="input-base" value={editingProduct.name}
                                    onChange={e => setEditingProduct(prev => ({ ...prev, name: e.target.value }))} />
                            </div>
                            <div className="input-group" style={{ margin: 0 }}>
                                <label className="input-label">Categoría</label>
                                <select className="input-base" value={editingProduct.category}
                                    onChange={e => {
                                        const cat = e.target.value;
                                        const isServ = cat === 'Servicio';
                                        setEditingProduct(prev => ({
                                            ...prev,
                                            category: cat,
                                            tipoCobro: isServ ? 'Servicio' : (prev.tipoCobro === 'Servicio' ? 'Día' : prev.tipoCobro),
                                            esquemaCobro: isServ ? 'Única Vez' : prev.esquemaCobro
                                        }));
                                    }}>
                                    <option value="">Seleccione…</option>
                                    <option value="Heavy Machinery">Maquinaria Pesada</option>
                                    <option value="Power Tools">Herramientas Eléctricas</option>
                                    <option value="Structures">Estructuras y Andamios</option>
                                    <option value="Servicio">Servicio (Cobro Único)</option>
                                    <option value="Equipment">Equipo</option>
                                    <option value="Machinery">Maquinaria</option>
                                    <option value="Other">Otro</option>
                                </select>
                            </div>
                            <div className="input-group" style={{ margin: 0 }}>
                                <label className="input-label">Stock Total</label>
                                <input type="number" min="1" className="input-base" value={editingProduct.totalStock}
                                    onChange={e => setEditingProduct(prev => ({ ...prev, totalStock: parseInt(e.target.value) || 1 }))} />
                            </div>
                        </div>

                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem', marginBottom: '0.75rem' }}>
                            <div className="input-group" style={{ margin: 0 }}>
                                <label className="input-label">Tarifa Alquiler / Servicio ($)</label>
                                <div style={{ display: 'flex', gap: '0.5rem' }}>
                                    <input type="number" className="input-base" value={editingProduct.value}
                                        onChange={e => setEditingProduct(prev => ({ ...prev, value: e.target.value }))} style={{ flex: 1 }} />
                                    <select className="input-base" style={{ width: 130, padding: '0.6rem' }} value={editingProduct.tipoCobro || 'Día'}
                                        onChange={e => {
                                            const tc = e.target.value;
                                            const isServ = tc === 'Servicio' || editingProduct.category === 'Servicio';
                                            setEditingProduct(prev => ({
                                                ...prev,
                                                tipoCobro: tc,
                                                esquemaCobro: isServ ? 'Única Vez' : prev.esquemaCobro
                                            }));
                                        }}>
                                        <option value="Día">Día</option>
                                        <option value="Hora">Hora</option>
                                        <option value="Servicio">Servicio (Única Vez)</option>
                                    </select>
                                </div>
                            </div>
                            <div className="input-group" style={{ margin: 0 }}>
                                <label className="input-label">Esquema de Cobro</label>
                                {(() => {
                                    const isServ = editingProduct.category === 'Servicio' || editingProduct.tipoCobro === 'Servicio';
                                    return (
                                        <select className="input-base" 
                                            disabled={isServ}
                                            value={isServ ? 'Única Vez' : (editingProduct.esquemaCobro || 'Calendario')}
                                            onChange={e => setEditingProduct(prev => ({ ...prev, esquemaCobro: e.target.value }))}
                                            style={{ 
                                                opacity: isServ ? 0.75 : 1, 
                                                cursor: isServ ? 'not-allowed' : 'default', 
                                                background: isServ ? '#f1f5f9' : 'white' 
                                            }}
                                        >
                                            <option value="Calendario">Días Calendario (Todos)</option>
                                            <option value="Lunes-Sábado">Lunes a Sábado</option>
                                            <option value="Lunes-Viernes">Lunes a Viernes</option>
                                            <option value="Única Vez">Única Vez (Cobro Único)</option>
                                        </select>
                                    );
                                })()}
                            </div>
                        </div>
                        <DropZone state={editingProduct} setter={setEditingProduct} fileInputRef={fileInputRef} />
                        <div style={{ borderTop: '1px solid var(--surface-border)', paddingTop: '0.75rem', marginBottom: '0.5rem', marginTop: '0.75rem', fontSize: '0.7rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.07em' }}>Hoja de Vida del Equipo</div>
                        <LifeFields state={editingProduct} setter={setEditingProduct} />
                        <div className="modal-actions mt-4" style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem' }}>
                            <button className="btn btn-secondary" onClick={() => { setShowEditModal(false); setEditingProduct(null); }}>Cancelar</button>
                            <button className="btn btn-primary" onClick={handleEditProduct}>Guardar Cambios</button>
                        </div>
                    </div>
                </div>
            )}
        </>
    );
}
