import React, { useState } from 'react';
import { 
    X, Send, Shield, CheckCircle, Copy, Share2, Edit2, XCircle, Plus
} from 'lucide-react';

export function ApprovalModal({ cot, client, onClose, onApprove }) {
    const [mode, setMode] = useState(null); // 'internal', 'external'
    const [file, setFile] = useState(null);
    const [fileName, setFileName] = useState('');
    const [fileRostro, setFileRostro] = useState(null);
    const [fileCC, setFileCC] = useState(null);
    const [nameRostro, setNameRostro] = useState('');
    const [nameCC, setNameCC] = useState('');
    const [notes, setNotes] = useState('');
    const [loading, setLoading] = useState(false);
    const [copied, setCopied] = useState(false);

    const shareLink = `${window.location.origin}/public/cotizacion/${cot.id}`;

    const handleConfirmInternal = async () => {
        try {
            setLoading(true);
            await onApprove({ firma: file, foto: fileRostro, fotoCC: fileCC, notas: notes || cot.notas });
            onClose();
        } catch (e) {
            console.error('Error en handleConfirmInternal:', e);
            alert('Error al procesar la aprobación interna: ' + e.message);
        } finally {
            setLoading(false);
        }
    };

    const onFile = (e, setSrc, setName) => {
        const f = e.target.files[0];
        if (!f) return;
        setName(f.name);
        const reader = new FileReader();
        reader.onload = (ev) => setSrc(ev.target.result);
        reader.readAsDataURL(f);
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
            <div 
                className="glass-panel" 
                onClick={e => e.stopPropagation()}
                style={{ padding: 0, width: '100%', maxWidth: mode ? 550 : 600, overflow: 'hidden', boxShadow: '0 25px 50px -12px rgba(0,0,0,0.5)', background: 'white', transition: 'all 0.3s ease' }}
            >

                <div style={{ background: 'linear-gradient(135deg,#104166,#2365AB)', padding: '1.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div>
                        <div style={{ fontWeight: 800, color: 'white', fontSize: '1.2rem', letterSpacing: '-0.02em' }}>
                            {mode === 'internal' ? 'Aprobación Administrativa' : mode === 'external' ? 'Enviar Link de Aprobación' : 'Seleccionar Método de Aprobación'}
                        </div>
                        <div style={{ fontSize: '0.8rem', color: 'rgba(255,255,255,0.8)', marginTop: 2, fontWeight: 500 }}>Cotización #{cot.id} · {client?.name}</div>
                    </div>
                    <button onClick={onClose} style={{ background: 'rgba(255,255,255,0.15)', border: 'none', borderRadius: '50%', width: 34, height: 34, color: 'white', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><X size={20} /></button>
                </div>

                <div style={{ padding: '2rem', maxHeight: '80vh', overflowY: 'auto' }}>
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
                                <p style={{ fontSize: '0.75rem', color: '#64748b', margin: 0 }}>Carga soportes, fotos de identidad o notas.</p>
                            </div>
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
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', marginBottom: '1.5rem' }}>
                                <div>
                                    <label style={{ display: 'block', fontSize: '0.7rem', fontWeight: 800, color: '#64748b', marginBottom: '0.4rem', textTransform: 'uppercase' }}>1. Soporte / Documento Firmado</label>
                                    <div style={{ border: '1px dashed #cbd5e1', borderRadius: 10, padding: '0.8rem', textAlign: 'center', background: '#f8fafc', cursor: 'pointer' }} onClick={() => document.getElementById('f-sop').click()}>
                                        <input id="f-sop" type="file" hidden accept=".pdf,image/*" onChange={e => onFile(e, setFile, setFileName)} />
                                        <div style={{ fontSize: '0.8rem', color: fileName ? '#10b981' : '#64748b', fontWeight: 600 }}>{fileName || 'Subir PDF o Imagen'}</div>
                                    </div>
                                </div>
                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                                    <div>
                                        <label style={{ display: 'block', fontSize: '0.7rem', fontWeight: 800, color: '#64748b', marginBottom: '0.4rem', textTransform: 'uppercase' }}>2. Foto Rostro Cliente</label>
                                        <div style={{ border: '1px dashed #cbd5e1', borderRadius: 10, padding: '0.8rem', textAlign: 'center', background: '#f8fafc', cursor: 'pointer' }} onClick={() => document.getElementById('f-ros').click()}>
                                            <input id="f-ros" type="file" hidden accept="image/*" onChange={e => onFile(e, setFileRostro, setNameRostro)} />
                                            <div style={{ fontSize: '0.75rem', color: nameRostro ? '#10b981' : '#64748b', fontWeight: 600 }}>{nameRostro || 'Cargar Foto'}</div>
                                        </div>
                                    </div>
                                    <div>
                                        <label style={{ display: 'block', fontSize: '0.7rem', fontWeight: 800, color: '#64748b', marginBottom: '0.4rem', textTransform: 'uppercase' }}>3. Foto Cédula CC</label>
                                        <div style={{ border: '1px dashed #cbd5e1', borderRadius: 10, padding: '0.8rem', textAlign: 'center', background: '#f8fafc', cursor: 'pointer' }} onClick={() => document.getElementById('f-cc').click()}>
                                            <input id="f-cc" type="file" hidden accept="image/*" onChange={e => onFile(e, setFileCC, setNameCC)} />
                                            <div style={{ fontSize: '0.75rem', color: nameCC ? '#10b981' : '#64748b', fontWeight: 600 }}>{nameCC || 'Cargar Foto'}</div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                            <div style={{ marginBottom: '1.5rem' }}>
                                <label style={{ display: 'block', fontSize: '0.7rem', fontWeight: 800, color: '#64748b', marginBottom: '0.4rem', textTransform: 'uppercase' }}>Notas Administrativas</label>
                                <textarea value={notes} onChange={e => setNotes(e.target.value)} placeholder="Ej: Recibido por correo, validado por gerencia..." style={{ width: '100%', padding: '0.75rem', borderRadius: 10, border: '1px solid #cbd5e1', fontSize: '0.85rem', minHeight: 70, boxSizing: 'border-box' }} />
                            </div>
                            <div style={{ display: 'flex', gap: '1rem' }}>
                                <button type="button" onClick={() => setMode(null)} className="btn btn-secondary" style={{ flex: 1 }}>Volver</button>
                                <button type="button" onClick={handleConfirmInternal} disabled={loading} className="btn btn-primary" style={{ flex: 2, background: 'linear-gradient(135deg,#2365AB,#104166)', border: 'none', color: 'white', fontWeight: 700 }}>
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

export function ShareModal({ cotId, onClose }) {
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
            <div 
                className="glass-panel" 
                onClick={e => e.stopPropagation()}
                style={{ maxWidth: 450, width: '100%', padding: '1.5rem' }}
            >
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

export function ContratoEditorModal({ cot, onClose, onSave }) {
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
            <div 
                className="glass-panel" 
                onClick={e => e.stopPropagation()}
                style={{ maxWidth: 700, width: '100%', maxHeight: '90vh', display: 'flex', flexDirection: 'column', background: 'white', padding: 0, overflow: 'hidden' }}
            >
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
                </div>

                <div style={{ padding: '1.25rem 1.5rem', borderTop: '1px solid #e2e8f0', display: 'flex', gap: '1rem', justifyContent: 'flex-end', background: 'white' }}>
                    <button onClick={onClose} style={{ padding: '0.6rem 1.5rem', border: '1px solid #e2e8f0', background: 'white', borderRadius: 8, cursor: 'pointer' }}>Cancelar</button>
                    <button onClick={() => { onSave(clausulas); onClose(); }} style={{ background: '#10b981', color: 'white', border: 'none', padding: '0.6rem 2rem', borderRadius: 8, fontWeight: 700, cursor: 'pointer', boxShadow: '0 4px 12px rgba(16,185,129,0.35)' }}>Guardar Cambios</button>
                </div>
            </div>
        </div>
    );
}
