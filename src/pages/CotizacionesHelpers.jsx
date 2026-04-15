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
import { applyStandardLayout, drawInfoGrid } from './pdfTheme';

// ─── Constants ────────────────────────────────────────────────────────────────
const ESTADO_CFG = {
    'Borrador': { color: '#94a3b8', bg: 'rgba(148,163,184,0.12)', icon: Clock },
    'Enviada': { color: '#f97316', bg: 'rgba(249,115,22,0.12)', icon: Send },
    'Aprobada': { color: '#10b981', bg: 'rgba(16,185,129,0.12)', icon: CheckCircle },
    'Rechazada': { color: '#ef4444', bg: 'rgba(239,68,68,0.12)', icon: XCircle },
    'Facturada': { color: '#6366f1', bg: 'rgba(99,102,241,0.12)', icon: FileText },
};

const fmtCOP = n => `$${(Number(n) || 0).toLocaleString('es-CO')}`;

// ─── PDF Cotización al Cliente (Nuevo Formato Profesional) ────────────────────────
function generateCotizacionPDF(cot, client, obra, settings) {
    try {
        const doc = new jsPDF();
        const W = doc.internal.pageSize.getWidth();
        const H = doc.internal.pageSize.getHeight();
        const margin = 10;
        const fmtN = n => (Number(n) || 0).toLocaleString('es-CO');

        // --- ENCABEZADO Y GRID ---
        let y = applyStandardLayout(doc, 'COTIZACIÓN', settings, cot.id);

        const fCot = cot.fecha || format(new Date(), 'yyyy-MM-dd');
        const fVen = format(addDays(new Date(fCot), cot.validezDias || 15), 'yyyy-MM-dd');

        y = drawInfoGrid(doc, y, client, {
            valTopLeft: fCot,
            valTopRight: fVen,
            labelTopLeft: 'Fecha Cotización',
            labelTopRight: 'Fecha Vencimiento',
            valMidLeft: obra?.nombre?.substring(0, 20) || cot.obraId || '—',
            valMidRight: cot.metodoPago?.toUpperCase() || 'CONTADO',
            valBottom: cot.responsableTransporte?.toUpperCase() || 'CLIENTE',
            obraDireccion: obra?.ubicacion || client?.direccion
        });

        // y ya incluye el margen de 10px después del grid

        // --- TABLA DE ITEMS ESTILO PROFESIONAL ---
        const subtotal = cot.items.reduce((s, i) => s + (Number(i.cantidad) * Number(i.dias) * Number(i.tarifaDia)), 0);
        const porcIVA = client?.responsableIVA ? (client?.porcIVA || 0) : 0;
        const porcRet = client?.porcRetencion || 0;
        const iva = Math.round(subtotal * porcIVA / 100);
        const ret = Math.round(subtotal * porcRet / 100);
        const total = subtotal + iva + ret + Number(cot.transporte || 0);

        autoTable(doc, {
            startY: y,
            margin: { left: margin, right: margin },
            head: [['ITE', 'EQUIPO / DESCRIPCIÓN', 'CANT.', 'DÍAS', 'TAR./DÍA', 'VR. TOTAL']],
            body: cot.items.map((i, idx) => [
                idx + 1,
                i.nombre.toUpperCase(),
                i.cantidad,
                i.dias,
                fmtN(i.tarifaDia),
                fmtN(Number(i.cantidad) * Number(i.dias) * Number(i.tarifaDia))
            ]),
            theme: 'plain',
            headStyles: { 
                fillColor: [241, 245, 249], 
                textColor: [30, 41, 59], 
                fontSize: 7.5, 
                fontStyle: 'bold', 
                halign: 'center',
                lineWidth: 0.1,
                lineColor: [30, 41, 59]
            },
            styles: { 
                fontSize: 7.5, 
                cellPadding: 2, 
                textColor: [30, 41, 59], 
                halign: 'center',
                lineWidth: 0.1,
                lineColor: [30, 41, 59]
            },
            columnStyles: {
                0: { cellWidth: 10 },
                1: { halign: 'left', cellWidth: 'auto' },
                2: { cellWidth: 15 },
                3: { cellWidth: 15 },
                4: { halign: 'right', cellWidth: 25 },
                5: { halign: 'right', cellWidth: 30, fontStyle: 'bold' }
            }
        });

        y = doc.lastAutoTable.finalY;

        // --- SECCIÓN DE TOTALES Y OBSERVACIONES ---
        const footerY = y;
        const obsW = W - margin * 2 - 80;
        
        // Recuadro Observaciones / Son
        doc.setLineWidth(0.2);
        doc.rect(margin, footerY, obsW, 35);
        doc.setFontSize(7.5);
        doc.setFont('helvetica', 'bold');
        doc.text('COTIZACIÓN EN PESOS (COP)', margin + 2, footerY + 5);
        
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(7);
        if (cot.notas) {
            const splitNotas = doc.splitTextToSize(`Notas: ${cot.notas}`, obsW - 4);
            doc.text(splitNotas, margin + 2, footerY + 12);
        }

        // Columna de Totales (Derecha)
        const totX = W - margin - 80;
        const totH = 7;
        
        const totals = [
            ['SUB-TOTAL', fmtN(subtotal)],
            ['DESCUENTO', '0'],
            ['SUB-TOTAL', fmtN(subtotal)],
            [`IVA (${porcIVA}%)`, fmtN(iva)],
            [`RETENCIÓN (${porcRet}%)`, fmtN(ret)],
            ['TRANSPORTE', fmtN(cot.transporte || 0)]
        ];

        let ty = footerY;
        totals.forEach(([label, value]) => {
            doc.rect(totX, ty, 50, totH);
            doc.rect(totX + 50, ty, 30, totH);
            doc.setFontSize(7);
            doc.setFont('helvetica', 'bold');
            doc.text(label, totX + 2, ty + 4.5);
            doc.setFont('helvetica', 'normal');
            doc.text(value, totX + 78, ty + 4.5, { align: 'right' });
            ty += totH;
        });

        // Gran Total Box
        doc.setFillColor(241, 245, 249);
        doc.rect(totX, ty, 50, 9, 'F');
        doc.rect(totX, ty, 50, 9, 'S');
        doc.rect(totX + 50, ty, 30, 9, 'S');
        doc.setFontSize(9);
        doc.setFont('helvetica', 'extrabold');
        doc.text('TOTAL', totX + 2, ty + 6);
        doc.text(`$${fmtN(total)}`, totX + 78, ty + 6, { align: 'right' });

        y = ty + 20;

        // --- PIE DE PÁGINA (LEGAL Y FIRMAS) ---
        doc.setFontSize(6.5);
        doc.setFont('helvetica', 'normal');
        const legalText = `Esta cotización se asimila para todos sus efectos a una oferta mercantil. El cliente entiende que la aprobación de la misma implica la aceptación de los términos y condiciones de alquiler de ${settings?.shortName || 'la empresa'}. Los precios aquí expresados tienen una validez de ${cot.validezDias || 15} días calendario.`;
        const splitLegal = doc.splitTextToSize(legalText, W - margin * 2 - 40);
        doc.text(splitLegal, margin, y);

        // Espacio para QR simulado
        doc.setDrawColor(200);
        doc.rect(W - margin - 30, y - 5, 30, 30);
        doc.setFontSize(5);
        doc.text('CÓDIGO DE', W - margin - 15, y + 10, { align: 'center' });
        doc.text('VERIFICACIÓN', W - margin - 15, y + 13, { align: 'center' });

        // Firmas
        y += 40;
        doc.setDrawColor(30, 41, 59);
        doc.line(margin, y, margin + 60, y);
        doc.line(W - margin - 60, y, W - margin, y);

        // Dibujar firma del cliente si existe
        if (cot.firma) {
            try {
                // Dibujamos la firma centrada sobre la línea de la derecha
                doc.addImage(cot.firma, 'PNG', W - margin - 60, y - 25, 60, 25);
            } catch (e) {
                console.error('Error adding client signature to PDF:', e);
            }
        }

        doc.setFontSize(7.5);
        doc.text('Firma Autorizada', margin + 30, y + 4, { align: 'center' });
        doc.text('Aceptado Cliente', W - margin - 30, y + 4, { align: 'center' });

        doc.save(`Cotizacion_${cot.id}.pdf`);
    } catch (error) {
        console.error('Error generating PDF:', error);
        alert('Error al generar el PDF de cotización.');
    }
}

