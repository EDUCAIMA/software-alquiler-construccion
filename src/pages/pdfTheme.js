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
 * Etiquetas de estado en la columna "EQUIPO / DESCRIPCIÓN" de los cortes de obra.
 *
 * Los nombres de equipo de un corte vienen con una anotación al final:
 *   "(Dev: fecha)" / "(Dev. previa: fecha)" → el equipo ya fue devuelto
 *   "(Corte: fecha)" o sin anotación        → el equipo sigue en obra
 *
 * Este ayudante separa esa anotación del nombre para dibujarla aparte: en la
 * misma celda y fila, pero alineada al borde derecho y con color propio
 * (azul = devuelto, rojo = en obra).
 */
const DATE_TAG_RE = /\s*(\((?:DEV|CORTE)[^()]*\))\s*$/i;
const COLOR_DEVUELTO = [35, 101, 171]; // #2365AB
const COLOR_EN_OBRA = [220, 38, 38];   // #DC2626

export const createEquipoTagger = (doc, { fontSize = 8, basePadding = 2, columnIndex = 1, columnWidth = Infinity } = {}) => {
    const tagsByRow = {};
    const GAP = 2; // separación mínima entre el nombre y la etiqueta

    const measure = (text, fontStyle) => {
        const prevFont = doc.getFont();
        const prevSize = doc.getFontSize();
        doc.setFont('helvetica', fontStyle);
        doc.setFontSize(fontSize);
        const width = doc.getTextWidth(text);
        doc.setFont(prevFont.fontName, prevFont.fontStyle);
        doc.setFontSize(prevSize);
        return width;
    };

    const lineHeightOf = () => {
        const factor = doc.getLineHeightFactor ? doc.getLineHeightFactor() : 1.15;
        return (fontSize / doc.internal.scaleFactor) * factor;
    };

    /** Número de líneas que ocupa un texto dentro de un ancho dado. */
    const countLines = (text, width) => {
        if (!(width > 0)) return Infinity;
        const prevFont = doc.getFont();
        const prevSize = doc.getFontSize();
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(fontSize);
        const lines = doc.splitTextToSize(text, width);
        doc.setFont(prevFont.fontName, prevFont.fontStyle);
        doc.setFontSize(prevSize);
        return lines.length;
    };

    return {
        /**
         * Prepara la celda de equipo: quita la anotación del texto y reserva el
         * espacio de la etiqueta para que el nombre nunca se solape con ella.
         *
         * Si al reservar ese ancho el nombre quedaría demasiado apretado (se
         * partirían palabras a la mitad), la etiqueta baja a su propia línea
         * dentro de la misma celda, siempre pegada al borde derecho.
         *
         * @param {number} rowIndex índice de la fila dentro del body de la tabla
         * @param {string} name nombre del equipo (puede traer la anotación)
         * @param {string} extraLines líneas adicionales a añadir bajo el nombre
         * @param {object} options opciones adicionales { noTag: boolean }
         */
        cell: (rowIndex, name, extraLines = '', options = {}) => {
            const upper = (name || '').toUpperCase();
            const match = upper.match(DATE_TAG_RE);
            const annotation = match ? match[1] : '';
            const cleanName = match ? upper.replace(DATE_TAG_RE, '') : upper;

            // Normalizar texto sin tildes para coincidencias seguras
            const normalized = cleanName.normalize("NFD").replace(/[\u0300-\u036f]/g, "");

            // No aplicar tag 'EN OBRA' a items de transporte o servicios generales a menos que tengan devolución explícita
            const isTransportOrService = options.noTag || 
                normalized.includes('TRANSPORTE') || 
                normalized.includes('FLETE') || 
                normalized.includes('ACARREO') || 
                normalized.includes('DESPACHO') || 
                normalized.includes('RECOGIDA') || 
                normalized.includes('ENTREGA') ||
                normalized.includes('RECOLECCION') ||
                normalized.includes('ENVIO') ||
                normalized.includes('SERVICIO');

            if (isTransportOrService && !annotation) {
                return {
                    content: cleanName + extraLines,
                    styles: {
                        cellPadding: { top: basePadding, right: basePadding, bottom: basePadding, left: basePadding }
                    }
                };
            }

            const tag = /^\(DEV/i.test(annotation)
                ? { text: annotation, color: COLOR_DEVUELTO }
                : { text: annotation ? `EN OBRA ${annotation}` : 'EN OBRA', color: COLOR_EN_OBRA };

            const tagWidth = measure(tag.text, 'bold');
            const available = columnWidth - basePadding * 2;
            const remaining = available - tagWidth - GAP;
            const longestWord = Math.max(
                0,
                ...cleanName.split(/\s+/).filter(Boolean).map(w => measure(w, 'normal'))
            );

            // Va en la misma línea del nombre solo si no parte ninguna palabra y
            // si no hace crecer la celda más que bajar la etiqueta a su propia
            // línea (que siempre cuesta exactamente una línea extra).
            tag.inline = remaining >= longestWord &&
                countLines(cleanName, remaining) <= countLines(cleanName, available) + 1;
            tagsByRow[rowIndex] = tag;

            return {
                content: cleanName + extraLines,
                styles: {
                    cellPadding: tag.inline
                        ? { top: basePadding, right: tagWidth + GAP + basePadding, bottom: basePadding, left: basePadding }
                        : { top: basePadding, right: basePadding, bottom: basePadding + lineHeightOf(), left: basePadding }
                }
            };
        },

        /** Hook `didDrawCell` de autoTable que pinta la etiqueta. */
        didDrawCell: (data) => {
            if (data.section !== 'body' || data.column.index !== columnIndex) return;
            const tag = tagsByRow[data.row.index];
            if (!tag) return;

            const cell = data.cell;
            const tagX = cell.x + cell.width - basePadding;

            const prevFont = doc.getFont();
            const prevSize = doc.getFontSize();
            const prevColor = doc.getTextColor();

            doc.setFont('helvetica', 'bold');
            doc.setFontSize(fontSize);
            doc.setTextColor(tag.color[0], tag.color[1], tag.color[2]);

            if (tag.inline) {
                // Misma línea base que la primera línea de texto de la celda
                // (replica el cálculo interno de autoTable).
                const size = doc.internal.getFontSize() / doc.internal.scaleFactor;
                const factor = doc.getLineHeightFactor ? doc.getLineHeightFactor() : 1.15;
                const lineHeight = size * factor;

                const pos = cell.getTextPos();
                let tagY = pos.y + size * (2 - 1.15);
                if (cell.styles.valign === 'middle') tagY -= (cell.text.length / 2) * lineHeight;
                else if (cell.styles.valign === 'bottom') tagY -= cell.text.length * lineHeight;

                doc.text(tag.text, tagX, tagY, { align: 'right' });
            } else {
                // Línea propia reservada al pie de la celda
                doc.text(tag.text, tagX, cell.y + cell.height - basePadding, { align: 'right', baseline: 'bottom' });
            }

            doc.setTextColor(prevColor);
            doc.setFont(prevFont.fontName, prevFont.fontStyle);
            doc.setFontSize(prevSize);
        }
    };
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
    
    doc.setFontSize(8.5);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(35, 101, 171); // Azul en negrilla sostenida
    doc.text(meta.valTopLeft || '—', dateBoxX + 18.75, y + 7, { align: 'center' });
    doc.text(meta.valTopRight || '—', dateBoxX + 56.25, y + 7, { align: 'center' });
    doc.setTextColor(30, 41, 59); // Restablecer color por defecto

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
