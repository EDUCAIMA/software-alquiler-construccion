import React, { useState, useMemo, useRef, useEffect, useCallback } from 'react';
import {
    FilePlus, Search, CheckCircle, XCircle, Clock, Send,
    X, ChevronRight, Plus, FileText, Shield, Camera,
    PenTool, Fingerprint, Download, AlertTriangle, Eye,
    MapPin, Package, Truck, CreditCard, Calendar
} from 'lucide-react';
import { useAppContext } from '../context/AppContext';
import { format, addDays, differenceInDays } from 'date-fns';
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
        const getItemSubtotal = (i) => {
            const isServ = (i.tipoCobro || '').toLowerCase().includes('servicio') || (i.category || '').toLowerCase().includes('servicio') || (i.esquemaCobro || '').toLowerCase().includes('única');
            return Number(i.cantidad) * (isServ ? 1 : Number(i.dias)) * Number(i.tarifaDia);
        };
        const subtotal = cot.items.reduce((s, i) => s + getItemSubtotal(i), 0);
        const porcIVA = client?.responsableIVA ? (client?.porcIVA || 0) : 0;
        const porcRet = client?.porcRetencion || 0;
        const iva = Math.round(subtotal * porcIVA / 100);
        const ret = Math.round(subtotal * porcRet / 100);
        const total = subtotal + iva + ret + Number(cot.transporte || 0);

        autoTable(doc, {
            startY: y,
            margin: { left: margin, right: margin },
            head: [['ITE', 'EQUIPO / DESCRIPCIÓN', 'CANT.', 'DÍAS', 'TAR./DÍA', 'VR. TOTAL']],
            body: cot.items.map((i, idx) => {
                const isServ = (i.tipoCobro || '').toLowerCase().includes('servicio') || (i.category || '').toLowerCase().includes('servicio') || (i.esquemaCobro || '').toLowerCase().includes('única');
                return [
                    idx + 1,
                    i.nombre.toUpperCase(),
                    i.cantidad,
                    isServ ? '1 (Única)' : i.dias,
                    fmtN(i.tarifaDia),
                    fmtN(getItemSubtotal(i))
                ];
            }),
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
            body: cot.items.map((i, idx) => {
                const isServ = (i.tipoCobro || '').toLowerCase().includes('servicio') || (i.category || '').toLowerCase().includes('servicio') || (i.esquemaCobro || '').toLowerCase().includes('única');
                const rowTot = i.cantidad * (isServ ? 1 : i.dias) * i.tarifaDia;
                return [
                    idx + 1,
                    i.nombre.toUpperCase(),
                    i.cantidad,
                    isServ ? '1 (Única)' : i.dias,
                    i.tarifaDia.toLocaleString('es-CO'),
                    rowTot.toLocaleString('es-CO')
                ];
            }),
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
            foot: [['', '', '', '', 'TOTAL ANTES DE IMP.', (cot.items.reduce((s, i) => {
                const isServ = (i.tipoCobro || '').toLowerCase().includes('servicio') || (i.category || '').toLowerCase().includes('servicio') || (i.esquemaCobro || '').toLowerCase().includes('única');
                return s + (i.cantidad * (isServ ? 1 : i.dias) * i.tarifaDia);
            }, 0) + (Number(cot.transporte) || 0)).toLocaleString('es-CO')]],
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
                (i.nombre || i.productId || 'EQUIPO').toUpperCase(),
                i.cantidad || 0,
                i.cantidadDevuelta || 0,
                (i.cantidad || 0) - (i.cantidadDevuelta || 0)
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

// ─── PDF Corte de Obra ────────────────────────────────────────────────────────
function generateCortePDF(invoice, client, obra, settings, allInvoices, allRemisiones, fechaCorte) {
    try {
        const doc = new jsPDF();
        const W = doc.internal.pageSize.getWidth();
        const margin = 10;
        
        let y = applyStandardLayout(doc, 'Corte de Obra', settings, invoice.id);
        
        y = drawInfoGrid(doc, y, client, {
            valTopLeft: invoice.fecha || invoice.date,
            labelTopLeft: 'Fecha Contrato',
            valTopRight: fechaCorte,
            labelTopRight: 'Fecha de Corte',
            valMidLeft: obra?.nombre?.substring(0, 25) || invoice.obraId || '—',
            valMidRight: invoice.status?.toUpperCase(),
            labelMidRight: 'Estado Pago',
            obraDireccion: obra?.ubicacion || client?.direccion
        });

        // Calcular valores hasta la fecha de corte
        const linkedRems = allRemisiones.filter(r => r.cotizacionId === invoice.id || r.facturaId === invoice.id);
        let extraCost = 0;
        const targetDate = new Date(fechaCorte);
        targetDate.setHours(23, 59, 59, 999); // Final del día de corte

        (invoice.items || []).forEach(cotItem => {
            const tarifaDia = Number(cotItem.tarifaDia) || 0;
            const diasCotizados = Number(cotItem.dias) || 0;
            let despachadoTotal = 0;
            let cantidadDevueltaEnDespacho = 0;

            linkedRems.forEach(rem => {
                if (rem.estado === 'Pendiente' || rem.estado === 'Cancelada') return;
                const fechaSalida = new Date(rem.fecha);
                if (fechaSalida > targetDate) return; // Remisión posterior al corte
                
                const remItem = (rem.items || []).find(i => i.productId === cotItem.productId);
                if (remItem) {
                    const despachado = Number(remItem.cantidad) || 0;
                    despachadoTotal += despachado;

                    const devoluciones = remItem.devoluciones || [];
                    devoluciones.forEach(dev => {
                        const fechaDev = new Date(dev.fecha);
                        if (fechaDev <= targetDate) {
                            const cantDev = Number(dev.cantidad) || 0;
                            cantidadDevueltaEnDespacho += cantDev;
                            const diasReales = Math.max(0, differenceInDays(fechaDev, fechaSalida));
                            const diasExtra = Math.max(0, diasReales - diasCotizados);
                            if (diasExtra > 0) {
                                extraCost += (diasExtra * cantDev * tarifaDia);
                            }
                        }
                    });

                    // Equipos en campo al momento del corte
                    const pendiente = despachado - cantidadDevueltaEnDespacho;
                    if (pendiente > 0) {
                        const diasReales = Math.max(0, differenceInDays(targetDate, fechaSalida));
                        const diasExtra = Math.max(0, diasReales - diasCotizados);
                        if (diasExtra > 0) {
                            extraCost += (diasExtra * pendiente * tarifaDia);
                        }
                    }
                }
            });
        });

        y += 10;
        doc.setFont('helvetica', 'bold'); doc.setFontSize(10);
        doc.text('ESTADO DE CUENTA A LA FECHA DE CORTE', margin, y);
        y += 6;

        const tableBody = [];
        tableBody.push([{ content: invoice.fecha || invoice.date, styles: { textColor: [100,116,139] } }, 'Contrato Inicial', fmtCOP(invoice.amount)]);
        if (extraCost > 0) {
            tableBody.push([{ content: 'A corte', styles: { textColor: [100,116,139] } }, 'Extras por Liquidación (Mora)', '+ ' + fmtCOP(extraCost)]);
        }

        const abList = invoice.abonos || [];
        // Filtrar abonos anteriores a la fecha de corte
        const validAbList = abList.filter(ab => new Date(ab.fecha || invoice.paidDate) <= targetDate);
        const recordedSum = validAbList.reduce((s, ab) => s + (Number(ab.monto) || Number(ab.amount) || 0), 0);
        
        // Si hay un paidAmount general sin historial (legacy) que entró antes del corte, lo mostramos
        const totalPaidAllTime = Number(invoice.paidAmount) || 0;
        const allTimeRecordedSum = abList.reduce((s, ab) => s + (Number(ab.monto) || Number(ab.amount) || 0), 0);
        const unrecorded = Math.max(0, totalPaidAllTime - allTimeRecordedSum);
        
        // Asumimos que los unrecorded son antiguos y pasaron antes del corte (si el corte no es muy viejo)
        if (unrecorded > 1) {
            tableBody.push([{ content: 'Anterior', styles: { textColor: [100,116,139] } }, 'Pagos Anteriores', '- ' + fmtCOP(unrecorded)]);
        }

        validAbList.forEach(ab => {
            tableBody.push([{ content: ab.fecha || '—', styles: { textColor: [100,116,139] } }, 'Abono Registrado', '- ' + fmtCOP(ab.monto || ab.amount || 0)]);
        });

        const saldoCorte = (invoice.amount - unrecorded - recordedSum) + extraCost;

        autoTable(doc, {
            startY: y,
            margin: { left: margin, right: margin },
            head: [['Fecha', 'Concepto', 'Monto']],
            body: tableBody,
            theme: 'plain',
            headStyles: { fillColor: [248, 250, 252], textColor: [71, 85, 105], fontSize: 8, fontStyle: 'bold' },
            bodyStyles: { fontSize: 8, textColor: [30, 41, 59], cellPadding: 3 },
            alternateRowStyles: { fillColor: [255, 255, 255] },
            columnStyles: { 2: { halign: 'right' } }
        });

        y = doc.lastAutoTable.finalY;

        // Saldo Final
        doc.setFillColor(240, 249, 255);
        doc.rect(margin, y, W - margin * 2, 10, 'F');
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(3, 105, 161);
        doc.text('SALDO PROYECTADO AL CORTE', margin + 5, y + 6.5);
        doc.setFontSize(10);
        doc.text(fmtCOP(saldoCorte), W - margin - 5, y + 6.5, { align: 'right' });

        doc.save(`CorteObra_${invoice.id}_${fechaCorte}.pdf`);
    } catch (error) {
        console.error('Error generating Corte PDF:', error);
        alert('Error al generar el PDF del corte de obra.');
    }
}

function exportClientPDF(client, invoices, products, settings) {
    const doc = new jsPDF();
    const margin = 10;
    let y = applyStandardLayout(doc, 'Ficha de Cliente', settings, client.id);

    doc.setTextColor(30, 41, 59);
    doc.setFontSize(10); doc.setFont('helvetica', 'bold');
    doc.text('1. Datos del Cliente', margin, y);

    autoTable(doc, {
        startY: y + 5,
        body: [
            ['Razón Social', client.name, 'NIT / CC', client.nit || '—'],
            ['Tipo Persona', client.tipoPersona || '—', 'Régimen', client.regimen || '—'],
            ['Responsable IVA', client.responsableIVA ? 'Sí' : 'No', '% IVA', `${client.porcIVA || 0}%`],
            ['% Retención', `${client.porcRetencion || 0}%`, 'Contacto', client.contactoPrincipal || '—'],
            ['Correo', client.email || '—', 'Teléfono', client.phone || '—'],
            ['Dirección', client.direccion || '—', 'Ciudad', `${client.ciudad || ''} – ${client.departamento || ''}`],
            ['Deuda Actual', `$${(client.debt || 0).toLocaleString()}`, 'Desde', client.joined || '—'],
        ],
        styles: { fontSize: 8, cellPadding: 3 },
        columnStyles: { 
            0: { fontStyle: 'bold', fillColor: [248, 250, 252], cellWidth: 35 }, 
            2: { fontStyle: 'bold', fillColor: [248, 250, 252], cellWidth: 35 } 
        },
        margin: { left: margin, right: margin },
    });

    let currentY = doc.lastAutoTable.finalY + 12;
    doc.setFontSize(10); doc.setFont('helvetica', 'bold');
    doc.text('2. Obras / Proyectos', margin, currentY);

    autoTable(doc, {
        startY: currentY + 5,
        head: [['ID Obra', 'Nombre', 'Ubicación', 'Estado', 'Presupuesto', 'Inicio']],
        body: (client.obras || []).map(o => [
            o.id, o.nombre, o.ubicacion || '—', o.estado,
            `$${(o.presupuesto || 0).toLocaleString()}`,
            o.fechaInicio || '—',
        ]),
        headStyles: { fillColor: [30, 41, 59], textColor: 255, fontSize: 8 },
        styles: { fontSize: 8, cellPadding: 3 },
        alternateRowStyles: { fillColor: [248, 250, 252] },
        margin: { left: margin, right: margin },
    });

    currentY = doc.lastAutoTable.finalY + 12;
    doc.setFontSize(10); doc.setFont('helvetica', 'bold');
    doc.text('3. Historial de Cobros / Liquidaciones', margin, currentY);

    const clientInvoices = invoices.filter(inv => inv.clientId === client.id);
    autoTable(doc, {
        startY: currentY + 5,
        head: [['Cobro / Remisión', 'Obra', 'Fecha', 'Equipos', 'Monto', 'Estado']],
        body: clientInvoices.length > 0
            ? clientInvoices.map(inv => {
                const obraName = (client.obras || []).find(o => o.id === inv.obraId)?.nombre || '—';
                const itemsStr = inv.items.map(item => {
                    const prod = products.find(p => p.id === item.productId);
                    return prod ? `${item.quantity}x ${prod.name}` : item.productId;
                }).join(', ');
                return [inv.id, obraName, inv.date, itemsStr, `$${inv.amount.toLocaleString()}`, inv.status === 'Paid' ? 'PAGADA' : 'PENDIENTE'];
            })
            : [['—', '—', '—', 'Sin cobros registrados', '—', '—']],
        headStyles: { fillColor: [30, 41, 59], textColor: 255, fontSize: 8 },
        styles: { fontSize: 7.5, cellPadding: 3 },
        alternateRowStyles: { fillColor: [248, 250, 252] },
        margin: { left: margin, right: margin },
    });

    doc.save(`Ficha_${client.name.replace(/\s+/g, '_')}_${client.id}.pdf`);
}

// ─── PDF Factura / Cobro (Nuevo Formato Profesional) ──────────────────────────
export function generateInvoicePDF(invoice, client, products, settings) {
    const doc = new jsPDF({ orientation: 'landscape', format: 'letter', unit: 'mm' });
    const W = doc.internal.pageSize.getWidth();
    const H = doc.internal.pageSize.getHeight();
    const margin = 10;

    let y = applyStandardLayout(doc, 'REMISIÓN DE COBRO', settings, invoice.id);

    // Custom info grid in pure black, using unified font size 8.5
    const drawCustomInfoGrid = (doc, gridY, cl, meta = {}) => {
        const gridH = 26;

        doc.setLineWidth(0.2);
        doc.setDrawColor(0, 0, 0);
        doc.setFillColor(255, 255, 255);
        
        // Contenedor principal
        doc.rect(margin, gridY, W - (margin * 2), gridH);
        
        // Separador vertical: right panel is 100mm wide
        const separatorX = W - margin - 100;
        doc.line(separatorX, gridY, separatorX, gridY + gridH);
        
        doc.setTextColor(0, 0, 0);
        const fontSize = 8.5;
        doc.setFontSize(fontSize);
        
        // --- Lado Izquierdo: Cliente ---
        doc.setFont('helvetica', 'bold');
        doc.text('Señores:', margin + 3, gridY + 6);
        doc.text('Nit:', margin + 3, gridY + 11);
        doc.text('Dirección:', margin + 3, gridY + 16);
        doc.text('Ciudad:', margin + 3, gridY + 21);
        
        doc.setFont('helvetica', 'normal');
        doc.text(cl?.name?.toUpperCase() || '—', margin + 25, gridY + 6);
        doc.text(cl?.nit || '—', margin + 25, gridY + 11);
        doc.text(meta?.obraDireccion || cl?.direccion || '—', margin + 25, gridY + 16);
        doc.text(cl?.ciudad || 'BOGOTÁ', margin + 25, gridY + 21);
        
        doc.setFont('helvetica', 'bold');
        doc.text('Teléfonos:', margin + 110, gridY + 21);
        doc.setFont('helvetica', 'normal');
        doc.text(cl?.phone || '—', margin + 130, gridY + 21);
        
        // --- Lado Derecho: Metadatos ---
        const rightW = 100;
        doc.line(separatorX, gridY + 8.5, W - margin, gridY + 8.5);
        doc.line(separatorX, gridY + 17, W - margin, gridY + 17);
        doc.line(separatorX + (rightW / 2), gridY, separatorX + (rightW / 2), gridY + 17);
        
        doc.setFont('helvetica', 'bold');
        doc.text(meta.labelTopLeft || 'Fecha Inicio', separatorX + (rightW / 4), gridY + 4, { align: 'center' });
        doc.text(meta.labelTopRight || 'Fecha Fin', separatorX + (3 * rightW / 4), gridY + 4, { align: 'center' });
        
        doc.setFont('helvetica', 'normal');
        doc.text(meta.valTopLeft || '—', separatorX + (rightW / 4), gridY + 7.5, { align: 'center' });
        doc.text(meta.valTopRight || '—', separatorX + (3 * rightW / 4), gridY + 7.5, { align: 'center' });
        
        doc.setFont('helvetica', 'bold');
        doc.text(meta.labelMidLeft || 'Obra / Proyecto', separatorX + (rightW / 4), gridY + 12.5, { align: 'center' });
        doc.text(meta.labelMidRight || 'Forma de Pago', separatorX + (3 * rightW / 4), gridY + 12.5, { align: 'center' });
        
        doc.setFont('helvetica', 'normal');
        doc.text(meta.valMidLeft || '—', separatorX + (rightW / 4), gridY + 15.8, { align: 'center' });
        doc.text(meta.valMidRight || 'CONTADO', separatorX + (3 * rightW / 4), gridY + 15.8, { align: 'center' });
        
        doc.setFont('helvetica', 'bold');
        doc.text(`${meta.labelBottom || 'Transporte:'} ${meta.valBottom || 'CLIENTE'}`, separatorX + (rightW / 2), gridY + 22.5, { align: 'center' });
        
        return gridY + gridH + 10;
    };

    y = drawCustomInfoGrid(doc, y, client, {
        valTopLeft: invoice.date || format(new Date(), 'yyyy-MM-dd'),
        valTopRight: (invoice.status === 'Paid' || invoice.status === 'Pagada') ? 'PAGADA' : 'PENDIENTE',
        labelTopLeft: 'Fecha Emisión',
        labelTopRight: 'Estado Pago',
        valMidLeft: (client?.obras || []).find(o => o.id === invoice.obraId)?.nombre || '—',
        valMidRight: (invoice.paymentType || 'CONTADO').toUpperCase(),
        valBottom: `$${(Number(invoice.transporte) || 0).toLocaleString('es-CO')}`,
        labelBottom: 'Valor Transporte:',
        obraDireccion: (client?.obras || []).find(o => o.id === invoice.obraId)?.ubicacion || client?.direccion
    });

    // Group items by remId
    const grouped = (invoice.items || []).reduce((acc, item) => {
        const rId = item.remId || 'OTROS';
        if (!acc[rId]) acc[rId] = [];
        acc[rId].push(item);
        return acc;
    }, {});

    Object.entries(grouped).forEach(([remId, groupItems], idx) => {
        // Add a sub-header for the group if it's a remission
        if (remId !== 'OTROS') {
            doc.setFontSize(8.5);
            doc.setFont('helvetica', 'bold');
            doc.setTextColor(0, 0, 0);
            const headerY = (idx === 0) ? y : doc.lastAutoTable.finalY + 10;
            
            // Check if we need a new page
            if (headerY > H - 35) {
                doc.addPage();
                y = 20;
            } else {
                y = headerY;
            }

            const remFecha = groupItems[0]?.remFecha || '';
            doc.text(`REMISIÓN #${remId} ${remFecha ? `— DESPACHADA EL ${remFecha}` : ''}`, margin, y);
            y += 5;
        } else if (idx > 0) {
            y = doc.lastAutoTable.finalY + 10;
        }

        autoTable(doc, {
            startY: y,
            margin: { left: margin, right: margin },
            head: [['ITE', 'EQUIPO / DESCRIPCIÓN', 'CANT.', 'DÍAS', 'TAR./DÍA', 'VR. TOTAL']],
            body: groupItems.map((item, gIdx) => {
                const productName = item.nombre || item.name || products.find(p => p.id === item.productId)?.name || 'EQUIPO';
                const qty = Number(item.quantity || item.cantidad || 0);
                const days = Number(item.days || item.dias || 1);
                const price = Number(item.price || item.tarifaDia || 0);
                
                return [
                    gIdx + 1,
                    productName.toUpperCase(),
                    qty,
                    days,
                    `$${price.toLocaleString('es-CO')}`,
                    `$${(qty * days * price).toLocaleString('es-CO')}`
                ];
            }),
            theme: 'plain',
            headStyles: { 
                fillColor: [255, 255, 255], 
                textColor: [0, 0, 0], 
                fontSize: 8.5, 
                fontStyle: 'bold', 
                halign: 'center',
                lineWidth: 0.1,
                lineColor: [0, 0, 0]
            },
            styles: { 
                fontSize: 8.5, 
                cellPadding: 2.5, 
                textColor: [0, 0, 0], 
                halign: 'center',
                lineWidth: 0.1,
                lineColor: [0, 0, 0]
            },
            columnStyles: {
                0: { cellWidth: 15 },
                1: { halign: 'left', cellWidth: 'auto' },
                2: { cellWidth: 20 },
                3: { cellWidth: 20 },
                4: { halign: 'right', cellWidth: 35 },
                5: { halign: 'right', cellWidth: 40, fontStyle: 'bold' }
            }
        });
        
        y = doc.lastAutoTable.finalY;
    });

    try {
        const subtotal = (invoice.items || []).reduce((s, item) => {
            const qty = Number(item.quantity || item.cantidad || 0);
            const days = Number(item.days || item.dias || 1);
            const price = Number(item.price || item.tarifaDia || 0);
            return s + (qty * days * price);
        }, 0);

        const porcIVA = client?.responsableIVA ? (client?.porcIVA || 0) : 0;
        const iva = Math.round(subtotal * porcIVA / 100);
        const porcRet = client?.porcRetencion || 0;
        const ret = Math.round(subtotal * porcRet / 100);
        const totalVal = subtotal + iva + ret + (Number(invoice.transporte) || 0);

        let ty = (doc.lastAutoTable?.finalY || y + 20) + 10;
        const totW = 90;
        const totX = W - margin - totW;
        const totH = 7;

        const totals = [
            ['SUB-TOTAL', `$${subtotal.toLocaleString('es-CO')}`],
            [`IVA (${porcIVA}%)`, `$${iva.toLocaleString('es-CO')}`],
            [`RETENCIÓN (${porcRet}%)`, `$${ret.toLocaleString('es-CO')}`],
            ['TRANSPORTE', `$${(Number(invoice.transporte) || 0).toLocaleString('es-CO')}`]
        ];

        totals.forEach(([label, value]) => {
            doc.setLineWidth(0.1);
            doc.setDrawColor(0, 0, 0);
            doc.rect(totX, ty, 55, totH);
            doc.rect(totX + 55, ty, 35, totH);
            
            // Label: Left-aligned, size 8.5
            doc.setFontSize(8.5);
            doc.setTextColor(0, 0, 0);
            doc.setFont('helvetica', 'bold');
            doc.text(label, totX + 2, ty + 5);
            
            // Value: Centered, size 10.5
            doc.setFontSize(10.5);
            doc.setFont('helvetica', 'normal');
            doc.text(value, totX + 72.5, ty + 5, { align: 'center' });
            ty += totH;
        });

        doc.setLineWidth(0.1);
        doc.setDrawColor(0, 0, 0);
        doc.rect(totX, ty, 55, 9);
        doc.rect(totX + 55, ty, 35, 9);
        
        // Total Label: Left-aligned, size 8.5
        doc.setFontSize(8.5);
        doc.setTextColor(0, 0, 0);
        doc.setFont('helvetica', 'bold');
        doc.text('TOTAL', totX + 2, ty + 6.5);
        
        // Total Value: Centered, size 11.5, bold
        doc.setFontSize(11.5);
        doc.setFont('helvetica', 'bold');
        doc.text(`$${totalVal.toLocaleString('es-CO')}`, totX + 72.5, ty + 6.5, { align: 'center' });
        
        y = ty + 20;
    } catch (err) {
        console.error('Error in total calculation or summary:', err);
    }

    const signatureY = Math.max(H - 45, y + 25);

    if (invoice.status === 'Paid' || invoice.status === 'Pagada') {
        doc.setFontSize(22);
        doc.setTextColor(0, 0, 0);
        doc.setFont(undefined, 'bold');
        doc.setGState(new doc.GState({ opacity: 0.15 }));
        doc.text('PAGADA', margin, y + 10);
        doc.setGState(new doc.GState({ opacity: 1 }));
    }

    doc.setFontSize(8.5);
    doc.setTextColor(0, 0, 0);
    doc.setFont(undefined, 'normal');
    doc.text('Firma Recibido:', margin, signatureY);
    doc.setDrawColor(0, 0, 0);
    doc.line(margin, signatureY + 2, margin + 50, signatureY + 2);

    // Centered professional footer page number across all pages
    const pageCount = doc.internal.getNumberOfPages();
    for (let i = 1; i <= pageCount; i++) {
        doc.setPage(i);
        doc.setFontSize(7.5);
        doc.setTextColor(0, 0, 0);
        doc.setFont('helvetica', 'normal');
        const footerText = `Página ${i} de ${pageCount}  |  Generado por Sistema de Gestión ${settings?.shortName || 'CIELO'} el ${format(new Date(), 'dd/MM/yyyy HH:mm')}`;
        doc.text(footerText, W / 2, H - 8, { align: 'center' });
    }

    doc.save(`Remision_Cobro_${invoice.id}.pdf`);
}

export { generateCotizacionPDF, generateContratoPDF, generatePagarePDF, generateCartaPDF, generateRemisionPDF, generateCortePDF, SignatureCanvas, WebcamCapture, HabeasDataModal, ESTADO_CFG, fmtCOP, exportClientPDF };


