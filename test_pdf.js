import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import fs from 'fs';

// Mock doc.save
jsPDF.prototype.save = function(name) {
    console.log("SAVE CALLED:", name);
}

// Paste the function generateCotizacionPDF here
function generateCotizacionPDF(cot, client, obra, settings) {
    const doc = new jsPDF();
    const W = doc.internal.pageSize.getWidth();
    const H = doc.internal.pageSize.getHeight();
    const fmtN = n => (Number(n) || 0).toLocaleString('es-CO');

    // --- ENCABEZADO PERSONALIZADO FULL WIDTH ---
    doc.setFillColor(30, 41, 59); 
    doc.rect(0, 0, W, 34, 'F');
    doc.setFillColor(59, 130, 246);
    doc.rect(0, 34, W, 4, 'F');

    // Izquierda
    doc.setTextColor(255, 255, 255);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(20);
    doc.text(settings?.shortName || settings?.companyName || 'CIELO', 14, 15);
    
    doc.setFontSize(8);
    doc.setFont('helvetica', 'bold');
    const compText = settings?.nameComplement || 'Alquiler de Equipos y Herramientas de Construcción';
    doc.text(compText, 14, 22);
    
    doc.setFont('helvetica', 'normal');
    doc.text(`NIT: ${settings?.nit || '900.XXX.XXX-X'}  |  Tel: ${settings?.phone || '(601) 000-0000'}  |  ${settings?.email || 'cielo@empresa.co'}`, 14, 28);

    // Derecha
    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    doc.text('COTIZACIÓN', W - 14, 15, { align: 'right' });
    
    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    doc.text(cot.id, W - 14, 22, { align: 'right' });
    doc.text(`Fecha: ${cot.fecha}`, W - 14, 28, { align: 'right' });

    // --- CAJA CLIENTE ---
    let y = 48;
    doc.setFillColor(250, 251, 253); doc.roundedRect(14, y, W - 28, 26, 3, 3, 'F');
    doc.setDrawColor(226, 232, 240); doc.roundedRect(14, y, W - 28, 26, 3, 3, 'S');
    doc.setTextColor(30, 41, 59);
    doc.setFont('helvetica', 'bold'); doc.setFontSize(7.5);
    doc.text('CLIENTE', 20, y + 6);
    doc.setFont('helvetica', 'normal'); doc.setFontSize(10);
    doc.text(client?.name || '—', 20, y + 14);
    doc.setFontSize(8.5); doc.setTextColor(100, 116, 139);
    doc.text(`NIT/CC: ${client?.nit || '—'}  |  Régimen: ${client?.regimen || '—'}`, 20, y + 20);
    doc.text(`Obra: ${obra?.nombre || '—'}  |  ${obra?.ubicacion || '—'}`, 20, y + 25);

    // Valid until
    const validHasta = cot.fecha ? new Date(new Date(cot.fecha).getTime() + (cot.validezDias || 15) * 86400000).toISOString().slice(0, 10) : '—';
    doc.setFont('helvetica', 'bold'); doc.setFontSize(8); doc.setTextColor(59, 130, 246);
    doc.text(`Válida hasta: ${validHasta}`, W - 20, y + 14, { align: 'right' });

    // --- TABLA DE ITEMS ---
    const subtotal = cot.items.reduce((s, i) => s + (Number(i.cantidad) * Number(i.dias) * Number(i.tarifaDia)), 0);
    const porcIVA = client?.responsableIVA ? (client?.porcIVA || 0) : 0;
    const porcRet = client?.porcRetencion || 0;
    const iva = Math.round(subtotal * porcIVA / 100);
    const ret = Math.round(subtotal * porcRet / 100);
    const total = subtotal + iva + ret + Number(cot.transporte || 0);

    y += 34;
    autoTable(doc, {
        startY: y,
        head: [['#', 'Equipo / Herramienta', 'Cant.', 'Días', 'Tarifa/día', 'Subtotal']],
        body: cot.items.map((i, idx) => [
            idx + 1,
            i.nombre,
            i.cantidad,
            i.dias,
            `$${fmtN(i.tarifaDia)}`,
            `$${fmtN(Number(i.cantidad) * Number(i.dias) * Number(i.tarifaDia))}`,
        ]),
        headStyles: { fillColor: [30, 41, 59], textColor: 255, fontSize: 8.5, fontStyle: 'bold' },
        styles: { fontSize: 9, cellPadding: 4, textColor: [51, 65, 85] },
        alternateRowStyles: { fillColor: [248, 250, 252] },
        columnStyles: { 0: { cellWidth: 10 }, 4: { halign: 'right' }, 5: { halign: 'right', fontStyle: 'bold', textColor: [30, 41, 59] } },
    });

    // --- TOTALES ---
    y = doc.lastAutoTable.finalY + 8;
    const totals = [
        ['Subtotal', `$${fmtN(subtotal)}`],
        ...(porcIVA > 0 ? [[`+ IVA (${porcIVA}%)`, `$${fmtN(iva)}`]] : []),
        ...(porcRet > 0 ? [[`+ Retención (${porcRet}%)`, `$${fmtN(ret)}`]] : []),
        ...(Number(cot.transporte) > 0 ? [['+ Transporte', `$${fmtN(cot.transporte)}`]] : []),
    ];
    const totW = 80;
    const totX = W - 14 - totW;
    
    // Cuadros individuales de subtotales
    totals.forEach(([k, v]) => {
        doc.setFillColor(250, 251, 253); doc.rect(totX, y, totW, 8.5, 'F');
        doc.setFont('helvetica', 'normal'); doc.setFontSize(8.5); doc.setTextColor(100, 116, 139);
        doc.text(k, totX + 4, y + 6);
        doc.setFont('helvetica', 'bold'); doc.setTextColor(30, 41, 59);
        doc.text(v, W - 16, y + 6, { align: 'right' });
        y += 9.5;
    });
    
    // Fila Total Azul
    doc.setFillColor(59, 130, 246); doc.rect(totX, y, totW, 10, 'F');
    doc.setFont('helvetica', 'bold'); doc.setFontSize(9.5); doc.setTextColor(255, 255, 255);
    doc.text('TOTAL', totX + 4, y + 7);
    doc.text(`$${fmtN(total)}`, W - 16, y + 7, { align: 'right' });
    y += 18;

    // --- CONDICIONES COMERCIALES ---
    const condY = Math.max(y, doc.lastAutoTable.finalY + 60);
    doc.setFillColor(248, 250, 252); doc.roundedRect(14, condY, W - 28, 22, 3, 3, 'F');
    doc.setFont('helvetica', 'bold'); doc.setFontSize(7.5); doc.setTextColor(30, 41, 59);
    doc.text('CONDICIONES COMERCIALES', 20, condY + 7);
    doc.setFont('helvetica', 'normal'); doc.setFontSize(8); doc.setTextColor(71, 85, 105);
    
    const termsLine = `Forma de pago: ${cot.metodoPago || 'Contado'}  |  Plazo de entrega: ${cot.plazoEntrega || 'A convenir'}  |  Transporte: ${cot.responsableTransporte || 'CIELO'}`;
    doc.text(termsLine, 20, condY + 13);
    
    if (cot.notas) {
        doc.text(doc.splitTextToSize(`Notas: ${cot.notas}`, W - 40), 20, condY + 19);
    }

    // --- PIE DE PÁGINA (Oscuro) ---
    const dateStr = '16/03/2026 07:45';
    doc.setFillColor(30, 41, 59);
    doc.rect(0, H - 12, W, 12, 'F');
    doc.setTextColor(203, 213, 225);
    doc.setFontSize(7);
    doc.setFont('helvetica', 'italic');
    doc.text(`Cotización ${cot.id} — ${settings?.shortName || settings?.companyName || 'CIELO'} — Generado el ${dateStr}`, W / 2, H - 4.5, { align: 'center' });

    doc.save(`Cotizacion_${cot.id}.pdf`);
}

generateCotizacionPDF(
    {id: 'COT-001', fecha: '2026-03-18', items: [{nombre: 'Equipo', cantidad: 1, dias: 1, tarifaDia: 100}]},
    {name: 'Test Client'},
    {nombre: 'Test Obra'},
    {shortName: 'Test'}
);
