import React, { useState, useMemo, useRef, useEffect, useCallback } from 'react';
import {
    FilePlus, Search, CheckCircle, XCircle, Clock, Send,
    X, ChevronRight, Plus, FileText, Shield, Camera,
    PenTool, Fingerprint, Download, AlertTriangle, Eye,
    MapPin, Package, Truck, CreditCard, Calendar
} from 'lucide-react';
import { useAppContext } from '../context/AppContext';
import { format, addDays } from 'date-fns';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

// ─── Constants ────────────────────────────────────────────────────────────────
const ESTADO_CFG = {
    'Borrador': { color: '#94a3b8', bg: 'rgba(148,163,184,0.12)', icon: Clock },
    'Enviada': { color: '#f97316', bg: 'rgba(249,115,22,0.12)', icon: Send },
    'Aprobada': { color: '#10b981', bg: 'rgba(16,185,129,0.12)', icon: CheckCircle },
    'Rechazada': { color: '#ef4444', bg: 'rgba(239,68,68,0.12)', icon: XCircle },
};

const fmtCOP = n => `$${(n || 0).toLocaleString('es-CO')}`;

// ─── PDF generators ───────────────────────────────────────────────────────────
function generateContratoPDF(cot, client, obra) {
    const doc = new jsPDF();
    const W = doc.internal.pageSize.getWidth();
    doc.setFillColor(30, 41, 59); doc.rect(0, 0, W, 38, 'F');
    doc.setFont('helvetica', 'bold'); doc.setFontSize(18); doc.setTextColor(255, 255, 255);
    doc.text('CONTRATO DE ALQUILER DE EQUIPOS', W / 2, 18, { align: 'center' });
    doc.setFontSize(10); doc.setFont('helvetica', 'normal');
    doc.text(`CIELO — Alquiler de Equipos y Herramientas | ${cot.id}`, W / 2, 28, { align: 'center' });
    doc.text(`Fecha: ${cot.fecha}`, W / 2, 35, { align: 'center' });

    doc.setTextColor(30, 41, 59); doc.setFontSize(11); doc.setFont('helvetica', 'bold');
    doc.text('PARTES DEL CONTRATO', 14, 50);
    doc.setFont('helvetica', 'normal'); doc.setFontSize(9);
    doc.text(`ARRENDADOR: CIELO — Alquiler de Equipos y Herramientas | NIT: 900.XXX.XXX-X`, 14, 58);
    doc.text(`ARRENDATARIO: ${client?.name || '—'} | NIT/CC: ${client?.nit || '—'} | ${client?.type || ''}`, 14, 65);
    doc.text(`Obra Destino: ${obra?.nombre || '—'} — ${obra?.ubicacion || '—'}`, 14, 72);

    doc.setFont('helvetica', 'bold'); doc.setFontSize(11);
    doc.text('OBJETO DEL CONTRATO', 14, 84);
    doc.setFont('helvetica', 'normal'); doc.setFontSize(9);
    const objeto = `El ARRENDADOR entrega en calidad de alquiler al ARRENDATARIO los equipos y herramientas descritos en el anexo de la presente cotización ${cot.id}, para ser utilizados exclusivamente en la obra indicada, bajo los términos y condiciones aquí establecidos.`;
    doc.text(doc.splitTextToSize(objeto, W - 28), 14, 92);

    autoTable(doc, {
        startY: 110,
        head: [['Equipo / Herramienta', 'Cant.', 'Días', 'Tarifa/día', 'Subtotal']],
        body: cot.items.map(i => [i.nombre, i.cantidad, i.dias, fmtCOP(i.tarifaDia), fmtCOP(i.cantidad * i.dias * i.tarifaDia)]),
        headStyles: { fillColor: [30, 41, 59], textColor: 255, fontSize: 9 },
        styles: { fontSize: 9 },
        foot: [['', '', '', 'TOTAL ANTES DE IMP.', fmtCOP(cot.items.reduce((s, i) => s + (i.cantidad * i.dias * i.tarifaDia), 0) + cot.transporte)]],
        footStyles: { fontStyle: 'bold', fillColor: [241, 245, 249] },
    });

    const y = doc.lastAutoTable.finalY + 10;
    doc.setFont('helvetica', 'bold'); doc.setFontSize(10);
    doc.text('CLÁUSULAS GENERALES', 14, y);
    doc.setFont('helvetica', 'normal'); doc.setFontSize(8.5);
    const clausulas = [
        '1. El ARRENDATARIO se compromete a utilizar los equipos únicamente en la obra indicada y a devolverlos en perfectas condiciones de funcionamiento.',
        '2. Cualquier daño, pérdida o robo de los equipos será de responsabilidad exclusiva del ARRENDATARIO.',
        '3. Los días de alquiler se calculan desde la fecha indicada en cada remisión hasta su correspondiente devolución (lógica PEPS).',
        '4. El incumplimiento en el pago generará intereses de mora del 1.5% mensual sobre el saldo pendiente.',
        '5. Este contrato se rige por las leyes colombianas. Las partes se someten a los jueces competentes de la ciudad de Bogotá D.C.',
        '6. Forma de pago: ' + (cot.metodoPago || 'Acordada entre las partes.'),
        '7. Transporte: ' + (cot.responsableTransporte || 'Acordado entre las partes.'),
    ];
    clausulas.forEach((c, idx) => { doc.text(doc.splitTextToSize(c, W - 28), 14, y + 10 + idx * 10); });

    const sigY = y + 90;
    doc.setFont('helvetica', 'bold'); doc.setFontSize(10);
    doc.text('FIRMAS', 14, sigY);
    doc.line(14, sigY + 20, 95, sigY + 20); doc.line(115, sigY + 20, W - 14, sigY + 20);
    doc.setFontSize(8); doc.setFont('helvetica', 'normal');
    doc.text('ARRENDADOR: CIELO', 14, sigY + 25); doc.text(`ARRENDATARIO: ${client?.name || '—'}`, 115, sigY + 25);
    doc.text('Firma y Sello', 14, sigY + 31); doc.text('Firma y/o Huella', 115, sigY + 31);

    doc.save(`Contrato_${cot.id}.pdf`);
}

