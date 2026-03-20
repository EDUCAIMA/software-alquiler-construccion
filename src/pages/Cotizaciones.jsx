import React, { useState, useMemo } from 'react';
import {
    FilePlus, Search, CheckCircle, XCircle, Clock, Send,
    X, FileText, Shield, Download, Copy, Share2,
    PenTool, Fingerprint, MapPin, ChevronRight, Upload, Eye,
    Plus, List, Edit2,
    ChevronLeft, ChevronsLeft, ChevronsRight, ChevronDown
} from 'lucide-react';
import { useAppContext } from '../context/AppContext';
import { format } from 'date-fns';
import {
    generateCotizacionPDF, generateContratoPDF, generatePagarePDF, generateCartaPDF,
    SignatureCanvas, WebcamCapture, HabeasDataModal,
    ESTADO_CFG, fmtCOP
} from './CotizacionesHelpers';
import NuevaCotizacionModal from './NuevaCotizacionModal';

// ─── Error Boundary para el modal de nueva cotización ────────────────────────
class ModalErrorBoundary extends React.Component {
    constructor(props) {
        super(props);
        this.state = { hasError: false, error: null };
    }
    static getDerivedStateFromError(error) {
        return { hasError: true, error };
    }
    componentDidCatch(error, info) {
        console.error('❌ Error en NuevaCotizacionModal:', error, info);
    }
    render() {
        if (this.state.hasError) {
            return (
                <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
                    <div style={{ background: 'white', padding: '2rem', borderRadius: 12, maxWidth: 500, width: '90%' }}>
                        <h3 style={{ color: '#ef4444', marginBottom: '1rem' }}>⚠️ Error al cargar el formulario</h3>
                        <pre style={{ background: '#f8fafc', padding: '1rem', borderRadius: 8, fontSize: '0.75rem', overflow: 'auto', maxHeight: 200, color: '#dc2626' }}>
                            {this.state.error?.message || String(this.state.error)}
                        </pre>
                        <button onClick={() => { this.setState({ hasError: false, error: null }); this.props.onClose?.(); }}
                            style={{ marginTop: '1rem', padding: '0.5rem 1.5rem', background: '#2365AB', color: 'white', border: 'none', borderRadius: 8, cursor: 'pointer', fontWeight: 700 }}>
                            Cerrar
                        </button>
                    </div>
                </div>
            );
        }
        return this.props.children;
    }
}