// ─── PDF generators ───────────────────────────────────────────────────────────
function generateContratoPDF(cot, client, obra, settings) {
    try {
        const doc = new jsPDF();
        const W = doc.internal.pageSize.getWidth();
        const H = doc.internal.pageSize.getHeight();
        let y = applyStandardLayout(doc, 'Contrato de Alquiler', settings, cot.id);
        const margin = 10;

        y = drawInfoGrid(doc, y, client, {
            valTopLeft: cot.fecha || format(new Date(), 'yyyy-MM-dd'),
            valTopRight: 'Vigente',
            labelTopRight: 'Vigencia',
            valMidLeft: obra?.nombre?.substring(0, 20) || cot.obraId || '—',
            valMidRight: cot.metodoPago?.toUpperCase() || 'CONTADO',
            valBottom: cot.responsableTransporte?.toUpperCase() || 'CLIENTE',
            obraDireccion: obra?.ubicacion || client?.direccion
        });

        doc.setTextColor(30, 41, 59); doc.setFontSize(10); doc.setFont('helvetica', 'bold');
        doc.text('PARTES DEL CONTRATO', margin, y);
        doc.setFont('helvetica', 'normal'); doc.setFontSize(8.5);
        doc.text(`ARRENDADOR: ${settings?.companyName || 'CIELO'} — Alquiler de Equipos y Herramientas | NIT: ${settings?.nit || '900.XXX.XXX-X'}`, margin, y + 8);
        doc.text(`ARRENDATARIO: ${client?.name || '—'} | NIT/CC: ${client?.nit || '—'} | ${client?.type || ''}`, margin, y + 14);
        doc.text(`Obra Destino: ${obra?.nombre || '—'} — ${obra?.ubicacion || '—'}`, margin, y + 20);

        y += 32;
        doc.setFont('helvetica', 'bold'); doc.setFontSize(10);
        doc.text('OBJETO DEL CONTRATO', margin, y);
        doc.setFont('helvetica', 'normal'); doc.setFontSize(8.5);
        const objeto = `El ARRENDADOR entrega en calidad de alquiler al ARRENDATARIO los equipos y herramientas descritos en el anexo de la presente cotización ${cot.id}, para ser utilizados exclusivamente en la obra indicada, bajo los términos y condiciones aquí establecidos.`;
        doc.text(doc.splitTextToSize(objeto, W - margin * 2), margin, y + 8);

        y += 18;
        autoTable(doc, {
            startY: y,
            margin: { left: margin, right: margin },
            head: [['ITE', 'EQUIPO / HERRAMIENTA', 'CAN.', 'DÍAS', 'TARIFA/DÍA', 'SUBTOTAL']],
            body: cot.items.map((i, idx) => [
                idx + 1,
                i.nombre.toUpperCase(),
                i.cantidad,
                i.dias,
                i.tarifaDia.toLocaleString('es-CO'),
                (i.cantidad * i.dias * i.tarifaDia).toLocaleString('es-CO')
            ]),
            theme: 'plain',
            headStyles: { 
                fillColor: [241, 245, 249], 
                textColor: [30, 41, 59], 
                fontSize: 7.5, 
                fontStyle: 'bold', 
                halign: 'center',
                lineWidth: 0.1,
                lineColor: [30, 41, 59]
            },
            styles: { 
                fontSize: 7.5, 
                cellPadding: 2, 
                textColor: [30, 41, 59], 
                halign: 'center',
                lineWidth: 0.1,
                lineColor: [30, 41, 59]
            },
            columnStyles: {
                0: { cellWidth: 8 },
                1: { halign: 'left', cellWidth: 'auto' },
                2: { cellWidth: 12 },
                3: { cellWidth: 12 },
                4: { halign: 'right', cellWidth: 25 },
                5: { halign: 'right', cellWidth: 30, fontStyle: 'bold' }
            },
            foot: [['', '', '', '', 'TOTAL ANTES DE IMP.', (cot.items.reduce((s, i) => s + (i.cantidad * i.dias * i.tarifaDia), 0) + (Number(cot.transporte) || 0)).toLocaleString('es-CO')]],
            footStyles: { fontStyle: 'bold', fillColor: [241, 245, 249], textColor: [30, 41, 59], halign: 'right', lineWidth: 0.1, lineColor: [30, 41, 59] },
        });

        let currentY = doc.lastAutoTable.finalY + 12;
        doc.setFont('helvetica', 'bold'); doc.setFontSize(10);
        doc.text('CLÁUSULAS GENERALES', margin, currentY);
        doc.setFont('helvetica', 'normal'); doc.setFontSize(8);
        
        currentY += 8;
        const clausulas = (cot.clausulas && cot.clausulas.length > 0) ? cot.clausulas : [
            '1. El ARRENDATARIO se compromete a utilizar los equipos únicamente en la obra indicada y a devolverlos en perfectas condiciones de funcionamiento.',
            '2. Cualquier daño, pérdida o robo de los equipos será de responsabilidad exclusiva del ARRENDATARIO.',
            '3. Los días de alquiler se calculan desde la fecha indicada en cada remisión hasta su correspondiente devolución (lógica PEPS).',
            '4. El incumplimiento en el pago generará intereses de mora del 1.5% mensual sobre el saldo pendiente.',
            '5. Este contrato se rige por las leyes colombianas. Las partes se someten a los jueces competentes de la ciudad de Bogotá D.C.',
            '6. Forma de pago: ' + (cot.metodoPago || 'Acordada entre las partes.'),
            '7. Transporte: ' + (cot.responsableTransporte || 'Acordado entre las partes.'),
        ];

        clausulas.forEach((c, idx) => { 
            if (!c) return;
            const splitText = doc.splitTextToSize(c, W - margin * 2);
            // Salto de página si no cabe la cláusula
            if (currentY + (splitText.length * 4) > H - 40) {
                doc.addPage();
                currentY = applyStandardLayout(doc, 'Contrato de Alquiler', settings, cot.id);
                doc.setFont('helvetica', 'normal'); doc.setFontSize(8);
            }
            doc.text(splitText, margin, currentY);
            currentY += (splitText.length * 4) + 2;
        });

        // Asegurarse de que las firmas no queden cortadas al final
        if (currentY + 25 > H) {
            doc.addPage();
            currentY = applyStandardLayout(doc, 'Contrato de Alquiler', settings, cot.id);
        }

        // Firmas y Huella
        const sigY = Math.min(H - 40, currentY + 20);
        doc.setDrawColor(30, 41, 59);
        doc.line(margin, sigY, margin + 60, sigY); 
        doc.line(W - margin - 60, sigY, W - margin, sigY);

        // Si hay firma digital, dibujarla sobre la línea del arrendatario
        if (cot.firma) {
            try {
                doc.addImage(cot.firma, 'PNG', W - margin - 60, sigY - 25, 60, 25);
            } catch (e) { console.error('Error adding signature to Contrato', e); }
        }

        doc.setFontSize(7.5); doc.setFont('helvetica', 'normal');
        doc.text(`ARRENDADOR: ${settings?.shortName || settings?.companyName || 'CIELO'}`, margin, sigY + 5); 
        doc.text(`ARRENDATARIO: ${client?.name || '—'}`, W - margin, sigY + 5, { align: 'right' });

        doc.save(`Contrato_${cot.id}.pdf`);
    } catch (error) {
        console.error('Error generating Contrato PDF:', error);
        alert('Error al generar el PDF del contrato.');
    }
}