function generatePagarePDF(cot, client) {
    const doc = new jsPDF();
    const W = doc.internal.pageSize.getWidth();
    doc.setFillColor(30, 41, 59); doc.rect(0, 0, W, 30, 'F');
    doc.setFont('helvetica', 'bold'); doc.setFontSize(20); doc.setTextColor(255, 255, 255);
    doc.text('PAGARÉ', W / 2, 20, { align: 'center' });

    doc.setTextColor(30, 41, 59); doc.setFontSize(10); doc.setFont('helvetica', 'normal');
    const total = cot.items.reduce((s, i) => s + (i.cantidad * i.dias * i.tarifaDia), 0) + cot.transporte;
    const texto = `Yo, ${client?.name || '—'}, identificado con NIT/CC ${client?.nit || '—'}, actuando en nombre de la empresa ${client?.name || '—'}, me comprometo incondicionalmente a pagar a la orden de CIELO — Alquiler de Equipos y Herramientas, la suma de ${fmtCOP(total)} (${total.toLocaleString()} pesos colombianos), más los intereses de mora pactados, en los plazos y condiciones establecidos en el Contrato de Alquiler ${cot.id} suscrito en la misma fecha.`;
    doc.text(doc.splitTextToSize(texto, W - 28), 14, 50);

    doc.setFont('helvetica', 'bold'); doc.setFontSize(10);
    doc.text('Datos del Deudor:', 14, 95);
    doc.setFont('helvetica', 'normal'); doc.setFontSize(9);
    [['Nombre/Razón Social', client?.name || '—'], ['NIT/CC', client?.nit || '—'], ['Dirección', client?.address || '—'], ['Ciudad', 'Colombia'], ['Fecha de Suscripción', cot.fecha], ['Valor Total', fmtCOP(total)]].forEach(([k, v], i) => {
        doc.text(`${k}: ${v}`, 14, 105 + i * 8);
    });

    doc.line(14, 170, 95, 170); doc.line(115, 170, W - 14, 170);
    doc.setFontSize(8);
    doc.text('Firma del Deudor', 14, 176); doc.text('C.C./NIT Deudor', 115, 176);
    doc.line(14, 195, 95, 195);
    doc.text('Huella Digital (si aplica)', 14, 201);

    doc.save(`Pagare_${cot.id}.pdf`);
}

