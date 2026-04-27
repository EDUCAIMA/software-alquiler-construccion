import React, { useState, useMemo } from 'react';
import {
    Calculator, Clock, TrendingUp, FileText, Download, X,
    Building2, Truck, ChevronRight, CheckCircle, AlertTriangle, Percent
} from 'lucide-react';
import { useAppContext } from '../context/AppContext';
import { differenceInDays, format, eachDayOfInterval, isSunday, isSaturday, addDays } from 'date-fns';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { applyStandardLayout, drawInfoGrid } from './pdfTheme';

// ─── Helpers ──────────────────────────────────────────────────────────────────
const fmtCOP = n => `$${(n || 0).toLocaleString('es-CO')}`;
const calculateBillableDays = (start, end, scheme) => {
    try {
        const days = eachDayOfInterval({ start, end });
        if (scheme === 'Lunes-Sábado') return days.filter(d => !isSunday(d)).length;
        if (scheme === 'Lunes-Viernes') return days.filter(d => !isSunday(d) && !isSaturday(d)).length;
        return days.length; // Calendario
    } catch (e) { return 1; }
};

function generateCortePDF(resultado, client, obra, settings) {
    const doc = new jsPDF();
    const pageW = doc.internal.pageSize.getWidth();
    const margin = 10;

    let y = applyStandardLayout(doc, 'Corte de Obra', settings);

    y = drawInfoGrid(doc, y, client, {
        valTopLeft: format(new Date(), 'yyyy-MM-dd'),
        valTopRight: 'PENDIENTE',
        labelTopLeft: 'Fecha de Corte',
        labelTopRight: 'Estado Corte',
        valMidLeft: obra?.nombre?.substring(0, 20) || 'TODAS LAS OBRAS',
        valMidRight: client?.responsableIVA ? 'RESP. IVA' : 'NO RESP.',
        valBottom: fmtCOP(resultado.totalNeto),
        labelBottom: 'Valor Total Corte:',
        obraDireccion: obra?.ubicacion || client?.direccion
    });

    // Items table
    autoTable(doc, {
        startY: y,
        margin: { left: margin, right: margin },
        head: [['ITE', 'REM.', 'EQUIPO', 'CAN.', 'DÍAS', 'TARIFA/DÍA', 'TOTAL']],
        body: resultado.lineas.map((l, idx) => [
            idx + 1,
            l.remId,
            l.equipo.toUpperCase(),
            l.cantidad,
            l.dias,
            l.tarifaDia.toLocaleString('es-CO'),
            l.subtotal.toLocaleString('es-CO')
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
            1: { cellWidth: 15 },
            2: { halign: 'left', cellWidth: 'auto' },
            3: { cellWidth: 12 },
            4: { cellWidth: 12 },
            5: { halign: 'right', cellWidth: 25 },
            6: { halign: 'right', cellWidth: 30, fontStyle: 'bold' }
        }
    });

    const finalY = doc.lastAutoTable.finalY + 10;
    const totW = 80;
    const totX = pageW - margin - totW;
    const totH = 7;
    let ty = finalY;

    const totals = [
        ['SUBTOTAL ALQUILER', resultado.subtotal.toLocaleString('es-CO')],
        [`IVA (${resultado.porcIVA || 0}%)`, resultado.iva.toLocaleString('es-CO')],
        [`RETENCIÓN (${client?.porcRetencion || 0}%)`, resultado.retencion.toLocaleString('es-CO')],
        ['TRANSPORTE TOTAL', resultado.transporte.toLocaleString('es-CO')]
    ];

    totals.forEach(([label, value]) => {
        doc.setLineWidth(0.1);
        doc.setDrawColor(30, 41, 59);
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
    doc.setFont('helvetica', 'bold');
    doc.text('TOTAL NETO', totX + 2, ty + 6);
    doc.text(`$${resultado.totalNeto.toLocaleString('es-CO')}`, totX + 78, ty + 6, { align: 'right' });

    doc.save(`Corte_${obra?.nombre?.replace(/\s+/g, '_') || 'Todas_las_obras'}_${format(new Date(), 'yyyyMMdd')}.pdf`);
}

// ─── MAIN COMPONENT ───────────────────────────────────────────────────────────
export default function CortesObra() {
    const { clients, remisiones, products, invoices, createInvoice, settings } = useAppContext();

    const [clientId, setClientId] = useState('');
    const [obraId, setObraId] = useState('');
    const [fechaInicio, setFechaInicio] = useState(format(addDays(new Date(), -30), 'yyyy-MM-dd'));
    const [fechaCorte, setFechaCorte] = useState(format(new Date(), 'yyyy-MM-dd'));
    const [generado, setGenerado] = useState(false);
    const [saved, setSaved] = useState(false);

    const selectedClient = clients.find(c => c.id === clientId);
    const obrasDisp = selectedClient?.obras || [];
    const selectedObra = obrasDisp.find(o => o.id === obraId);

    // Compute liquidación from PEPS remisiones within the selected period
    const resultado = useMemo(() => {
        if (!clientId || !fechaInicio || !fechaCorte) return null;

        const parseUTCDate = (str) => {
            if (!str) return null;
            const [y, m, d] = str.split('-').map(Number);
            return new Date(y, m - 1, d);
        };

        const fStart = parseUTCDate(fechaInicio);
        const fEnd = parseUTCDate(fechaCorte);
        
        // Obtenemos remisiones que pudieron tener actividad en el periodo
        const rems = remisiones.filter(r =>
            r.clientId === clientId && 
            (!obraId || r.obraId === obraId) && 
            parseUTCDate(r.fecha) <= fEnd &&
            r.estado !== 'Cancelada'
        );

        const lineas = [];
        let subtotalTotal = 0;
        let totalTransporte = 0;

        rems.forEach(rem => {
            const rDate = parseUTCDate(rem.fecha);
            if (rDate >= fStart && rDate <= fEnd) {
                totalTransporte += rem.transporte || 0;
            }

            rem.items.forEach(item => {
                const prod = products.find(p => p.id === item.productId);
                if (item.cantidad > 0) {
                    const equipStart = rDate; 
                    const scheme = prod?.esquemaCobro || 'Calendario';
                    const tarifa = prod?.value || 0;

                    let totalUnitsDaysInPeriod = 0;
                    let accountedQty = 0;

                    if (item.devoluciones && Array.isArray(item.devoluciones)) {
                        item.devoluciones.forEach(dev => {
                            const dDate = parseUTCDate(dev.fecha);
                            const effectiveStart = equipStart > fStart ? equipStart : fStart;
                            const effectiveEnd = dDate < fEnd ? dDate : fEnd;

                            if (effectiveStart <= effectiveEnd) {
                                const dDays = calculateBillableDays(effectiveStart, effectiveEnd, scheme);
                                totalUnitsDaysInPeriod += dev.cantidad * dDays;
                            }
                            accountedQty += dev.cantidad;
                        });
                    }

                    const orphanReturns = (item.cantidadDevuelta || 0) - accountedQty;
                    if (orphanReturns > 0) {
                        const effectiveStart = equipStart > fStart ? equipStart : fStart;
                        const effectiveEnd = equipStart < fEnd ? equipStart : fEnd; 
                        if (effectiveStart <= effectiveEnd) {
                            const dDays = calculateBillableDays(effectiveStart, effectiveEnd, scheme);
                            totalUnitsDaysInPeriod += orphanReturns * dDays;
                        }
                        accountedQty += orphanReturns;
                    }

                    const remainingQty = item.cantidad - accountedQty;
                    if (remainingQty > 0) {
                        const effectiveStart = equipStart > fStart ? equipStart : fStart;
                        const effectiveEnd = fEnd; 

                        if (effectiveStart <= effectiveEnd) {
                            const dDays = calculateBillableDays(effectiveStart, effectiveEnd, scheme);
                            totalUnitsDaysInPeriod += remainingQty * dDays;
                        }
                    }

                    if (totalUnitsDaysInPeriod > 0) {
                        const sub = totalUnitsDaysInPeriod * tarifa;
                        const weightedDays = (totalUnitsDaysInPeriod / item.cantidad).toFixed(1);

                        subtotalTotal += sub;
                        lineas.push({
                            remId: rem.id,
                            remFecha: rem.fecha,
                            equipo: prod?.name || item.productId,
                            cantidad: item.cantidad,
                            dias: Number(weightedDays),
                            tarifaDia: tarifa,
                            subtotal: sub,
                            estado: rem.estado,
                            esquema: scheme,
                        });
                    }
                }
            });
        });

        const porcIVA = selectedClient?.responsableIVA ? (selectedClient?.porcIVA || 0) : 0;
        const porcRet = selectedClient?.porcRetencion || 0;
        const iva = Math.round(subtotalTotal * porcIVA / 100);
        const retencion = Math.round(subtotalTotal * porcRet / 100);
        
        // --- NUEVA LÓGICA: Restar Abonos y Pagos Previos ---
        const relatedInvoices = invoices.filter(inv => 
            inv.clientId === clientId && 
            (!obraId || inv.obraId === obraId) &&
            inv.status !== 'Cancelada'
        );
        const pagosPrevios = relatedInvoices.reduce((sum, inv) => sum + (inv.paidAmount || 0), 0);
        
        const totalAntesDePagos = subtotalTotal + iva + retencion + totalTransporte;
        const totalNeto = totalAntesDePagos - pagosPrevios;

        return { lineas, subtotal: subtotalTotal, iva, retencion, transporte: totalTransporte, totalAntesDePagos, pagosPrevios, totalNeto, porcIVA, porcRet };
    }, [clientId, obraId, fechaInicio, fechaCorte, remisiones, products, invoices, selectedClient]);

    const handleGenerate = () => { if (resultado) setGenerado(true); };
    const handleSaveInvoice = () => {
        if (!resultado || saved) return;

        const itemsToFacturar = resultado.lineas.map(l => ({ 
            productId: l.equipo, 
            nombre: l.equipo, 
            quantity: l.cantidad, 
            days: l.dias, 
            price: l.tarifaDia 
        }));

        // Si hay pagos previos, agregamos una línea negativa para descontar del total de la factura
        if (resultado.pagosPrevios > 0) {
            itemsToFacturar.push({
                productId: 'DESC-PAGO',
                nombre: 'Deducción por Pagos/Abonos Previos',
                quantity: 1,
                days: 1,
                price: -resultado.pagosPrevios
            });
        }

        createInvoice({
            clientId,
            obraId,
            items: itemsToFacturar,
        });
        setSaved(true);
    };

    const inputStyle = {
        width: '100%', padding: '0.65rem 0.8rem', boxSizing: 'border-box',
        background: '#ffffff', border: '1px solid #e2e8f0',
        borderRadius: 8, color: '#104166', fontSize: '0.85rem', outline: 'none',
        boxShadow: '0 1px 2px rgba(0,0,0,0.05)', transition: 'border-color 0.2s'
    };
    const selectStyle = { ...inputStyle, cursor: 'pointer' };

    return (
        <>
            {/* Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
                <div>
                    <h1 style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', color: '#104166', margin: 0 }}>
                        <div style={{ background: '#eff6ff', padding: '0.5rem', borderRadius: '10px', display: 'flex' }}>
                            <Calculator size={24} style={{ color: '#2365AB' }} />
                        </div>
                        Cortes de Obra
                    </h1>
                    <p style={{ color: '#64748b', fontSize: '0.9rem', marginTop: '0.3rem', marginLeft: '3rem' }}>Liquidación de tiempo real: cruza fechas de remisión vs. fecha de corte</p>
                </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'minmax(320px, 360px) 1fr', gap: '1.5rem', alignItems: 'start' }}>
                {/* ── Panel izquierdo: Configuración ── */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                    <div style={{ background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '16px', padding: '1.5rem', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.05)' }}>
                        <p style={{ fontSize: '0.8rem', fontWeight: 700, color: '#2365AB', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: '1.25rem', display: 'flex', alignItems: 'center', gap: 6 }}>
                            <FileText size={16} /> Parámetros del Corte
                        </p>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.1rem' }}>
                            <div>
                                <label style={{ fontSize: '0.8rem', color: '#263777', fontWeight: 600, display: 'block', marginBottom: '0.4rem' }}>Cliente</label>
                                <select value={clientId} onChange={e => { setClientId(e.target.value); setObraId(''); setGenerado(false); setSaved(false); }}
                                    style={selectStyle}>
                                    <option value="">— Seleccionar cliente —</option>
                                    {clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                                </select>
                            </div>
                            {selectedClient && (
                                <div>
                                    <label style={{ fontSize: '0.8rem', color: '#263777', fontWeight: 600, display: 'block', marginBottom: '0.4rem' }}>Obra</label>
                                    <select value={obraId} onChange={e => { setObraId(e.target.value); setGenerado(false); setSaved(false); }}
                                        style={selectStyle}>
                                        <option value="">— Seleccionar obra —</option>
                                        {obrasDisp.map(o => <option key={o.id} value={o.id}>{o.nombre}</option>)}
                                    </select>
                                </div>
                            )}
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                                <div>
                                    <label style={{ fontSize: '0.8rem', color: '#263777', fontWeight: 600, display: 'block', marginBottom: '0.4rem' }}>Fecha Inicial</label>
                                    <input type="date" value={fechaInicio} onChange={e => { setFechaInicio(e.target.value); setGenerado(false); setSaved(false); }} style={inputStyle} />
                                </div>
                                <div>
                                    <label style={{ fontSize: '0.8rem', color: '#263777', fontWeight: 600, display: 'block', marginBottom: '0.4rem' }}>Fecha de Corte</label>
                                    <input type="date" value={fechaCorte} onChange={e => { setFechaCorte(e.target.value); setGenerado(false); setSaved(false); }} style={inputStyle} />
                                </div>
                            </div>
                            <button className="btn btn-primary" style={{ width: '100%', marginTop: '0.5rem', justifyContent: 'center', display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.75rem' }}
                                disabled={!clientId} onClick={handleGenerate}>
                                <Calculator size={18} /> Calcular Corte
                            </button>
                        </div>
                    </div>

                    {/* Parametrización tributaria del cliente */}
                    {selectedClient && (
                        <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '16px', padding: '1.25rem 1.5rem' }}>
                            <p style={{ fontSize: '0.75rem', fontWeight: 700, color: '#263777', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: 6 }}>
                                <Percent size={14} style={{ color: '#64748b' }} /> Parametrización Tributaria
                            </p>
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                                {[['IVA', `${selectedClient.porcIVA || 0}%`, '#2365AB'], ['Retención', `${selectedClient.porcRetencion || 0}%`, '#ef4444'], ['Régimen', selectedClient.regimen || 'N/A', '#f97316'], ['Resp. IVA', selectedClient.responsableIVA ? 'Sí' : 'No', '#10b981']].map(([k, v, c]) => (
                                    <div key={k} style={{ background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: 10, padding: '0.65rem 0.85rem' }}>
                                        <div style={{ fontSize: '0.7rem', color: '#64748b', fontWeight: 600 }}>{k}</div>
                                        <div style={{ fontWeight: 800, color: c, fontSize: '1rem', marginTop: 3 }}>{v}</div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                </div>

                {/* ── Panel derecho: Resultado ── */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                    {!generado && (
                        <div style={{ background: '#ffffff', border: '2px dashed #e2e8f0', borderRadius: '16px', padding: '4rem 2rem', textAlign: 'center', color: '#94a3b8', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
                            <div style={{ background: '#f1f5f9', padding: '1rem', borderRadius: '50%', marginBottom: '1.5rem' }}>
                                <Calculator size={32} style={{ color: '#cbd5e1' }} />
                            </div>
                            <h3 style={{ fontSize: '1.1rem', color: '#64748b', marginBottom: '0.5rem', fontWeight: 600 }}>Corte no calculado</h3>
                            <p style={{ fontSize: '0.9rem', maxWidth: 350 }}>Selecciona un cliente (y opcionalmente una obra) junto con la fecha de corte, luego haz clic en <strong style={{ color: '#263777' }}>Calcular Corte</strong> para ver la liquidación.</p>
                        </div>
                    )}

                    {generado && resultado && (
                        <>
                            {/* Client header */}
                            <div style={{ background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '16px', padding: '1.5rem', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.05)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                                    <div style={{ background: '#eff6ff', padding: '0.75rem', borderRadius: '12px' }}>
                                        <Building2 size={24} style={{ color: '#2365AB' }} />
                                    </div>
                                    <div>
                                        <div style={{ fontSize: '1.2rem', fontWeight: 800, color: '#104166' }}>{selectedClient?.name}</div>
                                        <div style={{ fontSize: '0.85rem', color: '#64748b', marginTop: 4, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                            <span style={{ fontWeight: 500, color: '#263777' }}>{obraId ? selectedObra?.nombre : 'Todas las obras'}</span>
                                            <span>•</span>
                                            <span>NIT: {selectedClient?.nit || 'N/A'}</span>
                                        </div>
                                    </div>
                                </div>
                                <div style={{ textAlign: 'right', background: '#f8fafc', padding: '0.75rem 1rem', borderRadius: '10px', border: '1px solid #e2e8f0' }}>
                                <div>
                                    <div style={{ fontSize: '0.75rem', color: '#64748b', fontWeight: 600, textTransform: 'uppercase' }}>Periodo de Liquidación</div>
                                    <div style={{ fontWeight: 800, fontSize: '1.05rem', color: '#2365AB', marginTop: 2 }}>{fechaInicio} al {fechaCorte}</div>
                                </div>
                                </div>
                            </div>

                            {/* Lines table */}
                            <div style={{ background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '16px', overflow: 'hidden', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.05)' }}>
                                <div style={{ padding: '1rem 1.5rem', background: '#f8fafc', borderBottom: '1px solid #e2e8f0', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                    <Clock size={16} style={{ color: '#2365AB' }} />
                                    <span style={{ fontWeight: 700, fontSize: '0.85rem', color: '#104166', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                                        Desglose por Remisión
                                    </span>
                                    <span style={{ marginLeft: 'auto', fontSize: '0.8rem', color: '#64748b', fontWeight: 500, background: '#e2e8f0', padding: '0.2rem 0.6rem', borderRadius: '20px' }}>{resultado.lineas.length} líneas</span>
                                </div>
                                <div style={{ overflowX: 'auto' }}>
                                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.875rem' }}>
                                        <thead>
                                            <tr style={{ background: '#ffffff', borderBottom: '2px solid #e2e8f0' }}>
                                                {['Remisión', 'Equipo', 'Estado', 'Cant.', 'Días', 'Tarifa/día', 'Subtotal'].map(h => (
                                                    <th key={h} style={{ padding: '0.85rem 1.5rem', textAlign: h === 'Subtotal' ? 'right' : 'left', color: '#64748b', fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em' }}>{h}</th>
                                                ))}
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {resultado.lineas.map((l, idx) => {
                                                const estadoColors = {
                                                    'Cerrada': { bg: '#d1fae5', text: '#059669' },
                                                    'Parcial': { bg: '#ffedd5', text: '#ea580c' },
                                                    'Activa': { bg: '#dbeafe', text: '#2563eb' }
                                                };
                                                const badge = estadoColors[l.estado] || estadoColors['Activa'];

                                                return (
                                                    <tr key={idx} style={{ borderBottom: '1px solid #f1f5f9', background: idx % 2 === 0 ? '#f8fafc' : '#ffffff' }}>
                                                        <td style={{ padding: '0.85rem 1.5rem', fontFamily: 'monospace', fontWeight: 700, color: '#2365AB', fontSize: '0.85rem' }}>{l.remId}</td>
                                                        <td style={{ padding: '0.85rem 1.5rem', fontWeight: 600, color: '#104166' }}>{l.equipo}</td>
                                                        <td style={{ padding: '0.85rem 1.5rem' }}>
                                                            <span style={{ fontSize: '0.75rem', padding: '0.2rem 0.6rem', borderRadius: '999px', background: badge.bg, color: badge.text, fontWeight: 700 }}>{l.estado}</span>
                                                        </td>
                                                        <td style={{ padding: '0.85rem 1.5rem', fontWeight: 500, color: '#263777' }}>{l.cantidad}</td>
                                                        <td style={{ padding: '0.85rem 1.5rem', fontWeight: 700, color: l.dias > 30 ? '#ef4444' : '#f97316' }}>{l.dias}d</td>
                                                        <td style={{ padding: '0.85rem 1.5rem', color: '#263777' }}>{fmtCOP(l.tarifaDia)}</td>
                                                        <td style={{ padding: '0.85rem 1.5rem', fontWeight: 700, color: '#10b981', textAlign: 'right' }}>{fmtCOP(l.subtotal)}</td>
                                                    </tr>
                                                );
                                            })}
                                            {resultado.lineas.length === 0 && (
                                                <tr><td colSpan={7} style={{ padding: '3rem', textAlign: 'center', color: '#94a3b8' }}>No hay remisiones en este período</td></tr>
                                            )}
                                        </tbody>
                                    </table>
                                </div>
                            </div>

                            {/* Totals & Taxes */}
                            <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) auto', gap: '1.5rem', alignItems: 'stretch' }}>
                                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '1rem' }}>
                                    {[
                                        ['Subtotal Alquiler', fmtCOP(resultado.subtotal), '#104166', null],
                                        [`IVA ${resultado.porcIVA}%`, `+ ${fmtCOP(resultado.iva)}`, '#2365AB', 'rgba(35, 101, 171,0.1)'],
                                        [`Ret. Fuente ${resultado.porcRet}%`, `- ${fmtCOP(resultado.retencion)}`, '#ef4444', 'rgba(239,68,68,0.1)'],
                                        ['Transporte', `+ ${fmtCOP(resultado.transporte)}`, '#f97316', 'rgba(249,115,22,0.1)'],
                                        ['Pagos / Abonos Previos', `- ${fmtCOP(resultado.pagosPrevios)}`, '#1e293b', '#f1f5f9'],
                                    ].map(([k, v, c, bg]) => (
                                        <div key={k} style={{ background: bg || '#f8fafc', border: '1px solid #e2e8f0', padding: '1rem 1.25rem', borderRadius: '12px' }}>
                                            <div style={{ fontSize: '0.75rem', color: '#64748b', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>{k}</div>
                                            <div style={{ fontSize: '1.1rem', fontWeight: 800, color: c, marginTop: 4 }}>{v}</div>
                                        </div>
                                    ))}
                                </div>
                                {/* Total neto */}
                                <div style={{ background: 'linear-gradient(135deg, #2365AB, #104166)', borderRadius: '16px', padding: '1.5rem 2.5rem', textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minWidth: 220, boxShadow: '0 10px 15px -3px rgba(35, 101, 171,0.3)' }}>
                                    <div style={{ fontSize: '0.8rem', color: 'rgba(255,255,255,0.9)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 8 }}>Saldo a Facturar</div>
                                    <div style={{ fontSize: '2rem', fontWeight: 900, color: 'white', letterSpacing: '-0.02em' }}>{fmtCOP(resultado.totalNeto)}</div>
                                </div>
                            </div>

                            {/* Actions */}
                            <div style={{ display: 'flex', gap: '1rem', justifyContent: 'flex-end', marginTop: '0.5rem' }}>
                                <button className="btn btn-secondary" onClick={() => generateCortePDF(resultado, selectedClient, selectedObra, settings)} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.75rem 1.5rem', background: '#ffffff', color: '#263777', border: '1px solid #cbd5e1' }}>
                                    <Download size={18} /> Exportar PDF del Corte
                                </button>
                                <button className="btn btn-primary" disabled={saved || resultado.lineas.length === 0} onClick={handleSaveInvoice}
                                    style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.75rem 2rem', fontSize: '1rem' }}>
                                    {saved ? <><CheckCircle size={18} /> Factura Generada</> : <><FileText size={18} /> Generar Factura</>}
                                </button>
                            </div>

                            {/* Success Alert */}
                            {saved && (
                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', background: '#ecfdf5', border: '1px solid #10b981', borderRadius: '12px', padding: '1rem 1.25rem', marginTop: '0.5rem' }}>
                                    <div style={{ background: '#10b981', color: 'white', borderRadius: '50%', padding: '0.3rem', display: 'flex' }}><CheckCircle size={16} /></div>
                                    <span style={{ fontSize: '0.9rem', color: '#065f46', fontWeight: 600 }}>Factura generada y registrada en el módulo de Facturación con éxito.</span>
                                </div>
                            )}
                        </>
                    )}
                </div>
            </div>
        </>
    );
}
