import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { format } from 'date-fns';
import { applyStandardLayout, drawInfoGrid } from './pdfTheme';

export const generateComprobanteNominaPDF = ({ user, calc, periodo, settings, fechaPago, refNo }) => {
    try {
        const doc = new jsPDF();
        const W = doc.internal.pageSize.getWidth();
        const margin = 10;
        const refCode = refNo || `NOM-${user?.id || 'REG'}-${periodo?.replace('-', '') || ''}`;
        
        let fechaStr = format(new Date(), 'dd/MM/yyyy');
        if (fechaPago) {
            try {
                fechaStr = format(new Date(fechaPago), 'dd/MM/yyyy');
            } catch (e) {}
        }

        let y = applyStandardLayout(doc, 'Comprobante de Nómina', settings, refCode);

        y = drawInfoGrid(doc, y, {
            name: user?.name || 'Trabajador',
            nit: user?.documento || 'No registrado',
            direccion: user?.banco_cuenta || 'Pago Directo',
            phone: user?.username || 'N/A',
            ciudad: 'BOGOTÁ'
        }, {
            valTopLeft: periodo || 'N/A',
            labelTopLeft: 'Periodo Liquida.',
            valTopRight: fechaStr,
            labelTopRight: 'Fecha Pago',
            valMidLeft: user?.cargo || 'PERFIL REGISTRADO',
            valMidRight: (user?.role || 'OPERATIVO').toUpperCase(),
            labelMidRight: 'Rol Sistema',
            hideBottom: true
        });

        const diasTrab = calc?.diasTrabajados || 30;
        const saludPct = calc?.porcSalud || 4;
        const pensionPct = calc?.porcPension || 4;
        const itemsBreakdown = calc?.extrasBreakdown || [];

        const tableBody = [
            [`Sueldo Básico (${diasTrab} días)`, `$${Math.round(calc?.devBase || 0).toLocaleString('es-CO')}`, '—'],
            [`Auxilio de Transporte`, `$${Math.round(calc?.auxTransProp || 0).toLocaleString('es-CO')}`, '—'],
            ...itemsBreakdown.filter(e => e.cantHrs > 0).map(e => [
                `${e.label} (${e.cantHrs} hrs @ ${e.factor}x)`,
                `$${Math.round(e.subtotal || 0).toLocaleString('es-CO')}`,
                '—'
            ]),
            (calc?.bonif > 0) ? [`Bonificaciones / Incentivos`, `$${Math.round(calc.bonif).toLocaleString('es-CO')}`, '—'] : null,
            (calc?.valSalud > 0 || saludPct > 0) ? [`Aporte Salud (${saludPct}%)`, '—', `$${Math.round(calc?.valSalud || 0).toLocaleString('es-CO')}`] : null,
            (calc?.valPension > 0 || pensionPct > 0) ? [`Aporte Pensión (${pensionPct}%)`, '—', `$${Math.round(calc?.valPension || 0).toLocaleString('es-CO')}`] : null,
            (calc?.otrDed > 0) ? [`Otras Deducciones / Descuentos`, '—', `$${Math.round(calc.otrDed).toLocaleString('es-CO')}`] : null,
        ].filter(Boolean);

        autoTable(doc, {
            startY: y,
            margin: { left: margin, right: margin },
            head: [['CONCEPTO / DESCRIPCIÓN', 'DEVENGADOS', 'DEDUCCIONES']],
            body: tableBody,
            theme: 'grid',
            headStyles: { fillColor: [35, 101, 171], textColor: [255, 255, 255], fontSize: 8.5, fontStyle: 'bold', halign: 'center' },
            styles: { fontSize: 8.5, cellPadding: 3, textColor: [0, 0, 0], fontStyle: 'normal' },
            columnStyles: {
                0: { halign: 'left', cellWidth: 'auto' },
                1: { halign: 'right', cellWidth: 45 },
                2: { halign: 'right', cellWidth: 45 }
            }
        });

        y = doc.lastAutoTable.finalY + 8;

        const totalDev = Math.round(calc?.totalDevengado || 0);
        const totalDed = Math.round(calc?.totalDeducciones || 0);
        const neto = Math.round(calc?.netoAPagar || 0);

        // Summary box
        doc.setFillColor(248, 250, 252);
        doc.setDrawColor(203, 213, 225);
        doc.roundedRect(margin, y, W - (margin * 2), 20, 3, 3, 'FD');

        doc.setFontSize(8.5);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(30, 41, 59);
        doc.text(`Total Devengado: $${totalDev.toLocaleString('es-CO')}`, margin + 5, y + 6);
        doc.text(`Total Deducciones: $${totalDed.toLocaleString('es-CO')}`, margin + 5, y + 14);

        doc.setFontSize(11);
        doc.setTextColor(35, 101, 171);
        doc.text(`NETO A PAGAR: $${neto.toLocaleString('es-CO')}`, W - margin - 5, y + 11, { align: 'right' });

        y += 30;

        // Signatures
        doc.setLineWidth(0.5);
        doc.setDrawColor(30, 41, 59);
        doc.line(margin + 10, y, margin + 70, y);
        doc.line(W - margin - 70, y, W - margin - 10, y);

        doc.setFontSize(8);
        doc.setTextColor(30, 41, 59);
        doc.setFont('helvetica', 'normal');
        doc.text(`Firma Empleador (${settings?.companyName || 'Empresa'})`, margin + 40, y + 5, { align: 'center' });
        doc.text(`Firma Recibido (${user?.name || 'Trabajador'})`, W - margin - 40, y + 5, { align: 'center' });

        const safeWorkerName = (user?.name || 'Trabajador').replace(/\s+/g, '_');
        doc.save(`Comprobante_Nomina_${safeWorkerName}_${periodo || 'Periodo'}.pdf`);
    } catch (e) {
        console.error("Error generating Payroll PDF:", e);
    }
};
