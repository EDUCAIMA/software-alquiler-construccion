import { jsPDF } from 'jspdf';

const pad2 = value => String(value).padStart(2, '0');

const formatFecha = value => {
    const clean = String(value || '').split('T')[0];
    const [year, month, day] = clean.split('-');
    return year && month && day ? `${day}/${month}/${year}` : clean || '-';
};

const formatCOP = value => new Intl.NumberFormat('es-CO', {
    style: 'currency', currency: 'COP', maximumFractionDigits: 0
}).format(Number(value) || 0);

const unidades = ['', 'UN', 'DOS', 'TRES', 'CUATRO', 'CINCO', 'SEIS', 'SIETE', 'OCHO', 'NUEVE'];
const especiales = {
    10: 'DIEZ', 11: 'ONCE', 12: 'DOCE', 13: 'TRECE', 14: 'CATORCE', 15: 'QUINCE',
    16: 'DIECISEIS', 17: 'DIECISIETE', 18: 'DIECIOCHO', 19: 'DIECINUEVE',
    20: 'VEINTE', 21: 'VEINTIUN', 22: 'VEINTIDOS', 23: 'VEINTITRES', 24: 'VEINTICUATRO',
    25: 'VEINTICINCO', 26: 'VEINTISEIS', 27: 'VEINTISIETE', 28: 'VEINTIOCHO', 29: 'VEINTINUEVE'
};
const decenas = ['', '', 'VEINTE', 'TREINTA', 'CUARENTA', 'CINCUENTA', 'SESENTA', 'SETENTA', 'OCHENTA', 'NOVENTA'];
const centenas = ['', 'CIENTO', 'DOSCIENTOS', 'TRESCIENTOS', 'CUATROCIENTOS', 'QUINIENTOS', 'SEISCIENTOS', 'SETECIENTOS', 'OCHOCIENTOS', 'NOVECIENTOS'];

const grupoEnLetras = number => {
    const n = Math.floor(number);
    if (!n) return '';
    if (n === 100) return 'CIEN';
    const c = Math.floor(n / 100);
    const resto = n % 100;
    let texto = centenas[c];
    if (resto) {
        if (texto) texto += ' ';
        if (resto < 10) texto += unidades[resto];
        else if (especiales[resto]) texto += especiales[resto];
        else {
            const d = Math.floor(resto / 10);
            const u = resto % 10;
            texto += `${decenas[d]}${u ? ` Y ${unidades[u]}` : ''}`;
        }
    }
    return texto;
};

export const numeroALetrasCOP = value => {
    const amount = Math.max(0, Math.round(Number(value) || 0));
    if (amount === 0) return 'CERO PESOS M/CTE';
    const millones = Math.floor(amount / 1000000);
    const miles = Math.floor((amount % 1000000) / 1000);
    const resto = amount % 1000;
    const parts = [];
    if (millones) parts.push(millones === 1 ? 'UN MILLON' : `${grupoEnLetras(millones)} MILLONES`);
    if (miles) parts.push(miles === 1 ? 'MIL' : `${grupoEnLetras(miles)} MIL`);
    if (resto) parts.push(grupoEnLetras(resto));
    const needsDe = amount >= 1000000 && amount % 1000000 === 0;
    return `${parts.join(' ')}${needsDe ? ' DE' : ''} PESOS M/CTE`;
};

const addImageContained = (doc, dataUrl, x, y, maxWidth, maxHeight) => {
    if (!dataUrl) return false;
    try {
        const props = doc.getImageProperties(dataUrl);
        const ratio = props.width / props.height;
        let width = maxWidth;
        let height = width / ratio;
        if (height > maxHeight) {
            height = maxHeight;
            width = height * ratio;
        }
        doc.addImage(dataUrl, props.fileType || 'PNG', x + (maxWidth - width) / 2, y + (maxHeight - height) / 2, width, height);
        return true;
    } catch (error) {
        console.warn('No se pudo incluir una imagen en el recibo:', error);
        return false;
    }
};

const drawField = (doc, label, value, x, y, width) => {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    doc.setTextColor(30, 41, 59);
    doc.text(label, x, y);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9.5);
    doc.setTextColor(15, 23, 42);
    const text = String(value || '-');
    doc.text(text.length > 52 ? `${text.slice(0, 49)}...` : text, x, y + 5.2);
    doc.setDrawColor(100, 116, 139);
    doc.setLineWidth(0.25);
    doc.line(x, y + 7, x + width, y + 7);
};

