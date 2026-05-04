import React, { useState, useMemo, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import {
    FilePlus, Search, CheckCircle, XCircle, Clock, Send,
    X, FileText, Shield, ShieldCheck, Download, Copy, Share2, DollarSign, Check,
    PenTool, Fingerprint, MapPin, ChevronRight, Upload, Eye,
    Plus, List, Edit2, User, ArrowRight,
    ChevronLeft, ChevronsLeft, ChevronsRight, ChevronDown, ChevronUp,
    Truck, RotateCcw, Ban, Printer, Activity, TrendingUp, Info,
    ArrowDownCircle, Package, CreditCard, AlertTriangle
} from 'lucide-react';
import { useAppContext } from '../context/AppContext';
import { format, differenceInDays } from 'date-fns';
import Swal from 'sweetalert2';
import {
    generateCotizacionPDF, generateContratoPDF, generatePagarePDF, generateCartaPDF,
    generateRemisionPDF, SignatureCanvas, WebcamCapture, HabeasDataModal,
    generateCortePDF, ESTADO_CFG, fmtCOP
} from './CotizacionesHelpers';
import NuevaCotizacionModal from './NuevaCotizacionModal';
import DevolucionModal from './DevolucionModal';
import CorteObraModal from './CorteObraModal';
import { ActionBtn, BADGE, REM_ICON } from './CotComponents';
import { ApprovalModal, ShareModal, ContratoEditorModal } from './CotModals';
import CotDetailPanel from './CotDetailPanel';

// ─── Error Boundary para el modal de nueva cotización ────────────────────────
class ModalErrorBoundary extends React.Component {
    constructor(props) {
        super(props);
        this.state = { hasError: false, error: null };
    }
    static getDerivedStateFromError(error) {
        return { hasError: true, error };
    }
    componentDidCatch(error, info) {
        console.error('❌ Error en NuevaCotizacionModal:', error, info);
    }
    render() {
        if (this.state.hasError) {
            return (
                <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
                    <div style={{ background: 'white', padding: '2rem', borderRadius: 12, maxWidth: 500, width: '90%' }}>
                        <h3 style={{ color: '#ef4444', marginBottom: '1rem' }}>⚠️ Error al cargar el formulario</h3>
                        <pre style={{ background: '#f8fafc', padding: '1rem', borderRadius: 8, fontSize: '0.75rem', overflow: 'auto', maxHeight: 200, color: '#dc2626' }}>
                            {this.state.error?.message || String(this.state.error)}
                        </pre>
                        <button onClick={() => { this.setState({ hasError: false, error: null }); this.props.onClose?.(); }}
                            style={{ marginTop: '1rem', padding: '0.5rem 1.5rem', background: '#2365AB', color: 'white', border: 'none', borderRadius: 8, cursor: 'pointer', fontWeight: 700 }}>
                            Cerrar
                        </button>
                    </div>
                </div>
            );
        }
        return this.props.children;
    }
}

// Modals and Detail Panel moved to CotModals.jsx and CotDetailPanel.jsx

// ─── MAIN PAGE ────────────────────────────────────────────────────────────────
export default function Cotizaciones({ hideHeader = false, onInvoiceCreated } = {}) {
    const { clients, products, cotizaciones, invoices = [], settings, remisiones = [],
        addCotizacion, updateCotizacion, actualizarEstadoCotizacion,
        createInvoiceFromCotizacion, deleteCotizacion, payInvoice, addCorteObra, updateCorteStatus,
        addRemision, editRemision, registrarDevolucion, maintenances = [],
        marcarRemisionCreada, deleteRemision, cancelRemision, setGlobalPreload
    } = useAppContext();
    const navigate = useNavigate();
    const [search, setSearch] = useState('');
    const [filterE, setFilterE] = useState('Todos');
    const [showNew, setShowNew] = useState(false);
    const [showCorteModal, setShowCorteModal] = useState(false);
    const [corteModalParams, setCorteModalParams] = useState({ clientId: '', obraId: '' });
    const [selected, setSelected] = useState(null);
    const [approving, setApproving] = useState(null);
    const [sharing, setSharing] = useState(null);
    const [editingContrato, setEditingContrato] = useState(null);
    const [editing, setEditing] = useState(null);
    const [payingInvoice, setPayingInvoice] = useState(null);
    const [paymentOption, setPaymentOption] = useState('Contado');
    const [abonoAmount, setAbonoAmount] = useState(0);
    const [paymentMethod, setPaymentMethod] = useState('Transferencia');
    const [facturaPreload, setFacturaPreload] = useState(null);
    const [showNueva, setShowNueva] = useState(false);
    const [showVerifyModal, setShowVerifyModal] = useState(false);
    const [verifyTarget, setVerifyTarget] = useState(null);
    const [fechaInicioRemision, setFechaInicioRemision] = useState('');
    const [devolucionTarget, setDevolucionTarget] = useState(null); // { clientId, obraId }
    const [blockMsg, setBlockMsg] = useState('');
    const [corteObraTarget, setCorteObraTarget] = useState(null); // { invoice: object, step: 'date' | 'validation', date: string }

    useEffect(() => {
        const h1 = () => setShowNew(true);
        const h2 = () => setDevolucionTarget({ clientId: '', obraId: '' });
        const h3 = () => setShowCorteModal(true);

        window.addEventListener('trigger-nueva-cot', h1);
        window.addEventListener('trigger-devolucion', h2);
        window.addEventListener('trigger-corte', h3);

        return () => {
            window.removeEventListener('trigger-nueva-cot', h1);
            window.removeEventListener('trigger-devolucion', h2);
            window.removeEventListener('trigger-corte', h3);
        };
    }, []);

    const handleSendQuote = (cotId) => {
        actualizarEstadoCotizacion(cotId, 'Enviada');
        setSharing(cotId);
    };

    const handleFinalizeDispatch = (rem) => { 
        setVerifyTarget(rem); 
        setFechaInicioRemision(rem.fecha || format(new Date(), 'yyyy-MM-dd')); 
        setShowVerifyModal(true); 
    };

    const handleConfirmFinalDispatch = async () => {
        if (!verifyTarget) return;
        const rem = verifyTarget;
        try {
            const remClient = clients.find(c => c.id === rem.clientId);
            const remObra = remClient?.obras?.find(o => o.id === rem.obraId);
            await editRemision(rem.id, { estado: 'Activa', fecha: fechaInicioRemision });
            generateRemisionPDF({ ...rem, estado: 'Activa', fecha: fechaInicioRemision }, remClient, remObra, settings);
            setShowVerifyModal(false);
            setVerifyTarget(null);
            Swal.fire({ title: '¡Despacho Exitoso!', text: `Remisión ${rem.id} activada.`, icon: 'success', confirmButtonColor: '#2365AB', confirmButtonText: 'Excelente' });
        } catch (err) {
            Swal.fire({ title: 'Error', text: err.message, icon: 'error', confirmButtonColor: '#ef4444' });
        }
    };

    const total = (c) => (c.items || []).reduce((s, i) => s + (i.cantidad * i.dias * i.tarifaDia), 0) + (c.transporte || 0);
    const kpi = (est) => cotizaciones.filter(c => c.estado === est).length;

    const [sortConfig, setSortConfig] = useState({ key: 'id', direction: 'asc' });

    const handleSort = (key) => {
        let direction = 'asc';
        if (sortConfig.key === key && sortConfig.direction === 'asc') direction = 'desc';
        setSortConfig({ key, direction });
    };

    const combinedList = useMemo(() => {
        const list = cotizaciones.map(c => ({ ...c, type: 'cot' }));
        invoices.forEach(inv => {
            // Solo incluimos facturas que NO vienen de una cotización (para no duplicar)
            if (!inv.cotizacionId) {
                list.push({
                    ...inv,
                    type: 'inv',
                    fecha: inv.date,
                    estado: inv.status === 'Paid' ? 'Facturada' : 'Aprobada',
                    items: (inv.items || []).map(i => ({ ...i, cantidad: i.quantity, dias: i.days, tarifaDia: i.price })),
                    isDirectInvoice: true
                });
            }
        });
        return list;
    }, [cotizaciones, invoices]);

    const sortedCotizaciones = useMemo(() => {
        const filtered = combinedList.filter(c => {
            const cl = clients.find(x => x.id === c.clientId);
            const q = search.toLowerCase();
            return (c.id.toLowerCase().includes(q) || cl?.name?.toLowerCase()?.includes(q)) &&
                (filterE === 'Todos' || c.estado === filterE);
        });

        if (sortConfig.key) {
            filtered.sort((a, b) => {
                let aVal, bVal;
                
                if (sortConfig.key === 'clientName') {
                    aVal = (clients.find(x => x.id === a.clientId)?.name || '').toLowerCase();
                    bVal = (clients.find(x => x.id === b.clientId)?.name || '').toLowerCase();
                } else if (sortConfig.key === 'total') {
                    aVal = total(a);
                    bVal = total(b);
                } else if (sortConfig.key === 'id') {
                    aVal = parseInt(a.id.split('-').pop().replace('F', '')) || 0;
                    bVal = parseInt(b.id.split('-').pop().replace('F', '')) || 0;
                } else {
                    aVal = a[sortConfig.key] || '';
                    bVal = b[sortConfig.key] || '';
                    if (typeof aVal === 'string') aVal = aVal.toLowerCase();
                    if (typeof bVal === 'string') bVal = bVal.toLowerCase();
                }

                if (aVal < bVal) return sortConfig.direction === 'asc' ? -1 : 1;
                if (aVal > bVal) return sortConfig.direction === 'asc' ? 1 : -1;
                return 0;
            });
        }
        return filtered;
    }, [cotizaciones, search, filterE, clients, sortConfig]);


    // Pagination
    const [currentPage, setCurrentPage] = useState(1);
    const [itemsPerPage, setItemsPerPage] = useState(10);

    const paginatedCotizaciones = useMemo(() => {
        const start = (currentPage - 1) * itemsPerPage;
        return sortedCotizaciones.slice(start, start + itemsPerPage);
    }, [sortedCotizaciones, currentPage, itemsPerPage]);

    const totalPages = Math.ceil(sortedCotizaciones.length / itemsPerPage);

    const IS = { padding: '0.55rem 0.75rem', background: 'rgba(255,255,255,0.06)', border: '1px solid var(--surface-border)', borderRadius: 8, color: 'var(--text-primary)', fontSize: '0.875rem', outline: 'none' };

    const selectedCot = combinedList.find(c => c.id === selected);
    const approvingCot = cotizaciones.find(c => c.id === approving);
    const getClient = id => clients.find(c => c.id === id);
    const getObra = (cot) => getClient(cot?.clientId)?.obras?.find(o => o.id === cot?.obraId);

    const selectedInv = selectedCot
        ? (selectedCot.type === 'inv' ? selectedCot : invoices.find(i => i.id === selectedCot.facturaId))
        : null;
    const selectedLinkedRems = selectedCot ? remisiones.filter(r =>
        r.cotizacionId === selectedCot.id ||
        (selectedInv && r.facturaId === selectedInv.id) ||
        (selectedCot.type === 'inv' && r.facturaId === selectedCot.id)
    ) : [];
    const selectedActiveRems = selectedLinkedRems.filter(r => r.estado !== 'Cerrada' && r.estado !== 'Cancelada');
    const selectedCanCreateRem = !!(
        (selectedInv?.remisionEnabled === true) || 
        (selectedCot?.estado === 'Aprobada' || selectedCot?.estado === 'Facturada' || selectedCot?.type === 'inv' || selectedCot?.facturaId)
    );

    return (
        <>
            {/* Header / Top Bar con KPIs integrados */}
            {/* Search and Filters Bar */}
            {/* Filters */}
            <div className="glass-panel" style={{ display: 'flex', gap: '0.75rem', alignItems: 'center', flexWrap: 'wrap', borderWidth: '0.7px', padding: '0.5rem 1.5rem', marginBottom: '0.5rem' }}>
                <div style={{ position: 'relative', flex: 1, minWidth: 200 }}>
                    <Search size={15} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                    <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Buscar por ID o cliente…" style={{ ...IS, paddingLeft: '2rem', width: '100%', boxSizing: 'border-box' }} />
                </div>
                <select value={filterE} onChange={e => setFilterE(e.target.value)} style={{ ...IS, minWidth: 140 }}>
                    {['Todos', 'Borrador', 'Enviada', 'Aprobada', 'Facturada', 'Rechazada'].map(v => <option key={v}>{v}</option>)}
                </select>

            </div>

            {/* Table */}
            <div className="glass-panel" style={{ borderWidth: '0.7px', padding: '0.75rem 1.5rem' }}>
                <div style={{ overflowX: 'auto' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                        <thead>
                            <tr style={{ background: '#f1f5f9', borderBottom: '1px solid var(--surface-border)' }}>
                                {[
                                    { label: 'ID',       key: 'id'         },
                                    { label: 'Fecha',    key: 'fecha'      },
                                    { label: 'Cliente',  key: 'clientName' },
                                    { label: 'Obra',     key: null         },
                                    { label: 'Estado',   key: null         },
                                    { label: 'Acciones', key: null         },
                                ].map(({ label, key }) => (
                                    <th
                                        key={label}
                                        onClick={() => key && handleSort(key)}
                                        style={{
                                            padding: '0.75rem 0.8rem', textAlign: 'left', fontSize: '0.68rem', color: 'var(--text-primary)',
                                            fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.05em', whiteSpace: 'nowrap',
                                            cursor: key ? 'pointer' : 'default', userSelect: 'none'
                                        }}
                                    >
                                        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                                            {label}
                                            {key && sortConfig.key === key && (
                                                sortConfig.direction === 'asc' ? <ChevronUp size={12} /> : <ChevronDown size={12} />
                                            )}
                                        </div>
                                    </th>
                                ))}
                            </tr>
                        </thead>
                        <tbody>
                            {paginatedCotizaciones.map(cot => {
                                const client  = getClient(cot.clientId);
                                const obra    = getObra(cot);
                                const cfg     = ESTADO_CFG[cot.estado] || ESTADO_CFG['Borrador'];
                                const inv     = cot.facturaId ? invoices.find(i => i.id === cot.facturaId)
                                              : cot.type === 'inv' ? cot : null;
                                const isPaid  = inv?.status === 'Paid';

                                // Remisiones vinculadas a esta fila
                                const rowRems = remisiones.filter(r =>
                                    r.cotizacionId === cot.id ||
                                    (inv && r.facturaId === inv.id) ||
                                    (cot.type === 'inv' && r.facturaId === cot.id)
                                );
                                const activeRem = rowRems.find(r => r.estado === 'Activa' || r.estado === 'Parcial')
                                               || rowRems.find(r => r.estado === 'Pendiente')
                                               || rowRems[0] || null;

                                // ── Estado principal (cotización / factura) ──
                                let cotLabel = cot.estado;
                                let cotColor = cfg.color;
                                let CotIcon  = cfg.icon;

                                if (cot.isDirectInvoice) {
                                    if (cot.status === 'Paid')    { cotLabel = 'Pagada';         cotColor = '#10b981'; CotIcon = CheckCircle; }
                                    else                           { cotLabel = 'Pend. Pago';     cotColor = '#f59e0b'; CotIcon = Clock;       }
                                } else if (cot.estado === 'Facturada') {
                                    if (inv?.status === 'Paid')    { cotLabel = 'Pagada';         cotColor = '#10b981'; CotIcon = CheckCircle; }
                                    else if (inv?.status === 'Partial') { cotLabel = 'Abonada';  cotColor = '#3b82f6'; CotIcon = DollarSign;  }
                                    else if (inv?.status === 'Credito') { cotLabel = 'Credito';   cotColor = '#6366f1'; CotIcon = Clock;       }
                                    else                           { cotLabel = 'Pend. Pago';     cotColor = '#f59e0b'; CotIcon = Clock;       }
                                }

                                // ── Estado remisión ──
                                const REM_COLOR = { Activa: '#2365AB', Parcial: '#f97316', Cerrada: '#10b981', Pendiente: '#6366f1', Cancelada: '#ef4444' };
                                const REM_ICON  = { Activa: Truck, Parcial: Clock, Cerrada: CheckCircle, Pendiente: AlertTriangle, Cancelada: Ban };
                                const remColor  = activeRem ? (REM_COLOR[activeRem.estado] || '#94a3b8') : null;
                                const RemIcon   = activeRem ? (REM_ICON[activeRem.estado]  || Truck)     : null;

                                const BADGE = (label, color, Icon) => (
                                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '3px 9px', borderRadius: 999, background: color, color: 'white', fontWeight: 800, fontSize: '0.62rem', textTransform: 'uppercase', whiteSpace: 'nowrap' }}>
                                        {Icon && <Icon size={11} />}{label}
                                    </span>
                                );

                                const canApprove  = !cot.isDirectInvoice && (cot.estado === 'Borrador' || cot.estado === 'Enviada');
                                const canPay      = (cot.estado === 'Facturada' && !isPaid) || (cot.isDirectInvoice && cot.status !== 'Paid');
                                const canContract = !cot.isDirectInvoice && cot.estado === 'Facturada';

                                return (
                                    <tr key={cot.id}
                                        style={{ borderBottom: '1px solid var(--surface-border)', cursor: 'pointer', transition: 'background-color 0.15s ease' }}
                                        onClick={() => setSelected(cot.id)}
                                        onMouseEnter={e => e.currentTarget.style.background = 'rgba(35, 101, 171, 0.08)'}
                                        onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>

                                        {/* ID */}
                                        <td style={{ padding: '0.85rem', fontWeight: 800, fontFamily: 'monospace', color: 'var(--primary)', fontSize: '0.85rem', whiteSpace: 'nowrap' }}>
                                            {cot.id.split('-').pop().replace('F', '').padStart(3, '0')}
                                        </td>

                                        {/* Fecha */}
                                        <td style={{ padding: '0.85rem', fontSize: '0.82rem', color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>
                                            {cot.fecha || '—'}
                                        </td>

                                        {/* Cliente */}
                                        <td style={{ padding: '0.85rem' }}>
                                            <div style={{ fontWeight: 800, fontSize: '0.875rem', color: 'var(--text-primary)' }}>{client?.name || cot.clientId}</div>
                                        </td>

                                        {/* Obra */}
                                        <td style={{ padding: '0.85rem' }}>
                                            <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: 3, fontWeight: 600 }}>
                                                <MapPin size={12} style={{ color: 'var(--primary)', opacity: 0.8 }} />
                                                {obra?.nombre || cot.obraId || '—'}
                                            </div>
                                        </td>

                                        {/* Estado único */}
                                        <td style={{ padding: '0.85rem' }}>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                                {activeRem 
                                                    ? BADGE(activeRem.estado, remColor, RemIcon)
                                                    : BADGE(cotLabel, cotColor, CotIcon)
                                                }
                                            </div>
                                        </td>

                                        <td style={{ padding: '0.85rem' }} onClick={e => e.stopPropagation()}>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>

                                                {/* Imprimir cotización */}
                                                <button onClick={() => generateCotizacionPDF(cot, client, obra, settings)} className="btn-action-standard" title="Imprimir Cotización"
                                                    style={{ width: 28, height: 28, padding: 0, justifyContent: 'center', minWidth: 'auto', background: 'rgba(35,101,171,0.1)', color: 'var(--primary)', border: '1px solid rgba(35,101,171,0.2)' }}>
                                                    <Download size={13} />
                                                </button>

                                                {/* Aprobar */}
                                                {!cot.isDirectInvoice && (
                                                    <button onClick={() => setApproving(cot.id)} disabled={!canApprove} className="btn-action-standard" title="Aprobar"
                                                        style={{ width: 28, height: 28, padding: 0, justifyContent: 'center', minWidth: 'auto', background: canApprove ? '#10b981' : '#f1f5f9', color: canApprove ? 'white' : '#94a3b8', opacity: canApprove ? 1 : 0.45, cursor: canApprove ? 'pointer' : 'not-allowed' }}>
                                                        <CheckCircle size={13} />
                                                    </button>
                                                )}

                                                {/* Registrar pago */}
                                                {canPay && (
                                                    <button onClick={() => {
                                                        const t = cot.isDirectInvoice ? cot : inv;
                                                        if (t) { setPayingInvoice(t); setPaymentOption('Contado'); setAbonoAmount(t.amount - (t.paidAmount || 0)); }
                                                    }} className="btn-action-standard" title="Registrar Pago"
                                                        style={{ width: 28, height: 28, padding: 0, justifyContent: 'center', minWidth: 'auto', background: '#10b981', color: 'white' }}>
                                                        <DollarSign size={13} />
                                                    </button>
                                                )}

                                                {/* Imprimir contrato */}
                                                {canContract && (
                                                    <button onClick={() => generateContratoPDF(cot, client, obra, settings)} className="btn-action-standard" title="Imprimir Contrato"
                                                        style={{ width: 28, height: 28, padding: 0, justifyContent: 'center', minWidth: 'auto', background: 'rgba(16,185,129,0.1)', color: '#10b981', border: '1px solid rgba(16,185,129,0.2)' }}>
                                                        <FileText size={13} />
                                                    </button>
                                                )}

                                                {/* Remisión activa → imprimir remisión */}
                                                {activeRem && (
                                                    <button onClick={() => generateRemisionPDF(activeRem, client, obra, settings)} className="btn-action-standard" title={`Imprimir Remisión ${activeRem.id}`}
                                                        style={{ width: 28, height: 28, padding: 0, justifyContent: 'center', minWidth: 'auto', background: 'rgba(35,101,171,0.12)', color: '#2365AB', border: '1px solid rgba(35,101,171,0.2)' }}>
                                                        <Truck size={13} />
                                                    </button>
                                                )}
                                            </div>
                                        </td>
                                    </tr>
                                );
                            })}
                            {sortedCotizaciones.length === 0 && (
                                <tr><td colSpan={6} style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-muted)' }}>No se encontraron registros</td></tr>
                            )}
                        </tbody>
                    </table>
                </div>

                {/* Pagination Controls (Fixed at card bottom) */}
                <div className="flex justify-between items-center mt-6" 
                    style={{ 
                        borderTop: '1px solid var(--surface-border)', 
                        position: 'sticky', 
                        bottom: 0, 
                        background: 'white', 
                        zIndex: 20, 
                        padding: '1rem 0',
                    }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                            <span>Mostrar:</span>
                            <div style={{ position: 'relative' }}>
                                <select 
                                    value={itemsPerPage} 
                                    onChange={e => { setItemsPerPage(Number(e.target.value)); setCurrentPage(1); }}
                                    className="input-base"
                                    style={{ padding: '0.3rem 1.8rem 0.3rem 0.6rem', fontSize: '0.8rem', width: 'auto', minWidth: '70px', height: '32px' }}
                                >
                                    {[5, 10, 20, 50, 100].map(n => <option key={n} value={n}>{n}</option>)}
                                </select>
                                <ChevronDown size={14} style={{ position: 'absolute', right: 6, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none', color: 'var(--text-muted)' }} />
                            </div>
                            <span>por página</span>
                        </div>
                        <div style={{ width: '1px', height: '16px', background: 'var(--surface-border)' }}></div>
                        <div>
                            Mostrando {sortedCotizaciones.length > 0 ? (currentPage - 1) * itemsPerPage + 1 : 0} a {Math.min(currentPage * itemsPerPage, sortedCotizaciones.length)} de {sortedCotizaciones.length} registros
                        </div>
                    </div>

                    <div className="flex items-center gap-2">
                        <button 
                            className="btn btn-secondary btn-sm p-2" 
                            disabled={currentPage === 1}
                            onClick={() => setCurrentPage(1)}
                            title="Primera página"
                        >
                            <ChevronsLeft size={16} />
                        </button>
                        <button 
                            className="btn btn-secondary btn-sm p-2" 
                            disabled={currentPage === 1}
                            onClick={() => setCurrentPage(prev => prev - 1)}
                            title="Página anterior"
                        >
                            <ChevronLeft size={16} />
                        </button>
                        
                        <div className="flex items-center gap-1">
                            {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                                let pageNum;
                                if (totalPages <= 5) pageNum = i + 1;
                                else if (currentPage <= 3) pageNum = i + 1;
                                else if (currentPage >= totalPages - 2) pageNum = totalPages - 4 + i;
                                else pageNum = currentPage - 2 + i;
                                
                                return (
                                    <button 
                                        key={pageNum}
                                        onClick={() => setCurrentPage(pageNum)}
                                        className={`btn btn-sm ${currentPage === pageNum ? 'btn-primary' : 'btn-secondary'}`}
                                        style={{ minWidth: '32px', height: '32px', padding: 0 }}
                                    >
                                        {pageNum}
                                    </button>
                                );
                            })}
                        </div>

                        <button 
                            className="btn btn-secondary btn-sm p-2" 
                            disabled={currentPage === totalPages || totalPages === 0}
                            onClick={() => setCurrentPage(prev => prev + 1)}
                            title="Siguiente página"
                        >
                            <ChevronRight size={16} />
                        </button>
                        <button 
                            className="btn btn-secondary btn-sm p-2" 
                            disabled={currentPage === totalPages || totalPages === 0}
                            onClick={() => setCurrentPage(totalPages)}
                            title="Última página"
                        >
                            <ChevronsRight size={16} />
                        </button>
                    </div>
                </div>
            </div>

            {/* Detail Panel — rendered in portal so it overlays everything */}
            {selected && selectedCot && createPortal(
                <CotDetailPanel
                    cot={selectedCot}
                    client={getClient(selectedCot.clientId)}
                    obra={getObra(selectedCot)}
                    settings={settings}
                    onClose={() => setSelected(null)}
                    onUpdateEstado={actualizarEstadoCotizacion}
                    onOpenApproval={() => { setApproving(selectedCot.id); setSelected(null); }}
                    onFacturar={() => { createInvoiceFromCotizacion(selectedCot.id); onInvoiceCreated?.(); }}
                    onSendLink={handleSendQuote}
                    onEditContrato={() => setEditingContrato(selectedCot.id)}
                    onEdit={() => { setEditing(selectedCot); setSelected(null); }}
                    onDelete={async (id) => {
                        try { await deleteCotizacion(id); setSelected(null); }
                        catch (e) { alert(e.message); }
                    }}
                    invoices={invoices}
                    remisiones={remisiones}
                    linkedRems={selectedLinkedRems}
                    activeRems={selectedActiveRems}
                    canCreateRem={selectedCanCreateRem}
                    onCreateRemision={() => {
                        // Si hay factura vinculada se usa, de lo contrario se usa la cotización aprobada directamente
                        const preloadData = selectedInv || selectedCot;
                        setGlobalPreload(preloadData);
                        navigate('/comercial?tab=despachos');
                    }}
                    onFinalizeDispatch={(rem) => { handleFinalizeDispatch(rem); }}
                    onDevolucion={(cot) => setDevolucionTarget({ clientId: cot.clientId, obraId: cot.obraId })}
                    onTrazabilidad={() => { navigate('/comercial?tab=despachos'); setSelected(null); }}
                    onPrintRemision={(rem) => generateRemisionPDF(rem, getClient(selectedCot.clientId), getObra(selectedCot), settings)}
                    onCorteObra={() => {
                        setCorteModalParams({ clientId: selectedCot.clientId, obraId: selectedCot.obraId });
                        setShowCorteModal(true);
                        setSelected(null);
                    }}
                    onCorteAction={(invId, corteId, status) => updateCorteStatus(invId, corteId, status)}
                    onTriggerPay={(inv) => {
                        setPayingInvoice(inv);
                        setPaymentOption('Contado');
                        setAbonoAmount(inv.amount - (inv.paidAmount || 0));
                    }}
                />
            , document.body)}

            {/* Contrato Editor Modal */}
            {editingContrato && (
                <ContratoEditorModal 
                    cot={cotizaciones.find(c => c.id === editingContrato)}
                    onClose={() => setEditingContrato(null)}
                    onSave={(clausulas) => actualizarEstadoCotizacion(editingContrato, cotizaciones.find(c => c.id === editingContrato).estado, { clausulas })}
                />
            )}

            {/* Approval Modal */}
            {approving && approvingCot && (
                <ApprovalModal
                    cot={approvingCot}
                    client={getClient(approvingCot.clientId)}
                    obra={getObra(approvingCot)}
                    onClose={() => setApproving(null)}
                    onApprove={(extra) => createInvoiceFromCotizacion(approving, extra)}
                />
            )}

            {/* Share Modal */}
            {sharing && <ShareModal cotId={sharing} onClose={() => setSharing(null)} />}

            {showNew && (
                <ModalErrorBoundary onClose={() => setShowNew(false)}>
                    <NuevaCotizacionModal 
                        onClose={() => setShowNew(false)} 
                        onSave={async (data) => {
                            const newCot = await addCotizacion(data);
                            setShowNew(false);
                            if (newCot && newCot.id) {
                                setApproving(newCot.id);
                            }
                        }} 
                        clients={clients} 
                        products={products} 
                    />
                </ModalErrorBoundary>
            )}
            {editing && (
                <ModalErrorBoundary onClose={() => setEditing(null)}>
                    <NuevaCotizacionModal initialData={editing} onClose={() => setEditing(null)} onSave={(data) => updateCotizacion(editing.id, data)} clients={clients} products={products} />
                </ModalErrorBoundary>
            )}

            {/* Verify Dispatch Modal */}
            {showVerifyModal && verifyTarget && (
                <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.75)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1200, padding: '1rem' }}>
                    <div style={{ background: 'white', borderRadius: 16, maxWidth: 440, width: '100%', overflow: 'hidden', boxShadow: '0 20px 40px rgba(0,0,0,0.3)' }}>
                        <div style={{ background: 'linear-gradient(135deg,#2365AB,#104166)', padding: '1.25rem 1.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                                <Truck size={20} color="white" />
                                <div>
                                    <div style={{ fontWeight: 800, color: 'white', fontSize: '1rem' }}>Confirmar Despacho</div>
                                    <div style={{ fontSize: '0.72rem', color: 'rgba(255,255,255,0.75)', marginTop: 1 }}>{verifyTarget.id}</div>
                                </div>
                            </div>
                            <button onClick={() => { setShowVerifyModal(false); setVerifyTarget(null); }} style={{ background: 'rgba(255,255,255,0.15)', border: 'none', borderRadius: 8, color: 'white', cursor: 'pointer', padding: '0.3rem', display: 'flex' }}><X size={18} /></button>
                        </div>
                        <div style={{ padding: '1.5rem' }}>
                            <div style={{ background: '#f0f9ff', border: '1px solid #bae6fd', borderRadius: 10, padding: '0.85rem', marginBottom: '1.25rem', fontSize: '0.82rem', color: '#0c4a6e', display: 'flex', gap: 10, alignItems: 'flex-start' }}>
                                <AlertTriangle size={16} style={{ flexShrink: 0, marginTop: 1 }} />
                                <span>Al finalizar el despacho, la remisión pasará a estado <strong>Activa</strong> y se generará el PDF para el cliente. Esta acción no se puede deshacer.</span>
                            </div>

                            <div style={{ marginBottom: '1.25rem' }}>
                                <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 800, color: '#475569', textTransform: 'uppercase', marginBottom: '0.5rem' }}>Fecha Inicial del Despacho</label>
                                <input 
                                    type="date" 
                                    value={fechaInicioRemision} 
                                    onChange={(e) => setFechaInicioRemision(e.target.value)}
                                    style={{ width: '100%', padding: '0.75rem', borderRadius: 8, border: '1px solid #cbd5e1', fontSize: '0.9rem', color: '#1e293b' }}
                                />
                                <div style={{ fontSize: '0.7rem', color: '#64748b', marginTop: 4 }}>Esta fecha se usará para iniciar el cálculo de cobro en facturación.</div>
                            </div>
                            <div style={{ background: '#f8fafc', borderRadius: 8, padding: '0.75rem', marginBottom: '1.25rem' }}>
                                {(verifyTarget.items || []).map((it, i) => (
                                    <div key={i} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', padding: '0.25rem 0', borderBottom: '1px solid #f1f5f9' }}>
                                        <span style={{ color: '#374151' }}>{it.nombre || it.productoId}</span>
                                        <span style={{ fontWeight: 700, color: '#2365AB' }}>{it.cantidad} u.</span>
                                    </div>
                                ))}
                            </div>
                            <div style={{ display: 'flex', gap: '0.75rem' }}>
                                <button onClick={() => { setShowVerifyModal(false); setVerifyTarget(null); }} style={{ flex: 1, padding: '0.75rem', borderRadius: 10, background: '#f1f5f9', border: '1px solid #e2e8f0', fontWeight: 700, cursor: 'pointer', color: '#64748b' }}>Cancelar</button>
                                <button onClick={handleConfirmFinalDispatch} style={{ flex: 2, padding: '0.75rem', borderRadius: 10, background: 'linear-gradient(135deg,#2365AB,#104166)', border: 'none', color: 'white', fontWeight: 800, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
                                    <Truck size={16} /> Confirmar y Activar
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}


            {/* Pay Invoice Modal */}
            {payingInvoice && (
                <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.8)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1100, padding: '1rem' }}>
                    <div className="glass-panel" style={{ maxWidth: 460, width: '100%', padding: 0, overflow: 'hidden', background: 'white', borderRadius: 16 }}>
                        {/* Header */}
                        <div style={{ background: 'linear-gradient(135deg,#10b981,#059669)', padding: '1.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                                <div style={{ background: 'rgba(255,255,255,0.2)', width: 40, height: 40, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                    <DollarSign size={20} color="white" />
                                </div>
                                <div>
                                    <div style={{ fontWeight: 800, color: 'white', fontSize: '1.1rem' }}>Registrar Pago</div>
                                    <div style={{ fontSize: '0.75rem', color: 'rgba(255,255,255,0.8)', marginTop: 2, fontWeight: 500 }}>Factura {payingInvoice.id.replace('INV-', 'F-').replace('INC-', 'F-')}</div>
                                </div>
                            </div>
                            <button onClick={() => setPayingInvoice(null)} style={{ background: 'rgba(255,255,255,0.2)', border: 'none', borderRadius: '50%', width: 32, height: 32, color: 'white', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><X size={18} /></button>
                        </div>

                        <div style={{ padding: '1.75rem' }}>
                            {/* Amount Box */}
                            <div style={{ background: 'rgba(16,185,129,0.05)', border: '1px solid rgba(16,185,129,0.2)', borderRadius: 12, padding: '1.25rem', marginBottom: '1.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                <span style={{ fontWeight: 700, color: '#15803d', fontSize: '0.9rem' }}>Monto a Cobrar</span>
                                <span style={{ fontSize: '1.7rem', fontWeight: 900, color: '#10b981' }}>${payingInvoice.amount.toLocaleString()}</span>
                            </div>

                            {/* Payment Options */}
                            <div style={{ marginBottom: '1.5rem' }}>
                                <label style={{ display: 'block', fontSize: '0.7rem', fontWeight: 800, color: '#64748b', marginBottom: '0.6rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Opciones de Pago</label>
                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '0.5rem' }}>
                                    {[
                                        { id: 'Contado', label: 'Contado', icon: <CheckCircle size={16} /> },
                                        { id: 'Abono', label: 'Abono', icon: <DollarSign size={16} /> },
                                        { id: 'Credito', label: 'Crédito', icon: <Clock size={16} /> }
                                    ].map(opt => (
                                        <button
                                            key={opt.id}
                                            onClick={() => {
                                                setPaymentOption(opt.id);
                                                const pending = payingInvoice.amount - (payingInvoice.paidAmount || 0);
                                                if (opt.id === 'Contado') setAbonoAmount(pending);
                                                if (opt.id === 'Abono') setAbonoAmount(pending);
                                                if (opt.id === 'Credito') setAbonoAmount(0);
                                            }}
                                            style={{
                                                padding: '0.6rem', borderRadius: 10, border: '1px solid',
                                                borderColor: paymentOption === opt.id ? '#10b981' : '#e2e8f0',
                                                background: paymentOption === opt.id ? '#f0fdf4' : 'white',
                                                color: paymentOption === opt.id ? '#15803d' : '#64748b',
                                                fontWeight: 700, fontSize: '0.8rem', cursor: 'pointer',
                                                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.4rem', transition: 'all 0.2s'
                                            }}
                                        >
                                            {opt.icon} {opt.label}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            {paymentOption === 'Abono' && (
                                <div style={{ marginBottom: '1.5rem' }} className="animate-slide-down">
                                    <label style={{ display: 'block', fontSize: '0.7rem', fontWeight: 800, color: '#64748b', marginBottom: '0.6rem', textTransform: 'uppercase' }}>Valor del Abono</label>
                                    <div style={{ position: 'relative' }}>
                                        <DollarSign size={16} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: '#64748b' }} />
                                        <input 
                                            type="text" 
                                            value={abonoAmount ? Number(abonoAmount).toLocaleString('es-CO') : ''} 
                                            onChange={e => {
                                                // Remove everything that is not a digit
                                                const rawValue = e.target.value.replace(/\D/g, '');
                                                setAbonoAmount(rawValue);
                                            }}
                                            placeholder="0"
                                            style={{ width: '100%', padding: '0.75rem 0.75rem 0.75rem 2.5rem', borderRadius: 10, border: '1px solid #e2e8f0', fontSize: '0.95rem', fontWeight: 700, color: '#1e293b', outline: 'none', boxSizing: 'border-box' }} 
                                        />
                                    </div>
                                </div>
                            )}

                            {paymentOption !== 'Credito' && (
                                <div style={{ marginBottom: '1.5rem' }}>
                                    <label style={{ display: 'block', fontSize: '0.7rem', fontWeight: 800, color: '#64748b', marginBottom: '0.6rem', textTransform: 'uppercase' }}>Método</label>
                                    <select value={paymentMethod} onChange={e => setPaymentMethod(e.target.value)} style={{ width: '100%', padding: '0.75rem', borderRadius: 10, border: '1px solid #e2e8f0', fontSize: '0.9rem', fontWeight: 600, color: '#1e293b', background: 'white', outline: 'none' }}>
                                        <option value="Transferencia">Transferencia Bancaria</option>
                                        <option value="Efectivo">Efectivo</option>
                                        <option value="Tarjeta">Tarjeta</option>
                                        <option value="Cheque">Cheque</option>
                                    </select>
                                </div>
                            )}

                            {/* Info note */}
                            <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 10, padding: '0.85rem', marginBottom: '1.5rem', fontSize: '0.8rem', color: '#64748b', lineHeight: 1.5, display: 'flex', gap: 10 }}>
                                <Clock size={16} style={{ flexShrink: 0, marginTop: 2 }} />
                                <span>
                                    {paymentOption === 'Contado' && 'Al confirmar, la factura se marcará como PAGADA totalmente.'}
                                    {paymentOption === 'Abono' && `Se registrará un abono de $${Number(abonoAmount).toLocaleString()} y la factura quedará como ABONADA.`}
                                    {paymentOption === 'Credito' && 'La factura quedará pendiente de pago pero habilitada para despacho.'}
                                </span>
                            </div>

                            <div style={{ display: 'flex', gap: '0.75rem' }}>
                                <button onClick={() => setPayingInvoice(null)} className="btn btn-secondary" style={{ flex: 1, padding: '0.8rem', borderRadius: 10, fontWeight: 700 }}>Cancelar</button>
                                <button
                                    onClick={async () => { 
                                        const finalAmount = paymentOption === 'Contado' ? payingInvoice.amount : (paymentOption === 'Credito' ? 0 : Number(abonoAmount));
                                        await payInvoice?.(payingInvoice.id, finalAmount, paymentOption); 
                                        setPayingInvoice(null); 
                                        // Redirigir a remisiones para despacho inmediato
                                        navigate('/comercial?tab=despachos');
                                    }}
                                    className="btn btn-primary"
                                    style={{ flex: 2, background: '#10b981', border: 'none', color: 'white', fontWeight: 800, fontSize: '0.95rem', borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, boxShadow: '0 4px 12px rgba(16,185,129,0.3)' }}
                                >
                                    <CheckCircle size={18} /> Confirmar {paymentOption}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Modal de Devolución */}
            {devolucionTarget && (
                <DevolucionModal 
                    clientId={devolucionTarget.clientId}
                    obraId={devolucionTarget.obraId}
                    onClose={() => setDevolucionTarget(null)}
                    onSave={(devs, fecha) => {
                        registrarDevolucion(devolucionTarget.clientId, devolucionTarget.obraId, devs, fecha);
                        Swal.fire({
                            title: '¡Devolución Exitosa!',
                            text: 'Los equipos han reingresado al inventario.',
                            icon: 'success',
                            confirmButtonColor: '#2365AB'
                        });
                    }}
                    remisiones={remisiones}
                    products={products}
                    clients={clients}
                />
            )}
            {/* Nuevo Modal de Corte de Obra */}
            {showCorteModal && (
                <CorteObraModal 
                    initialClientId={corteModalParams.clientId}
                    initialObraId={corteModalParams.obraId}
                    onClose={() => setShowCorteModal(false)}
                />
            )}

        </>
    );
}