function generatePagarePDF(cot, client, settings) {
    const doc = new jsPDF();
    const W = doc.internal.pageSize.getWidth();
    const margin = 10;
    let y = applyStandardLayout(doc, 'Pagaré', settings, cot.id);

    y = drawInfoGrid(doc, y, client, {
        valTopLeft: cot.fecha || format(new Date(), 'yyyy-MM-dd'),
        valTopRight: 'INMEDIATO',
        labelTopRight: 'Vencimiento',
        valMidLeft: '—',
        valMidRight: 'GARANTÍA',
        valBottom: 'S/N',
        labelBottom: 'Serie:'
    });

    doc.setTextColor(30, 41, 59); doc.setFontSize(9); doc.setFont('helvetica', 'normal');
    const total = cot.items.reduce((s, i) => s + (i.cantidad * i.dias * i.tarifaDia), 0) + (Number(cot.transporte) || 0);
    const texto = `Yo, ${client?.name || '—'}, identificado con NIT/CC ${client?.nit || '—'}, actuando en nombre de la empresa ${client?.name || '—'}, me comprometo incondicionalmente a pagar a la orden de ${settings?.companyName || 'CIELO'} — Alquiler de Equipos y Herramientas, la suma de ${fmtCOP(total)} (${total.toLocaleString()} pesos colombianos), más los intereses de mora pactados, en los plazos y condiciones establecidos en el Contrato de Alquiler ${cot.id} suscrito en la misma fecha.`;
    doc.text(doc.splitTextToSize(texto, W - margin * 2), margin, y + 5);

    y += 40;
    doc.setFont('helvetica', 'bold'); doc.setFontSize(9);
    doc.text('DATOS DEL DEUDOR:', margin, y);
    doc.setFont('helvetica', 'normal'); doc.setFontSize(8.5);
    [['Nombre/Razón Social', client?.name || '—'], ['NIT/CC', client?.nit || '—'], ['Dirección', client?.direccion || client?.address || '—'], ['Ciudad', client?.ciudad || '—'], ['Fecha de Suscripción', cot.fecha], ['Valor Total', fmtCOP(total)]].forEach(([k, v], i) => {
        doc.text(`${k}: ${v}`, margin, y + 8 + i * 6);
    });

    y += 60;
    doc.setDrawColor(30, 41, 59);
    doc.line(margin, y, margin + 60, y); 
    doc.line(W - margin - 60, y, W - margin, y);

    // Firma digital si existe
    if (cot.firma) {
        try {
            doc.addImage(cot.firma, 'PNG', margin, y - 25, 60, 25);
        } catch (e) { console.error('Error adding signature to Pagare', e); }
    }

    doc.setFontSize(7.5);
    doc.text('Firma del Deudor', margin + 30, y + 4, { align: 'center' }); 
    doc.text('Huella Digital', W - margin - 30, y + 4, { align: 'center' });
    doc.rect(W - margin - 45, y + 8, 30, 35);

    doc.save(`Pagare_${cot.id}.pdf`);
}