function generateCartaPDF(cot, client) {
    const doc = new jsPDF();
    const W = doc.internal.pageSize.getWidth();
    doc.setFillColor(30, 41, 59); doc.rect(0, 0, W, 30, 'F');
    doc.setFont('helvetica', 'bold'); doc.setFontSize(14); doc.setTextColor(255, 255, 255);
    doc.text('CARTA DE INSTRUCCIONES DEL PAGARÉ', W / 2, 20, { align: 'center' });
    doc.setTextColor(30, 41, 59); doc.setFontSize(10); doc.setFont('helvetica', 'normal');
    const total = cot.items.reduce((s, i) => s + (i.cantidad * i.dias * i.tarifaDia), 0) + cot.transporte;
    const texto = `Señores CIELO — Alquiler de Equipos y Herramientas.\n\nPor medio de la presente, yo ${client?.name || '—'}, identificado con NIT/CC ${client?.nit || '—'}, autorizo de manera irrevocable a diligenciar el pagaré suscrito en la misma fecha correspondiente al Contrato ${cot.id} bajo las siguientes instrucciones:\n\n1. El pagaré podrá ser llenado por el valor total adeudado más los intereses de mora causados.\n2. Podrá ser cobrado a partir del vencimiento del plazo pactado: ${cot.metodoPago}.\n3. Si el pago no se realiza en la fecha acordada, CIELO queda autorizada para iniciar cobro judicial de inmediato.\n4. El deudor renuncia expresamente al beneficio de excusión.\n\nEl presente pagaré ha sido suscrito en condición de ser llenado (pagaré en blanco) conforme a la presente carta de instrucciones, la cual tiene plena validez jurídica conforme a la ley colombiana.`;
    doc.text(doc.splitTextToSize(texto, W - 28), 14, 45);

    doc.line(14, 220, 95, 220); doc.line(115, 220, W - 14, 220);
    doc.setFontSize(8);
    doc.text(`Deudor: ${client?.name || '—'}`, 14, 226); doc.text('Representante CIELO', 115, 226);
    doc.text(`Fecha: ${cot.fecha}`, 14, 232);
    doc.save(`CartaInstrucciones_${cot.id}.pdf`);
}

// ─── Firma Digital Canvas ─────────────────────────────────────────────────────
function SignatureCanvas({ onSave, onClear }) {
    const canvasRef = useRef(null);
    const drawing = useRef(false);

    const getPos = (e, canvas) => {
        const rect = canvas.getBoundingClientRect();
        const src = e.touches ? e.touches[0] : e;
        return { x: src.clientX - rect.left, y: src.clientY - rect.top };
    };

    const start = useCallback((e) => {
        e.preventDefault();
        const canvas = canvasRef.current; const ctx = canvas.getContext('2d');
        const pos = getPos(e, canvas);
        drawing.current = true;
        ctx.beginPath(); ctx.moveTo(pos.x, pos.y);
    }, []);

    const draw = useCallback((e) => {
        if (!drawing.current) return;
        e.preventDefault();
        const canvas = canvasRef.current; const ctx = canvas.getContext('2d');
        const pos = getPos(e, canvas);
        ctx.lineWidth = 2.5; ctx.lineCap = 'round'; ctx.strokeStyle = '#1e293b';
        ctx.lineTo(pos.x, pos.y); ctx.stroke();
    }, []);

    const stop = useCallback(() => {
        drawing.current = false;
        onSave(canvasRef.current.toDataURL());
    }, [onSave]);

    const clear = () => {
        const canvas = canvasRef.current;
        canvas.getContext('2d').clearRect(0, 0, canvas.width, canvas.height);
        onClear();
    };

    return (
        <div>
            <canvas ref={canvasRef} width={480} height={160}
                style={{ border: '1px solid #cbd5e1', borderRadius: 8, cursor: 'crosshair', touchAction: 'none', background: 'white', display: 'block', width: '100%' }}
                onMouseDown={start} onMouseMove={draw} onMouseUp={stop} onMouseLeave={stop}
                onTouchStart={start} onTouchMove={draw} onTouchEnd={stop}
            />
            <button onClick={clear} style={{ marginTop: 6, fontSize: '0.75rem', color: '#ef4444', background: 'none', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4 }}>
                <X size={12} /> Borrar firma
            </button>
        </div>
    );
}

