import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { CheckCircle, Shield, PenTool, Camera, FileText, MapPin, Printer, ShieldCheck, Mail, Phone, ExternalLink } from 'lucide-react';
import { SignatureCanvas, WebcamCapture, fmtCOP } from './CotizacionesHelpers';

const API_BASE_URL = import.meta.env.VITE_API_URL || '';

export default function PublicCotizacionApproval() {
    const { id } = useParams();
    const [data, setData] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [step, setStep] = useState(1); // 1 = Review, 2 = Approve
    const [approved, setApproved] = useState(false);
    const [firma, setFirma] = useState(null);
    const [foto, setFoto] = useState(null);
    const [fotoCC, setFotoCC] = useState(null);
    const [fotoCCBack, setFotoCCBack] = useState(null);
    const [saving, setSaving] = useState(false);

    useEffect(() => {
        fetch(`${API_BASE_URL}/api/public/cotizaciones/${id}`)
            .then(res => res.json())
            .then(json => {
                if (json.error) throw new Error(json.error);
                setData(json);
                setLoading(false);
                if (json.cot.estado === 'Aprobada' || json.cot.estado === 'Facturada') {
                    setApproved(true);
                }
            })
            .catch(err => {
                setError(err.message);
                setLoading(false);
            });
    }, [id]);

    const handleApprove = async () => {
        if (!firma) {
            alert('Por favor, realice la firma antes de confirmar.');
            return;
        }
        if (!foto || !fotoCC || !fotoCCBack) {
            alert('Por favor, capture todas las fotografías de seguridad (Rostro, CC Frontal y CC Posterior).');
            return;
        }
        setSaving(true);
        try {
            const res = await fetch(`${API_BASE_URL}/api/public/cotizaciones/${id}/approve`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ firma, foto, fotoCC, fotoCCBack })
            });
            if (res.ok) {
                setApproved(true);
                setStep(1);
            } else {
                alert('No se pudo procesar la aprobación. Intente de nuevo.');
            }
        } catch (e) {
            console.error(e);
            alert('Error al conectar con el servidor.');
        } finally {
            setSaving(false);
        }
    };

    if (loading) return (
        <div style={{ height: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', background: '#f8fafc' }}>
            <div style={{ width: 40, height: 40, border: '4px solid #e2e8f0', borderTopColor: '#2365AB', borderRadius: '50%', animation: 'spin 1s linear infinite' }} />
            <p style={{ marginTop: '1rem', color: '#1e293b', fontWeight: 600 }}>Cargando información...</p>
            <style>{`@keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }`}</style>
        </div>
    );
    
    if (error) return (
        <div style={{ height: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '2rem', textAlign: 'center', background: '#f8fafc' }}>
            <FileText size={64} color="#ef4444" style={{ marginBottom: '1.5rem', opacity: 0.3 }} />
            <h2 style={{ color: '#0f172a', fontSize: '1.5rem', fontWeight: 800 }}>Documento No Encontrado</h2>
            <p style={{ color: '#64748b', maxWidth: 400, marginTop: '0.5rem' }}>Lo sentimos, parece que el enlace es inválido o la cotización ya no está disponible.</p>
        </div>
    );

    const { cot, client, settings } = data;
    const obra = client?.obras?.find(o => o.id === cot.obraId);
    const subtotal = cot.items.reduce((s, i) => s + (i.cantidad * i.dias * i.tarifaDia), 0);
    const total = subtotal + (cot.transporte || 0);

    return (
        <div style={{ minHeight: '100vh', background: '#f1f5f9', padding: '1rem' }}>
            <div style={{ maxWidth: 850, margin: '0 auto', background: 'white', borderRadius: 20, boxShadow: '0 25px 50px -12px rgba(0,0,0,0.08)', overflow: 'hidden' }}>
                
                {/* Modern Header */}
                <div style={{ background: 'linear-gradient(135deg, #104166, #2365AB)', padding: '2.5rem 2rem', color: 'white', position: 'relative' }}>
                    <div style={{ position: 'absolute', top: 0, right: 0, padding: '1.5rem', opacity: 0.1 }}><ShieldCheck size={120} /></div>
                    <div style={{ position: 'relative', zIndex: 1, display: 'flex', alignItems: 'center', gap: '1.5rem', flexWrap: 'wrap' }}>
                        {settings?.logo ? (
                            <img src={settings.logo} alt="Logo" style={{ maxHeight: 70, borderRadius: 10, background: 'white', padding: 8 }} />
                        ) : (
                            <div style={{ width: 60, height: 60, borderRadius: 12, background: 'rgba(255,255,255,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><FileText size={30} /></div>
                        )}
                        <div>
                            <h1 style={{ fontSize: '1.5rem', fontWeight: 900, margin: 0, letterSpacing: '-0.02em' }}>Portal de Aprobación Online</h1>
                            <p style={{ opacity: 0.9, fontSize: '0.95rem', marginTop: 4, fontWeight: 500 }}>{settings?.companyName}</p>
                        </div>
                    </div>
                </div>

                {approved ? (
                    <div style={{ padding: '4rem 2rem', textAlign: 'center' }}>
                        <div style={{ background: '#f0fdf4', color: '#10b981', width: 90, height: 90, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 2rem', boxShadow: '0 10px 20px rgba(16,185,129,0.1)' }}>
                            <CheckCircle size={50} />
                        </div>
                        <h2 style={{ color: '#0f172a', fontSize: '1.75rem', fontWeight: 800, marginBottom: '0.75rem' }}>¡Transacción Exitosa!</h2>
                        <p style={{ color: '#475569', fontSize: '1.1rem', maxWidth: 500, margin: '0 auto 2.5rem', lineHeight: 1.6 }}>La cotización <strong>#{id}</strong> ha sido aprobada formalmente. Hemos recibido su firma y registro fotográfico correctamente.</p>
                        
                        <div style={{ background: '#f8fafc', borderRadius: 16, border: '1px solid #e2e8f0', padding: '1.5rem', maxWidth: 450, margin: '0 auto' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', textAlign: 'left' }}>
                                <div style={{ background: '#e0f2fe', p: 10, borderRadius: 10 }}><Mail size={20} color="#0369a1" /></div>
                                <div style={{ flex: 1 }}>
                                    <div style={{ fontWeight: 700, fontSize: '0.9rem', color: '#0f172a' }}>Comprobante Enviado</div>
                                    <div style={{ fontSize: '0.8rem', color: '#64748b' }}>Se ha enviado una notificación al área comercial para el alistamiento de su equipo.</div>
                                </div>
                            </div>
                        </div>
                    </div>
                ) : (
                    <>
                        {step === 1 ? (
                            <div style={{ padding: '2rem' }}>
                                {/* Data Grid */}
                                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1.5rem', marginBottom: '2.5rem' }}>
                                    <div style={{ border: '1px solid #e2e8f0', borderRadius: 12, padding: '1.25rem' }}>
                                        <div style={{ fontSize: '0.75rem', fontWeight: 800, color: '#2365AB', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.75rem' }}>Información del Cliente</div>
                                        <div style={{ fontWeight: 800, color: '#0f172a', fontSize: '1.1rem' }}>{client?.name}</div>
                                        <div style={{ fontSize: '0.9rem', color: '#64748b', marginTop: 4 }}>NIT/CC: {client?.nit}</div>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: '0.75rem', color: '#475569', fontSize: '0.85rem' }}>
                                            <MapPin size={14} /> {obra?.nombre || 'Ubicación Actual'}
                                        </div>
                                    </div>
                                    <div style={{ border: '1px solid #e2e8f0', borderRadius: 12, padding: '1.25rem', background: '#f8fafc' }}>
                                        <div style={{ fontSize: '0.75rem', fontWeight: 800, color: '#2365AB', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.75rem' }}>Resumen de Cotización</div>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                                            <span style={{ color: '#64748b', fontSize: '0.9rem' }}>Nº Documento</span>
                                            <span style={{ fontWeight: 800, color: '#0f172a' }}>#{id}</span>
                                        </div>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                                            <span style={{ color: '#64748b', fontSize: '0.9rem' }}>Fecha Emisión</span>
                                            <span style={{ fontWeight: 700, color: '#0f172a' }}>{cot.fecha}</span>
                                        </div>
                                        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                            <span style={{ color: '#64748b', fontSize: '0.9rem' }}>Validez</span>
                                            <span style={{ fontWeight: 700, color: '#f59e0b' }}>{cot.validezDias} días</span>
                                        </div>
                                    </div>
                                </div>

                                {/* Items Table */}
                                <div style={{ border: '1px solid #e2e8f0', borderRadius: 16, overflowX: 'auto', marginBottom: '2.5rem' }}>
                                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.95rem' }}>
                                        <thead style={{ background: '#f1f5f9' }}>
                                            <tr>
                                                <th style={{ textAlign: 'left', padding: '1rem 1.5rem', color: '#475569', fontWeight: 700 }}>Descripción del Equipo</th>
                                                <th style={{ textAlign: 'center', padding: '1rem 1rem', color: '#475569', fontWeight: 700 }}>Cant.</th>
                                                <th style={{ textAlign: 'center', padding: '1rem 1rem', color: '#475569', fontWeight: 700 }}>Días</th>
                                                <th style={{ textAlign: 'right', padding: '1rem 1.5rem', color: '#475569', fontWeight: 700 }}>Subtotal</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {cot.items.map((it, idx) => (
                                                <tr key={idx} style={{ borderBottom: '1px solid #f1f5f9' }}>
                                                    <td style={{ padding: '1.25rem 1.5rem', fontWeight: 600, color: '#1e293b' }}>{it.nombre}</td>
                                                    <td style={{ textAlign: 'center', padding: '1.25rem 1rem', color: '#64748b' }}>{it.cantidad}</td>
                                                    <td style={{ textAlign: 'center', padding: '1.25rem 1rem', color: '#64748b' }}>{it.dias}</td>
                                                    <td style={{ textAlign: 'right', padding: '1.25rem 1.5rem', color: '#0f172a', fontWeight: 800 }}>{fmtCOP(it.cantidad * it.dias * it.tarifaDia)}</td>
                                                </tr>
                                            ))}
                                            {cot.transporte > 0 && (
                                                <tr style={{ borderBottom: '1px solid #f1f5f9', background: '#fffcf5' }}>
                                                    <td colSpan={3} style={{ padding: '1rem 1.5rem', fontWeight: 700, color: '#92400e', textAlign: 'right' }}>Servicio de Transporte y Logística</td>
                                                    <td style={{ textAlign: 'right', padding: '1rem 1.5rem', color: '#92400e', fontWeight: 800 }}>{fmtCOP(cot.transporte)}</td>
                                                </tr>
                                            )}
                                        </tbody>
                                        <tfoot>
                                            <tr style={{ background: '#0f172a', color: 'white' }}>
                                                <td colSpan={3} style={{ padding: '1.5rem', fontWeight: 800, textAlign: 'right', fontSize: '1.1rem' }}>VALOR TOTAL DE LA ORDEN</td>
                                                <td style={{ padding: '1.5rem', textAlign: 'right', fontWeight: 900, fontSize: '1.4rem' }}>{fmtCOP(total)}</td>
                                            </tr>
                                        </tfoot>
                                    </table>
                                </div>

                                <button 
                                    onClick={() => setStep(2)}
                                    style={{ width: '100%', padding: '1.25rem', borderRadius: 16, background: '#10b981', color: 'white', border: 'none', cursor: 'pointer', fontWeight: 800, fontSize: '1.2rem', boxShadow: '0 10px 25px rgba(16,185,129,0.25)', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.75rem' }}
                                >
                                    Aprobar y Proceder a Firmar <ExternalLink size={20} />
                                </button>
                                <p style={{ textAlign: 'center', fontSize: '0.8rem', color: '#94a3b8', marginTop: '1.25rem' }}>Documento electrónico válido para inicio de trámites administrativos.</p>
                            </div>
                        ) : (
                            <div style={{ padding: '2rem' }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
                                    <h3 style={{ margin: 0, color: '#0f172a', fontSize: '1.25rem', fontWeight: 800, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                        <PenTool size={22} color="#2365AB" /> Registro de Seguridad
                                    </h3>
                                    <div style={{ fontSize: '0.8rem', color: '#64748b', fontWeight: 600 }}>Paso 2 de 2</div>
                                </div>

                                <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
                                    <div>
                                        <div style={{ fontSize: '0.9rem', fontWeight: 700, color: '#334155', marginBottom: '0.75rem' }}>1. Firma Bio-Digital</div>
                                        <div style={{ border: '2px dashed #cbd5e1', borderRadius: 16, background: '#f8fafc', overflow: 'hidden' }}>
                                            <SignatureCanvas onSave={setFirma} onClear={() => setFirma(null)} />
                                        </div>
                                    </div>

                                    <div className="security-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '1rem' }}>
                                        <div>
                                            <div style={{ fontSize: '0.85rem', fontWeight: 700, color: '#334155', marginBottom: '0.6rem' }}>1. Foto Rostro</div>
                                            <div style={{ border: '1px solid #e2e8f0', borderRadius: 12, padding: '1rem', background: '#f8fafc', display: 'flex', justifyContent: 'center' }}>
                                                <WebcamCapture onCapture={setFoto} />
                                            </div>
                                        </div>
                                        <div>
                                            <div style={{ fontSize: '0.85rem', fontWeight: 700, color: '#334155', marginBottom: '0.6rem' }}>2. CC Frontal</div>
                                            <div style={{ border: '1px solid #e2e8f0', borderRadius: 12, padding: '1rem', background: '#f8fafc', display: 'flex', justifyContent: 'center' }}>
                                                <WebcamCapture onCapture={setFotoCC} />
                                            </div>
                                        </div>
                                        <div>
                                            <div style={{ fontSize: '0.85rem', fontWeight: 700, color: '#334155', marginBottom: '0.6rem' }}>3. CC Posterior</div>
                                            <div style={{ border: '1px solid #e2e8f0', borderRadius: 12, padding: '1rem', background: '#f8fafc', display: 'flex', justifyContent: 'center' }}>
                                                <WebcamCapture onCapture={setFotoCCBack} />
                                            </div>
                                        </div>
                                    </div>
                                    <p style={{ fontSize: '0.75rem', color: '#94a3b8', marginTop: '0.75rem', textAlign: 'center' }}>Capture su rostro y su documento de identidad para validar la transacción.</p>

                                </div>

                                <div style={{ display: 'flex', gap: '1rem', marginTop: '3rem' }}>
                                    <button 
                                        onClick={() => setStep(1)}
                                        style={{ flex: 1, padding: '1.1rem', borderRadius: 14, background: 'white', color: '#64748b', border: '1px solid #cbd5e1', cursor: 'pointer', fontWeight: 700 }}
                                    >
                                        Atrás
                                    </button>
                                    <button 
                                        onClick={handleApprove}
                                        disabled={!firma || saving}
                                        style={{ flex: 2, padding: '1.1rem', borderRadius: 14, background: (firma && !saving) ? '#2365AB' : '#cbd5e1', color: 'white', border: 'none', cursor: (firma && !saving) ? 'pointer' : 'not-allowed', fontWeight: 800, fontSize: '1.1rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.75rem', boxShadow: (firma && !saving) ? '0 10px 20px rgba(35,101,171,0.2)' : 'none' }}
                                    >
                                        {saving ? 'Procesando...' : (
                                            <>Finalizar Aprobación <CheckCircle size={20} /></>
                                        )}
                                    </button>
                                </div>
                            </div>
                        )}
                    </>
                )}
                
                <div style={{ background: '#f8fafc', padding: '2rem', textAlign: 'center', borderTop: '1px solid #f1f5f9' }}>
                    <div style={{ display: 'flex', justifyContent: 'center', gap: '1.5rem', marginBottom: '1rem' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.8rem', color: '#64748b' }}><Mail size={14} /> {settings?.email}</div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.8rem', color: '#64748b' }}><Phone size={14} /> {settings?.phone}</div>
                    </div>
                    <div style={{ fontSize: '0.7rem', color: '#94a3b8', opacity: 0.8 }}>
                        © {new Date().getFullYear()} {settings?.companyName}. Este es un documento seguro firmado electrónicamente bajo la Ley 527 de 1999 de Colombia.
                    </div>
                </div>
            </div>
            {/* Simple CSS Hack for Responsive Mobile */}
            <style>{`
                @media (max-width: 650px) {
                    .security-grid { grid-template-columns: 1fr !important; gap: 1rem !important; }
                    table { font-size: 0.8rem !important; }
                    th, td { padding: 0.75rem 0.5rem !important; }
                    h1 { font-size: 1.2rem !important; }
                    .canvas-container canvas { height: 120px !important; }
                }
            `}</style>
        </div>
    );
}
