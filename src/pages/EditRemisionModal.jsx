import React, { useState } from 'react';
import { X, Save, Edit3, Plus, Trash2, Calendar, DollarSign, FileText, CheckCircle, Package, Truck, User } from 'lucide-react';
import Swal from 'sweetalert2';

export default function EditRemisionModal({ remision, onClose, onSave, products = [], clients = [] }) {
    const [fecha, setFecha] = useState(remision?.fecha || '');
    const [estado, setEstado] = useState(remision?.estado || 'Activa');
    const [transporte, setTransporte] = useState(remision?.transporte || 0);
    const [responsableTransporte, setResponsableTransporte] = useState(remision?.responsableTransporte || '');
    const [notas, setNotas] = useState(remision?.notas || '');
    const [items, setItems] = useState(
        (remision?.items || []).map(i => ({
            productId: i.productId || '',
            nombre: i.nombre || i.name || '',
            cantidad: Number(i.cantidad) || 1,
            cantidadDevuelta: Number(i.cantidadDevuelta) || 0,
            tarifaDia: Number(i.tarifaDia) || 0,
            tipoCobro: i.tipoCobro || '',
            category: i.category || ''
        }))
    );
    const [selectedAddProduct, setSelectedAddProduct] = useState('');

    const client = clients.find(c => c.id === remision?.clientId);
    const obra = client?.obras?.find(o => o.id === remision?.obraId);

    const handleItemChange = (idx, field, value) => {
        const copy = [...items];
        copy[idx] = { ...copy[idx], [field]: value };
        setItems(copy);
    };

    const handleAddItem = () => {
        if (!selectedAddProduct) return;
        const prod = products.find(p => p.id === selectedAddProduct);
        if (!prod) return;

        setItems(prev => [
            ...prev,
            {
                productId: prod.id,
                nombre: prod.name,
                cantidad: 1,
                cantidadDevuelta: 0,
                tarifaDia: Number(prod.value) || 0,
                tipoCobro: prod.tipoCobro || 'Día',
                category: prod.category || ''
            }
        ]);
        setSelectedAddProduct('');
    };

    const handleRemoveItem = (idx) => {
        setItems(prev => prev.filter((_, i) => i !== idx));
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        try {
            const updated = {
                ...remision,
                fecha,
                estado,
                transporte: Number(transporte) || 0,
                responsableTransporte,
                notas,
                items: items.map(i => ({
                    ...i,
                    cantidad: Number(i.cantidad) || 1,
                    cantidadDevuelta: Number(i.cantidadDevuelta) || 0,
                    tarifaDia: Number(i.tarifaDia) || 0
                }))
            };
            await onSave(remision.id, updated);
            Swal.fire({
                title: '¡Remisión Actualizada!',
                text: `La remisión ${remision.id} ha sido actualizada exitosamente.`,
                icon: 'success',
                confirmButtonColor: '#2365AB',
                timer: 2000,
                borderRadius: '16px'
            });
            onClose();
        } catch (err) {
            Swal.fire({
                title: 'Error al actualizar',
                text: err.message || 'No se pudo guardar la modificación.',
                icon: 'error',
                confirmButtonColor: '#ef4444'
            });
        }
    };

    const IS = {
        width: '100%', padding: '0.6rem 0.8rem', boxSizing: 'border-box',
        background: '#f8fafc', border: '1px solid #e2e8f0',
        borderRadius: 8, color: '#1e293b', fontSize: '0.85rem', outline: 'none'
    };

    return (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.7)', backdropFilter: 'blur(8px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1100, padding: '1.5rem' }}>
            <div onClick={e => e.stopPropagation()} style={{ background: '#ffffff', borderRadius: 24, boxShadow: '0 25px 50px -12px rgba(0,0,0,0.25)', width: '100%', maxWidth: 950, maxHeight: '90vh', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
                
                {/* Header */}
                <div style={{ padding: '1.25rem 2rem', borderBottom: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#f8fafc' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                        <div style={{ background: '#2365AB', color: 'white', padding: '0.6rem', borderRadius: 12 }}>
                            <Edit3 size={24} />
                        </div>
                        <div>
                            <h2 style={{ margin: 0, fontSize: '1.3rem', fontWeight: 900, color: '#1e293b' }}>
                                Editar Remisión {remision?.id}
                            </h2>
                            <p style={{ margin: 0, fontSize: '0.8rem', color: '#64748b' }}>
                                {client?.name} · Obra: {obra?.nombre || 'General'}
                            </p>
                        </div>
                    </div>
                    <button onClick={onClose} style={{ background: '#f1f5f9', border: 'none', borderRadius: '50%', width: 38, height: 38, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: '#64748b' }}>
                        <X size={20} />
                    </button>
                </div>

                {/* Form Body */}
                <form onSubmit={handleSubmit} style={{ flex: 1, overflowY: 'auto', padding: '1.5rem 2rem', display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                    
                    {/* Data Fields Grid */}
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem', background: '#f8fafc', padding: '1.25rem', borderRadius: 16, border: '1px solid #e2e8f0' }}>
                        <div>
                            <label style={{ fontSize: '0.75rem', fontWeight: 800, color: '#64748b', display: 'block', marginBottom: '0.4rem', textTransform: 'uppercase' }}>Fecha Remisión</label>
                            <input type="date" value={fecha} onChange={e => setFecha(e.target.value)} style={IS} required />
                        </div>
                        <div>
                            <label style={{ fontSize: '0.75rem', fontWeight: 800, color: '#64748b', display: 'block', marginBottom: '0.4rem', textTransform: 'uppercase' }}>Estado</label>
                            <select value={estado} onChange={e => setEstado(e.target.value)} style={IS}>
                                <option value="Pendiente">Pendiente</option>
                                <option value="Activa">Activa (En Campo)</option>
                                <option value="Parcial">Parcial (Devolución en proceso)</option>
                                <option value="Cerrada">Cerrada (Devuelto)</option>
                                <option value="Cancelada">Cancelada / Anulada</option>
                            </select>
                        </div>
                        <div>
                            <label style={{ fontSize: '0.75rem', fontWeight: 800, color: '#64748b', display: 'block', marginBottom: '0.4rem', textTransform: 'uppercase' }}>Valor Transporte ($)</label>
                            <input type="number" min="0" value={transporte} onChange={e => setTransporte(e.target.value)} style={IS} placeholder="0" />
                        </div>
                        <div>
                            <label style={{ fontSize: '0.75rem', fontWeight: 800, color: '#64748b', display: 'block', marginBottom: '0.4rem', textTransform: 'uppercase' }}>Resp. Transporte</label>
                            <input type="text" value={responsableTransporte} onChange={e => setResponsableTransporte(e.target.value)} style={IS} placeholder="Ej. Empresa / CIELO" />
                        </div>
                    </div>

                    {/* Items Section */}
                    <div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.85rem' }}>
                            <div style={{ fontWeight: 800, fontSize: '0.95rem', color: '#1e293b', display: 'flex', alignItems: 'center', gap: 6 }}>
                                <Package size={18} color="#2365AB" /> Equipos y Servicios en la Remisión ({items.length})
                            </div>
                            
                            {/* Add Item dropdown */}
                            <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                                <select 
                                    value={selectedAddProduct} 
                                    onChange={e => setSelectedAddProduct(e.target.value)}
                                    style={{ ...IS, width: 230, padding: '0.45rem 0.6rem' }}
                                >
                                    <option value="">+ Seleccionar Equipo...</option>
                                    {products.map(p => (
                                        <option key={p.id} value={p.id}>{p.name} ({p.id})</option>
                                    ))}
                                </select>
                                <button 
                                    type="button"
                                    onClick={handleAddItem}
                                    disabled={!selectedAddProduct}
                                    style={{ 
                                        padding: '0.45rem 0.85rem', background: !selectedAddProduct ? '#cbd5e1' : '#2365AB', 
                                        color: 'white', border: 'none', borderRadius: 8, fontWeight: 700, fontSize: '0.8rem', 
                                        cursor: !selectedAddProduct ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', gap: 4
                                    }}
                                >
                                    <Plus size={14} /> Agregar
                                </button>
                            </div>
                        </div>

                        {/* Items Table */}
                        <div style={{ border: '1px solid #e2e8f0', borderRadius: 14, overflow: 'hidden' }}>
                            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
                                <thead style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0' }}>
                                    <tr>
                                        <th style={{ padding: '0.65rem 0.85rem', textAlign: 'left', color: '#64748b', fontWeight: 700 }}>Descripción</th>
                                        <th style={{ padding: '0.65rem 0.85rem', textAlign: 'center', color: '#64748b', fontWeight: 700, width: '110px' }}>Cant. Despachada</th>
                                        <th style={{ padding: '0.65rem 0.85rem', textAlign: 'center', color: '#64748b', fontWeight: 700, width: '110px' }}>Cant. Devuelta</th>
                                        <th style={{ padding: '0.65rem 0.85rem', textAlign: 'right', color: '#64748b', fontWeight: 700, width: '130px' }}>Tarifa / V. Unitario</th>
                                        <th style={{ padding: '0.65rem 0.85rem', textAlign: 'center', width: '50px' }}></th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {items.length === 0 ? (
                                        <tr>
                                            <td colSpan={5} style={{ padding: '2rem', textAlign: 'center', color: '#94a3b8' }}>
                                                No hay ítems asignados a esta remisión.
                                            </td>
                                        </tr>
                                    ) : (
                                        items.map((it, idx) => {
                                            const isServ = (it.tipoCobro || '').toLowerCase().includes('servicio') || 
                                                           (it.tipoCobro || '').toLowerCase().includes('única') ||
                                                           (it.category || '').toLowerCase().includes('servicio');
                                            return (
                                                <tr key={idx} style={{ borderBottom: '1px solid #f1f5f9', background: idx % 2 === 0 ? '#ffffff' : '#fafafa' }}>
                                                    <td style={{ padding: '0.65rem 0.85rem' }}>
                                                        <input 
                                                            type="text" 
                                                            value={it.nombre} 
                                                            onChange={e => handleItemChange(idx, 'nombre', e.target.value)}
                                                            style={{ ...IS, background: 'white' }}
                                                            required 
                                                        />
                                                        {isServ && (
                                                            <span style={{ fontSize: '0.65rem', background: '#e0f2fe', color: '#0369a1', padding: '1px 6px', borderRadius: 4, fontWeight: 700, marginTop: 3, display: 'inline-block' }}>
                                                                Servicio (Cobro Único)
                                                            </span>
                                                        )}
                                                    </td>
                                                    <td style={{ padding: '0.65rem 0.85rem', textAlign: 'center' }}>
                                                        <input 
                                                            type="number" 
                                                            min="1" 
                                                            value={it.cantidad} 
                                                            onChange={e => handleItemChange(idx, 'cantidad', e.target.value)}
                                                            style={{ ...IS, textAlign: 'center', background: 'white' }}
                                                            required 
                                                        />
                                                    </td>
                                                    <td style={{ padding: '0.65rem 0.85rem', textAlign: 'center' }}>
                                                        <input 
                                                            type="number" 
                                                            min="0" 
                                                            max={it.cantidad} 
                                                            value={it.cantidadDevuelta} 
                                                            onChange={e => handleItemChange(idx, 'cantidadDevuelta', e.target.value)}
                                                            style={{ ...IS, textAlign: 'center', background: 'white' }}
                                                        />
                                                    </td>
                                                    <td style={{ padding: '0.65rem 0.85rem', textAlign: 'right' }}>
                                                        <input 
                                                            type="number" 
                                                            min="0" 
                                                            value={it.tarifaDia} 
                                                            onChange={e => handleItemChange(idx, 'tarifaDia', e.target.value)}
                                                            style={{ ...IS, textAlign: 'right', background: 'white' }}
                                                            required 
                                                        />
                                                    </td>
                                                    <td style={{ padding: '0.65rem 0.85rem', textAlign: 'center' }}>
                                                        <button 
                                                            type="button"
                                                            onClick={() => handleRemoveItem(idx)}
                                                            style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer', padding: 4 }}
                                                            title="Eliminar de remisión"
                                                        >
                                                            <Trash2 size={16} />
                                                        </button>
                                                    </td>
                                                </tr>
                                            );
                                        })
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>

                    {/* Notes Field */}
                    <div>
                        <label style={{ fontSize: '0.75rem', fontWeight: 800, color: '#64748b', display: 'block', marginBottom: '0.4rem', textTransform: 'uppercase' }}>Notas / Observaciones</label>
                        <textarea 
                            value={notas} 
                            onChange={e => setNotas(e.target.value)} 
                            rows={3} 
                            style={{ ...IS, resize: 'vertical', fontFamily: 'inherit' }}
                            placeholder="Añada cualquier aclaración, estado especial de equipos o anotaciones de despacho..."
                        />
                    </div>

                    {/* Footer / Actions */}
                    <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', paddingTop: '0.75rem', borderTop: '1px solid #e2e8f0' }}>
                        <button type="button" onClick={onClose} style={{ padding: '0.7rem 1.25rem', background: '#f1f5f9', color: '#475569', border: 'none', borderRadius: 12, fontWeight: 700, cursor: 'pointer' }}>
                            Cancelar
                        </button>
                        <button type="submit" style={{ padding: '0.7rem 1.5rem', background: '#2365AB', color: 'white', border: 'none', borderRadius: 12, fontWeight: 800, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6, boxShadow: '0 4px 12px rgba(35, 101, 171, 0.25)' }}>
                            <Save size={18} /> Guardar Cambios
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}
