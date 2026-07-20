import React, { useState } from 'react';
import { 
    X, FileText, DollarSign, Truck, Download, Edit2, CheckCircle, Package, Shield, 
    Activity, RotateCcw, Plus, Printer, Check, CreditCard, Clock, AlertTriangle, Ban,
    Users
} from 'lucide-react';
import { differenceInDays, format } from 'date-fns';
import Swal from 'sweetalert2';
import { 
    fmtCOP, generateCotizacionPDF, generateContratoPDF, generatePagarePDF, 
    generateCartaPDF, generateRemisionPDF, generateCortePDF 
} from './CotizacionesHelpers';
import { ActionSection, ActionBtn, ProcessTimeline, BADGE, REM_ICON } from './CotComponents';
import { useAppContext } from '../context/AppContext';
import EditRemisionModal from './EditRemisionModal';

const ESTADO_CFG = {
    'Borrador':  { bg: '#f1f5f9', color: '#64748b' },
    'Enviada':   { bg: '#e0f2fe', color: '#0369a1' },
    'Aprobada':  { bg: '#dcfce7', color: '#166534' },
    'Facturada': { bg: '#fef9c3', color: '#854d0e' },
    'Anulada':   { bg: '#fee2e2', color: '#991b1b' },
};

const ESTADO_REM_CFG = {
    Activa:    { color: '#2365AB', bg: 'rgba(35,101,171,0.1)' },
    Parcial:   { color: '#f97316', bg: 'rgba(249,115,22,0.1)' },
    Cerrada:   { color: '#10b981', bg: 'rgba(16,185,129,0.1)' },
    Pendiente: { color: '#6366f1', bg: 'rgba(99,102,241,0.1)' },
    Cancelada: { color: '#ef4444', bg: 'rgba(239,68,68,0.1)' },
};

const formatBase64 = (str) => {
    if (!str || typeof str !== 'string') return str;
    if (str.startsWith('data:') || str.startsWith('http')) return str;
    if (str.length > 100) return `data:image/png;base64,${str}`;
    return str;
};

