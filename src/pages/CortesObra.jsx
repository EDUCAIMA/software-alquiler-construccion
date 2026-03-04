import React, { useState, useMemo } from 'react';
import {
    Calculator, Clock, TrendingUp, FileText, Download, X,
    Building2, Truck, ChevronRight, CheckCircle, AlertTriangle, Percent
} from 'lucide-react';
import { useAppContext } from '../context/AppContext';
import { differenceInDays, format } from 'date-fns';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

// ─── Helpers ──────────────────────────────────────────────────────────────────
const fmtCOP = n => `$${(n || 0).toLocaleString('es-CO')}`;

function generateCortePDF(resultado, client, obra, productos) {
    const doc = new jsPDF();
    const pageW = doc.internal.pageSize.getWidth();

    // Header gradient simulation
    doc.setFillColor(59, 130, 246);
    doc.rect(0, 0, pageW, 40, 'F');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(20); doc.setTextColor(255, 255, 255);
    doc.text('CIELO', 14, 18);
    doc.setFontSize(10); doc.setFont('helvetica', 'normal');
    doc.text('Alquiler de Equipos y Herramientas', 14, 26);
    doc.text(`CORTE DE OBRA — ${format(new Date(), 'dd/MM/yyyy')}`, 14, 34);

    // Client info box
    doc.setFillColor(248, 250, 252);
    doc.setDrawColor(226, 232, 240);
    doc.roundedRect(14, 46, pageW - 28, 32, 2, 2, 'FD');
    doc.setTextColor(30, 41, 59);
    doc.setFont('helvetica', 'bold'); doc.setFontSize(11);
    doc.text(client?.name || '—', 20, 57);
    doc.setFont('helvetica', 'normal'); doc.setFontSize(9);
    doc.setTextColor(100, 116, 139);
    doc.text(`NIT: ${client?.nit || 'N/A'}  |  Obra: ${obra?.nombre || 'Todas las obras'}`, 20, 65);
    doc.text(`IVA: ${client?.porcIVA || 0}%  |  Ret. Fuente: ${client?.porcRetencion || 0}%`, 20, 71);

    // Items table
    autoTable(doc, {
        startY: 85,
        head: [['Remisión', 'Equipo', 'Cant.', 'Días', 'Tarifa/día', 'Subtotal']],
        body: resultado.lineas.map(l => [l.remId, l.equipo, l.cantidad, l.dias, fmtCOP(l.tarifaDia), fmtCOP(l.subtotal)]),
        headStyles: { fillColor: [59, 130, 246], textColor: 255, fontStyle: 'bold', fontSize: 9 },
        alternateRowStyles: { fillColor: [248, 250, 252] },
        styles: { fontSize: 9 },
    });

    const y = doc.lastAutoTable.finalY + 10;
    // Totals
    doc.setFillColor(59, 130, 246);
    doc.roundedRect(pageW - 100, y, 86, 50, 3, 3, 'F');
    doc.setTextColor(255, 255, 255); doc.setFont('helvetica', 'normal'); doc.setFontSize(9);
    doc.text('Subtotal:', pageW - 95, y + 10);
    doc.text(fmtCOP(resultado.subtotal), pageW - 20, y + 10, { align: 'right' });
    doc.text(`IVA (${client?.porcIVA || 0}%):`, pageW - 95, y + 20);
    doc.text(fmtCOP(resultado.iva), pageW - 20, y + 20, { align: 'right' });
    doc.text(`Ret. (${client?.porcRetencion || 0}%):`, pageW - 95, y + 30);
    doc.text(`-${fmtCOP(resultado.retencion)}`, pageW - 20, y + 30, { align: 'right' });
    doc.text('Transporte:', pageW - 95, y + 38);
    doc.text(fmtCOP(resultado.transporte), pageW - 20, y + 38, { align: 'right' });
    doc.setFont('helvetica', 'bold'); doc.setFontSize(12);
    doc.text('TOTAL NETO:', pageW - 95, y + 49);
    doc.text(fmtCOP(resultado.totalNeto), pageW - 20, y + 49, { align: 'right' });

    doc.save(`Corte_${obra?.nombre?.replace(/\s+/g, '_') || 'Todas_las_obras'}_${format(new Date(), 'yyyyMMdd')}.pdf`);
}