function generateCartaPDF(cot, client, settings) {
    const doc = new jsPDF();
    const W = doc.internal.pageSize.getWidth();
    const margin = 10;
    let y = applyStandardLayout(doc, 'Carta de Instrucciones', settings, cot.id);

    y = drawInfoGrid(doc, y, client, {
        valTopLeft: cot.fecha || format(new Date(), 'yyyy-MM-dd'),
        valTopRight: 'PERMANENTE',
        labelTopRight: 'Vigencia Inst.',
        valMidLeft: '—',
        valMidRight: 'DILIGENCIAMIENTO',
        valBottom: 'Garantía de Alquiler',
        labelBottom: 'Objeto:'
    });

    doc.setTextColor(30, 41, 59); doc.setFontSize(9); doc.setFont('helvetica', 'normal');
    const texto = `Señores ${settings?.companyName || 'CIELO'} — Alquiler de Equipos y Herramientas.\n\nPor medio de la presente, yo ${client?.name || '—'}, identificado con NIT/CC ${client?.nit || '—'}, autorizo de manera irrevocable a diligenciar el pagaré suscrito en la misma fecha correspondiente al Contrato ${cot.id} bajo las siguientes instrucciones:\n\n1. El pagaré podrá ser llenado por el valor total adeudado más los intereses de mora causados.\n2. Podrá ser cobrado a partir del vencimiento del plazo pactado en el contrato.\n3. Si el pago no se realiza en la fecha acordada, ${settings?.companyName || 'CIELO'} queda autorizada para iniciar cobro judicial de inmediato.\n4. El deudor renuncia expresamente al beneficio de excusión.\n\nEl presente pagaré ha sido suscrito en condición de ser llenado (pagaré en blanco) conforme a la presente carta de instrucciones, la cual tiene plena validez jurídica conforme a la ley colombiana.`;
    doc.text(doc.splitTextToSize(texto, W - margin * 2), margin, y + 5);

    y += 90;
    doc.setDrawColor(30, 41, 59);
    doc.line(margin, y, margin + 60, y); 
    doc.line(W - margin - 60, y, W - margin, y);

    // Firma digital si existe (Cargada sobre la línea del otorgante/cliente)
    if (cot.firma) {
        try {
            doc.addImage(cot.firma, 'PNG', margin, y - 25, 60, 25);
        } catch (e) { console.error('Error adding signature to Carta', e); }
    }

    doc.setFontSize(7.5);
    doc.text(`OTORGANTE: ${client?.name || '—'}`, margin + 30, y + 4, { align: 'center' }); 
    doc.text(`REPRESENTANTE ${settings?.shortName || 'CIELO'}`, W - margin - 30, y + 4, { align: 'center' });

    doc.save(`CartaInstrucciones_${cot.id}.pdf`);
}

