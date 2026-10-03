import React, { useEffect, useMemo, useState } from 'react';
import { useParams } from 'react-router-dom';
import {
    ArrowLeft, BadgeCheck, Camera, Check, CheckCircle2, ChevronRight,
    CircleDollarSign, FileCheck2, FileText, IdCard, LockKeyhole, Mail,
    MapPin, Package, PenTool, Phone, ShieldCheck, Sparkles, UserRound
} from 'lucide-react';
import { SignatureCanvas, WebcamCapture, fmtCOP } from './CotizacionesHelpers';
import './PublicCotizacionApproval.css';

const API_BASE_URL = import.meta.env.VITE_API_URL || '';

const isServiceItem = (item = {}) => {
    const descriptor = [item.tipoCobro, item.category, item.esquemaCobro, item.nombre, item.name]
        .filter(Boolean).join(' ').toLowerCase();
    return ['servicio', 'única vez', 'unica vez', 'transporte', 'entrega', 'recogida', 'flete', 'acarreo']
        .some(term => descriptor.includes(term));
};

const formatDocumentDate = (date) => {
    if (!date) return '—';
    const parsed = new Date(`${date}T00:00:00`);
    if (Number.isNaN(parsed.getTime())) return date;
    return parsed.toLocaleDateString('es-CO', { day: '2-digit', month: 'long', year: 'numeric' });
};

function PortalLoader() {
    return <div className="approval-state-page"><div className="approval-loader" /><h2>Preparando tu cotización</h2><p>Estamos cargando la información de forma segura.</p></div>;
}

function PortalError() {
    return <div className="approval-state-page"><div className="approval-state-icon"><FileText size={34} /></div><h2>Documento no encontrado</h2><p>El enlace es inválido o la cotización ya no se encuentra disponible.</p></div>;
}

function CaptureCard({ number, title, description, icon: Icon, complete, children }) {
    return (
        <article className={`approval-capture-card${complete ? ' is-complete' : ''}`}>
            <div className="approval-capture-card__head">
                <div className="approval-capture-card__icon">{React.createElement(Icon, { size: 18 })}</div>
                <div><span>Paso {number}</span><h4>{title}</h4></div>
                <div className="approval-capture-card__status">{complete ? <><Check size={13} /> Listo</> : 'Pendiente'}</div>
            </div>
            <p>{description}</p>
            <div className="approval-capture-card__body">{children}</div>
        </article>
    );
}