// ─── MAIN COMPONENT ───────────────────────────────────────────────────────────
export default function CortesObra() {
    const { clients, remisiones, products, createInvoice } = useAppContext();

    const [clientId, setClientId] = useState('');
    const [obraId, setObraId] = useState('');
    const [fechaCorte, setFechaCorte] = useState(format(new Date(), 'yyyy-MM-dd'));
    const [generado, setGenerado] = useState(false);
    const [saved, setSaved] = useState(false);

    const selectedClient = clients.find(c => c.id === clientId);
    const obrasDisp = selectedClient?.obras || [];
    const selectedObra = obrasDisp.find(o => o.id === obraId);

    // Compute liquidación from PEPS remisiones
    const resultado = useMemo(() => {
        if (!clientId || !fechaCorte) return null;

        const fCorte = new Date(fechaCorte);
        const rems = remisiones.filter(r =>
            r.clientId === clientId && (!obraId || r.obraId === obraId) && new Date(r.fecha) <= fCorte
        );

        const lineas = [];
        let subtotal = 0;
        let totalTransporte = 0;

        rems.forEach(rem => {
            totalTransporte += rem.transporte || 0;
            rem.items.forEach(item => {
                const prod = products.find(p => p.id === item.productId);
                if (!item.cantidad || !item.cantidadDevuelta !== undefined) {
                    // For closed items: dias = fechaDevolucion (estimate: we use fCorte for open)
                    const diasRaw = differenceInDays(fCorte, new Date(rem.fecha));
                    const dias = Math.max(1, diasRaw);
                    const tarifa = prod?.value || 0;
                    const sub = item.cantidad * dias * tarifa;
                    subtotal += sub;
                    lineas.push({
                        remId: rem.id,
                        remFecha: rem.fecha,
                        equipo: prod?.name || item.productId,
                        cantidad: item.cantidad,
                        dias,
                        tarifaDia: tarifa,
                        subtotal: sub,
                        estado: rem.estado,
                    });
                }
            });
        });

        const porcIVA = selectedClient?.porcIVA || 0;
        const porcRet = selectedClient?.porcRetencion || 0;
        const iva = Math.round(subtotal * porcIVA / 100);
        const retencion = Math.round(subtotal * porcRet / 100);
        const totalNeto = subtotal + iva - retencion + totalTransporte;

        return { lineas, subtotal, iva, retencion, transporte: totalTransporte, totalNeto, porcIVA, porcRet };
    }, [clientId, obraId, fechaCorte, remisiones, products, selectedClient]);

    const handleGenerate = () => { if (resultado) setGenerado(true); };
    const handleSaveInvoice = () => {
        if (!resultado || saved) return;
        createInvoice({
            clientId,
            obraId,
            items: resultado.lineas.map(l => ({ productId: l.equipo, name: l.equipo, quantity: l.cantidad, days: l.dias, price: l.tarifaDia })),
        });
        setSaved(true);
    };

    const inputStyle = {
        width: '100%', padding: '0.65rem 0.8rem', boxSizing: 'border-box',
        background: '#ffffff', border: '1px solid #e2e8f0',
        borderRadius: 8, color: '#1e293b', fontSize: '0.85rem', outline: 'none',
        boxShadow: '0 1px 2px rgba(0,0,0,0.05)', transition: 'border-color 0.2s'
    };
    const selectStyle = { ...inputStyle, cursor: 'pointer' };

    return (
        <>
            {/* Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
                <div>
                    <h1 style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', color: '#1e293b', margin: 0 }}>
                        <div style={{ background: '#eff6ff', padding: '0.5rem', borderRadius: '10px', display: 'flex' }}>
                            <Calculator size={24} style={{ color: '#3b82f6' }} />
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
                        <p style={{ fontSize: '0.8rem', fontWeight: 700, color: '#3b82f6', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: '1.25rem', display: 'flex', alignItems: 'center', gap: 6 }}>
                            <FileText size={16} /> Parámetros del Corte
                        </p>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.1rem' }}>
                            <div>
                                <label style={{ fontSize: '0.8rem', color: '#475569', fontWeight: 600, display: 'block', marginBottom: '0.4rem' }}>Cliente</label>
                                <select value={clientId} onChange={e => { setClientId(e.target.value); setObraId(''); setGenerado(false); setSaved(false); }}
                                    style={selectStyle}>
                                    <option value="">— Seleccionar cliente —</option>
                                    {clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                                </select>
                            </div>
                            {selectedClient && (
                                <div>
                                    <label style={{ fontSize: '0.8rem', color: '#475569', fontWeight: 600, display: 'block', marginBottom: '0.4rem' }}>Obra</label>
                                    <select value={obraId} onChange={e => { setObraId(e.target.value); setGenerado(false); setSaved(false); }}
                                        style={selectStyle}>
                                        <option value="">— Seleccionar obra —</option>
                                        {obrasDisp.map(o => <option key={o.id} value={o.id}>{o.nombre}</option>)}
                                    </select>
                                </div>
                            )}
                            <div>
                                <label style={{ fontSize: '0.8rem', color: '#475569', fontWeight: 600, display: 'block', marginBottom: '0.4rem' }}>Fecha de Corte</label>
                                <input type="date" value={fechaCorte} onChange={e => { setFechaCorte(e.target.value); setGenerado(false); setSaved(false); }} style={inputStyle} />
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
                            <p style={{ fontSize: '0.75rem', fontWeight: 700, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: 6 }}>
                                <Percent size={14} style={{ color: '#64748b' }} /> Parametrización Tributaria
                            </p>
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                                {[['IVA', `${selectedClient.porcIVA || 0}%`, '#3b82f6'], ['Retención', `${selectedClient.porcRetencion || 0}%`, '#ef4444'], ['Régimen', selectedClient.regimen || 'N/A', '#f97316'], ['Resp. IVA', selectedClient.responsableIVA ? 'Sí' : 'No', '#10b981']].map(([k, v, c]) => (
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
                            <p style={{ fontSize: '0.9rem', maxWidth: 350 }}>Selecciona un cliente (y opcionalmente una obra) junto con la fecha de corte, luego haz clic en <strong style={{ color: '#475569' }}>Calcular Corte</strong> para ver la liquidación.</p>
                        </div>
                    )}

                    {generado && resultado && (
                        <>
                            {/* Client header */}
                            <div style={{ background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '16px', padding: '1.5rem', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.05)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                                    <div style={{ background: '#eff6ff', padding: '0.75rem', borderRadius: '12px' }}>
                                        <Building2 size={24} style={{ color: '#3b82f6' }} />
                                    </div>
                                    <div>
                                        <div style={{ fontSize: '1.2rem', fontWeight: 800, color: '#1e293b' }}>{selectedClient?.name}</div>
                                        <div style={{ fontSize: '0.85rem', color: '#64748b', marginTop: 4, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                            <span style={{ fontWeight: 500, color: '#475569' }}>{obraId ? selectedObra?.nombre : 'Todas las obras'}</span>
                                            <span>•</span>
                                            <span>NIT: {selectedClient?.nit || 'N/A'}</span>
                                        </div>
                                    </div>
                                </div>
                                <div style={{ textAlign: 'right', background: '#f8fafc', padding: '0.75rem 1rem', borderRadius: '10px', border: '1px solid #e2e8f0' }}>
                                    <div style={{ fontSize: '0.75rem', color: '#64748b', fontWeight: 600, textTransform: 'uppercase' }}>Fecha de corte</div>
                                    <div style={{ fontWeight: 800, fontSize: '1.05rem', color: '#3b82f6', marginTop: 2 }}>{fechaCorte}</div>
                                </div>
                            </div>

                            {/* Lines table */}
                            <div style={{ background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '16px', overflow: 'hidden', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.05)' }}>
                                <div style={{ padding: '1rem 1.5rem', background: '#f8fafc', borderBottom: '1px solid #e2e8f0', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                    <Clock size={16} style={{ color: '#3b82f6' }} />
                                    <span style={{ fontWeight: 700, fontSize: '0.85rem', color: '#1e293b', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
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
                                                        <td style={{ padding: '0.85rem 1.5rem', fontFamily: 'monospace', fontWeight: 700, color: '#3b82f6', fontSize: '0.85rem' }}>{l.remId}</td>
                                                        <td style={{ padding: '0.85rem 1.5rem', fontWeight: 600, color: '#1e293b' }}>{l.equipo}</td>
                                                        <td style={{ padding: '0.85rem 1.5rem' }}>
                                                            <span style={{ fontSize: '0.75rem', padding: '0.2rem 0.6rem', borderRadius: '999px', background: badge.bg, color: badge.text, fontWeight: 700 }}>{l.estado}</span>
                                                        </td>
                                                        <td style={{ padding: '0.85rem 1.5rem', fontWeight: 500, color: '#475569' }}>{l.cantidad}</td>
                                                        <td style={{ padding: '0.85rem 1.5rem', fontWeight: 700, color: l.dias > 30 ? '#ef4444' : '#f97316' }}>{l.dias}d</td>
                                                        <td style={{ padding: '0.85rem 1.5rem', color: '#475569' }}>{fmtCOP(l.tarifaDia)}</td>
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
                                        ['Subtotal Alquiler', fmtCOP(resultado.subtotal), '#1e293b', null],
                                        [`IVA ${resultado.porcIVA}%`, `+ ${fmtCOP(resultado.iva)}`, '#3b82f6', 'rgba(59,130,246,0.1)'],
                                        [`Ret. Fuente ${resultado.porcRet}%`, `- ${fmtCOP(resultado.retencion)}`, '#ef4444', 'rgba(239,68,68,0.1)'],
                                        ['Transporte', `+ ${fmtCOP(resultado.transporte)}`, '#f97316', 'rgba(249,115,22,0.1)'],
                                    ].map(([k, v, c, bg]) => (
                                        <div key={k} style={{ background: bg || '#f8fafc', border: '1px solid #e2e8f0', padding: '1rem 1.25rem', borderRadius: '12px' }}>
                                            <div style={{ fontSize: '0.75rem', color: '#64748b', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>{k}</div>
                                            <div style={{ fontSize: '1.1rem', fontWeight: 800, color: c, marginTop: 4 }}>{v}</div>
                                        </div>
                                    ))}
                                </div>
                                {/* Total neto */}
                                <div style={{ background: 'linear-gradient(135deg, #10b981, #059669)', borderRadius: '16px', padding: '1.5rem 2.5rem', textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minWidth: 220, boxShadow: '0 10px 15px -3px rgba(16,185,129,0.3)' }}>
                                    <div style={{ fontSize: '0.8rem', color: 'rgba(255,255,255,0.9)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 8 }}>Total Neto a Cobrar</div>
                                    <div style={{ fontSize: '2rem', fontWeight: 900, color: 'white', letterSpacing: '-0.02em' }}>{fmtCOP(resultado.totalNeto)}</div>
                                </div>
                            </div>

                            {/* Actions */}
                            <div style={{ display: 'flex', gap: '1rem', justifyContent: 'flex-end', marginTop: '0.5rem' }}>
                                <button className="btn btn-secondary" onClick={() => generateCortePDF(resultado, selectedClient, selectedObra, products)} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.75rem 1.5rem', background: '#ffffff', color: '#475569', border: '1px solid #cbd5e1' }}>
                                    <Download size={18} /> Exportar PDF
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