export const buildReciboCajaPDF = (recibo, settings = {}) => {
    const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
    const W = doc.internal.pageSize.getWidth();
    const H = doc.internal.pageSize.getHeight();
    const left = 14;
    const right = W - 14;
    const isIngreso = recibo.tipo === 'Ingreso';
    const accent = isIngreso ? [5, 150, 105] : [220, 38, 38];
    const companyName = settings.companyName || 'CIELO - ALQUILER DE HERRAMIENTA';
    const shortName = settings.shortName || 'CIELO';

    // Encabezado basado en el formato de referencia suministrado.
    doc.setDrawColor(148, 163, 184);
    doc.setLineWidth(0.25);
    doc.rect(left, 12, right - left, 26);
    doc.line(58, 12, 58, 38);
    doc.line(157, 12, 157, 38);
    doc.line(58, 25, right, 25);
    doc.line(157, 20.7, right, 20.7);
    doc.line(157, 29.3, right, 29.3);

    if (!addImageContained(doc, settings.logo, 20, 16, 32, 15)) {
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(17);
        doc.setTextColor(15, 23, 42);
        doc.text(shortName.toUpperCase(), 36, 27, { align: 'center' });
    }

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10.5);
    doc.setTextColor(15, 23, 42);
    const companyLines = doc.splitTextToSize(companyName.toUpperCase(), 92);
    doc.text(companyLines.slice(0, 2), 107.5, companyLines.length > 1 ? 17.5 : 20.5, { align: 'center' });
    doc.setFontSize(10.5);
    doc.text(`RECIBO DE CAJA MENOR - ${recibo.tipo.toUpperCase()}`, 107.5, 33.2, { align: 'center' });

    doc.setFontSize(8.5);
    doc.setFont('helvetica', 'bold');
    doc.text(recibo.numero || 'RCJ-PENDIENTE', 176.5, 17.7, { align: 'center' });
    doc.setFont('helvetica', 'normal');
    doc.text(formatFecha(recibo.fecha), 176.5, 26.4, { align: 'center' });
    doc.text('Pagina 1 de 1', 176.5, 35, { align: 'center' });

    doc.setFontSize(8.5);
    doc.setTextColor(30, 41, 59);
    const nit = settings.nit ? `NIT. ${settings.nit}` : 'NIT no configurado';
    doc.text(nit, W / 2, 46, { align: 'center' });
    doc.text(settings.address || 'Direccion no configurada', W / 2, 51, { align: 'center' });
    doc.text(`Tel: ${settings.phone || '-'}  |  ${settings.email || '-'}`, W / 2, 56, { align: 'center' });

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(18);
    doc.setTextColor(15, 23, 42);
    doc.text('RECIBO DE CAJA MENOR', W / 2, 69, { align: 'center' });
    doc.setFontSize(10);
    doc.setTextColor(...accent);
    doc.text(`${recibo.tipo.toUpperCase()}  |  Nro. ${recibo.numero || 'PENDIENTE'}`, W / 2, 76, { align: 'center' });

    drawField(doc, 'Fecha:', formatFecha(recibo.fecha), left, 88, 78);
    drawField(doc, 'Ciudad:', recibo.ciudad, 108, 88, 88);
    drawField(doc, isIngreso ? 'Recibimos de:' : 'Pagamos a:', recibo.tercero, left, 104, 78);
    drawField(doc, 'Identificacion CC / NIT:', recibo.identificacion, 108, 104, 88);

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    doc.setTextColor(30, 41, 59);
    doc.text('La suma de:', left, 121);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.setTextColor(15, 23, 42);
    const amountLines = doc.splitTextToSize(numeroALetrasCOP(recibo.monto), right - left - 4);
    doc.text(amountLines.slice(0, 2), left + 2, 127);
    doc.setDrawColor(100, 116, 139);
    doc.line(left, 134, right, 134);

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    doc.text('Por concepto de:', left, 142);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9.2);
    const conceptLines = doc.splitTextToSize(String(recibo.concepto || '-'), right - left - 4);
    doc.text(conceptLines.slice(0, 3), left + 2, 148);
    [153, 160, 167].forEach(y => {
        doc.setDrawColor(203, 213, 225);
        doc.line(left, y, right, y);
    });

    doc.setFillColor(248, 250, 252);
    doc.setDrawColor(148, 163, 184);
    doc.roundedRect(52, 174, 106, 22, 2, 2, 'FD');
    doc.line(52, 185, 158, 185);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9.5);
    doc.setTextColor(15, 23, 42);
    doc.text('VALOR', 57, 181.5);
    doc.setTextColor(...accent);
    doc.text(formatCOP(recibo.monto), 153, 181.5, { align: 'right' });
    doc.setTextColor(15, 23, 42);
    doc.text('FORMA DE PAGO', 57, 192.2);
    doc.setFont('helvetica', 'normal');
    doc.text(recibo.metodo_pago || 'Efectivo', 153, 192.2, { align: 'right' });

    if (recibo.movimiento_id) {
        doc.setFontSize(7.2);
        doc.setTextColor(100, 116, 139);
        doc.text(`Movimiento vinculado: ${recibo.movimiento_id}`, W / 2, 202, { align: 'center' });
    }

    const signatureY = 211;
    const signatureW = 76;
    const signatureH = 25;
    const leftSignatureX = 20;
    const rightSignatureX = 114;
    doc.setDrawColor(203, 213, 225);
    doc.setFillColor(255, 255, 255);
    doc.roundedRect(leftSignatureX, signatureY, signatureW, signatureH, 2, 2, 'FD');
    doc.roundedRect(rightSignatureX, signatureY, signatureW, signatureH, 2, 2, 'FD');

    const companyAdded = addImageContained(doc, recibo.firma_empresa, leftSignatureX + 7, signatureY + 2, signatureW - 14, signatureH - 5);
    const thirdAdded = addImageContained(doc, recibo.firma_tercero, rightSignatureX + 7, signatureY + 2, signatureW - 14, signatureH - 5);
    if (!companyAdded) {
        doc.setFont('helvetica', 'italic');
        doc.setFontSize(7);
        doc.setTextColor(148, 163, 184);
        doc.text('Sin firma cargada', leftSignatureX + signatureW / 2, signatureY + 14, { align: 'center' });
    }
    if (!thirdAdded) {
        doc.setFont('helvetica', 'italic');
        doc.setFontSize(7);
        doc.setTextColor(148, 163, 184);
        doc.text('Sin firma cargada', rightSignatureX + signatureW / 2, signatureY + 14, { align: 'center' });
    }

    doc.setDrawColor(71, 85, 105);
    doc.line(leftSignatureX, 241, leftSignatureX + signatureW, 241);
    doc.line(rightSignatureX, 241, rightSignatureX + signatureW, 241);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7.5);
    doc.setTextColor(30, 41, 59);
    const companyRole = isIngreso ? 'Firma autorizada - Recibe' : 'Firma autorizada - Entrega';
    const thirdRole = isIngreso ? 'Firma de quien entrega' : 'Firma de quien recibe';
    doc.text(companyRole, leftSignatureX + signatureW / 2, 246, { align: 'center' });
    doc.text(thirdRole, rightSignatureX + signatureW / 2, 246, { align: 'center' });
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.2);
    doc.text(recibo.firmante_empresa || shortName, leftSignatureX + signatureW / 2, 251, { align: 'center' });
    doc.text(recibo.firmante_tercero || recibo.tercero || '-', rightSignatureX + signatureW / 2, 251, { align: 'center' });
    if (recibo.identificacion) {
        doc.setTextColor(100, 116, 139);
        doc.text(`CC / NIT: ${recibo.identificacion}`, rightSignatureX + signatureW / 2, 255.5, { align: 'center' });
    }

    doc.setDrawColor(226, 232, 240);
    doc.line(left, H - 19, right, H - 19);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(6.8);
    doc.setTextColor(100, 116, 139);
    const generatedAt = new Date();
    const timestamp = `${pad2(generatedAt.getDate())}/${pad2(generatedAt.getMonth() + 1)}/${generatedAt.getFullYear()} ${pad2(generatedAt.getHours())}:${pad2(generatedAt.getMinutes())}`;
    doc.text(`Documento generado por el sistema ${shortName} el ${timestamp}`, W / 2, H - 12, { align: 'center' });
    doc.setFontSize(6.2);
    doc.text('Las firmas incluidas corresponden a imagenes cargadas por el usuario responsable del registro.', W / 2, H - 8, { align: 'center' });

    return doc;
};

export const downloadReciboCajaPDF = (recibo, settings = {}) => {
    const doc = buildReciboCajaPDF(recibo, settings);
    doc.save(`${recibo.numero || 'Recibo_Caja'}_${recibo.tipo || 'Movimiento'}.pdf`);
};
