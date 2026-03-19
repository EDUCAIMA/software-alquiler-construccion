import { format } from 'date-fns';

/**
 * Aplica el encabezado y pie de página estándar institucional a un documento jsPDF.
 * Basado en el formato profesional de factura/cotización solicitado.
 */
export const applyStandardLayout = (doc, title, settings, number = '') => {
    const W = doc.internal.pageSize.getWidth();
    const H = doc.internal.pageSize.getHeight();
    const margin = 10;

    // --- ENCABEZADO PROFESIONAL ---
    let y = 10;
    
    // Logo
    if (settings?.logo) {
        try {
            doc.addImage(settings.logo, 'PNG', margin, y, 35, 18);
        } catch (e) {
            doc.setFont('helvetica', 'bold');
            doc.setFontSize(14);
            doc.text(settings?.shortName || 'CIELO', margin, y + 10);
        }
    } else {
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(14);
        doc.text(settings?.shortName || 'CIELO', margin, y + 10);
    }

    // Información de la Empresa (Izquierda/Abajo del Logo)
    doc.setFontSize(7.5);
    doc.setTextColor(30, 41, 59);
    doc.setFont('helvetica', 'bold');
    doc.text(settings?.companyName?.toUpperCase() || 'CIELO COLOMBIA S.A.S.', margin, y + 24);
    doc.setFont('helvetica', 'normal');
    
    const infoLines = [
        `NIT. ${settings?.nit || '900.000.000-0'}`,
        settings?.address || 'Dirección no configurada',
        `Tel: ${settings?.phone || '—'}  |  ${settings?.email || '—'}`
    ];
    
    infoLines.forEach((line, idx) => {
        doc.text(line, margin, y + 28 + (idx * 4));
    });

    // Recuadro Derecha: Tipo documento y número
    doc.setDrawColor(0);
    doc.setLineWidth(0.5);
    doc.rect(W - margin - 65, y, 65, 20);
    doc.setFontSize(10);
    doc.setFont('helvetica', 'bold');
    doc.text(title.toUpperCase(), W - margin - 32.5, y + 8, { align: 'center' });
    
    if (number) {
        doc.setFontSize(11);
        doc.text(`Nro - ${number}`, W - margin - 32.5, y + 15, { align: 'center' });
    }

    // --- PIE DE PÁGINA ---
    doc.setFontSize(6);
    doc.setTextColor(100, 116, 139);
    doc.setFont('helvetica', 'normal');
    
    const generationInfo = `Página 1 de 1  |  Generado por Sistema de Gestión ${settings?.shortName || ''} el ${format(new Date(), 'dd/MM/yyyy HH:mm')}`;
    doc.text(generationInfo, W / 2, H - 10, { align: 'center' });
    
    return y + 42; // Retorna la posición Y donde debe continuar el contenido
};

