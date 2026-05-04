import React, { useState, useMemo, useEffect } from 'react';
import {
    Plus, Search, Printer, FileText, X, Building2, MapPin,
    Phone, Mail, Edit3, ChevronDown, ChevronRight, CheckCircle,
    Clock, AlertTriangle, Receipt, Percent, User, Download, Trash2, ShieldAlert,
    ChevronLeft, ChevronsLeft, ChevronsRight, ChevronUp, Camera
} from 'lucide-react';
import { useAppContext } from '../context/AppContext';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { format } from 'date-fns';
import { applyStandardLayout } from './pdfTheme';
import { WebcamCapture } from './CotizacionesHelpers';

// ─── Helpers ──────────────────────────────────────────────────────────────────
const OBRA_ESTADO = {
    'Activa': { color: '#10b981', bg: 'rgba(16,185,129,0.12)', Icon: CheckCircle },
    'Suspendida': { color: '#f97316', bg: 'rgba(249,115,22,0.12)', Icon: AlertTriangle },
    'Terminada': { color: '#94a3b8', bg: 'rgba(148,163,184,0.12)', Icon: Clock },
};

const InputField = ({ label, ...props }) => (
    <div>
        <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '0.4rem', fontWeight: 600 }}>
            {label}
        </label>
        <input className="input-base" style={{ padding: '0.65rem 0.8rem', fontSize: '0.85rem' }} {...props} />
    </div>
);

const SelectField = ({ label, children, ...props }) => (
    <div>
        <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '0.4rem', fontWeight: 600 }}>
            {label}
        </label>
        <select className="input-base" style={{ padding: '0.65rem 0.8rem', fontSize: '0.85rem', cursor: 'pointer' }} {...props}>
            {children}
        </select>
    </div>
);

// ─── PDF Export ───────────────────────────────────────────────────────────────
function exportClientPDF(client, invoices, products, settings) {
    const doc = new jsPDF();
    const W = doc.internal.pageSize.getWidth();
    const margin = 10;

    let y = applyStandardLayout(doc, 'Ficha de Cliente', settings, client.id);

    // Datos generales section
    doc.setTextColor(30, 41, 59);
    doc.setFontSize(10); doc.setFont('helvetica', 'bold');
    doc.text('1. Datos del Cliente', margin, y);

    autoTable(doc, {
        startY: y + 5,
        body: [
            ['Razón Social', client.name, 'NIT / CC', client.nit || '—'],
            ['Tipo Persona', client.tipoPersona || '—', 'Régimen', client.regimen || '—'],
            ['Responsable IVA', client.responsableIVA ? 'Sí' : 'No', '% IVA', `${client.porcIVA || 0}%`],
            ['% Retención', `${client.porcRetencion || 0}%`, 'Contacto', client.contactoPrincipal || '—'],
            ['Correo', client.email || '—', 'Teléfono', client.phone || '—'],
            ['Dirección', client.direccion || '—', 'Ciudad', `${client.ciudad || ''} – ${client.departamento || ''}`],
            ['Deuda Actual', `$${(client.debt || 0).toLocaleString()}`, 'Desde', client.joined || '—'],
        ],
        styles: { fontSize: 8, cellPadding: 3 },
        columnStyles: { 
            0: { fontStyle: 'bold', fillColor: [248, 250, 252], cellWidth: 35 }, 
            2: { fontStyle: 'bold', fillColor: [248, 250, 252], cellWidth: 35 } 
        },
        margin: { left: margin, right: margin },
    });

    // Obras section
    let currentY = doc.lastAutoTable.finalY + 12;
    doc.setFontSize(10); doc.setFont('helvetica', 'bold');
    doc.text('2. Obras / Proyectos', margin, currentY);

    autoTable(doc, {
        startY: currentY + 5,
        head: [['ID Obra', 'Nombre', 'Ubicación', 'Estado', 'Presupuesto', 'Inicio']],
        body: (client.obras || []).map(o => [
            o.id, o.nombre, o.ubicacion || '—', o.estado,
            `$${(o.presupuesto || 0).toLocaleString()}`,
            o.fechaInicio || '—',
        ]),
        headStyles: { fillColor: [30, 41, 59], textColor: 255, fontSize: 8 },
        styles: { fontSize: 8, cellPadding: 3 },
        alternateRowStyles: { fillColor: [248, 250, 252] },
        margin: { left: margin, right: margin },
    });

    // Facturas section
    currentY = doc.lastAutoTable.finalY + 12;
    doc.setFontSize(10); doc.setFont('helvetica', 'bold');
    doc.text('3. Historial de Facturación', margin, currentY);

    const clientInvoices = invoices.filter(inv => inv.clientId === client.id);
    autoTable(doc, {
        startY: currentY + 5,
        head: [['Factura', 'Obra', 'Fecha', 'Equipos', 'Monto', 'Estado']],
        body: clientInvoices.length > 0
            ? clientInvoices.map(inv => {
                const obraName = (client.obras || []).find(o => o.id === inv.obraId)?.nombre || '—';
                const itemsStr = inv.items.map(item => {
                    const prod = products.find(p => p.id === item.productId);
                    return prod ? `${item.quantity}x ${prod.name}` : item.productId;
                }).join(', ');
                return [inv.id, obraName, inv.date, itemsStr, `$${inv.amount.toLocaleString()}`, inv.status === 'Paid' ? 'PAGADA' : 'PENDIENTE'];
            })
            : [['—', '—', '—', 'Sin facturas registradas', '—', '—']],
        headStyles: { fillColor: [30, 41, 59], textColor: 255, fontSize: 8 },
        styles: { fontSize: 7.5, cellPadding: 3 },
        alternateRowStyles: { fillColor: [248, 250, 252] },
        margin: { left: margin, right: margin },
    });

    doc.save(`Ficha_${client.name.replace(/\s+/g, '_')}_${client.id}.pdf`);
}

// ─── MODAL: Nuevo / Editar Cliente ────────────────────────────────────────────
const EMPTY_CLIENT = {
    name: '', nit: '', tipoPersona: 'Jurídica', regimen: 'Común',
    responsableIVA: true, porcIVA: 19, porcRetencion: 2.5,
    email: '', phone: '', direccion: '', ciudad: '', departamento: '', contactoPrincipal: '',
    primeraObra: '', obraUbicacion: '', obraPresupuesto: '',
    foto: null, fotoCC: null, fotoCCBack: null
};

