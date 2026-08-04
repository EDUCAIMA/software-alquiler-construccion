import { format } from 'date-fns';

/**
 * Aplica el encabezado y pie de página estándar institucional a un documento jsPDF.
 * Basado en el formato profesional de factura/cotización solicitado.
 */
export const applyStandardLayout = (doc, title, settings, number = '', options = {}) => {
    const W = doc.internal.pageSize.getWidth();
    const H = doc.internal.pageSize.getHeight();
    const margin = 10;

    // --- ENCABEZADO PROFESIONAL ---
    let y = 14;
    
    // Logo o Nombre Corto
    if (settings?.logo) {
        try {
            doc.addImage(settings.logo, 'PNG', margin, y, 35, 15);
            y += 18;
        } catch (e) {
            doc.setFont('helvetica', 'bold');
            doc.setFontSize(14);
            doc.setTextColor(35, 101, 171);
            doc.text(settings?.shortName || 'CIELO', margin, y + 8);
            y += 12;
        }
    } else {
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(14);
        doc.setTextColor(35, 101, 171);
        doc.text(settings?.shortName || 'CIELO', margin, y + 8);
        y += 12;
    }

    // Información de la Empresa (Izquierda/Abajo del Logo o Nombre Corto)
    doc.setFontSize(8);
    doc.setTextColor(30, 41, 59);
    doc.setFont('helvetica', 'bold');
    doc.text(settings?.companyName?.toUpperCase() || 'CIELO COLOMBIA S.A.S.', margin, y);
    y += 4;

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.5);
    
    const infoLines = [
        `NIT. ${settings?.nit || '900.000.000-0'}`,
        settings?.address || 'Dirección no configurada',
        `Tel: ${settings?.phone || '—'}  |  ${settings?.email || '—'}`
    ];
    
    infoLines.forEach((line) => {
        doc.text(line, margin, y);
        y += 3.5;
    });

    // Recuadro Derecha: Tipo documento y número
    const boxW = 75;
    const boxH = number ? 22 : 16;
    const boxX = W - margin - boxW;
    const boxY = 14;

    doc.setDrawColor(35, 101, 171);
    doc.setLineWidth(0.5);
    doc.setFillColor(248, 250, 252);
    doc.roundedRect(boxX, boxY, boxW, boxH, 3, 3, 'FD');

    doc.setFontSize(9);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(35, 101, 171);
    doc.text(title.toUpperCase(), boxX + (boxW / 2), boxY + 10, { align: 'center' });
    
    if (number) {
        doc.setFontSize(9.5);
        doc.setTextColor(30, 41, 59);
        doc.text(`Nro - ${number.replace('--', '-')}`, boxX + (boxW / 2), boxY + 18, { align: 'center' });
    }

    if (!options.skipFooter) {
        // --- PIE DE PÁGINA ---
        doc.setFontSize(6.5);
        doc.setTextColor(100, 116, 139);
        doc.setFont('helvetica', 'normal');
        
        const generationInfo = `Página 1 de 1  |  Generado por Sistema de Gestión ${settings?.shortName || ''} el ${format(new Date(), 'dd/MM/yyyy HH:mm')}`;
        doc.text(generationInfo, W / 2, H - 8, { align: 'center' });
    }
    
    return Math.max(y + 4, 45); // Retorna la posición Y donde debe continuar el contenido
};

/**
 * Dibuja la cuadrícula de información del cliente y metadatos (fechas, obra, etc.)
 */
export const drawInfoGrid = (doc, y, client, meta = {}) => {
    const W = doc.internal.pageSize.getWidth();
    const margin = 10;
    const gridH = 24;

    doc.setLineWidth(0.2);
    doc.setDrawColor(30, 41, 59);
    
    // Contenedor principal
    doc.rect(margin, y, W - (margin * 2), gridH);
    // Separador vertical
    doc.line(W - margin - 75, y, W - margin - 75, y + gridH);
    
    // --- Lado Izquierdo: Cliente ---
    doc.setFontSize(7.5);
    doc.setFont('helvetica', 'bold');
    doc.text('Señores :', margin + 2, y + 5);
    doc.text('Nit :', margin + 2, y + 10);
    doc.text('Dirección :', margin + 2, y + 15);
    doc.text('Ciudad :', margin + 2, y + 20);
    
    doc.setFont('helvetica', 'normal');
    doc.text(client?.name?.toUpperCase() || '—', margin + 22, y + 5);
    doc.text(client?.nit || '—', margin + 22, y + 10);
    doc.text(meta?.obraDireccion || client?.direccion || '—', margin + 22, y + 15);
    doc.text(client?.ciudad || 'BOGOTÁ', margin + 22, y + 20);
    
    doc.setFont('helvetica', 'bold');
    doc.text('Teléfonos :', margin + 65, y + 20);
    doc.setFont('helvetica', 'normal');
    doc.text(client?.phone || '—', margin + 82, y + 20);

    // --- Lado Derecho: Metadatos (Fechas, Obra, Pago) ---
    const dateBoxX = W - margin - 75;
    doc.line(dateBoxX, y + 8, W - margin, y + 8); // Línea horizontal 1
    doc.line(dateBoxX, y + 16, W - margin, y + 16); // Línea horizontal 2
    doc.line(dateBoxX + 37.5, y, dateBoxX + 37.5, y + 16); // Separador vertical
    
    doc.setFontSize(7);
    doc.setFont('helvetica', 'bold');
    doc.text(meta.labelTopLeft || 'Fecha Inicio', dateBoxX + 18.75, y + 3.5, { align: 'center' });
    doc.text(meta.labelTopRight || 'Fecha Fin', dateBoxX + 56.25, y + 3.5, { align: 'center' });
    
    doc.setFontSize(8);
    doc.setFont('helvetica', 'normal');
    doc.text(meta.valTopLeft || '—', dateBoxX + 18.75, y + 7, { align: 'center' });
    doc.text(meta.valTopRight || '—', dateBoxX + 56.25, y + 7, { align: 'center' });

    doc.setFontSize(7);
    doc.setFont('helvetica', 'bold');
    doc.text(meta.labelMidLeft || 'Obra / Proyecto', dateBoxX + 18.75, y + 11.5, { align: 'center' });
    if (!meta.hideMidRight) {
        doc.text(meta.labelMidRight || 'Forma de Pago', dateBoxX + 56.25, y + 11.5, { align: 'center' });
    }
    
    doc.setFontSize(7.5);
    doc.setFont('helvetica', 'normal');
    doc.text(meta.valMidLeft || '—', dateBoxX + 18.75, y + 14.5, { align: 'center' });
    if (!meta.hideMidRight) {
        doc.text(meta.valMidRight || 'CONTADO', dateBoxX + 56.25, y + 14.5, { align: 'center' });
    }

    doc.setFontSize(7);
    if (!meta.hideBottom) {
        doc.setFont('helvetica', 'bold');
        doc.text(meta.labelBottom || 'Transporte:', dateBoxX + 37.5, y + 19.5, { align: 'center' });
        doc.setFont('helvetica', 'normal');
        doc.text(meta.valBottom || 'CLIENTE', dateBoxX + 37.5, y + 22.5, { align: 'center' });
    }

    return y + gridH + 10;
};