// ─── Webcam Capture ───────────────────────────────────────────────────────────
function WebcamCapture({ onCapture }) {
    const videoRef = useRef(null);
    const [active, setActive] = useState(false);
    const [photo, setPhoto] = useState(null);
    const streamRef = useRef(null);

    const startCam = async () => {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ video: true });
            streamRef.current = stream;
            videoRef.current.srcObject = stream;
            setActive(true);
        } catch { alert('No se pudo acceder a la cámara.'); }
    };

    const capture = () => {
        const canvas = document.createElement('canvas');
        canvas.width = videoRef.current.videoWidth; canvas.height = videoRef.current.videoHeight;
        canvas.getContext('2d').drawImage(videoRef.current, 0, 0);
        const dataUrl = canvas.toDataURL('image/jpeg');
        setPhoto(dataUrl); onCapture(dataUrl);
        streamRef.current?.getTracks().forEach(t => t.stop()); setActive(false);
    };

    const reset = () => { setPhoto(null); onCapture(null); };

    return (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.75rem' }}>
            {photo ? (
                <div style={{ textAlign: 'center' }}>
                    <img src={photo} alt="Foto" style={{ width: 200, borderRadius: 8, border: '2px solid #10b981' }} />
                    <button onClick={reset} style={{ display: 'block', margin: '6px auto 0', fontSize: '0.75rem', color: '#ef4444', background: 'none', border: 'none', cursor: 'pointer' }}>Tomar otra</button>
                </div>
            ) : (
                <>
                    <video ref={videoRef} autoPlay style={{ width: active ? 280 : 0, height: active ? 'auto' : 0, borderRadius: 8, border: active ? '1px solid #3b82f6' : 'none' }} />
                    {!active ? (
                        <button onClick={startCam} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '0.6rem 1.25rem', borderRadius: 8, background: '#3b82f6', color: 'white', border: 'none', cursor: 'pointer', fontWeight: 700, fontSize: '0.82rem' }}>
                            <Camera size={15} /> Activar Cámara
                        </button>
                    ) : (
                        <button onClick={capture} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '0.6rem 1.25rem', borderRadius: 8, background: '#10b981', color: 'white', border: 'none', cursor: 'pointer', fontWeight: 700, fontSize: '0.82rem' }}>
                            <Camera size={15} /> Capturar Foto
                        </button>
                    )}
                </>
            )}
        </div>
    );
}

