import React, { useMemo, useState } from 'react';
import { format } from 'date-fns';
import { Check, Link2, ReceiptText, Trash2, Upload, X } from 'lucide-react';
import Swal from 'sweetalert2';
import { useAppContext } from '../context/AppContext';
import {
    METODOS_PAGO, buildMovimientosCajaMenor, fmtCOP, resumirMovimientos, toISODate
} from './cajaMenorUtils';
import { downloadReciboCajaPDF } from './reciboCajaPdf';

const inputStyle = {
    width: '100%', padding: '0.62rem 0.75rem', background: '#ffffff',
    border: '1px solid #cbd5e1', borderRadius: 8, color: '#104166',
    fontSize: '0.85rem', outline: 'none', boxSizing: 'border-box'
};

const labelStyle = {
    display: 'block', fontSize: '0.78rem', color: '#263777',
    fontWeight: 700, marginBottom: '0.38rem'
};

const readSignatureImage = file => new Promise((resolve, reject) => {
    if (!file) return resolve('');
    if (!['image/png', 'image/jpeg'].includes(file.type)) {
        reject(new Error('La firma debe estar en formato PNG o JPG.'));
        return;
    }
    if (file.size > 5 * 1024 * 1024) {
        reject(new Error('La imagen de firma no puede superar 5 MB.'));
        return;
    }

    const reader = new FileReader();
    reader.onerror = () => reject(new Error('No se pudo leer la imagen seleccionada.'));
    reader.onload = () => {
        const image = new Image();
        image.onerror = () => reject(new Error('La imagen de firma no es válida.'));
        image.onload = () => {
            const maxWidth = 900;
            const maxHeight = 320;
            const scale = Math.min(1, maxWidth / image.width, maxHeight / image.height);
            const canvas = document.createElement('canvas');
            canvas.width = Math.max(1, Math.round(image.width * scale));
            canvas.height = Math.max(1, Math.round(image.height * scale));
            const context = canvas.getContext('2d');
            context.clearRect(0, 0, canvas.width, canvas.height);
            context.drawImage(image, 0, 0, canvas.width, canvas.height);
            resolve(canvas.toDataURL('image/png'));
        };
        image.src = reader.result;
    };
    reader.readAsDataURL(file);
});

const signatureCardStyle = {
    border: '1px dashed #94a3b8', borderRadius: 12, padding: '0.85rem',
    background: '#f8fafc', minHeight: 150, display: 'flex',
    flexDirection: 'column', justifyContent: 'space-between', gap: '0.6rem'
};