export default function CotDetailPanel({ 
    cot, client, obra, settings, onClose, onUpdateEstado, onOpenApproval, onFacturar, 
    onSendLink, onEditContrato, onEdit, onDelete, invoices = [], remisiones = [],
    onCreateRemision, onFinalizeDispatch, onDevolucion, onTrazabilidad, onPrintRemision, 
    onCorteObra, onCorteAction, onTriggerPay, canCreateRem, linkedRems = [], activeRems = [],
    getClient, getObra, onUpdateCot
}) {
    const { users, editRemision, products = [], clients = [] } = useAppContext();
    const [activeTab, setActiveTab] = useState('cotizacion');
    const [editingRemisionTarget, setEditingRemisionTarget] = useState(null);
    const handleEditMetodoPago = async () => {
        const options = {
            'Crédito 30 días': 'Crédito 30 días',
            'Crédito 15 días': 'Crédito 15 días',
            'Contado': 'Contado',
            'Contra entrega': 'Contra entrega',
            'custom': 'Otro (Especificar...)'
        };

        const { value: nuevoMetodo } = await Swal.fire({
            title: 'Editar Forma de Pago',
            input: 'select',
            inputOptions: options,
            inputPlaceholder: 'Seleccione forma de pago',
            showCancelButton: true,
            confirmButtonColor: '#2365AB',
            cancelButtonColor: '#64748b',
            confirmButtonText: 'Siguiente',
            cancelButtonText: 'Cancelar',
            inputValue: ['Crédito 30 días', 'Crédito 15 días', 'Contado', 'Contra entrega'].includes(cot.metodoPago) ? cot.metodoPago : 'custom'
        });

        if (nuevoMetodo) {
            let finalMetodo = nuevoMetodo;
            if (nuevoMetodo === 'custom') {
                const { value: customMetodo } = await Swal.fire({
                    title: 'Especificar Forma de Pago',
                    input: 'text',
                    inputPlaceholder: 'Ej. Crédito 45 días',
                    showCancelButton: true,
                    confirmButtonColor: '#2365AB',
                    cancelButtonColor: '#64748b',
                    confirmButtonText: 'Guardar',
                    cancelButtonText: 'Cancelar',
                    inputValue: !['Crédito 30 días', 'Crédito 15 días', 'Contado', 'Contra entrega'].includes(cot.metodoPago) ? cot.metodoPago : ''
                });
                if (customMetodo !== undefined) {
                    finalMetodo = customMetodo;
                } else {
                    return; // cancelado
                }
            }
            
            if (finalMetodo.trim() !== '') {
                try {
                    await onUpdateCot(cot.id, { metodoPago: finalMetodo });
                    Swal.fire({
                        title: '¡Actualizado!',
                        text: 'La forma de pago ha sido actualizada con éxito.',
                        icon: 'success',
                        confirmButtonColor: '#2365AB'
                    });
                } catch (e) {
                    Swal.fire({
                        title: 'Error',
                        text: e.message,
                        icon: 'error',
                        confirmButtonColor: '#ef4444'
                    });
                }
            }
        }
    };

    const cfg = ESTADO_CFG[cot.estado] || ESTADO_CFG['Borrador'];
    const subtotal = cot.items.reduce((s, i) => {
        const isServ = (i.tipoCobro || '').toLowerCase().includes('servicio') || (i.category || '').toLowerCase().includes('servicio') || (i.esquemaCobro || '').toLowerCase().includes('única');
        return s + (i.cantidad * (isServ ? 1 : i.dias) * i.tarifaDia);
    }, 0);
    const iva = client?.responsableIVA ? Math.round(subtotal * (client?.porcIVA || 0) / 100) : 0;
    const ret = Math.round(subtotal * (client?.porcRetencion || 0) / 100);
    const totalVal = cot.type === 'inv' ? cot.amount : (subtotal + iva + ret + (cot.transporte || 0));
    const relatedInvoice = invoices.find(inv => inv.id === cot.id || inv.id === cot.facturaId || inv.cotizacionId === cot.id) || (cot.type === 'inv' ? cot : null);
    
    // --- Lógica de Liquidación Dinámica por Ítem ---
    let extraCost = 0;
    const dynamicItems = [];

    (cot.items || []).forEach(cotItem => {
        const tarifaDia = Number(cotItem.tarifaDia) || 0;
        const diasCotizados = Number(cotItem.dias) || 0;
        const nombre = cotItem.nombre || cotItem.name || 'Equipo';
        let despachadoTotal = 0;
        let devolucionesProcesadas = [];
        let enCampoTotal = 0;
        let extraAcumuladoItem = 0;

        linkedRems.forEach(rem => {
            if (rem.estado === 'Pendiente' || rem.estado === 'Cancelada') return;
            
            const remItem = (rem.items || []).find(i => i.productId === cotItem.productId);
            if (remItem) {
                const despachado = Number(remItem.cantidad) || 0;
                despachadoTotal += despachado;
                const fechaSalida = new Date(rem.fecha);

                const devoluciones = remItem.devoluciones || [];
                let cantidadDevueltaEnDespacho = 0;

                devoluciones.forEach(dev => {
                    const cantDev = Number(dev.cantidad) || 0;
                    cantidadDevueltaEnDespacho += cantDev;
                    const fechaDev = new Date(dev.fecha);
                    const diasReales = Math.max(0, differenceInDays(fechaDev, fechaSalida));
                    
                    const diasExtra = Math.max(0, diasReales - diasCotizados);
                    if (diasExtra > 0) {
                        const costo = diasExtra * cantDev * tarifaDia;
                        extraAcumuladoItem += costo;
                    }
                    
                    devolucionesProcesadas.push({
                        cantidad: cantDev,
                        fechaSalida: rem.fecha,
                        fechaDevolucion: dev.fecha,
                        diasReales,
                        diasExtra,
                        costoExtra: diasExtra * cantDev * tarifaDia,
                        activo: false
                    });
                });

                const pendiente = despachado - cantidadDevueltaEnDespacho;
                if (pendiente > 0) {
                    enCampoTotal += pendiente;
                    const diasReales = Math.max(0, differenceInDays(new Date(), fechaSalida));
                    const diasExtra = Math.max(0, diasReales - diasCotizados);
                    if (diasExtra > 0) {
                        const costo = diasExtra * pendiente * tarifaDia;
                        extraAcumuladoItem += costo;
                    }
                    
                    devolucionesProcesadas.push({
                        cantidad: pendiente,
                        fechaSalida: rem.fecha,
                        fechaDevolucion: 'En Obra',
                        diasReales,
                        diasExtra,
                        costoExtra: diasExtra * pendiente * tarifaDia,
                        activo: true
                    });
                }
            }
        });

        extraCost += extraAcumuladoItem;

        dynamicItems.push({
            productId: cotItem.productId,
            nombre,
            tarifaDia,
            diasCotizados,
            cantidadCotizada: cotItem.cantidad,
            costoBase: cotItem.cantidad * diasCotizados * tarifaDia,
            despachadoTotal,
            enCampoTotal,
            devoluciones: devolucionesProcesadas,
            extraAcumuladoItem
        });
    });

    const isPaid = relatedInvoice?.status === 'Paid';
    const totalEquiposActivos = activeRems.reduce((s, r) => s + (r.items || []).reduce((ss, i) => ss + ((Number(i.cantidad) || 0) - (Number(i.cantidadDevuelta) || 0)), 0), 0);
    const oldestRemDate = activeRems.length > 0 ? new Date(Math.min(...activeRems.map(r => new Date(r.fecha)))) : null;
    const diasActivos = oldestRemDate ? Math.max(0, differenceInDays(new Date(), oldestRemDate)) : null;

    const TABS = [
        { id: 'cotizacion',   label: 'Cotización',   Icon: FileText,   badge: null },
        { id: 'movimientos',  label: 'Remisión',     Icon: Truck,      badge: totalEquiposActivos > 0 ? String(totalEquiposActivos) : null },
        { id: 'facturacion',  label: 'Facturación',  Icon: DollarSign, badge: (!isPaid && relatedInvoice) ? '!' : relatedInvoice ? '✓' : null },
    ];

    return (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(15, 23, 42, 0.75)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '1rem' }} onClick={onClose}>
            <div style={{ background: 'white', borderRadius: 20, width: '100%', maxWidth: 850, height: '90vh', display: 'flex', flexDirection: 'column', overflow: 'hidden', boxShadow: '0 30px 100px -12px rgba(0,0,0,0.45)', border: '1px solid rgba(0,0,0,0.1)' }} onClick={e => e.stopPropagation()}>

                {/* ── Header ── */}
                <div style={{ 
                    background: 'linear-gradient(135deg, #1e293b 0%, #0f172a 100%)', 
                    padding: '1.5rem 2rem', 
                    flexShrink: 0,
                    borderBottom: '1px solid rgba(255,255,255,0.1)',
                }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <div>
                            <div style={{ fontSize: '0.85rem', color: '#ffffff', fontWeight: 800, letterSpacing: '0.05em', textTransform: 'uppercase', opacity: 0.9 }}>
                                Detalle de Operación
                            </div>
                        </div>

                        <div style={{ display: 'flex', gap: '1.5rem', alignItems: 'center', flex: 1, justifyContent: 'flex-end' }}>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.3rem', textAlign: 'right' }}>
                                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '0.6rem' }}>
                                    <span style={{ fontSize: '0.85rem', color: '#ffffff', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.05em', whiteSpace: 'nowrap' }}>CLIENTE:</span>
                                    <span style={{ fontSize: '1rem', color: '#ffffff', fontWeight: 400, lineHeight: 1.2 }}>{client?.name}</span>
                                </div>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', justifyContent: 'flex-end' }}>
                                    <span style={{ fontSize: '0.85rem', color: '#ffffff', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.05em', whiteSpace: 'nowrap' }}>OBRA:</span>
                                    <span style={{ fontSize: '1rem', color: '#ffffff', fontWeight: 400, lineHeight: 1.2 }}>{obra?.nombre || cot.obraId}</span>
                                </div>
                            </div>
                            
                            <button onClick={onClose} style={{ 
                                marginLeft: '1rem',
                                background: 'rgba(255,255,255,0.05)', 
                                border: '1px solid rgba(255,255,255,0.1)', 
                                borderRadius: '8px', 
                                color: 'white', 
                                cursor: 'pointer', 
                                width: 32, 
                                height: 32, 
                                display: 'flex', 
                                alignItems: 'center', 
                                justifyContent: 'center',
                                transition: 'all 0.2s'
                            }}
                            onMouseEnter={e => e.currentTarget.style.background = 'rgba(239, 68, 68, 0.2)'}
                            onMouseLeave={e => e.currentTarget.style.background = 'rgba(255,255,255,0.05)'}
                            >
                                <X size={18} />
                            </button>
                        </div>
                    </div>
                </div>

                {/* ── Tabs ── */}
                <div style={{ display: 'flex', background: '#f1f5f9', flexShrink: 0, overflowX: 'auto', padding: '0.35rem 0.35rem 0', gap: '0.15rem' }}>
                    {TABS.map(({ id, label, Icon, badge }) => (
                        <button key={id} onClick={() => setActiveTab(id)}
                            style={{ 
                                flex: 1, 
                                minWidth: 110, 
                                padding: '0.85rem 0.5rem', 
                                border: 'none', 
                                cursor: 'pointer', 
                                display: 'flex', 
                                flexDirection: 'column', 
                                alignItems: 'center', 
                                gap: 4, 
                                background: activeTab === id ? '#ffffff' : 'transparent',
                                borderTopLeftRadius: 10,
                                borderTopRightRadius: 10,
                                color: activeTab === id ? '#2365AB' : '#64748b', 
                                fontWeight: activeTab === id ? 800 : 600, 
                                transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)', 
                                position: 'relative',
                                boxShadow: activeTab === id ? '0 -2px 10px rgba(0,0,0,0.05)' : 'none',
                                zIndex: activeTab === id ? 1 : 0
                            }}>
                            <Icon size={16} style={{ color: activeTab === id ? '#2365AB' : '#94a3b8' }} />
                            <span style={{ fontSize: '0.6rem', textTransform: 'uppercase', letterSpacing: '0.06em', whiteSpace: 'nowrap' }}>{label}</span>
                            {badge && (
                                <span style={{ 
                                    position: 'absolute', 
                                    top: 6, 
                                    right: 10, 
                                    background: badge === '!' ? '#ef4444' : badge === '✓' ? '#10b981' : '#2365AB', 
                                    color: 'white', 
                                    borderRadius: 999, 
                                    fontSize: '0.55rem', 
                                    fontWeight: 900, 
                                    padding: '1px 5px', 
                                    minWidth: 15, 
                                    textAlign: 'center',
                                    border: '2px solid ' + (activeTab === id ? '#ffffff' : '#f1f5f9'),
                                    boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
                                }}>{badge}</span>
                            )}
                        </button>
                    ))}
                </div>


                {/* ── Tab Content ── */}
                <div style={{ flex: 1, overflowY: 'auto', background: '#f8fafc' }}>

                    {/* ═══ TAB: COTIZACIÓN ═══ */}
                    {activeTab === 'cotizacion' && (
                        <div style={{ padding: '1rem', display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
                            <ProcessTimeline cot={cot} hasInvoice={!!relatedInvoice} hasRems={linkedRems.length > 0} />

                            <ActionSection title="Acciones Rápidas" icon={Activity} color="#2365AB">
                                <ActionBtn onClick={() => generateCotizacionPDF(cot, client, obra, settings)} icon={Download} label="PDF Cotización" variant="primary" />
                                {(cot.estado === 'Borrador' || cot.estado === 'Enviada') && <>
                                    <ActionBtn onClick={onEdit} icon={Edit2} label="Editar Cotización" />
                                    <ActionBtn onClick={onOpenApproval} icon={CheckCircle} label="Aprobar + Generar Documentos" variant="green" />
                                </>}
                                {(cot.estado === 'Aprobada' || cot.estado === 'Facturada' || cot.estado === 'Enviada') && <>
                                    <ActionBtn onClick={() => generateContratoPDF(cot, client, obra, settings)} icon={Download} label="Contrato de Alquiler" variant="outline_blue" />
                                    <ActionBtn onClick={() => generatePagarePDF(cot, client, settings)} icon={Download} label="Pagaré" variant="outline_blue" />
                                    <ActionBtn onClick={() => generateCartaPDF(cot, client, settings)} icon={Download} label="Carta de Instrucciones" variant="outline_blue" />
                                </>}
                                {!cot.facturaId && (
                                    <ActionBtn onClick={() => {
                                        Swal.fire({ title: '¿Archivar cotización?', text: `Se archivará permanentemente ${cot.id}.`, icon: 'warning', showCancelButton: true, confirmButtonColor: '#ef4444', cancelButtonColor: '#64748b', confirmButtonText: 'Sí, archivar', cancelButtonText: 'Cancelar' })
                                        .then(r => { if (r.isConfirmed) onDelete(cot.id); });
                                    }} icon={Package} label="Archivar Cotización" variant="outline_red" />
                                )}
                                {canCreateRem && (
                                    <ActionBtn onClick={onCreateRemision} icon={Plus} label="Nuevo Despacho (Remisión)" variant="indigo" />
                                )}
                            </ActionSection>

                            <div style={{ background: 'white', border: '1px solid #e2e8f0', borderRadius: 12, overflow: 'hidden', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.05)' }}>
                                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.78rem' }}>
                                    <thead style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0' }}>
                                        <tr>
                                            <th style={{ padding: '0.65rem 0.85rem', textAlign: 'left', color: '#1e293b', fontWeight: 800, textTransform: 'uppercase', fontSize: '0.7rem', letterSpacing: '0.05em' }}>PRODUCTO / EQUIPO</th>
                                            <th style={{ padding: '0.65rem 0.5rem', textAlign: 'center', color: '#1e293b', fontWeight: 800, textTransform: 'uppercase', fontSize: '0.7rem', letterSpacing: '0.05em' }}>CANTIDAD</th>
                                            <th style={{ padding: '0.65rem 0.85rem', textAlign: 'right', color: '#1e293b', fontWeight: 800, textTransform: 'uppercase', fontSize: '0.7rem', letterSpacing: '0.05em' }}>VALOR TOTAL</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {cot.items.map((item, idx) => {
                                            const isServ = (item.tipoCobro || '').toLowerCase().includes('servicio') || (item.category || '').toLowerCase().includes('servicio') || (item.esquemaCobro || '').toLowerCase().includes('única');
                                            const lineTot = item.cantidad * (isServ ? 1 : item.dias) * item.tarifaDia;
                                            return (
                                                <tr key={idx} style={{ 
                                                    borderBottom: '1px solid #f1f5f9',
                                                    background: idx % 2 !== 0 ? '#fcfdfe' : 'transparent'
                                                }}>
                                                    <td style={{ padding: '0.7rem 0.85rem', fontWeight: 600, color: '#1e293b', fontSize: '0.8rem' }}>{item.nombre}</td>
                                                    <td style={{ padding: '0.7rem 0.5rem', textAlign: 'center', color: '#1e293b', fontSize: '0.8rem', whiteSpace: 'nowrap', fontWeight: 600 }}>
                                                        {item.cantidad} u × {isServ ? 'Cobro Único' : `${item.dias}d`}
                                                    </td>
                                                    <td style={{ padding: '0.7rem 0.85rem', fontWeight: 600, color: '#1e293b', textAlign: 'right', fontSize: '0.8rem' }}>
                                                        {fmtCOP(lineTot)}
                                                    </td>
                                                </tr>
                                            );
                                        })}
                                    </tbody>
                                </table>
                                <div style={{ padding: '1rem 0.85rem', display: 'flex', flexDirection: 'column', alignItems: 'flex-end', borderTop: '1px solid #f1f5f9' }}>
                                    <div style={{ width: '250px', display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                                        {[
                                            ['Subtotal', fmtCOP(subtotal)],
                                            ['IVA', fmtCOP(iva)],
                                            ['Retención', fmtCOP(ret)],
                                            ['Transporte', fmtCOP(cot.transporte || 0)]
                                        ].map(([label, value]) => (
                                            <div key={label} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', color: '#1e293b' }}>
                                                <span style={{ fontWeight: 600 }}>{label}</span>
                                                <span style={{ fontWeight: 600 }}>{value}</span>
                                            </div>
                                        ))}
                                        <div style={{ borderTop: '2px solid #1e293b', marginTop: '0.5rem', paddingTop: '0.5rem', display: 'flex', justifyContent: 'space-between' }}>
                                            <span style={{ fontWeight: 800, color: '#1e293b', fontSize: '0.9rem' }}>TOTAL</span>
                                            <span style={{ fontWeight: 800, color: '#1e293b', fontSize: '1.1rem' }}>{fmtCOP(totalVal)}</span>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            <div style={{ background: 'white', border: '1px solid #e2e8f0', borderRadius: 12, padding: '0.75rem 0.85rem', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.05)' }}>
                                {/* Método Pago */}
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.78rem', padding: '0.25rem 0', borderBottom: '1px solid #f1f5f9' }}>
                                    <span style={{ color: '#64748b' }}>Método Pago</span>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                                        <span style={{ fontWeight: 600, color: '#104166' }}>{cot.metodoPago || '—'}</span>
                                        {onUpdateCot && (
                                            <button 
                                                onClick={handleEditMetodoPago}
                                                style={{ 
                                                    background: 'none', 
                                                    border: 'none', 
                                                    cursor: 'pointer', 
                                                    color: '#2365AB', 
                                                    padding: '2px', 
                                                    display: 'flex', 
                                                    alignItems: 'center',
                                                    borderRadius: '4px',
                                                    transition: 'all 0.2s'
                                                }}
                                                onMouseEnter={e => e.currentTarget.style.backgroundColor = '#f1f5f9'}
                                                onMouseLeave={e => e.currentTarget.style.backgroundColor = 'transparent'}
                                                title="Editar forma de pago"
                                            >
                                                <Edit2 size={12} />
                                            </button>
                                        )}
                                    </div>
                                </div>

                                {/* Resp. Transporte */}
                                {cot.responsableTransporte && (
                                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.78rem', padding: '0.25rem 0', borderBottom: cot.plazoEntrega ? '1px solid #f1f5f9' : 'none' }}>
                                        <span style={{ color: '#64748b' }}>Resp. Transporte</span>
                                        <span style={{ fontWeight: 600, color: '#104166' }}>{cot.responsableTransporte}</span>
                                    </div>
                                )}

                                {/* Plazo Entrega */}
                                {cot.plazoEntrega && (
                                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.78rem', padding: '0.25rem 0' }}>
                                        <span style={{ color: '#64748b' }}>Plazo Entrega</span>
                                        <span style={{ fontWeight: 600, color: '#104166' }}>{cot.plazoEntrega}</span>
                                    </div>
                                )}
                            </div>

                            {cot.notas && <div style={{ fontSize: '0.78rem', color: '#64748b', background: 'white', border: '1px solid #e2e8f0', borderRadius: 8, padding: '0.65rem 0.85rem' }}>{cot.notas}</div>}

                            {(cot.firma || cot.signature || cot.foto || cot.photo || cot.fotoCC || cot.ccPhoto) && (
                                <div style={{ background: 'white', border: '1px solid #e2e8f0', borderRadius: 12, padding: '0.85rem', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.05)' }}>
                                    <div style={{ fontSize: '0.65rem', fontWeight: 800, color: '#0f172a', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: 6 }}>
                                        <Shield size={13} /> IDENTIFICACIÓN DEL FIRMANTE
                                    </div>
                                    
                                    <div style={{ display: 'flex', gap: '1rem', marginBottom: (cot.fotoCC || cot.ccPhoto) ? '1rem' : 0, alignItems: 'flex-end' }}>
                                        {(cot.foto || cot.photo) && (
                                            <div style={{ flex: 1 }}>
                                                <div style={{ fontSize: '0.55rem', color: '#64748b', fontWeight: 700, textAlign: 'center', marginBottom: 4 }}>ROSTRO</div>
                                                <img src={formatBase64(cot.foto || cot.photo)} alt="Rostro" style={{ width: '100%', borderRadius: 8, border: '1px solid #e2e8f0', aspectRatio: '1/1', objectFit: 'cover' }} />
                                            </div>
                                        )}
                                        {(cot.firma || cot.signature) && (
                                            <div style={{ flex: 1.5, textAlign: 'center' }}>
                                                <div style={{ fontSize: '0.55rem', color: '#64748b', fontWeight: 700, marginBottom: 4 }}>FIRMA DIGITAL</div>
                                                <div style={{ minHeight: 80, display: 'flex', alignItems: 'center', justifyContent: 'center', border: '1px dashed #e2e8f0', borderRadius: 8, padding: 8 }}>
                                                    <img src={formatBase64(cot.firma || cot.signature)} alt="Firma" style={{ maxHeight: 80, maxWidth: '100%', objectFit: 'contain' }} />
                                                </div>
                                            </div>
                                        )}
                                    </div>

                                    {(cot.fotoCC || cot.ccPhoto || cot.fotoCCBack || cot.ccPhotoBack) && (
                                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem', borderTop: '1px solid #f1f5f9', paddingTop: '1rem' }}>
                                            {[
                                                ['CC FRONTAL', cot.fotoCC || cot.ccPhoto], 
                                                ['CC REVERSO', cot.fotoCCBack || cot.ccPhotoBack]
                                            ].map(([lbl, src]) => src ? (
                                                <div key={lbl}>
                                                    <div style={{ fontSize: '0.55rem', color: '#64748b', fontWeight: 700, textAlign: 'center', marginBottom: 3 }}>{lbl}</div>
                                                    <img src={formatBase64(src)} alt={lbl} style={{ width: '100%', borderRadius: 6, border: '1px solid #e2e8f0', aspectRatio: '16/9', objectFit: 'cover' }} />
                                                </div>
                                            ) : null)}
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
                    )}

                            {/* ═══ TAB: REMISIÓN (Movimientos) ═══ */}
                    {activeTab === 'movimientos' && (
                        <div style={{ padding: '1.25rem', display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                            {totalEquiposActivos > 0 ? (
                                <div style={{ background: 'linear-gradient(135deg, #1e293b, #0f172a)', borderRadius: 16, padding: '1.5rem', color: 'white', boxShadow: '0 10px 25px -5px rgba(0,0,0,0.2)' }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                                        <div>
                                            <div style={{ fontSize: '0.75rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.1em', opacity: 0.7, marginBottom: 6 }}>Equipos en Campo</div>
                                            <div style={{ fontSize: '2.8rem', fontWeight: 900, display: 'flex', alignItems: 'baseline', gap: 10 }}>
                                                {totalEquiposActivos} 
                                                <span style={{ fontSize: '1.1rem', fontWeight: 500, opacity: 0.8 }}>unidades</span>
                                            </div>
                                        </div>
                                        <div style={{ background: 'rgba(255,255,255,0.1)', padding: '1rem', borderRadius: 16 }}>
                                            <Truck size={32} color="#3b82f6" />
                                        </div>
                                    </div>
                                    <div style={{ marginTop: '1.5rem', paddingTop: '1.5rem', borderTop: '1px solid rgba(255,255,255,0.1)', display: 'flex', gap: '3rem' }}>
                                        <div>
                                            <div style={{ fontSize: '0.7rem', opacity: 0.6, textTransform: 'uppercase', fontWeight: 800 }}>Despachos Activos</div>
                                            <div style={{ fontSize: '1.25rem', fontWeight: 700, marginTop: 4 }}>{activeRems.length} remisiones</div>
                                        </div>
                                        {diasActivos !== null && (
                                            <div>
                                                <div style={{ fontSize: '0.7rem', opacity: 0.6, textTransform: 'uppercase', fontWeight: 800 }}>Tiempo en Obra</div>
                                                <div style={{ fontSize: '1.25rem', fontWeight: 700, marginTop: 4 }}>{diasActivos} días <span style={{ fontSize: '0.8rem', fontWeight: 400, opacity: 0.7 }}>(PEPS)</span></div>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            ) : (
                                <div style={{ background: '#f8fafc', border: '2px dashed #e2e8f0', borderRadius: 16, padding: '3rem 2rem', textAlign: 'center' }}>
                                    <RotateCcw size={48} style={{ color: '#cbd5e1', marginBottom: '1rem' }} />
                                    <div style={{ fontWeight: 800, color: '#64748b' }}>Sin equipos pendientes</div>
                                </div>
                            )}

                            {canCreateRem && (
                                <div style={{ marginTop: '0.5rem' }}>
                                    <ActionBtn onClick={onCreateRemision} icon={Plus} label="Nuevo Despacho" variant="indigo" style={{ height: '48px', borderRadius: 12 }} />
                                </div>
                            )}

                            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                    <h4 style={{ margin: 0, fontSize: '0.85rem', fontWeight: 800, color: '#1e293b', textTransform: 'uppercase' }}>Cronología de Movimientos</h4>
                                </div>
                                
                                {linkedRems.map(rem => {
                                    const remCfg = ESTADO_REM_CFG[rem.estado] || ESTADO_REM_CFG.Activa;
                                    return (
                                        <div key={rem.id} style={{ background: 'white', border: '1px solid #e2e8f0', borderRadius: 16, overflow: 'hidden', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.05)' }}>
                                            <div style={{ padding: '1rem 1.25rem', background: '#f8fafc', borderBottom: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                                                    <div style={{ width: 40, height: 40, borderRadius: 12, background: remCfg.bg, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                                        <Truck size={20} style={{ color: remCfg.color }} />
                                                    </div>
                                                    <div>
                                                        <div style={{ fontWeight: 900, color: '#1e293b', fontSize: '0.95rem', fontFamily: 'monospace' }}>{rem.id}</div>
                                                        <div style={{ fontSize: '0.72rem', color: '#64748b' }}>Despachado el {rem.fecha}</div>
                                                    </div>
                                                </div>
                                                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                                                    <span style={{ fontSize: '0.68rem', fontWeight: 900, color: remCfg.color, background: remCfg.bg, padding: '4px 10px', borderRadius: 8 }}>{rem.estado}</span>
                                                    <button onClick={() => setEditingRemisionTarget(rem)} title="Editar Remisión" style={{ background: 'white', border: '1px solid #cbd5e1', borderRadius: 10, padding: '6px', cursor: 'pointer' }}><Edit2 size={16} /></button>
                                                    <button onClick={() => onPrintRemision(rem)} style={{ background: 'white', border: '1px solid #cbd5e1', borderRadius: 10, padding: '6px', cursor: 'pointer' }}><Printer size={16} /></button>
                                                </div>
                                            </div>

                                            {/* Asignación de Operario */}
                                            <div style={{ padding: '0.65rem 1.25rem', background: '#fff', borderBottom: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10 }}>
                                                <span style={{ fontSize: '0.75rem', fontWeight: 700, color: '#475569', display: 'flex', alignItems: 'center', gap: 6 }}>
                                                    <Users size={14} color="#64748b" /> Operario Asignado:
                                                </span>
                                                <select
                                                    value={rem.assignedOperarioId || ''}
                                                    onChange={async (e) => {
                                                        const val = e.target.value;
                                                        try {
                                                            await editRemision(rem.id, { assignedOperarioId: val || null });
                                                            Swal.fire({
                                                                title: 'Asignación Actualizada',
                                                                text: 'El operario asignado a la remisión ha sido actualizado.',
                                                                icon: 'success',
                                                                toast: true,
                                                                position: 'top-end',
                                                                showConfirmButton: false,
                                                                timer: 2000
                                                            });
                                                        } catch (err) {
                                                            Swal.fire('Error', 'No se pudo actualizar la asignación', 'error');
                                                        }
                                                    }}
                                                    style={{
                                                        padding: '4px 10px',
                                                        borderRadius: 8,
                                                        border: '1px solid #cbd5e1',
                                                        background: 'white',
                                                        fontSize: '0.78rem',
                                                        color: '#334155',
                                                        outline: 'none',
                                                        cursor: 'pointer'
                                                    }}
                                                >
                                                    <option value="">-- Sin asignar --</option>
                                                    {(users || []).filter(u => u.role === 'operativo').map(u => (
                                                        <option key={u.id} value={u.id}>{u.name}</option>
                                                    ))}
                                                </select>
                                            </div>
                                            
                                            <div style={{ padding: '1.25rem' }}>
                                                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.82rem' }}>
                                                    <thead>
                                                        <tr style={{ borderBottom: '2px solid #f1f5f9' }}>
                                                            <th style={{ textAlign: 'left', paddingBottom: '0.75rem', color: '#94a3b8', fontSize: '0.65rem' }}>Descripción Equipo</th>
                                                            <th style={{ textAlign: 'center', width: '60px', color: '#94a3b8', fontSize: '0.65rem' }}>Env.</th>
                                                            <th style={{ textAlign: 'center', width: '60px', color: '#94a3b8', fontSize: '0.65rem' }}>Dev.</th>
                                                            <th style={{ textAlign: 'center', width: '60px', color: '#94a3b8', fontSize: '0.65rem' }}>Pend.</th>
                                                        </tr>
                                                    </thead>
                                                    <tbody>
                                                        {(rem.items || []).map((it, i) => {
                                                            const pend = Number(it.cantidad) - (Number(it.cantidadDevuelta) || 0);
                                                            return (
                                                                <tr key={i} style={{ borderBottom: '1px solid #f8fafc' }}>
                                                                    <td style={{ padding: '0.85rem 0', fontWeight: 700 }}>{it.nombre || it.productoId}</td>
                                                                    <td style={{ textAlign: 'center' }}>{it.cantidad}</td>
                                                                    <td style={{ textAlign: 'center', color: '#10b981', fontWeight: 800 }}>{it.cantidadDevuelta || 0}</td>
                                                                    <td style={{ textAlign: 'center', color: pend > 0 ? '#f97316' : '#94a3b8', fontWeight: 900 }}>{pend}</td>
                                                                </tr>
                                                            );
                                                        })}
                                                    </tbody>
                                                </table>
                                                
                                                {rem.items.some(it => it.devoluciones?.length > 0) && (
                                                    <div style={{ marginTop: '1.25rem', padding: '1rem', background: '#f0fdf4', borderRadius: 12, border: '1px solid #dcfce7' }}>
                                                        <div style={{ fontSize: '0.68rem', fontWeight: 900, color: '#166534', textTransform: 'uppercase', marginBottom: 8, display: 'flex', alignItems: 'center', gap: 6 }}>
                                                            <RotateCcw size={12} /> Trazabilidad de Reingresos
                                                        </div>
                                                        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                                                            {rem.items.flatMap((it, i) => (it.devoluciones || []).map((d, di) => ({ ...d, nombre: it.nombre, key: `${i}-${di}` })))
                                                                .sort((a, b) => b.fecha.localeCompare(a.fecha))
                                                                .map(d => (
                                                                    <div key={d.key} style={{ fontSize: '0.78rem', color: '#15803d', display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '4px 8px', background: 'rgba(255,255,255,0.5)', borderRadius: 6 }}>
                                                                        <span style={{ fontWeight: 600 }}>• {d.nombre}</span>
                                                                        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                                                                            <span style={{ fontWeight: 800 }}>{d.cantidad} ud.</span>
                                                                            <span style={{ opacity: 0.6, fontSize: '0.7rem' }}>[{d.fecha}]</span>
                                                                        </div>
                                                                    </div>
                                                                ))
                                                            }
                                                        </div>
                                                    </div>
                                                )}
                                            </div>
                                            
                                            {rem.estado === 'Pendiente' && (
                                                <div style={{ padding: '1rem 1.25rem', background: '#f8fafc', borderTop: '1px solid #e2e8f0' }}>
                                                    <ActionBtn onClick={() => onFinalizeDispatch(rem)} icon={Truck} label="Confirmar y Finalizar Despacho" variant="green" />
                                                </div>
                                            )}
                                        </div>
                                    );
                                })}
                            </div>
                            
                            <div style={{ display: 'flex', justifyContent: 'center', marginTop: '1rem' }}>
                                <ActionBtn onClick={onTrazabilidad} icon={Activity} label="Ver Trazabilidad Global" variant="outline_purple" style={{ width: 'auto', padding: '0.5rem 1.5rem' }} />
                            </div>
                        </div>
                    )}

                    {/* ═══ TAB: FACTURACIÓN ═══ */}
                    {activeTab === 'facturacion' && (
                        <div style={{ padding: '1rem', display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
                            {relatedInvoice ? (
                                <>
                                    <div style={{ background: 'white', border: '1px solid #e2e8f0', borderRadius: 12, overflow: 'hidden', marginBottom: '1.5rem', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
                                        <div style={{ background: '#f0f9ff', padding: '0.75rem 1rem', borderBottom: '1px solid #bae6fd', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                            <span style={{ fontSize: '0.7rem', fontWeight: 800, color: '#0369a1', textTransform: 'uppercase', letterSpacing: '0.05em', display: 'flex', alignItems: 'center', gap: 6 }}>
                                                <div style={{ width: 18, height: 18, borderRadius: '50%', background: '#bae6fd', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.6rem', color: '#0284c7' }}>1</div>
                                                Liquidación Diaria de Obra
                                            </span>
                                        </div>
                                        <div style={{ padding: '0', overflowX: 'auto' }}>
                                            {dynamicItems.length === 0 ? (
                                                <div style={{ padding: '2rem', textAlign: 'center', color: '#64748b', fontSize: '0.8rem' }}>No hay equipos despachados aún.</div>
                                            ) : (
                                                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8rem', color: '#1e293b' }}>
                                                    <thead>
                                                        <tr style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0', textAlign: 'left', color: '#475569' }}>
                                                            <th style={{ padding: '0.75rem 1rem', fontWeight: 600 }}>Ítem</th>
                                                            <th style={{ padding: '0.75rem 1rem', fontWeight: 600, textAlign: 'center' }}>Fecha Remisión</th>
                                                            <th style={{ padding: '0.75rem 1rem', fontWeight: 600, textAlign: 'center' }}>Cant.</th>
                                                            <th style={{ padding: '0.75rem 1rem', fontWeight: 600, textAlign: 'center' }}>Días en Obra</th>
                                                            <th style={{ padding: '0.75rem 1rem', fontWeight: 600, textAlign: 'right' }}>Tarifa/Día</th>
                                                            <th style={{ padding: '0.75rem 1rem', fontWeight: 600, textAlign: 'right' }}>Cobro Extra</th>
                                                        </tr>
                                                    </thead>
                                                    <tbody>
                                                        {dynamicItems.map((item, idx) => {
                                                            if (item.devoluciones.length === 0) {
                                                                 return (
                                                                    <tr key={`empty-${idx}`} style={{ borderBottom: '1px solid #e2e8f0', background: '#fff' }}>
                                                                        <td style={{ padding: '0.75rem 1rem' }}>{item.nombre}</td>
                                                                        <td colSpan="5" style={{ padding: '0.75rem 1rem', textAlign: 'center', color: '#94a3b8' }}>Sin despachos registrados</td>
                                                                    </tr>
                                                                );
                                                            }
                                                            return item.devoluciones.map((dev, dIdx) => (
                                                                <tr key={`${idx}-${dIdx}`} style={{ borderBottom: '1px solid #e2e8f0', background: '#fff' }}>
                                                                    <td style={{ padding: '0.75rem 1rem' }}>{item.nombre}</td>
                                                                    <td style={{ padding: '0.75rem 1rem', textAlign: 'center', color: '#64748b' }}>{dev.fechaSalida}</td>
                                                                    <td style={{ padding: '0.75rem 1rem', textAlign: 'center' }}>{dev.cantidad}</td>
                                                                    <td style={{ padding: '0.75rem 1rem', textAlign: 'center' }}>{dev.diasReales}</td>
                                                                    <td style={{ padding: '0.75rem 1rem', textAlign: 'right' }}>{fmtCOP(item.tarifaDia)}</td>
                                                                    <td style={{ padding: '0.75rem 1rem', textAlign: 'right' }}>{dev.costoExtra > 0 ? fmtCOP(dev.costoExtra) : '$0'}</td>
                                                                </tr>
                                                            ));
                                                        })}
                                                    </tbody>
                                                </table>
                                            )}
                                        </div>
                                    </div>

                                    <div style={{ marginTop: '1rem', display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
                                        <div style={{ background: 'white', border: '1px solid #e2e8f0', borderRadius: 12, overflow: 'hidden', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
                                            <div style={{ background: '#f0f9ff', padding: '0.75rem 1rem', borderBottom: '1px solid #bae6fd', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                                <span style={{ fontSize: '0.7rem', fontWeight: 800, color: '#0369a1', textTransform: 'uppercase', letterSpacing: '0.05em', display: 'flex', alignItems: 'center', gap: 6 }}>
                                                    <div style={{ width: 18, height: 18, borderRadius: '50%', background: '#bae6fd', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.6rem', color: '#0284c7' }}>2</div>
                                                    Estado de Cuenta
                                                </span>
                                                <span style={{ 
                                                    padding: '2px 8px', borderRadius: '6px', fontSize: '0.65rem', fontWeight: 800,
                                                    background: isPaid && extraCost === 0 ? '#d1fae5' : '#bae6fd',
                                                    color: isPaid && extraCost === 0 ? '#065f46' : '#0284c7',
                                                    border: '1px solid ' + (isPaid && extraCost === 0 ? '#6ee7b7' : '#7dd3fc')
                                                }}>
                                                    {isPaid && extraCost === 0 ? 'LIQUIDADO' : 'PENDIENTE'}
                                                </span>
                                            </div>

                                            <div style={{ padding: '0', overflowX: 'auto' }}>
                                                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8rem', color: '#1e293b' }}>
                                                    <thead>
                                                        <tr style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0', textAlign: 'left', color: '#475569' }}>
                                                            <th style={{ padding: '0.75rem 1rem', fontWeight: 600 }}>Fecha</th>
                                                            <th style={{ padding: '0.75rem 1rem', fontWeight: 600 }}>Concepto</th>
                                                            <th style={{ padding: '0.75rem 1rem', fontWeight: 600, textAlign: 'right' }}>Monto</th>
                                                        </tr>
                                                    </thead>
                                                    <tbody>
                                                        <tr style={{ borderBottom: '1px solid #e2e8f0', background: '#fff' }}>
                                                            <td style={{ padding: '0.75rem 1rem', color: '#64748b' }}>{relatedInvoice.date || relatedInvoice.fecha || cot.fecha || '—'}</td>
                                                            <td style={{ padding: '0.75rem 1rem' }}>Contrato Inicial</td>
                                                            <td style={{ padding: '0.75rem 1rem', textAlign: 'right' }}>{fmtCOP(relatedInvoice.amount)}</td>
                                                        </tr>
                                                        {extraCost > 0 && (
                                                            <tr style={{ borderBottom: '1px solid #e2e8f0', background: '#fff' }}>
                                                                <td style={{ padding: '0.75rem 1rem', color: '#64748b' }}>A hoy</td>
                                                                <td style={{ padding: '0.75rem 1rem' }}>Extras por Liquidación (Mora)</td>
                                                                <td style={{ padding: '0.75rem 1rem', textAlign: 'right' }}>+ {fmtCOP(extraCost)}</td>
                                                            </tr>
                                                        )}
                                                        {(() => {
                                                            const abList = relatedInvoice.abonos || [];
                                                            const recordedSum = abList.reduce((s, ab) => s + (Number(ab.monto) || Number(ab.amount) || 0), 0);
                                                            const unrecorded = Math.max(0, (Number(relatedInvoice.paidAmount) || 0) - recordedSum);
                                                            
                                                            return (
                                                                <>
                                                                    {unrecorded > 1 && (
                                                                        <tr style={{ borderBottom: '1px solid #e2e8f0', background: '#f0fdf4' }}>
                                                                            <td style={{ padding: '0.75rem 1rem', color: '#64748b' }}>{relatedInvoice.paidDate || relatedInvoice.date || '—'}</td>
                                                                            <td style={{ padding: '0.75rem 1rem', color: '#16a34a', fontWeight: 600 }}>PAGOS ANTERIORES</td>
                                                                            <td style={{ padding: '0.75rem 1rem', textAlign: 'right', color: '#16a34a', fontWeight: 700 }}>- {fmtCOP(unrecorded)}</td>
                                                                        </tr>
                                                                    )}
                                                                    {abList.map((ab, i) => (
                                                                        <tr key={i} style={{ borderBottom: '1px solid #e2e8f0', background: '#f0fdf4' }}>
                                                                            <td style={{ padding: '0.75rem 1rem', color: '#64748b' }}>{ab.fecha || ab.date || '—'}</td>
                                                                            <td style={{ padding: '0.75rem 1rem', color: '#16a34a', fontWeight: 600 }}>PAGO RECIBIDO</td>
                                                                            <td style={{ padding: '0.75rem 1rem', textAlign: 'right', color: '#16a34a', fontWeight: 700 }}>- {fmtCOP(ab.monto || ab.amount || 0)}</td>
                                                                        </tr>
                                                                    ))}
                                                                </>
                                                            );
                                                        })()}
                                                    </tbody>
                                                    <tfoot>
                                                        <tr style={{ background: '#f8fafc', borderTop: '2px solid #e2e8f0' }}>
                                                            <td colSpan="2" style={{ padding: '1rem', fontWeight: 700, color: '#1e293b' }}>SALDO PROYECTADO</td>
                                                            <td style={{ padding: '1rem', textAlign: 'right', fontWeight: 800, color: '#1e293b', fontSize: '1.1rem' }}>
                                                                {fmtCOP(((relatedInvoice.amount || 0) - (relatedInvoice.paidAmount || 0)) + extraCost)}
                                                            </td>
                                                        </tr>
                                                    </tfoot>
                                                </table>
                                            </div>
                                        </div>

                                        <ActionSection title="Acciones de Cobro" icon={CreditCard} color="#10b981" stepNumber="3">
                                            <div style={{ gridColumn: 'span 4' }}>
                                                {!isPaid && <ActionBtn onClick={onCorteObra} icon={DollarSign} label="Generar Corte de Obra" variant="green" />}
                                            </div>
                                            
                                            {(relatedInvoice.cortes || []).length > 0 && (
                                                <div style={{ 
                                                    gridColumn: 'span 4',
                                                    background: 'white', border: '1px solid #e2e8f0', borderRadius: 12, overflow: 'hidden', boxShadow: '0 1px 3px rgba(0,0,0,0.05)'
                                                }}>
                                                    <div style={{ background: '#f0f9ff', padding: '0.75rem 1rem', borderBottom: '1px solid #bae6fd', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                                        <span style={{ fontSize: '0.7rem', fontWeight: 800, color: '#0369a1', textTransform: 'uppercase' }}>Documentos de Cobro (Cortes)</span>
                                                    </div>
                                                    <div style={{ overflowX: 'auto' }}>
                                                        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8rem', color: '#1e293b' }}>
                                                            <thead>
                                                                <tr style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0', textAlign: 'left', color: '#475569' }}>
                                                                    <th style={{ padding: '0.75rem 1rem', fontWeight: 600 }}>Generación</th>
                                                                    <th style={{ padding: '0.75rem 1rem', fontWeight: 600 }}>Corte</th>
                                                                    <th style={{ padding: '0.75rem 1rem', fontWeight: 600 }}>Estado</th>
                                                                    <th style={{ padding: '0.75rem 1rem', fontWeight: 600, textAlign: 'center' }}>Acciones</th>
                                                                </tr>
                                                            </thead>
                                                            <tbody>
                                                                {relatedInvoice.cortes.map((corte, idx) => {
                                                                    const fechaGen = format(new Date(corte.id), 'dd/MM/yy');
                                                                    return (
                                                                        <tr key={idx} style={{ borderBottom: '1px solid #e2e8f0', background: '#fff' }}>
                                                                            <td style={{ padding: '0.75rem 1rem', color: '#64748b' }}>{fechaGen}</td>
                                                                            <td style={{ padding: '0.75rem 1rem', fontWeight: 700 }}>{corte.fechaCorte}</td>
                                                                            <td style={{ padding: '0.75rem 1rem' }}>
                                                                                <span style={{ 
                                                                                    padding: '2px 8px', borderRadius: 6, fontSize: '0.6rem', fontWeight: 800,
                                                                                    background: corte.status === 'Ingresado' ? '#dcfce7' : (corte.status === 'Rechazado' ? '#fee2e2' : '#fef9c3'),
                                                                                    color: corte.status === 'Ingresado' ? '#166534' : (corte.status === 'Rechazado' ? '#991b1b' : '#854d0e')
                                                                                }}>{corte.status.toUpperCase()}</span>
                                                                            </td>
                                                                            <td style={{ padding: '0.75rem 1rem', textAlign: 'center' }}>
                                                                                <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'center', alignItems: 'center' }}>
                                                                                    {corte.status === 'Pendiente' && (
                                                                                        <>
                                                                                            <button 
                                                                                                onClick={() => {
                                                                                                    const inv = relatedInvoice;
                                                                                                    onCorteAction(inv.id, corte.id, 'Ingresado');
                                                                                                    onTriggerPay(inv);
                                                                                                }}
                                                                                                style={{ background: '#10b981', color: 'white', border: 'none', borderRadius: 6, padding: '4px 10px', fontSize: '0.7rem', fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4 }}
                                                                                            ><Check size={12} /> Confirmar</button>
                                                                                            <button 
                                                                                                onClick={() => onCorteAction(relatedInvoice.id, corte.id, 'Rechazado')}
                                                                                                style={{ background: '#ef4444', color: 'white', border: 'none', borderRadius: 6, padding: '4px 10px', fontSize: '0.7rem', fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4 }}
                                                                                            ><X size={12} /> No entró</button>
                                                                                        </>
                                                                                    )}
                                                                                    <button 
                                                                                        onClick={() => generateCortePDF(relatedInvoice, getClient(relatedInvoice.clientId), getObra(relatedInvoice), settings, invoices, remisiones, corte.fechaCorte)}
                                                                                        style={{ background: 'white', color: '#475569', border: '1px solid #cbd5e1', borderRadius: 6, padding: '4px', cursor: 'pointer', display: 'flex', alignItems: 'center' }}
                                                                                    ><Download size={14} /></button>
                                                                                </div>
                                                                            </td>
                                                                        </tr>
                                                                    );
                                                                })}
                                                            </tbody>
                                                        </table>
                                                    </div>
                                                </div>
                                            )}
                                        </ActionSection>
                                    </div>
                                </>
                            ) : (
                                <div style={{ background: 'white', border: '1px solid #e2e8f0', borderRadius: 10, padding: '2rem', textAlign: 'center' }}>
                                    <FileText size={32} style={{ color: '#cbd5e1', marginBottom: '0.75rem' }} />
                                    <div style={{ fontWeight: 700, color: '#64748b', marginBottom: '0.5rem' }}>Sin factura generada</div>
                                    {cot.estado === 'Aprobada' && !cot.facturaId && (
                                        <ActionBtn onClick={onFacturar} icon={FileText} label="Generar Factura" variant="indigo" />
                                    )}
                                </div>
                            )}
                        </div>
                    )}
                </div>
            </div>

            {editingRemisionTarget && (
                <EditRemisionModal
                    remision={editingRemisionTarget}
                    onClose={() => setEditingRemisionTarget(null)}
                    onSave={editRemision}
                    products={products}
                    clients={clients}
                />
            )}
        </div>
    );
}
