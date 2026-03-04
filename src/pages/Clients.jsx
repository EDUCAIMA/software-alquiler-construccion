import React, { useState, useMemo } from 'react';
import {
    Plus, Search, Printer, FileText, X, Building2, MapPin,
    Phone, Mail, Edit3, ChevronDown, ChevronRight, CheckCircle,
    Clock, AlertTriangle, Receipt, Percent, User, Download
} from 'lucide-react';
import { useAppContext } from '../context/AppContext';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { format } from 'date-fns';

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
function exportClientPDF(client, invoices, products) {
    const doc = new jsPDF({ unit: 'pt', format: 'a4' });
    const W = doc.internal.pageSize.width;

    // Header band
    doc.setFillColor(24, 24, 27);
    doc.rect(0, 0, W, 70, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(18); doc.setFont('helvetica', 'bold');
    doc.text('CIELO – Ficha de Cliente', 40, 38);
    doc.setFontSize(9); doc.setFont('helvetica', 'normal');
    doc.setTextColor(148, 163, 184);
    doc.text(`Generado: ${format(new Date(), 'dd/MM/yyyy HH:mm')}`, 40, 52);
    doc.text(`ID: ${client.id}`, W - 80, 38);

    // Datos generales
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(13); doc.setFont('helvetica', 'bold');
    doc.text('1. Datos del Cliente', 40, 95);

    autoTable(doc, {
        startY: 108,
        body: [
            ['Razón Social', client.name, 'NIT / CC', client.nit || 'N/A'],
            ['Tipo Persona', client.tipoPersona || 'N/A', 'Régimen', client.regimen || 'N/A'],
            ['Resp. IVA', client.responsableIVA ? 'Sí' : 'No', '% IVA', `${client.porcIVA || 0}%`],
            ['% Retención Fuente', `${client.porcRetencion || 0}%`, 'Contacto', client.contactoPrincipal || 'N/A'],
            ['Correo', client.email || 'N/A', 'Teléfono', client.phone || 'N/A'],
            ['Dirección', client.direccion || 'N/A', 'Ciudad', `${client.ciudad || ''} – ${client.departamento || ''}`],
            ['Deuda Actual', `$${(client.debt || 0).toLocaleString()}`, 'Miembro desde', client.joined || 'N/A'],
        ],
        styles: { fillColor: [30, 30, 35], textColor: [240, 240, 240], fontSize: 9, cellPadding: 6 },
        alternateRowStyles: { fillColor: [40, 40, 45] },
        columnStyles: { 0: { fontStyle: 'bold', textColor: [148, 163, 184], cellWidth: 100 }, 2: { fontStyle: 'bold', textColor: [148, 163, 184], cellWidth: 100 } },
        margin: { left: 40, right: 40 },
    });

    // Obras
    const afterData = doc.lastAutoTable.finalY + 20;
    doc.setFontSize(13); doc.setFont('helvetica', 'bold');
    doc.setTextColor(255, 255, 255);
    doc.text('2. Obras / Centros de Costo', 40, afterData);

    autoTable(doc, {
        startY: afterData + 14,
        head: [['ID Obra', 'Nombre', 'Ubicación', 'Estado', 'Presupuesto', 'Inicio']],
        body: (client.obras || []).map(o => [
            o.id, o.nombre, o.ubicacion || 'N/A', o.estado,
            `$${(o.presupuesto || 0).toLocaleString()}`,
            o.fechaInicio || 'N/A',
        ]),
        styles: { fillColor: [30, 30, 35], textColor: [240, 240, 240], fontSize: 9 },
        headStyles: { fillColor: [59, 130, 246] },
        alternateRowStyles: { fillColor: [40, 40, 45] },
        margin: { left: 40, right: 40 },
    });

    // Facturas
    const afterObras = doc.lastAutoTable.finalY + 20;
    doc.setFontSize(13); doc.setFont('helvetica', 'bold');
    doc.text('3. Historial de Facturación', 40, afterObras);

    const clientInvoices = invoices.filter(inv => inv.clientId === client.id);
    autoTable(doc, {
        startY: afterObras + 14,
        head: [['Factura', 'Obra', 'Fecha', 'Equipos', 'Monto', 'Estado']],
        body: clientInvoices.length > 0
            ? clientInvoices.map(inv => {
                const obraName = (client.obras || []).find(o => o.id === inv.obraId)?.nombre || 'N/A';
                const items = inv.items.map(item => {
                    const prod = products.find(p => p.id === item.productId);
                    return prod ? `${item.quantity}x ${prod.name}` : item.productId;
                }).join(', ');
                return [inv.id, obraName, inv.date, items, `$${inv.amount.toLocaleString()}`, inv.status === 'Paid' ? 'Pagada' : 'Pendiente'];
            })
            : [['—', '—', '—', 'Sin facturas', '—', '—']],
        styles: { fillColor: [30, 30, 35], textColor: [240, 240, 240], fontSize: 8 },
        headStyles: { fillColor: [16, 185, 129] },
        alternateRowStyles: { fillColor: [40, 40, 45] },
        margin: { left: 40, right: 40 },
    });

    doc.save(`Ficha_${client.name.replace(/\s+/g, '_')}_${client.id}.pdf`);
}

// ─── MODAL: Nuevo / Editar Cliente ────────────────────────────────────────────
const EMPTY_CLIENT = {
    name: '', nit: '', tipoPersona: 'Jurídica', regimen: 'Común',
    responsableIVA: true, porcIVA: 19, porcRetencion: 2.5,
    email: '', phone: '', direccion: '', ciudad: '', departamento: '', contactoPrincipal: '',
    primeraObra: '', obraUbicacion: '', obraPresupuesto: '',
};

function ClientModal({ initial, onSave, onClose, isEdit }) {
    const [form, setForm] = useState(initial || EMPTY_CLIENT);
    const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

    return (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(15, 23, 42, 0.6)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '2rem 1rem 1rem 1rem' }}>
            <div style={{ background: '#ffffff', borderRadius: '16px', boxShadow: '0 20px 40px rgba(0,0,0,0.15)', width: '100%', maxWidth: 720, maxHeight: '85vh', display: 'flex', flexDirection: 'column', marginTop: '3vh' }}>
                <div style={{ padding: '1.25rem 2rem', borderBottom: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <h3 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '0.75rem', color: '#1e293b', fontSize: '1.2rem' }}>
                        <div style={{ background: 'rgba(59,130,246,0.1)', padding: '0.5rem', borderRadius: '10px', display: 'flex' }}>
                            <Building2 size={20} style={{ color: '#3b82f6' }} />
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
                                <User size={16} color="#3b82f6" />
                                <h4 style={{ margin: 0, fontSize: '0.9rem', color: '#3b82f6', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Datos Generales</h4>
                            </div>
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                                <div style={{ gridColumn: '1 / -1' }}>
                                    <InputField label="Razón Social / Nombre Completo *" value={form.name} onChange={e => set('name', e.target.value)} placeholder="Ej. Constructora Andina S.A.S" required />
                                </div>
                                <InputField label="NIT / Cédula" value={form.nit} onChange={e => set('nit', e.target.value)} placeholder="900.123.456-7" />
                                <InputField label="Contacto Principal" value={form.contactoPrincipal} onChange={e => set('contactoPrincipal', e.target.value)} placeholder="Nombre del responsable" />
                                <InputField label="Correo Electrónico" type="email" value={form.email} onChange={e => set('email', e.target.value)} placeholder="contacto@empresa.com" />
                                <InputField label="Teléfono" value={form.phone} onChange={e => set('phone', e.target.value)} placeholder="300 123 4567" />
                                <div style={{ gridColumn: '1 / -1', display: 'grid', gridTemplateColumns: '2fr 1fr 1fr', gap: '1rem' }}>
                                    <InputField label="Dirección" value={form.direccion} onChange={e => set('direccion', e.target.value)} placeholder="Cra 15 # 80-20" />
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
                            <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '12px', padding: '1.25rem', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                                <SelectField label="Tipo de Persona" value={form.tipoPersona} onChange={e => set('tipoPersona', e.target.value)}>
                                    <option value="Jurídica">Jurídica</option>
                                    <option value="Natural">Natural</option>
                                </SelectField>
                                <SelectField label="Régimen" value={form.regimen} onChange={e => set('regimen', e.target.value)}>
                                    <option value="Común">Régimen Común</option>
                                    <option value="Simplificado">Régimen Simplificado</option>
                                </SelectField>
                                <SelectField label="Responsable de IVA" value={form.responsableIVA ? 'si' : 'no'} onChange={e => set('responsableIVA', e.target.value === 'si')}>
                                    <option value="si">Sí, responsable de IVA (Factura c/ IVA)</option>
                                    <option value="no">No responsable de IVA</option>
                                </SelectField>
                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                                    <InputField label="% IVA" type="number" min="0" max="100" step="0.1" value={form.porcIVA} onChange={e => set('porcIVA', Number(e.target.value))} />
                                    <InputField label="% Ret. Fuente" type="number" min="0" max="100" step="0.1" value={form.porcRetencion} onChange={e => set('porcRetencion', Number(e.target.value))} />
                                </div>
                            </div>
                        </div>

                        {/* Sección: Primera Obra (solo en creación) */}
                        {!isEdit && (
                            <>
                                <div style={{ borderTop: '1px solid #e2e8f0' }} />
                                <div>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1rem' }}>
                                        <MapPin size={16} color="#f97316" />
                                        <h4 style={{ margin: 0, fontSize: '0.9rem', color: '#f97316', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Opcional: Registrar Primera Obra</h4>
                                    </div>
                                    <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '1rem' }}>
                                        <div style={{ gridColumn: '1 / -1' }}>
                                            <InputField label="Nombre de la Obra" value={form.primeraObra} onChange={e => set('primeraObra', e.target.value)} placeholder="Ej. Edificio Los Alamos" />
                                        </div>
                                        <InputField label="Ubicación" value={form.obraUbicacion} onChange={e => set('obraUbicacion', e.target.value)} placeholder="Calle 100 # 50-20, Bogotá" />
                                        <InputField label="Presupuesto Asignado ($)" type="number" min="0" value={form.obraPresupuesto} onChange={e => set('obraPresupuesto', e.target.value)} placeholder="0" />
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
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(15, 23, 42, 0.6)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1100, padding: '2rem 1rem 1rem 1rem' }}>
            <div style={{ background: '#ffffff', borderRadius: '16px', boxShadow: '0 20px 40px rgba(0,0,0,0.15)', width: '100%', maxWidth: 520, display: 'flex', flexDirection: 'column', marginTop: '3vh' }}>
                <div style={{ padding: '1.25rem 1.75rem', borderBottom: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <h3 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '0.75rem', color: '#1e293b', fontSize: '1.15rem' }}>
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

// Sub-helpers de layout para la ficha
const SectionCard = ({ title, icon, children }) => (
    <div style={{ background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '16px', overflow: 'hidden', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.05)' }}>
        <div style={{ background: '#f8fafc', padding: '0.85rem 1.25rem', borderBottom: '1px solid #e2e8f0', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <span style={{ color: '#3b82f6', background: '#eff6ff', padding: '0.35rem', borderRadius: '8px', display: 'flex' }}>{icon}</span>
            <span style={{ fontSize: '0.75rem', fontWeight: 700, color: '#1e293b', textTransform: 'uppercase', letterSpacing: '0.08em' }}>{title}</span>
        </div>
        <div style={{ padding: '1.25rem' }}>{children}</div>
    </div>
);
const Grid2 = ({ children }) => (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.6rem' }}>{children}</div>
);
const Field = ({ label, children, full }) => (
    <div style={full ? { gridColumn: '1 / -1', background: '#f8fafc', padding: '0.75rem 1rem', borderRadius: '12px', border: '1px solid #e2e8f0' } : { background: '#f8fafc', padding: '0.75rem 1rem', borderRadius: '12px', border: '1px solid #e2e8f0' }}>
        <div style={{ fontSize: '0.7rem', color: '#64748b', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.2rem' }}>{label}</div>
        <div style={{ fontSize: '0.9rem', fontWeight: 700, color: '#1e293b' }}>{children}</div>
    </div>
);

function ClientDetail({ client, onClose, onEdit, onAddObra, invoices, products }) {
    const [tab, setTab] = useState('datos');
    const [showObraModal, setShowObraModal] = useState(false);
    const clientInvoices = invoices.filter(inv => inv.clientId === client.id);
    const totalFacturado = clientInvoices.reduce((s, i) => s + i.amount, 0);
    const totalPagado = clientInvoices.filter(i => i.status === 'Paid').reduce((s, i) => s + i.amount, 0);

    const tabStyle = (t) => ({
        padding: '0.45rem 1rem', fontSize: '0.78rem', fontWeight: 700,
        background: tab === t ? '#ffffff' : 'rgba(255,255,255,0.15)',
        color: tab === t ? '#1e293b' : 'rgba(255,255,255,0.85)',
        border: 'none', borderRadius: 8, cursor: 'pointer',
        transition: 'all 0.18s', letterSpacing: '0.02em',
    });

    return (
        <>
            <div style={{ position: 'fixed', inset: 0, background: 'rgba(15, 23, 42, 0.6)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '2rem 1rem' }}>
                <div style={{
                    background: '#ffffff', display: 'flex', flexDirection: 'column',
                    boxShadow: '0 20px 40px rgba(0,0,0,0.15)', borderRadius: '16px', overflow: 'hidden',
                    width: '100%', maxWidth: 860, maxHeight: '90vh'
                }}>

                    {/* ── HEADER (estilo factura PDF) ── */}
                    <div style={{ background: 'linear-gradient(135deg, #3b82f6, #2563eb)', padding: '1.5rem 1.75rem', flexShrink: 0 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                            <div>
                                <div style={{ fontSize: '1.3rem', fontWeight: 800, color: 'white', letterSpacing: '0.05em' }}>CIELO</div>
                                <div style={{ fontSize: '0.8rem', color: 'rgba(255,255,255,0.75)', marginTop: 2 }}>Ficha de Cliente — Alquiler de Equipos</div>
                            </div>
                            <div style={{ textAlign: 'right' }}>
                                <div style={{ fontSize: '1rem', fontWeight: 700, color: 'white', fontFamily: 'monospace' }}>{client.id}</div>
                                <div style={{ fontSize: '0.78rem', color: 'rgba(255,255,255,0.75)', marginTop: 2 }}>Desde: {client.joined}</div>
                                <span style={{
                                    display: 'inline-block', marginTop: 6, padding: '2px 12px', borderRadius: 999,
                                    fontSize: '0.7rem', fontWeight: 700,
                                    background: client.debt > 0 ? 'rgba(239,68,68,0.3)' : 'rgba(16,185,129,0.3)',
                                    color: 'white', border: '1px solid rgba(255,255,255,0.35)',
                                }}>
                                    {client.debt > 0 ? `DEUDA $${client.debt.toLocaleString()}` : '✓ AL DÍA'}
                                </span>
                            </div>
                        </div>

                        {/* Client name block */}
                        <div style={{ marginTop: '1rem', background: 'rgba(255,255,255,0.12)', borderRadius: 10, padding: '0.85rem 1rem' }}>
                            <div style={{ fontSize: '1.05rem', fontWeight: 800, color: 'white' }}>{client.name}</div>
                            <div style={{ fontSize: '0.8rem', color: 'rgba(255,255,255,0.8)', marginTop: 3 }}>
                                NIT: {client.nit || 'N/A'} &nbsp;·&nbsp; {client.tipoPersona} &nbsp;·&nbsp; Régimen {client.regimen}
                            </div>
                            <div style={{ marginTop: 8, display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                                <span style={{ padding: '2px 10px', borderRadius: 999, background: client.responsableIVA ? 'rgba(16,185,129,0.35)' : 'rgba(239,68,68,0.35)', color: 'white', fontSize: '0.7rem', fontWeight: 700, border: '1px solid rgba(255,255,255,0.25)' }}>
                                    {client.responsableIVA ? 'Resp. IVA' : 'No Resp. IVA'}
                                </span>
                                <span style={{ padding: '2px 10px', borderRadius: 999, background: 'rgba(255,255,255,0.15)', color: 'white', fontSize: '0.7rem', fontWeight: 700, border: '1px solid rgba(255,255,255,0.25)' }}>
                                    IVA {client.porcIVA || 0}%
                                </span>
                                <span style={{ padding: '2px 10px', borderRadius: 999, background: 'rgba(255,255,255,0.15)', color: 'white', fontSize: '0.7rem', fontWeight: 700, border: '1px solid rgba(255,255,255,0.25)' }}>
                                    Ret. {client.porcRetencion || 0}%
                                </span>
                            </div>
                        </div>

                        {/* Tab bar */}
                        <div style={{ marginTop: '1rem', display: 'flex', gap: '0.35rem', alignItems: 'center' }}>
                            {[['datos', 'Datos'], ['obras', 'Obras'], ['historial', 'Historial']].map(([k, label]) => (
                                <button key={k} style={tabStyle(k)} onClick={() => setTab(k)}>{label}</button>
                            ))}
                            <div style={{ marginLeft: 'auto', display: 'flex', gap: '0.4rem' }}>
                                <button onClick={() => onEdit(client)} style={{ padding: '0.4rem 0.75rem', fontSize: '0.75rem', display: 'flex', alignItems: 'center', gap: 4, background: 'rgba(255,255,255,0.15)', border: '1px solid rgba(255,255,255,0.3)', borderRadius: 6, color: 'white', cursor: 'pointer', fontWeight: 600 }}>
                                    <Edit3 size={13} /> Editar
                                </button>
                                <button onClick={() => exportClientPDF(client, invoices, products)} style={{ padding: '0.4rem 0.75rem', fontSize: '0.75rem', display: 'flex', alignItems: 'center', gap: 4, background: 'rgba(255,255,255,0.15)', border: '1px solid rgba(255,255,255,0.3)', borderRadius: 6, color: 'white', cursor: 'pointer', fontWeight: 600 }}>
                                    <Download size={13} /> PDF
                                </button>
                                <button onClick={onClose} style={{ padding: '0.4rem', background: 'rgba(255,255,255,0.15)', border: '1px solid rgba(255,255,255,0.3)', borderRadius: 6, color: 'white', cursor: 'pointer', display: 'flex', alignItems: 'center' }}>
                                    <X size={16} />
                                </button>
                            </div>
                        </div>
                    </div>

                    {/* ── BODY (fondo claro como PDF impreso) ── */}
                    <div style={{ flex: 1, padding: '1.5rem 1.75rem', background: '#f8fafc', display: 'flex', flexDirection: 'column', gap: '1rem', overflowY: 'auto' }}>

                        {/* ══ Tab: Datos ══ */}
                        {tab === 'datos' && (<>
                            <SectionCard title="DATOS DEL CLIENTE" icon={<User size={13} />}>
                                <Grid2>
                                    <Field label="Razón Social">{client.name}</Field>
                                    <Field label="NIT / CC">{client.nit || 'N/A'}</Field>
                                    <Field label="Tipo de Persona">{client.tipoPersona || 'N/A'}</Field>
                                    <Field label="Régimen">{client.regimen || 'N/A'}</Field>
                                    <Field label="Responsable IVA">{client.responsableIVA ? 'Sí' : 'No'}</Field>
                                    <Field label="Contacto">{client.contactoPrincipal || 'N/A'}</Field>
                                    <Field label="Correo">{client.email || 'N/A'}</Field>
                                    <Field label="Teléfono">{client.phone || 'N/A'}</Field>
                                    <Field label="Dirección" full>{client.direccion ? `${client.direccion}, ${client.ciudad} – ${client.departamento}` : 'N/A'}</Field>
                                </Grid2>
                            </SectionCard>

                            {/* Bloque azul de tributaria — idéntico al "TOTAL" de la factura */}
                            <div style={{ background: 'linear-gradient(135deg, #3b82f6, #2563eb)', borderRadius: '16px', padding: '1.25rem 1.75rem', boxShadow: '0 10px 15px -3px rgba(59,130,246,0.3)' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1.25rem' }}>
                                    <Percent size={18} color="rgba(255,255,255,0.9)" />
                                    <div style={{ fontSize: '0.75rem', color: 'rgba(255,255,255,0.9)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                                        Parametrización Tributaria
                                    </div>
                                </div>
                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '1rem' }}>
                                    {[
                                        ['IVA Aplicado', `${client.porcIVA || 0}%`],
                                        ['Retención Fuente', `${client.porcRetencion || 0}%`],
                                        ['Régimen', client.regimen || 'N/A'],
                                    ].map(([k, v]) => (
                                        <div key={k} style={{ background: 'rgba(255,255,255,0.15)', borderRadius: '12px', padding: '0.8rem 1rem', border: '1px solid rgba(255,255,255,0.2)' }}>
                                            <div style={{ fontSize: '0.7rem', color: 'rgba(255,255,255,0.8)', fontWeight: 600, textTransform: 'uppercase' }}>{k}</div>
                                            <div style={{ fontSize: '1.2rem', fontWeight: 800, color: 'white', marginTop: '0.2rem' }}>{v}</div>
                                        </div>
                                    ))}
                                </div>
                            </div>

                            {/* Separador punteado (como firma del PDF) */}
                            <div style={{ borderTop: '2px dashed #e2e8f0', margin: '0.5rem 0' }} />

                            {/* Resumen cartera */}
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '1rem' }}>
                                {[
                                    ['Total Facturado', `$${totalFacturado.toLocaleString()}`, '#1e293b'],
                                    ['Total Pagado', `$${totalPagado.toLocaleString()}`, '#10b981'],
                                    ['Deuda Activa', `$${client.debt.toLocaleString()}`, client.debt > 0 ? '#ef4444' : '#10b981'],
                                ].map(([k, v, c]) => (
                                    <div key={k} style={{ background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '16px', padding: '1.25rem', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.05)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textAlign: 'center' }}>
                                        <div style={{ fontSize: '0.7rem', color: '#64748b', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.5rem' }}>{k}</div>
                                        <div style={{ fontSize: '1.25rem', fontWeight: 800, color: c }}>{v}</div>
                                    </div>
                                ))}
                            </div>
                        </>)}

                        {/* ══ Tab: Obras ══ */}
                        {tab === 'obras' && (<>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                <div style={{ fontSize: '0.7rem', color: '#64748b', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                                    {client.obras?.length || 0} centros de costo
                                </div>
                                <button onClick={() => setShowObraModal(true)} className="btn btn-primary" style={{ fontSize: '0.78rem', padding: '0.4rem 0.8rem', display: 'flex', alignItems: 'center', gap: 4 }}>
                                    <Plus size={14} /> Nueva Obra
                                </button>
                            </div>

                            {(client.obras || []).map(obra => {
                                const cfg = OBRA_ESTADO[obra.estado] || OBRA_ESTADO['Activa'];
                                const obraInvs = clientInvoices.filter(inv => inv.obraId === obra.id);
                                const facturado = obraInvs.reduce((s, i) => s + i.amount, 0);
                                const pct = obra.presupuesto > 0 ? Math.min(100, Math.round(facturado / obra.presupuesto * 100)) : 0;
                                return (
                                    <div key={obra.id} style={{ background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '16px', overflow: 'hidden', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.05)' }}>
                                        <div style={{ background: '#f8fafc', padding: '1rem 1.25rem', borderBottom: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                            <div>
                                                <div style={{ fontWeight: 800, fontSize: '1.05rem', color: '#1e293b' }}>{obra.nombre}</div>
                                                <div style={{ fontSize: '0.75rem', color: '#64748b', display: 'flex', alignItems: 'center', gap: '0.4rem', marginTop: '0.3rem' }}>
                                                    <div style={{ background: '#e2e8f0', padding: '0.2rem', borderRadius: '4px', display: 'flex' }}><MapPin size={12} /></div>
                                                    {obra.ubicacion || 'Sin ubicación'}
                                                </div>
                                            </div>
                                            <span style={{ padding: '0.3rem 0.8rem', borderRadius: '20px', background: cfg.bg, color: cfg.color, fontSize: '0.75rem', fontWeight: 700, border: `1px solid ${cfg.color}40`, display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                                                <cfg.Icon size={14} /> {obra.estado}
                                            </span>
                                        </div>
                                        <div style={{ padding: '1.25rem' }}>
                                            <Grid2>
                                                <Field label="Presupuesto">${(obra.presupuesto || 0).toLocaleString()}</Field>
                                                <Field label="Facturado">${facturado.toLocaleString()}</Field>
                                                <Field label="Inicio">{obra.fechaInicio || 'N/A'}</Field>
                                                <Field label="Facturas">{obraInvs.length} orden(es)</Field>
                                            </Grid2>
                                            <div style={{ marginTop: '1.25rem', background: '#f8fafc', padding: '1rem', borderRadius: '12px', border: '1px solid #e2e8f0' }}>
                                                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', color: '#64748b', marginBottom: '0.5rem', fontWeight: 600 }}>
                                                    <span style={{ textTransform: 'uppercase', letterSpacing: '0.05em' }}>Ejecución presupuestal</span><span style={{ color: '#1e293b', fontWeight: 800 }}>{pct}%</span>
                                                </div>
                                                <div style={{ height: 8, background: '#e2e8f0', borderRadius: 999, overflow: 'hidden' }}>
                                                    <div style={{ height: '100%', width: `${pct}%`, background: pct >= 90 ? '#ef4444' : pct >= 60 ? '#f97316' : '#3b82f6', borderRadius: 999, transition: 'width 0.4s ease' }} />
                                                </div>
                                            </div>
                                            {obra.descripcion && <p style={{ fontSize: '0.8rem', color: '#64748b', marginTop: '1rem', fontStyle: 'italic', background: 'rgba(241,245,249,0.5)', padding: '0.75rem', borderRadius: '8px', borderLeft: '3px solid #cbd5e1' }}>{obra.descripcion}</p>}
                                        </div>
                                    </div>
                                );
                            })}

                            {(!client.obras || client.obras.length === 0) && (
                                <div style={{ textAlign: 'center', padding: '2.5rem', color: '#94a3b8', background: 'white', borderRadius: 10, border: '1px dashed #cbd5e1' }}>
                                    <Building2 size={36} style={{ opacity: 0.3, marginBottom: '0.5rem' }} />
                                    <p style={{ fontSize: '0.85rem' }}>Sin obras registradas</p>
                                </div>
                            )}
                        </>)}

                        {/* ══ Tab: Historial ══ */}
                        {tab === 'historial' && (<>
                            {clientInvoices.length === 0 ? (
                                <div style={{ textAlign: 'center', padding: '2.5rem', color: '#94a3b8', background: 'white', borderRadius: 10, border: '1px dashed #cbd5e1' }}>
                                    <Receipt size={36} style={{ opacity: 0.3, marginBottom: '0.5rem' }} />
                                    <p style={{ fontSize: '0.85rem' }}>Sin facturas registradas</p>
                                </div>
                            ) : (<>
                                {/* Tabla con header azul – igual al PDF */}
                                <div style={{ background: 'white', border: '1px solid #e2e8f0', borderRadius: 10, overflow: 'hidden', boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}>
                                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.84rem' }}>
                                        <thead>
                                            <tr style={{ background: '#3b82f6' }}>
                                                {['Factura', 'Obra', 'Fecha', 'Monto', 'Estado'].map(h => (
                                                    <th key={h} style={{ padding: '0.65rem 0.75rem', textAlign: 'left', color: 'white', fontWeight: 700, fontSize: '0.68rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{h}</th>
                                                ))}
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {clientInvoices.map((inv, idx) => {
                                                const obra = client.obras?.find(o => o.id === inv.obraId);
                                                return (
                                                    <tr key={inv.id} style={{ background: idx % 2 === 0 ? '#f8fafc' : 'white', borderBottom: '1px solid #e2e8f0' }}>
                                                        <td style={{ padding: '0.6rem 0.75rem', fontWeight: 700, color: '#3b82f6', fontFamily: 'monospace', fontSize: '0.78rem' }}>{inv.id}</td>
                                                        <td style={{ padding: '0.6rem 0.75rem', color: '#475569', fontSize: '0.78rem' }}>{obra?.nombre || '—'}</td>
                                                        <td style={{ padding: '0.6rem 0.75rem', color: '#64748b', fontSize: '0.78rem' }}>{inv.date}</td>
                                                        <td style={{ padding: '0.6rem 0.75rem', fontWeight: 700, color: '#1e293b' }}>${inv.amount.toLocaleString()}</td>
                                                        <td style={{ padding: '0.6rem 0.75rem' }}>
                                                            <span style={{ padding: '2px 8px', borderRadius: 999, fontWeight: 700, fontSize: '0.7rem', background: inv.status === 'Paid' ? '#dcfce7' : '#fef9c3', color: inv.status === 'Paid' ? '#166534' : '#854d0e' }}>
                                                                {inv.status === 'Paid' ? 'Pagada' : 'Pendiente'}
                                                            </span>
                                                        </td>
                                                    </tr>
                                                );
                                            })}
                                        </tbody>
                                    </table>
                                </div>

                                {/* Separador punteado */}
                                <div style={{ borderTop: '1px dashed #cbd5e1' }} />

                                {/* Bloque TOTAL – mismo estilo que la factura PDF */}
                                <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '1rem' }}>
                                    <div style={{ background: 'linear-gradient(135deg, #10b981, #059669)', borderRadius: '16px', padding: '1.25rem 2rem', display: 'flex', gap: '2rem', alignItems: 'center', boxShadow: '0 10px 15px -3px rgba(16,185,129,0.3)' }}>
                                        <span style={{ color: 'rgba(255,255,255,0.9)', fontWeight: 700, fontSize: '0.85rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Total Facturado</span>
                                        <span style={{ color: 'white', fontWeight: 900, fontSize: '1.75rem', letterSpacing: '-0.02em' }}>${totalFacturado.toLocaleString()}</span>
                                    </div>
                                </div>

                                {/* Sección de firma (como el PDF) */}
                                <div style={{ border: '2px dashed #e2e8f0', borderRadius: '16px', padding: '2rem', background: '#ffffff', marginTop: '1.5rem' }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1.5rem' }}>
                                        <div style={{ background: '#f1f5f9', padding: '0.4rem', borderRadius: '8px' }}><Edit3 size={16} style={{ color: '#64748b' }} /></div>
                                        <div style={{ fontSize: '0.8rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: '#64748b' }}>
                                            Registro de Cuenta Corriente
                                        </div>
                                    </div>
                                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '4rem' }}>
                                        <div>
                                            <div style={{ borderBottom: '2px solid #e2e8f0', marginBottom: '0.75rem', height: 40 }} />
                                            <div style={{ fontSize: '0.8rem', color: '#64748b', fontWeight: 600 }}>Firma Responsable CIELO</div>
                                        </div>
                                        <div>
                                            <div style={{ borderBottom: '2px solid #e2e8f0', marginBottom: '0.75rem', height: 40 }} />
                                            <div style={{ fontSize: '0.8rem', color: '#1e293b', fontWeight: 700 }}>Repr. Legal: {client.contactoPrincipal || '__________'}</div>
                                            <div style={{ fontSize: '0.8rem', color: '#64748b', marginTop: '0.3rem' }}>NIT: {client.nit || '__________'}</div>
                                        </div>
                                    </div>
                                </div>
                            </>)}
                        </>)}

                        {/* Footer estilo PDF */}
                        <div style={{ borderTop: '1px solid #e2e8f0', paddingTop: '0.75rem', textAlign: 'center', fontSize: '0.7rem', color: '#94a3b8' }}>
                            CIELO &nbsp;|&nbsp; {client.id} &nbsp;|&nbsp; Generado el {new Date().toLocaleDateString('es-CO')}
                        </div>
                    </div> {/* Cierra Body */}
                </div> {/* Cierra Modal content */}

                {/* Overlay click-to-close dentro del overlay fijo principal */}
                <div style={{ position: 'absolute', inset: 0, zIndex: -1 }} onClick={onClose} />
            </div> {/* Cierra Modal backdrop (Background blur) */}

            {showObraModal && <ObraModal onSave={obra => { onAddObra(client.id, obra); setShowObraModal(false); }} onClose={() => setShowObraModal(false)} />}
        </>
    );
}

// ─── MAIN COMPONENT ───────────────────────────────────────────────────────────
export default function Clients() {
    const { clients, addClient, editClient, addObra, invoices, products } = useAppContext();

    const [search, setSearch] = useState('');
    const [filterDeuda, setFilterDeuda] = useState('Todos');
    const [filterRegimen, setFilterRegimen] = useState('Todos');
    const [showModal, setShowModal] = useState(false);
    const [editingClient, setEditingClient] = useState(null);
    const [selectedClient, setSelectedClient] = useState(null);

    // Search + filter
    const filtered = useMemo(() => clients.filter(c => {
        const q = search.toLowerCase();
        const matchSearch = c.name.toLowerCase().includes(q) || (c.nit || '').toLowerCase().includes(q);
        const matchDeuda = filterDeuda === 'Todos' || (filterDeuda === 'Con Deuda' ? c.debt > 0 : c.debt === 0);
        const matchReg = filterRegimen === 'Todos' || c.regimen === filterRegimen;
        return matchSearch && matchDeuda && matchReg;
    }), [clients, search, filterDeuda, filterRegimen]);

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

    const inputStyle = {
        padding: '0.55rem 0.75rem', background: 'rgba(255,255,255,0.05)',
        border: '1px solid var(--surface-border)', borderRadius: 8,
        color: 'var(--text-primary)', fontSize: '0.875rem', outline: 'none',
    };

    return (
        <>
            {/* Header */}
            <div className="flex justify-between items-center mb-6">
                <div>
                    <h1>Clientes</h1>
                    <p className="text-muted">Gestión CRM de clientes, obras y parametrización tributaria</p>
                </div>
                <button className="btn btn-primary" onClick={() => setShowModal(true)} style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                    <Plus size={18} /> Nuevo Cliente
                </button>
            </div>

            {/* KPI Row */}
            <div className="grid-cards" style={{ gridTemplateColumns: 'repeat(4, 1fr)', marginBottom: '1.5rem' }}>
                <div className="stat-card blue">
                    <div className="icon-wrapper blue"><User size={22} /></div>
                    <div><div className="stat-value">{clients.length}</div><div className="stat-label">Total Clientes</div></div>
                </div>
                <div className="stat-card orange">
                    <div className="icon-wrapper orange"><Building2 size={22} /></div>
                    <div><div className="stat-value">{totalObras}</div><div className="stat-label">Obras Registradas</div></div>
                </div>
                <div className="stat-card green">
                    <div className="icon-wrapper green"><CheckCircle size={22} /></div>
                    <div><div className="stat-value">{obrasActivas}</div><div className="stat-label">Obras Activas</div></div>
                </div>
                <div className="stat-card red">
                    <div className="icon-wrapper red"><Receipt size={22} /></div>
                    <div><div className="stat-value">${totalDeuda.toLocaleString()}</div><div className="stat-label">Cartera Total</div></div>
                </div>
            </div>

            {/* Filters */}
            <div className="glass-panel p-6 mb-6" style={{ display: 'flex', gap: '0.75rem', alignItems: 'center', flexWrap: 'wrap' }}>
                <div style={{ position: 'relative', flex: 1, minWidth: 200 }}>
                    <Search size={16} style={{ position: 'absolute', left: 11, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                    <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Buscar por nombre o NIT…"
                        style={{ ...inputStyle, width: '100%', paddingLeft: '2.2rem', boxSizing: 'border-box' }} />
                </div>
                <select value={filterDeuda} onChange={e => setFilterDeuda(e.target.value)} style={{ ...inputStyle, minWidth: 140 }}>
                    <option>Todos</option><option value="Con Deuda">Con Deuda</option><option value="Al Día">Al Día</option>
                </select>
                <select value={filterRegimen} onChange={e => setFilterRegimen(e.target.value)} style={{ ...inputStyle, minWidth: 140 }}>
                    <option>Todos</option><option value="Común">Régimen Común</option><option value="Simplificado">Simplificado</option>
                </select>
                <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>{filtered.length} cliente{filtered.length !== 1 ? 's' : ''}</span>
            </div>

            {/* Table */}
            <div className="glass-panel p-6">
                <div style={{ overflowX: 'auto' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                        <thead>
                            <tr style={{ borderBottom: '1px solid var(--surface-border)' }}>
                                {['Cliente', 'NIT', 'Tipo / Régimen', 'IVA%  Ret%', 'Obras', 'Cartera', 'Acciones'].map(h => (
                                    <th key={h} style={{ padding: '0.75rem 1rem', textAlign: 'left', fontSize: '0.72rem', color: 'var(--text-muted)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', whiteSpace: 'nowrap' }}>{h}</th>
                                ))}
                            </tr>
                        </thead>
                        <tbody>
                            {filtered.map(client => {
                                const obrasActivas = (client.obras || []).filter(o => o.estado === 'Activa').length;
                                return (
                                    <tr key={client.id}
                                        style={{ borderBottom: '1px solid var(--surface-border)', cursor: 'pointer', transition: 'background 0.15s' }}
                                        onClick={() => setSelectedClient(client)}
                                        onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.03)'}
                                        onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                                    >
                                        <td style={{ padding: '0.85rem 1rem' }}>
                                            <div style={{ fontWeight: 700, fontSize: '0.875rem' }}>{client.name}</div>
                                            <div style={{ fontSize: '0.73rem', color: 'var(--text-muted)' }}>{client.contactoPrincipal || client.email}</div>
                                        </td>
                                        <td style={{ padding: '0.85rem 1rem', fontFamily: 'monospace', fontSize: '0.8rem', color: 'var(--text-muted)' }}>{client.nit || '—'}</td>
                                        <td style={{ padding: '0.85rem 1rem' }}>
                                            <div style={{ fontSize: '0.8rem' }}>{client.tipoPersona}</div>
                                            <div style={{ fontSize: '0.73rem', color: 'var(--text-muted)' }}>{client.regimen}</div>
                                        </td>
                                        <td style={{ padding: '0.85rem 1rem' }}>
                                            <div style={{ display: 'flex', gap: '0.4rem' }}>
                                                <span style={{ padding: '0.15rem 0.5rem', borderRadius: 20, background: 'rgba(16,185,129,0.12)', color: '#10b981', fontSize: '0.72rem', fontWeight: 700 }}>
                                                    IVA {client.porcIVA || 0}%
                                                </span>
                                                <span style={{ padding: '0.15rem 0.5rem', borderRadius: 20, background: 'rgba(249,115,22,0.12)', color: '#f97316', fontSize: '0.72rem', fontWeight: 700 }}>
                                                    Ret {client.porcRetencion || 0}%
                                                </span>
                                            </div>
                                        </td>
                                        <td style={{ padding: '0.85rem 1rem' }}>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                                                <Building2 size={14} color="#64748b" />
                                                <span style={{ fontWeight: 600 }}>{(client.obras || []).length}</span>
                                                {obrasActivas > 0 && <span style={{ fontSize: '0.7rem', color: '#10b981' }}>({obrasActivas} activas)</span>}
                                            </div>
                                        </td>
                                        <td style={{ padding: '0.85rem 1rem' }}>
                                            <span style={{ fontWeight: 700, color: client.debt > 0 ? '#ef4444' : '#10b981' }}>
                                                {client.debt > 0 ? `$${client.debt.toLocaleString()}` : '✓ Al Día'}
                                            </span>
                                        </td>
                                        <td style={{ padding: '0.85rem 1rem' }}>
                                            <div style={{ display: 'flex', gap: '0.4rem' }} onClick={e => e.stopPropagation()}>
                                                <button className="btn btn-secondary btn-sm" onClick={() => setSelectedClient(client)}
                                                    style={{ fontSize: '0.75rem', padding: '0.35rem 0.65rem', display: 'flex', alignItems: 'center', gap: 4 }}>
                                                    <FileText size={13} /> Ficha
                                                </button>
                                                <button className="btn btn-secondary btn-sm" onClick={() => exportClientPDF(client, invoices, products)}
                                                    style={{ fontSize: '0.75rem', padding: '0.35rem 0.65rem', display: 'flex', alignItems: 'center', gap: 4 }}>
                                                    <Printer size={13} /> PDF
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                );
                            })}
                            {filtered.length === 0 && (
                                <tr><td colSpan={7} style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-muted)' }}>No se encontraron clientes</td></tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Modals */}
            {showModal && <ClientModal onSave={handleSaveNew} onClose={() => setShowModal(false)} />}
            {editingClient && <ClientModal initial={editingClient} isEdit onSave={handleSaveEdit} onClose={() => setEditingClient(null)} />}

            {/* Ficha lateral */}
            {selectedClient && (
                <ClientDetail
                    client={clients.find(c => c.id === selectedClient.id) || selectedClient}
                    onClose={() => setSelectedClient(null)}
                    onEdit={handleEdit}
                    onAddObra={addObra}
                    invoices={invoices}
                    products={products}
                />
            )}

            {/* Slide-in animation */}
            <style>{`
        @keyframes slideInRight {
          from { transform: translateX(100%); opacity: 0; }
          to   { transform: translateX(0);    opacity: 1; }
        }
      `}</style>
        </>
    );
}
