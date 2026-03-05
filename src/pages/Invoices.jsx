import React, { useState } from 'react';
import { FileText, Plus, Eye, Filter, Download, Trash2, ChevronRight, User, Package, CheckCircle, CreditCard, DollarSign, AlertCircle, ArrowRight } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useAppContext } from '../context/AppContext';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

export default function Invoices() {
    const { invoices, clients, products, createInvoice, payInvoice } = useAppContext();
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

    const currentTotal = cart.reduce((acc, item) => acc + (item.quantity * item.days * item.price), 0);
    const selectedClientData = clients.find(c => c.id === clientId);

    const filteredInvoices = invoices.filter(invoice => {
        const client = clients.find(c => c.id === invoice.clientId);
        if (!client) return false;
        const matchClient = filterClient ? client.id === filterClient : true;
        const matchObra = filterObra ? client.obra === filterObra : true;
        const matchStatus = filterStatus ? invoice.status === filterStatus : true;
        return matchClient && matchObra && matchStatus;
    });

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
        // Letter size in points: 612 x 792
        const doc = new jsPDF('p', 'pt', 'letter');
        const pageWidth = doc.internal.pageSize.getWidth();
        const pageHeight = doc.internal.pageSize.getHeight();
        const margin = 50;

        // --- Header ---
        doc.setFillColor(59, 130, 246);
        doc.rect(0, 0, pageWidth, 80, 'F');

        doc.setFontSize(26);
        doc.setTextColor(255, 255, 255);
        doc.setFont(undefined, 'bold');
        doc.text('CIELO', margin, 40);

        doc.setFontSize(11);
        doc.setFont(undefined, 'normal');
        doc.text('Alquiler de Equipos y Herramientas', margin, 58);

        // Invoice number top right
        doc.setFontSize(13);
        doc.setFont(undefined, 'bold');
        doc.text(`FACTURA ${invoice.id}`, pageWidth - margin, 35, { align: 'right' });
        doc.setFontSize(10);
        doc.setFont(undefined, 'normal');
        doc.text(`Fecha: ${invoice.date}`, pageWidth - margin, 52, { align: 'right' });
        doc.text(`Estado: ${invoice.status === 'Paid' ? 'Pagada' : 'Pendiente'}`, pageWidth - margin, 66, { align: 'right' });

        // --- Client Info ---
        let y = 110;
        doc.setFillColor(241, 245, 249);
        doc.roundedRect(margin, y - 12, pageWidth - margin * 2, 80, 6, 6, 'F');

        doc.setFontSize(11);
        doc.setTextColor(100, 116, 139);
        doc.setFont(undefined, 'bold');
        doc.text('DATOS DEL CLIENTE', margin + 12, y + 6);

        doc.setFont(undefined, 'normal');
        doc.setFontSize(11);
        doc.setTextColor(30, 41, 59);
        doc.text(`Nombre / Empresa: ${client?.name || 'N/A'}`, margin + 12, y + 24);
        doc.text(`Obra / Proyecto: ${client?.obra || 'N/A'}`, margin + 12, y + 40);
        doc.text(`Correo: ${client?.email || 'N/A'}   |   Tel: ${client?.phone || 'N/A'}`, margin + 12, y + 56);

        // --- Items Table ---
        y += 100;
        const tableBody = invoice.items.map(item => {
            const prod = products.find(p => p.id === item.productId);
            const subtotal = item.quantity * item.days * item.price;
            return [
                prod ? prod.name : item.productId,
                item.quantity,
                item.days,
                `$${item.price.toLocaleString()}`,
                `$${subtotal.toLocaleString()}`
            ];
        });

        const tableResult = autoTable(doc, {
            startY: y,
            margin: { left: margin, right: margin },
            headStyles: {
                fillColor: [59, 130, 246],
                textColor: 255,
                fontStyle: 'bold',
                fontSize: 11,
                halign: 'center'
            },
            head: [['Equipo / Herramienta', 'Cant.', 'Días', 'Precio / Día', 'Subtotal']],
            body: tableBody,
            bodyStyles: { fontSize: 10, textColor: [30, 41, 59] },
            alternateRowStyles: { fillColor: [248, 250, 252] },
            columnStyles: {
                0: { halign: 'left' },
                1: { halign: 'center' },
                2: { halign: 'center' },
                3: { halign: 'right' },
                4: { halign: 'right', fontStyle: 'bold' }
            }
        });

        // --- Total ---
        const afterTable = (tableResult?.finalY ?? doc.lastAutoTable?.finalY ?? y + 80) + 16;
        doc.setFillColor(59, 130, 246);
        doc.rect(pageWidth - margin - 200, afterTable, 200, 36, 'F');
        doc.setTextColor(255, 255, 255);
        doc.setFontSize(14);
        doc.setFont(undefined, 'bold');
        doc.text('TOTAL:', pageWidth - margin - 180, afterTable + 23);
        doc.text(`$${invoice.amount.toLocaleString()}`, pageWidth - margin - 10, afterTable + 23, { align: 'right' });

        // --- Terms ---
        const termsY = afterTable + 60;
        doc.setFontSize(9);
        doc.setTextColor(100, 116, 139);
        doc.setFont(undefined, 'italic');
        doc.text('Los equipos alquilados deben devolverse en las mismas condiciones en que fueron entregados.', margin, termsY);
        doc.text('El arrendatario asume la responsabilidad por daños o pérdidas durante el período de alquiler.', margin, termsY + 14);

        // --- Signature Section ---
        const signatureY = Math.max(pageHeight - 120, afterTable + 120);

        doc.setDrawColor(200, 213, 225);
        doc.setLineWidth(0.5);
        doc.line(margin, signatureY - 10, pageWidth - margin, signatureY - 10);

        // Left: Company rep
        doc.setFontSize(10);
        doc.setTextColor(30, 41, 59);
        doc.setFont(undefined, 'normal');
        doc.setDrawColor(30, 41, 59);
        doc.setLineWidth(1);
        doc.line(margin, signatureY + 40, margin + 180, signatureY + 40);
        doc.setFontSize(9);
        doc.setTextColor(100, 116, 139);
        doc.text('Firma del Representante', margin, signatureY + 55);
        doc.text('CIELO', margin, signatureY + 68);

        // Right: Renter
        doc.setLineWidth(1);
        doc.line(pageWidth - margin - 180, signatureY + 40, pageWidth - margin, signatureY + 40);
        doc.setFontSize(9);
        doc.setTextColor(100, 116, 139);
        doc.text('Firma del Arrendatario', pageWidth - margin - 180, signatureY + 55);
        doc.text('Nombre: _______________________', pageWidth - margin - 180, signatureY + 68);
        doc.text('C.C. / NIT: _____________________', pageWidth - margin - 180, signatureY + 81);

        // Footer
        doc.setFontSize(8);
        doc.setTextColor(150, 163, 175);
        doc.text(`CIELO | Factura ${invoice.id} | Generado el ${new Date().toLocaleDateString('es-CO')}`, pageWidth / 2, pageHeight - 20, { align: 'center' });

        doc.save(`Factura_${invoice.id}.pdf`);
    };

    const handleGenerateReport = () => {
        const doc = new jsPDF('p', 'pt', 'letter');
        const pageWidth = doc.internal.pageSize.getWidth();
        const margin = 50;

        doc.setFillColor(59, 130, 246);
        doc.rect(0, 0, pageWidth, 70, 'F');
        doc.setFontSize(22);
        doc.setTextColor(255, 255, 255);
        doc.setFont(undefined, 'bold');
        doc.text('CIELO', margin, 35);
        doc.setFontSize(11);
        doc.setFont(undefined, 'normal');
        doc.text('Reporte de Facturación', margin, 52);

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

        doc.save(`Reporte_Facturacion.pdf`);
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
                                <th>No. Factura</th>
                                <th>Origen</th>
                                <th>Cliente</th>
                                <th>Obra/Proyecto</th>
                                <th>Monto Total</th>
                                <th>Fecha Emisión</th>
                                <th>Estado</th>
                                <th style={{ textAlign: 'center' }}>Acciones</th>
                            </tr>
                        </thead>
                        <tbody>
                            {filteredInvoices.map(invoice => {
                                const client = clients.find(c => c.id === invoice.clientId);
                                return (
                                    <tr key={invoice.id}>
                                        <td style={{ fontWeight: 600, color: 'var(--primary)' }}>{invoice.id}</td>
                                        <td>
                                            {invoice.cotizacionId ? (
                                                <span style={{ fontSize: '0.72rem', fontWeight: 700, padding: '2px 8px', borderRadius: 999, background: 'rgba(99,102,241,0.12)', color: '#6366f1', border: '1px solid rgba(99,102,241,0.3)' }}>
                                                    📋 {invoice.cotizacionId}
                                                </span>
                                            ) : (
                                                <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>Manual</span>
                                            )}
                                        </td>
                                        <td style={{ fontWeight: 600 }}>{client?.name || 'N/A'}</td>
                                        <td className="text-muted">{client?.obra || '-'}</td>
                                        <td style={{ fontWeight: 700 }}>${invoice.amount.toLocaleString()}</td>
                                        <td className="text-muted">{invoice.date}</td>
                                        <td>
                                            <span className={`badge ${invoice.status === 'Paid' ? 'badge-success' : 'badge-warning'}`}
                                                style={invoice.status === 'Pending' ? { background: 'rgba(245, 158, 11, 0.2)', color: '#fbbf24', border: '1px solid rgba(245, 158, 11, 0.3)' } : {}}>
                                                {invoice.status === 'Paid' ? 'Pagada' : 'Pendiente'}
                                            </span>
                                        </td>
                                        <td>
                                            <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap' }}>
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
                                        <div style={{ background: 'rgba(59,130,246,0.06)', border: '1px solid rgba(59,130,246,0.2)', borderRadius: 12, padding: '1.25rem', marginTop: '0.5rem' }}>
                                            <div className="flex items-center gap-3 mb-3">
                                                <div style={{ width: 40, height: 40, borderRadius: '50%', background: 'rgba(59,130,246,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--primary)' }}>
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
                                    <div style={{ background: 'rgba(59,130,246,0.06)', border: '1px solid rgba(59,130,246,0.2)', borderRadius: 10, padding: '0.75rem 1rem', marginBottom: '1.25rem', display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
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

                                    {/* Total */}
                                    <div style={{ background: 'rgba(59,130,246,0.08)', border: '1px solid rgba(59,130,246,0.2)', borderRadius: 12, padding: '1rem 1.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
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
                            <div style={{ background: 'linear-gradient(135deg, #3b82f6, #2563eb)', padding: '2rem', borderRadius: '16px 16px 0 0' }}>
                                <div className="flex justify-between items-start">
                                    <div>
                                        <div style={{ fontSize: '1.4rem', fontWeight: 800, color: 'white' }}>CIELO</div>
                                        <div style={{ fontSize: '0.875rem', color: 'rgba(255,255,255,0.8)', marginTop: 4 }}>Alquiler de Equipos y Herramientas</div>
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
                                            <div style={{ borderBottom: '1px solid #334155', marginBottom: '0.4rem', height: 32 }}></div>
                                            <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Firma Representante</div>
                                            <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>CIELO</div>
                                        </div>
                                        <div>
                                            <div style={{ borderBottom: '1px solid #334155', marginBottom: '0.4rem', height: 32 }}></div>
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
                                    <button className="btn btn-primary" onClick={() => generatePDF(inv)}>
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