// ─── Approval Modal ───────────────────────────────────────────────────────────
// ─── Approval Modal ───────────────────────────────────────────────────────────
// ─── Approval Modal ───────────────────────────────────────────────────────────
// ─── Approval Modal ───────────────────────────────────────────────────────────
function ApprovalModal({ cot, client, obra, onClose, onApprove }) {
    const [mode, setMode] = useState(null); // 'internal', 'external'
    const [file, setFile] = useState(null);
    const [fileName, setFileName] = useState('');
    const [notes, setNotes] = useState('');
    const [loading, setLoading] = useState(false);
    const [copied, setCopied] = useState(false);

    const shareLink = `${window.location.origin}/public/cotizacion/${cot.id}`;

    const handleFileChange = (e) => {
        const f = e.target.files[0];
        if (!f) return;
        setFileName(f.name);
        const reader = new FileReader();
        reader.onload = (event) => setFile(event.target.result);
        reader.readAsDataURL(f);
    };

    const handleConfirmInternal = () => {
        setLoading(true);
        onApprove({ firma: file, notas: notes || cot.notes });
        onClose();
    };

    const handleCopy = () => {
        navigator.clipboard.writeText(shareLink);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    const handleWhatsApp = () => {
        const text = encodeURIComponent(`Hola, le adjunto el link para revisar y aprobar su cotización #${cot.id}: ${shareLink}`);
        window.open(`https://wa.me/?text=${text}`, '_blank');
    };

    return (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.85)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '1rem' }}>
            <div className="glass-panel" style={{ padding: 0, width: '100%', maxWidth: mode ? 500 : 600, overflow: 'hidden', boxShadow: '0 25px 50px -12px rgba(0,0,0,0.5)', background: 'white', transition: 'all 0.3s ease' }}>
                
                {/* Header */}
                <div style={{ background: 'linear-gradient(135deg,#104166,#2365AB)', padding: '1.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div>
                        <div style={{ fontWeight: 800, color: 'white', fontSize: '1.2rem', letterSpacing: '-0.02em' }}>
                            {mode === 'internal' ? 'Aprobación Administrativa' : mode === 'external' ? 'Enviar Link de Aprobación' : 'Seleccionar Método de Aprobación'}
                        </div>
                        <div style={{ fontSize: '0.8rem', color: 'rgba(255,255,255,0.8)', marginTop: 2, fontWeight: 500 }}>Cotización #{cot.id} · {client?.name}</div>
                    </div>
                    <button onClick={onClose} style={{ background: 'rgba(255,255,255,0.15)', border: 'none', borderRadius: '50%', width: 34, height: 34, color: 'white', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><X size={20} /></button>
                </div>

                <div style={{ padding: '2rem' }}>
                    
                    {!mode && (
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem' }}>
                            <div className="select-card" onClick={() => setMode('external')} style={{ border: '2px solid #f1f5f9', borderRadius: 16, padding: '1.5rem', textAlign: 'center', cursor: 'pointer', transition: 'all 0.2s' }}>
                                <div style={{ background: '#e0f2fe', width: 60, height: 60, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 1rem' }}>
                                    <Send size={28} color="#2365AB" />
                                </div>
                                <h4 style={{ margin: '0 0 0.5rem', color: '#1e293b' }}>Por el Cliente</h4>
                                <p style={{ fontSize: '0.75rem', color: '#64748b', margin: 0 }}>Envía un link para que el cliente firme desde su celular.</p>
                            </div>

                            <div className="select-card" onClick={() => setMode('internal')} style={{ border: '2px solid #f1f5f9', borderRadius: 16, padding: '1.5rem', textAlign: 'center', cursor: 'pointer', transition: 'all 0.2s' }}>
                                <div style={{ background: '#dcfce7', width: 60, height: 60, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 1rem' }}>
                                    <Shield size={28} color="#10b981" />
                                </div>
                                <h4 style={{ margin: '0 0 0.5rem', color: '#1e293b' }}>Interna / Manual</h4>
                                <p style={{ fontSize: '0.75rem', color: '#64748b', margin: 0 }}>Carga un soporte o registra una nota administrativa.</p>
                            </div>
                            <style>{`
                                .select-card:hover { border-color: #2365AB !important; background: #f8fafc; transform: translateY(-4px); box-shadow: 0 10px 20px rgba(0,0,0,0.05); }
                            `}</style>
                        </div>
                    )}

                    {mode === 'external' && (
                        <div style={{ textAlign: 'center' }}>
                            <p style={{ fontSize: '0.9rem', color: '#64748b', marginBottom: '1.5rem' }}>Copie el siguiente enlace y envíelo al cliente por WhatsApp o correo para que pueda realizar la aprobación digital.</p>
                            <div style={{ background: '#f1f5f9', padding: '0.75rem 1rem', borderRadius: 10, display: 'flex', alignItems: 'center', gap: 10, border: '1px solid #e2e8f0', marginBottom: '1.5rem' }}>
                                <div style={{ flex: 1, fontSize: '0.75rem', color: '#475569', textAlign: 'left', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{shareLink}</div>
                                <button onClick={handleCopy} style={{ background: 'white', border: '1px solid #cbd5e1', padding: '0.4rem 0.8rem', borderRadius: 6, cursor: 'pointer', fontSize: '0.75rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: 4 }}>
                                    {copied ? <><CheckCircle size={14} color="#10b981" /> Copiado</> : <><Copy size={14} /> Copiar</>}
                                </button>
                            </div>
                            <div style={{ display: 'flex', gap: '1rem' }}>
                                <button onClick={() => setMode(null)} className="btn btn-secondary" style={{ flex: 1 }}>Volver</button>
                                <button onClick={handleWhatsApp} className="btn btn-primary" style={{ flex: 2, background: '#25D366', border: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, color: 'white', fontWeight: 700 }}>
                                    <Share2 size={18} /> Enviar por WhatsApp
                                </button>
                            </div>
                        </div>
                    )}

                    {mode === 'internal' && (
                        <>
                            <div style={{ marginBottom: '1.5rem' }}>
                                <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 800, color: '#104166', marginBottom: '0.6rem', textTransform: 'uppercase' }}>Soporte de Aprobación (Opcional)</label>
                                <div style={{ position: 'relative', border: '2px dashed #cbd5e1', borderRadius: 14, padding: '1.5rem', textAlign: 'center', background: '#f1f5f9', cursor: 'pointer' }} 
                                     onClick={() => document.getElementById('support-file').click()}>
                                    <input id="support-file" type="file" hidden accept=".pdf,image/*" onChange={handleFileChange} />
                                    {fileName ? 
                                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10 }}>
                                            <FileText size={20} color="#10b981" />
                                            <span style={{ fontSize: '0.85rem', fontWeight: 700 }}>{fileName}</span>
                                        </div> :
                                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, fontSize: '0.8rem', color: '#64748b' }}><Upload size={18} /> Subir PDF o Imagen</div>
                                    }
                                </div>
                            </div>
                            <div style={{ marginBottom: '1.5rem' }}>
                                <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 800, color: '#104166', marginBottom: '0.6rem', textTransform: 'uppercase' }}>Notas / Motivo</label>
                                <textarea value={notes} onChange={e => setNotes(e.target.value)} placeholder="Ej: Aprobado según correo..." style={{ width: '100%', padding: '0.75rem', borderRadius: 12, border: '1px solid #cbd5e1', color: '#000', fontSize: '0.9rem', minHeight: 90, boxSizing: 'border-box' }} />
                            </div>
                            <div style={{ display: 'flex', gap: '1rem' }}>
                                <button onClick={() => setMode(null)} className="btn btn-secondary" style={{ flex: 1 }}>Volver</button>
                                <button onClick={handleConfirmInternal} disabled={loading} className="btn btn-primary" style={{ flex: 2, background: 'linear-gradient(135deg,#2365AB,#104166)', border: 'none', color: 'white' }}>
                                    {loading ? 'Procesando...' : 'Confirmar Aprobación'}
                                </button>
                            </div>
                        </>
                    )}
                </div>
            </div>
        </div>
    );
}

function ShareModal({ cotId, onClose }) {
    const shareLink = `${window.location.origin}/public/cotizacion/${cotId}`;
    const [copied, setCopied] = useState(false);

    const handleCopy = () => {
        navigator.clipboard.writeText(shareLink);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    const handleWhatsApp = () => {
        const text = encodeURIComponent(`Hola, le adjunto el link para revisar y aprobar su cotización #${cotId}: ${shareLink}`);
        window.open(`https://wa.me/?text=${text}`, '_blank');
    };

    return (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.8)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1200, padding: '1rem' }}>
            <div className="glass-panel" style={{ maxWidth: 450, width: '100%', padding: '1.5rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
                    <h3 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: 8 }}><Share2 size={20} color="#2365AB" /> Compartir Cotización</h3>
                    <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)' }}><X size={20} /></button>
                </div>
                
                <p style={{ fontSize: '0.875rem', color: 'var(--text-muted)', marginBottom: '1rem' }}>Envíe este enlace a su cliente para que pueda revisar, firmar y aprobar la cotización desde su celular o computador.</p>
                
                <div style={{ background: 'rgba(255,255,255,0.1)', border: '1px solid var(--surface-border)', borderRadius: 10, padding: '0.75rem', marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: 10 }}>
                    <input readOnly value={shareLink} style={{ flex: 1, background: 'none', border: 'none', color: '#2365AB', fontSize: '0.8rem', fontWeight: 600, outline: 'none' }} />
                    <button onClick={handleCopy} style={{ background: copied ? '#10b981' : '#2365AB', color: 'white', border: 'none', borderRadius: 6, padding: '0.4rem 0.8rem', fontSize: '0.75rem', fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4 }}>
                        {copied ? <CheckCircle size={14} /> : <Copy size={14} />} {copied ? 'Copiado' : 'Copiar'}
                    </button>
                </div>

                <div style={{ display: 'flex', gap: '0.75rem' }}>
                    <button onClick={handleWhatsApp} style={{ flex: 1, padding: '0.75rem', borderRadius: 10, background: '#25D366', color: 'white', border: 'none', fontWeight: 800, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
                        WhatsApp
                    </button>
                    <button onClick={onClose} style={{ flex: 1, padding: '0.75rem', borderRadius: 10, background: 'white', border: '1px solid #cbd5e1', color: '#64748b', fontWeight: 700, cursor: 'pointer' }}>
                        Cerrar
                    </button>
                </div>
            </div>
        </div>
    );
}

function ContratoEditorModal({ cot, onClose, onSave }) {
    const [clausulas, setClausulas] = useState(cot.clausulas && cot.clausulas.length > 0 ? [...cot.clausulas] : [
        '1. El ARRENDATARIO se compromete a utilizar los equipos únicamente en la obra indicada y a devolverlos en perfectas condiciones de funcionamiento.',
        '2. Cualquier daño, pérdida o robo de los equipos será de responsabilidad exclusiva del ARRENDATARIO.',
        '3. Los días de alquiler se calculan desde la fecha indicada en cada remisión hasta su correspondiente devolución (lógica PEPS).',
        '4. El incumplimiento en el pago generará intereses de mora del 1.5% mensual sobre el saldo pendiente.',
        '5. Este contrato se rige por las leyes colombianas. Las partes se someten a los jueces competentes de la ciudad de Bogotá D.C.',
        '6. Forma de pago: ' + (cot.metodoPago || 'Acordada entre las partes.'),
        '7. Transporte: ' + (cot.responsableTransporte || 'Acordado entre las partes.'),
    ]);
    
    const handleAdd = () => setClausulas([...clausulas, '']);
    const handleRemove = (idx) => setClausulas(clausulas.filter((_, i) => i !== idx));
    const handleChange = (idx, val) => {
        const next = [...clausulas];
        next[idx] = val;
        setClausulas(next);
    };

    return (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.8)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1100, padding: '1.5rem' }}>
            <div className="glass-panel" style={{ maxWidth: 700, width: '100%', maxHeight: '90vh', display: 'flex', flexDirection: 'column', background: 'white', padding: 0, overflow: 'hidden' }}>
                <div style={{ background: 'linear-gradient(135deg,#104166,#2365AB)', padding: '1.25rem 1.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div>
                        <h3 style={{ color: 'white', margin: 0, display: 'flex', alignItems: 'center', gap: 8 }}><Edit2 size={20} /> Editar Cláusulas del Contrato</h3>
                        <p style={{ color: 'rgba(255,255,255,0.7)', fontSize: '0.75rem', margin: '4px 0 0', fontWeight: 500 }}>Personalice los términos legales para {cot.id}</p>
                    </div>
                    <button onClick={onClose} style={{ background: 'none', border: 'none', color: 'white', cursor: 'pointer' }}><X size={20} /></button>
                </div>
                
                <div style={{ padding: '1.5rem', overflowY: 'auto', flex: 1, background: '#f8fafc' }}>
                    {clausulas.map((c, idx) => (
                        <div key={idx} style={{ display: 'flex', gap: '0.75rem', marginBottom: '1rem', alignItems: 'flex-start' }}>
                            <div style={{ background: '#2365AB', width: 28, height: 28, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.75rem', fontWeight: 800, color: 'white', flexShrink: 0, marginTop: 6, boxShadow: '0 2px 5px rgba(35,101,171,0.3)' }}>{idx + 1}</div>
                            <textarea 
                                value={c} 
                                onChange={(e) => handleChange(idx, e.target.value)}
                                style={{ flex: 1, padding: '0.85rem', borderRadius: 10, border: '1px solid #cbd5e1', fontSize: '0.875rem', minHeight: 80, fontFamily: 'inherit', color: '#334155', boxShadow: 'inset 0 2px 4px rgba(0,0,0,0.02)' }}
                            />
                            <button onClick={() => handleRemove(idx)} style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer', marginTop: 10, padding: 4 }}><XCircle size={18} /></button>
                        </div>
                    ))}
                    <button onClick={handleAdd} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '0.75rem', border: '2px dashed #cbd5e1', borderRadius: 10, background: 'white', color: '#64748b', fontWeight: 700, cursor: 'pointer', width: '100%', justifyContent: 'center', transition: 'all 0.2s' }}>
                        <Plus size={18} /> Agregar Nueva Cláusula
                    </button>
                    <style>{`button:hover { filter: brightness(0.95); }`}</style>
                </div>

                <div style={{ padding: '1.25rem 1.5rem', borderTop: '1px solid #e2e8f0', display: 'flex', gap: '1rem', justifyContent: 'flex-end', background: 'white' }}>
                    <button onClick={onClose} className="btn btn-secondary" style={{ padding: '0.6rem 1.5rem' }}>Cancelar</button>
                    <button onClick={() => { onSave(clausulas); onClose(); }} className="btn btn-primary" style={{ background: '#10b981', color: 'white', border: 'none', padding: '0.6rem 2rem', boxShadow: '0 4px 12px rgba(16,185,129,0.35)' }}>Guardar Cambios</button>
                </div>
            </div>
        </div>
    );
}


