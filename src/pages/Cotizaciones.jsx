import React, { useState, useMemo } from 'react';
import {
    FilePlus, Search, CheckCircle, XCircle, Clock, Send,
    X, FileText, Shield, Download,
    PenTool, Fingerprint, MapPin, ChevronRight
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
                            style={{ marginTop: '1rem', padding: '0.5rem 1.5rem', background: '#3b82f6', color: 'white', border: 'none', borderRadius: 8, cursor: 'pointer', fontWeight: 700 }}>
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
function ApprovalModal({ cot, client, obra, onClose, onApprove }) {
    const [step, setStep] = useState(1); // 1=habeas, 2=firma, 3=foto, 4=biometria
    const [habeasOk, setHabeasOk] = useState(cot.habeasData);
    const [habeasTS, setHabeasTS] = useState(cot.habeasDataTimestamp);
    const [showHD, setShowHD] = useState(false);
    const [firma, setFirma] = useState(cot.firma);
    const [foto, setFoto] = useState(cot.foto);
    const [biometria, setBiometria] = useState(false);

    const handleApprove = () => {
        onApprove({ habeasData: habeasOk, habeasDataTimestamp: habeasTS, firma, foto });
        onClose();
    };

    const steps = ['Habeas Data', 'Firma Digital', 'Foto / Doc.', 'Biometría'];
    const canNext = (s) => {
        if (s === 1) return habeasOk;
        if (s === 2) return !!firma;
        if (s === 3) return true; // foto optional
        if (s === 4) return true; // biometria simulated
        return true;
    };

    return (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.8)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '1rem' }}>
            <div className="glass-panel" style={{ padding: 0, width: '100%', maxWidth: 600, maxHeight: '93vh', overflowY: 'auto' }}>
                {/* Header */}
                <div style={{ background: 'linear-gradient(135deg,#10b981,#059669)', padding: '1.25rem 1.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div>
                        <div style={{ fontWeight: 800, color: 'white', fontSize: '1.05rem' }}>Aprobar Cotización — {cot.id}</div>
                        <div style={{ fontSize: '0.75rem', color: 'rgba(255,255,255,0.8)', marginTop: 2 }}>{client?.name} · {obra?.nombre}</div>
                    </div>
                    <button onClick={onClose} style={{ background: 'rgba(255,255,255,0.15)', border: '1px solid rgba(255,255,255,0.3)', borderRadius: 6, color: 'white', cursor: 'pointer', padding: '0.3rem', display: 'flex' }}><X size={18} /></button>
                </div>

                {/* Step tabs */}
                <div style={{ display: 'flex', padding: '1rem 1.5rem 0', gap: '0.5rem', borderBottom: '1px solid var(--surface-border)' }}>
                    {steps.map((s, i) => (
                        <button key={s} onClick={() => { if (i === 0 || canNext(i)) setStep(i + 1); }}
                            style={{ padding: '0.4rem 0.9rem', borderRadius: '8px 8px 0 0', border: 'none', cursor: canNext(i) || i === 0 ? 'pointer' : 'not-allowed', fontWeight: 700, fontSize: '0.78rem', background: step === i + 1 ? 'var(--glass-bg)' : 'transparent', color: step === i + 1 ? '#3b82f6' : 'var(--text-muted)', borderBottom: step === i + 1 ? '2px solid #3b82f6' : '2px solid transparent', display: 'flex', alignItems: 'center', gap: 4 }}>
                            {i < step - 1 ? <CheckCircle size={13} style={{ color: '#10b981' }} /> : null}
                            {s}
                        </button>
                    ))}
                </div>

                <div style={{ padding: '1.5rem' }}>
                    {/* Step 1: Habeas Data */}
                    {step === 1 && (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                            <div style={{ background: habeasOk ? 'rgba(16,185,129,0.08)' : 'rgba(59,130,246,0.06)', border: `1px solid ${habeasOk ? 'rgba(16,185,129,0.3)' : 'rgba(59,130,246,0.2)'}`, borderRadius: 10, padding: '1rem' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', marginBottom: '0.75rem' }}>
                                    <Shield size={18} style={{ color: habeasOk ? '#10b981' : '#3b82f6' }} />
                                    <span style={{ fontWeight: 700, color: habeasOk ? '#10b981' : '#3b82f6' }}>
                                        {habeasOk ? `✓ Aceptado — ${habeasTS?.slice(0, 10) || ''}` : 'Pendiente de Aceptación'}
                                    </span>
                                </div>
                                {habeasOk ? (
                                    <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>El cliente ha aceptado el tratamiento de datos. Timestamp: <strong>{habeasTS}</strong></p>
                                ) : (
                                    <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>El cliente debe leer y aceptar la política de protección de datos (Ley 1581/2012) antes de continuar.</p>
                                )}
                            </div>
                            {!habeasOk && (
                                <button onClick={() => setShowHD(true)} style={{ padding: '0.65rem 1.5rem', borderRadius: 8, background: '#3b82f6', color: 'white', border: 'none', cursor: 'pointer', fontWeight: 700, display: 'flex', alignItems: 'center', gap: 6, alignSelf: 'flex-start' }}>
                                    <Shield size={15} /> Mostrar Aviso Habeas Data al Cliente
                                </button>
                            )}
                            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '0.5rem' }}>
                                <button className="btn btn-primary" disabled={!habeasOk} onClick={() => setStep(2)}>Firma Digital <ChevronRight size={16} /></button>
                            </div>
                        </div>
                    )}

                    {/* Step 2: Firma */}
                    {step === 2 && (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                            <div style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid var(--surface-border)', borderRadius: 10, padding: '1rem' }}>
                                <div style={{ fontSize: '0.7rem', fontWeight: 700, color: '#3b82f6', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '0.75rem', display: 'flex', alignItems: 'center', gap: 5 }}>
                                    <PenTool size={13} /> Firma Digital del Cliente
                                </div>
                                <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginBottom: '0.85rem' }}>El cliente firma a continuación usando el dedo (tableta/móvil) o el mouse (escritorio). La firma se almacena en el contrato.</p>
                                <SignatureCanvas onSave={setFirma} onClear={() => setFirma(null)} />
                                {firma && (
                                    <div style={{ marginTop: '0.75rem', padding: '0.5rem 0.75rem', background: 'rgba(16,185,129,0.1)', borderRadius: 8, fontSize: '0.78rem', color: '#10b981', fontWeight: 700 }}>
                                        ✓ Firma capturada
                                    </div>
                                )}
                            </div>
                            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                <button className="btn btn-secondary" onClick={() => setStep(1)}>← Atrás</button>
                                <button className="btn btn-primary" disabled={!firma} onClick={() => setStep(3)}>Foto / Doc. <ChevronRight size={16} /></button>
                            </div>
                        </div>
                    )}

                    {/* Step 3: Foto */}
                    {step === 3 && (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                            <div style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid var(--surface-border)', borderRadius: 10, padding: '1.25rem' }}>
                                <div style={{ fontSize: '0.7rem', fontWeight: 700, color: '#3b82f6', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '0.75rem' }}>Captura de Foto (Cliente / Documento)</div>
                                <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginBottom: '1rem' }}>Capture la foto del cliente o de su documento de identidad para registro. Este paso es opcional.</p>
                                <WebcamCapture onCapture={setFoto} />
                            </div>
                            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                <button className="btn btn-secondary" onClick={() => setStep(2)}>← Atrás</button>
                                <button className="btn btn-primary" onClick={() => setStep(4)}>Biometría <ChevronRight size={16} /></button>
                            </div>
                        </div>
                    )}

                    {/* Step 4: Biometría */}
                    {step === 4 && (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                            <div style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid var(--surface-border)', borderRadius: 10, padding: '1.25rem', textAlign: 'center' }}>
                                <Fingerprint size={52} style={{ color: biometria ? '#10b981' : '#3b82f6', marginBottom: '0.75rem' }} />
                                <div style={{ fontWeight: 700, fontSize: '0.95rem', marginBottom: '0.5rem' }}>{biometria ? '✓ Huella Validada' : 'Validación Biométrica'}</div>
                                {!biometria ? (
                                    <>
                                        <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', maxWidth: 380, margin: '0 auto 1rem' }}>
                                            Conecte el lector de huella (USB) y solicite al cliente apoyar el dedo para validar su identidad. Para validación remota el cliente recibirá un enlace en su celular.
                                        </p>
                                        <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'center' }}>
                                            <button onClick={() => setBiometria(true)} style={{ padding: '0.6rem 1.5rem', borderRadius: 8, background: '#3b82f6', color: 'white', border: 'none', cursor: 'pointer', fontWeight: 700, display: 'flex', alignItems: 'center', gap: 6 }}>
                                                <Fingerprint size={15} /> Simular Lectura de Huella
                                            </button>
                                        </div>
                                        <p style={{ fontSize: '0.68rem', color: '#94a3b8', marginTop: '0.75rem' }}>Nota: integración con SDK del fabricante (ZK/Digital Persona) en Fase 1.5</p>
                                    </>
                                ) : (
                                    <p style={{ fontSize: '0.82rem', color: '#10b981', marginTop: '0.5rem' }}>Identidad verificada. Registro almacenado con timestamp.</p>
                                )}
                            </div>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                <button className="btn btn-secondary" onClick={() => setStep(3)}>← Atrás</button>
                                <button className="btn btn-primary" onClick={handleApprove}
                                    style={{ background: '#10b981', display: 'flex', alignItems: 'center', gap: '0.4rem', boxShadow: '0 4px 14px rgba(16,185,129,0.35)' }}>
                                    <CheckCircle size={16} /> Aprobar y Generar Documentos
                                </button>
                            </div>
                        </div>
                    )}
                </div>
            </div>
            {showHD && (
                <HabeasDataModal
                    onClose={() => setShowHD(false)}
                    onAccept={ts => { setHabeasOk(true); setHabeasTS(ts); setShowHD(false); }}
                />
            )}
        </div>
    );
}