// ─── Habeas Data Modal ────────────────────────────────────────────────────────
const HABEAS_TEXT = `De conformidad con la Ley 1581 de 2012 y el Decreto 1377 de 2013 (Régimen de Protección de Datos Personales), CIELO — Alquiler de Equipos y Herramientas, con NIT 900.XXX.XXX-X, en calidad de Responsable del Tratamiento, informa:

Sus datos personales (nombre, identificación, dirección, teléfono, correo electrónico, firma digital, huella dactilar y fotografía) serán tratados con las siguientes finalidades: (1) Gestión comercial y facturación, (2) Ejecución del contrato de alquiler, (3) Cobro de cartera, y (4) Cumplimiento de obligaciones legales.

Sus datos NO serán vendidos ni cedidos a terceros sin su autorización. Usted tiene derecho a conocer, actualizar, rectificar y suprimir sus datos personales. Para ejercer estos derechos comuníquese a: cielo@empresa.co.

Las firmas digitales y datos biométricos recopilados están protegidos mediante encriptación AES-256 y sólo pueden ser consultados por personal autorizado de CIELO, en cumplimiento de los estándares de seguridad exigidos por la Ley.

Al marcar la casilla de aceptación, el titular declara haber leído, entendido y aceptado el presente aviso de privacidad y autoriza expresamente el tratamiento de sus datos personales para los fines indicados.`;

function HabeasDataModal({ onAccept, onClose }) {
    const [checked, setChecked] = useState(false);
    return (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.8)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1100, padding: '1rem' }}>
            <div style={{ background: '#ffffff', borderRadius: 14, width: '100%', maxWidth: 580, maxHeight: '90vh', display: 'flex', flexDirection: 'column', overflow: 'hidden', boxShadow: '0 25px 80px rgba(0,0,0,0.5)' }}>
                <div style={{ background: '#1e293b', padding: '1.25rem 1.5rem', display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                    <Shield size={20} style={{ color: '#3b82f6' }} />
                    <div style={{ flex: 1 }}>
                        <div style={{ fontWeight: 800, color: 'white', fontSize: '1rem' }}>Autorización de Habeas Data</div>
                        <div style={{ fontSize: '0.72rem', color: 'rgba(255,255,255,0.65)', marginTop: 2 }}>Ley 1581 de 2012 — Protección de Datos Personales</div>
                    </div>
                    <button onClick={onClose} style={{ background: 'rgba(255,255,255,0.1)', border: 'none', borderRadius: 6, color: 'white', cursor: 'pointer', padding: '0.3rem', display: 'flex' }}><X size={16} /></button>
                </div>
                <div style={{ flex: 1, padding: '1.25rem 1.5rem', overflowY: 'auto', whiteSpace: 'pre-wrap', fontSize: '0.82rem', color: '#334155', lineHeight: 1.7 }}>
                    {HABEAS_TEXT}
                </div>
                <div style={{ padding: '1rem 1.5rem', borderTop: '1px solid #e2e8f0', background: '#f8fafc' }}>
                    <label style={{ display: 'flex', alignItems: 'flex-start', gap: '0.75rem', cursor: 'pointer', marginBottom: '1rem' }}>
                        <input type="checkbox" checked={checked} onChange={e => setChecked(e.target.checked)} style={{ marginTop: 3, accentColor: '#3b82f6', width: 16, height: 16, flexShrink: 0 }} />
                        <span style={{ fontSize: '0.82rem', color: '#334155', fontWeight: 600 }}>He leído y acepto el tratamiento de mis datos personales bajo los términos de la Ley 1581 de 2012.</span>
                    </label>
                    <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end' }}>
                        <button onClick={onClose} style={{ padding: '0.55rem 1.25rem', borderRadius: 8, background: 'transparent', border: '1px solid #cbd5e1', color: '#64748b', cursor: 'pointer', fontWeight: 600, fontSize: '0.85rem' }}>Cancelar</button>
                        <button disabled={!checked} onClick={() => onAccept(new Date().toISOString())}
                            style={{ padding: '0.55rem 1.25rem', borderRadius: 8, background: checked ? '#3b82f6' : '#cbd5e1', color: 'white', border: 'none', cursor: checked ? 'pointer' : 'not-allowed', fontWeight: 700, fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: 5 }}>
                            <Shield size={14} /> Aceptar y Continuar
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}

export { generateContratoPDF, generatePagarePDF, generateCartaPDF, SignatureCanvas, WebcamCapture, HabeasDataModal, ESTADO_CFG, fmtCOP };
