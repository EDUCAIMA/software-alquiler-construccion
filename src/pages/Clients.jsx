import React, { useState, useMemo, useEffect, useRef } from 'react';
import {
    ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight, ChevronDown, ChevronUp, Search, Plus, 
    Printer, Trash2, Edit3, X, Mail, Phone, MapPin, Download, User, Building2, Receipt, Percent, FileText, Truck, Eye, CheckCircle, Clock, AlertTriangle, ShieldAlert, Package, PackageOpen, UploadCloud
} from 'lucide-react';
import { useAppContext } from '../context/AppContext';
import { exportClientPDF, generateRemisionPDF } from './CotizacionesHelpers';
import { NuevaRemisionModal, ESTADO_CFG } from './RemisionComponents';
import EditRemisionModal from './EditRemisionModal';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { format } from 'date-fns';
import { applyStandardLayout } from './pdfTheme';
import { WebcamCapture } from './CotizacionesHelpers';
import Swal from 'sweetalert2';

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

function ObraModal({ onSave, onClose, initialData }) {
    const [form, setForm] = useState(initialData || EMPTY_OBRA);
    const set = (k, v) => setForm(f => ({ ...f, [k]: v }));
    const isEdit = !!initialData;
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
                        {isEdit ? 'Editar Obra' : 'Nueva Obra'}
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
                    <button type="submit" form="obra-form" className="btn btn-primary" style={{ background: '#f97316', boxShadow: '0 4px 14px rgba(249,115,22,0.3)' }} onMouseEnter={e => e.currentTarget.style.background = '#ea580c'} onMouseLeave={e => e.currentTarget.style.background = '#f97316'}>{isEdit ? 'Guardar Cambios' : 'Guardar Obra'}</button>
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

const EMPTY_PROVIDER = {
    name: '', nit: '', email: '', phone: '', direccion: '', ciudad: '', contactoPrincipal: ''
};

function ProviderModal({ initial, onSave, onClose, isEdit }) {
    const [form, setForm] = useState(initial || EMPTY_PROVIDER);
    const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

    return (
        <div 
            onClick={onClose}
            style={{ position: 'fixed', inset: 0, background: 'rgba(255, 255, 255, 0.3)', backdropFilter: 'blur(10px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '2rem 1rem' }}
        >
            <div 
                onClick={e => e.stopPropagation()}
                style={{ background: '#ffffff', borderRadius: '24px', boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.1)', width: '100%', maxWidth: 700, maxHeight: '85vh', display: 'flex', flexDirection: 'column', border: '1px solid #e2e8f0' }}
            >
                <div style={{ padding: '1.25rem 2rem', borderBottom: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <h3 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '0.75rem', color: '#104166', fontSize: '1.2rem' }}>
                        <div style={{ background: 'rgba(35, 101, 171,0.1)', padding: '0.5rem', borderRadius: '10px', display: 'flex' }}>
                            <User size={20} style={{ color: '#2365AB' }} />
                        </div>
                        {isEdit ? 'Editar Información del Proveedor' : 'Registrar Nuevo Proveedor'}
                    </h3>
                    <button onClick={onClose} style={{ background: '#f1f5f9', border: 'none', borderRadius: '50%', width: 32, height: 32, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: '#64748b', transition: 'all 0.2s' }}><X size={18} /></button>
                </div>

                <div style={{ padding: '1.25rem 2rem', overflowY: 'auto' }}>
                    <form onSubmit={e => { e.preventDefault(); onSave(form); }} id="provider-form" style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                        <InputField label="Razón Social / Nombre Completo *" value={form.name} onChange={e => set('name', e.target.value)} placeholder="Ej. Alquileres de Maquinaria SAS" required />
                        
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.25rem' }}>
                            <InputField label="NIT / Cédula" value={form.nit} onChange={e => set('nit', e.target.value.replace(/[^0-9]/g, ''))} placeholder="900123456" />
                            <InputField label="Contacto Principal" value={form.contactoPrincipal} onChange={e => set('contactoPrincipal', e.target.value)} placeholder="Nombre del responsable" />
                        </div>
                        
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.25rem' }}>
                            <InputField label="Correo Electrónico" type="email" value={form.email} onChange={e => set('email', e.target.value)} placeholder="contacto@empresa.com" />
                            <InputField label="Teléfono" value={form.phone} onChange={e => set('phone', e.target.value.replace(/[^0-9]/g, ''))} placeholder="3001234567" />
                        </div>

                        <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '1.25rem' }}>
                            <InputField label="Dirección" value={form.direccion} onChange={e => set('direccion', e.target.value)} placeholder="Calle 10 # 5-50" />
                            <InputField label="Ciudad" value={form.ciudad} onChange={e => set('ciudad', e.target.value)} placeholder="Bogotá" />
                        </div>
                    </form>
                </div>

                <div style={{ padding: '1.25rem 2rem', borderTop: '1px solid #e2e8f0', display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', background: '#f8fafc', borderBottomLeftRadius: '24px', borderBottomRightRadius: '24px' }}>
                    <button type="button" onClick={onClose} className="btn btn-secondary">Cancelar</button>
                    <button type="submit" form="provider-form" className="btn btn-primary">Guardar Proveedor</button>
                </div>
            </div>
        </div>
    );
}

function DeleteProviderModal({ provider, onClose, onConfirm }) {
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
                            <div style={{ fontWeight: 800, color: 'white', fontSize: '1.1rem' }}>Eliminar Proveedor</div>
                            <div style={{ fontSize: '0.82rem', color: 'rgba(255,255,255,0.85)', marginTop: 2 }}>{provider.name}</div>
                        </div>
                    </div>
                </div>
                <div style={{ padding: '1.5rem 2rem' }}>
                    <div style={{ display: 'flex', gap: '0.75rem', background: '#fef2f2', border: '1px solid #fecaca', borderRadius: '10px', padding: '0.85rem', marginBottom: '1.25rem' }}>
                        <ShieldAlert size={20} style={{ color: '#ef4444', flexShrink: 0 }} />
                        <p style={{ fontSize: '0.8rem', color: '#b91c1c', margin: 0, fontWeight: 500, lineHeight: 1.4 }}>
                            Esta acción eliminará de forma permanente los registros del proveedor. Para continuar, ingrese su contraseña de administrador.
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

function ProviderInventoryModal({ provider, products, addProduct, editProduct, deleteProduct, onClose }) {
    const { addProductBatch, editProductBatch, deleteProductBatch } = useAppContext();
    const [view, setView] = useState('list'); // 'list' | 'add' | 'edit'
    const [selectedProd, setSelectedProd] = useState(null);
    const [expandedProdIds, setExpandedProdIds] = useState({});
    const [batchModal, setBatchModal] = useState(null); // null | { mode: 'add'|'edit', product: obj, batch?: obj }

    const toggleExpand = (prodId) => {
        setExpandedProdIds(prev => ({
            ...prev,
            [prodId]: !prev[prodId]
        }));
    };

    // Filter products belonging to this provider
    const providerProducts = useMemo(() => {
        return (products || []).filter(p => p.tipoPropiedad === 'Terceros' && p.proveedor === provider.name);
    }, [products, provider.name]);

    return (
        <div className="modal-overlay" onClick={onClose} style={{ zIndex: 1100 }}>
            <div 
                className="modal-content fadeIn" 
                onClick={e => e.stopPropagation()}
                style={{ maxWidth: 1100, width: '100%', maxHeight: '90vh', display: 'flex', flexDirection: 'column', padding: 0 }}
            >
                {/* Header */}
                <div style={{ padding: '1.25rem 2rem', borderBottom: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <h3 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '0.75rem', color: '#104166', fontSize: '1.2rem' }}>
                        <div style={{ background: 'rgba(35, 101, 171,0.1)', padding: '0.5rem', borderRadius: '10px', display: 'flex' }}>
                            <Building2 size={20} style={{ color: '#2365AB' }} />
                        </div>
                        Inventario de Terceros: {provider.name}
                    </h3>
                    <button onClick={onClose} style={{ background: '#f1f5f9', border: 'none', borderRadius: '50%', width: 32, height: 32, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: '#64748b' }}><X size={18} /></button>
                </div>

                {view === 'list' ? (
                    <>
                        {/* Toolbar */}
                        <div style={{ padding: '1rem 2rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#f8fafc', borderBottom: '1px solid #e2e8f0' }}>
                            <span style={{ fontSize: '0.85rem', color: '#64748b', fontWeight: 600 }}>
                                {providerProducts.length} {providerProducts.length === 1 ? 'equipo registrado' : 'equipos registrados'}
                            </span>
                            <button 
                                className="btn btn-primary btn-sm"
                                onClick={() => setView('add')}
                                style={{ display: 'flex', alignItems: 'center', gap: 6, fontWeight: 700 }}
                            >
                                <Plus size={16} /> Registrar Nuevo Equipo
                            </button>
                        </div>

                        {/* List */}
                        <div style={{ padding: '1.5rem 2rem', overflowY: 'auto', flex: 1 }}>
                            {providerProducts.length === 0 ? (
                                <div style={{ padding: '3rem', textAlign: 'center', color: '#64748b' }}>
                                    <PackageOpen size={48} style={{ strokeWidth: 1, color: '#94a3b8', marginBottom: '1rem' }} />
                                    <div style={{ fontWeight: 600, fontSize: '0.95rem', marginBottom: '0.25rem' }}>No hay equipos registrados de este proveedor</div>
                                    <div style={{ fontSize: '0.8rem', color: '#94a3b8' }}>Haz clic en "Registrar Nuevo Equipo" para registrar el primer artículo de este tercero.</div>
                                </div>
                            ) : (
                                <table className="glass-table" style={{ width: '100%' }}>
                                    <thead>
                                        <tr style={{ borderBottom: '1px solid var(--surface-border)' }}>
                                            <th style={{ width: '40px', padding: '0.5rem' }}></th>
                                            <th style={{ padding: '0.5rem', textAlign: 'left', fontSize: '0.75rem', color: '#64748b', fontWeight: 600 }}>Nombre</th>
                                            <th style={{ padding: '0.5rem', textAlign: 'left', fontSize: '0.75rem', color: '#64748b', fontWeight: 600 }}>Categoría</th>
                                            <th style={{ padding: '0.5rem', textAlign: 'center', fontSize: '0.75rem', color: '#64748b', fontWeight: 600 }}>Stock Total</th>
                                            <th style={{ padding: '0.5rem', textAlign: 'center', fontSize: '0.75rem', color: '#64748b', fontWeight: 600 }}>Disponible</th>
                                            <th style={{ padding: '0.5rem', textAlign: 'right', fontSize: '0.75rem', color: '#64748b', fontWeight: 600 }}>Tarifa Alquiler Cliente ($)</th>
                                            <th style={{ padding: '0.5rem', textAlign: 'center', fontSize: '0.75rem', color: '#64748b', fontWeight: 600 }}>Cobro / Esquema (Cliente)</th>
                                            <th style={{ padding: '0.5rem', textAlign: 'center', fontSize: '0.75rem', color: '#64748b', fontWeight: 600 }}>Desglose Lotes</th>
                                            <th style={{ padding: '0.5rem', textAlign: 'center', fontSize: '0.75rem', color: '#64748b', fontWeight: 600 }}>Acciones</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {providerProducts.map(p => {
                                            const isExpanded = !!expandedProdIds[p.id];
                                            const numBatches = p.batches?.length || 0;
                                            return (
                                                <React.Fragment key={p.id}>
                                                    <tr style={{ borderBottom: '1px solid var(--surface-border)', cursor: 'pointer' }} onClick={() => toggleExpand(p.id)}>
                                                        <td style={{ padding: '0.6rem 0.5rem', textAlign: 'center' }}>
                                                            {isExpanded ? <ChevronUp size={16} style={{ color: '#2365AB' }} /> : <ChevronDown size={16} style={{ color: '#64748b' }} />}
                                                        </td>
                                                        <td style={{ padding: '0.6rem 0.5rem', fontWeight: 700, fontSize: '0.85rem' }}>{p.name}</td>
                                                        <td style={{ padding: '0.6rem 0.5rem', fontSize: '0.8rem', color: '#475569' }}>
                                                            {p.category === 'Heavy Machinery' ? 'Maquinaria Pesada' :
                                                             p.category === 'Power Tools' ? 'Herramientas Eléctricas' :
                                                             p.category === 'Structures' ? 'Estructuras y Andamios' :
                                                             p.category === 'Servicio' ? 'Servicio' : p.category || 'Otro'}
                                                        </td>
                                                        <td style={{ padding: '0.6rem 0.5rem', textAlign: 'center', fontWeight: 600, fontSize: '0.85rem' }}>{p.totalStock}</td>
                                                        <td style={{ padding: '0.6rem 0.5rem', textAlign: 'center', fontWeight: 600, fontSize: '0.85rem', color: p.availableStock > 0 ? '#10b981' : '#ef4444' }}>{p.availableStock}</td>
                                                        <td style={{ padding: '0.6rem 0.5rem', textAlign: 'right', fontWeight: 700, fontSize: '0.85rem' }}>${Number(p.value || 0).toLocaleString()}</td>
                                                        <td style={{ padding: '0.6rem 0.5rem', textAlign: 'center', fontSize: '0.75rem' }}>
                                                            <span style={{ background: '#f1f5f9', padding: '0.2rem 0.4rem', borderRadius: 4, marginRight: 4 }}>{p.tipoCobro || 'Día'}</span>
                                                            <span style={{ color: '#64748b' }}>{p.esquemaCobro || 'Calendario'}</span>
                                                        </td>
                                                        <td style={{ padding: '0.6rem 0.5rem', textAlign: 'center', fontSize: '0.8rem', color: '#2365AB', fontWeight: 600 }}>
                                                            {numBatches === 1 ? '1 lote' : `${numBatches} lotes`}
                                                        </td>
                                                        <td style={{ padding: '0.6rem 0.5rem', textAlign: 'center' }} onClick={e => e.stopPropagation()}>
                                                            <div style={{ display: 'flex', gap: '0.35rem', justifyContent: 'center' }}>
                                                                <button 
                                                                    className="btn btn-secondary btn-sm" 
                                                                    onClick={() => setBatchModal({ mode: 'add', product: p })}
                                                                    style={{ padding: '0.25rem 0.5rem', fontSize: '0.7rem', color: '#10b981', borderColor: 'rgba(16,185,129,0.2)' }}
                                                                >
                                                                    + Lote
                                                                </button>
                                                                <button 
                                                                    className="btn btn-secondary btn-sm" 
                                                                    onClick={() => { setSelectedProd(p); setView('edit'); }}
                                                                    style={{ padding: '0.25rem 0.5rem', fontSize: '0.7rem' }}
                                                                >
                                                                    Editar
                                                                </button>
                                                                <button 
                                                                    className="btn btn-secondary btn-sm" 
                                                                    onClick={() => {
                                                                        if(confirm('¿Está seguro de eliminar este equipo de forma permanente? Se eliminarán también todos sus lotes asociados.')) {
                                                                            deleteProduct(p.id);
                                                                        }
                                                                    }}
                                                                    style={{ padding: '0.25rem 0.5rem', fontSize: '0.7rem', color: '#ef4444', borderColor: 'rgba(239,68,68,0.2)' }}
                                                                >
                                                                    Borrar
                                                                </button>
                                                            </div>
                                                        </td>
                                                    </tr>
                                                    {isExpanded && (
                                                        <tr style={{ background: '#f8fafc' }}>
                                                            <td colSpan={9} style={{ padding: '0.75rem 1rem 1rem 3rem', borderLeft: '4px solid #2365AB' }}>
                                                                <div style={{ background: 'white', borderRadius: 8, padding: '1rem', border: '1px solid #e2e8f0', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
                                                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
                                                                        <h5 style={{ margin: 0, color: '#1e293b', fontWeight: 700, fontSize: '0.85rem' }}>Desglose de Lotes del Equipo: {p.name}</h5>
                                                                        <button 
                                                                            className="btn btn-primary btn-sm"
                                                                            onClick={() => setBatchModal({ mode: 'add', product: p })}
                                                                            style={{ padding: '0.2rem 0.5rem', fontSize: '0.75rem', fontWeight: 600 }}
                                                                        >
                                                                            + Registrar Nueva Unidad / Lote
                                                                        </button>
                                                                    </div>
                                                                    {(!p.batches || p.batches.length === 0) ? (
                                                                        <div style={{ fontSize: '0.8rem', color: '#64748b', textAlign: 'center', padding: '1rem' }}>No hay lotes registrados para este equipo.</div>
                                                                    ) : (
                                                                        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8rem' }}>
                                                                            <thead>
                                                                                <tr style={{ borderBottom: '2px solid #e2e8f0', textAlign: 'left' }}>
                                                                                    <th style={{ padding: '0.4rem', color: '#64748b', fontWeight: 600 }}># Lote</th>
                                                                                    <th style={{ padding: '0.4rem', color: '#64748b', fontWeight: 600 }}>Fecha de Ingreso</th>
                                                                                    <th style={{ padding: '0.4rem', color: '#64748b', fontWeight: 600, textAlign: 'center' }}>Cantidad (Total)</th>
                                                                                    <th style={{ padding: '0.4rem', color: '#64748b', fontWeight: 600, textAlign: 'center' }}>Disponible</th>
                                                                                    <th style={{ padding: '0.4rem', color: '#64748b', fontWeight: 600, textAlign: 'right' }}>Costo Adquisición ($)</th>
                                                                                    <th style={{ padding: '0.4rem', color: '#64748b', fontWeight: 600, textAlign: 'center' }}>Cobro / Esquema (Costo)</th>
                                                                                    <th style={{ padding: '0.4rem', color: '#64748b', fontWeight: 600, textAlign: 'center' }}>Acciones</th>
                                                                                </tr>
                                                                            </thead>
                                                                            <tbody>
                                                                                {p.batches.map((b, idx) => (
                                                                                    <tr key={b.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                                                                                        <td style={{ padding: '0.4rem', fontWeight: 600 }}>Lote #{idx + 1}</td>
                                                                                        <td style={{ padding: '0.4rem' }}>{b.fechaCompra ? format(new Date(b.fechaCompra + 'T00:00:00'), 'dd/MM/yyyy') : '—'}</td>
                                                                                        <td style={{ padding: '0.4rem', textAlign: 'center', fontWeight: 600 }}>{b.stock}</td>
                                                                                        <td style={{ padding: '0.4rem', textAlign: 'center', fontWeight: 600, color: b.availableStock > 0 ? '#10b981' : '#ef4444' }}>{b.availableStock}</td>
                                                                                        <td style={{ padding: '0.4rem', textAlign: 'right', fontWeight: 700, color: '#b45309' }}>${Number(b.costoAdquisicion || 0).toLocaleString()}</td>
                                                                                        <td style={{ padding: '0.4rem', textAlign: 'center' }}>
                                                                                            <span style={{ background: '#fffbeb', padding: '0.1rem 0.35rem', borderRadius: 4, marginRight: 4, color: '#b45309', border: '1px solid #fef3c7', fontSize: '0.7rem' }}>{b.tipoCobroCosto || 'Día'}</span>
                                                                                            <span style={{ color: '#b45309', fontSize: '0.75rem' }}>{b.esquemaCobroCosto || 'Calendario'}</span>
                                                                                        </td>
                                                                                        <td style={{ padding: '0.4rem', textAlign: 'center' }}>
                                                                                            <div style={{ display: 'flex', gap: '0.35rem', justifyContent: 'center' }}>
                                                                                                <button 
                                                                                                    className="btn btn-secondary btn-sm" 
                                                                                                    onClick={() => setBatchModal({ mode: 'edit', product: p, batch: b })}
                                                                                                    style={{ padding: '0.15rem 0.35rem', fontSize: '0.7rem' }}
                                                                                                >
                                                                                                    Editar Lote
                                                                                                </button>
                                                                                                <button 
                                                                                                    className="btn btn-secondary btn-sm" 
                                                                                                    onClick={() => {
                                                                                                        if (confirm('¿Está seguro de eliminar este lote? El stock total del producto se descontará.')) {
                                                                                                            deleteProductBatch(p.id, b.id);
                                                                                                        }
                                                                                                    }}
                                                                                                    style={{ padding: '0.15rem 0.35rem', fontSize: '0.7rem', color: '#ef4444', borderColor: 'rgba(239,68,68,0.1)' }}
                                                                                                >
                                                                                                    Borrar Lote
                                                                                                </button>
                                                                                            </div>
                                                                                        </td>
                                                                                    </tr>
                                                                                ))}
                                                                            </tbody>
                                                                        </table>
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
                            )}
                        </div>
                    </>
                ) : (
                    <AddEditThirdPartyProductForm 
                        mode={view}
                        providerName={provider.name}
                        initialProduct={selectedProd}
                        onSave={(form) => {
                            if (view === 'add') {
                                addProduct(form);
                            } else {
                                editProduct(selectedProd.id, form);
                            }
                            setView('list');
                            setSelectedProd(null);
                        }}
                        onCancel={() => {
                            setView('list');
                            setSelectedProd(null);
                        }}
                    />
                )}
            </div>

            {/* Modal para Agregar/Editar Lotes */}
            {batchModal && (
                <AddEditBatchModal 
                    mode={batchModal.mode}
                    product={batchModal.product}
                    batch={batchModal.batch}
                    onSave={async (batchForm) => {
                        if (batchModal.mode === 'add') {
                            await addProductBatch(batchModal.product.id, batchForm);
                        } else {
                            await editProductBatch(batchModal.product.id, batchModal.batch.id, batchForm);
                        }
                        setBatchModal(null);
                    }}
                    onClose={() => setBatchModal(null)}
                />
            )}
        </div>
    );
}

function AddEditBatchModal({ mode, product, batch, onSave, onClose }) {
    const [stock, setStock] = useState(batch?.stock || 1);
    const [fechaCompra, setFechaCompra] = useState(batch?.fechaCompra || '');
    const [costoAdquisicion, setCostoAdquisicion] = useState(batch?.costoAdquisicion || '');
    const [tipoCobroCosto, setTipoCobroCosto] = useState(batch?.tipoCobroCosto || 'Día');
    const [esquemaCobroCosto, setEsquemaCobroCosto] = useState(batch?.esquemaCobroCosto || 'Calendario');

    const handleSubmit = (e) => {
        e.preventDefault();
        onSave({
            stock: parseInt(stock) || 1,
            fechaCompra: fechaCompra || null,
            costoAdquisicion: parseFloat(costoAdquisicion) || 0,
            tipoCobroCosto,
            esquemaCobroCosto
        });
    };

    return (
        <div className="modal-overlay" style={{ zIndex: 1200 }}>
            <div className="modal-content fadeIn" onClick={e => e.stopPropagation()} style={{ maxWidth: 500, width: '100%', borderRadius: 12, overflow: 'hidden' }}>
                <div style={{ padding: '1.25rem 2rem', borderBottom: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <h3 style={{ margin: 0, color: '#104166', fontSize: '1.15rem', fontWeight: 700 }}>
                        {mode === 'add' ? `Agregar Lote a: ${product.name}` : `Editar Lote de: ${product.name}`}
                    </h3>
                    <button onClick={onClose} style={{ background: '#f1f5f9', border: 'none', borderRadius: '50%', width: 32, height: 32, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: '#64748b' }}><X size={18} /></button>
                </div>
                <form onSubmit={handleSubmit}>
                    <div style={{ padding: '1.5rem 2rem', display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                        <InputField 
                            label="Cantidad / Unidades *" 
                            type="number" 
                            min="1" 
                            value={stock} 
                            onChange={e => setStock(e.target.value)} 
                            required 
                        />
                        <InputField 
                            label="Fecha de Ingreso *" 
                            type="date"
                            value={fechaCompra} 
                            onChange={e => setFechaCompra(e.target.value)} 
                            required
                        />
                        <div className="input-group" style={{ margin: 0 }}>
                            <label className="input-label">Costo Adquisición ($) *</label>
                            <div style={{ display: 'flex', gap: '0.5rem' }}>
                                <input 
                                    type="number" 
                                    className="input-base" 
                                    value={costoAdquisicion} 
                                    onChange={e => setCostoAdquisicion(e.target.value)} 
                                    placeholder="Ej. 18000" 
                                    style={{ flex: 1 }} 
                                    required 
                                />
                                <select 
                                    className="input-base" 
                                    style={{ width: 120, padding: '0.6rem' }} 
                                    value={tipoCobroCosto} 
                                    onChange={e => {
                                        const tc = e.target.value;
                                        setTipoCobroCosto(tc);
                                        if (tc === 'Servicio') {
                                            setEsquemaCobroCosto('Única Vez');
                                        }
                                    }}
                                >
                                    <option value="Día">Día</option>
                                    <option value="Hora">Hora</option>
                                    <option value="Servicio">Servicio</option>
                                </select>
                            </div>
                        </div>

                        <div className="input-group" style={{ margin: 0 }}>
                            <label className="input-label">Esquema de Cobro (Costo)</label>
                            {(() => {
                                const isServ = product.category === 'Servicio' || tipoCobroCosto === 'Servicio';
                                return (
                                    <select 
                                        className="input-base" 
                                        disabled={isServ}
                                        value={isServ ? 'Única Vez' : esquemaCobroCosto}
                                        onChange={e => setEsquemaCobroCosto(e.target.value)}
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
                    <div style={{ padding: '1.25rem 2rem', borderTop: '1px solid #e2e8f0', display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', background: '#f8fafc' }}>
                        <button type="button" onClick={onClose} className="btn btn-secondary">Cancelar</button>
                        <button type="submit" className="btn btn-primary">{mode === 'add' ? 'Agregar Lote' : 'Guardar Cambios'}</button>
                    </div>
                </form>
            </div>
        </div>
    );
}

function handleLocalImageUpload(file, callback) {
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
                callback(canvas.toDataURL('image/jpeg', 0.7));
            };
            img.src = reader.result;
        };
        reader.readAsDataURL(file);
    }
}

function AddEditThirdPartyProductForm({ mode, providerName, initialProduct, onSave, onCancel }) {
    const [name, setName] = useState(initialProduct?.name || '');
    const [category, setCategory] = useState(initialProduct?.category || 'Heavy Machinery');
    const [totalStock, setTotalStock] = useState(mode === 'edit' ? (initialProduct?.totalStock || 1) : 1);
    const [value, setValue] = useState(initialProduct?.value || '');
    const [tipoCobro, setTipoCobro] = useState(initialProduct?.tipoCobro || 'Día');
    const [esquemaCobro, setEsquemaCobro] = useState(initialProduct?.esquemaCobro || 'Calendario');
    const [image, setImage] = useState(initialProduct?.image || null);
    const [fechaCompra, setFechaCompra] = useState(mode === 'edit' ? (initialProduct?.fechaCompra || '') : '');
    const [costoAdquisicion, setCostoAdquisicion] = useState(mode === 'edit' ? (initialProduct?.costoAdquisicion || '') : '');
    const [tipoCobroCosto, setTipoCobroCosto] = useState(initialProduct?.tipoCobroCosto || 'Día');
    const [esquemaCobroCosto, setEsquemaCobroCosto] = useState(initialProduct?.esquemaCobroCosto || 'Calendario');

    const fileInputRef = useRef(null);
    const [isDragging, setIsDragging] = useState(false);

    const handleSubmit = (e) => {
        e.preventDefault();
        if (!name.trim()) return alert('El nombre del equipo es obligatorio');
        onSave({
            name,
            category,
            totalStock: parseInt(totalStock) || 1,
            value: parseFloat(value) || 0,
            tipoCobro,
            esquemaCobro,
            tipoPropiedad: 'Terceros',
            proveedor: providerName,
            image,
            fechaCompra: fechaCompra || null,
            costoAdquisicion: parseFloat(costoAdquisicion) || 0,
            tipoCobroCosto,
            esquemaCobroCosto
        });
    };

    return (
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', flex: 1, overflow: 'hidden' }}>
            <div style={{ padding: '1.5rem 2rem', overflowY: 'auto', flex: 1, display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                <h4 style={{ margin: 0, color: '#104166', fontWeight: 700 }}>
                    {mode === 'add' ? (initialProduct ? `Registrar Unidad Adicional: ${initialProduct.name}` : 'Registrar Nuevo Equipo de Tercero') : `Editar Equipo: ${initialProduct.name}`}
                </h4>

                <InputField 
                    label="Nombre del Equipo *" 
                    value={name} 
                    onChange={e => setName(e.target.value)} 
                    placeholder="Ej. Mezcladora de Concreto 2 sacos" 
                    required 
                />

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.25rem' }}>
                    <div className="input-group" style={{ margin: 0 }}>
                        <label className="input-label">Categoría</label>
                        <select className="input-base" value={category} onChange={e => {
                            const cat = e.target.value;
                            setCategory(cat);
                            if (cat === 'Servicio') {
                                setTipoCobro('Servicio');
                                setEsquemaCobro('Única Vez');
                                setTipoCobroCosto('Servicio');
                                setEsquemaCobroCosto('Única Vez');
                            }
                        }}>
                            <option value="Heavy Machinery">Maquinaria Pesada</option>
                            <option value="Power Tools">Herramientas Eléctricas</option>
                            <option value="Structures">Estructuras y Andamios</option>
                            <option value="Servicio">Servicio (Cobro Único)</option>
                            <option value="Other">Otro</option>
                        </select>
                    </div>
                    <InputField 
                        label="Stock Total *" 
                        type="number" 
                        min="1" 
                        value={totalStock} 
                        onChange={e => setTotalStock(e.target.value)} 
                        required 
                    />
                </div>

                {/* Tarifas de Alquiler al Cliente */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.25rem' }}>
                    <div className="input-group" style={{ margin: 0 }}>
                        <label className="input-label">Tarifa Alquiler / Servicio ($) *</label>
                        <div style={{ display: 'flex', gap: '0.5rem' }}>
                            <input 
                                type="number" 
                                className="input-base" 
                                value={value} 
                                onChange={e => setValue(e.target.value)} 
                                placeholder="Ej. 25000" 
                                style={{ flex: 1 }} 
                                required 
                            />
                            <select 
                                className="input-base" 
                                style={{ width: 120, padding: '0.6rem' }} 
                                value={tipoCobro} 
                                onChange={e => {
                                    const tc = e.target.value;
                                    setTipoCobro(tc);
                                    if (tc === 'Servicio') {
                                        setEsquemaCobro('Única Vez');
                                    }
                                }}
                            >
                                <option value="Día">Día</option>
                                <option value="Hora">Hora</option>
                                <option value="Servicio">Servicio</option>
                            </select>
                        </div>
                    </div>

                    <div className="input-group" style={{ margin: 0 }}>
                        <label className="input-label">Esquema de Cobro (Cliente)</label>
                        {(() => {
                            const isServ = category === 'Servicio' || tipoCobro === 'Servicio';
                            return (
                                <select 
                                    className="input-base" 
                                    disabled={isServ}
                                    value={isServ ? 'Única Vez' : esquemaCobro}
                                    onChange={e => setEsquemaCobro(e.target.value)}
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

                {/* Costo de Adquisición (Tarifa y Esquema para el Proveedor) */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.25rem' }}>
                    <div className="input-group" style={{ margin: 0 }}>
                        <label className="input-label">Costo Adquisición ($) *</label>
                        <div style={{ display: 'flex', gap: '0.5rem' }}>
                            <input 
                                type="number" 
                                className="input-base" 
                                value={costoAdquisicion} 
                                onChange={e => setCostoAdquisicion(e.target.value)} 
                                placeholder="Ej. 18000" 
                                style={{ flex: 1 }} 
                                required 
                            />
                            <select 
                                className="input-base" 
                                style={{ width: 120, padding: '0.6rem' }} 
                                value={tipoCobroCosto} 
                                onChange={e => {
                                    const tc = e.target.value;
                                    setTipoCobroCosto(tc);
                                    if (tc === 'Servicio') {
                                        setEsquemaCobroCosto('Única Vez');
                                    }
                                }}
                            >
                                <option value="Día">Día</option>
                                <option value="Hora">Hora</option>
                                <option value="Servicio">Servicio</option>
                            </select>
                        </div>
                    </div>

                    <div className="input-group" style={{ margin: 0 }}>
                        <label className="input-label">Esquema de Cobro (Costo)</label>
                        {(() => {
                            const isServ = category === 'Servicio' || tipoCobroCosto === 'Servicio';
                            return (
                                <select 
                                    className="input-base" 
                                    disabled={isServ}
                                    value={isServ ? 'Única Vez' : esquemaCobroCosto}
                                    onChange={e => setEsquemaCobroCosto(e.target.value)}
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

                {/* Imagen del Equipo */}
                <div className="input-group" style={{ margin: 0 }}>
                    <label className="input-label" style={{ marginBottom: '0.4rem' }}>Imagen del Equipo</label>
                    <div
                        onDragOver={e => { e.preventDefault(); setIsDragging(true); }}
                        onDragLeave={e => { e.preventDefault(); setIsDragging(false); }}
                        onDrop={e => {
                            e.preventDefault(); setIsDragging(false);
                            const file = e.dataTransfer.files[0];
                            if (file && file.type.startsWith('image/')) handleLocalImageUpload(file, setImage);
                        }}
                        onClick={() => fileInputRef.current?.click()}
                        style={{
                            border: `2px dashed ${isDragging ? '#2365AB' : 'var(--surface-border)'}`,
                            borderRadius: 12, padding: '1.25rem', textAlign: 'center',
                            backgroundColor: isDragging ? 'rgba(35, 101, 171, 0.05)' : '#fafafa',
                            cursor: 'pointer', transition: 'all 0.3s ease',
                            display: 'flex', flexDirection: 'column', alignItems: 'center',
                            justifyContent: 'center', gap: '0.5rem', minHeight: 110
                        }}>
                        <input type="file" accept="image/*" ref={fileInputRef}
                            onChange={e => {
                                const file = e.target.files[0];
                                if (file) handleLocalImageUpload(file, setImage);
                            }}
                            style={{ display: 'none' }} />
                        {image ? (
                            <div>
                                <img src={image} alt="Preview" style={{ maxWidth: '100%', maxHeight: 80, objectFit: 'contain', borderRadius: 8 }} />
                                <div style={{ marginTop: '0.4rem', fontSize: '0.8rem', color: '#2365AB', fontWeight: 600 }}>Haga clic para cambiar imagen</div>
                            </div>
                        ) : (
                            <>
                                <div style={{ padding: '0.5rem', background: 'rgba(35, 101, 171,0.1)', borderRadius: '50%', color: '#2365AB', display: 'flex' }}><UploadCloud size={22} /></div>
                                <p style={{ fontWeight: 600, color: 'var(--text-primary)', fontSize: '0.8rem', margin: 0 }}>Arrastre una imagen aquí o haga clic para seleccionar</p>
                            </>
                        )}
                    </div>
                </div>

                {/* Fecha y Datos de Origen */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1.5fr', gap: '1.25rem' }}>
                    <InputField 
                        label="Fecha de Compra / Ingreso" 
                        type="date"
                        value={fechaCompra} 
                        onChange={e => setFechaCompra(e.target.value)} 
                    />
                    <InputField label="Origen (Propiedad)" value="Terceros" disabled />
                    <InputField label="Proveedor Aliado" value={providerName} disabled />
                </div>
            </div>

            <div style={{ padding: '1.25rem 2rem', borderTop: '1px solid #e2e8f0', display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', background: '#f8fafc' }}>
                <button type="button" onClick={onCancel} className="btn btn-secondary">Cancelar</button>
                <button type="submit" className="btn btn-primary">{mode === 'add' ? 'Registrar Equipo' : 'Guardar Cambios'}</button>
            </div>
        </form>
    );
}

function ClientDetail({ client, onClose, onEdit, onAddObra, onEditObra, invoices, products, onDelete, remisiones, addRemision, editRemision, maintenances, settings }) {
    const { deleteRemision } = useAppContext();
    const [tab, setTab] = useState('datos');
    const [showObraModal, setShowObraModal] = useState(false);
    const [editingObra, setEditingObra] = useState(null);
    const [showRemisionModal, setShowRemisionModal] = useState(false);
    const [editingRemisionTarget, setEditingRemisionTarget] = useState(null);
    const [expandedRemIds, setExpandedRemIds] = useState([]);

    const toggleExpandRemision = (id) => {
        setExpandedRemIds(prev => 
            prev.includes(id) ? prev.filter(item => item !== id) : [...prev, id]
        );
    };

    const clientInvoices = (invoices || []).filter(inv => inv && inv.clientId === client?.id);
    const totalFacturado = clientInvoices.reduce((s, i) => s + (Number(i?.amount) || 0), 0);
    const totalPagado = clientInvoices.filter(i => i?.status === 'Paid').reduce((s, i) => s + (Number(i?.amount) || 0), 0);
    const deuda = Number(client?.debt) || 0;
    const obrasActivas = (client?.obras || []).filter(o => o && o.estado === 'Activa').length;

    const handleDelete = () => {
        const pass = prompt('POR SEGURIDAD: Ingrese la contraseña de administrador para eliminar este cliente:');
        if (pass === null) return;
        if (pass === 'admin123') {
            if (window.confirm(`¿Está seguro de eliminar permanentemente a ${client?.name}?`)) onDelete(client.id);
        } else {
            alert('Contraseña incorrecta.');
        }
    };

    const clientRemisiones = (remisiones || []).filter(r => r && r.clientId === client?.id);

    const TABS = [
        { k: 'datos',    label: 'Información' },
        { k: 'obras',    label: `Obras (${client?.obras?.length || 0})` },
        { k: 'remisiones', label: `Remisiones (${clientRemisiones.length})` },
        { k: 'historial',label: `Historial (${clientInvoices.length})` },
    ];

    return (
        <>
            <div onClick={onClose} style={{ position:'fixed', inset:0, background:'rgba(15,23,42,0.5)', backdropFilter:'blur(6px)', zIndex:1000 }} />
            <div style={{ position:'fixed', inset:0, zIndex:1001, display:'flex', alignItems:'center', justifyContent:'center', padding:'1.5rem' }}>
                <div onClick={e => e.stopPropagation()} style={{
                    width:'100%', maxWidth:1180, height:'90vh',
                    display:'flex', overflow:'hidden',
                    borderRadius:'20px', boxShadow:'0 32px 80px -12px rgba(0,0,0,0.4)',
                    border:'1px solid #1e3a5f',
                    animation:'cdFadeIn 0.22s ease'
                }}>

                    <div style={{
                        width:270, flexShrink:0,
                        background:'linear-gradient(160deg,#0c2340 0%,#1a406e 100%)',
                        display:'flex', flexDirection:'column', padding:'2rem 1.5rem', gap:'1.25rem', overflowY:'auto'
                    }}>
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

                        {client.phone && <div style={{ display:'flex', alignItems:'center', gap:'0.5rem', color:'rgba(255,255,255,0.6)', fontSize:'0.78rem' }}><Phone size={13}/>{client.phone}</div>}
                        {client.email && <div style={{ display:'flex', alignItems:'center', gap:'0.5rem', color:'rgba(255,255,255,0.6)', fontSize:'0.78rem' }}><Mail size={13}/>{client.email}</div>}
                        {client.ciudad && <div style={{ display:'flex', alignItems:'center', gap:'0.5rem', color:'rgba(255,255,255,0.6)', fontSize:'0.78rem' }}><MapPin size={13}/>{client.ciudad}, {client.departamento}</div>}

                        <div style={{ flex:1 }} />

                        {[
                            { icon:<Download size={14}/>, label:'Exportar PDF', action:() => exportClientPDF(client, invoices, products, settings), danger:false },
                            { icon:<Truck size={14}/>,    label:'Nueva Remisión', action:() => setShowRemisionModal(true), danger:false },
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

                    <div style={{ flex:1, display:'flex', flexDirection:'column', overflow:'hidden', background:'white' }}>
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

                        <div style={{ flex:1, overflowY:'auto', padding:'2rem 2.5rem' }}>
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
                            </>)}

                            {tab === 'obras' && (<>
                                <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'1.5rem' }}>
                                    <SectionLabel icon={<Building2 size={13}/>} color="#f97316">{client.obras?.length || 0} Proyectos</SectionLabel>
                                    <button onClick={() => { setEditingObra(null); setShowObraModal(true); }} className="btn btn-primary btn-sm" style={{display:'flex',alignItems:'center',gap:'0.4rem'}}><Plus size={14}/> Nueva Obra</button>
                                </div>
                                <div style={{ display:'grid', gridTemplateColumns:'repeat(2,1fr)', gap:'1rem' }}>
                                    {(client.obras || []).map(obra => {
                                        if (!obra) return null;
                                        const cfg = OBRA_ESTADO[obra.estado] || OBRA_ESTADO['Activa'];
                                        return (
                                            <div key={obra.id} className="obra-card" style={{ border: `1px solid ${cfg.color}40` }}>
                                                <div style={{ background: cfg.color, padding: '1rem 1.25rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                                    <div style={{ fontWeight: 800, color: '#ffffff', fontSize: '1.05rem', letterSpacing: '-0.01em', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                                        <Building2 size={16} />
                                                        {obra.nombre}
                                                    </div>
                                                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                                                        <span style={{ padding: '3px 10px', borderRadius: '6px', background: 'rgba(255,255,255,0.25)', color: '#ffffff', fontSize: '0.7rem', fontWeight: 800 }}>
                                                            {obra.estado.toUpperCase()}
                                                        </span>
                                                        <button onClick={() => { setEditingObra(obra); setShowObraModal(true); }} className="obra-edit-btn-solid" title="Editar Obra">
                                                            <Edit3 size={15} />
                                                        </button>
                                                    </div>
                                                </div>
                                                <div style={{ padding: '1.25rem' }}>
                                                    <div style={{ fontSize: '0.85rem', color: '#475569', display: 'flex', alignItems: 'center', gap: '0.4rem', marginBottom: '1rem' }}>
                                                        <MapPin size={14} color="#64748b" />{obra.ubicacion || 'Sin ubicación'}
                                                    </div>
                                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingTop: '1rem', borderTop: '1px solid #e2e8f0' }}>
                                                        <span style={{ fontSize: '0.75rem', color: '#64748b', fontWeight: 800, letterSpacing: '0.05em' }}>PRESUPUESTO</span>
                                                        <span style={{ fontSize: '1.2rem', fontWeight: 900, color: '#0f172a' }}>${(obra.presupuesto||0).toLocaleString()}</span>
                                                    </div>
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            </>)}

                            {tab === 'remisiones' && (<>
                                <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'1.5rem' }}>
                                    <SectionLabel icon={<Truck size={13}/>} color="#2365AB">{clientRemisiones.length} Remisiones</SectionLabel>
                                    <button onClick={() => setShowRemisionModal(true)} className="btn btn-primary btn-sm" style={{display:'flex',alignItems:'center',gap:'0.4rem'}}><Plus size={14}/> Nueva Remisión</button>
                                </div>
                                {clientRemisiones.length === 0 ? (
                                    <div style={{ textAlign:'center', padding:'4rem', color:'#94a3b8', border:'1px dashed #e2e8f0', borderRadius:'14px' }}>No hay remisiones registradas.</div>
                                ) : (
                                    <div style={{ display:'flex', flexDirection:'column', gap:'0.85rem' }}>
                                        {clientRemisiones.map((rem) => {
                                            if (!rem) return null;
                                            const obra = (client?.obras || []).find(o => o && o.id === rem.obraId);
                                            const isExpanded = expandedRemIds.includes(rem.id);

                                            return (
                                                <div key={rem.id} style={{
                                                    background: '#ffffff',
                                                    border: isExpanded ? '1px solid #14335A' : '1px solid #e2e8f0',
                                                    borderRadius: '8px',
                                                    boxShadow: isExpanded ? '0 4px 16px rgba(20, 51, 90, 0.12)' : '0 2px 8px rgba(0, 0, 0, 0.06)',
                                                    transition: 'box-shadow 0.2s ease, border-color 0.2s ease',
                                                    overflow: 'hidden'
                                                }}>
                                                    {/* Header Principal - Clic para Plegar / Desplegar */}
                                                    <div 
                                                        onClick={() => toggleExpandRemision(rem.id)}
                                                        style={{
                                                            padding: '0.75rem 1rem',
                                                            display: 'flex',
                                                            justifyContent: 'space-between',
                                                            alignItems: 'center',
                                                            flexWrap: 'wrap',
                                                            gap: '0.5rem',
                                                            cursor: 'pointer',
                                                            userSelect: 'none',
                                                            background: isExpanded ? '#14335A' : '#ffffff',
                                                            transition: 'background 0.15s ease'
                                                        }}
                                                    >
                                                        <div style={{ display: 'flex', alignItems: 'center', gap: '3.5rem', flexWrap: 'wrap' }}>
                                                            <span style={{ fontWeight: 800, fontSize: '0.95rem', color: isExpanded ? '#ffffff' : '#2365AB' }}>{rem.id}</span>
                                                            <span style={{ fontSize: '0.85rem', color: isExpanded ? 'rgba(255,255,255,0.9)' : '#0f172a', fontWeight: 600 }}>{rem.fecha}</span>
                                                        </div>

                                                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
                                                            <button
                                                                onClick={(e) => {
                                                                    e.stopPropagation();
                                                                    toggleExpandRemision(rem.id);
                                                                }}
                                                                className="btn btn-outline btn-sm"
                                                                style={{
                                                                    padding: '0.3rem 0.65rem',
                                                                    fontSize: '0.75rem',
                                                                    display: 'flex',
                                                                    alignItems: 'center',
                                                                    gap: '0.35rem',
                                                                    background: isExpanded ? 'rgba(255,255,255,0.15)' : 'transparent',
                                                                    borderColor: isExpanded ? 'rgba(255,255,255,0.3)' : '#cbd5e1',
                                                                    color: isExpanded ? '#ffffff' : '#334155'
                                                                }}
                                                            >
                                                                {isExpanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                                                                {isExpanded ? 'Ocultar' : 'Desplegar ítems'}
                                                            </button>

                                                            <button 
                                                                onClick={(e) => {
                                                                    e.stopPropagation();
                                                                    setEditingRemisionTarget(rem);
                                                                }}
                                                                className="btn btn-outline btn-sm" 
                                                                style={{
                                                                    padding: '0.3rem 0.65rem',
                                                                    fontSize: '0.75rem',
                                                                    display: 'flex',
                                                                    alignItems: 'center',
                                                                    gap: '0.35rem',
                                                                    background: isExpanded ? 'rgba(255,255,255,0.15)' : 'transparent',
                                                                    borderColor: isExpanded ? 'rgba(255,255,255,0.3)' : '#cbd5e1',
                                                                    color: isExpanded ? '#ffffff' : '#334155'
                                                                }}
                                                                title="Editar Remisión"
                                                            >
                                                                <Edit3 size={14} /> Editar
                                                            </button>

                                                            <button 
                                                                onClick={(e) => {
                                                                    e.stopPropagation();
                                                                    generateRemisionPDF(rem, client, obra, settings);
                                                                }}
                                                                className="btn btn-outline btn-sm" 
                                                                style={{
                                                                    padding: '0.3rem 0.65rem',
                                                                    fontSize: '0.75rem',
                                                                    display: 'flex',
                                                                    alignItems: 'center',
                                                                    gap: '0.35rem',
                                                                    background: isExpanded ? 'rgba(255,255,255,0.15)' : 'transparent',
                                                                    borderColor: isExpanded ? 'rgba(255,255,255,0.3)' : '#cbd5e1',
                                                                    color: isExpanded ? '#ffffff' : '#334155'
                                                                }}
                                                                title="Imprimir Remisión"
                                                            >
                                                                <Printer size={14} /> Imprimir
                                                            </button>

                                                            <button 
                                                                onClick={async (e) => {
                                                                    e.stopPropagation();
                                                                    const result = await Swal.fire({
                                                                        title: '¿Eliminar Remisión?',
                                                                        text: `¿Está seguro de eliminar la remisión ${rem.id}? Esto devolverá todos sus equipos al inventario disponible.`,
                                                                        icon: 'warning',
                                                                        showCancelButton: true,
                                                                        confirmButtonColor: '#ef4444',
                                                                        cancelButtonColor: '#64748b',
                                                                        confirmButtonText: 'Sí, eliminar',
                                                                        cancelButtonText: 'Cancelar'
                                                                    });
                                                                    if (result.isConfirmed) {
                                                                        try {
                                                                            await deleteRemision(rem.id);
                                                                            Swal.fire({
                                                                                title: 'Remisión Eliminada',
                                                                                text: `La remisión ${rem.id} fue eliminada y los equipos han vuelto al inventario.`,
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
                                                                className="btn btn-outline btn-sm" 
                                                                style={{
                                                                    padding: '0.3rem 0.65rem',
                                                                    fontSize: '0.75rem',
                                                                    display: 'flex',
                                                                    alignItems: 'center',
                                                                    gap: '0.35rem',
                                                                    background: 'rgba(239, 68, 68, 0.1)',
                                                                    borderColor: 'rgba(239, 68, 68, 0.3)',
                                                                    color: '#ef4444'
                                                                }}
                                                                title="Eliminar Remisión (Retornar al inventario)"
                                                            >
                                                                <Trash2 size={14} /> Eliminar
                                                            </button>
                                                        </div>
                                                    </div>

                                                    {/* Desplegable: Tabla de Ítems */}
                                                    {isExpanded && (() => {
                                                        let diasCalc = 1;
                                                        if (rem.fecha) {
                                                            const parts = rem.fecha.split('-');
                                                            if (parts.length === 3) {
                                                                const fDate = new Date(parts[0], parts[1] - 1, parts[2]);
                                                                const now = new Date();
                                                                const diff = Math.max(0, now - fDate);
                                                                diasCalc = Math.max(1, Math.ceil(diff / (1000 * 60 * 60 * 24)));
                                                            }
                                                        }

                                                        return (
                                                            <div style={{ borderTop: '1px solid #e2e8f0', background: '#ffffff' }}>
                                                                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8rem' }}>
                                                                    <thead>
                                                                        <tr style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0' }}>
                                                                            <th style={{ padding: '0.55rem 1rem', textAlign: 'center', color: '#64748b', fontWeight: 700, width: '90px' }}>Cantidad</th>
                                                                            <th style={{ padding: '0.55rem 1rem', textAlign: 'left', color: '#64748b', fontWeight: 700 }}>Descripción</th>
                                                                            <th style={{ padding: '0.55rem 1rem', textAlign: 'center', color: '#64748b', fontWeight: 700 }}>Estado (Alquiler o Devuelto)</th>
                                                                            <th style={{ padding: '0.55rem 1rem', textAlign: 'center', color: '#64748b', fontWeight: 700 }}>Fecha Devolución</th>
                                                                            <th style={{ padding: '0.55rem 1rem', textAlign: 'right', color: '#64748b', fontWeight: 700 }}>V. Unitario</th>
                                                                            <th style={{ padding: '0.55rem 1rem', textAlign: 'right', color: '#64748b', fontWeight: 700 }}>V. al día de hoy</th>
                                                                        </tr>
                                                                    </thead>
                                                                    <tbody>
                                                                        {(rem.items || []).length === 0 ? (
                                                                            <tr>
                                                                                <td colSpan={6} style={{ padding: '0.85rem 1rem', textAlign: 'center', color: '#94a3b8' }}>No hay ítems registrados en esta remisión.</td>
                                                                            </tr>
                                                                        ) : (
                                                                            rem.items.map((it, iIdx) => {
                                                                                const prod = (products || []).find(p => p.id === it.productId);
                                                                                const name = it.nombre || it.name || prod?.name || it.productId || 'Equipo';
                                                                                const cant = Number(it.cantidad) || 0;
                                                                                const cantDev = Number(it.cantidadDevuelta) || 0;
                                                                                const enCampo = Math.max(0, cant - cantDev);
                                                                                const tarifa = Number(it.tarifaDia || prod?.value || 0);
                                                                                const isServ = (it.tipoCobro || '').toLowerCase().includes('servicio') || 
                                                                                               (it.tipoCobro || '').toLowerCase().includes('única') ||
                                                                                               (prod?.category || '').toLowerCase().includes('servicio') || 
                                                                                               (prod?.tipoCobro || '').toLowerCase().includes('servicio') ||
                                                                                               (prod?.esquemaCobro || '').toLowerCase().includes('única');
                                                                                const vHoy = enCampo > 0 ? (enCampo * tarifa * (isServ ? 1 : diasCalc)) : 0;
                                                                                const devoluciones = it.devoluciones || [];

                                                                                return (
                                                                                    <tr key={iIdx} style={{ borderBottom: '1px solid #f1f5f9', background: iIdx % 2 === 0 ? '#ffffff' : '#fafafa' }}>
                                                                                        <td style={{ padding: '0.55rem 1rem', textAlign: 'center', fontWeight: 700, color: '#2365AB' }}>
                                                                                            {cant}
                                                                                        </td>
                                                                                        <td style={{ padding: '0.55rem 1rem', fontWeight: 600, color: '#1e293b' }}>
                                                                                            {name}
                                                                                            {it.productId && <span style={{ fontSize: '0.7rem', color: '#94a3b8', marginLeft: '0.5rem', fontWeight: 400 }}>({it.productId})</span>}
                                                                                        </td>
                                                                                        <td style={{ padding: '0.55rem 1rem', textAlign: 'center' }}>
                                                                                            {enCampo > 0 ? (
                                                                                                <span style={{ padding: '3px 10px', borderRadius: '12px', fontSize: '0.75rem', fontWeight: 700, background: 'rgba(35, 101, 171, 0.1)', color: '#2365AB' }}>
                                                                                                    Alquiler {cantDev > 0 ? `(${enCampo})` : ''}
                                                                                                </span>
                                                                                            ) : (
                                                                                                <span style={{ padding: '3px 10px', borderRadius: '12px', fontSize: '0.75rem', fontWeight: 700, background: '#dcfce7', color: '#15803d' }}>
                                                                                                    Devuelto
                                                                                                </span>
                                                                                            )}
                                                                                            {cantDev > 0 && enCampo > 0 && (
                                                                                                <span style={{ padding: '3px 10px', borderRadius: '12px', fontSize: '0.75rem', fontWeight: 700, background: '#dcfce7', color: '#15803d', marginLeft: '6px' }}>
                                                                                                    Devuelto ({cantDev})
                                                                                                </span>
                                                                                            )}
                                                                                        </td>
                                                                                        <td style={{ padding: '0.55rem 1rem', textAlign: 'center', color: '#475569', fontWeight: 600 }}>
                                                                                            {devoluciones.length > 0 ? (
                                                                                                <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', alignItems: 'center' }}>
                                                                                                    {devoluciones.map((dev, dIdx) => (
                                                                                                        <span key={dIdx}>
                                                                                                            {dev.fecha || rem.fecha} {dev.cantidad ? `(${dev.cantidad})` : ''}
                                                                                                        </span>
                                                                                                    ))}
                                                                                                </div>
                                                                                            ) : cantDev > 0 ? (
                                                                                                <span>
                                                                                                    {rem.fecha} ({cantDev})
                                                                                                </span>
                                                                                            ) : (
                                                                                                <span style={{ color: '#94a3b8' }}>—</span>
                                                                                            )}
                                                                                        </td>
                                                                                        <td style={{ padding: '0.55rem 1rem', textAlign: 'right', color: '#475569', fontWeight: 600 }}>
                                                                                            ${tarifa.toLocaleString()}
                                                                                        </td>
                                                                                        <td style={{ padding: '0.55rem 1rem', textAlign: 'right', color: '#0f172a', fontWeight: 800 }}>
                                                                                            ${vHoy.toLocaleString()}
                                                                                        </td>
                                                                                    </tr>
                                                                                );
                                                                            })
                                                                        )}
                                                                    </tbody>
                                                                </table>

                                                                {rem.notas && (
                                                                    <div style={{ fontSize: '0.75rem', color: '#64748b', fontStyle: 'italic', background: '#f8fafc', padding: '0.55rem 1rem', borderTop: '1px solid #f1f5f9' }}>
                                                                        <strong>Notas:</strong> {rem.notas}
                                                                    </div>
                                                                )}
                                                            </div>
                                                        );
                                                    })()}
                                                </div>
                                            );
                                        })}
                                    </div>
                                )}
                            </>)}

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

            {showObraModal && <ObraModal initialData={editingObra} onSave={obra => { if(editingObra) { onEditObra(client.id, editingObra.id, obra); } else { onAddObra(client.id, obra); } setShowObraModal(false); setEditingObra(null); }} onClose={() => { setShowObraModal(false); setEditingObra(null); }} />}
            
            {showRemisionModal && (
                <NuevaRemisionModal 
                    initialClientId={client.id}
                    onClose={() => setShowRemisionModal(false)}
                    onSave={addRemision}
                    clients={[client]}
                    products={products}
                    maintenances={maintenances}
                    settings={settings}
                />
            )}

            {editingRemisionTarget && (
                <EditRemisionModal
                    remision={editingRemisionTarget}
                    onClose={() => setEditingRemisionTarget(null)}
                    onSave={editRemision}
                    products={products}
                    clients={[client]}
                />
            )}



            <style>{`
                @keyframes cdFadeIn {
                    from { opacity:0; transform:scale(0.97); }
                    to   { opacity:1; transform:scale(1); }
                }
                .obra-card {
                    padding: 0;
                    border: 1px solid #e2e8f0;
                    border-radius: 12px;
                    background: #ffffff;
                    box-shadow: 0 4px 15px rgba(0, 0, 0, 0.05);
                    transition: all 0.25s ease-out;
                    overflow: hidden;
                }
                .obra-card:hover {
                    box-shadow: 0 10px 25px rgba(0, 0, 0, 0.12);
                    transform: translateY(-2px);
                }
                .obra-edit-btn-solid {
                    background: rgba(255,255,255,0.15);
                    border: 1px solid rgba(255,255,255,0.1);
                    color: #ffffff;
                    cursor: pointer;
                    padding: 5px;
                    border-radius: 6px;
                    transition: all 0.2s;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                }
                .obra-edit-btn-solid:hover {
                    background: rgba(255,255,255,0.3);
                }
            `}</style>
        </>
    );
}

// ─── MAIN COMPONENT ───────────────────────────────────────────────────────────
export default function Clients() {
    const { 
        clients, addClient, editClient, deleteClient, addObra, editObra,
        invoices, products, addProduct, editProduct, deleteProduct, remisiones, addRemision, editRemision, maintenances, settings, checkPassword,
        providers, addProvider, editProvider, deleteProvider
    } = useAppContext();

    const [activeTab, setActiveTab] = useState('clientes'); // 'clientes' | 'proveedores'
    const [search, setSearch] = useState('');
    const [filterDeuda, setFilterDeuda] = useState('Todos');
    const [filterRegimen, setFilterRegimen] = useState('Todos');
    const [showModal, setShowModal] = useState(false);
    const [editingClient, setEditingClient] = useState(null);
    const [selectedClient, setSelectedClient] = useState(null);
    const [deletingClient, setDeletingClient] = useState(null);

    // Proveedores States
    const [showProviderModal, setShowProviderModal] = useState(false);
    const [editingProvider, setEditingProvider] = useState(null);
    const [deletingProvider, setDeletingProvider] = useState(null);
    const [providerForInventory, setProviderForInventory] = useState(null);
    const [providerSortConfig, setProviderSortConfig] = useState({ key: 'id', direction: 'desc' });
    const [providerCurrentPage, setProviderCurrentPage] = useState(1);
    const [providerItemsPerPage, setProviderItemsPerPage] = useState(10);

    useEffect(() => {
        const h1 = () => setShowModal(true);
        const h2 = () => setShowProviderModal(true);
        window.addEventListener('trigger-new-client', h1);
        window.addEventListener('trigger-new-provider', h2);
        return () => {
            window.removeEventListener('trigger-new-client', h1);
            window.removeEventListener('trigger-new-provider', h2);
        };
    }, []);

    const [sortConfig, setSortConfig] = useState({ key: 'id', direction: 'desc' });

    const handleSort = (key) => {
        let direction = 'asc';
        if (sortConfig.key === key && sortConfig.direction === 'asc') direction = 'desc';
        setSortConfig({ key, direction });
    };

    const handleProviderSort = (key) => {
        let direction = 'asc';
        if (providerSortConfig.key === key && providerSortConfig.direction === 'asc') direction = 'desc';
        setProviderSortConfig({ key, direction });
    };

    // Search + filter + Sort (Clients)
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

    // Search + filter + Sort (Providers)
    const sortedProviders = useMemo(() => {
        const filtered = (providers || []).filter(p => {
            const q = search.toLowerCase();
            return (p.name || '').toLowerCase().includes(q) || 
                   (p.nit || '').toLowerCase().includes(q) || 
                   (p.ciudad || '').toLowerCase().includes(q);
        });

        if (providerSortConfig.key) {
            filtered.sort((a, b) => {
                let aVal = a[providerSortConfig.key] || '';
                let bVal = b[providerSortConfig.key] || '';
                
                if (typeof aVal === 'string') aVal = aVal.toLowerCase();
                if (typeof bVal === 'string') bVal = bVal.toLowerCase();

                if (aVal < bVal) return providerSortConfig.direction === 'asc' ? -1 : 1;
                if (aVal > bVal) return providerSortConfig.direction === 'asc' ? 1 : -1;
                return 0;
            });
        }
        return filtered;
    }, [providers, search, providerSortConfig]);

    // Pagination (Clients)
    const [currentPage, setCurrentPage] = useState(1);
    const [itemsPerPage, setItemsPerPage] = useState(10);

    const paginatedClients = useMemo(() => {
        const start = (currentPage - 1) * itemsPerPage;
        return sorted.slice(start, start + itemsPerPage);
    }, [sorted, currentPage, itemsPerPage]);

    const totalPages = Math.ceil(sorted.length / itemsPerPage);

    // Pagination (Providers)
    const paginatedProviders = useMemo(() => {
        const start = (providerCurrentPage - 1) * providerItemsPerPage;
        return sortedProviders.slice(start, start + providerItemsPerPage);
    }, [sortedProviders, providerCurrentPage, providerItemsPerPage]);

    const providerTotalPages = Math.ceil(sortedProviders.length / providerItemsPerPage);

    // KPIs (Clients)
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

    const handleDelete = async (password, setError) => {
        const isValid = await checkPassword(password);
        if (isValid) {
            deleteClient(deletingClient.id);
            setDeletingClient(null);
            if (selectedClient?.id === deletingClient.id) setSelectedClient(null);
        } else {
            setError('La contraseña es incorrecta. Por favor verifique.');
        }
    };

    // Proveedores Handlers
    const handleProviderSaveNew = (form) => {
        addProvider(form);
        setShowProviderModal(false);
    };

    const handleProviderSaveEdit = (form) => {
        editProvider(editingProvider.id, form);
        setEditingProvider(null);
    };

    const handleProviderDelete = async (password, setError) => {
        const isValid = await checkPassword(password);
        if (isValid) {
            deleteProvider(deletingProvider.id);
            setDeletingProvider(null);
        } else {
            setError('La contraseña es incorrecta. Por favor verifique.');
        }
    };

    return (
        <>
            <div style={{ display: 'flex', flexDirection: 'column', minHeight: 'calc(100vh - 120px)' }}>
                {/* Pestañas de Selección */}
                <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center', marginBottom: '1.25rem', borderBottom: '1px solid var(--surface-border)', paddingBottom: '0.75rem' }}>
                    <button
                        onClick={() => { setActiveTab('clientes'); setSearch(''); }}
                        style={{
                            padding: '0.5rem 1rem',
                            borderRadius: 8,
                            border: 'none',
                            background: activeTab === 'clientes' ? '#2365AB' : 'transparent',
                            color: activeTab === 'clientes' ? '#ffffff' : '#64748b',
                            fontWeight: 700,
                            fontSize: '0.875rem',
                            cursor: 'pointer',
                            transition: 'all 0.2s',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '0.5rem'
                        }}
                    >
                        👥 Clientes ({clients.length})
                    </button>

                    <button
                        onClick={() => { setActiveTab('proveedores'); setSearch(''); }}
                        style={{
                            padding: '0.5rem 1rem',
                            borderRadius: 8,
                            border: 'none',
                            background: activeTab === 'proveedores' ? '#2365AB' : 'transparent',
                            color: activeTab === 'proveedores' ? '#ffffff' : '#64748b',
                            fontWeight: 700,
                            fontSize: '0.875rem',
                            cursor: 'pointer',
                            transition: 'all 0.2s',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '0.5rem'
                        }}
                    >
                        🤝 Proveedores (Terceros) ({providers.length})
                    </button>
                </div>

                {/* Filters Section */}
                <div className="glass-panel p-4 mb-6">
                    <div style={{ position: 'relative', width: '100%' }}>
                        <Search size={20} style={{ position: 'absolute', left: '16px', top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }} />
                        <input 
                            type="text" 
                            placeholder={activeTab === 'clientes' ? "Buscar por nombre, NIT o ciudad..." : "Buscar proveedor por nombre, NIT o ciudad..."} 
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
                        {activeTab === 'clientes' ? (
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
                        ) : (
                            <table className="glass-table" style={{ width: '100%' }}>
                                <thead>
                                    <tr style={{ borderBottom: '1px solid var(--surface-border)' }}>
                                        {[
                                            { label: 'Proveedor / Razón Social', key: 'name', w: '200px' },
                                            { label: 'NIT', key: 'nit', w: '100px' },
                                            { label: 'Contacto Principal', key: 'contactoPrincipal', w: '150px' },
                                            { label: 'Teléfono', key: 'phone', w: '100px' },
                                            { label: 'Correo', key: 'email', w: '180px' },
                                            { label: 'Ciudad', key: 'ciudad', w: '100px' },
                                            { label: 'Acciones', key: null, w: '130px' }
                                        ].map(({ label, key, w }) => (
                                            <th 
                                                key={label} 
                                                onClick={() => key && handleProviderSort(key)}
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
                                                        {key && providerSortConfig.key === key ? (
                                                            providerSortConfig.direction === 'asc' ? <ChevronUp size={12} /> : <ChevronDown size={12} />
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
                                    {paginatedProviders.map(provider => (
                                        <tr key={provider.id}
                                            className="table-row-hover"
                                            style={{ borderBottom: '1px solid var(--surface-border)', cursor: 'pointer', transition: 'background 0.15s' }}
                                            onClick={() => setProviderForInventory(provider)}
                                        >
                                            <td>
                                                <div style={{ fontWeight: 700, fontSize: '0.875rem' }}>{provider.name}</div>
                                            </td>
                                            <td>
                                                <div style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-primary)' }}>{provider.nit || '—'}</div>
                                            </td>
                                            <td>
                                                <div style={{ fontSize: '0.85rem', color: 'var(--text-primary)' }}>{provider.contactoPrincipal || '—'}</div>
                                            </td>
                                            <td>
                                                <div style={{ fontSize: '0.85rem', color: 'var(--text-primary)' }}>{provider.phone || '—'}</div>
                                            </td>
                                            <td>
                                                <div style={{ fontSize: '0.85rem', color: 'var(--text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{provider.email || '—'}</div>
                                            </td>
                                            <td>
                                                <div style={{ fontSize: '0.85rem', color: 'var(--text-primary)' }}>{provider.ciudad || '—'}</div>
                                            </td>
                                            <td>
                                                <div style={{ display: 'flex', gap: '0.4rem' }} onClick={e => e.stopPropagation()}>
                                                    <button className="btn btn-secondary btn-sm" onClick={() => setEditingProvider(provider)}
                                                        style={{ fontSize: '0.75rem', padding: '0.35rem 0.65rem', display: 'flex', alignItems: 'center', gap: 4 }}>
                                                        <Edit3 size={13} /> Editar
                                                    </button>
                                                    <button 
                                                        className="btn btn-secondary btn-sm" 
                                                        onClick={() => setDeletingProvider(provider)}
                                                        style={{ fontSize: '0.75rem', padding: '0.35rem 0.65rem', display: 'flex', alignItems: 'center', gap: 4, color: '#ef4444', borderColor: 'rgba(239,68,68,0.2)' }}
                                                    >
                                                        <Trash2 size={13} /> Borrar
                                                    </button>
                                                </div>
                                            </td>
                                        </tr>
                                    ))}
                                    {sortedProviders.length === 0 && (
                                        <tr><td colSpan={8} style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-muted)' }}>No se encontraron proveedores</td></tr>
                                    )}
                                </tbody>
                            </table>
                        )}
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
                                    value={activeTab === 'clientes' ? itemsPerPage : providerItemsPerPage} 
                                    onChange={e => { 
                                        if (activeTab === 'clientes') {
                                            setItemsPerPage(Number(e.target.value)); 
                                            setCurrentPage(1); 
                                        } else {
                                            setProviderItemsPerPage(Number(e.target.value));
                                            setProviderCurrentPage(1);
                                        }
                                    }}
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
                            {activeTab === 'clientes' ? (
                                `Mostrando ${sorted.length > 0 ? (currentPage - 1) * itemsPerPage + 1 : 0} a ${Math.min(currentPage * itemsPerPage, sorted.length)} de ${sorted.length} registros`
                            ) : (
                                `Mostrando ${sortedProviders.length > 0 ? (providerCurrentPage - 1) * providerItemsPerPage + 1 : 0} a ${Math.min(providerCurrentPage * providerItemsPerPage, sortedProviders.length)} de ${sortedProviders.length} registros`
                            )}
                        </div>
                    </div>

                    <div className="flex items-center gap-2">
                        <button 
                            className="btn btn-secondary btn-sm p-2" 
                            disabled={activeTab === 'clientes' ? currentPage === 1 : providerCurrentPage === 1}
                            onClick={() => activeTab === 'clientes' ? setCurrentPage(1) : setProviderCurrentPage(1)}
                            title="Primera página"
                        >
                            <ChevronsLeft size={16} />
                        </button>
                        <button 
                            className="btn btn-secondary btn-sm p-2" 
                            disabled={activeTab === 'clientes' ? currentPage === 1 : providerCurrentPage === 1}
                            onClick={() => activeTab === 'clientes' ? setCurrentPage(prev => prev - 1) : setProviderCurrentPage(prev => prev - 1)}
                            title="Página anterior"
                        >
                            <ChevronLeft size={16} />
                        </button>
                        
                        <div className="flex items-center gap-1">
                            {Array.from({ length: Math.min(5, activeTab === 'clientes' ? totalPages : providerTotalPages) }, (_, i) => {
                                const currentT = activeTab === 'clientes' ? totalPages : providerTotalPages;
                                const currentP = activeTab === 'clientes' ? currentPage : providerCurrentPage;
                                let pageNum;
                                if (currentT <= 5) pageNum = i + 1;
                                else if (currentP <= 3) pageNum = i + 1;
                                else if (currentP >= currentT - 2) pageNum = currentT - 4 + i;
                                else pageNum = currentP - 2 + i;
                                
                                return (
                                    <button 
                                        key={pageNum}
                                        onClick={() => activeTab === 'clientes' ? setCurrentPage(pageNum) : setProviderCurrentPage(pageNum)}
                                        className={`btn btn-sm ${(activeTab === 'clientes' ? currentPage : providerCurrentPage) === pageNum ? 'btn-primary' : 'btn-secondary'}`}
                                        style={{ 
                                            minWidth: '32px', 
                                            height: '32px', 
                                            padding: 0,
                                            boxShadow: (activeTab === 'clientes' ? currentPage : providerCurrentPage) === pageNum ? '0 4px 12px rgba(35, 101, 171, 0.3)' : 'none'
                                        }}
                                    >
                                        {pageNum}
                                    </button>
                                );
                            })}
                        </div>

                        <button 
                            className="btn btn-secondary btn-sm p-2" 
                            disabled={activeTab === 'clientes' ? (currentPage === totalPages || totalPages === 0) : (providerCurrentPage === providerTotalPages || providerTotalPages === 0)}
                            onClick={() => activeTab === 'clientes' ? setCurrentPage(prev => prev + 1) : setProviderCurrentPage(prev => prev + 1)}
                            title="Siguiente página"
                        >
                            <ChevronRight size={16} />
                        </button>
                        <button 
                            className="btn btn-secondary btn-sm p-2" 
                            disabled={activeTab === 'clientes' ? (currentPage === totalPages || totalPages === 0) : (providerCurrentPage === providerTotalPages || providerTotalPages === 0)}
                            onClick={() => activeTab === 'clientes' ? setCurrentPage(totalPages) : setProviderCurrentPage(providerTotalPages)}
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

            {/* Provider Modals */}
            {showProviderModal && <ProviderModal onSave={handleProviderSaveNew} onClose={() => setShowProviderModal(false)} />}
            {editingProvider && <ProviderModal initial={editingProvider} isEdit onSave={handleProviderSaveEdit} onClose={() => setEditingProvider(null)} />}
            {deletingProvider && <DeleteProviderModal provider={deletingProvider} onClose={() => setDeletingProvider(null)} onConfirm={handleProviderDelete} />}
            {providerForInventory && (
                <ProviderInventoryModal 
                    provider={providerForInventory}
                    products={products}
                    addProduct={addProduct}
                    editProduct={editProduct}
                    deleteProduct={deleteProduct}
                    onClose={() => setProviderForInventory(null)}
                />
            )}

            {/* Ficha lateral */}
            {selectedClient && (
                <ClientDetail
                    client={clients.find(c => c.id === selectedClient.id) || selectedClient}
                    onClose={() => setSelectedClient(null)}
                    onEdit={handleEdit}
                    onAddObra={addObra}
                    onEditObra={editObra}
                    invoices={invoices}
                    products={products}
                    remisiones={remisiones}
                    addRemision={addRemision}
                    editRemision={editRemision}
                    maintenances={maintenances}
                    settings={settings}
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