// ─── Detail Panel ─────────────────────────────────────────────────────────────
function CotDetailPanel({ cot, client, obra, settings, onClose, onUpdateEstado, onOpenApproval, onFacturar, onSendLink, onEditContrato, onEdit }) {
    const cfg = ESTADO_CFG[cot.estado] || ESTADO_CFG['Borrador'];
    const subtotal = cot.items.reduce((s, i) => s + (i.cantidad * i.dias * i.tarifaDia), 0);
    const iva = client?.responsableIVA ? Math.round(subtotal * (client?.porcIVA || 0) / 100) : 0;
    const ret = Math.round(subtotal * (client?.porcRetencion || 0) / 100);
    const total = subtotal + iva + ret + (cot.transporte || 0);

    return (
        <>
            <div style={{ position: 'fixed', right: 0, top: 0, bottom: 0, width: 520, zIndex: 900, background: 'var(--glass-bg)', backdropFilter: 'blur(20px)', display: 'flex', flexDirection: 'column', boxShadow: '-6px 0 40px rgba(0,0,0,0.4)', overflowY: 'auto', overflowX: 'auto' }}>
                {/* Header */}
                <div style={{ background: 'linear-gradient(135deg,#104166,#154272)', padding: '1.5rem', flexShrink: 0 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                        <div>
                            <div style={{ fontSize: '0.65rem', color: 'rgba(255,255,255,0.6)', fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase' }}>{settings?.shortName || 'CIELO'} — Cotización</div>
                            <div style={{ fontSize: '1.3rem', fontWeight: 900, color: 'white', fontFamily: 'monospace', marginTop: 4 }}>{cot.id}</div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 6 }}>
                                <span style={{ padding: '3px 10px', borderRadius: 999, background: cfg.bg, color: cfg.color, fontSize: '0.72rem', fontWeight: 700, border: `1px solid ${cfg.color}30` }}>{cot.estado}</span>
                                <span style={{ fontSize: '0.75rem', color: 'rgba(255,255,255,0.6)' }}>{cot.fecha}</span>
                            </div>
                        </div>
                        <button onClick={onClose} style={{ background: 'rgba(255,255,255,0.1)', border: '1px solid rgba(255,255,255,0.2)', borderRadius: 6, color: 'white', cursor: 'pointer', padding: '0.3rem', display: 'flex' }}><X size={18} /></button>
                    </div>
                    <div style={{ marginTop: '1rem', background: 'rgba(255,255,255,0.08)', borderRadius: 10, padding: '0.75rem 1rem' }}>
                        <div style={{ fontWeight: 700, color: 'white' }}>{client?.name}</div>
                        <div style={{ fontSize: '0.78rem', color: 'rgba(255,255,255,0.7)', marginTop: 2, display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                            <MapPin size={11} /> {obra?.nombre || cot.obraId}
                        </div>
                    </div>
                </div>

                {/* Body */}
                <div style={{ flex: 1, padding: '1.25rem', background: '#f8fafc', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                    {/* Items */}
                    <div style={{ background: 'white', border: '1px solid #e2e8f0', borderRadius: 10, overflow: 'hidden' }}>
                        <div style={{ background: '#f1f5f9', padding: '0.55rem 0.85rem', fontSize: '0.67rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Equipos</div>
                        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.83rem' }}>
                            <tbody>
                                {cot.items.map((i, idx) => (
                                    <tr key={idx} style={{ borderBottom: '1px solid #f1f5f9' }}>
                                        <td style={{ padding: '0.6rem 0.85rem', fontWeight: 600, color: '#104166' }}>{i.nombre}</td>
                                        <td style={{ padding: '0.6rem 0.85rem', color: '#64748b', fontSize: '0.78rem' }}>{i.cantidad} u. × {i.dias}d</td>
                                        <td style={{ padding: '0.6rem 0.85rem', fontWeight: 700, color: '#10b981', textAlign: 'right' }}>{fmtCOP(i.cantidad * i.dias * i.tarifaDia)}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>

                    {/* Totals */}
                    <div style={{ background: '#2365AB', borderRadius: 10, padding: '1rem 1.25rem' }}>
                        {[['Subtotal', fmtCOP(subtotal)], ['+ IVA', fmtCOP(iva)], ['+ Ret.', fmtCOP(ret)], ['+ Transporte', fmtCOP(cot.transporte || 0)]].map(([k, v]) => (
                            <div key={k} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', color: 'rgba(255,255,255,0.85)', marginBottom: 4 }}>
                                <span>{k}</span><span style={{ fontWeight: 700, color: 'white' }}>{v}</span>
                            </div>
                        ))}
                        <div style={{ borderTop: '1px solid rgba(255,255,255,0.3)', marginTop: 8, paddingTop: 8, display: 'flex', justifyContent: 'space-between' }}>
                            <span style={{ fontWeight: 800, color: 'white' }}>TOTAL</span>
                            <span style={{ fontWeight: 900, color: 'white', fontSize: '1.1rem' }}>{fmtCOP(total)}</span>
                        </div>
                    </div>

                    {/* Conditions */}
                    <div style={{ background: 'white', border: '1px solid #e2e8f0', borderRadius: 10, padding: '0.85rem 1rem' }}>
                        {[['Método Pago', cot.metodoPago], ['Responsable Transporte', cot.responsableTransporte], ['Plazo Entrega', cot.plazoEntrega], ['Validez', `${cot.validezDias} días`]].map(([k, v]) => (
                            <div key={k} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', padding: '0.3rem 0', borderBottom: '1px solid #f1f5f9' }}>
                                <span style={{ color: '#64748b' }}>{k}</span><span style={{ fontWeight: 600, color: '#104166' }}>{v}</span>
                            </div>
                        ))}
                    </div>

                    {/* Habeas Data status */}


                    {/* notas */}
                    {cot.notas && <div style={{ fontSize: '0.78rem', color: '#64748b', background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 8, padding: '0.65rem 0.85rem' }}>{cot.notas}</div>}

                    {/* Actions */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>

                        {/* Botón Imprimir Cotización — SIEMPRE visible */}
                        <button
                            onClick={() => generateCotizacionPDF(cot, client, obra, settings)}
                            style={{ width: '100%', padding: '0.65rem', borderRadius: 8, background: 'linear-gradient(135deg,#2365AB,#2563eb)', color: 'white', border: 'none', cursor: 'pointer', fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, boxShadow: '0 4px 12px rgba(35, 101, 171,0.35)' }}>
                            <Download size={15} /> Imprimir / PDF Cotización
                        </button>

                        {(cot.estado === 'Borrador' || cot.estado === 'Enviada') && (
                            <button onClick={onEdit} style={{ width: '100%', padding: '0.65rem', borderRadius: 8, background: '#f1f5f9', color: '#64748b', border: '1px solid #cbd5e1', cursor: 'pointer', fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
                                <Edit2 size={15} /> Editar Cotización
                            </button>
                        )}

                        {(cot.estado === 'Borrador' || cot.estado === 'Enviada') && (
                            <button onClick={() => onSendLink(cot.id)} style={{ width: '100%', padding: '0.65rem', borderRadius: 8, background: '#f97316', color: 'white', border: 'none', cursor: 'pointer', fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
                                <Send size={15} /> {cot.estado === 'Borrador' ? 'Generar Link y Marcar Enviada' : 'Compartir / Ver Link de Aprobación'}
                            </button>
                        )}
                        {(cot.estado === 'Borrador' || cot.estado === 'Enviada') && (
                            <button onClick={onOpenApproval} style={{ width: '100%', padding: '0.65rem', borderRadius: 8, background: '#10b981', color: 'white', border: 'none', cursor: 'pointer', fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
                                <CheckCircle size={15} /> Aprobar + Generar Documentos
                            </button>
                        )}
                        {(cot.estado === 'Borrador' || cot.estado === 'Enviada') && (
                            <button onClick={() => onUpdateEstado(cot.id, 'Rechazada')} style={{ width: '100%', padding: '0.6rem', borderRadius: 8, background: 'rgba(239,68,68,0.1)', color: '#ef4444', border: '1px solid rgba(239,68,68,0.3)', cursor: 'pointer', fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
                                <XCircle size={15} /> Rechazar
                            </button>
                        )}

                        {/* === BOTÓN PRINCIPAL: PASAR A FACTURACIÓN === */}
                        {cot.estado === 'Aprobada' && !cot.facturaId && (
                            <button onClick={onFacturar} style={{ width: '100%', padding: '0.8rem', borderRadius: 10, background: 'linear-gradient(135deg,#6366f1,#4f46e5)', color: 'white', border: 'none', cursor: 'pointer', fontWeight: 800, fontSize: '1rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, boxShadow: '0 6px 20px rgba(99,102,241,0.45)', letterSpacing: '0.02em' }}>
                                <FileText size={18} /> ➜ Pasar a Facturación
                            </button>
                        )}

                        {(cot.estado === 'Aprobada' || cot.estado === 'Facturada' || cot.estado === 'Enviada') && (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                                <p style={{ fontSize: '0.75rem', fontWeight: 700, color: '#10b981', textAlign: 'center' }}>Documentos Legales:</p>
                                {[
                                    ['Contrato de Alquiler', () => generateContratoPDF(cot, client, obra, settings)],
                                    ['Pagaré', () => generatePagarePDF(cot, client, settings)],
                                    ['Carta de Instrucciones', () => generateCartaPDF(cot, client, settings)]
                                ].map(([label, fn]) => (
                                    <div key={label} style={{ display: 'flex', gap: '0.5rem' }}>
                                        <button onClick={fn} style={{ flex: 1, padding: '0.6rem', borderRadius: 8, background: 'rgba(35, 101, 171,0.1)', color: '#2365AB', border: '1px solid rgba(35, 101, 171,0.25)', cursor: 'pointer', fontWeight: 700, fontSize: '0.82rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
                                            <Download size={14} /> {label}
                                        </button>
                                        {label === 'Contrato de Alquiler' && (
                                            <button onClick={onEditContrato} title="Editar Cláusulas" style={{ padding: '0.6rem', borderRadius: 8, background: '#f1f5f9', border: '1px solid #cbd5e1', cursor: 'pointer', display: 'flex', alignItems: 'center' }}>
                                                <Edit2 size={14} color="#64748b" />
                                            </button>
                                        )}
                                    </div>
                                ))}
                            </div>
                        )}
                        {cot.estado === 'Facturada' && (
                            <div style={{ background: 'rgba(99,102,241,0.08)', border: '1px solid rgba(99,102,241,0.3)', borderRadius: 10, padding: '0.85rem', textAlign: 'center' }}>
                                <div style={{ fontSize: '0.72rem', color: '#6366f1', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 4 }}>Factura Generada</div>
                                <div style={{ fontWeight: 800, color: '#6366f1', fontFamily: 'monospace', fontSize: '1rem' }}>{cot.facturaId}</div>
                                <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: 4 }}>Ver en Facturación para gestionar el pago</div>
                            </div>
                        )}
                    </div>

                    {/* Footer */}
                    <div style={{ borderTop: '1px dashed #cbd5e1', paddingTop: '0.75rem', textAlign: 'center', fontSize: '0.7rem', color: '#94a3b8' }}>
                        {settings?.shortName || 'CIELO'} · {cot.id} · Generado el {format(new Date(), 'dd/MM/yyyy')}
                    </div>
                </div>
            </div>
            <div style={{ position: 'fixed', inset: 0, zIndex: 899 }} onClick={onClose} />
        </>
    );
}

// ─── MAIN PAGE ────────────────────────────────────────────────────────────────
export default function Cotizaciones() {
    const { clients, products, cotizaciones, settings, addCotizacion, updateCotizacion, actualizarEstadoCotizacion, createInvoiceFromCotizacion } = useAppContext();
    const [search, setSearch] = useState('');
    const [filterE, setFilterE] = useState('Todos');
    const [showNew, setShowNew] = useState(false);
    const [selected, setSelected] = useState(null);
    const [approving, setApproving] = useState(null);
    const [sharing, setSharing] = useState(null);
    const [editingContrato, setEditingContrato] = useState(null);
    const [editing, setEditing] = useState(null);

    const handleSendQuote = (cotId) => {
        actualizarEstadoCotizacion(cotId, 'Enviada');
        setSharing(cotId);
    };

    const filtered = useMemo(() =>
        cotizaciones.filter(c => {
            const cl = clients.find(x => x.id === c.clientId);
            const q = search.toLowerCase();
            return (c.id.toLowerCase().includes(q) || cl?.name?.toLowerCase().includes(q)) &&
                (filterE === 'Todos' || c.estado === filterE);
        }).sort((a, b) => b.fecha.localeCompare(a.fecha))
        , [cotizaciones, search, filterE, clients]);

    const total = (c) => c.items.reduce((s, i) => s + (i.cantidad * i.dias * i.tarifaDia), 0) + (c.transporte || 0);

    // Pagination
    const [currentPage, setCurrentPage] = useState(1);
    const [itemsPerPage, setItemsPerPage] = useState(10);

    const paginatedCotizaciones = useMemo(() => {
        const start = (currentPage - 1) * itemsPerPage;
        return filtered.slice(start, start + itemsPerPage);
    }, [filtered, currentPage, itemsPerPage]);

    const totalPages = Math.ceil(filtered.length / itemsPerPage);

    const IS = { padding: '0.55rem 0.75rem', background: 'rgba(255,255,255,0.06)', border: '1px solid var(--surface-border)', borderRadius: 8, color: 'var(--text-primary)', fontSize: '0.875rem', outline: 'none' };

    const selectedCot = cotizaciones.find(c => c.id === selected);
    const approvingCot = cotizaciones.find(c => c.id === approving);
    const getClient = id => clients.find(c => c.id === id);
    const getObra = (cot) => getClient(cot?.clientId)?.obras?.find(o => o.id === cot?.obraId);

    return (
        <>
            {/* Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
                <div>
                    <h1>Cotizaciones & Contratos</h1>
                    <p className="text-muted">Gestión comercial, documentos legales y Habeas Data</p>
                </div>
                <button className="btn btn-primary" onClick={() => setShowNew(true)} style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                    <FilePlus size={18} /> Nueva Cotización
                </button>
            </div>

            {/* KPIs */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: '0.75rem', marginBottom: '1.25rem' }}>
                {[
                    ['Borradores', kpi('Borrador'), 'blue', Clock, '#2365AB'],
                    ['Enviadas', kpi('Enviada'), 'orange', Send, '#f97316'],
                    ['Aprobadas', kpi('Aprobada'), 'green', CheckCircle, '#10b981'],
                    ['Rechazadas', kpi('Rechazada'), 'red', XCircle, '#ef4444']
                ].map(([l, v, c, Ic, color]) => (
                    <div key={l} className={`mini-kpi-card ${c}`} style={{ cursor: 'pointer' }} onClick={() => setFilterE(l === 'Borradores' ? 'Borrador' : l.slice(0, -1))}>
                        <div className="mini-kpi-header">
                            <Ic size={18} color={color} />
                            <span className="mini-kpi-value">{v}</span>
                        </div>
                        <div className="mini-kpi-label">{l}</div>
                    </div>
                ))}
            </div>

            {/* Filters */}
            <div className="glass-panel p-6 mb-6" style={{ display: 'flex', gap: '0.75rem', alignItems: 'center', flexWrap: 'wrap' }}>
                <div style={{ position: 'relative', flex: 1, minWidth: 200 }}>
                    <Search size={15} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                    <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Buscar por ID o cliente…" style={{ ...IS, paddingLeft: '2rem', width: '100%', boxSizing: 'border-box' }} />
                </div>
                <select value={filterE} onChange={e => setFilterE(e.target.value)} style={{ ...IS, minWidth: 140 }}>
                    {['Todos', 'Borrador', 'Enviada', 'Aprobada', 'Facturada', 'Rechazada'].map(v => <option key={v}>{v}</option>)}
                </select>
                <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>{filtered.length} registro(s)</span>
            </div>

            {/* Table */}
            <div className="glass-panel p-6">
                <div style={{ overflowX: 'auto' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                        <thead>
                            <tr style={{ borderBottom: '1px solid var(--surface-border)' }}>
                                {['ID', 'Cliente / Obra', 'Fecha', 'Válida hasta', 'Ítems', 'Total Est.', 'Estado', 'Acción'].map(h => (
                                    <th key={h} style={{ padding: '0.75rem 0.8rem', textAlign: 'left', fontSize: '0.68rem', color: 'var(--text-muted)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', whiteSpace: 'nowrap' }}>{h}</th>
                                ))}
                            </tr>
                        </thead>
                        <tbody>
                            {paginatedCotizaciones.map(cot => {
                                const client = getClient(cot.clientId);
                                const obra = getObra(cot);
                                const cfg = ESTADO_CFG[cot.estado] || ESTADO_CFG['Borrador'];
                                const Ico = cfg.icon;
                                return (
                                    <tr key={cot.id} style={{ borderBottom: '1px solid var(--surface-border)' }}
                                        onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.02)'}
                                        onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                                        <td style={{ padding: '0.85rem', fontWeight: 700, fontFamily: 'monospace', color: '#2365AB', fontSize: '0.8rem' }}>{cot.id}</td>
                                        <td style={{ padding: '0.85rem' }}>
                                            <div style={{ fontWeight: 700, fontSize: '0.875rem' }}>{client?.name || cot.clientId}</div>
                                            <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: 3 }}><MapPin size={10} />{obra?.nombre || cot.obraId}</div>
                                        </td>
                                        <td style={{ padding: '0.85rem', color: 'var(--text-muted)', fontSize: '0.8rem' }}>{cot.fecha}</td>
                                        <td style={{ padding: '0.85rem', fontSize: '0.8rem', color: '#f97316' }}>{cot.fecha ? new Date(new Date(cot.fecha).getTime() + (cot.validezDias || 15) * 86400000).toISOString().slice(0, 10) : '—'}</td>
                                        <td style={{ padding: '0.85rem', fontSize: '0.82rem' }}>{cot.items.length} ítem(s)</td>
                                        <td style={{ padding: '0.85rem', fontWeight: 700, color: '#10b981' }}>{fmtCOP(total(cot))}</td>

                                        <td style={{ padding: '0.85rem' }}>
                                            <span style={{ padding: '3px 10px', borderRadius: 999, background: cfg.bg, color: cfg.color, fontWeight: 700, fontSize: '0.7rem', border: `1px solid ${cfg.color}30`, display: 'flex', alignItems: 'center', gap: 4, width: 'fit-content' }}>
                                                <Ico size={11} />{cot.estado}
                                            </span>
                                        </td>
                                        <td style={{ padding: '0.85rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }} onClick={e => e.stopPropagation()}>
                                            <button onClick={() => setSelected(cot.id)} className="btn btn-sm" style={{ background: 'rgba(35, 101, 171, 0.1)', color: '#2365AB', border: '1px solid rgba(35, 101, 171, 0.3)', cursor: 'pointer', borderRadius: 6, padding: '0.35rem 0.6rem', fontWeight: 700, fontSize: '0.72rem', display: 'flex', alignItems: 'center', gap: 4 }}>
                                                <Eye size={12} /> Ver
                                            </button>
                                            
                                            {/* Shortcut to Quote PDF */}
                                            <button onClick={() => generateCotizacionPDF(cot, getClient(cot.clientId), getObra(cot), settings)} className="btn btn-sm" title="Imprimir Cotización" style={{ background: 'rgba(35, 101, 171, 0.1)', color: '#2365AB', border: '1px solid rgba(35, 101, 171, 0.3)', cursor: 'pointer', borderRadius: 6, padding: '0.35rem 0.6rem' }}>
                                                <Download size={12} />
                                            </button>

                                            {(cot.estado === 'Borrador' || cot.estado === 'Enviada') && (
                                                <button onClick={() => setApproving(cot.id)} className="btn btn-sm" style={{ background: '#10b981', color: 'white', border: 'none', cursor: 'pointer', borderRadius: 6, padding: '0.35rem 0.75rem', fontWeight: 700, fontSize: '0.75rem', display: 'flex', alignItems: 'center', gap: 4 }}>
                                                    <CheckCircle size={12} /> Aprobar
                                                </button>
                                            )}
                                            {cot.estado === 'Aprobada' && !cot.facturaId && (
                                                <button onClick={() => createInvoiceFromCotizacion(cot.id)} className="btn btn-sm" style={{ background: '#6366f1', color: 'white', border: 'none', cursor: 'pointer', borderRadius: 6, padding: '0.35rem 0.75rem', fontWeight: 700, fontSize: '0.75rem', display: 'flex', alignItems: 'center', gap: 4 }}>
                                                    <FileText size={12} /> Facturar
                                                </button>
                                            )}
                                            {(cot.estado === 'Aprobada' || cot.estado === 'Facturada') && (
                                                <button onClick={() => generateContratoPDF(cot, getClient(cot.clientId), getObra(cot), settings)} className="btn btn-sm" title="Imprimir Contrato" style={{ background: 'rgba(16, 185, 129, 0.1)', color: '#10b981', border: '1px solid rgba(16, 185, 129, 0.3)', cursor: 'pointer', borderRadius: 6, padding: '0.35rem 0.6rem', fontWeight: 700, fontSize: '0.72rem', display: 'flex', alignItems: 'center', gap: 4 }}>
                                                    <FileText size={12} /> Contrato
                                                </button>
                                            )}
                                        </td>
                                    </tr>
                                );
                            })}
                            {filtered.length === 0 && <tr><td colSpan={9} style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-muted)' }}>No se encontraron cotizaciones</td></tr>}
                        </tbody>
                    </table>
                </div>

                {/* Pagination Controls */}
                <div className="flex justify-between items-center mt-6 py-4 px-2" style={{ borderTop: '1px solid var(--surface-border)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                            <span>Mostrar:</span>
                            <div style={{ position: 'relative' }}>
                                <select 
                                    value={itemsPerPage} 
                                    onChange={e => { setItemsPerPage(Number(e.target.value)); setCurrentPage(1); }}
                                    className="input-base"
                                    style={{ padding: '0.3rem 1.8rem 0.3rem 0.6rem', fontSize: '0.8rem', width: 'auto', minWidth: '70px', height: '32px' }}
                                >
                                    {[5, 10, 20, 50, 100].map(n => <option key={n} value={n}>{n}</option>)}
                                </select>
                                <ChevronDown size={14} style={{ position: 'absolute', right: 6, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none', color: 'var(--text-muted)' }} />
                            </div>
                            <span>por página</span>
                        </div>
                        <div style={{ width: '1px', height: '16px', background: 'var(--surface-border)' }}></div>
                        <div>
                            Mostrando {filtered.length > 0 ? (currentPage - 1) * itemsPerPage + 1 : 0} a {Math.min(currentPage * itemsPerPage, filtered.length)} de {filtered.length} registros
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

            {/* Detail Panel */}
            {selected && selectedCot && (
                <CotDetailPanel
                    cot={selectedCot}
                    client={getClient(selectedCot.clientId)}
                    obra={getObra(selectedCot)}
                    settings={settings}
                    onClose={() => setSelected(null)}
                    onUpdateEstado={actualizarEstadoCotizacion}
                    onOpenApproval={() => { setApproving(selectedCot.id); setSelected(null); }}
                    onFacturar={() => { createInvoiceFromCotizacion(selectedCot.id); setSelected(null); }}
                    onSendLink={handleSendQuote}
                    onEditContrato={() => setEditingContrato(selectedCot.id)}
                    onEdit={() => { setEditing(selectedCot); setSelected(null); }}
                />
            )}

            {/* Contrato Editor Modal */}
            {editingContrato && (
                <ContratoEditorModal 
                    cot={cotizaciones.find(c => c.id === editingContrato)}
                    onClose={() => setEditingContrato(null)}
                    onSave={(clausulas) => actualizarEstadoCotizacion(editingContrato, cotizaciones.find(c => c.id === editingContrato).estado, { clausulas })}
                />
            )}

            {/* Approval Modal */}
            {approving && approvingCot && (
                <ApprovalModal
                    cot={approvingCot}
                    client={getClient(approvingCot.clientId)}
                    obra={getObra(approvingCot)}
                    onClose={() => setApproving(null)}
                    onApprove={(extra) => actualizarEstadoCotizacion(approving, 'Aprobada', extra)}
                />
            )}

            {/* Share Modal */}
            {sharing && <ShareModal cotId={sharing} onClose={() => setSharing(null)} />}

            {/* Nueva/Editar Cotización Modal */}
            {showNew && (
                <ModalErrorBoundary onClose={() => setShowNew(false)}>
                    <NuevaCotizacionModal onClose={() => setShowNew(false)} onSave={addCotizacion} clients={clients} products={products} />
                </ModalErrorBoundary>
            )}
            {editing && (
                <ModalErrorBoundary onClose={() => setEditing(null)}>
                    <NuevaCotizacionModal initialData={editing} onClose={() => setEditing(null)} onSave={(data) => updateCotizacion(editing.id, data)} clients={clients} products={products} />
                </ModalErrorBoundary>
            )}
        </>
    );
}