// ─── Firma Digital Canvas ─────────────────────────────────────────────────────
function SignatureCanvas({ onSave, onClear }) {
    const canvasRef = useRef(null);
    const drawing = useRef(false);

    const getPos = (e, canvas) => {
        const rect = canvas.getBoundingClientRect();
        const src = e.touches ? e.touches[0] : e;
        
        // Calcular la escala entre el tamaño visual (CSS) y el tamaño interno del canvas
        const scaleX = canvas.width / rect.width;
        const scaleY = canvas.height / rect.height;
        
        return { 
            x: (src.clientX - rect.left) * scaleX, 
            y: (src.clientY - rect.top) * scaleY 
        };
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
        ctx.lineWidth = 2.5; ctx.lineCap = 'round'; ctx.strokeStyle = '#104166';
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
                    <video ref={videoRef} autoPlay style={{ width: active ? 280 : 0, height: active ? 'auto' : 0, borderRadius: 8, border: active ? '1px solid #2365AB' : 'none' }} />
                    {!active ? (
                        <button onClick={startCam} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '0.6rem 1.25rem', borderRadius: 8, background: '#2365AB', color: 'white', border: 'none', cursor: 'pointer', fontWeight: 700, fontSize: '0.82rem' }}>
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
const getHabeasText = (settings) => `De conformidad con la Ley 1581 de 2012 y el Decreto 1377 de 2013 (Régimen de Protección de Datos Personales), ${settings?.companyName || 'CIELO — Alquiler de Equipos y Herramientas'}, con NIT ${settings?.nit || '900.XXX.XXX-X'}, en calidad de Responsable del Tratamiento, informa:

Sus datos personales (nombre, identificación, dirección, teléfono, correo electrónico, firma digital, huella dactilar y fotografía) serán tratados con las siguientes finalidades: (1) Gestión comercial y facturación, (2) Ejecución del contrato de alquiler, (3) Cobro de cartera, y (4) Cumplimiento de obligaciones legales.

Sus datos NO serán vendidos ni cedidos a terceros sin su autorización. Usted tiene derecho a conocer, actualizar, rectificar y suprimir sus datos personales. Para ejercer estos derechos comuníquese a: ${settings?.email || 'gerencia@empresa.co'}.

Las firmas digitales y datos biométricos recopilados están protegidos mediante encriptación AES-256 y sólo pueden ser consultados por personal autorizado de ${settings?.shortName || 'CIELO'}, en cumplimiento de los estándares de seguridad exigidos por la Ley.

Al marcar la casilla de aceptación, el titular declara haber leído, entendido y aceptado el presente aviso de privacidad y autoriza expresamente el tratamiento de sus datos personales para los fines indicados.`;

function HabeasDataModal({ onAccept, onClose }) {
    const { settings } = useAppContext();
    const [checked, setChecked] = useState(false);
    return (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.8)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1100, padding: '1rem' }}>
            <div style={{ background: '#ffffff', borderRadius: 14, width: '100%', maxWidth: 580, maxHeight: '90vh', display: 'flex', flexDirection: 'column', overflow: 'hidden', boxShadow: '0 25px 80px rgba(0,0,0,0.5)' }}>
                <div style={{ background: '#104166', padding: '1.25rem 1.5rem', display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                    <Shield size={20} style={{ color: '#2365AB' }} />
                    <div style={{ flex: 1 }}>
                        <div style={{ fontWeight: 800, color: 'white', fontSize: '1rem' }}>Autorización de Habeas Data</div>
                        <div style={{ fontSize: '0.72rem', color: 'rgba(255,255,255,0.65)', marginTop: 2 }}>Ley 1581 de 2012 — Protección de Datos Personales</div>
                    </div>
                    <button onClick={onClose} style={{ background: 'rgba(255,255,255,0.1)', border: 'none', borderRadius: 6, color: 'white', cursor: 'pointer', padding: '0.3rem', display: 'flex' }}><X size={16} /></button>
                </div>
                <div style={{ flex: 1, padding: '1.25rem 1.5rem', overflowY: 'auto', whiteSpace: 'pre-wrap', fontSize: '0.82rem', color: '#154272', lineHeight: 1.7 }}>
                    {getHabeasText(settings)}
                </div>
                <div style={{ padding: '1rem 1.5rem', borderTop: '1px solid #e2e8f0', background: '#f8fafc' }}>
                    <label style={{ display: 'flex', alignItems: 'flex-start', gap: '0.75rem', cursor: 'pointer', marginBottom: '1rem' }}>
                        <input type="checkbox" checked={checked} onChange={e => setChecked(e.target.checked)} style={{ marginTop: 3, accentColor: '#2365AB', width: 16, height: 16, flexShrink: 0 }} />
                        <span style={{ fontSize: '0.82rem', color: '#154272', fontWeight: 600 }}>He leído y acepto el tratamiento de mis datos personales bajo los términos de la Ley 1581 de 2012.</span>
                    </label>
                    <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end' }}>
                        <button onClick={onClose} style={{ padding: '0.55rem 1.25rem', borderRadius: 8, background: 'transparent', border: '1px solid #cbd5e1', color: '#64748b', cursor: 'pointer', fontWeight: 600, fontSize: '0.85rem' }}>Cancelar</button>
                        <button disabled={!checked} onClick={() => onAccept(new Date().toISOString())}
                            style={{ padding: '0.55rem 1.25rem', borderRadius: 8, background: checked ? '#2365AB' : '#cbd5e1', color: 'white', border: 'none', cursor: checked ? 'pointer' : 'not-allowed', fontWeight: 700, fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: 5 }}>
                            <Shield size={14} /> Aceptar y Continuar
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}

// ─── PDF Remisión de Despacho ──────────────────────────────────────────────────
function generateRemisionPDF(rem, client, obra, settings) {
    try {
        const doc = new jsPDF();
        const W = doc.internal.pageSize.getWidth();
        const margin = 10;
        
        // Encabezado estándar
        let y = applyStandardLayout(doc, 'Remisión de Despacho', settings, rem.id);
        
        // Grid de información
        y = drawInfoGrid(doc, y, client, {
            valTopLeft: rem.fecha,
            labelTopLeft: 'Fecha Despacho',
            valTopRight: rem.estado?.toUpperCase(),
            labelTopRight: 'Estado',
            valMidLeft: obra?.nombre?.substring(0, 25) || rem.obraId || '—',
            valMidRight: rem.transporte > 0 ? `$${rem.transporte.toLocaleString()}` : '—',
            labelMidRight: 'Costo Transp.',
            valBottom: rem.notas?.substring(0, 50) || 'Sin observaciones',
            labelBottom: 'Notas:',
            obraDireccion: obra?.ubicacion || client?.direccion
        });

        // Tabla de ítems
        autoTable(doc, {
            startY: y,
            margin: { left: margin, right: margin },
            head: [['ITE', 'EQUIPO / DESCRIPCIÓN', 'CANTIDAD', 'DEVUELTA', 'PENDIENTE']],
            body: rem.items.map((i, idx) => [
                idx + 1,
                i.nombre.toUpperCase(),
                i.cantidad,
                i.cantidadDevuelta || 0,
                i.cantidad - (i.cantidadDevuelta || 0)
            ]),
            theme: 'plain',
            headStyles: { 
                fillColor: [241, 245, 249], 
                textColor: [30, 41, 59], 
                fontSize: 8, 
                fontStyle: 'bold', 
                halign: 'center',
                lineWidth: 0.1,
                lineColor: [30, 41, 59]
            },
            styles: { 
                fontSize: 8, 
                cellPadding: 3, 
                textColor: [30, 41, 59], 
                halign: 'center',
                lineWidth: 0.1,
                lineColor: [30, 41, 59]
            },
            columnStyles: {
                0: { cellWidth: 10 },
                1: { halign: 'left', cellWidth: 'auto' },
                2: { cellWidth: 25 },
                3: { cellWidth: 25 },
                4: { cellWidth: 25, fontStyle: 'bold' }
            }
        });

        y = doc.lastAutoTable.finalY + 20;

        // Espacios de firmas
        doc.setLineWidth(0.5);
        doc.setDrawColor(30, 41, 59);
        doc.line(margin, y, margin + 60, y);
        doc.line(W - margin - 60, y, W - margin, y);

        doc.setFontSize(8);
        doc.text('Entregado por (Bodega)', margin + 30, y + 5, { align: 'center' });
        doc.text('Recibido por (Cliente)', W - margin - 30, y + 5, { align: 'center' });

        doc.setFontSize(7);
        doc.setTextColor(100, 116, 139);
        const disclaimer = "Certifico que los equipos descritos en este documento han sido entregados en buen estado de funcionamiento. El cliente se hace responsable por el cuidado y custodia de los mismos desde este momento.";
        doc.text(doc.splitTextToSize(disclaimer, W - margin * 2), margin, y + 15);

        doc.save(`Remision_${rem.id}.pdf`);
    } catch (error) {
        console.error('Error generating Remision PDF:', error);
        alert('Error al generar el PDF de la remisión.');
    }
}

export { generateCotizacionPDF, generateContratoPDF, generatePagarePDF, generateCartaPDF, generateRemisionPDF, SignatureCanvas, WebcamCapture, HabeasDataModal, ESTADO_CFG, fmtCOP };


