import React, { useState, useRef, useEffect } from 'react';
import {
    PackagePlus, UploadCloud, QrCode,
    AlertTriangle, X, Wrench,
    ShieldCheck, ShieldAlert, Download, Factory
} from 'lucide-react';
import { useAppContext } from '../context/AppContext';
import QRCode from 'qrcode';

// ─── QR Util ─────────────────────────────────────────────────────────────────
async function generateQRDataURL(text) {
    return await QRCode.toDataURL(text, { width: 256, margin: 2, color: { dark: '#1e293b', light: '#ffffff' } });
}

// ─── Hoja de Vida Panel ───────────────────────────────────────────────────────
function HojaDeVidaPanel({ product, maintenances, onClose }) {
    const [qrUrl, setQrUrl] = useState('');
    const hasPending = maintenances.some(
        m => m.productId === product.id && (m.status === 'Pendiente' || m.status === 'En Proceso')
    );
    const prodMantenimientos = maintenances.filter(m => m.productId === product.id);

    useEffect(() => {
        generateQRDataURL(`CIELO|EQUIPO|${product.id}|${product.name}`).then(setQrUrl);
    }, [product.id, product.name]);

    const handlePrintQR = () => {
        const win = window.open('', '_blank');
        win.document.write(`<html><body style="text-align:center;padding:2rem;font-family:monospace">
      <h2 style="color:#1e293b">CIELO — Alquiler de Equipos</h2>
      <img src="${qrUrl}" style="width:200px;height:200px" />
      <h3>${product.id}</h3><p>${product.name}</p>
      <p style="font-size:11px;color:#64748b">Escanea para ver hoja de vida</p>
    </body></html>`);
        win.document.close(); win.print();
    };

    const statusColor = s => s === 'Completado' ? '#10b981' : s === 'En Proceso' ? '#f97316' : '#ef4444';

    return (
        <>
            <div style={{ position: 'fixed', right: 0, top: 0, bottom: 0, width: 480, zIndex: 900, background: '#ffffff', display: 'flex', flexDirection: 'column', boxShadow: '-6px 0 40px rgba(0,0,0,0.35)', overflowY: 'auto', animation: 'slideInRight 0.25s ease' }}>
                {/* Header */}
                <div style={{ background: 'linear-gradient(135deg, #1e293b, #334155)', padding: '1.5rem 1.75rem', flexShrink: 0 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                        <div>
                            <div style={{ fontSize: '1.2rem', fontWeight: 800, color: 'white', letterSpacing: '0.05em' }}>CIELO</div>
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
                            <div style={{ fontSize: '0.8rem', color: 'rgba(255,255,255,0.7)', marginTop: 2 }}>{product.id} · {product.category}</div>
                            <div style={{ marginTop: 6, fontSize: '0.72rem', color: 'rgba(255,255,255,0.6)' }}>Stock: {product.totalStock} total · {product.availableStock} disponibles</div>
                        </div>
                    </div>
                </div>

                {/* Body */}
                <div style={{ flex: 1, padding: '1.5rem 1.75rem', background: '#f8fafc', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                    {/* Datos de adquisición */}
                    <div style={{ background: 'white', border: '1px solid #e2e8f0', borderRadius: 10, overflow: 'hidden', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
                        <div style={{ background: '#f1f5f9', padding: '0.55rem 1rem', borderBottom: '1px solid #e2e8f0', fontSize: '0.68rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.08em', display: 'flex', alignItems: 'center', gap: 6 }}>
                            <Factory size={12} /> Datos de Adquisición
                        </div>
                        <div style={{ padding: '0.85rem 1rem', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.6rem' }}>
                            {[
                                ['Proveedor', product.proveedor || 'N/A'],
                                ['Fecha de Compra', product.fechaCompra || 'N/A'],
                                ['Costo Adquisición', product.costoAdquisicion ? `$${Number(product.costoAdquisicion).toLocaleString()}` : 'N/A'],
                                ['Tarifa Alquiler/día', `$${(product.value || 0).toLocaleString()}`],
                            ].map(([k, v]) => (
                                <div key={k}>
                                    <div style={{ fontSize: '0.68rem', color: '#94a3b8', fontWeight: 600, textTransform: 'uppercase' }}>{k}</div>
                                    <div style={{ fontSize: '0.875rem', fontWeight: 600, color: '#1e293b', marginTop: 2 }}>{v}</div>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Próximo mantenimiento */}
                    {product.proximoMantenimiento && (
                        <div style={{ background: hasPending ? '#fef2f2' : '#f0fdf4', border: `1px solid ${hasPending ? '#fecaca' : '#bbf7d0'}`, borderRadius: 10, padding: '0.85rem 1rem', display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                            {hasPending ? <ShieldAlert size={20} style={{ color: '#ef4444' }} /> : <ShieldCheck size={20} style={{ color: '#10b981' }} />}
                            <div>
                                <div style={{ fontSize: '0.7rem', fontWeight: 700, color: hasPending ? '#b91c1c' : '#166534', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                                    {hasPending ? 'Equipo Bloqueado por Mantenimiento' : 'Próximo Mantenimiento'}
                                </div>
                                <div style={{ fontSize: '0.9rem', fontWeight: 700, color: hasPending ? '#ef4444' : '#10b981', marginTop: 2 }}>
                                    {product.proximoMantenimiento}
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Historial mantenimientos */}
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
                                            <div style={{ fontWeight: 600, fontSize: '0.82rem', color: '#1e293b' }}>{m.type} — {m.description}</div>
                                            <div style={{ fontSize: '0.7rem', color: '#94a3b8', marginTop: 2 }}>{m.date} · Costo: ${(m.cost || 0).toLocaleString()}</div>
                                        </div>
                                        <span style={{ padding: '2px 10px', borderRadius: 999, fontSize: '0.68rem', fontWeight: 700, background: `${statusColor(m.status)}20`, color: statusColor(m.status), border: `1px solid ${statusColor(m.status)}40`, whiteSpace: 'nowrap' }}>{m.status}</span>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>

                    {/* QR Code */}
                    <div style={{ background: 'white', border: '1px solid #e2e8f0', borderRadius: 10, padding: '1.25rem', textAlign: 'center', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
                        <div style={{ fontSize: '0.68rem', color: '#64748b', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '1rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5 }}>
                            <QrCode size={12} /> Código QR del Equipo
                        </div>
                        {qrUrl ? (
                            <>
                                <img src={qrUrl} alt="QR" style={{ width: 160, height: 160, borderRadius: 8, border: '1px solid #e2e8f0', display: 'block', margin: '0 auto 0.75rem' }} />
                                <div style={{ fontFamily: 'monospace', fontSize: '0.7rem', color: '#64748b', marginBottom: '0.75rem' }}>{product.id} · {product.name}</div>
                                <button onClick={handlePrintQR} style={{ padding: '0.5rem 1.25rem', borderRadius: 8, background: '#3b82f6', color: 'white', border: 'none', cursor: 'pointer', fontWeight: 700, fontSize: '0.82rem', display: 'inline-flex', alignItems: 'center', gap: 5 }}>
                                    <Download size={14} /> Imprimir QR
                                </button>
                            </>
                        ) : <div style={{ color: '#94a3b8', fontSize: '0.85rem' }}>Generando QR…</div>}
                    </div>
                </div>
            </div>
            <div style={{ position: 'fixed', inset: 0, zIndex: 899 }} onClick={onClose} />
        </>
    );
}

// ─── MAIN COMPONENT ───────────────────────────────────────────────────────────
export default function Products() {
    const { products, returnProduct, addProduct, editProduct, maintenances } = useAppContext();
    const [showAddModal, setShowAddModal] = useState(false);
    const [showEditModal, setShowEditModal] = useState(false);
    const [editingProduct, setEditingProduct] = useState(null);
    const [hojaProduct, setHojaProduct] = useState(null);
    const [newProduct, setNewProduct] = useState({ name: '', category: '', value: '', image: '', totalStock: 1, proveedor: '', fechaCompra: '', costoAdquisicion: '', proximoMantenimiento: '' });
    const [isDragging, setIsDragging] = useState(false);
    const fileInputRef = useRef(null);

    const hasPendingMaint = (productId) =>
        maintenances.some(m => m.productId === productId && (m.status === 'Pendiente' || m.status === 'En Proceso'));

    const handleImageUpload = (file, setter) => {
        if (file && file.type.startsWith('image/')) {
            const reader = new FileReader();
            reader.onloadend = () => setter(prev => ({ ...prev, image: reader.result }));
            reader.readAsDataURL(file);
        }
    };

    const handleAddProduct = () => {
        if (newProduct.name) {
            addProduct({ ...newProduct, value: Number(newProduct.value), totalStock: Number(newProduct.totalStock), image: newProduct.image || 'https://placehold.co/150x150/e2e8f0/475569?text=Equipo' });
            setShowAddModal(false);
            setNewProduct({ name: '', category: '', value: '', image: '', totalStock: 1, proveedor: '', fechaCompra: '', costoAdquisicion: '', proximoMantenimiento: '' });
        }
    };

    const handleEditProduct = () => {
        if (editingProduct?.name) {
            editProduct(editingProduct.id, { ...editingProduct, value: Number(editingProduct.value), totalStock: Number(editingProduct.totalStock) });
            setShowEditModal(false); setEditingProduct(null);
        }
    };

    // Shared drag-drop image zone
    const DropZone = ({ state, setter }) => (
        <div className="input-group mb-2">
            <label className="input-label mb-2">Imagen del Equipo</label>
            <div onDragOver={e => { e.preventDefault(); setIsDragging(true); }}
                onDragLeave={e => { e.preventDefault(); setIsDragging(false); }}
                onDrop={e => { e.preventDefault(); setIsDragging(false); handleImageUpload(e.dataTransfer.files[0], setter); }}
                onClick={() => fileInputRef.current?.click()}
                style={{ border: `2px dashed ${isDragging ? 'var(--primary)' : 'var(--surface-border)'}`, borderRadius: 12, padding: '1.5rem', textAlign: 'center', backgroundColor: isDragging ? 'rgba(59,130,246,0.05)' : '#fafafa', cursor: 'pointer', transition: 'all 0.3s ease', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '0.75rem', minHeight: 120 }}>
                <input type="file" accept="image/*" ref={fileInputRef} onChange={e => handleImageUpload(e.target.files[0], setter)} style={{ display: 'none' }} />
                {state.image && !state.image.startsWith('http') ? (
                    <div><img src={state.image} alt="Preview" style={{ maxWidth: '100%', maxHeight: 90, objectFit: 'contain', borderRadius: 8 }} />
                        <div className="mt-2 text-sm text-primary font-medium">Click para cambiar</div></div>
                ) : (
                    <><div style={{ padding: '0.75rem', background: 'rgba(59,130,246,0.1)', borderRadius: '50%', color: 'var(--primary)' }}><UploadCloud size={26} /></div>
                        <p style={{ fontWeight: 600, color: 'var(--text-primary)', fontSize: '0.85rem' }}>Arrastra o haz clic</p></>
                )}
            </div>
            <div className="flex items-center gap-4 my-2"><hr style={{ flex: 1, borderColor: 'var(--surface-border)' }} /><span className="text-muted text-sm">O enlace</span><hr style={{ flex: 1, borderColor: 'var(--surface-border)' }} /></div>
            <input type="text" className="input-base" value={state.image} onChange={e => setter(prev => ({ ...prev, image: e.target.value }))} placeholder="https://…" />
            {state.image?.startsWith('http') && <div className="mt-2 text-center"><img src={state.image} alt="Preview" style={{ maxWidth: 70, maxHeight: 70, objectFit: 'contain', borderRadius: 8 }} /></div>}
        </div>
    );

    // Shared life sheet fields
    const LifeFields = ({ state, setter }) => (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.6rem' }}>
            {[['Proveedor', 'proveedor', 'text', 'Ej. Ferrasa S.A.'], ['Fecha de Compra', 'fechaCompra', 'date', ''], ['Costo Adquisición ($)', 'costoAdquisicion', 'number', '0'], ['Próximo Mantenimiento', 'proximoMantenimiento', 'date', '']].map(([label, key, type, ph]) => (
                <div key={key} className="input-group" style={{ margin: 0 }}>
                    <label className="input-label">{label}</label>
                    <input type={type} className="input-base" value={state[key] || ''} onChange={e => setter(prev => ({ ...prev, [key]: e.target.value }))} placeholder={ph} />
                </div>
            ))}
        </div>
    );

    return (
        <>
            {/* Header */}
            <div className="flex justify-between items-center mb-6">
                <div>
                    <h1>Inventario & Alquiler</h1>
                    <p className="text-muted">Gestión de maquinaria, hoja de vida y códigos QR</p>
                </div>
                <button className="btn btn-primary" onClick={() => setShowAddModal(true)}><PackagePlus size={20} /> Nuevo Equipo</button>
            </div>

            {/* Table */}
            <div className="glass-panel p-6">
                <div className="glass-table-container">
                    <table className="glass-table">
                        <thead>
                            <tr>
                                <th>Cod.</th><th>Imagen</th><th>Nombre</th><th>Categoría</th>
                                <th>Stock</th><th>Valor/Día</th><th>Estado</th><th>Acción</th>
                            </tr>
                        </thead>
                        <tbody>
                            {products.map(p => {
                                const blocked = hasPendingMaint(p.id);
                                return (
                                    <tr key={p.id}>
                                        <td style={{ fontWeight: 600, color: 'var(--primary)' }}>{p.id}</td>
                                        <td><img src={p.image} alt={p.name} style={{ width: 40, height: 40, objectFit: 'cover', borderRadius: 8, border: '1px solid var(--surface-border)' }} /></td>
                                        <td style={{ fontWeight: 600 }}>
                                            {p.name}
                                            {blocked && (
                                                <span style={{ marginLeft: 6, padding: '1px 7px', borderRadius: 999, background: 'rgba(239,68,68,0.12)', color: '#ef4444', fontSize: '0.65rem', fontWeight: 700, border: '1px solid rgba(239,68,68,0.25)', display: 'inline-flex', alignItems: 'center', gap: 3 }}>
                                                    <AlertTriangle size={9} /> BLOQUEADO
                                                </span>
                                            )}
                                        </td>
                                        <td className="text-muted">{p.category}</td>
                                        <td>
                                            <div style={{ fontWeight: 600 }}>Total: {p.totalStock}</div>
                                            <div className="text-muted" style={{ fontSize: '0.8rem' }}>Disp: {p.availableStock}</div>
                                        </td>
                                        <td>${p.value.toLocaleString()}</td>
                                        <td>
                                            <div className={`badge ${p.availableStock > 0 ? 'badge-success' : 'badge-danger'}`}
                                                style={p.availableStock === 0 ? { background: 'rgba(239,68,68,0.2)', color: '#ef4444', border: '1px solid rgba(239,68,68,0.3)' } : {}}>
                                                {p.availableStock > 0 ? 'Disponible' : 'Agotado'}
                                            </div>
                                        </td>
                                        <td>
                                            <div className="flex gap-2">
                                                <button className="btn btn-sm btn-primary" onClick={() => { setEditingProduct({ ...p }); setShowEditModal(true); }}>Editar</button>
                                                <button className="btn btn-sm btn-secondary" onClick={() => setHojaProduct(p)} style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
                                                    <QrCode size={13} /> HV / QR
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Hoja de Vida */}
            {hojaProduct && <HojaDeVidaPanel product={hojaProduct} maintenances={maintenances} onClose={() => setHojaProduct(null)} />}

            {/* Add Modal */}
            {showAddModal && (
                <div className="modal-overlay">
                    <div className="modal-content fadeIn" style={{ maxWidth: 580, maxHeight: '90vh', overflowY: 'auto', marginTop: '20vh' }}>
                        <h3 className="modal-title">Agregar Nuevo Equipo</h3>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem', marginBottom: '0.75rem' }}>
                            <div className="input-group" style={{ margin: 0 }}>
                                <label className="input-label">Nombre del Equipo</label>
                                <input type="text" className="input-base" value={newProduct.name} onChange={e => setNewProduct({ ...newProduct, name: e.target.value })} placeholder="Ej. Trompo Mezclador" />
                            </div>
                            <div className="input-group" style={{ margin: 0 }}>
                                <label className="input-label">Categoría</label>
                                <select className="input-base" value={newProduct.category} onChange={e => setNewProduct({ ...newProduct, category: e.target.value })}>
                                    <option value="">Seleccione…</option>
                                    <option value="Heavy Machinery">Maquinaria Pesada</option>
                                    <option value="Power Tools">Herramientas Eléctricas</option>
                                    <option value="Structures">Estructuras y Andamios</option>
                                    <option value="Other">Otro</option>
                                </select>
                            </div>
                            <div className="input-group" style={{ margin: 0 }}>
                                <label className="input-label">Valor Alquiler/día ($)</label>
                                <input type="number" className="input-base" value={newProduct.value} onChange={e => setNewProduct({ ...newProduct, value: e.target.value })} placeholder="Ej. 15000" />
                            </div>
                            <div className="input-group" style={{ margin: 0 }}>
                                <label className="input-label">Stock Total</label>
                                <input type="number" min="1" className="input-base" value={newProduct.totalStock} onChange={e => setNewProduct({ ...newProduct, totalStock: parseInt(e.target.value) || 1 })} />
                            </div>
                        </div>
                        <DropZone state={newProduct} setter={setNewProduct} />
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
                <div className="modal-overlay">
                    <div className="modal-content fadeIn" style={{ maxWidth: 580, maxHeight: '90vh', overflowY: 'auto', marginTop: '20vh' }}>
                        <h3 className="modal-title">Editar Equipo — {editingProduct.id}</h3>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem', marginBottom: '0.75rem' }}>
                            <div className="input-group" style={{ margin: 0 }}>
                                <label className="input-label">Nombre</label>
                                <input type="text" className="input-base" value={editingProduct.name} onChange={e => setEditingProduct({ ...editingProduct, name: e.target.value })} />
                            </div>
                            <div className="input-group" style={{ margin: 0 }}>
                                <label className="input-label">Categoría</label>
                                <select className="input-base" value={editingProduct.category} onChange={e => setEditingProduct({ ...editingProduct, category: e.target.value })}>
                                    <option value="">Seleccione…</option>
                                    <option value="Heavy Machinery">Maquinaria Pesada</option>
                                    <option value="Power Tools">Herramientas Eléctricas</option>
                                    <option value="Structures">Estructuras y Andamios</option>
                                    <option value="Equipment">Equipo</option>
                                    <option value="Machinery">Maquinaria</option>
                                    <option value="Other">Otro</option>
                                </select>
                            </div>
                            <div className="input-group" style={{ margin: 0 }}>
                                <label className="input-label">Valor/día ($)</label>
                                <input type="number" className="input-base" value={editingProduct.value} onChange={e => setEditingProduct({ ...editingProduct, value: e.target.value })} />
                            </div>
                            <div className="input-group" style={{ margin: 0 }}>
                                <label className="input-label">Stock Total</label>
                                <input type="number" min="1" className="input-base" value={editingProduct.totalStock} onChange={e => setEditingProduct({ ...editingProduct, totalStock: parseInt(e.target.value) || 1 })} />
                            </div>
                        </div>
                        <DropZone state={editingProduct} setter={setEditingProduct} />
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