export default function ReciboCajaModal({ onClose, movimiento = null }) {
    const {
        createReciboCaja, settings, currentUser,
        invoices = [], clients = [], ingresosCajaMenor = [],
        gastosMantenimiento = [], retirosCajaMenor = []
    } = useAppContext();
    const linked = Boolean(movimiento?.movimientoTipo && movimiento?.movimientoId);
    const initialType = movimiento?.tipo === 'Ingreso' ? 'Ingreso' : (movimiento ? 'Egreso' : 'Ingreso');

    const [form, setForm] = useState({
        tipo: initialType,
        fecha: toISODate(movimiento?.fecha) || format(new Date(), 'yyyy-MM-dd'),
        ciudad: '',
        tercero: movimiento?.tercero && movimiento.tercero !== '—' ? movimiento.tercero : '',
        identificacion: movimiento?.identificacion || '',
        concepto: movimiento?.concepto || '',
        monto: movimiento ? (movimiento.entrada || movimiento.salida || '') : '',
        metodo_pago: movimiento?.metodoPago || 'Efectivo',
        firma_empresa: '',
        firma_tercero: '',
        firmante_empresa: currentUser?.name || '',
        firmante_tercero: movimiento?.tercero && movimiento.tercero !== '—' ? movimiento.tercero : '',
        movimiento_tipo: movimiento?.movimientoTipo || '',
        movimiento_id: movimiento?.movimientoId || ''
    });
    const [loading, setLoading] = useState(false);
    const isIngreso = form.tipo === 'Ingreso';
    const saldoDisponible = useMemo(() => resumirMovimientos(buildMovimientosCajaMenor({
        invoices, clients, ingresosCajaMenor, gastosMantenimiento, retirosCajaMenor
    })).saldo, [invoices, clients, ingresosCajaMenor, gastosMantenimiento, retirosCajaMenor]);

    const directionCopy = useMemo(() => isIngreso ? {
        title: 'Recibo de ingreso',
        thirdParty: 'Recibimos de',
        companySignature: 'Firma autorizada de quien recibe',
        thirdSignature: 'Firma de quien entrega',
        color: '#059669',
        background: '#ecfdf5'
    } : {
        title: 'Recibo de egreso',
        thirdParty: 'Pagamos a',
        companySignature: 'Firma autorizada de quien entrega',
        thirdSignature: 'Firma de quien recibe',
        color: '#dc2626',
        background: '#fef2f2'
    }, [isIngreso]);

    const update = (field, value) => setForm(current => ({ ...current, [field]: value }));

    const handleSignature = async (field, file) => {
        try {
            update(field, await readSignatureImage(file));
        } catch (error) {
            Swal.fire('Firma no válida', error.message, 'warning');
        }
    };

    const handleSubmit = async event => {
        event.preventDefault();
        const monto = Number(form.monto);
        if (!form.tercero.trim() || !form.concepto.trim() || !(monto > 0)) {
            Swal.fire('Datos incompletos', 'Diligencie el tercero, el concepto y un valor mayor a cero.', 'warning');
            return;
        }
        if (!form.firma_empresa && !form.firma_tercero) {
            Swal.fire('Firma requerida', 'Cargue al menos una firma digital para generar el recibo firmado.', 'warning');
            return;
        }
        if (!linked && !isIngreso && form.metodo_pago === 'Efectivo' && monto > saldoDisponible) {
            const { isConfirmed } = await Swal.fire({
                title: 'El egreso supera el saldo',
                html: `La caja menor tiene <b>${fmtCOP(saldoDisponible)}</b> y el recibo es por <b>${fmtCOP(monto)}</b>.<br/><br/>El saldo quedará en <b>${fmtCOP(saldoDisponible - monto)}</b>.`,
                icon: 'warning',
                showCancelButton: true,
                confirmButtonText: 'Generar de todas formas',
                cancelButtonText: 'Revisar valor',
                confirmButtonColor: '#dc2626'
            });
            if (!isConfirmed) return;
        }

        setLoading(true);
        try {
            const recibo = await createReciboCaja({
                ...form,
                monto,
                firmante_tercero: form.firmante_tercero || form.tercero
            });
            downloadReciboCajaPDF(recibo, settings);
            await Swal.fire({
                icon: 'success',
                title: 'Recibo generado',
                html: `<b>${recibo.numero}</b> quedó firmado y vinculado al movimiento <b>${recibo.movimiento_id}</b>.`,
                confirmButtonColor: '#2365AB'
            });
            onClose();
        } catch (error) {
            console.error('Error generando recibo de caja:', error);
            Swal.fire('No se pudo generar', error.message || 'Ocurrió un error al guardar el recibo.', 'error');
        } finally {
            setLoading(false);
        }
    };

    const renderSignature = (field, title, signerField) => {
        const signature = form[field];
        return (
            <div style={signatureCardStyle}>
                <div>
                    <div style={{ ...labelStyle, marginBottom: '0.2rem' }}>{title}</div>
                    <div style={{ fontSize: '0.7rem', color: '#64748b' }}>PNG o JPG, máximo 5 MB</div>
                </div>
                {signature ? (
                    <div style={{ height: 62, background: '#fff', border: '1px solid #e2e8f0', borderRadius: 8, padding: 4, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <img src={signature} alt={title} style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' }} />
                    </div>
                ) : (
                    <label style={{ height: 62, borderRadius: 8, background: '#fff', border: '1px solid #e2e8f0', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7, cursor: 'pointer', color: '#2365AB', fontSize: '0.78rem', fontWeight: 700 }}>
                        <Upload size={16} /> Cargar firma digital
                        <input type="file" accept="image/png,image/jpeg" onChange={event => handleSignature(field, event.target.files?.[0])} style={{ display: 'none' }} />
                    </label>
                )}
                <input
                    type="text"
                    value={form[signerField]}
                    onChange={event => update(signerField, event.target.value)}
                    placeholder="Nombre del firmante"
                    style={{ ...inputStyle, padding: '0.48rem 0.6rem', fontSize: '0.78rem' }}
                />
                {signature && (
                    <button type="button" onClick={() => update(field, '')}
                        style={{ border: 'none', background: 'transparent', color: '#dc2626', fontSize: '0.72rem', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5 }}>
                        <Trash2 size={13} /> Quitar firma
                    </button>
                )}
            </div>
        );
    };

    return (
        <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(15, 23, 42, 0.68)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1400, padding: '1rem' }}>
            <div onClick={event => event.stopPropagation()} style={{ background: '#fff', borderRadius: 18, width: '100%', maxWidth: 820, maxHeight: '94vh', boxShadow: '0 24px 60px rgba(15, 23, 42, 0.28)', display: 'flex', flexDirection: 'column' }}>
                <div style={{ padding: '1.1rem 1.4rem', borderBottom: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '1rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                        <div style={{ width: 38, height: 38, borderRadius: 10, display: 'grid', placeItems: 'center', color: directionCopy.color, background: directionCopy.background }}>
                            <ReceiptText size={20} />
                        </div>
                        <div>
                            <h3 style={{ margin: 0, color: '#104166', fontSize: '1.1rem' }}>{directionCopy.title}</h3>
                            <div style={{ fontSize: '0.75rem', color: '#64748b', marginTop: 2 }}>Diligencie, firme y descargue el comprobante en PDF.</div>
                        </div>
                    </div>
                    <button type="button" onClick={onClose} aria-label="Cerrar" style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '50%', width: 32, height: 32, display: 'grid', placeItems: 'center', cursor: 'pointer', color: '#64748b' }}><X size={17} /></button>
                </div>

                <form onSubmit={handleSubmit} style={{ padding: '1.35rem 1.4rem', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                    {linked && (
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '0.7rem 0.85rem', background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: 10, color: '#1d4ed8', fontSize: '0.78rem' }}>
                            <Link2 size={15} /> Este recibo quedará vinculado al movimiento <b>{movimiento.movimientoId}</b>, sin registrarlo dos veces.
                        </div>
                    )}

                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(190px, 1fr))', gap: '0.85rem' }}>
                        <div>
                            <label style={labelStyle}>Tipo de recibo *</label>
                            <select value={form.tipo} onChange={event => update('tipo', event.target.value)} disabled={linked} style={{ ...inputStyle, cursor: linked ? 'not-allowed' : 'pointer', opacity: linked ? 0.7 : 1 }}>
                                <option value="Ingreso">Ingreso - Recibir dinero</option>
                                <option value="Egreso">Egreso - Entregar dinero</option>
                            </select>
                        </div>
                        <div>
                            <label style={labelStyle}>Fecha *</label>
                            <input type="date" value={form.fecha} onChange={event => update('fecha', event.target.value)} required style={inputStyle} />
                        </div>
                        <div>
                            <label style={labelStyle}>Ciudad</label>
                            <input type="text" value={form.ciudad} onChange={event => update('ciudad', event.target.value)} placeholder="Ej. Pitalito" style={inputStyle} />
                        </div>
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '0.85rem' }}>
                        <div>
                            <label style={labelStyle}>{directionCopy.thirdParty} *</label>
                            <input type="text" value={form.tercero} onChange={event => update('tercero', event.target.value)} placeholder="Nombre o razón social" required style={inputStyle} />
                        </div>
                        <div>
                            <label style={labelStyle}>Identificación CC / NIT</label>
                            <input type="text" value={form.identificacion} onChange={event => update('identificacion', event.target.value)} placeholder="Número de documento" style={inputStyle} />
                        </div>
                    </div>

                    <div>
                        <label style={labelStyle}>Por concepto de *</label>
                        <textarea value={form.concepto} onChange={event => update('concepto', event.target.value)} rows={3} required placeholder="Detalle claramente el motivo del ingreso o egreso..." style={{ ...inputStyle, resize: 'vertical' }} />
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '0.85rem' }}>
                        <div>
                            <label style={labelStyle}>Valor *</label>
                            <input type="number" min="1" step="1" value={form.monto} onChange={event => update('monto', event.target.value)} disabled={linked} required placeholder="0" style={{ ...inputStyle, opacity: linked ? 0.7 : 1 }} />
                            {Number(form.monto) > 0 && <div style={{ fontSize: '0.72rem', color: directionCopy.color, fontWeight: 700, marginTop: 4 }}>{fmtCOP(form.monto)}</div>}
                        </div>
                        <div>
                            <label style={labelStyle}>Forma de pago *</label>
                            <select value={form.metodo_pago} onChange={event => update('metodo_pago', event.target.value)} disabled={linked} style={{ ...inputStyle, cursor: linked ? 'not-allowed' : 'pointer', opacity: linked ? 0.7 : 1 }}>
                                {METODOS_PAGO.map(method => <option key={method} value={method}>{method}</option>)}
                            </select>
                            <div style={{ fontSize: '0.68rem', color: '#64748b', marginTop: 4 }}>Solo los movimientos en efectivo modifican el saldo físico de caja menor.</div>
                        </div>
                    </div>

                    <div>
                        <div style={{ ...labelStyle, marginBottom: '0.55rem' }}>Firmas digitales *</div>
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '0.85rem' }}>
                            {renderSignature('firma_empresa', directionCopy.companySignature, 'firmante_empresa')}
                            {renderSignature('firma_tercero', directionCopy.thirdSignature, 'firmante_tercero')}
                        </div>
                        <div style={{ fontSize: '0.7rem', color: '#64748b', marginTop: 6 }}>Debe cargar al menos una de las dos firmas. Ambas aparecerán en el PDF cuando estén disponibles.</div>
                    </div>

                    {!linked && (
                        <div style={{ padding: '0.75rem 0.9rem', borderRadius: 10, background: directionCopy.background, color: directionCopy.color, fontSize: '0.76rem', lineHeight: 1.45 }}>
                            Al guardar, el sistema creará automáticamente el {isIngreso ? 'ingreso' : 'egreso'} relacionado y lo mostrará en los reportes financieros. No necesita registrarlo por separado.
                        </div>
                    )}

                    <div style={{ margin: '0.3rem -1.4rem -1.35rem', padding: '1rem 1.4rem', background: '#f8fafc', borderTop: '1px solid #e2e8f0', display: 'flex', justifyContent: 'flex-end', gap: '0.7rem' }}>
                        <button type="button" className="btn btn-secondary" onClick={onClose} disabled={loading} style={{ background: '#fff', border: '1px solid #cbd5e1', color: '#334155' }}>Cancelar</button>
                        <button type="submit" className="btn btn-primary" disabled={loading} style={{ display: 'flex', alignItems: 'center', gap: 7, background: directionCopy.color, border: 'none', opacity: loading ? 0.65 : 1 }}>
                            <Check size={16} /> {loading ? 'Generando...' : 'Guardar y descargar PDF'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}
