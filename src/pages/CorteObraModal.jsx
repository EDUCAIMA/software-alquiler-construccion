import React, { useState, useMemo, useRef } from 'react';
import {
    Calculator, FileText, X, Truck, ChevronDown, CheckCircle, AlertTriangle
} from 'lucide-react';
import { useAppContext } from '../context/AppContext';
import { format, addDays } from 'date-fns';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { applyStandardLayout, drawInfoGrid, createEquipoTagger } from './pdfTheme';
import { generateInvoicePDF, calcularHorasAlquiler, calcularHoraFin } from './CotizacionesHelpers';
import { calculateCorteRentalLines } from './corteBillingUtils';
import { calculatePendingCorteTransport } from './corteInvoiceUtils';
import { requireCorteRecords } from './corteDataUtils';

// ─── Helpers ──────────────────────────────────────────────────────────────────
const fmtCOP = n => `$${(n || 0).toLocaleString('es-CO')}`;
const getEasterSunday = (year) => {
    const a = year % 19;
    const b = Math.floor(year / 100);
    const c = year % 100;
    const d = Math.floor(b / 4);
    const e = b % 4;
    const f = Math.floor((b + 8) / 25);
    const g = Math.floor((b - f + 1) / 3);
    const h = (19 * a + b - d - g + 15) % 30;
    const i = Math.floor(c / 4);
    const k = c % 4;
    const l = (32 + 2 * e + 2 * i - h - k) % 7;
    const m = Math.floor((a + 11 * h + 22 * l) / 451);
    const month = Math.floor((h + l - 7 * m + 114) / 31);
    const day = ((h + l - 7 * m + 114) % 31) + 1;
    return new Date(year, month - 1, day);
};

const getColombianHolidaysMap = (year) => {
    const holidays = new Set();

    const formatDate = (d) => {
        const y = d.getFullYear();
        const m = String(d.getMonth() + 1).padStart(2, '0');
        const day = String(d.getDate()).padStart(2, '0');
        return `${y}-${m}-${day}`;
    };

    const addHoliday = (d) => {
        holidays.add(formatDate(d));
    };

    const moveToMonday = (d) => {
        const day = d.getDay();
        if (day === 1) return d;
        const result = new Date(d);
        result.setDate(d.getDate() + (day === 0 ? 1 : 8 - day));
        return result;
    };

    // Fixed holidays
    addHoliday(new Date(year, 0, 1));   // Jan 1
    addHoliday(new Date(year, 4, 1));   // May 1
    addHoliday(new Date(year, 6, 20));  // Jul 20
    addHoliday(new Date(year, 7, 7));   // Aug 7
    addHoliday(new Date(year, 11, 8));  // Dec 8
    addHoliday(new Date(year, 11, 25)); // Dec 25

    // Emiliani holidays
    addHoliday(moveToMonday(new Date(year, 0, 6)));   // Jan 6
    addHoliday(moveToMonday(new Date(year, 2, 19)));  // Mar 19
    addHoliday(moveToMonday(new Date(year, 5, 29)));  // Jun 29
    addHoliday(moveToMonday(new Date(year, 7, 15)));  // Aug 15
    addHoliday(moveToMonday(new Date(year, 9, 12)));  // Oct 12
    addHoliday(moveToMonday(new Date(year, 10, 1)));  // Nov 1
    addHoliday(moveToMonday(new Date(year, 10, 11))); // Nov 11

    // Easter holidays
    const easter = getEasterSunday(year);

    const juevesSanto = new Date(easter);
    juevesSanto.setDate(easter.getDate() - 3);
    addHoliday(juevesSanto);

    const viernesSanto = new Date(easter);
    viernesSanto.setDate(easter.getDate() - 2);
    addHoliday(viernesSanto);

    const ascension = new Date(easter);
    ascension.setDate(easter.getDate() + 43);
    addHoliday(ascension);

    const corpus = new Date(easter);
    corpus.setDate(easter.getDate() + 64);
    addHoliday(corpus);

    const corazon = new Date(easter);
    corazon.setDate(easter.getDate() + 71);
    addHoliday(corazon);

    return holidays;
};