function ClientModal({ initial, onSave, onClose, isEdit }) {
    const [form, setForm] = useState(initial || EMPTY_CLIENT);
    const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

    return (
        <div 
            onClick={onClose}
            style={{ position: 'fixed', inset: 0, background: 'rgba(255, 255, 255, 0.3)', backdropFilter: 'blur(10px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '2rem 1rem' }}
        >
            <div 
                onClick={e => e.stopPropagation()}
                style={{ background: '#ffffff', borderRadius: '24px', boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.1)', width: '100%', maxWidth: 1100, maxHeight: '85vh', display: 'flex', flexDirection: 'column', border: '1px solid #e2e8f0' }}
            >
                <div style={{ padding: '1.25rem 2rem', borderBottom: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <h3 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '0.75rem', color: '#104166', fontSize: '1.2rem' }}>
                        <div style={{ background: 'rgba(35, 101, 171,0.1)', padding: '0.5rem', borderRadius: '10px', display: 'flex' }}>
                            <Building2 size={20} style={{ color: '#2365AB' }} />
                        </div>
                        {isEdit ? 'Editar Información del Cliente' : 'Registrar Nuevo Cliente'}
                    </h3>
                    <button onClick={onClose} style={{ background: '#f1f5f9', border: 'none', borderRadius: '50%', width: 32, height: 32, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: '#64748b', transition: 'all 0.2s' }} onMouseEnter={e => e.currentTarget.style.background = '#e2e8f0'} onMouseLeave={e => e.currentTarget.style.background = '#f1f5f9'}><X size={18} /></button>
                </div>

                <div style={{ padding: '1.25rem 2rem', overflowY: 'auto' }}>
                    <form onSubmit={e => { e.preventDefault(); onSave(form); }} id="client-form" style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                        {/* Sección: Datos Generales */}
                        <div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1rem' }}>
                                <User size={16} color="#2365AB" />
                                <h4 style={{ margin: 0, fontSize: '0.9rem', color: '#2365AB', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Datos Generales</h4>
                            </div>
                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '1.25rem' }}>
                                <div style={{ gridColumn: 'span 2' }}>
                                    <InputField label="Razón Social / Nombre Completo *" value={form.name} onChange={e => set('name', e.target.value)} placeholder="Ej. Constructora Andina S.A.S" required />
                                </div>
                                <InputField label="NIT / Cédula" value={form.nit} onChange={e => set('nit', e.target.value)} placeholder="900.123.456-7" />
                                <InputField label="Contacto Principal" value={form.contactoPrincipal} onChange={e => set('contactoPrincipal', e.target.value)} placeholder="Nombre del responsable" />
                                <InputField label="Correo Electrónico" type="email" value={form.email} onChange={e => set('email', e.target.value)} placeholder="contacto@empresa.com" />
                                <InputField label="Teléfono" value={form.phone} onChange={e => set('phone', e.target.value)} placeholder="300 123 4567" />
                                <div style={{ gridColumn: '1 / -1', display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '1.25rem' }}>
                                    <div style={{ gridColumn: 'span 2' }}>
                                        <InputField label="Dirección" value={form.direccion} onChange={e => set('direccion', e.target.value)} placeholder="Cra 15 # 80-20" />
                                    </div>
                                    <InputField label="Ciudad" value={form.ciudad} onChange={e => set('ciudad', e.target.value)} placeholder="Bogotá" />
                                    <InputField label="Departamento" value={form.departamento} onChange={e => set('departamento', e.target.value)} placeholder="Cundinamarca" />
                                </div>
                            </div>
                        </div>

                        <div style={{ borderTop: '1px solid #e2e8f0' }} />

                        {/* Sección: Configuración Tributaria */}
                        <div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1rem' }}>
                                <Percent size={16} color="#10b981" />
                                <h4 style={{ margin: 0, fontSize: '0.9rem', color: '#10b981', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Parametrización Tributaria</h4>
                            </div>
                            <div style={{ border: '1px solid #e2e8f0', borderRadius: '16px', padding: '1.5rem', display: 'grid', gridTemplateColumns: '1.2fr 1.2fr 1.2fr 0.7fr 0.7fr', gap: '1.25rem' }}>
                                <SelectField label="Tipo de Persona" value={form.tipoPersona} onChange={e => set('tipoPersona', e.target.value)}>
                                    <option value="Jurídica">Jurídica</option>
                                    <option value="Natural">Natural</option>
                                </SelectField>
                                <SelectField label="Régimen" value={form.regimen} onChange={e => set('regimen', e.target.value)}>
                                    <option value="Común">Régimen Común</option>
                                    <option value="Simplificado">Régimen Simplificado</option>
                                    <option value="Gran Contribuyente">Gran Contribuyente</option>
                                </SelectField>
                                <SelectField label="Responsable de IVA" value={form.responsableIVA ? 'si' : 'no'} onChange={e => {
                                    const isResp = e.target.value === 'si';
                                    setForm(f => ({ ...f, responsableIVA: isResp, porcIVA: isResp ? (f.porcIVA || 19) : 0 }));
                                }}>
                                    <option value="si">SÍ</option>
                                    <option value="no">NO</option>
                                </SelectField>
                                <InputField label="% IVA" type="number" min="0" max="100" step="0.1" value={form.porcIVA} onChange={e => set('porcIVA', Number(e.target.value))} />
                                <InputField label="% Ret. Fuente" type="number" min="0" max="100" step="0.1" value={form.porcRetencion} onChange={e => set('porcRetencion', Number(e.target.value))} />
                            </div>
                        </div>
                        {/* Sección: Obra Inicial (Solo para nuevos registros) */}
                        {!isEdit && (
                            <>
                                <div style={{ borderTop: '1px solid #e2e8f0' }} />
                                <div>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1rem' }}>
                                        <Building2 size={16} color="#f97316" />
                                        <h4 style={{ margin: 0, fontSize: '0.9rem', color: '#f97316', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Obra / Proyecto Inicial</h4>
                                    </div>
                                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '1.25rem' }}>
                                        <div style={{ gridColumn: 'span 2' }}>
                                            <InputField label="Nombre de la Primera Obra *" value={form.primeraObra} onChange={e => set('primeraObra', e.target.value)} placeholder="Ej. Proyecto Altamira" />
                                        </div>
                                        <InputField label="Presupuesto Inicial ($)" type="number" value={form.obraPresupuesto} onChange={e => set('obraPresupuesto', e.target.value)} placeholder="0" />
                                        <div style={{ gridColumn: '1 / -1' }}>
                                            <InputField label="Ubicación de la Obra" value={form.obraUbicacion} onChange={e => set('obraUbicacion', e.target.value)} placeholder="Ciudad o dirección de la obra" />
                                        </div>
                                    </div>
                                </div>
                            </>
                        )}


                    </form>
                </div>

                <div style={{ padding: '1.25rem 2rem', background: '#f8fafc', borderTop: '1px solid #e2e8f0', display: 'flex', gap: '1rem', justifyContent: 'flex-end', borderBottomLeftRadius: '16px', borderBottomRightRadius: '16px' }}>
                    <button type="button" className="btn btn-secondary" onClick={onClose} style={{ minWidth: 120 }}>Cancelar</button>
                    <button type="submit" form="client-form" className="btn btn-primary" style={{ minWidth: 160 }}>{isEdit ? 'Guardar Cambios' : 'Registrar Cliente'}</button>
                </div>
            </div>
        </div>
    );
}

// ─── MODAL: Nueva Obra ────────────────────────────────────────────────────────
const EMPTY_OBRA = { nombre: '', ubicacion: '', estado: 'Activa', presupuesto: '', fechaInicio: format(new Date(), 'yyyy-MM-dd'), descripcion: '' };

function ObraModal({ onSave, onClose }) {
    const [form, setForm] = useState(EMPTY_OBRA);
    const set = (k, v) => setForm(f => ({ ...f, [k]: v }));
    return (
        <div 
            onClick={onClose}
            style={{ position: 'fixed', inset: 0, background: 'rgba(255, 255, 255, 0.3)', backdropFilter: 'blur(10px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1100, padding: '2rem 1rem' }}
        >
            <div 
                onClick={e => e.stopPropagation()}
                style={{ background: '#ffffff', borderRadius: '24px', boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.1)', width: '100%', maxWidth: 520, maxHeight: '85vh', display: 'flex', flexDirection: 'column', border: '1px solid #e2e8f0' }}
            >
                <div style={{ padding: '1.25rem 1.75rem', borderBottom: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <h3 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '0.75rem', color: '#104166', fontSize: '1.15rem' }}>
                        <div style={{ background: 'rgba(249,115,22,0.1)', padding: '0.5rem', borderRadius: '10px', display: 'flex' }}>
                            <MapPin size={18} style={{ color: '#f97316' }} />
                        </div>
                        Nueva Obra
                    </h3>
                    <button onClick={onClose} style={{ background: '#f1f5f9', border: 'none', borderRadius: '50%', width: 32, height: 32, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: '#64748b', transition: 'all 0.2s' }} onMouseEnter={e => e.currentTarget.style.background = '#e2e8f0'} onMouseLeave={e => e.currentTarget.style.background = '#f1f5f9'}><X size={18} /></button>
                </div>

                <div style={{ padding: '1.75rem', overflowY: 'auto' }}>
                    <form onSubmit={e => { e.preventDefault(); onSave({ ...form, presupuesto: Number(form.presupuesto) || 0 }); }} id="obra-form" style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                        <InputField label="Nombre de la Obra *" value={form.nombre} onChange={e => set('nombre', e.target.value)} placeholder="Ej. Torre Central" required />
                        <InputField label="Ubicación" value={form.ubicacion} onChange={e => set('ubicacion', e.target.value)} placeholder="Calle 100 # 50-20, Bogotá" />
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                            <SelectField label="Estado Inicial" value={form.estado} onChange={e => set('estado', e.target.value)}>
                                <option>Activa</option><option>Suspendida</option><option>Terminada</option>
                            </SelectField>
                            <InputField label="Presupuesto ($)" type="number" min="0" value={form.presupuesto} onChange={e => set('presupuesto', e.target.value)} placeholder="0" />
                        </div>
                        <InputField label="Fecha de Inicio" type="date" value={form.fechaInicio} onChange={e => set('fechaInicio', e.target.value)} />
                        <div>
                            <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '0.4rem', fontWeight: 600 }}>Descripción de la Obra</label>
                            <textarea value={form.descripcion} onChange={e => set('descripcion', e.target.value)} rows={3} placeholder="Ingrese detalles adicionales..."
                                className="input-base" style={{ padding: '0.65rem 0.8rem', fontSize: '0.85rem', resize: 'vertical' }} />
                        </div>
                    </form>
                </div>

                <div style={{ padding: '1.25rem 1.75rem', background: '#f8fafc', borderTop: '1px solid #e2e8f0', display: 'flex', gap: '1rem', justifyContent: 'flex-end', borderBottomLeftRadius: '16px', borderBottomRightRadius: '16px' }}>
                    <button type="button" className="btn btn-secondary" onClick={onClose}>Cancelar</button>
                    <button type="submit" form="obra-form" className="btn btn-primary" style={{ background: '#f97316', boxShadow: '0 4px 14px rgba(249,115,22,0.3)' }} onMouseEnter={e => e.currentTarget.style.background = '#ea580c'} onMouseLeave={e => e.currentTarget.style.background = '#f97316'}>Guardar Obra</button>
                </div>
            </div>
        </div>
    );
}

// ─── PANEL LATERAL: Ficha del Cliente ─────────────────────────────────────────

const DetailField = ({ label, children, full }) => (
    <div style={{ gridColumn: full ? '1 / -1' : 'auto' }}>
        <div style={{ fontSize: '0.68rem', color: '#94a3b8', fontWeight: 700, marginBottom: '0.3rem', textTransform: 'uppercase', letterSpacing: '0.06em' }}>{label}</div>
        <div style={{ fontSize: '0.9rem', fontWeight: 600, color: '#0f172a' }}>{children || <span style={{color:'#cbd5e1'}}>—</span>}</div>
    </div>
);

const SectionLabel = ({ icon, color, children }) => (
    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.7rem', fontWeight: 700, color, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '1rem' }}>
        {icon}{children}
    </div>
);

function ClientDetail({ client, onClose, onEdit, onAddObra, invoices, products, onDelete }) {
    const { settings } = useAppContext();
    const [tab, setTab] = useState('datos');
    const [showObraModal, setShowObraModal] = useState(false);

    const handleDelete = () => {
        const pass = prompt('POR SEGURIDAD: Ingrese la contraseña de administrador para eliminar este cliente:');
        if (pass === null) return;
        if (pass === 'admin123') {
            if (window.confirm(`¿Está seguro de eliminar permanentemente a ${client.name}?`)) onDelete(client.id);
        } else {
            alert('Contraseña incorrecta.');
        }
    };

    const clientInvoices = invoices.filter(inv => inv.clientId === client.id);
    const totalFacturado = clientInvoices.reduce((s, i) => s + i.amount, 0);
    const totalPagado = clientInvoices.filter(i => i.status === 'Paid').reduce((s, i) => s + i.amount, 0);
    const deuda = client.debt || 0;
    const obrasActivas = (client.obras || []).filter(o => o.estado === 'Activa').length;

    const TABS = [
        { k: 'datos',    label: 'Información' },
        { k: 'obras',    label: `Obras (${client.obras?.length || 0})` },
        { k: 'historial',label: `Historial (${clientInvoices.length})` },
    ];

    return (
        <>
            {/* Backdrop */}
            <div onClick={onClose} style={{ position:'fixed', inset:0, background:'rgba(15,23,42,0.5)', backdropFilter:'blur(6px)', zIndex:1000 }} />

            {/* Dialog */}
            <div style={{ position:'fixed', inset:0, zIndex:1001, display:'flex', alignItems:'center', justifyContent:'center', padding:'1.5rem' }}>
                <div onClick={e => e.stopPropagation()} style={{
                    width:'100%', maxWidth:1180, height:'90vh',
                    display:'flex', overflow:'hidden',
                    borderRadius:'20px', boxShadow:'0 32px 80px -12px rgba(0,0,0,0.4)',
                    border:'1px solid #1e3a5f',
                    animation:'cdFadeIn 0.22s ease'
                }}>

                    {/* ── LEFT SIDEBAR ── */}
                    <div style={{
                        width:270, flexShrink:0,
                        background:'linear-gradient(160deg,#0c2340 0%,#1a406e 100%)',
                        display:'flex', flexDirection:'column', padding:'2rem 1.5rem', gap:'1.25rem', overflowY:'auto'
                    }}>
                        {/* Avatar */}
                        <div style={{ display:'flex', flexDirection:'column', alignItems:'center', textAlign:'center', gap:'0.65rem' }}>
                            <div style={{ width:72, height:72, borderRadius:'50%', background:'rgba(255,255,255,0.1)', border:'2px solid rgba(255,255,255,0.2)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:'1.75rem', fontWeight:800, color:'white' }}>
                                {client.name?.charAt(0).toUpperCase()}
                            </div>
                            <div style={{ color:'white', fontWeight:800, fontSize:'0.95rem', lineHeight:1.3 }}>{client.name}</div>
                            <div style={{ color:'rgba(255,255,255,0.5)', fontSize:'0.75rem' }}>NIT: {client.nit || 'N/A'}</div>
                            <span style={{ padding:'3px 12px', borderRadius:'20px', fontSize:'0.68rem', fontWeight:700,
                                background: deuda > 0 ? 'rgba(239,68,68,0.2)' : 'rgba(16,185,129,0.2)',
                                color: deuda > 0 ? '#fca5a5' : '#6ee7b7',
                                border:`1px solid ${deuda > 0 ? 'rgba(239,68,68,0.3)' : 'rgba(16,185,129,0.3)'}`
                            }}>{deuda > 0 ? '● DEUDA ACTIVA' : '✓ AL DÍA'}</span>
                        </div>

                        <div style={{ height:'1px', background:'rgba(255,255,255,0.08)' }} />

                        {/* Métricas */}
                        {[
                            { label:'Facturado',    value:`$${totalFacturado.toLocaleString()}`, color:'#93c5fd' },
                            { label:'Pagado',       value:`$${totalPagado.toLocaleString()}`,    color:'#6ee7b7' },
                            { label:'Deuda',        value:`$${deuda.toLocaleString()}`,           color: deuda > 0 ? '#fca5a5' : '#6ee7b7' },
                            { label:'Obras Activas',value: obrasActivas,                          color:'#fde68a' },
                            { label:'Total Obras',  value: client.obras?.length || 0,             color:'rgba(255,255,255,0.6)' },
                        ].map(({ label, value, color }) => (
                            <div key={label} style={{ display:'flex', justifyContent:'space-between', alignItems:'center' }}>
                                <span style={{ fontSize:'0.75rem', color:'rgba(255,255,255,0.5)' }}>{label}</span>
                                <span style={{ fontSize:'0.88rem', fontWeight:700, color }}>{value}</span>
                            </div>
                        ))}

                        <div style={{ height:'1px', background:'rgba(255,255,255,0.08)' }} />

                        {/* Contacto rápido */}
                        {client.phone && <div style={{ display:'flex', alignItems:'center', gap:'0.5rem', color:'rgba(255,255,255,0.6)', fontSize:'0.78rem' }}><Phone size={13}/>{client.phone}</div>}
                        {client.email && <div style={{ display:'flex', alignItems:'center', gap:'0.5rem', color:'rgba(255,255,255,0.6)', fontSize:'0.78rem' }}><Mail size={13}/>{client.email}</div>}
                        {client.ciudad && <div style={{ display:'flex', alignItems:'center', gap:'0.5rem', color:'rgba(255,255,255,0.6)', fontSize:'0.78rem' }}><MapPin size={13}/>{client.ciudad}, {client.departamento}</div>}

                        <div style={{ flex:1 }} />

                        {/* Acciones */}
                        {[
                            { icon:<Download size={14}/>, label:'Exportar PDF', action:() => exportClientPDF(client, invoices, products, settings), danger:false },
                            { icon:<Edit3 size={14}/>,    label:'Editar',       action:() => onEdit(client), danger:false },
                            { icon:<Trash2 size={14}/>,  label:'Eliminar',     action:handleDelete, danger:true },
                        ].map(({ icon, label, action, danger }) => (
                            <button key={label} onClick={action} style={{
                                display:'flex', alignItems:'center', justifyContent:'center', gap:'0.5rem',
                                padding:'0.6rem', borderRadius:'10px', cursor:'pointer',
                                fontSize:'0.8rem', fontWeight:600, transition:'all 0.18s',
                                background: danger ? 'rgba(239,68,68,0.12)' : 'rgba(255,255,255,0.08)',
                                border:`1px solid ${danger ? 'rgba(239,68,68,0.25)' : 'rgba(255,255,255,0.12)'}`,
                                color: danger ? '#fca5a5' : 'rgba(255,255,255,0.85)'
                            }}
                                onMouseEnter={e => e.currentTarget.style.background = danger ? 'rgba(239,68,68,0.22)' : 'rgba(255,255,255,0.15)'}
                                onMouseLeave={e => e.currentTarget.style.background = danger ? 'rgba(239,68,68,0.12)' : 'rgba(255,255,255,0.08)'}
                            >{icon}{label}</button>
                        ))}
                    </div>

                    {/* ── RIGHT PANEL ── */}
                    <div style={{ flex:1, display:'flex', flexDirection:'column', overflow:'hidden', background:'white' }}>

                        {/* Tab bar */}
                        <div style={{ padding:'1rem 1.75rem', borderBottom:'1px solid #f1f5f9', display:'flex', justifyContent:'space-between', alignItems:'center', background:'white', flexShrink:0 }}>
                            <div style={{ display:'flex', gap:'0.25rem', background:'#f8fafc', borderRadius:'10px', padding:'0.25rem' }}>
                                {TABS.map(({ k, label }) => (
                                    <button key={k} onClick={() => setTab(k)} style={{
                                        padding:'0.45rem 1.1rem', borderRadius:'8px', fontSize:'0.82rem', fontWeight:700,
                                        border:'none', cursor:'pointer', transition:'all 0.18s',
                                        background: tab === k ? 'white' : 'transparent',
                                        color: tab === k ? '#2365AB' : '#94a3b8',
                                        boxShadow: tab === k ? '0 1px 4px rgba(0,0,0,0.08)' : 'none'
                                    }}>{label}</button>
                                ))}
                            </div>
                            <button onClick={onClose} style={{ background:'#f1f5f9', border:'none', borderRadius:'50%', width:34, height:34, display:'flex', alignItems:'center', justifyContent:'center', cursor:'pointer', color:'#64748b', transition:'all 0.2s' }}
                                onMouseEnter={e => e.currentTarget.style.background = '#e2e8f0'}
                                onMouseLeave={e => e.currentTarget.style.background = '#f1f5f9'}
                            ><X size={17}/></button>
                        </div>

                        {/* Content */}
                        <div style={{ flex:1, overflowY:'auto', padding:'2rem 2.5rem' }}>

                            {/* Tab: Información */}
                            {tab === 'datos' && (<>
                                <SectionLabel icon={<User size={13}/>} color="#2365AB">Datos de Contacto</SectionLabel>
                                <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:'1.5rem', marginBottom:'2rem' }}>
                                    <DetailField label="Razón Social">{client.name}</DetailField>
                                    <DetailField label="NIT / Cédula">{client.nit}</DetailField>
                                    <DetailField label="Contacto Principal">{client.contactoPrincipal}</DetailField>
                                    <DetailField label="Correo">{client.email}</DetailField>
                                    <DetailField label="Teléfono">{client.phone}</DetailField>
                                    <DetailField label="Dirección" full>{client.direccion ? `${client.direccion}, ${client.ciudad} – ${client.departamento}` : null}</DetailField>
                                </div>
                                <div style={{ height:'1px', background:'#f1f5f9', marginBottom:'2rem' }}/>
                                <SectionLabel icon={<Percent size={13}/>} color="#10b981">Configuración Tributaria</SectionLabel>
                                <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:'1.5rem' }}>
                                    <DetailField label="Tipo de Persona">{client.tipoPersona}</DetailField>
                                    <DetailField label="Régimen">{client.regimen}</DetailField>
                                    <DetailField label="Responsable IVA">{client.responsableIVA ? 'Sí' : 'No'}</DetailField>
                                    <DetailField label="% IVA">{client.porcIVA || 0}%</DetailField>
                                    <DetailField label="% Retención">{client.porcRetencion || 0}%</DetailField>
                                </div>
                                {(client.foto || client.fotoCC) && (
                                    <div style={{ display:'flex', gap:'1.5rem', marginTop:'2rem' }}>
                                        {client.foto && <div style={{flex:1}}><div style={{fontSize:'0.68rem',color:'#94a3b8',fontWeight:700,marginBottom:'0.5rem',textTransform:'uppercase'}}>Foto Cliente</div><img src={client.foto} alt="Cliente" style={{width:'100%',borderRadius:'10px',border:'1px solid #e2e8f0',aspectRatio:'4/3',objectFit:'cover'}}/></div>}
                                        {client.fotoCC && <div style={{flex:1}}><div style={{fontSize:'0.68rem',color:'#94a3b8',fontWeight:700,marginBottom:'0.5rem',textTransform:'uppercase'}}>Documento</div><img src={client.fotoCC} alt="CC" style={{width:'100%',borderRadius:'10px',border:'1px solid #e2e8f0',aspectRatio:'4/3',objectFit:'cover'}}/></div>}
                                    </div>
                                )}
                            </>)}

                            {/* Tab: Obras */}
                            {tab === 'obras' && (<>
                                <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'1.5rem' }}>
                                    <SectionLabel icon={<Building2 size={13}/>} color="#f97316">{client.obras?.length || 0} Proyectos</SectionLabel>
                                    <button onClick={() => setShowObraModal(true)} className="btn btn-primary btn-sm" style={{display:'flex',alignItems:'center',gap:'0.4rem'}}><Plus size={14}/> Nueva Obra</button>
                                </div>
                                <div style={{ display:'grid', gridTemplateColumns:'repeat(2,1fr)', gap:'1rem' }}>
                                    {(client.obras || []).map(obra => {
                                        if (!obra) return null;
                                        const cfg = OBRA_ESTADO[obra.estado] || OBRA_ESTADO['Activa'];
                                        return (
                                            <div key={obra.id} style={{ padding:'1.25rem 1.5rem', border:'1px solid #e2e8f0', borderRadius:'14px', background:'#fafafa', borderLeft:`4px solid ${cfg.color}` }}>
                                                <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:'0.65rem' }}>
                                                    <div style={{ fontWeight:700, color:'#0f172a', fontSize:'0.92rem' }}>{obra.nombre}</div>
                                                    <span style={{ padding:'3px 9px', borderRadius:'20px', background:`${cfg.color}18`, color:cfg.color, fontSize:'0.65rem', fontWeight:700, border:`1px solid ${cfg.color}30` }}>{obra.estado.toUpperCase()}</span>
                                                </div>
                                                <div style={{ fontSize:'0.78rem', color:'#94a3b8', display:'flex', alignItems:'center', gap:'0.35rem' }}><MapPin size={11}/>{obra.ubicacion || 'Sin ubicación'}</div>
                                                <div style={{ display:'flex', justifyContent:'space-between', marginTop:'0.75rem', paddingTop:'0.75rem', borderTop:'1px solid #f1f5f9' }}>
                                                    <span style={{ fontSize:'0.72rem', color:'#cbd5e1' }}>Presupuesto</span>
                                                    <span style={{ fontSize:'0.88rem', fontWeight:800, color:'#0f172a' }}>${(obra.presupuesto||0).toLocaleString()}</span>
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                                {(!client.obras || client.obras.length === 0) && (
                                    <div style={{ textAlign:'center', padding:'4rem', color:'#94a3b8', border:'1px dashed #e2e8f0', borderRadius:'14px' }}>No hay obras registradas.</div>
                                )}
                            </>)}

                            {/* Tab: Historial */}
                            {tab === 'historial' && (<>
                                <SectionLabel icon={<Receipt size={13}/>} color="#64748b">Historial de Facturación</SectionLabel>
                                {clientInvoices.length === 0 ? (
                                    <div style={{ textAlign:'center', padding:'4rem', color:'#94a3b8', border:'1px dashed #e2e8f0', borderRadius:'14px' }}>No hay facturas registradas.</div>
                                ) : (
                                    <div style={{ border:'1px solid #e2e8f0', borderRadius:'12px', overflow:'hidden', marginTop:'1rem' }}>
                                        <table style={{ width:'100%', borderCollapse:'collapse' }}>
                                            <thead>
                                                <tr style={{ background:'#f8fafc' }}>
                                                    {['Factura','Obra','Fecha','Monto','Estado'].map(h => (
                                                        <th key={h} style={{ padding:'0.75rem 1rem', textAlign:'left', fontSize:'0.68rem', fontWeight:700, color:'#94a3b8', textTransform:'uppercase', letterSpacing:'0.05em', borderBottom:'1px solid #e2e8f0' }}>{h}</th>
                                                    ))}
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {(clientInvoices || []).map((inv, idx) => (
                                                    <tr key={inv.id} style={{ borderBottom:'1px solid #f8fafc', background: idx%2===0 ? 'white' : '#fafafa' }}>
                                                        <td style={{ padding:'0.75rem 1rem', fontWeight:700, color:'#2365AB', fontSize:'0.83rem' }}>{inv.id}</td>
                                                        <td style={{ padding:'0.75rem 1rem', fontSize:'0.83rem', color:'#374151' }}>{(client.obras || []).find(o => o.id === inv.obraId)?.nombre || '—'}</td>
                                                        <td style={{ padding:'0.75rem 1rem', fontSize:'0.83rem', color:'#6b7280' }}>{inv.date}</td>
                                                        <td style={{ padding:'0.75rem 1rem', fontWeight:700, fontSize:'0.83rem' }}>${inv.amount.toLocaleString()}</td>
                                                        <td style={{ padding:'0.75rem 1rem' }}>
                                                            <span style={{ padding:'3px 10px', borderRadius:'20px', fontSize:'0.65rem', fontWeight:700, background: inv.status==='Paid' ? '#dcfce7' : '#fef9c3', color: inv.status==='Paid' ? '#166534' : '#854d0e' }}>
                                                                {inv.status === 'Paid' ? 'PAGADA' : 'PENDIENTE'}
                                                            </span>
                                                        </td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                )}
                            </>)}
                        </div>
                    </div>
                </div>
            </div>

            {showObraModal && <ObraModal onSave={obra => { onAddObra(client.id, obra); setShowObraModal(false); }} onClose={() => setShowObraModal(false)} />}

            <style>{`
                @keyframes cdFadeIn {
                    from { opacity:0; transform:scale(0.97); }
                    to   { opacity:1; transform:scale(1); }
                }
            `}</style>
        </>
    );
}

// ─── MODAL: Confirmar Eliminación con Pasword ─────────────────────────────────
function DeleteClientModal({ client, onClose, onConfirm }) {
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    
    return (
        <div className="modal-overlay" style={{ zIndex: 2000 }}>
            <div 
                className="modal-content fadeIn" 
                onClick={e => e.stopPropagation()}
                style={{ maxWidth: 420, padding: 0, overflow: 'hidden' }}
            >
                <div style={{ background: 'linear-gradient(135deg, #ef4444, #dc2626)', padding: '1.5rem 2rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                        <div style={{ background: 'rgba(255,255,255,0.2)', borderRadius: '50%', width: 44, height: 44, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                            <Trash2 size={22} color="white" />
                        </div>
                        <div>
                            <div style={{ fontWeight: 800, color: 'white', fontSize: '1.1rem' }}>Eliminar Cliente</div>
                            <div style={{ fontSize: '0.82rem', color: 'rgba(255,255,255,0.85)', marginTop: 2 }}>{client.name}</div>
                        </div>
                    </div>
                </div>
                <div style={{ padding: '1.5rem 2rem' }}>
                    <div style={{ display: 'flex', gap: '0.75rem', background: '#fef2f2', border: '1px solid #fecaca', borderRadius: '10px', padding: '0.85rem', marginBottom: '1.25rem' }}>
                        <ShieldAlert size={20} style={{ color: '#ef4444', flexShrink: 0 }} />
                        <p style={{ fontSize: '0.8rem', color: '#b91c1c', margin: 0, fontWeight: 500, lineHeight: 1.4 }}>
                            Esta acción eliminará todos los registros del cliente de forma permanente. Para continuar, ingrese su contraseña de administrador.
                        </p>
                    </div>
                    
                    <div className="input-group">
                        <label className="input-label" style={{ fontSize: '0.7rem' }}>CONFIRMAR CON CONTRASEÑA</label>
                        <input 
                            type="password" 
                            className="input-base" 
                            value={password} 
                            onChange={e => { setPassword(e.target.value); setError(''); }}
                            placeholder="Ingrese su contraseña..."
                            autoFocus
                            onKeyDown={e => e.key === 'Enter' && onConfirm(password, setError)}
                        />
                        {error && <p style={{ color: '#ef4444', fontSize: '0.72rem', marginTop: '0.4rem', fontWeight: 600 }}>{error}</p>}
                    </div>

                    <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '1.5rem' }}>
                        <button className="btn btn-secondary" onClick={onClose}>Cancelar</button>
                        <button
                            onClick={() => onConfirm(password, setError)}
                            style={{ background: '#ef4444', color: 'white', border: 'none', borderRadius: 8, padding: '0.6rem 1.75rem', fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6, boxShadow: '0 4px 12px rgba(239, 68, 68, 0.3)' }}>
                            <Trash2 size={16} /> Eliminar Permanente
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}

// ─── MAIN COMPONENT ───────────────────────────────────────────────────────────
export default function Clients() {
    const { clients, addClient, editClient, deleteClient, addObra, invoices, products, settings, checkPassword } = useAppContext();

    const [search, setSearch] = useState('');
    const [filterDeuda, setFilterDeuda] = useState('Todos');
    const [filterRegimen, setFilterRegimen] = useState('Todos');
    const [showModal, setShowModal] = useState(false);
    const [editingClient, setEditingClient] = useState(null);
    const [selectedClient, setSelectedClient] = useState(null);
    const [deletingClient, setDeletingClient] = useState(null);

    useEffect(() => {
        const h1 = () => setShowModal(true);
        window.addEventListener('trigger-new-client', h1);
        return () => window.removeEventListener('trigger-new-client', h1);
    }, []);
    const [sortConfig, setSortConfig] = useState({ key: 'name', direction: 'asc' });

    const handleSort = (key) => {
        let direction = 'asc';
        if (sortConfig.key === key && sortConfig.direction === 'asc') direction = 'desc';
        setSortConfig({ key, direction });
    };

    // Search + filter + Sort
    const sorted = useMemo(() => {
        const filtered = clients.filter(c => {
            const q = search.toLowerCase();
            const matchSearch = (c.name || '').toLowerCase().includes(q) || 
                               (c.nit || '').toLowerCase().includes(q) || 
                               (c.ciudad || '').toLowerCase().includes(q);
            const matchDeuda = filterDeuda === 'Todos' || (filterDeuda === 'Con Deuda' ? c.debt > 0 : c.debt === 0);
            const matchReg = filterRegimen === 'Todos' || c.regimen === filterRegimen;
            return matchSearch && matchDeuda && matchReg;
        });

        if (sortConfig.key) {
            filtered.sort((a, b) => {
                let aVal = a[sortConfig.key] || '';
                let bVal = b[sortConfig.key] || '';
                
                if (typeof aVal === 'string') aVal = aVal.toLowerCase();
                if (typeof bVal === 'string') bVal = bVal.toLowerCase();

                if (aVal < bVal) return sortConfig.direction === 'asc' ? -1 : 1;
                if (aVal > bVal) return sortConfig.direction === 'asc' ? 1 : -1;
                return 0;
            });
        }
        return filtered;
    }, [clients, search, filterDeuda, filterRegimen, sortConfig]);

    // Pagination
    const [currentPage, setCurrentPage] = useState(1);
    const [itemsPerPage, setItemsPerPage] = useState(10);

    const paginatedClients = useMemo(() => {
        const start = (currentPage - 1) * itemsPerPage;
        return sorted.slice(start, start + itemsPerPage);
    }, [sorted, currentPage, itemsPerPage]);

    const totalPages = Math.ceil(sorted.length / itemsPerPage);

    // KPIs
    const totalDeuda = clients.reduce((s, c) => s + c.debt, 0);
    const totalObras = clients.reduce((s, c) => s + (c.obras?.length || 0), 0);
    const conDeuda = clients.filter(c => c.debt > 0).length;
    const obrasActivas = clients.reduce((s, c) => s + (c.obras?.filter(o => o.estado === 'Activa').length || 0), 0);

    const handleSaveNew = (form) => {
        addClient(form);
        setShowModal(false);
    };

    const handleEdit = (client) => {
        setEditingClient(client);
        setSelectedClient(null);
    };

    const handleSaveEdit = (form) => {
        editClient(editingClient.id, form);
        setEditingClient(null);
    };

    const handleDelete = (password, setError) => {
        if (checkPassword(password)) {
            deleteClient(deletingClient.id);
            setDeletingClient(null);
            if (selectedClient?.id === deletingClient.id) setSelectedClient(null);
        } else {
            setError('La contraseña es incorrecta. Por favor verifique.');
        }
    };

    const inputStyle = {
        padding: '0.55rem 0.75rem', background: 'rgba(255,255,255,0.05)',
        border: '1px solid var(--surface-border)', borderRadius: 8,
        color: 'var(--text-primary)', fontSize: '0.875rem', outline: 'none',
    };

    return (
        <>
            <div style={{ display: 'flex', flexDirection: 'column', minHeight: 'calc(100vh - 120px)' }}>
                {/* Filters Section */}
                
                {/* Filters Section */}
                <div className="glass-panel p-4 mb-6">
                    <div style={{ position: 'relative', width: '100%' }}>
                        <Search size={20} style={{ position: 'absolute', left: '16px', top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }} />
                        <input 
                            type="text" 
                            placeholder="Buscar por nombre, NIT o ciudad..." 
                            className="input-base"
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            style={{ height: '48px', paddingLeft: '3.2rem', width: '100%', fontSize: '1rem' }}
                        />
                    </div>
                </div>

                {/* Table Container */}
                <div className="glass-panel p-0" style={{ overflow: 'hidden' }}>
                    <div style={{ overflowX: 'auto' }}>
                        <table className="glass-table" style={{ width: '100%' }}>
                            <thead>
                                <tr style={{ borderBottom: '1px solid var(--surface-border)' }}>
                                    {[
                                        { label: 'Cliente', key: 'name', w: '180px' },
                                        { label: 'IVA', key: 'porcIVA', w: '60px' },
                                        { label: 'Ret', key: 'porcRetencion', w: '60px' },
                                        { label: 'Obras', key: null, w: '90px' },
                                        { label: 'Cartera', key: 'debt', w: '100px' },
                                        { label: 'Acciones', key: null, w: '130px' }
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
                                {paginatedClients.map(client => {
                                    const obrasActivas = (client.obras || []).filter(o => o.estado === 'Activa').length;
                                    return (
                                        <tr key={client.id}
                                            className="table-row-hover"
                                            style={{ borderBottom: '1px solid var(--surface-border)', cursor: 'pointer', transition: 'background 0.15s' }}
                                            onClick={() => setSelectedClient(client)}
                                        >
                                            <td>
                                                <div style={{ fontWeight: 700, fontSize: '0.875rem', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{client.name}</div>
                                            </td>
                                            <td>
                                                <div style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-primary)' }}>{client.porcIVA || 0}%</div>
                                            </td>
                                            <td>
                                                <div style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-primary)' }}>{client.porcRetencion || 0}%</div>
                                            </td>
                                            <td>
                                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                                                    <Building2 size={14} color="#64748b" />
                                                    <span style={{ fontWeight: 600 }}>{(client.obras || []).length}</span>
                                                    {obrasActivas > 0 && <span style={{ fontSize: '0.7rem', color: '#10b981' }}>({obrasActivas} activas)</span>}
                                                </div>
                                            </td>
                                            <td>
                                                <span style={{ fontWeight: 700, color: client.debt > 0 ? '#ef4444' : '#10b981' }}>
                                                    {client.debt > 0 ? `$${client.debt.toLocaleString()}` : '✓ Al Día'}
                                                </span>
                                            </td>
                                            <td>
                                                <div style={{ display: 'flex', gap: '0.4rem' }} onClick={e => e.stopPropagation()}>
                                                    <button className="btn btn-secondary btn-sm" onClick={() => setSelectedClient(client)}
                                                        style={{ fontSize: '0.75rem', padding: '0.35rem 0.65rem', display: 'flex', alignItems: 'center', gap: 4 }}>
                                                        <FileText size={13} /> Ficha
                                                    </button>
                                                    <button className="btn btn-secondary btn-sm" onClick={() => exportClientPDF(client, invoices, products, settings)}
                                                        style={{ fontSize: '0.75rem', padding: '0.35rem 0.65rem', display: 'flex', alignItems: 'center', gap: 4 }}>
                                                        <Printer size={13} /> PDF
                                                    </button>
                                                    <button 
                                                        className="btn btn-secondary btn-sm" 
                                                        onClick={() => setDeletingClient(client)}
                                                        style={{ fontSize: '0.75rem', padding: '0.35rem 0.65rem', display: 'flex', alignItems: 'center', gap: 4, color: '#ef4444', borderColor: 'rgba(239,68,68,0.2)' }}
                                                    >
                                                        <Trash2 size={13} /> Borrar
                                                    </button>
                                                </div>
                                            </td>
                                        </tr>
                                    );
                                })}
                                {sorted.length === 0 && (
                                    <tr><td colSpan={6} style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-muted)' }}>No se encontraron clientes</td></tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>

                {/* Pagination Controls — Pushed to the absolute bottom */}
                <div className="glass-panel" style={{ 
                    marginTop: 'auto', 
                    padding: '0.85rem 1.5rem', 
                    display: 'flex', 
                    justifyContent: 'space-between', 
                    alignItems: 'center',
                    boxShadow: '0 -2px 10px rgba(0,0,0,0.02)'
                }}>
                    <div className="flex items-center gap-4 text-slate-500" style={{ fontSize: '0.85rem' }}>
                        <div className="flex items-center gap-2">
                            <span>Mostrar:</span>
                            <div className="relative">
                                <select 
                                    value={itemsPerPage} 
                                    onChange={e => { setItemsPerPage(Number(e.target.value)); setCurrentPage(1); }}
                                    className="input-base cursor-pointer"
                                    style={{ 
                                        appearance: 'none', 
                                        padding: '0.3rem 1.8rem 0.3rem 0.6rem', 
                                        fontSize: '0.8rem', 
                                        width: 'auto', 
                                        minWidth: '70px', 
                                        height: '32px' 
                                    }}
                                >
                                    {[5, 10, 20, 50, 100].map(n => <option key={n} value={n}>{n}</option>)}
                                </select>
                                <ChevronDown size={14} className="absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400" />
                            </div>
                            <span>por página</span>
                        </div>
                        
                        <div style={{ width: '1px', height: '16px', background: '#e2e8f0', margin: '0 0.5rem' }}></div>
                        
                        <div>
                            Mostrando {sorted.length > 0 ? (currentPage - 1) * itemsPerPage + 1 : 0} a {Math.min(currentPage * itemsPerPage, sorted.length)} de {sorted.length} registros
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
                                        style={{ 
                                            minWidth: '32px', 
                                            height: '32px', 
                                            padding: 0,
                                            boxShadow: currentPage === pageNum ? '0 4px 12px rgba(35, 101, 171, 0.3)' : 'none'
                                        }}
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
            {showModal && <ClientModal onSave={handleSaveNew} onClose={() => setShowModal(false)} />}
            {editingClient && <ClientModal initial={editingClient} isEdit onSave={handleSaveEdit} onClose={() => setEditingClient(null)} />}
            {deletingClient && <DeleteClientModal client={deletingClient} onClose={() => setDeletingClient(null)} onConfirm={handleDelete} />}

            {/* Ficha lateral */}
            {selectedClient && (
                <ClientDetail
                    client={clients.find(c => c.id === selectedClient.id) || selectedClient}
                    onClose={() => setSelectedClient(null)}
                    onEdit={handleEdit}
                    onAddObra={addObra}
                    invoices={invoices}
                    products={products}
                    onDelete={(id) => {
                        deleteClient(id);
                        setSelectedClient(null);
                    }}
                />
            )}
            {/* Slide-in animation and hover effects */}
            <style>{`
                @keyframes slideInRight {
                  from { transform: translateX(100%); opacity: 0; }
                  to   { transform: translateX(0);    opacity: 1; }
                }
                .table-row-hover:hover {
                    background-color: rgba(35, 101, 171, 0.05) !important;
                }
            `}</style>
        </>
    );
}