export default function PublicCotizacionApproval() {
    const { id } = useParams();
    const [data, setData] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [step, setStep] = useState(1);
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
                if (['Aprobada', 'Facturada'].includes(json.cot.estado)) setApproved(true);
            })
            .catch(err => setError(err.message))
            .finally(() => setLoading(false));
    }, [id]);

    const quoteSummary = useMemo(() => {
        if (!data) return null;
        const { cot, client } = data;
        const subtotal = (cot.items || []).reduce((sum, item) => {
            const period = isServiceItem(item) ? 1 : (Number(item.dias) || 1);
            return sum + (Number(item.cantidad) || 0) * period * (Number(item.tarifaDia) || 0);
        }, 0);
        const ivaRate = client?.responsableIVA ? (Number(client?.porcIVA) || 0) : 0;
        const retentionRate = Number(client?.porcRetencion) || 0;
        const iva = Math.round(subtotal * ivaRate / 100);
        const retention = Math.round(subtotal * retentionRate / 100);
        const transport = Number(cot.transporte) || 0;
        const deposit = Number(cot.deposito) || 0;
        return { subtotal, ivaRate, iva, retentionRate, retention, transport, deposit, total: subtotal + iva + retention + transport + deposit };
    }, [data]);

    const goToStep = (nextStep) => {
        setStep(nextStep);
        window.scrollTo({ top: 0, behavior: 'smooth' });
    };

    const handleApprove = async () => {
        if (!firma || !foto || !fotoCC || !fotoCCBack) return;
        setSaving(true);
        try {
            const response = await fetch(`${API_BASE_URL}/api/public/cotizaciones/${id}/approve`, {
                method: 'POST', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ firma, foto, fotoCC, fotoCCBack })
            });
            if (!response.ok) throw new Error('No se pudo procesar la aprobación.');
            setApproved(true);
            setStep(1);
            window.scrollTo({ top: 0, behavior: 'smooth' });
        } catch (approvalError) {
            console.error(approvalError);
            alert('No se pudo procesar la aprobación. Intente de nuevo.');
        } finally {
            setSaving(false);
        }
    };

    if (loading) return <PortalLoader />;
    if (error || !data || !quoteSummary) return <PortalError />;

    const { cot, client, settings } = data;
    const obra = client?.obras?.find(item => item.id === cot.obraId);
    const companyName = settings?.companyName || 'CIELO ALQUILER DE EQUIPOS Y HERRAMIENTAS';
    const itemCount = (cot.items || []).length;
    const approvalReady = Boolean(firma && foto && fotoCC && fotoCCBack && !saving);

    const renderItemRows = (mobile = false) => (cot.items || []).map((item, index) => {
        const service = isServiceItem(item);
        const quantity = Number(item.cantidad) || 0;
        const period = service ? 1 : (Number(item.dias) || 1);
        const lineTotal = quantity * period * (Number(item.tarifaDia) || 0);
        const key = `${mobile ? 'mobile-' : ''}${item.productId || item.nombre}-${index}`;

        if (mobile) return (
            <article className="approval-mobile-item" key={key}>
                <div className="approval-mobile-item__top">
                    <span className="approval-item-index">{String(index + 1).padStart(2, '0')}</span>
                    <strong>{item.nombre || item.name}</strong>
                    <span className={`approval-type-pill${service ? ' is-service' : ''}`}>{service ? 'Servicio' : `${period} ${period === 1 ? 'día' : 'días'}`}</span>
                </div>
                <div className="approval-mobile-item__facts">
                    <span><small>Cantidad</small><strong>{quantity}</strong></span>
                    <span><small>Tarifa</small><strong>{fmtCOP(item.tarifaDia)}</strong></span>
                    <span><small>Subtotal</small><strong>{fmtCOP(lineTotal)}</strong></span>
                </div>
            </article>
        );

        return (
            <tr key={key}>
                <td><span className="approval-item-index">{String(index + 1).padStart(2, '0')}</span><strong>{item.nombre || item.name}</strong></td>
                <td>{quantity}</td>
                <td><span className={`approval-type-pill${service ? ' is-service' : ''}`}>{service ? 'Servicio' : `${period} ${period === 1 ? 'día' : 'días'}`}</span></td>
                <td>{fmtCOP(item.tarifaDia)}</td>
                <td>{fmtCOP(lineTotal)}</td>
            </tr>
        );
    });

    return (
        <main className="approval-page">
            <div className="approval-page__glow approval-page__glow--one" /><div className="approval-page__glow approval-page__glow--two" />
            <section className="approval-shell">
                <header className="approval-header">
                    <div className="approval-header__orb"><ShieldCheck size={168} /></div>
                    <div className="approval-brand">
                        <div className="approval-brand__logo">{settings?.logo ? <img src={settings.logo} alt={`Logo de ${companyName}`} /> : <FileCheck2 size={31} />}</div>
                        <div className="approval-brand__copy">
                            <span className="approval-brand__eyebrow"><LockKeyhole size={13} /> Portal seguro</span>
                            <h1>Portal de Aprobación Online</h1><p>{companyName}</p>
                        </div>
                    </div>
                    <div className="approval-header__document"><span>Cotización</span><strong>#{id}</strong><small><span className="approval-live-dot" /> Documento vigente</small></div>
                </header>

                {!approved && <div className="approval-progress" aria-label={`Paso ${step} de 2`}>
                    <div className={`approval-progress__step is-active${step > 1 ? ' is-done' : ''}`}><span>{step > 1 ? <Check size={14} /> : '1'}</span><div><strong>Revisar</strong><small>Datos y valores</small></div></div>
                    <div className={`approval-progress__line${step > 1 ? ' is-done' : ''}`} />
                    <div className={`approval-progress__step${step === 2 ? ' is-active' : ''}`}><span>2</span><div><strong>Confirmar</strong><small>Firma y seguridad</small></div></div>
                </div>}

                {approved ? <div className="approval-success">
                    <div className="approval-success__icon"><CheckCircle2 size={54} /></div>
                    <span className="approval-success__eyebrow"><Sparkles size={14} /> Aprobación completada</span>
                    <h2>¡Cotización aprobada correctamente!</h2>
                    <p>Recibimos la firma y el registro de seguridad para la cotización <strong>#{id}</strong>. Nuestro equipo comercial continuará con el proceso.</p>
                    <div className="approval-success__receipt"><div><FileCheck2 size={20} /><span><small>Documento</small><strong>#{id}</strong></span></div><div><BadgeCheck size={20} /><span><small>Estado</small><strong>Aprobada</strong></span></div></div>
                    <div className="approval-security-note"><LockKeyhole size={18} /><span><strong>Registro recibido de forma segura</strong><small>La empresa fue notificada para continuar con el alistamiento.</small></span></div>
                </div> : step === 1 ? <div className="approval-content">
                    <div className="approval-intro"><div><span className="approval-section-kicker">Propuesta comercial</span><h2>Revisa tu cotización</h2><p>Confirma que los datos, equipos y valores sean correctos antes de continuar con la firma.</p></div><div className="approval-secure-chip"><ShieldCheck size={17} /> Documento protegido</div></div>

                    <div className="approval-info-grid">
                        <article className="approval-info-card"><div className="approval-info-card__icon"><UserRound size={21} /></div><div className="approval-info-card__content"><span>Cliente</span><h3>{client?.name || 'Cliente'}</h3><p><IdCard size={14} /> NIT/CC {client?.nit || client?.cedula || client?.documento || '—'}</p><p><MapPin size={14} /> {obra?.nombre || 'Obra no especificada'}{obra?.ubicacion ? ` · ${obra.ubicacion}` : ''}</p></div></article>
                        <article className="approval-info-card approval-info-card--accent"><div className="approval-info-card__icon"><FileCheck2 size={21} /></div><div className="approval-info-card__content"><span>Detalles del documento</span><div className="approval-document-facts"><div><small>Nº documento</small><strong>#{id}</strong></div><div><small>Fecha de emisión</small><strong>{formatDocumentDate(cot.fecha)}</strong></div><div><small>Validez</small><strong className="is-warning">{cot.validezDias || 15} días</strong></div></div></div></article>
                    </div>

                    <section className="approval-items-section">
                        <div className="approval-items-section__head"><div><span className="approval-section-kicker">Detalle de la propuesta</span><h3>Equipos y servicios</h3></div><span className="approval-count-badge"><Package size={14} /> {itemCount} {itemCount === 1 ? 'ítem' : 'ítems'}</span></div>
                        <div className="approval-table-wrap"><table className="approval-items-table"><thead><tr><th>Descripción</th><th>Cantidad</th><th>Periodo</th><th>Tarifa</th><th>Subtotal</th></tr></thead><tbody>{renderItemRows()}</tbody></table></div>
                        <div className="approval-mobile-items">{renderItemRows(true)}</div>
                        <div className="approval-totals">
                            <div className="approval-totals__note"><CircleDollarSign size={20} /><div><strong>Valores expresados en COP</strong><span>La tarifa corresponde al periodo indicado.</span></div></div>
                            <div className="approval-totals__values">
                                <div><span>Subtotal</span><strong>{fmtCOP(quoteSummary.subtotal)}</strong></div>
                                {quoteSummary.transport > 0 && <div><span>Transporte</span><strong>{fmtCOP(quoteSummary.transport)}</strong></div>}
                                {quoteSummary.iva > 0 && <div><span>IVA ({quoteSummary.ivaRate}%)</span><strong>{fmtCOP(quoteSummary.iva)}</strong></div>}
                                {quoteSummary.retention > 0 && <div><span>Retención ({quoteSummary.retentionRate}%)</span><strong>{fmtCOP(quoteSummary.retention)}</strong></div>}
                                {quoteSummary.deposit > 0 && <div><span>Depósito reembolsable</span><strong>{fmtCOP(quoteSummary.deposit)}</strong></div>}
                                <div className="approval-totals__grand"><span>Total a aprobar</span><strong>{fmtCOP(quoteSummary.total)}</strong></div>
                            </div>
                        </div>
                    </section>
                    <div className="approval-action-panel"><div><LockKeyhole size={19} /><span><strong>Siguiente: validación segura</strong><small>Necesitarás firmar y tomar tres fotografías.</small></span></div><button type="button" onClick={() => goToStep(2)}>Aprobar y continuar <ChevronRight size={20} /></button></div>
                </div> : <div className="approval-content approval-signing">
                    <button type="button" className="approval-back-link" onClick={() => goToStep(1)}><ArrowLeft size={17} /> Volver a la cotización</button>
                    <div className="approval-intro"><div><span className="approval-section-kicker">Validación de identidad</span><h2>Firma y registro de seguridad</h2><p>Completa los cuatro registros para confirmar la aprobación de la cotización #{id}.</p></div><div className="approval-secure-chip"><LockKeyhole size={17} /> Información cifrada</div></div>
                    <div className="approval-privacy-banner"><ShieldCheck size={22} /><div><strong>Tus datos están protegidos</strong><span>Las capturas se utilizan exclusivamente para validar esta transacción.</span></div></div>
                    <CaptureCard number="1 de 4" title="Firma digital" description="Firma dentro del recuadro utilizando el dedo o el cursor." icon={PenTool} complete={Boolean(firma)}><div className="approval-signature-pad"><SignatureCanvas onSave={setFirma} onClear={() => setFirma(null)} /></div></CaptureCard>
                    <div className="approval-camera-grid">
                        <CaptureCard number="2 de 4" title="Foto de rostro" description="Ubica tu rostro de frente y con buena iluminación." icon={UserRound} complete={Boolean(foto)}><WebcamCapture onCapture={setFoto} /></CaptureCard>
                        <CaptureCard number="3 de 4" title="Documento frontal" description="Asegúrate de que los datos sean legibles." icon={IdCard} complete={Boolean(fotoCC)}><WebcamCapture onCapture={setFotoCC} /></CaptureCard>
                        <CaptureCard number="4 de 4" title="Documento posterior" description="Captura la cara posterior completa." icon={Camera} complete={Boolean(fotoCCBack)}><WebcamCapture onCapture={setFotoCCBack} /></CaptureCard>
                    </div>
                    <div className="approval-final-actions"><button type="button" className="approval-secondary-button" onClick={() => goToStep(1)}><ArrowLeft size={18} /> Atrás</button><button type="button" className="approval-primary-button" onClick={handleApprove} disabled={!approvalReady}>{saving ? <><span className="approval-button-loader" /> Procesando...</> : <><CheckCircle2 size={20} /> Confirmar aprobación</>}</button></div>
                    {!approvalReady && !saving && <p className="approval-required-note">Completa la firma y las tres fotografías para habilitar la aprobación.</p>}
                </div>}

                <footer className="approval-footer">
                    <div className="approval-footer__brand"><ShieldCheck size={18} /><span><strong>Proceso seguro</strong><small>Documento electrónico verificable</small></span></div>
                    <div className="approval-footer__contact">{settings?.email && <a href={`mailto:${settings.email}`}><Mail size={14} /> {settings.email}</a>}{settings?.phone && <a href={`tel:${settings.phone}`}><Phone size={14} /> {settings.phone}</a>}</div>
                    <p>© {new Date().getFullYear()} {companyName}. Firma electrónica conforme a la Ley 527 de 1999 de Colombia.</p>
                </footer>
            </section>
        </main>
    );
}
