import React, { useState, useMemo } from 'react';
import { FileText, Plus, Eye, Filter, Download, Trash2, ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight, User, Package, CheckCircle, CreditCard, DollarSign, AlertCircle, ArrowRight, ArrowUp, ArrowDown, ChevronDown } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useAppContext } from '../context/AppContext';
import { format, parseISO } from 'date-fns';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { applyStandardLayout, drawInfoGrid } from './pdfTheme';

export default function Invoices() {
    const { invoices, clients, products, settings, createInvoice, payInvoice, deleteInvoice } = useAppContext();
    const navigate = useNavigate();

    // New Invoice Modal
    const [showModal, setShowModal] = useState(false);
    const [step, setStep] = useState(1); // Step 1: Client, Step 2: Items
    const [clientId, setClientId] = useState('');
    const [cart, setCart] = useState([]);
    const [selectedProduct, setSelectedProduct] = useState('');
    const [selectedQuantity, setSelectedQuantity] = useState(1);
    const [selectedDays, setSelectedDays] = useState(1);

    // View Invoice Modal
    const [showViewModal, setShowViewModal] = useState(false);
    const [viewingInvoice, setViewingInvoice] = useState(null);

    // Pay Invoice Modal
    const [showPayModal, setShowPayModal] = useState(false);
    const [payingInvoice, setPayingInvoice] = useState(null);
    const [paymentMethod, setPaymentMethod] = useState('Transferencia');

    // Filters
    const [filterClient, setFilterClient] = useState('');
    const [filterObra, setFilterObra] = useState('');
    const [filterStatus, setFilterStatus] = useState('');
    const [sortConfig, setSortConfig] = useState({ key: 'date', direction: 'desc' });
    const [currentPage, setCurrentPage] = useState(1);
    const [itemsPerPage, setItemsPerPage] = useState(10);

    const subtotal = cart.reduce((acc, item) => acc + (item.quantity * item.days * item.price), 0);
    const selectedClientData = clients.find(c => c.id === clientId);
    const iva = selectedClientData?.responsableIVA ? Math.round(subtotal * (selectedClientData?.porcIVA || 0) / 100) : 0;
    const ret = Math.round(subtotal * (selectedClientData?.porcRetencion || 0) / 100);
    const currentTotal = subtotal + iva + ret;

    const filteredInvoices = useMemo(() => {
        return invoices.filter(invoice => {
            const client = clients.find(c => c.id === invoice.clientId);
            if (!client) return false;
            const matchClient = filterClient ? client.id === filterClient : true;
            const matchObra = filterObra ? client.obra === filterObra : true;
            const matchStatus = filterStatus ? invoice.status === filterStatus : true;
            return matchClient && matchObra && matchStatus;
        });
    }, [invoices, clients, filterClient, filterObra, filterStatus]);

    const sortedInvoices = useMemo(() => {
        let sortable = [...filteredInvoices];
        if (sortConfig.key) {
            sortable.sort((a, b) => {
                let vA, vB;
                const clientA = clients.find(c => c.id === a.clientId);
                const clientB = clients.find(c => c.id === b.clientId);

                switch (sortConfig.key) {
                    case 'id': vA = a.id; vB = b.id; break;
                    case 'origin': vA = a.cotizacionId || 'Manual'; vB = b.cotizacionId || 'Manual'; break;
                    case 'client': vA = clientA?.name || ''; vB = clientB?.name || ''; break;
                    case 'obra': vA = clientA?.obra || ''; vB = clientB?.obra || ''; break;
                    case 'amount': vA = a.amount; vB = b.amount; break;
                    case 'date': vA = a.date; vB = b.date; break;
                    case 'status': vA = a.status; vB = b.status; break;
                    default: vA = a[sortConfig.key]; vB = b[sortConfig.key];
                }

                if (vA < vB) return sortConfig.direction === 'asc' ? -1 : 1;
                if (vA > vB) return sortConfig.direction === 'asc' ? 1 : -1;
                return 0;
            });
        }
        return sortable;
    }, [filteredInvoices, sortConfig, clients]);

    const paginatedInvoices = useMemo(() => {
        const start = (currentPage - 1) * itemsPerPage;
        return sortedInvoices.slice(start, start + itemsPerPage);
    }, [sortedInvoices, currentPage, itemsPerPage]);

    const totalPages = Math.ceil(sortedInvoices.length / itemsPerPage);

    const requestSort = (key) => {
        let direction = 'asc';
        if (sortConfig.key === key && sortConfig.direction === 'asc') {
            direction = 'desc';
        }
        setSortConfig({ key, direction });
        setCurrentPage(1);
    };

    const uniqueObras = [...new Set(clients.map(c => c.obra).filter(Boolean))];

    const handleAddToCart = () => {
        if (selectedProduct && selectedQuantity > 0 && selectedDays > 0) {
            const product = products.find(p => p.id === selectedProduct);
            if (product && product.availableStock >= selectedQuantity) {
                setCart([...cart, {
                    productId: product.id,
                    name: product.name,
                    quantity: selectedQuantity,
                    days: selectedDays,
                    price: product.value
                }]);
                setSelectedProduct('');
                setSelectedQuantity(1);
                setSelectedDays(1);
            } else {
                alert(`Stock insuficiente. Solo hay ${product?.availableStock || 0} unidades disponibles.`);
            }
        }
    };

    const handleRemoveFromCart = (index) => {
        setCart(cart.filter((_, i) => i !== index));
    };

    const handleCreate = () => {
        if (clientId && cart.length > 0) {
            createInvoice({
                clientId,
                items: cart.map(c => ({ productId: c.productId, quantity: c.quantity, days: c.days, price: c.price }))
            });
            setShowModal(false);
            setStep(1);
            setClientId('');
            setCart([]);
        }
    };

    const handleOpenNew = () => {
        setStep(1);
        setClientId('');
        setCart([]);
        setShowModal(true);
    };

    const handleViewInvoice = (invoice) => {
        setViewingInvoice(invoice);
        setShowViewModal(true);
    };

    const handleOpenPayModal = (invoice) => {
        setPayingInvoice(invoice);
        setPaymentMethod('Transferencia');
        setShowPayModal(true);
    };

    const handleConfirmPayment = () => {
        if (payingInvoice) {
            payInvoice(payingInvoice.id);
            // If we're viewing this invoice in the view modal, update the reference
            if (viewingInvoice && viewingInvoice.id === payingInvoice.id) {
                setViewingInvoice({ ...viewingInvoice, status: 'Paid' });
            }
            setShowPayModal(false);
            setPayingInvoice(null);
        }
    };

    const generatePDF = (invoice) => {
        const client = clients.find(c => c.id === invoice.clientId);
        const doc = new jsPDF();
        const pageWidth = doc.internal.pageSize.getWidth();
        const margin = 10;

        let y = applyStandardLayout(doc, 'Factura', settings, invoice.id);

        y = drawInfoGrid(doc, y, client, {
            valTopLeft: invoice.date,
            valTopRight: invoice.status === 'Paid' ? 'PAGADA' : 'PENDIENTE',
            labelTopLeft: 'Fecha Emisión',
            labelTopRight: 'Estado Pago',
            valMidLeft: client?.obra || '—',
            valMidRight: 'CONTADO',
            valBottom: (Number(invoice.transporte) || 0) > 0 ? `$${invoice.transporte.toLocaleString()}` : '0',
            labelBottom: 'Valor Transporte:',
            obraDireccion: client?.obraUbicacion || client?.direccion
        });

        autoTable(doc, {
            startY: y,
            margin: { left: margin, right: margin },
            head: [['ITE', 'EQUIPO / DESCRIPCIÓN', 'CANT.', 'DÍAS', 'TAR./DÍA', 'VR. TOTAL']],
            body: (invoice.items || []).map((item, idx) => {
                const productName = item.nombre || products.find(p => p.id === item.productId)?.name || 'EQUIPO';
                const qty = Number(item.quantity || item.cantidad || 0);
                const days = Number(item.days || item.dias || 1);
                const price = Number(item.price || item.tarifaDia || 0);
                
                return [
                    idx + 1,
                    productName.toUpperCase(),
                    qty,
                    days,
                    price.toLocaleString('es-CO'),
                    (qty * days * price).toLocaleString('es-CO')
                ];
            }),
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
                0: { cellWidth: 10 },
                1: { halign: 'left', cellWidth: 'auto' },
                2: { cellWidth: 15 },
                3: { cellWidth: 15 },
                4: { halign: 'right', cellWidth: 25 },
                5: { halign: 'right', cellWidth: 30, fontStyle: 'bold' }
            }
        });

        try {
            // --- Totales Estilo Profesional (Recuadros) ---
            const subtotal = (invoice.items || []).reduce((s, item) => {
                const qty = Number(item.quantity || item.cantidad || 0);
                const days = Number(item.days || item.dias || 1);
                const price = Number(item.price || item.tarifaDia || 0);
                return s + (qty * days * price);
            }, 0);

            const porcIVA = client?.responsableIVA ? (client?.porcIVA || 0) : 0;
            const iva = Math.round(subtotal * porcIVA / 100);
            const porcRet = client?.porcRetencion || 0;
            const ret = Math.round(subtotal * porcRet / 100);
            const totalVal = subtotal + iva + ret + (Number(invoice.transporte) || 0);

            let ty = (doc.lastAutoTable?.finalY || y + 20) + 10;
            const totW = 80;
            const totX = pageWidth - margin - totW;
            const totH = 7;

            const totals = [
                ['SUB-TOTAL', subtotal.toLocaleString('es-CO')],
                [`IVA (${porcIVA}%)`, iva.toLocaleString('es-CO')],
                [`RETENCIÓN (${porcRet}%)`, ret.toLocaleString('es-CO')],
                ['TRANSPORTE', (Number(invoice.transporte) || 0).toLocaleString('es-CO')]
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
            doc.text('TOTAL', totX + 2, ty + 6);
            doc.text(`$${totalVal.toLocaleString('es-CO')}`, totX + 78, ty + 6, { align: 'right' });
            
            y = ty + 20;
        } catch (err) {
            console.error('Error in total calculation or summary:', err);
        }

        // --- Signature / Stamp ---
        const pageHeight = doc.internal.pageSize.getHeight();
        const signatureY = Math.max(pageHeight - 50, y + 30);

        if (invoice.status === 'Paid') {
            doc.setFontSize(22);
            doc.setTextColor(16, 185, 129);
            doc.setFont(undefined, 'bold');
            doc.setGState(new doc.GState({ opacity: 0.2 }));
            doc.text('PAGADA', margin, y + 10);
            doc.setGState(new doc.GState({ opacity: 1 }));
        }

        doc.setFontSize(8);
        doc.setTextColor(100, 116, 139);
        doc.setFont(undefined, 'normal');
        doc.text('Firma Recibido:', margin, signatureY);
        doc.line(margin, signatureY + 2, margin + 50, signatureY + 2);

        doc.save(`Factura_${invoice.id}.pdf`);
    };

    const handleGenerateReport = () => {
        const doc = new jsPDF('p', 'pt', 'letter');
        const pageWidth = doc.internal.pageSize.getWidth();
        const margin = 40;

        let y = applyStandardLayout(doc, 'Reporte de Facturación', settings);

        const tableData = filteredInvoices.map(inv => {
            const client = clients.find(c => c.id === inv.clientId);
            return [inv.id, inv.date, client?.name || 'N/A', client?.obra || '-', inv.status === 'Paid' ? 'Pagada' : 'Pendiente', `$${inv.amount.toLocaleString()}`];
        });

        const totalAmount = filteredInvoices.reduce((acc, inv) => acc + inv.amount, 0);

        autoTable(doc, {
            startY: 90,
            margin: { left: margin, right: margin },
            headStyles: { fillColor: [59, 130, 246], textColor: 255, fontStyle: 'bold' },
            head: [['Factura', 'Fecha', 'Cliente', 'Obra', 'Estado', 'Monto']],
            body: tableData,
            bodyStyles: { fontSize: 10, textColor: [30, 41, 59] },
            alternateRowStyles: { fillColor: [248, 250, 252] },
            foot: [['', '', '', '', 'TOTAL', `$${totalAmount.toLocaleString()}`]],
            footStyles: { fillColor: [241, 245, 249], textColor: [30, 41, 59], fontStyle: 'bold' }
        });

        doc.save(`Reporte_Facturacion_${settings?.shortName || 'CIELO'}.pdf`);
    };

    return (
        <>
            {/* Header */}
            <div className="flex justify-between items-center mb-6">
                <div>
                    <h1>Facturación</h1>
                    <p className="text-muted">Gestión de cobros y facturas de alquiler</p>
                </div>
                <div className="flex gap-4">
                    <button className="btn btn-secondary" onClick={handleGenerateReport}>
                        <Download size={20} /> Reporte
                    </button>
                    <button className="btn btn-primary" onClick={handleOpenNew}>
                        <Plus size={20} /> Crear Factura
                    </button>
                </div>
            </div>

            {/* Filters */}
            <div className="glass-panel p-6 mb-6 flex items-center justify-between">
                <div className="flex items-center gap-4">
                    <Filter size={18} style={{ color: 'var(--text-muted)' }} />
                    <span style={{ fontWeight: 600, color: 'var(--text-secondary)', fontSize: '0.9rem' }}>Filtros:</span>
                </div>
                <div className="flex gap-4">
                    <select className="input-base" style={{ width: '190px' }} value={filterStatus} onChange={e => setFilterStatus(e.target.value)}>
                        <option value="">Todos los Estados</option>
                        <option value="Pending">⏳ Pendiente</option>
                        <option value="Paid">✅ Pagada</option>
                    </select>
                    <select className="input-base" style={{ width: '190px' }} value={filterClient} onChange={e => setFilterClient(e.target.value)}>
                        <option value="">Todos los Clientes</option>
                        {clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                    </select>
                    <select className="input-base" style={{ width: '190px' }} value={filterObra} onChange={e => setFilterObra(e.target.value)}>
                        <option value="">Todas las Obras</option>
                        {uniqueObras.map((obra, idx) => <option key={idx} value={obra}>{obra}</option>)}
                    </select>
                </div>
            </div>

            {/* Invoices Table */}
            <div className="glass-panel p-6">
                <div className="glass-table-container">
                    <table className="glass-table">
                        <thead>
                            <tr>
                                {[
                                    { label: 'No. Factura', key: 'id' },
                                    { label: 'Cliente', key: 'client' },
                                    { label: 'Obra/Proyecto', key: 'obra' },
                                    { label: 'Monto Total', key: 'amount' },
                                    { label: 'Fecha Emisión', key: 'date' },
                                    { label: 'Estado', key: 'status' }
                                ].map(head => (
                                    <th 
                                        key={head.key} 
                                        onClick={() => requestSort(head.key)}
                                        style={{ cursor: 'pointer', userSelect: 'none' }}
                                    >
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                                            {head.label}
                                            {sortConfig.key === head.key ? (
                                                sortConfig.direction === 'asc' ? <ArrowUp size={14} /> : <ArrowDown size={14} />
                                            ) : (
                                                <div style={{ width: 14, height: 14, opacity: 0.2 }}>
                                                    <ArrowUp size={14} />
                                                </div>
                                            )}
                                        </div>
                                    </th>
                                ))}
                                <th style={{ textAlign: 'center', whiteSpace: 'nowrap', width: '320px' }}>Acciones</th>
                            </tr>
                        </thead>
                        <tbody>
                            {paginatedInvoices.map(invoice => {
                                const client = clients.find(c => c.id === invoice.clientId);
                                return (
                                    <tr key={invoice.id}>
                                        <td style={{ fontWeight: 600, color: 'var(--primary)' }}>{invoice.id}</td>
                                        <td style={{ fontWeight: 600 }}>{client?.name || 'N/A'}</td>
                                        <td className="text-muted">{client?.obra || '-'}</td>
                                        <td style={{ fontWeight: 700 }}>${invoice.amount.toLocaleString()}</td>
                                        <td className="text-muted" style={{ fontSize: '0.85rem' }}>
                                            {invoice.date ? format(parseISO(invoice.date), 'dd/MM/yy') : '—'}
                                        </td>
                                        <td>
                                            <span className={`badge ${invoice.status === 'Paid' ? 'badge-success' : 'badge-warning'}`}
                                                style={invoice.status === 'Pending' ? { background: 'rgba(245, 158, 11, 0.2)', color: '#fbbf24', border: '1px solid rgba(245, 158, 11, 0.3)' } : {}}>
                                                {invoice.status === 'Paid' ? 'Pagada' : 'Pendiente'}
                                            </span>
                                        </td>
                                        <td>
                                            <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', whiteSpace: 'nowrap' }}>
                                                <button className="btn btn-secondary btn-sm" onClick={() => handleViewInvoice(invoice)} title="Ver Factura">
                                                    <Eye size={15} /> Ver
                                                </button>
                                                <button className="btn btn-primary btn-sm" onClick={() => generatePDF(invoice)} title="Descargar PDF">
                                                    <Download size={15} /> PDF
                                                </button>
                                                {invoice.status === 'Pending' && (
                                                    <button
                                                        className="btn btn-sm"
                                                        style={{ background: '#10b981', color: 'white', boxShadow: '0 4px 14px rgba(16,185,129,0.3)' }}
                                                        onClick={() => handleOpenPayModal(invoice)}
                                                        title="Registrar Pago"
                                                    >
                                                        <CreditCard size={15} /> Pagar
                                                    </button>
                                                )}
                                                {invoice.status === 'Paid' && (
                                                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.3rem', fontSize: '0.78rem', color: '#10b981', fontWeight: 600, padding: '0.4rem 0.6rem' }}>
                                                        <CheckCircle size={14} /> Pagada
                                                    </span>
                                                )}
                                                {invoice.status === 'Paid' && invoice.remisionEnabled && !invoice.remisionCreada && (
                                                    <button
                                                        onClick={() => navigate('/remisiones')}
                                                        style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem', padding: '0.4rem 0.8rem', borderRadius: 8, background: 'linear-gradient(135deg,#10b981,#059669)', color: 'white', border: 'none', cursor: 'pointer', fontWeight: 700, fontSize: '0.78rem', boxShadow: '0 2px 8px rgba(16,185,129,0.35)' }}
                                                        title="Ir a Remisiones para despachar">
                                                        <ArrowRight size={14} /> Pasar a Remisión
                                                    </button>
                                                )}
                                            </div>
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>

                {/* Pagination */}
                <div className="flex justify-between items-center mt-6 py-4 px-2" style={{ borderTop: '1px solid var(--surface-border)' }}>
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
                            Mostrando {sortedInvoices.length > 0 ? (currentPage - 1) * itemsPerPage + 1 : 0} a {Math.min(currentPage * itemsPerPage, sortedInvoices.length)} de {sortedInvoices.length} registros
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

            {/* ===================== NEW INVOICE MODAL ===================== */}
            {showModal && (
                <div className="modal-overlay">
                    <div className="modal-content fadeIn" style={{ maxWidth: '680px', padding: '0' }}>

                        {/* Modal Header with Steps */}
                        <div style={{ padding: '1.75rem 2rem 1.25rem', borderBottom: '1px solid var(--surface-border)' }}>
                            <h3 style={{ fontSize: '1.3rem', fontWeight: 700, marginBottom: '1.25rem' }}>Generar Orden de Alquiler</h3>
                            <div className="flex items-center gap-2">
                                {/* Step 1 */}
                                <div className="flex items-center gap-2">
                                    <div style={{
                                        width: 30, height: 30, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center',
                                        fontWeight: 700, fontSize: '0.85rem',
                                        background: step >= 1 ? 'var(--primary)' : 'var(--surface-border)',
                                        color: step >= 1 ? 'white' : 'var(--text-muted)'
                                    }}>
                                        {step > 1 ? <CheckCircle size={16} /> : '1'}
                                    </div>
                                    <span style={{ fontSize: '0.875rem', fontWeight: step === 1 ? 700 : 500, color: step === 1 ? 'var(--primary)' : 'var(--text-muted)' }}>Datos del Cliente</span>
                                </div>
                                <div style={{ flex: 1, height: 2, background: step >= 2 ? 'var(--primary)' : 'var(--surface-border)', borderRadius: 4, margin: '0 0.5rem' }} />
                                {/* Step 2 */}
                                <div className="flex items-center gap-2">
                                    <div style={{
                                        width: 30, height: 30, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center',
                                        fontWeight: 700, fontSize: '0.85rem',
                                        background: step >= 2 ? 'var(--primary)' : 'var(--surface-border)',
                                        color: step >= 2 ? 'white' : 'var(--text-muted)'
                                    }}>2</div>
                                    <span style={{ fontSize: '0.875rem', fontWeight: step === 2 ? 700 : 500, color: step === 2 ? 'var(--primary)' : 'var(--text-muted)' }}>Equipos y Resumen</span>
                                </div>
                            </div>
                        </div>

                        <div style={{ padding: '1.75rem 2rem' }}>
                            {/* ---- STEP 1 ---- */}
                            {step === 1 && (
                                <div>
                                    <div className="input-group">
                                        <label className="input-label">Seleccionar Cliente</label>
                                        <select className="input-base" value={clientId} onChange={e => setClientId(e.target.value)}>
                                            <option value="">— Seleccionar Cliente —</option>
                                            {clients.map(c => (
                                                <option key={c.id} value={c.id}>{c.name}</option>
                                            ))}
                                        </select>
                                    </div>

                                    {selectedClientData && (
                                        <div style={{ background: 'rgba(35, 101, 171,0.06)', border: '1px solid rgba(35, 101, 171,0.2)', borderRadius: 12, padding: '1.25rem', marginTop: '0.5rem' }}>
                                            <div className="flex items-center gap-3 mb-3">
                                                <div style={{ width: 40, height: 40, borderRadius: '50%', background: 'rgba(35, 101, 171,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--primary)' }}>
                                                    <User size={20} />
                                                </div>
                                                <div>
                                                    <div style={{ fontWeight: 700, color: 'var(--text-primary)' }}>{selectedClientData.name}</div>
                                                    <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>{selectedClientData.id}</div>
                                                </div>
                                            </div>
                                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem', fontSize: '0.875rem' }}>
                                                <div><span style={{ color: 'var(--text-muted)' }}>Obra:</span> <strong>{selectedClientData.obra || 'N/A'}</strong></div>
                                                <div><span style={{ color: 'var(--text-muted)' }}>Email:</span> <strong>{selectedClientData.email}</strong></div>
                                                <div><span style={{ color: 'var(--text-muted)' }}>Teléfono:</span> <strong>{selectedClientData.phone}</strong></div>
                                                <div>
                                                    <span style={{ color: 'var(--text-muted)' }}>Deuda actual:</span>{' '}
                                                    <strong style={{ color: selectedClientData.debt > 0 ? '#ef4444' : '#10b981' }}>
                                                        {selectedClientData.debt > 0 ? `$${selectedClientData.debt.toLocaleString()}` : 'Sin deuda'}
                                                    </strong>
                                                </div>
                                            </div>
                                        </div>
                                    )}

                                    <div className="modal-actions">
                                        <button className="btn btn-secondary" onClick={() => setShowModal(false)}>Cancelar</button>
                                        <button className="btn btn-primary" disabled={!clientId} onClick={() => setStep(2)}>
                                            Siguiente <ChevronRight size={18} />
                                        </button>
                                    </div>
                                </div>
                            )}

                            {/* ---- STEP 2 ---- */}
                            {step === 2 && (
                                <div>
                                    {/* Client Summary Bar */}
                                    <div style={{ background: 'rgba(35, 101, 171,0.06)', border: '1px solid rgba(35, 101, 171,0.2)', borderRadius: 10, padding: '0.75rem 1rem', marginBottom: '1.25rem', display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                                        <User size={16} style={{ color: 'var(--primary)' }} />
                                        <span style={{ fontSize: '0.9rem', fontWeight: 600 }}>{selectedClientData?.name}</span>
                                        <span style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>— {selectedClientData?.obra || 'Sin obra'}</span>
                                    </div>

                                    {/* Add Item Row */}
                                    <div style={{ background: 'var(--background)', border: '1px solid var(--surface-border)', borderRadius: 12, padding: '1rem', marginBottom: '1rem' }}>
                                        <div style={{ fontWeight: 600, fontSize: '0.9rem', color: 'var(--text-secondary)', marginBottom: '0.75rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                            <Package size={16} /> Agregar Equipo
                                        </div>
                                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 80px 80px auto', gap: '0.5rem', alignItems: 'end' }}>
                                            <div>
                                                <label className="input-label" style={{ fontSize: '0.78rem' }}>Equipo / Herramienta</label>
                                                <select className="input-base" value={selectedProduct} onChange={e => setSelectedProduct(e.target.value)}>
                                                    <option value="">Seleccionar...</option>
                                                    {products.filter(p => p.availableStock > 0).map(p => (
                                                        <option key={p.id} value={p.id}>{p.name} (Disp: {p.availableStock} | ${p.value.toLocaleString()}/día)</option>
                                                    ))}
                                                </select>
                                            </div>
                                            <div>
                                                <label className="input-label" style={{ fontSize: '0.78rem' }}>Cant.</label>
                                                <input type="number" min="1" className="input-base" value={selectedQuantity} onChange={e => setSelectedQuantity(parseInt(e.target.value) || 1)} />
                                            </div>
                                            <div>
                                                <label className="input-label" style={{ fontSize: '0.78rem' }}>Días</label>
                                                <input type="number" min="1" className="input-base" value={selectedDays} onChange={e => setSelectedDays(parseInt(e.target.value) || 1)} />
                                            </div>
                                            <button className="btn btn-primary btn-sm" onClick={handleAddToCart} style={{ alignSelf: 'flex-end', whiteSpace: 'nowrap', height: '42px' }}>
                                                <Plus size={16} /> Agregar
                                            </button>
                                        </div>
                                    </div>

                                    {/* Cart Items */}
                                    {cart.length > 0 ? (
                                        <div style={{ border: '1px solid var(--surface-border)', borderRadius: 12, overflow: 'hidden', marginBottom: '1rem' }}>
                                            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.875rem' }}>
                                                <thead>
                                                    <tr style={{ background: 'rgba(0,0,0,0.03)', borderBottom: '1px solid var(--surface-border)' }}>
                                                        <th style={{ padding: '0.6rem 1rem', textAlign: 'left', color: 'var(--text-muted)', fontWeight: 600, fontSize: '0.75rem', textTransform: 'uppercase' }}>Equipo</th>
                                                        <th style={{ padding: '0.6rem', textAlign: 'center', color: 'var(--text-muted)', fontWeight: 600, fontSize: '0.75rem', textTransform: 'uppercase' }}>Cant.</th>
                                                        <th style={{ padding: '0.6rem', textAlign: 'center', color: 'var(--text-muted)', fontWeight: 600, fontSize: '0.75rem', textTransform: 'uppercase' }}>Días</th>
                                                        <th style={{ padding: '0.6rem', textAlign: 'right', color: 'var(--text-muted)', fontWeight: 600, fontSize: '0.75rem', textTransform: 'uppercase' }}>Subtotal</th>
                                                        <th style={{ padding: '0.6rem', width: 40 }}></th>
                                                    </tr>
                                                </thead>
                                                <tbody>
                                                    {cart.map((item, idx) => (
                                                        <tr key={idx} style={{ borderBottom: idx < cart.length - 1 ? '1px solid var(--surface-border)' : 'none' }}>
                                                            <td style={{ padding: '0.75rem 1rem', fontWeight: 600 }}>{item.name}</td>
                                                            <td style={{ padding: '0.75rem', textAlign: 'center' }}>{item.quantity}</td>
                                                            <td style={{ padding: '0.75rem', textAlign: 'center' }}>{item.days}d</td>
                                                            <td style={{ padding: '0.75rem', textAlign: 'right', fontWeight: 700, color: 'var(--primary)' }}>${(item.quantity * item.days * item.price).toLocaleString()}</td>
                                                            <td style={{ padding: '0.75rem', textAlign: 'center' }}>
                                                                <button onClick={() => handleRemoveFromCart(idx)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#ef4444', display: 'flex', alignItems: 'center' }}>
                                                                    <Trash2 size={15} />
                                                                </button>
                                                            </td>
                                                        </tr>
                                                    ))}
                                                </tbody>
                                            </table>
                                        </div>
                                    ) : (
                                        <div style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-muted)', background: 'var(--background)', borderRadius: 12, marginBottom: '1rem', border: '1px dashed var(--surface-border)', fontSize: '0.875rem' }}>
                                            Aún no hay equipos en la orden. Agrega al menos uno.
                                        </div>
                                    )}

                                    {/* Taxes breakdown */}
                                    {cart.length > 0 && selectedClientData && (
                                        <div style={{ padding: '0 1rem', marginBottom: '1rem', display: 'flex', flexDirection: 'column', gap: '0.4rem', fontSize: '0.85rem' }}>
                                            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                                <span style={{ color: 'var(--text-muted)' }}>Subtotal</span>
                                                <span style={{ fontWeight: 600 }}>${subtotal.toLocaleString()}</span>
                                            </div>
                                            {iva > 0 && (
                                                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                                    <span style={{ color: 'var(--text-muted)' }}>+ IVA ({selectedClientData.porcIVA}%)</span>
                                                    <span style={{ fontWeight: 600 }}>${iva.toLocaleString()}</span>
                                                </div>
                                            )}
                                            {ret > 0 && (
                                                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                                    <span style={{ color: 'var(--text-muted)' }}>+ Retención ({selectedClientData.porcRetencion}%)</span>
                                                    <span style={{ fontWeight: 600 }}>${ret.toLocaleString()}</span>
                                                </div>
                                            )}
                                        </div>
                                    )}

                                    {/* Total */}
                                    <div style={{ background: 'rgba(35, 101, 171,0.08)', border: '1px solid rgba(35, 101, 171,0.2)', borderRadius: 12, padding: '1rem 1.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                                        <span style={{ fontWeight: 600, color: 'var(--text-secondary)' }}>Total de la Orden</span>
                                        <span style={{ fontSize: '1.5rem', fontWeight: 800, color: 'var(--primary)' }}>${currentTotal.toLocaleString()}</span>
                                    </div>

                                    <div className="modal-actions">
                                        <button className="btn btn-secondary" onClick={() => setStep(1)}>Atrás</button>
                                        <button className="btn btn-primary" disabled={cart.length === 0} onClick={handleCreate}>
                                            <FileText size={18} /> Generar & Enviar
                                        </button>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}

            {/* ===================== VIEW INVOICE MODAL ===================== */}
            {showViewModal && viewingInvoice && (() => {
                const inv = viewingInvoice;
                const client = clients.find(c => c.id === inv.clientId);
                const invTotal = inv.amount;
                return (
                    <div className="modal-overlay">
                        <div className="modal-content fadeIn" style={{ maxWidth: '720px', padding: 0 }}>
                            {/* Invoice Header */}
                            <div style={{ background: 'linear-gradient(135deg, #2365AB, #154272)', padding: '2rem', borderRadius: '16px 16px 0 0' }}>
                                <div className="flex justify-between items-start">
                                    <div>
                                         <div style={{ fontSize: '1.4rem', fontWeight: 800, color: 'white' }}>{settings?.shortName || 'CIELO'}</div>
                                         <div style={{ fontSize: '0.875rem', color: 'rgba(255,255,255,0.8)', marginTop: 4 }}>{settings?.nameComplement || 'Alquiler de Equipos y Herramientas'}</div>
                                     </div>
                                    <div style={{ textAlign: 'right' }}>
                                        <div style={{ fontSize: '1.1rem', fontWeight: 700, color: 'white' }}>{inv.id}</div>
                                        <div style={{ fontSize: '0.85rem', color: 'rgba(255,255,255,0.8)', marginTop: 4 }}>Fecha: {inv.date}</div>
                                        <span style={{ display: 'inline-block', marginTop: 8, padding: '2px 12px', borderRadius: 999, fontSize: '0.75rem', fontWeight: 700, background: inv.status === 'Paid' ? 'rgba(16,185,129,0.3)' : 'rgba(245,158,11,0.3)', color: 'white', border: '1px solid rgba(255,255,255,0.3)' }}>
                                            {inv.status === 'Paid' ? 'PAGADA' : 'PENDIENTE'}
                                        </span>
                                    </div>
                                </div>
                            </div>

                            <div style={{ padding: '1.5rem 2rem' }}>
                                {/* Client */}
                                <div style={{ background: '#f8fafc', borderRadius: 10, padding: '1rem', marginBottom: '1.25rem', border: '1px solid var(--surface-border)' }}>
                                    <div style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.5rem' }}>Datos del Cliente</div>
                                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.4rem', fontSize: '0.875rem' }}>
                                        <div><span style={{ color: 'var(--text-muted)' }}>Empresa:</span> <strong>{client?.name}</strong></div>
                                        <div><span style={{ color: 'var(--text-muted)' }}>Obra:</span> <strong>{client?.obra || 'N/A'}</strong></div>
                                        <div><span style={{ color: 'var(--text-muted)' }}>Email:</span> {client?.email}</div>
                                        <div><span style={{ color: 'var(--text-muted)' }}>Tel:</span> {client?.phone}</div>
                                    </div>
                                </div>

                                {/* Items */}
                                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.875rem', marginBottom: '1rem' }}>
                                    <thead>
                                        <tr style={{ background: '#f1f5f9' }}>
                                            <th style={{ padding: '0.6rem 1rem', textAlign: 'left', color: 'var(--text-muted)', fontWeight: 600, fontSize: '0.75rem', textTransform: 'uppercase' }}>Equipo</th>
                                            <th style={{ padding: '0.6rem', textAlign: 'center', color: 'var(--text-muted)', fontWeight: 600, fontSize: '0.75rem', textTransform: 'uppercase' }}>Cant.</th>
                                            <th style={{ padding: '0.6rem', textAlign: 'center', color: 'var(--text-muted)', fontWeight: 600, fontSize: '0.75rem', textTransform: 'uppercase' }}>Días</th>
                                            <th style={{ padding: '0.6rem', textAlign: 'right', color: 'var(--text-muted)', fontWeight: 600, fontSize: '0.75rem', textTransform: 'uppercase' }}>P/Día</th>
                                            <th style={{ padding: '0.6rem 1rem', textAlign: 'right', color: 'var(--text-muted)', fontWeight: 600, fontSize: '0.75rem', textTransform: 'uppercase' }}>Subtotal</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {inv.items.map((item, idx) => {
                                            const prod = products.find(p => p.id === item.productId);
                                            return (
                                                <tr key={idx} style={{ borderBottom: '1px solid var(--surface-border)' }}>
                                                    <td style={{ padding: '0.75rem 1rem', fontWeight: 600 }}>{prod?.name || item.productId}</td>
                                                    <td style={{ padding: '0.75rem', textAlign: 'center' }}>{item.quantity}</td>
                                                    <td style={{ padding: '0.75rem', textAlign: 'center' }}>{item.days}d</td>
                                                    <td style={{ padding: '0.75rem', textAlign: 'right' }}>${item.price.toLocaleString()}</td>
                                                    <td style={{ padding: '0.75rem 1rem', textAlign: 'right', fontWeight: 700 }}>${(item.quantity * item.days * item.price).toLocaleString()}</td>
                                                </tr>
                                            );
                                        })}
                                    </tbody>
                                </table>

                                {/* Total */}
                                <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '1.25rem' }}>
                                    <div style={{ background: 'var(--primary)', borderRadius: 10, padding: '0.75rem 1.5rem', display: 'flex', gap: '1.5rem', alignItems: 'center' }}>
                                        <span style={{ color: 'rgba(255,255,255,0.85)', fontWeight: 600, fontSize: '0.95rem' }}>TOTAL</span>
                                        <span style={{ color: 'white', fontWeight: 800, fontSize: '1.4rem' }}>${invTotal.toLocaleString()}</span>
                                    </div>
                                </div>

                                {/* Signature Preview */}
                                <div style={{ border: '1px dashed var(--surface-border)', borderRadius: 10, padding: '1.25rem', marginBottom: '1rem' }}>
                                    <div style={{ fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-muted)', marginBottom: '0.75rem' }}>Sección de Firma (incluida en PDF)</div>
                                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '2rem' }}>
                                        <div>
                                            <div style={{ borderBottom: '1px solid #154272', marginBottom: '0.4rem', height: 32 }}></div>
                                            <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Firma Representante</div>
                                            <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>{settings?.shortName || 'CIELO'}</div>
                                        </div>
                                        <div>
                                            <div style={{ borderBottom: '1px solid #154272', marginBottom: '0.4rem', height: 32 }}></div>
                                            <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Firma del Arrendatario</div>
                                            <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>C.C. / NIT: _________________</div>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            <div className="modal-actions" style={{ padding: '0 2rem 1.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                <button className="btn btn-secondary" onClick={() => setShowViewModal(false)}>Cerrar</button>
                                <div style={{ display: 'flex', gap: '0.75rem' }}>
                                    {inv.status === 'Pending' && (
                                        <button
                                            className="btn btn-sm"
                                            style={{ background: '#10b981', color: 'white', boxShadow: '0 4px 14px rgba(16,185,129,0.3)', padding: '0.6rem 1.25rem', fontSize: '0.95rem' }}
                                            onClick={() => { setShowViewModal(false); handleOpenPayModal(inv); }}
                                        >
                                            <CreditCard size={18} /> Registrar Pago
                                        </button>
                                    )}
                                    <button
                                        className="btn btn-sm"
                                        style={{ background: 'rgba(239,68,68,0.1)', color: '#ef4444', border: '1px solid rgba(239,68,68,0.3)', cursor: 'pointer', padding: '0.6rem 1.25rem', fontSize: '0.95rem' }}
                                        onClick={() => {
                                            if (window.confirm(`¿Estás seguro de que deseas eliminar la factura ${inv.id}? Esta acción no se puede deshacer.`)) {
                                                deleteInvoice(inv.id);
                                                setShowViewModal(false);
                                            }
                                        }}
                                    >
                                        <Trash2 size={18} /> Eliminar
                                    </button>
                                    <button className="btn btn-primary" style={{ padding: '0.6rem 1.25rem', fontSize: '0.95rem' }} onClick={() => generatePDF(inv)}>
                                        <Download size={18} /> Descargar PDF
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                );
            })()}

            {/* ===================== PAY INVOICE MODAL ===================== */}
            {showPayModal && payingInvoice && (() => {
                const inv = payingInvoice;
                const client = clients.find(c => c.id === inv.clientId);
                return (
                    <div className="modal-overlay">
                        <div className="modal-content fadeIn" style={{ maxWidth: '480px', padding: 0, overflow: 'hidden' }}>
                            {/* Header */}
                            <div style={{ background: 'linear-gradient(135deg, #10b981, #059669)', padding: '1.75rem 2rem', borderRadius: '16px 16px 0 0' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                                    <div style={{ width: 50, height: 50, borderRadius: '50%', background: 'rgba(255,255,255,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                        <DollarSign size={26} color="white" />
                                    </div>
                                    <div>
                                        <div style={{ fontSize: '1.2rem', fontWeight: 800, color: 'white' }}>Registrar Pago</div>
                                        <div style={{ fontSize: '0.85rem', color: 'rgba(255,255,255,0.85)', marginTop: 2 }}>Factura {inv.id}</div>
                                    </div>
                                </div>
                            </div>

                            <div style={{ padding: '1.75rem 2rem' }}>
                                {/* Invoice Summary */}
                                <div style={{ background: '#f8fafc', border: '1px solid var(--surface-border)', borderRadius: 12, padding: '1rem 1.25rem', marginBottom: '1.25rem' }}>
                                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem', fontSize: '0.875rem' }}>
                                        <div><span style={{ color: 'var(--text-muted)' }}>Cliente:</span> <strong>{client?.name || 'N/A'}</strong></div>
                                        <div><span style={{ color: 'var(--text-muted)' }}>Obra:</span> <strong>{client?.obra || 'N/A'}</strong></div>
                                        <div><span style={{ color: 'var(--text-muted)' }}>Fecha emisión:</span> <strong>{inv.date}</strong></div>
                                        <div><span style={{ color: 'var(--text-muted)' }}>Ítems:</span> <strong>{inv.items.length} equipo(s)</strong></div>
                                    </div>
                                </div>

                                {/* Amount Highlight */}
                                <div style={{ background: 'linear-gradient(135deg, rgba(16,185,129,0.1), rgba(5,150,105,0.08))', border: '1px solid rgba(16,185,129,0.25)', borderRadius: 12, padding: '1.25rem 1.5rem', marginBottom: '1.25rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                    <span style={{ fontWeight: 600, color: 'var(--text-secondary)', fontSize: '0.95rem' }}>Monto a Cobrar</span>
                                    <span style={{ fontSize: '1.8rem', fontWeight: 800, color: '#10b981' }}>${inv.amount.toLocaleString()}</span>
                                </div>

                                {/* Payment Method */}
                                <div className="input-group">
                                    <label className="input-label">Método de Pago</label>
                                    <select className="input-base" value={paymentMethod} onChange={e => setPaymentMethod(e.target.value)}>
                                        <option value="Transferencia">Transferencia Bancaria</option>
                                        <option value="Efectivo">Efectivo</option>
                                        <option value="Cheque">Cheque</option>
                                        <option value="Tarjeta">Tarjeta de Crédito/Débito</option>
                                        <option value="Otro">Otro</option>
                                    </select>
                                </div>

                                {/* Warning note */}
                                <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.6rem', background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.25)', borderRadius: 10, padding: '0.85rem 1rem', marginBottom: '0.5rem' }}>
                                    <AlertCircle size={16} style={{ color: '#f59e0b', flexShrink: 0, marginTop: 1 }} />
                                    <span style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', lineHeight: 1.5 }}>
                                        Al confirmar, la factura se marcará como <strong>Pagada</strong>, la deuda del cliente se reducirá y los equipos serán liberados del inventario.
                                    </span>
                                </div>
                            </div>

                            <div className="modal-actions" style={{ padding: '0 2rem 1.75rem' }}>
                                <button className="btn btn-secondary" onClick={() => setShowPayModal(false)}>Cancelar</button>
                                <button
                                    className="btn btn-sm"
                                    style={{ background: '#10b981', color: 'white', boxShadow: '0 4px 14px rgba(16,185,129,0.35)', padding: '0.75rem 1.75rem', fontSize: '1rem' }}
                                    onClick={handleConfirmPayment}
                                >
                                    <CheckCircle size={18} /> Confirmar Pago
                                </button>
                            </div>
                        </div>
                    </div>
                );
            })()}
        </>
    );
}
