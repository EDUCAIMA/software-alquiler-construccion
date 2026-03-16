import { format } from 'date-fns';

/**
 * Aplica el encabezado y pie de página estándar a un documento jsPDF.
 * 
 * Estructura solicitada:
 * - Izquierda: Logo y NIT debajo.
 * - Derecha: Nombre de la empresa y Nombre del documento debajo.
 * - Pie de página: Correo, dirección y teléfono (centrado).
 */
export const applyStandardLayout = (doc, title, settings) => {
    const W = doc.internal.pageSize.getWidth();
    const H = doc.internal.pageSize.getHeight();
    const margin = 14;

    // --- ENCABEZADO ---
    
    // Fondo sutil para el encabezado (opcional, para dar premium feel)
    doc.setFillColor(248, 250, 252);
    doc.rect(0, 0, W, 45, 'F');
    doc.setDrawColor(226, 232, 240);
    doc.line(0, 45, W, 45);

    // 1. Lado Izquierdo: Logo y NIT
    let logoSize = 18;
    if (settings?.logo) {
        try {
            doc.addImage(settings.logo, 'PNG', margin, 8, logoSize, logoSize);
        } catch (e) {
            console.error('Error adding logo to PDF:', e);
        }
    }

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.setTextColor(100, 116, 139);
    doc.text(`NIT: ${settings?.nit || 'N/A'}`, margin, 8 + logoSize + 6);

    // 2. Lado Derecho: Nombre Empresa y Título Documento
    doc.setFontSize(18);
    doc.setTextColor(30, 41, 59);
    doc.text(settings?.companyName || 'CIELO', W - margin, 18, { align: 'right' });

    doc.setFontSize(14);
    doc.setTextColor(59, 130, 246); // Color primario para el título
    doc.text(title.toUpperCase(), W - margin, 28, { align: 'right' });

    // Fecha de generación (opcional, para trazabilidad)
    doc.setFontSize(8);
    doc.setTextColor(148, 163, 184);
    doc.text(`Generado el: ${format(new Date(), 'dd/MM/yyyy HH:mm')}`, W - margin, 36, { align: 'right' });

    // --- PIE DE PÁGINA ---
    
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.setTextColor(30, 58, 138); // Azul oscuro
    
    // Texto con más separación (usando bullets y espacios extra)
    const email = settings?.email || '';
    const address = settings?.address || '';
    const phone = settings?.phone || '';
    
    const footerText = `${email}     •     ${address}     •     Tel: ${phone}`;
    doc.text(footerText, W / 2, H - 15, { align: 'center' });
    
    // Línea divisoria pie de página un poco más gruesa (0.5)
    doc.setDrawColor(203, 213, 225);
    doc.setLineWidth(0.5);
    doc.line(margin, H - 22, W - margin, H - 22);
};