function generateCortePDF(resultado, client, obra, settings, remisiones, invoices) {
    const doc = new jsPDF();
    const pageW = doc.internal.pageSize.getWidth();
    const margin = 10;

    let y = applyStandardLayout(doc, 'Corte de Obra', settings);

    y = drawInfoGrid(doc, y, client, {
        valTopLeft: resultado.fechaInicio || '—',
        valTopRight: resultado.fechaCorte || '—',
        labelTopLeft: 'Corte Inicio',
        labelTopRight: 'Corte Fin',
        valMidLeft: obra?.nombre?.substring(0, 20) || 'TODAS LAS OBRAS',
        valMidRight: client?.responsableIVA ? 'RESP. IVA' : 'NO RESP.',
        valBottom: fmtCOP(resultado.totalNeto),
        labelBottom: 'Valor Total Corte:',
        obraDireccion: obra?.ubicacion || client?.direccion
    });

    // Group lines by remId
    const grouped = resultado.lineas.reduce((acc, l) => {
        if (!acc[l.remId]) acc[l.remId] = [];
        acc[l.remId].push(l);
        return acc;
    }, {});

    // For each remission group, create a table
    Object.entries(grouped).forEach(([remId, lines]) => {
        const remObj = remisiones.find(r => String(r.id) === String(remId));
        let displayId = remObj?.cotizacionId;

        if (!displayId && remObj?.facturaId) {
            const linkedInv = invoices.find(inv => String(inv.id) === String(remObj.facturaId));
            if (linkedInv?.cotizacionId) displayId = linkedInv.cotizacionId;
        }

        if (!displayId) displayId = remId;

        // Add a sub-header for the remission
        doc.setFontSize(9);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(35, 101, 171); // #2365AB
        doc.text(`#${displayId} - Despachada el ${lines[0].remFecha}`, margin, y + 6);
        y += 8;

        // Etiqueta de estado (devuelto / en obra) al lado derecho de cada equipo.
        // El ancho de la columna "EQUIPO" es el sobrante tras las columnas fijas.
        const tagger = createEquipoTagger(doc, {
            fontSize: 7.5,
            basePadding: 2,
            columnWidth: pageW - margin * 2 - (10 + 15 + 15 + 25 + 30)
        });

        autoTable(doc, {
            startY: y,
            margin: { left: margin, right: margin },
            head: [['ITE', 'EQUIPO / DESCRIPCIÓN', 'CAN.', 'DÍAS/HRS', 'TARIFA', 'SUBTOTAL']],
            body: lines.map((l, idx) => {
                const horario = (l.isHora && (l.horaInicio || l.horaFin))
                    ? `\n[Horario: ${l.horaInicio || '--:--'} a ${l.horaFin || '--:--'}]`
                    : '';

                return [
                    idx + 1,
                    tagger.cell(idx, l.equipo, horario, { noTag: l.isServ }),
                    l.cantidad,
                    l.isHora ? `${l.dias} hrs` : l.dias,
                    l.tarifaDia.toLocaleString('es-CO'),
                    l.subtotal.toLocaleString('es-CO')
                ];
            }),
            didDrawCell: tagger.didDrawCell,
            theme: 'grid',
            headStyles: {
                fillColor: [241, 245, 249],
                textColor: [30, 41, 59],
                fontSize: 7.5,
                fontStyle: 'bold',
                halign: 'center',
                lineWidth: 0.1,
                lineColor: [200, 200, 200]
            },
            styles: {
                fontSize: 7.5,
                cellPadding: 2,
                textColor: [30, 41, 59],
                halign: 'center',
                lineWidth: 0.1,
                lineColor: [200, 200, 200]
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

        y = doc.lastAutoTable.finalY + 10;

        // Check for page break if there are more remissions
        if (y > 250) {
            doc.addPage();
            y = 20;
        }
    });

    const finalY = y;
    const totW = 80;
    const totX = pageW - margin - totW;
    const totH = 7;
    let ty = finalY;

    // Check if totals fit on the current page
    if (ty > 240) {
        doc.addPage();
        ty = 20;
    }

    const totals = [
        ['SUBTOTAL ALQUILER GLOBAL', resultado.subtotal.toLocaleString('es-CO')],
        ['DESCUENTO', `-${resultado.descuento.toLocaleString('es-CO')}`],
        [`IVA APLICADO (${resultado.porcIVA || 0}%)`, resultado.iva.toLocaleString('es-CO')],
        [`RETENCIÓN FUENTE (${client?.porcRetencion || 0}%)`, resultado.retencion.toLocaleString('es-CO')],
        ...(resultado.pagosPrevios > 0 ? [['ABONOS DEL CLIENTE', `-${resultado.pagosPrevios.toLocaleString('es-CO')}`]] : [])
    ];

    totals.forEach(([label, value]) => {
        doc.setLineWidth(0.1);
        doc.setDrawColor(200, 200, 200);
        doc.rect(totX, ty, 50, totH);
        doc.rect(totX + 50, ty, 30, totH);
        doc.setFontSize(7);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(30, 41, 59);
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
    doc.setFont('helvetica', 'bold');
    doc.text('TOTAL NETO A FACTURAR', totX + 2, ty + 6);
    doc.text(`$${resultado.totalNeto.toLocaleString('es-CO')}`, totX + 78, ty + 6, { align: 'right' });

    doc.save(`Corte_${obra?.nombre?.replace(/\s+/g, '_') || 'Todas_las_obras'}_${format(new Date(), 'yyyyMMdd')}.pdf`);
}

export default function CorteObraModal({ onClose, initialClientId = '', initialObraId = '' }) {
    const { clients, remisiones, products, invoices, logs, createInvoice, settings, markClientAbonosApplied } = useAppContext();

    const [clientId, setClientId] = useState(initialClientId);
    const [clientSearch, setClientSearch] = useState('');
    const [clientDropdownOpen, setClientDropdownOpen] = useState(false);
    const [obraId, setObraId] = useState(initialObraId);
    const [fechaInicio, setFechaInicio] = useState(format(addDays(new Date(), -30), 'yyyy-MM-dd'));
    const [fechaCorte, setFechaCorte] = useState(format(new Date(), 'yyyy-MM-dd'));
    const [generado, setGenerado] = useState(false);
    const [saved, setSaved] = useState(false);
    const [saving, setSaving] = useState(false);
    const [invoiceError, setInvoiceError] = useState('');
    const savingRef = useRef(false);
    const [selectedRemIds, setSelectedRemIds] = useState([]);

    const [customDays, setCustomDays] = useState({}); // key -> number
    const [customDates, setCustomDates] = useState({}); // key -> string YYYY-MM-DD
    const [customFestivos, setCustomFestivos] = useState({}); // key -> number
    const [aplicarFestivos, setAplicarFestivos] = useState(false);
    const [customHorasInicio, setCustomHorasInicio] = useState({}); // key -> string HH:mm
    const [customHorasFin, setCustomHorasFin] = useState({}); // key -> string HH:mm
    const [descuentoTipo, setDescuentoTipo] = useState('porcentaje');
    const [descuentoValor, setDescuentoValor] = useState('');
    const [selectedAbonoIds, setSelectedAbonoIds] = useState([]);

    const selectedClient = clients.find(c => String(c.id) === String(clientId));
    const obrasDisp = requireCorteRecords(selectedClient?.obras, 'las obras');
    const selectedObra = obrasDisp.find(o => String(o.id) === String(obraId));
    const abonosDisponibles = useMemo(() => requireCorteRecords(selectedClient?.abonos, 'los abonos').filter(abono =>
        !abono.aplicado && Number(abono.saldo ?? abono.monto) > 0 &&
        abono.aplicarProximoCorte !== false &&
        (!abono.obraId || !obraId || String(abono.obraId) === String(obraId))
    ), [selectedClient, obraId]);
    const clientsSorted = useMemo(() => {
        return [...clients].sort((a, b) =>
            String(a.name || '').localeCompare(String(b.name || ''), 'es', { sensitivity: 'base' })
        );
    }, [clients]);
    const filteredClients = useMemo(() => {
        const query = String(clientSearch).trim().toLowerCase();
        if (!query) return clientsSorted;
        return clientsSorted.filter(client =>
            [client.name, client.id, client.nit, client.city]
                .filter(Boolean)
                .some(value => String(value).toLowerCase().includes(query))
        );
    }, [clientsSorted, clientSearch]);

    React.useEffect(() => {
        setClientSearch(selectedClient?.name || '');
    }, [selectedClient?.id, selectedClient?.name]);

    // El cierre corresponde a la devolución física. La cobertura facturada se
    // descuenta después, por equipo, cantidad y fecha, sin depender del pago.
    const availableRems = useMemo(() => {
        if (!clientId) return [];
        return remisiones.filter(rem =>
            String(rem.clientId) === String(clientId) &&
            (!obraId || String(rem.obraId) === String(obraId)) &&
            !['cancelada', 'anulada'].includes(String(rem.estado || '').toLowerCase())
        ).sort((a, b) => String(b.fecha).localeCompare(String(a.fecha)));
    }, [clientId, obraId, remisiones]);

    // Reset when base client/obra/dates/festivos change
    React.useEffect(() => {
        setCustomDays({});
        setCustomDates({});
        setCustomFestivos({});
        setCustomHorasInicio({});
        setCustomHorasFin({});
        setInvoiceError('');
    }, [clientId, obraId, fechaInicio, fechaCorte, aplicarFestivos]);

    // Update selection when filters change
    React.useEffect(() => {
        setSelectedRemIds(availableRems.map(r => r.id));
        setGenerado(false);
        setSaved(false);
    }, [availableRems]);

    React.useEffect(() => {
        setSelectedAbonoIds(abonosDisponibles.map(abono => abono.id));
        setGenerado(false);
        setSaved(false);
    }, [clientId, obraId, abonosDisponibles]);

    const resultado = useMemo(() => {
        if (!clientId || !fechaInicio || !fechaCorte) return null;

        const holidaysByYear = new Map();
        const { lineas, issues } = calculateCorteRentalLines({
            remisiones: availableRems,
            invoices,
            products,
            auditLogs: logs,
            fechaInicio,
            fechaCorte,
            customDates,
            customDays,
            customFestivos,
            customHorasInicio,
            customHorasFin,
            aplicarFestivos,
            calculateHours: calcularHorasAlquiler,
            isHoliday: date => {
                const year = Number(date.slice(0, 4));
                if (!holidaysByYear.has(year)) holidaysByYear.set(year, getColombianHolidaysMap(year));
                return holidaysByYear.get(year).has(date);
            }
        });

        const selectedLineas = lineas.filter(line =>
            selectedRemIds.includes(line.remId) && Number(line.subtotal) > 0
        );
        const remisionesConCobro = new Set(selectedLineas.map(line => String(line.remId)));
        const pendingTransport = calculatePendingCorteTransport({
            remisiones, invoices, remIdsConCobro: remisionesConCobro, fechaInicio, fechaCorte
        });
        const totalTransporteFiltered = pendingTransport.total;
        const subtotalTotalFiltered = selectedLineas.reduce((sum, line) => sum + line.subtotal, 0);

        const valorDescuento = Math.max(0, Number(descuentoValor) || 0);
        const descuento = descuentoTipo === 'porcentaje'
            ? Math.min(subtotalTotalFiltered, Math.round(subtotalTotalFiltered * Math.min(100, valorDescuento) / 100))
            : Math.min(subtotalTotalFiltered, valorDescuento);
        const subtotalConDescuento = subtotalTotalFiltered - descuento;
        const porcIVA = selectedClient?.responsableIVA ? (selectedClient?.porcIVA || 0) : 0;
        const porcRet = selectedClient?.porcRetencion || 0;
        const iva = Math.round(subtotalConDescuento * porcIVA / 100);
        const retencion = Math.round(subtotalConDescuento * porcRet / 100);

        const totalAntesDePagos = subtotalConDescuento + iva + retencion + totalTransporteFiltered;
        const pagosPrevios = abonosDisponibles
            .filter(abono => selectedAbonoIds.includes(abono.id))
            .reduce((sum, abono) => sum + (Number(abono.saldo ?? abono.monto) || 0), 0);
        const pagosAplicados = Math.min(totalAntesDePagos, pagosPrevios);
        const totalNeto = Math.max(0, totalAntesDePagos - pagosAplicados);

        return {
            lineas,
            issues: [...issues, ...pendingTransport.issues],
            transportes: pendingTransport.transportes,
            selectedLineas,
            subtotal: subtotalTotalFiltered,
            descuento,
            subtotalConDescuento,
            iva,
            retencion,
            transporte: totalTransporteFiltered,
            totalAntesDePagos,
            pagosPrevios: pagosAplicados,
            totalNeto,
            porcIVA,
            porcRet
        };
    }, [clientId, fechaInicio, fechaCorte, availableRems, remisiones, selectedRemIds, products, invoices, logs, selectedClient, customDays, customDates, customFestivos, customHorasInicio, customHorasFin, descuentoTipo, descuentoValor, aplicarFestivos, abonosDisponibles, selectedAbonoIds]);

    const handleGenerate = () => { if (resultado) setGenerado(true); };
    const handleSaveInvoice = async () => {
        if (!resultado || saved || savingRef.current || resultado.selectedLineas.length === 0) return;
        savingRef.current = true;
        setSaving(true);
        setInvoiceError('');

        const itemsToFacturar = resultado.selectedLineas.map(l => ({
            productId: l.productId,
            nombre: l.equipo,
            quantity: l.cantidad,
            days: l.dias,
            price: l.tarifaDia,
            tipoCobro: l.isServ ? 'Servicio' : l.isHora ? 'Hora' : 'Día',
            esquemaCobro: l.esquema,
            remId: l.remId,
            remItemKey: l.remItemKey,
            remFecha: l.remFecha,
            rentalCoverage: l.billingCoverage
        }));

        try {
            const newInvoice = await createInvoice({
                clientId,
                obraId,
                items: itemsToFacturar,
                transporte: resultado.transporte,
                remisionEnabled: true,
                remisionCreada: true,
                paidAmount: resultado.pagosPrevios,
                descuentoMonto: resultado.descuento,
                descuentoTipo,
                descuentoValor: Number(descuentoValor) || 0,
                cortes: [{
                    id: Date.now(),
                    fechaInicio: fechaInicio,
                    fechaCorte: fechaCorte,
                    transportes: resultado.transportes,
                    status: 'Pendiente',
                    abonoIds: selectedAbonoIds
                }]
            });

            if (newInvoice && selectedAbonoIds.length > 0) {
                await markClientAbonosApplied(clientId, selectedAbonoIds, newInvoice.id, resultado.pagosPrevios);
            }

            // Download Invoice PDF
            if (newInvoice) {
                generateInvoicePDF(newInvoice, selectedClient, products, settings);
            }

            // Also download the Corte PDF (Liquidación)
            generateCortePDF({ ...resultado, lineas: resultado.selectedLineas, fechaInicio, fechaCorte }, selectedClient, selectedObra, settings, remisiones, invoices);

            setSaved(true);
        } catch (e) {
            console.error('Error saving invoice:', e);
            setInvoiceError(e.message || 'No se pudo guardar el corte.');
        } finally {
            savingRef.current = false;
            setSaving(false);
        }
    };

    const inputStyle = {
        width: '100%', padding: '0.65rem 0.8rem', boxSizing: 'border-box',
        background: '#ffffff', border: '1px solid #e2e8f0',
        borderRadius: 8, color: '#104166', fontSize: '0.85rem', outline: 'none',
        boxShadow: '0 1px 2px rgba(0,0,0,0.05)', transition: 'border-color 0.2s'
    };
    const selectStyle = { ...inputStyle, cursor: 'pointer' };
    const handleSelectClient = (client) => {
        setClientId(client.id);
        setObraId('');
        setClientSearch(client.name || '');
        setClientDropdownOpen(false);
        setGenerado(false);
        setSaved(false);
    };

    return (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.75)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1200, padding: '1rem' }} onClick={onClose}>
            <div className="corte-modal" style={{
                background: '#f8fafc',
                borderRadius: 24,
                width: '95vw',
                maxWidth: '1600px',
                height: '90vh',
                display: 'flex',
                flexDirection: 'column',
                overflow: 'hidden',
                boxShadow: '0 30px 100px -12px rgba(0,0,0,0.5)',
                position: 'relative'
            }} onClick={e => e.stopPropagation()}>

                {/* Header */}
                <div style={{ background: '#ffffff', padding: '1.25rem 2.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', color: '#104166', borderBottom: '1px solid #e2e8f0', flexShrink: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '1.25rem' }}>
                        <Calculator size={22} style={{ color: '#2365AB' }} />
                        <div>
                            <h2 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 800, letterSpacing: '-0.01em', color: '#1e293b' }}>Corte de Obra - Liquidación de Alquiler</h2>
                        </div>
                    </div>
                    <button onClick={onClose} style={{ background: '#f1f5f9', border: 'none', borderRadius: '50%', width: 36, height: 36, color: '#64748b', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all 0.2s' }} onMouseEnter={e => e.currentTarget.style.background = '#e2e8f0'} onMouseLeave={e => e.currentTarget.style.background = '#f1f5f9'}><X size={20} /></button>
                </div>

                <div className="corte-modal__body" style={{ padding: '2rem 2.5rem', overflowY: 'auto', flex: 1, height: '100%' }}>
                    <div className="corte-modal__grid" style={{ display: 'grid', gridTemplateColumns: '400px 1fr', gap: '2.5rem', alignItems: 'start', height: '100%' }}>
                        {/* ── Sidebar: Config ── */}
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                            <div style={{ background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '16px', padding: '1.25rem', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.05)' }}>
                                <p style={{ fontSize: '0.75rem', fontWeight: 700, color: '#2365AB', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: 6 }}>
                                    <FileText size={16} /> Parámetros
                                </p>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                                    <div>
                                        <label style={{ fontSize: '0.75rem', color: '#64748b', fontWeight: 600, display: 'block', marginBottom: '0.3rem' }}>Cliente</label>
                                        <div style={{ position: 'relative' }}>
                                            <input
                                                type="text"
                                                value={clientSearch}
                                                onChange={e => {
                                                    setClientSearch(e.target.value);
                                                    setClientId('');
                                                    setObraId('');
                                                    setClientDropdownOpen(true);
                                                    setGenerado(false);
                                                    setSaved(false);
                                                }}
                                                onFocus={() => setClientDropdownOpen(true)}
                                                onClick={() => setClientDropdownOpen(true)}
                                                onBlur={() => {
                                                    window.setTimeout(() => setClientDropdownOpen(false), 120);
                                                }}
                                                onKeyDown={e => {
                                                    if (e.key === 'Enter' && filteredClients.length > 0) {
                                                        e.preventDefault();
                                                        handleSelectClient(filteredClients[0]);
                                                    }
                                                }}
                                                placeholder="Buscar o seleccionar cliente"
                                                disabled={!!initialClientId}
                                                autoComplete="off"
                                                style={{
                                                    ...selectStyle,
                                                    paddingRight: '2.4rem',
                                                    cursor: initialClientId ? 'not-allowed' : 'text',
                                                    background: initialClientId ? '#f8fafc' : '#ffffff'
                                                }}
                                            />
                                            {!initialClientId && (
                                                <ChevronDown
                                                    size={16}
                                                    style={{
                                                        position: 'absolute',
                                                        right: '0.85rem',
                                                        top: '50%',
                                                        transform: 'translateY(-50%)',
                                                        color: '#64748b',
                                                        pointerEvents: 'none'
                                                    }}
                                                />
                                            )}
                                            {clientDropdownOpen && !initialClientId && (
                                                <div style={{
                                                    position: 'absolute',
                                                    top: 'calc(100% + 6px)',
                                                    left: 0,
                                                    right: 0,
                                                    zIndex: 20,
                                                    maxHeight: 360,
                                                    overflowY: 'auto',
                                                    background: '#ffffff',
                                                    border: '1px solid #cbd5e1',
                                                    borderRadius: '12px',
                                                    boxShadow: '0 16px 30px rgba(15, 23, 42, 0.12)'
                                                }}>
                                                    {filteredClients.length > 0 ? filteredClients.map(client => (
                                                        <button
                                                            key={client.id}
                                                            type="button"
                                                            onMouseDown={e => e.preventDefault()}
                                                            onClick={() => handleSelectClient(client)}
                                                            style={{
                                                                width: '100%',
                                                                border: 'none',
                                                                background: 'transparent',
                                                                padding: '0.75rem 0.85rem',
                                                                textAlign: 'left',
                                                                cursor: 'pointer',
                                                                borderBottom: '1px solid #f1f5f9',
                                                                color: '#1e293b',
                                                                fontWeight: 700,
                                                                fontSize: '0.9rem'
                                                            }}
                                                        >
                                                            {client.name}
                                                        </button>
                                                    )) : (
                                                        <div style={{ padding: '0.85rem', color: '#94a3b8', fontSize: '0.85rem' }}>
                                                            No hay clientes que coincidan.
                                                        </div>
                                                    )}
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                    {selectedClient && (
                                        <div>
                                            <label style={{ fontSize: '0.75rem', color: '#64748b', fontWeight: 600, display: 'block', marginBottom: '0.3rem' }}>Obra</label>
                                            <select value={obraId} onChange={e => { setObraId(e.target.value); setGenerado(false); setSaved(false); }} style={selectStyle}>
                                                <option value="">— Todas las obras —</option>
                                                {obrasDisp.map(o => <option key={o.id} value={o.id}>{o.nombre}</option>)}
                                            </select>
                                        </div>
                                    )}
                                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                                        <div>
                                            <label style={{ fontSize: '0.75rem', color: '#64748b', fontWeight: 600, display: 'block', marginBottom: '0.3rem' }}>Desde</label>
                                            <input type="date" value={fechaInicio} onChange={e => { setFechaInicio(e.target.value); setGenerado(false); setSaved(false); }} style={inputStyle} />
                                        </div>
                                        <div>
                                            <label style={{ fontSize: '0.75rem', color: '#64748b', fontWeight: 600, display: 'block', marginBottom: '0.3rem' }}>Hasta (Corte)</label>
                                            <input type="date" value={fechaCorte} onChange={e => { setFechaCorte(e.target.value); setGenerado(false); setSaved(false); }} style={inputStyle} />
                                        </div>
                                    </div>
                                    <div>
                                        <label style={{
                                            display: 'flex',
                                            alignItems: 'center',
                                            justifyContent: 'space-between',
                                            padding: '0.6rem 0.8rem',
                                            borderRadius: 8,
                                            background: aplicarFestivos ? '#eff6ff' : '#f8fafc',
                                            border: `1px solid ${aplicarFestivos ? '#3b82f6' : '#e2e8f0'}`,
                                            cursor: 'pointer',
                                            userSelect: 'none',
                                            transition: 'all 0.2s',
                                            boxShadow: '0 1px 2px rgba(0,0,0,0.05)'
                                        }}>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                                                <input
                                                    type="checkbox"
                                                    checked={aplicarFestivos}
                                                    onChange={e => {
                                                        setAplicarFestivos(e.target.checked);
                                                        setCustomFestivos({});
                                                        setGenerado(false);
                                                        setSaved(false);
                                                    }}
                                                    style={{ width: 17, height: 17, cursor: 'pointer', accentColor: '#2563eb', margin: 0 }}
                                                />
                                                <span style={{ fontSize: '0.8rem', fontWeight: 700, color: aplicarFestivos ? '#1e40af' : '#475569' }}>
                                                    Aplicar Días Festivos
                                                </span>
                                            </div>
                                            <span style={{
                                                fontSize: '0.65rem',
                                                fontWeight: 800,
                                                padding: '2px 8px',
                                                borderRadius: '999px',
                                                background: aplicarFestivos ? '#dbeafe' : '#f1f5f9',
                                                color: aplicarFestivos ? '#1d4ed8' : '#64748b'
                                            }}>
                                                {aplicarFestivos ? 'ACTIVADO' : 'EN CERO (0)'}
                                            </span>
                                        </label>
                                    </div>
                                    <div>
                                        <label style={{ fontSize: '0.75rem', color: '#64748b', fontWeight: 600, display: 'block', marginBottom: '0.3rem' }}>Descuento</label>
                                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                                            <select value={descuentoTipo} onChange={e => { setDescuentoTipo(e.target.value); setGenerado(false); setSaved(false); }} style={selectStyle}>
                                                <option value="porcentaje">Porcentaje (%)</option>
                                                <option value="valor">Valor fijo ($)</option>
                                            </select>
                                            <input
                                                type="number"
                                                min="0"
                                                max={descuentoTipo === 'porcentaje' ? 100 : undefined}
                                                step="any"
                                                value={descuentoValor}
                                                onChange={e => { setDescuentoValor(e.target.value); setGenerado(false); setSaved(false); }}
                                                placeholder={descuentoTipo === 'porcentaje' ? 'Ej. 10' : 'Ej. 100000'}
                                                style={inputStyle}
                                            />
                                        </div>
                                    </div>
                                    {abonosDisponibles.length > 0 && (
                                        <div>
                                            <label style={{ fontSize: '0.75rem', color: '#047857', fontWeight: 800, display: 'block', marginBottom: '0.45rem' }}>Abonos disponibles para este corte</label>
                                            <div style={{ border: '1px solid #bbf7d0', borderRadius: 10, background: '#f0fdf4', overflow: 'hidden' }}>
                                                {abonosDisponibles.map(abono => (
                                                    <label key={abono.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '0.65rem 0.75rem', borderBottom: '1px solid #dcfce7', cursor: 'pointer', fontSize: '0.78rem' }}>
                                                        <input type="checkbox" checked={selectedAbonoIds.includes(abono.id)} onChange={e => {
                                                            setSelectedAbonoIds(ids => e.target.checked ? [...ids, abono.id] : ids.filter(id => id !== abono.id));
                                                            setGenerado(false); setSaved(false);
                                                        }}/>
                                                        <span style={{ flex: 1, color: '#166534' }}>{abono.fecha} · {abono.metodoPago}</span>
                                                        <strong style={{ color: '#047857' }}>{fmtCOP(Number(abono.saldo ?? abono.monto) || 0)}</strong>
                                                    </label>
                                                ))}
                                            </div>
                                            <div style={{ fontSize: '0.68rem', color: '#64748b', marginTop: 4 }}>Puedes desmarcar cualquier abono para conservarlo para otro corte.</div>
                                        </div>
                                    )}
                                    <button className="btn btn-primary" style={{ width: '100%', marginTop: '0.5rem', justifyContent: 'center', display: 'flex', alignItems: 'center', gap: '0.5rem' }} disabled={!clientId} onClick={handleGenerate}>
                                        <Calculator size={18} /> Calcular Liquidación
                                    </button>
                                </div>
                            </div>

                            {selectedClient && (
                                <div style={{ background: 'white', border: '1px solid #e2e8f0', borderRadius: '12px', padding: '0.75rem 1rem' }}>
                                    <p style={{ fontSize: '0.6rem', fontWeight: 800, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.5rem' }}>Configuración Impuestos</p>
                                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.75rem' }}>
                                        {[
                                            ['IVA', `${selectedClient.porcIVA || 0}%`],
                                            ['ReteFuente', `${selectedClient.porcRetencion || 0}%`],
                                            ['Responsable', selectedClient.responsableIVA ? 'SÍ' : 'NO'],
                                        ].map(([k, v]) => (
                                            <div key={k} style={{ display: 'flex', alignItems: 'baseline', gap: 4 }}>
                                                <span style={{ fontSize: '0.65rem', color: '#64748b', fontWeight: 600 }}>{k}:</span>
                                                <span style={{ fontSize: '0.75rem', fontWeight: 800, color: '#1e293b' }}>{v}</span>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {generado && resultado && (
                                <div style={{ background: 'white', border: '1px solid #e2e8f0', borderRadius: '12px', padding: '0.75rem 1rem', display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                                    <p style={{ fontSize: '0.6rem', fontWeight: 800, color: '#2365AB', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.25rem' }}>Cálculo de Liquidación</p>
                                    {[
                                        ['Subtotal', fmtCOP(resultado.subtotal), '#1e293b'],
                                        ['Descuento', `-${fmtCOP(resultado.descuento)}`, '#16a34a'],
                                        ['Transporte', fmtCOP(resultado.transporte), '#1e293b'],
                                        ['IVA', fmtCOP(resultado.iva), '#2365AB'],
                                        ['Retención', `-${fmtCOP(resultado.retencion)}`, '#ef4444'],
                                        ['Abonos aplicados', `-${fmtCOP(resultado.pagosPrevios)}`, '#10b981'],
                                        ['Saldo real', fmtCOP(resultado.totalNeto), resultado.totalNeto === 0 ? '#16a34a' : '#1e293b'],
                                    ].map(([k, v, c]) => (
                                        <div key={k} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.25rem 0' }}>
                                            <span style={{ fontSize: '0.7rem', fontWeight: 600, color: '#475569' }}>{k}</span>
                                            <span style={{ fontSize: '0.8rem', fontWeight: 800, color: c }}>{v}</span>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>

                        {/* ── Main Panel: Results ── */}
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', height: '100%' }}>
                            {!generado ? (
                                <div style={{
                                    background: 'white',
                                    border: '2px dashed #e2e8f0',
                                    borderRadius: '24px',
                                    flex: 1,
                                    display: 'flex',
                                    flexDirection: 'column',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    padding: '4rem',
                                    textAlign: 'center',
                                    color: '#94a3b8'
                                }}>
                                    <div style={{ background: '#f8fafc', width: 100, height: 100, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '1.5rem' }}>
                                        <Calculator size={50} style={{ opacity: 0.3 }} />
                                    </div>
                                    <h3 style={{ margin: 0, color: '#475569', fontSize: '1.5rem', fontWeight: 800 }}>Liquidación en Espera</h3>
                                    <p style={{ fontSize: '1rem', maxWidth: '400px', margin: '0.75rem auto 0', lineHeight: 1.5 }}>
                                        Selecciona un cliente, la obra y el rango de fechas en el panel lateral para calcular el corte de obra.
                                    </p>
                                </div>
                            ) : resultado && (
                                <>
                                    {resultado.issues.length > 0 && (
                                        <div role="status" style={{ padding: '1rem 1.25rem', border: '1px solid #fcd34d', borderRadius: 12, background: '#fffbeb', color: '#78350f' }}>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontWeight: 800 }}>
                                                <AlertTriangle size={18} /> Ítems pendientes de revisión
                                            </div>
                                            <p style={{ margin: '0.5rem 0', fontSize: '0.85rem' }}>
                                                Estos ítems no se incluyen en el cobro. Revisa las fechas de devolución y los períodos de sus facturas.
                                            </p>
                                            <ul style={{ margin: 0, paddingLeft: '1.2rem', fontSize: '0.85rem' }}>
                                                {resultado.issues.map((issue, index) => (
                                                    <li key={`${issue.remId}-${issue.itemKey}-${issue.code}-${index}`} style={{ marginTop: 4 }}>
                                                        {issue.remId ? `${issue.remId}: ` : ''}{issue.message}
                                                    </li>
                                                ))}
                                            </ul>
                                        </div>
                                    )}
                                    {resultado.lineas.length === 0 && resultado.issues.length === 0 && (
                                        <div role="status" style={{ padding: '2rem', border: '1px solid #bbf7d0', borderRadius: 16, background: '#f0fdf4', color: '#166534', textAlign: 'center' }}>
                                            No hay alquiler pendiente de facturar en este período.
                                        </div>
                                    )}
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
                                        {(() => {
                                            const grouped = resultado.lineas.reduce((acc, l) => {
                                                if (!acc[l.remId]) acc[l.remId] = [];
                                                acc[l.remId].push(l);
                                                return acc;
                                            }, {});

                                            return Object.entries(grouped).map(([remId, lines]) => {
                                                const isSelected = selectedRemIds.includes(remId);
                                                const remObj = remisiones.find(r => String(r.id) === String(remId));
                                                let displayId = remObj?.cotizacionId;

                                                // Fallback: search via linked invoice if cotizacionId is missing
                                                if (!displayId && remObj?.facturaId) {
                                                    const linkedInv = invoices.find(inv => String(inv.id) === String(remObj.facturaId));
                                                    if (linkedInv?.cotizacionId) displayId = linkedInv.cotizacionId;
                                                }

                                                if (!displayId) displayId = remId;

                                                return (
                                                    <div key={remId} style={{
                                                        background: 'white',
                                                        border: isSelected ? '1px solid #3b82f6' : '1px solid #e2e8f0',
                                                        borderRadius: '20px',
                                                        overflow: 'hidden',
                                                        boxShadow: isSelected ? '0 10px 25px -5px rgba(59, 130, 246, 0.1)' : '0 4px 6px -1px rgba(0, 0, 0, 0.05)',
                                                        opacity: isSelected ? 1 : 0.65,
                                                        transition: 'all 0.3s ease',
                                                        marginBottom: '1.5rem'
                                                    }}>
                                                        <div style={{ background: '#f8fafc', padding: '1rem 1.5rem', borderBottom: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                                                                <Truck size={18} style={{ color: isSelected ? '#2563eb' : '#64748b' }} />
                                                                <span style={{ fontWeight: 800, color: '#104166', fontSize: '1rem' }}>#{displayId}</span>
                                                                <span style={{ fontSize: '0.8rem', color: '#64748b', fontWeight: 500 }}>— Despachada el {lines[0].remFecha}</span>
                                                            </div>
                                                            <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                                                                <div style={{ background: lines[0].estado === 'Cerrada' ? '#f1f5f9' : '#dcfce7', color: lines[0].estado === 'Cerrada' ? '#475569' : '#166534', padding: '4px 12px', borderRadius: '999px', fontSize: '0.7rem', fontWeight: 800, textTransform: 'uppercase' }}>
                                                                    {lines[0].estado}
                                                                </div>
                                                                <label style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', padding: '6px 12px', borderRadius: '10px', background: isSelected ? '#eff6ff' : '#ffffff', border: `1px solid ${isSelected ? '#3b82f6' : '#cbd5e1'}`, cursor: 'pointer', userSelect: 'none', transition: 'all 0.2s' }}>
                                                                    <span style={{ fontSize: '0.7rem', fontWeight: 800, color: isSelected ? '#2563eb' : '#64748b' }}>
                                                                        {isSelected ? 'INCLUIR EN CORTE' : 'EXCLUIR DEL CORTE'}
                                                                    </span>
                                                                    <input
                                                                        type="checkbox"
                                                                        checked={isSelected}
                                                                        onChange={() => setSelectedRemIds(prev => prev.includes(remId) ? prev.filter(id => id !== remId) : [...prev, remId])}
                                                                        style={{ width: 18, height: 18, cursor: 'pointer', margin: 0, accentColor: '#2563eb' }}
                                                                    />
                                                                </label>
                                                            </div>
                                                        </div>

                                                        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.9rem', tableLayout: 'fixed', filter: isSelected ? 'none' : 'grayscale(1) opacity(0.5)' }}>
                                                            <thead>
                                                                <tr style={{ background: '#ffffff', borderBottom: '1px solid #f1f5f9' }}>
                                                                    <th style={{ width: '30%', padding: '0.85rem 1.5rem', textAlign: 'left', color: '#64748b', fontSize: '0.7rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Equipo / Descripción</th>
                                                                    <th style={{ width: '8%', padding: '0.85rem 1.5rem', textAlign: 'center', color: '#64748b', fontSize: '0.7rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Cant.</th>
                                                                    <th style={{ width: '20%', padding: '0.85rem 1.5rem', textAlign: 'center', color: '#64748b', fontSize: '0.7rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.05em' }}>F. Devolución / Corte</th>
                                                                    <th style={{ width: '10%', padding: '0.85rem 1.5rem', textAlign: 'center', color: '#64748b', fontSize: '0.7rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Días / Horas</th>
                                                                    <th style={{ width: '10%', padding: '0.85rem 1.5rem', textAlign: 'center', color: '#64748b', fontSize: '0.7rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Festivos</th>
                                                                    <th style={{ width: '11%', padding: '0.85rem 1.5rem', textAlign: 'left', color: '#64748b', fontSize: '0.7rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Tarifa</th>
                                                                    <th style={{ width: '11%', padding: '0.85rem 1.5rem', textAlign: 'right', color: '#64748b', fontSize: '0.7rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Subtotal</th>
                                                                </tr>
                                                            </thead>
                                                            <tbody>
                                                                {lines.map((l, idx) => (
                                                                    <React.Fragment key={idx}>
                                                                        <tr style={{ borderBottom: (idx === lines.length - 1 && !l.isHora) ? 'none' : '1px solid #f1f5f9' }}>
                                                                            <td style={{ padding: '0.85rem 1.5rem', fontWeight: 600, color: '#1e293b', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                                                                {l.equipo}
                                                                                {l.isHora && (
                                                                                    <span style={{ fontSize: '0.65rem', background: '#fef3c7', color: '#b45309', padding: '1px 6px', borderRadius: 4, fontWeight: 700, marginLeft: 6 }}>
                                                                                        Por Horas
                                                                                    </span>
                                                                                )}
                                                                            </td>
                                                                            <td style={{ padding: '0.85rem 1.5rem', textAlign: 'center' }}>{l.cantidad}</td>
                                                                            <td style={{ padding: '0.4rem 1.5rem', textAlign: 'center' }}>
                                                                                <input
                                                                                    type="date"
                                                                                    value={l.devFecha || ''}
                                                                                    onChange={e => {
                                                                                        const newDate = e.target.value;
                                                                                        setCustomDates(prev => ({ ...prev, [l.dateKey || l.key]: newDate }));
                                                                                    }}
                                                                                    style={{
                                                                                        padding: '0.35rem 0.5rem',
                                                                                        fontSize: '0.8rem',
                                                                                        border: '1px solid #cbd5e1',
                                                                                        borderRadius: '6px',
                                                                                        color: '#1e293b',
                                                                                        width: '100%',
                                                                                        maxWidth: '140px',
                                                                                        boxSizing: 'border-box',
                                                                                        outline: 'none',
                                                                                        background: 'white'
                                                                                    }}
                                                                                />
                                                                            </td>
                                                                            <td style={{ padding: '0.4rem 1.5rem', textAlign: 'center' }}>
                                                                                <input
                                                                                    type="number"
                                                                                    step={l.isHora ? "0.5" : "1"}
                                                                                    min="0"
                                                                                    value={l.diasBase}
                                                                                    onChange={e => {
                                                                                        const val = e.target.value;
                                                                                        const numeric = val === '' ? 0 : parseFloat(val);
                                                                                        const clamped = Math.max(0, isNaN(numeric) ? 0 : numeric);
                                                                                        setCustomDays(prev => ({ ...prev, [l.key]: clamped }));
                                                                                        if (l.isHora && l.horaInicio && clamped > 0) {
                                                                                            const hFin = calcularHoraFin(l.horaInicio, clamped);
                                                                                            if (hFin) setCustomHorasFin(prev => ({ ...prev, [l.key]: hFin }));
                                                                                        }
                                                                                    }}
                                                                                    style={{
                                                                                        padding: '0.35rem 0.5rem',
                                                                                        fontSize: '0.8rem',
                                                                                        border: '1px solid #cbd5e1',
                                                                                        borderRadius: '6px',
                                                                                        color: '#1e293b',
                                                                                        width: '100%',
                                                                                        maxWidth: '75px',
                                                                                        textAlign: 'center',
                                                                                        fontWeight: 'bold',
                                                                                        boxSizing: 'border-box',
                                                                                        outline: 'none',
                                                                                        background: 'white'
                                                                                    }}
                                                                                />
                                                                            </td>
                                                                            <td style={{ padding: '0.4rem 1.5rem', textAlign: 'center' }}>
                                                                                <input
                                                                                    type="number"
                                                                                    min="0"
                                                                                    disabled={l.isHora}
                                                                                    max={l.diasBase}
                                                                                    value={l.festivos}
                                                                                    onChange={e => {
                                                                                        const val = e.target.value;
                                                                                        const numeric = val === '' ? 0 : parseInt(val);
                                                                                        const clamped = Math.min(l.diasBase, Math.max(0, isNaN(numeric) ? 0 : numeric));
                                                                                        setCustomFestivos(prev => ({ ...prev, [l.key]: clamped }));
                                                                                    }}
                                                                                    style={{
                                                                                        padding: '0.35rem 0.5rem',
                                                                                        fontSize: '0.8rem',
                                                                                        border: '1px solid #cbd5e1',
                                                                                        borderRadius: '6px',
                                                                                        color: '#f97316',
                                                                                        width: '100%',
                                                                                        maxWidth: '75px',
                                                                                        textAlign: 'center',
                                                                                        fontWeight: 'bold',
                                                                                        boxSizing: 'border-box',
                                                                                        outline: 'none',
                                                                                        background: l.isHora ? '#f1f5f9' : 'white'
                                                                                    }}
                                                                                />
                                                                            </td>
                                                                            <td style={{ padding: '0.85rem 1.5rem', color: '#64748b' }}>{fmtCOP(l.tarifaDia)}</td>
                                                                            <td style={{ padding: '0.85rem 1.5rem', fontWeight: 800, textAlign: 'right', color: '#1e293b' }}>{fmtCOP(l.subtotal)}</td>
                                                                        </tr>
                                                                        {l.isHora && (
                                                                            <tr key={`${idx}-time`} style={{ borderBottom: '1px solid #f1f5f9', background: '#fcfcfd' }}>
                                                                                <td colSpan={7} style={{ padding: '0.4rem 1.5rem 0.65rem 1.5rem' }}>
                                                                                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', background: '#ffffff', padding: '0.4rem 0.75rem', borderRadius: '8px', border: '1px solid #cbd5e1', width: 'fit-content', flexWrap: 'wrap' }}>
                                                                                        <span style={{ fontSize: '0.72rem', fontWeight: 700, color: '#475569' }}>Hora Alquiler:</span>
                                                                                        <input
                                                                                            type="time"
                                                                                            value={l.horaInicio || ''}
                                                                                            onChange={e => {
                                                                                                const hIni = e.target.value;
                                                                                                if (!hIni || !/^\d{2}:\d{2}$/.test(hIni)) return;
                                                                                                setCustomHorasInicio(prev => ({ ...prev, [l.key]: hIni }));
                                                                                                if (l.horaFin && /^\d{2}:\d{2}$/.test(l.horaFin)) {
                                                                                                    const hrs = calcularHorasAlquiler(hIni, l.horaFin);
                                                                                                    if (hrs > 0) setCustomDays(prev => ({ ...prev, [l.key]: hrs }));
                                                                                                } else if (l.dias > 0) {
                                                                                                    const hFin = calcularHoraFin(hIni, l.dias);
                                                                                                    if (hFin) setCustomHorasFin(prev => ({ ...prev, [l.key]: hFin }));
                                                                                                }
                                                                                            }}
                                                                                            onBlur={e => {
                                                                                                if (!e.target.value) {
                                                                                                    setCustomHorasInicio(prev => {
                                                                                                        const next = { ...prev };
                                                                                                        delete next[l.key];
                                                                                                        return next;
                                                                                                    });
                                                                                                }
                                                                                            }}
                                                                                            style={{ padding: '0.2rem 0.4rem', fontSize: '0.8rem', border: '1px solid #cbd5e1', borderRadius: '4px', outline: 'none' }}
                                                                                        />
                                                                                        <span style={{ fontSize: '0.72rem', fontWeight: 700, color: '#475569' }}>Hora Devolución:</span>
                                                                                        <input
                                                                                            type="time"
                                                                                            value={l.horaFin || ''}
                                                                                            onChange={e => {
                                                                                                const hFin = e.target.value;
                                                                                                if (!hFin || !/^\d{2}:\d{2}$/.test(hFin)) return;
                                                                                                setCustomHorasFin(prev => ({ ...prev, [l.key]: hFin }));
                                                                                                if (l.horaInicio && /^\d{2}:\d{2}$/.test(l.horaInicio)) {
                                                                                                    const hrs = calcularHorasAlquiler(l.horaInicio, hFin);
                                                                                                    if (hrs > 0) setCustomDays(prev => ({ ...prev, [l.key]: hrs }));
                                                                                                }
                                                                                            }}
                                                                                            onBlur={e => {
                                                                                                if (!e.target.value) {
                                                                                                    setCustomHorasFin(prev => {
                                                                                                        const next = { ...prev };
                                                                                                        delete next[l.key];
                                                                                                        return next;
                                                                                                    });
                                                                                                }
                                                                                            }}
                                                                                            style={{ padding: '0.2rem 0.4rem', fontSize: '0.8rem', border: '1px solid #cbd5e1', borderRadius: '4px', outline: 'none' }}
                                                                                        />
                                                                                        {l.dias > 0 && (
                                                                                            <span style={{ fontSize: '0.72rem', fontWeight: 800, color: '#2365AB', background: '#eff6ff', padding: '2px 8px', borderRadius: '12px' }}>
                                                                                                ⏱️ {l.dias} {l.dias === 1 ? 'Hora' : 'Horas'}
                                                                                            </span>
                                                                                        )}
                                                                                    </div>
                                                                                </td>
                                                                            </tr>
                                                                        )}
                                                                    </React.Fragment>
                                                                ))}
                                                            </tbody>
                                                            <tfoot>
                                                                <tr style={{ background: '#f8fafc', borderTop: '1px solid #e2e8f0' }}>
                                                                    <td colSpan="6" style={{ padding: '0.75rem 1.5rem', textAlign: 'right', fontWeight: 700, color: '#64748b', fontSize: '0.8rem' }}>Subtotal Remisión:</td>
                                                                    <td style={{ padding: '0.75rem 1.5rem', textAlign: 'right', fontWeight: 800, color: '#2365AB' }}>
                                                                        {fmtCOP(lines.reduce((s, ln) => s + ln.subtotal, 0))}
                                                                    </td>
                                                                </tr>
                                                            </tfoot>
                                                        </table>
                                                    </div>
                                                );
                                            });
                                        })()}
                                    </div>

                                    {invoiceError && <div role="alert" style={{ color: '#b91c1c', padding: '0.75rem 1rem', background: '#fef2f2', borderRadius: 8 }}>{invoiceError}</div>}
                                    <div style={{ background: '#ffffff', color: '#104166', padding: '1.25rem 2.5rem', borderRadius: 24, display: 'flex', justifyContent: 'space-between', alignItems: 'center', border: '1px solid #e2e8f0', marginTop: 'auto', flexShrink: 0, boxShadow: '0 4px 6px -1px rgba(0,0,0,0.05)' }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '1.5rem' }}>
                                            <span style={{ fontSize: '0.9rem', color: '#64748b', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Gran Total Neto a Facturar:</span>
                                            <span style={{ fontSize: '2.2rem', fontWeight: 900, color: '#104166', letterSpacing: '-0.02em' }}>{fmtCOP(resultado.totalNeto)}</span>
                                        </div>
                                        <div style={{ display: 'flex', gap: '1rem' }}>
                                            <button className="btn" disabled={saved || saving || resultado.selectedLineas.length === 0} onClick={handleSaveInvoice} style={{ background: '#10b981', color: 'white', border: 'none', padding: '0.85rem 2.5rem', borderRadius: 12, fontWeight: 900, fontSize: '1rem', display: 'flex', alignItems: 'center', gap: 10, cursor: saving ? 'wait' : 'pointer', opacity: saved || saving || resultado.selectedLineas.length === 0 ? 0.55 : 1, boxShadow: '0 4px 12px rgba(16, 185, 129, 0.2)' }}>
                                                {saved ? <><CheckCircle size={22} /> Guardado</> : saving ? 'Guardando…' : <><FileText size={22} /> Facturar</>}
                                            </button>
                                        </div>
                                    </div>
                                </>
                            )}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