// ─── Detail Panel ─────────────────────────────────────────────────────────────
function CotDetailPanel({ cot, client, obra, onClose, onUpdateEstado, onOpenApproval, onFacturar }) {
    const cfg = ESTADO_CFG[cot.estado] || ESTADO_CFG['Borrador'];
    const subtotal = cot.items.reduce((s, i) => s + (i.cantidad * i.dias * i.tarifaDia), 0);
    const iva = Math.round(subtotal * (client?.porcIVA || 0) / 100);
    const ret = Math.round(subtotal * (client?.porcRetencion || 0) / 100);
    const total = subtotal + iva - ret + (cot.transporte || 0);

    return (
        <>
            <div style={{ position: 'fixed', right: 0, top: 0, bottom: 0, width: 520, zIndex: 900, background: 'var(--glass-bg)', backdropFilter: 'blur(20px)', display: 'flex', flexDirection: 'column', boxShadow: '-6px 0 40px rgba(0,0,0,0.4)', overflowY: 'auto' }}>
                {/* Header */}
                <div style={{ background: 'linear-gradient(135deg,#1e293b,#334155)', padding: '1.5rem', flexShrink: 0 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                        <div>
                            <div style={{ fontSize: '0.65rem', color: 'rgba(255,255,255,0.6)', fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase' }}>CIELO — Cotización</div>
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
                                        <td style={{ padding: '0.6rem 0.85rem', fontWeight: 600, color: '#1e293b' }}>{i.nombre}</td>
                                        <td style={{ padding: '0.6rem 0.85rem', color: '#64748b', fontSize: '0.78rem' }}>{i.cantidad} u. × {i.dias}d</td>
                                        <td style={{ padding: '0.6rem 0.85rem', fontWeight: 700, color: '#10b981', textAlign: 'right' }}>{fmtCOP(i.cantidad * i.dias * i.tarifaDia)}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>

                    {/* Totals */}
                    <div style={{ background: '#3b82f6', borderRadius: 10, padding: '1rem 1.25rem' }}>
                        {[['Subtotal', fmtCOP(subtotal)], ['+ IVA', fmtCOP(iva)], ['— Ret.', `-${fmtCOP(ret)}`], ['+ Transporte', fmtCOP(cot.transporte || 0)]].map(([k, v]) => (
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
                                <span style={{ color: '#64748b' }}>{k}</span><span style={{ fontWeight: 600, color: '#1e293b' }}>{v}</span>
                            </div>
                        ))}
                    </div>

                    {/* Habeas Data status */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', background: cot.habeasData ? '#f0fdf4' : '#fef9f0', border: `1px solid ${cot.habeasData ? '#bbf7d0' : '#fed7aa'}`, borderRadius: 8, padding: '0.6rem 0.85rem' }}>
                        <Shield size={14} style={{ color: cot.habeasData ? '#10b981' : '#f97316', flexShrink: 0 }} />
                        <span style={{ fontSize: '0.78rem', color: cot.habeasData ? '#166534' : '#92400e', fontWeight: 600 }}>
                            {cot.habeasData ? `Habeas Data aceptado — ${cot.habeasDataTimestamp?.slice(0, 10)}` : 'Habeas Data pendiente'}
                        </span>
                    </div>

                    {/* notas */}
                    {cot.notas && <div style={{ fontSize: '0.78rem', color: '#64748b', background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 8, padding: '0.65rem 0.85rem' }}>{cot.notas}</div>}

                    {/* Actions */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>

                        {/* Botón Imprimir Cotización — SIEMPRE visible */}
                        <button
                            onClick={() => generateCotizacionPDF(cot, client, obra)}
                            style={{ width: '100%', padding: '0.65rem', borderRadius: 8, background: 'linear-gradient(135deg,#3b82f6,#2563eb)', color: 'white', border: 'none', cursor: 'pointer', fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, boxShadow: '0 4px 12px rgba(59,130,246,0.35)' }}>
                            <Download size={15} /> Imprimir / PDF Cotización
                        </button>

                        {cot.estado === 'Borrador' && (
                            <button onClick={() => onUpdateEstado(cot.id, 'Enviada')} style={{ width: '100%', padding: '0.65rem', borderRadius: 8, background: '#f97316', color: 'white', border: 'none', cursor: 'pointer', fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
                                <Send size={15} /> Marcar como Enviada
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

                        {cot.estado === 'Aprobada' && (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                                <p style={{ fontSize: '0.75rem', fontWeight: 700, color: '#10b981', textAlign: 'center' }}>Documentos Legales:</p>
                                {[['Contrato de Alquiler', () => generateContratoPDF(cot, client, obra)], ['Pagaré', () => generatePagarePDF(cot, client)], ['Carta de Instrucciones', () => generateCartaPDF(cot, client)]].map(([label, fn]) => (
                                    <button key={label} onClick={fn} style={{ width: '100%', padding: '0.6rem', borderRadius: 8, background: 'rgba(59,130,246,0.1)', color: '#3b82f6', border: '1px solid rgba(59,130,246,0.25)', cursor: 'pointer', fontWeight: 700, fontSize: '0.82rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
                                        <Download size={14} /> {label}
                                    </button>
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
                        CIELO · {cot.id} · Generado el {format(new Date(), 'dd/MM/yyyy')}
                    </div>
                </div>
            </div>
            <div style={{ position: 'fixed', inset: 0, zIndex: 899 }} onClick={onClose} />
        </>
    );
}

// ─── MAIN PAGE ────────────────────────────────────────────────────────────────
export default function Cotizaciones() {
    const { clients, products, cotizaciones, addCotizacion, actualizarEstadoCotizacion, createInvoiceFromCotizacion } = useAppContext();
    const [search, setSearch] = useState('');
    const [filterE, setFilterE] = useState('Todos');
    const [showNew, setShowNew] = useState(false);
    const [selected, setSelected] = useState(null);
    const [approving, setApproving] = useState(null);

    const filtered = useMemo(() =>
        cotizaciones.filter(c => {
            const cl = clients.find(x => x.id === c.clientId);
            const q = search.toLowerCase();
            return (c.id.toLowerCase().includes(q) || cl?.name?.toLowerCase().includes(q)) &&
                (filterE === 'Todos' || c.estado === filterE);
        }).sort((a, b) => b.fecha.localeCompare(a.fecha))
        , [cotizaciones, search, filterE, clients]);

    const kpi = (e) => cotizaciones.filter(c => c.estado === e).length;
    const total = (c) => c.items.reduce((s, i) => s + (i.cantidad * i.dias * i.tarifaDia), 0) + (c.transporte || 0);

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
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: '1rem', marginBottom: '1.5rem' }}>
                {[['Borradores', kpi('Borrador'), 'blue', Clock], ['Enviadas', kpi('Enviada'), 'orange', Send], ['Aprobadas', kpi('Aprobada'), 'green', CheckCircle], ['Rechazadas', kpi('Rechazada'), 'red', XCircle]].map(([l, v, c, Ic]) => (
                    <div key={l} className={`stat-card ${c}`}>
                        <div className={`icon-wrapper ${c}`}><Ic size={20} /></div>
                        <div><div className="stat-value">{v}</div><div className="stat-label">{l}</div></div>
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
                                {['ID', 'Cliente / Obra', 'Fecha', 'Válida hasta', 'Ítems', 'Total Est.', 'Habeas Data', 'Estado', 'Acción'].map(h => (
                                    <th key={h} style={{ padding: '0.75rem 0.8rem', textAlign: 'left', fontSize: '0.68rem', color: 'var(--text-muted)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', whiteSpace: 'nowrap' }}>{h}</th>
                                ))}
                            </tr>
                        </thead>
                        <tbody>
                            {filtered.map(cot => {
                                const client = getClient(cot.clientId);
                                const obra = getObra(cot);
                                const cfg = ESTADO_CFG[cot.estado] || ESTADO_CFG['Borrador'];
                                const Ico = cfg.icon;
                                return (
                                    <tr key={cot.id} style={{ borderBottom: '1px solid var(--surface-border)', cursor: 'pointer' }}
                                        onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.02)'}
                                        onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                                        onClick={() => setSelected(cot.id)}>
                                        <td style={{ padding: '0.85rem', fontWeight: 700, fontFamily: 'monospace', color: '#3b82f6', fontSize: '0.8rem' }}>{cot.id}</td>
                                        <td style={{ padding: '0.85rem' }}>
                                            <div style={{ fontWeight: 700, fontSize: '0.875rem' }}>{client?.name || cot.clientId}</div>
                                            <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: 3 }}><MapPin size={10} />{obra?.nombre || cot.obraId}</div>
                                        </td>
                                        <td style={{ padding: '0.85rem', color: 'var(--text-muted)', fontSize: '0.8rem' }}>{cot.fecha}</td>
                                        <td style={{ padding: '0.85rem', fontSize: '0.8rem', color: '#f97316' }}>{cot.fecha ? new Date(new Date(cot.fecha).getTime() + (cot.validezDias || 15) * 86400000).toISOString().slice(0, 10) : '—'}</td>
                                        <td style={{ padding: '0.85rem', fontSize: '0.82rem' }}>{cot.items.length} ítem(s)</td>
                                        <td style={{ padding: '0.85rem', fontWeight: 700, color: '#10b981' }}>{fmtCOP(total(cot))}</td>
                                        <td style={{ padding: '0.85rem' }}>
                                            <span style={{ fontSize: '0.7rem', fontWeight: 700, padding: '2px 8px', borderRadius: 999, background: cot.habeasData ? 'rgba(16,185,129,0.12)' : 'rgba(249,115,22,0.1)', color: cot.habeasData ? '#10b981' : '#f97316', border: `1px solid ${cot.habeasData ? 'rgba(16,185,129,0.3)' : 'rgba(249,115,22,0.3)'}`, display: 'flex', alignItems: 'center', gap: 3, width: 'fit-content' }}>
                                                <Shield size={9} />{cot.habeasData ? 'OK' : 'Pendiente'}
                                            </span>
                                        </td>
                                        <td style={{ padding: '0.85rem' }}>
                                            <span style={{ padding: '3px 10px', borderRadius: 999, background: cfg.bg, color: cfg.color, fontWeight: 700, fontSize: '0.7rem', border: `1px solid ${cfg.color}30`, display: 'flex', alignItems: 'center', gap: 4, width: 'fit-content' }}>
                                                <Ico size={11} />{cot.estado}
                                            </span>
                                        </td>
                                        <td style={{ padding: '0.85rem' }} onClick={e => e.stopPropagation()}>
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
                                            {cot.estado === 'Aprobada' && cot.facturaId && (
                                                <button onClick={() => generateContratoPDF(cot, getClient(cot.clientId), getObra(cot))} className="btn btn-sm" style={{ background: 'rgba(59,130,246,0.1)', color: '#3b82f6', border: '1px solid rgba(59,130,246,0.3)', cursor: 'pointer', borderRadius: 6, padding: '0.35rem 0.75rem', fontWeight: 700, fontSize: '0.75rem', display: 'flex', alignItems: 'center', gap: 4 }}>
                                                    <Download size={12} /> PDF
                                                </button>
                                            )}
                                            {cot.estado === 'Facturada' && (
                                                <span style={{ fontSize: '0.72rem', fontWeight: 700, padding: '3px 10px', borderRadius: 999, background: 'rgba(99,102,241,0.12)', color: '#6366f1', border: '1px solid rgba(99,102,241,0.3)', display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                                                    <FileText size={11} /> Facturada: {cot.facturaId}
                                                </span>
                                            )}
                                        </td>
                                    </tr>
                                );
                            })}
                            {filtered.length === 0 && <tr><td colSpan={9} style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-muted)' }}>No se encontraron cotizaciones</td></tr>}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Detail Panel */}
            {selected && selectedCot && (
                <CotDetailPanel
                    cot={selectedCot}
                    client={getClient(selectedCot.clientId)}
                    obra={getObra(selectedCot)}
                    onClose={() => setSelected(null)}
                    onUpdateEstado={actualizarEstadoCotizacion}
                    onOpenApproval={() => { setApproving(selectedCot.id); setSelected(null); }}
                    onFacturar={() => { createInvoiceFromCotizacion(selectedCot.id); setSelected(null); }}
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

            {/* New Quote Modal */}
            {showNew && (
                <ModalErrorBoundary onClose={() => setShowNew(false)}>
                    <NuevaCotizacionModal
                        onClose={() => setShowNew(false)}
                        onSave={addCotizacion}
                        clients={clients}
                        products={products}
                    />
                </ModalErrorBoundary>
            )}
        </>
    );
}
