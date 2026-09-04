import React, { useState, useMemo, useRef, useEffect } from 'react';
import {
    X, Download, Filter, Calendar, Users, Package, DollarSign,
    CheckCircle, Clock, Truck, AlertTriangle, FileText, BarChart2,
    RefreshCw, Layers, ArrowUpRight, Search, Check, ChevronDown
} from 'lucide-react';
import { format, parseISO, startOfMonth, endOfMonth, subMonths, startOfYear, endOfYear, isWithinInterval } from 'date-fns';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { applyStandardLayout } from './pdfTheme';

const fmtCOP = n => `$${Math.round(Number(n) || 0).toLocaleString('es-CO')}`;

export default function ReportesRemisionesModal({
    onClose,
    remisiones = [],
    clients = [],
    products = [],
    invoices = [],
    settings = {}
}) {
    // ─── Estados de Filtros ───────────────────────────────────────────────────
    const today = new Date();
    const [fechaDesde, setFechaDesde] = useState(format(startOfMonth(today), 'yyyy-MM-dd'));
    const [fechaHasta, setFechaHasta] = useState(format(endOfMonth(today), 'yyyy-MM-dd'));
    const [selectedClients, setSelectedClients] = useState([]); // Array de IDs de clientes seleccionados
    const [clientSearch, setClientSearch] = useState('');
    const [isClientDropdownOpen, setIsClientDropdownOpen] = useState(false);
    const clientDropdownRef = useRef(null);
    const [selectedObra, setSelectedObra] = useState('');
    const [selectedProducts, setSelectedProducts] = useState([]); // Array de IDs seleccionados
    const [productSearch, setProductSearch] = useState('');
    const [isProductDropdownOpen, setIsProductDropdownOpen] = useState(false);
    const productDropdownRef = useRef(null);
    const [selectedEstado, setSelectedEstado] = useState('Todos');
    const [reportType, setReportType] = useState('detallado'); // 'detallado' | 'ingresos' | 'equipos'

    // Cerrar dropdowns al hacer click fuera
    useEffect(() => {
        const handleClickOutside = (event) => {
            if (productDropdownRef.current && !productDropdownRef.current.contains(event.target)) {
                setIsProductDropdownOpen(false);
            }
            if (clientDropdownRef.current && !clientDropdownRef.current.contains(event.target)) {
                setIsClientDropdownOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    // Obras de los clientes seleccionados
    const obrasDisponibles = useMemo(() => {
        if (selectedClients.length === 0) return [];
        const matchedClients = clients.filter(c => selectedClients.includes(c.id));
        const allObras = matchedClients.flatMap(c => c.obras || []);
        return allObras.sort((a, b) => (a.nombre || '').localeCompare(b.nombre || '', 'es', { sensitivity: 'base' }));
    }, [selectedClients, clients]);

    // Productos / Equipos ordenados alfabéticamente
    const productosOrdenados = useMemo(() => {
        return [...products].sort((a, b) => {
            const nameA = a.name || a.nombre || '';
            const nameB = b.name || b.nombre || '';
            return nameA.localeCompare(nameB, 'es', { sensitivity: 'base' });
        });
    }, [products]);

    // Productos filtrados por texto en el buscador del dropdown
    const productosFiltradosBusqueda = useMemo(() => {
        if (!productSearch.trim()) return productosOrdenados;
        const q = productSearch.toLowerCase();
        return productosOrdenados.filter(p => {
            const n = (p.name || p.nombre || '').toLowerCase();
            const c = (p.category || '').toLowerCase();
            const id = (p.id || '').toLowerCase();
            return n.includes(q) || c.includes(q) || id.includes(q);
        });
    }, [productosOrdenados, productSearch]);

    // Alternar selección de un producto
    const toggleProduct = (prodId) => {
        setSelectedProducts(prev => 
            prev.includes(prodId) ? prev.filter(id => id !== prodId) : [...prev, prodId]
        );
    };

    const selectAllProducts = () => {
        setSelectedProducts(productosOrdenados.map(p => p.id));
    };

    const clearProducts = () => {
        setSelectedProducts([]);
    };

    // Clientes ordenados alfabéticamente
    const clientesOrdenados = useMemo(() => {
        return [...clients].sort((a, b) => {
            const nameA = a.name || '';
            const nameB = b.name || '';
            return nameA.localeCompare(nameB, 'es', { sensitivity: 'base' });
        });
    }, [clients]);

    // Clientes filtrados por texto en el buscador del dropdown
    const clientesFiltradosBusqueda = useMemo(() => {
        if (!clientSearch.trim()) return clientesOrdenados;
        const q = clientSearch.toLowerCase();
        return clientesOrdenados.filter(c => {
            const n = (c.name || '').toLowerCase();
            const nit = (c.nit || '').toLowerCase();
            const id = (c.id || '').toLowerCase();
            return n.includes(q) || nit.includes(q) || id.includes(q);
        });
    }, [clientesOrdenados, clientSearch]);

    // Alternar selección de un cliente
    const toggleClient = (cId) => {
        setSelectedClients(prev => {
            const next = prev.includes(cId) ? prev.filter(id => id !== cId) : [...prev, cId];
            return next;
        });
        setSelectedObra('');
    };

    const selectAllClients = () => {
        setSelectedClients(clientesOrdenados.map(c => c.id));
        setSelectedObra('');
    };

    const clearClients = () => {
        setSelectedClients([]);
        setSelectedObra('');
    };

    // Presets de fecha rápida
    const aplicarPresetFechas = (preset) => {
        const ahora = new Date();
        if (preset === 'esteMes') {
            setFechaDesde(format(startOfMonth(ahora), 'yyyy-MM-dd'));
            setFechaHasta(format(endOfMonth(ahora), 'yyyy-MM-dd'));
        } else if (preset === 'mesAnterior') {
            const mesAnt = subMonths(ahora, 1);
            setFechaDesde(format(startOfMonth(mesAnt), 'yyyy-MM-dd'));
            setFechaHasta(format(endOfMonth(mesAnt), 'yyyy-MM-dd'));
        } else if (preset === 'esteAno') {
            setFechaDesde(format(startOfYear(ahora), 'yyyy-MM-dd'));
            setFechaHasta(format(endOfYear(ahora), 'yyyy-MM-dd'));
        } else if (preset === 'todos') {
            setFechaDesde('');
            setFechaHasta('');
        }
    };

    // ─── Filtrado de Remisiones ───────────────────────────────────────────────
    const remisionesFiltradas = useMemo(() => {
        return remisiones.filter(r => {
            // Filtro por Fecha
            if (fechaDesde && r.fecha < fechaDesde) return false;
            if (fechaHasta && r.fecha > fechaHasta) return false;

            // Filtro por Cliente(s)
            if (selectedClients.length > 0 && !selectedClients.includes(r.clientId)) return false;

            // Filtro por Obra
            if (selectedObra && r.obraId !== selectedObra) return false;

            // Filtro por Estado
            if (selectedEstado !== 'Todos' && r.estado !== selectedEstado) return false;

            // Filtro por Producto(s)/Ítem(s) alquilados
            if (selectedProducts.length > 0) {
                const tieneAlgunProducto = (r.items || []).some(
                    i => selectedProducts.includes(i.productId) || selectedProducts.some(spId => i.nombre?.toLowerCase().includes(spId.toLowerCase()))
                );
                if (!tieneAlgunProducto) return false;
            }

            return true;
        });
    }, [remisiones, fechaDesde, fechaHasta, selectedClients, selectedObra, selectedEstado, selectedProducts]);

    // ─── Cálculo de Métricas y Datos del Reporte ───────────────────────────────
    const metricas = useMemo(() => {
        let totalEquiposDespachados = 0;
        let totalEquiposDevueltos = 0;
        let totalEquiposEnCampo = 0;
        let totalTransporte = 0;

        remisionesFiltradas.forEach(r => {
            totalTransporte += Number(r.transporte) || 0;
            (r.items || []).forEach(item => {
                // Si hay filtro de producto, solo contabilizamos los productos seleccionados
                const matchProduct = selectedProducts.length === 0 || 
                    selectedProducts.includes(item.productId) || 
                    selectedProducts.some(spId => item.nombre?.toLowerCase().includes(spId.toLowerCase()));

                if (matchProduct) {
                    const cant = Number(item.cantidad) || 0;
                    const cantDev = Number(item.cantidadDevuelta) || 0;
                    totalEquiposDespachados += cant;
                    totalEquiposDevueltos += cantDev;
                    totalEquiposEnCampo += Math.max(0, cant - cantDev);
                }
            });
        });

        // Ingresos vinculados a las remisiones o a los clientes filtrados
        // Buscamos facturas relacionadas con las remisiones filtradas
        const remisionIds = new Set(remisionesFiltradas.map(r => r.id));
        const remisionNums = new Set(remisionesFiltradas.map(r => r.id.split('-').pop()));

        const facturasRelacionadas = (invoices || []).filter(inv => {
            // Si la factura tiene vínculo directo a remisión
            const porRemId = inv.remId && (remisionIds.has(inv.remId) || remisionNums.has(inv.remId));
            const porItems = (inv.items || []).some(it => it.remId && (remisionIds.has(it.remId) || remisionNums.has(it.remId)));
            const porClienteYPeriodo = selectedClients.length > 0
                ? (selectedClients.includes(inv.clientId) && (!fechaDesde || inv.date >= fechaDesde) && (!fechaHasta || inv.date <= fechaHasta))
                : false;
            return porRemId || porItems || porClienteYPeriodo;
        });

        const totalFacturado = facturasRelacionadas.reduce((s, inv) => s + (Number(inv.amount) || 0), 0);
        const totalPagado = facturasRelacionadas.reduce((s, inv) => {
            if (inv.status === 'Paid' || inv.status === 'Pagada') return s + (Number(inv.amount) || 0);
            return s + (Number(inv.paidAmount) || 0);
        }, 0);
        const saldoPendiente = Math.max(0, totalFacturado - totalPagado);

        return {
            totalRemisiones: remisionesFiltradas.length,
            totalEquiposDespachados,
            totalEquiposDevueltos,
            totalEquiposEnCampo,
            totalTransporte,
            totalFacturado,
            totalPagado,
            saldoPendiente
        };
    }, [remisionesFiltradas, selectedProducts, invoices, selectedClients, fechaDesde, fechaHasta]);

    // ─── Resumen por Cliente (para pestaña de ingresos) ────────────────────────
    const clientesResumen = useMemo(() => {
        const map = new Map();

        remisionesFiltradas.forEach(r => {
            const cId = r.clientId;
            if (!map.has(cId)) {
                const cl = clients.find(c => c.id === cId);
                map.set(cId, {
                    client: cl || { name: cId, nit: '—' },
                    remisionesCount: 0,
                    equiposEnCampo: 0,
                    equiposTotal: 0,
                    ingresosFacturados: 0,
                    ingresosCobrados: 0
                });
            }

            const item = map.get(cId);
            item.remisionesCount += 1;

            (r.items || []).forEach(it => {
                const c = Number(it.cantidad) || 0;
                const cd = Number(it.cantidadDevuelta) || 0;
                item.equiposTotal += c;
                item.equiposEnCampo += Math.max(0, c - cd);
            });
        });

        // Sumar facturas a cada cliente en el período
        map.forEach((val, cId) => {
            const clientInvoices = (invoices || []).filter(inv => {
                if (inv.clientId !== cId) return false;
                if (fechaDesde && inv.date < fechaDesde) return false;
                if (fechaHasta && inv.date > fechaHasta) return false;
                return true;
            });

            val.ingresosFacturados = clientInvoices.reduce((s, i) => s + (Number(i.amount) || 0), 0);
            val.ingresosCobrados = clientInvoices.reduce((s, i) => {
                if (i.status === 'Paid' || i.status === 'Pagada') return s + (Number(i.amount) || 0);
                return s + (Number(i.paidAmount) || 0);
            }, 0);
        });

        return Array.from(map.values());
    }, [remisionesFiltradas, clients, invoices, fechaDesde, fechaHasta]);

    // ─── Resumen por Ítems / Equipos ──────────────────────────────────────────
    const equiposResumen = useMemo(() => {
        const prodMap = new Map();

        remisionesFiltradas.forEach(r => {
            (r.items || []).forEach(it => {
                const pId = it.productId || it.nombre;
                if (!prodMap.has(pId)) {
                    const prod = products.find(p => p.id === pId);
                    prodMap.set(pId, {
                        id: pId,
                        nombre: it.nombre || prod?.name || pId,
                        categoria: prod?.category || 'General',
                        vecesAlquilado: 0,
                        totalDespachado: 0,
                        totalDevuelto: 0,
                        enCampo: 0
                    });
                }

                const rec = prodMap.get(pId);
                rec.vecesAlquilado += 1;
                const c = Number(it.cantidad) || 0;
                const cd = Number(it.cantidadDevuelta) || 0;
                rec.totalDespachado += c;
                rec.totalDevuelto += cd;
                rec.enCampo += Math.max(0, c - cd);
            });
        });

        return Array.from(prodMap.values()).sort((a, b) => b.totalDespachado - a.totalDespachado);
    }, [remisionesFiltradas, products]);

    // ─── Generación de PDF ────────────────────────────────────────────────────
    const exportarPDF = () => {
        try {
            const doc = new jsPDF({ orientation: 'landscape', format: 'letter', unit: 'mm' });
            const W = doc.internal.pageSize.getWidth();
            const H = doc.internal.pageSize.getHeight();
            const margin = 12;

            // Encabezado institucional
            let y = applyStandardLayout(doc, 'INFORME DE REMISIONES Y ALQUILER', settings, format(new Date(), 'yyyyMMdd-HHmm'), { skipFooter: true });

            // Cuadro de Parámetros del Reporte
            doc.setFillColor(248, 250, 252);
            doc.setDrawColor(226, 232, 240);
            doc.roundedRect(margin, y, W - margin * 2, 20, 2, 2, 'FD');

            doc.setFontSize(8);
            doc.setFont('helvetica', 'bold');
            doc.setTextColor(30, 41, 59);

            let clienteNombre = 'Todos los clientes';
            if (selectedClients.length === 1) {
                clienteNombre = clients.find(c => c.id === selectedClients[0])?.name || selectedClients[0];
            } else if (selectedClients.length > 1) {
                clienteNombre = `${selectedClients.length} clientes seleccionados`;
            }
            const obraNombre = selectedObra ? (obrasDisponibles.find(o => o.id === selectedObra)?.nombre || selectedObra) : 'Todas las obras';
            
            let itemNombre = 'Todos los ítems';
            if (selectedProducts.length === 1) {
                itemNombre = products.find(p => p.id === selectedProducts[0])?.name || selectedProducts[0];
            } else if (selectedProducts.length > 1) {
                itemNombre = `${selectedProducts.length} ítems seleccionados`;
            }

            const periodoStr = fechaDesde && fechaHasta ? `${fechaDesde} al ${fechaHasta}` : (fechaDesde ? `Desde ${fechaDesde}` : (fechaHasta ? `Hasta ${fechaHasta}` : 'Histórico completo'));

            doc.text('PARÁMETROS DEL INFORME:', margin + 4, y + 5);
            doc.setFont('helvetica', 'normal');
            doc.text(`Período: ${periodoStr}`, margin + 4, y + 10);
            doc.text(`Cliente: ${clienteNombre}`, margin + 4, y + 15);

            doc.text(`Obra: ${obraNombre}`, margin + 95, y + 10);
            doc.text(`Ítems / Equipos: ${itemNombre}`, margin + 95, y + 15);

            doc.text(`Estado Remisión: ${selectedEstado}`, margin + 180, y + 10);
            doc.text(`Fecha Emisión: ${format(new Date(), 'dd/MM/yyyy HH:mm')}`, margin + 180, y + 15);

            y += 24;

            // Tabla de Resumen Ejecutivo / Métricas
            autoTable(doc, {
                startY: y,
                margin: { left: margin, right: margin },
                head: [['REMISIÓNES', 'EQUIPOS DESPACHADOS', 'EQUIPOS DEVUELTOS', 'EN CAMPO (OBRA)', 'TOTAL FACTURADO', 'TOTAL RECAUDADO', 'SALDO PENDIENTE']],
                body: [[
                    metricas.totalRemisiones,
                    metricas.totalEquiposDespachados,
                    metricas.totalEquiposDevueltos,
                    metricas.totalEquiposEnCampo,
                    fmtCOP(metricas.totalFacturado),
                    fmtCOP(metricas.totalPagado),
                    fmtCOP(metricas.saldoPendiente)
                ]],
                theme: 'plain',
                headStyles: {
                    fillColor: [35, 101, 171],
                    textColor: 255,
                    fontSize: 7.5,
                    fontStyle: 'bold',
                    halign: 'center'
                },
                styles: {
                    fontSize: 8,
                    halign: 'center',
                    fontStyle: 'bold',
                    textColor: [30, 41, 59],
                    cellPadding: 3,
                    lineWidth: 0.1,
                    lineColor: [203, 213, 225]
                }
            });

            y = doc.lastAutoTable.finalY + 8;

            // Sección según tipo de reporte seleccionado
            if (reportType === 'ingresos') {
                // Reporte enfocado a clientes e ingresos
                doc.setFont('helvetica', 'bold');
                doc.setFontSize(9);
                doc.setTextColor(30, 41, 59);
                doc.text('CONSOLIDADO DE INGRESOS Y EQUIPOS POR CLIENTE', margin, y);
                y += 3;

                autoTable(doc, {
                    startY: y,
                    margin: { left: margin, right: margin, bottom: 15 },
                    head: [['#', 'CLIENTE / RAZÓN SOCIAL', 'NIT / CC', 'REMISSIONES', 'TOTAL EQUIPOS', 'EN CAMPO', 'FACTURADO', 'COBRADO', 'SALDO']],
                    body: clientesResumen.map((cr, idx) => [
                        idx + 1,
                        cr.client?.name?.toUpperCase() || '—',
                        cr.client?.nit || '—',
                        cr.remisionesCount,
                        cr.equiposTotal,
                        cr.equiposEnCampo,
                        fmtCOP(cr.ingresosFacturados),
                        fmtCOP(cr.ingresosCobrados),
                        fmtCOP(Math.max(0, cr.ingresosFacturados - cr.ingresosCobrados))
                    ]),
                    theme: 'plain',
                    headStyles: { fillColor: [241, 245, 249], textColor: [30, 41, 59], fontSize: 7.5, fontStyle: 'bold', lineWidth: 0.1, lineColor: [203, 213, 225] },
                    styles: { fontSize: 7.5, cellPadding: 2.5, lineWidth: 0.1, lineColor: [226, 232, 240] },
                    columnStyles: {
                        0: { halign: 'center', cellWidth: 10 },
                        1: { halign: 'left' },
                        2: { halign: 'center' },
                        3: { halign: 'center' },
                        4: { halign: 'center' },
                        5: { halign: 'center', fontStyle: 'bold' },
                        6: { halign: 'right' },
                        7: { halign: 'right' },
                        8: { halign: 'right', fontStyle: 'bold' }
                    }
                });
            } else if (reportType === 'equipos') {
                // Reporte enfocado a rotación de ítems
                doc.setFont('helvetica', 'bold');
                doc.setFontSize(9);
                doc.setTextColor(30, 41, 59);
                doc.text('UTILIZACIÓN Y ROTACIÓN DE ÍTEMS / EQUIPOS EN ALQUILER', margin, y);
                y += 3;

                autoTable(doc, {
                    startY: y,
                    margin: { left: margin, right: margin, bottom: 15 },
                    head: [['#', 'EQUIPO / DESCRIPCIÓN', 'CATEGORÍA', 'DESPACHOS', 'CANT. DESPACHADA', 'CANT. DEVUELTA', 'SALDO EN OBRA']],
                    body: equiposResumen.map((eq, idx) => [
                        idx + 1,
                        eq.nombre.toUpperCase(),
                        eq.categoria,
                        eq.vecesAlquilado,
                        eq.totalDespachado,
                        eq.totalDevuelto,
                        eq.enCampo
                    ]),
                    theme: 'plain',
                    headStyles: { fillColor: [241, 245, 249], textColor: [30, 41, 59], fontSize: 7.5, fontStyle: 'bold', lineWidth: 0.1, lineColor: [203, 213, 225] },
                    styles: { fontSize: 7.5, cellPadding: 2.5, lineWidth: 0.1, lineColor: [226, 232, 240] },
                    columnStyles: {
                        0: { halign: 'center', cellWidth: 10 },
                        1: { halign: 'left' },
                        2: { halign: 'center' },
                        3: { halign: 'center' },
                        4: { halign: 'center' },
                        5: { halign: 'center' },
                        6: { halign: 'center', fontStyle: 'bold' }
                    }
                });
            } else {
                // Reporte Detallado de Remisiones
                doc.setFont('helvetica', 'bold');
                doc.setFontSize(9);
                doc.setTextColor(30, 41, 59);
                doc.text('DETALLE INDIVIDUAL DE REMISIONES', margin, y);
                y += 3;

                autoTable(doc, {
                    startY: y,
                    margin: { left: margin, right: margin, bottom: 15 },
                    head: [['REMISIÓN', 'FECHA', 'CLIENTE', 'OBRA / DESTINO', 'ESTADO', 'ÍTEMS DESPACHADOS', 'DEVUELTOS', 'EN CAMPO']],
                    body: remisionesFiltradas.map(rem => {
                        const cl = clients.find(c => c.id === rem.clientId);
                        const ob = cl?.obras?.find(o => o.id === rem.obraId);
                        
                        let desp = 0;
                        let dev = 0;
                        const itemsTxt = (rem.items || []).map(it => {
                            const cant = Number(it.cantidad) || 0;
                            const d = Number(it.cantidadDevuelta) || 0;
                            desp += cant;
                            dev += d;
                            return `${it.nombre || it.productId} (${cant})`;
                        }).join(', ');

                        return [
                            rem.id.split('-').pop(),
                            rem.fecha,
                            cl?.name?.substring(0, 24) || rem.clientId,
                            ob?.nombre?.substring(0, 20) || '—',
                            rem.estado,
                            itemsTxt.substring(0, 45) + (itemsTxt.length > 45 ? '...' : ''),
                            dev,
                            Math.max(0, desp - dev)
                        ];
                    }),
                    theme: 'plain',
                    headStyles: { fillColor: [241, 245, 249], textColor: [30, 41, 59], fontSize: 7.5, fontStyle: 'bold', lineWidth: 0.1, lineColor: [203, 213, 225] },
                    styles: { fontSize: 7, cellPadding: 2, lineWidth: 0.1, lineColor: [226, 232, 240] },
                    columnStyles: {
                        0: { halign: 'center', cellWidth: 18, fontStyle: 'bold' },
                        1: { halign: 'center', cellWidth: 20 },
                        2: { halign: 'left', cellWidth: 45 },
                        3: { halign: 'left', cellWidth: 40 },
                        4: { halign: 'center', cellWidth: 22 },
                        5: { halign: 'left' },
                        6: { halign: 'center', cellWidth: 18 },
                        7: { halign: 'center', cellWidth: 18, fontStyle: 'bold' }
                    }
                });
            }

            // Numeración de páginas en pie de página
            const pageCount = doc.internal.getNumberOfPages();
            for (let i = 1; i <= pageCount; i++) {
                doc.setPage(i);
                doc.setFontSize(7);
                doc.setTextColor(100, 116, 139);
                doc.setFont('helvetica', 'normal');
                const footerText = `Página ${i} de ${pageCount}  |  Informe generado por Sistema ${settings?.shortName || 'CIELO'} el ${format(new Date(), 'dd/MM/yyyy HH:mm')}`;
                doc.text(footerText, W / 2, H - 7, { align: 'center' });
            }

            doc.save(`Informe_Remisiones_${format(new Date(), 'yyyy-MM-dd')}.pdf`);
        } catch (error) {
            console.error('Error generando PDF de reporte:', error);
            alert('Error al generar el PDF del reporte.');
        }
    };

    const inputStyle = {
        padding: '0.55rem 0.75rem',
        background: '#ffffff',
        border: '1px solid #cbd5e1',
        borderRadius: 8,
        color: '#1e293b',
        fontSize: '0.85rem',
        outline: 'none',
        width: '100%',
        boxSizing: 'border-box'
    };

    return (
        <div style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(15, 23, 42, 0.65)',
            backdropFilter: 'blur(5px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1100,
            padding: '1.5rem'
        }}>
            <div style={{
                background: '#ffffff',
                borderRadius: '16px',
                boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
                width: '100%',
                maxWidth: 1100,
                maxHeight: '92vh',
                display: 'flex',
                flexDirection: 'column',
                overflow: 'hidden'
            }}>
                {/* Header Modal */}
                <div style={{
                    padding: '1.25rem 2rem',
                    borderBottom: '1px solid #e2e8f0',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    background: 'linear-gradient(to right, #f8fafc, #ffffff)'
                }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.85rem' }}>
                        <div style={{
                            background: 'rgba(35, 101, 171, 0.1)',
                            padding: '0.6rem',
                            borderRadius: '12px',
                            color: '#2365AB'
                        }}>
                            <BarChart2 size={24} />
                        </div>
                        <div>
                            <h3 style={{ margin: 0, color: '#104166', fontSize: '1.25rem', fontWeight: 800 }}>
                                Generador de Informes y Reportes
                            </h3>
                            <p style={{ margin: 0, fontSize: '0.8rem', color: '#64748b' }}>
                                Filtros personalizados por período, ítems alquilados, ingresos por cliente y exportación a PDF
                            </p>
                        </div>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                        <button
                            onClick={exportarPDF}
                            className="btn btn-primary"
                            style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: '0.5rem',
                                background: '#2365AB',
                                color: 'white',
                                padding: '0.6rem 1.25rem',
                                borderRadius: '8px',
                                fontWeight: 700,
                                fontSize: '0.85rem',
                                boxShadow: '0 4px 6px -1px rgba(35, 101, 171, 0.2)'
                            }}
                        >
                            <Download size={16} /> Descargar PDF
                        </button>
                        <button
                            onClick={onClose}
                            style={{
                                background: '#f1f5f9',
                                border: 'none',
                                borderRadius: '50%',
                                width: 34,
                                height: 34,
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                cursor: 'pointer',
                                color: '#64748b'
                            }}
                        >
                            <X size={18} />
                        </button>
                    </div>
                </div>

                {/* Panel de Contenido Desplazable */}
                <div style={{ padding: '1.5rem 2rem', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                    
                    {/* ─── FILTROS PRINCIPALES ───────────────────────────────────── */}
                    <div style={{
                        background: '#f8fafc',
                        border: '1px solid #e2e8f0',
                        borderRadius: '12px',
                        padding: '1.25rem',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '1rem'
                    }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.75rem' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.85rem', fontWeight: 700, color: '#334155' }}>
                                <Filter size={16} style={{ color: '#2365AB' }} />
                                Filtros de Búsqueda y Segmentación
                            </div>
                            {/* Presets de Fecha */}
                            <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap' }}>
                                <button
                                    onClick={() => aplicarPresetFechas('esteMes')}
                                    style={{ background: '#e2e8f0', border: 'none', padding: '0.25rem 0.65rem', borderRadius: '6px', fontSize: '0.75rem', fontWeight: 600, color: '#334155', cursor: 'pointer' }}
                                >
                                    Este Mes
                                </button>
                                <button
                                    onClick={() => aplicarPresetFechas('mesAnterior')}
                                    style={{ background: '#e2e8f0', border: 'none', padding: '0.25rem 0.65rem', borderRadius: '6px', fontSize: '0.75rem', fontWeight: 600, color: '#334155', cursor: 'pointer' }}
                                >
                                    Mes Anterior
                                </button>
                                <button
                                    onClick={() => aplicarPresetFechas('esteAno')}
                                    style={{ background: '#e2e8f0', border: 'none', padding: '0.25rem 0.65rem', borderRadius: '6px', fontSize: '0.75rem', fontWeight: 600, color: '#334155', cursor: 'pointer' }}
                                >
                                    Año en Curso
                                </button>
                                <button
                                    onClick={() => aplicarPresetFechas('todos')}
                                    style={{ background: '#e2e8f0', border: 'none', padding: '0.25rem 0.65rem', borderRadius: '6px', fontSize: '0.75rem', fontWeight: 600, color: '#334155', cursor: 'pointer' }}
                                >
                                    Histórico Completo
                                </button>
                            </div>
                        </div>

                        {/* Controles de Entrada de Filtros */}
                        <div style={{
                            display: 'grid',
                            gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
                            gap: '1rem'
                        }}>
                            {/* Fecha Desde */}
                            <div>
                                <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 700, color: '#64748b', marginBottom: '0.35rem' }}>
                                    Fecha Desde
                                </label>
                                <input
                                    type="date"
                                    value={fechaDesde}
                                    onChange={e => setFechaDesde(e.target.value)}
                                    style={inputStyle}
                                />
                            </div>

                            {/* Fecha Hasta */}
                            <div>
                                <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 700, color: '#64748b', marginBottom: '0.35rem' }}>
                                    Fecha Hasta
                                </label>
                                <input
                                    type="date"
                                    value={fechaHasta}
                                    onChange={e => setFechaHasta(e.target.value)}
                                    style={inputStyle}
                                />
                            </div>

                            {/* Cliente / Empresa con Buscador y Selección Múltiple */}
                            <div ref={clientDropdownRef} style={{ position: 'relative' }}>
                                <label style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.75rem', fontWeight: 700, color: '#64748b', marginBottom: '0.35rem' }}>
                                    <span>Cliente / Empresa</span>
                                    {selectedClients.length > 0 && (
                                        <span 
                                            onClick={clearClients}
                                            style={{ color: '#ef4444', cursor: 'pointer', fontWeight: 600, fontSize: '0.7rem' }}
                                        >
                                            Limpiar ({selectedClients.length})
                                        </span>
                                    )}
                                </label>

                                {/* Botón / Tarjeta que abre el desplegable de clientes */}
                                <div
                                    onClick={() => setIsClientDropdownOpen(!isClientDropdownOpen)}
                                    style={{
                                        ...inputStyle,
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'space-between',
                                        cursor: 'pointer',
                                        background: selectedClients.length > 0 ? 'rgba(35, 101, 171, 0.05)' : '#ffffff',
                                        borderColor: selectedClients.length > 0 ? '#2365AB' : '#cbd5e1'
                                    }}
                                >
                                    <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', paddingRight: 6 }}>
                                        {selectedClients.length === 0 ? (
                                            <span style={{ color: '#64748b' }}>— Todos los Clientes —</span>
                                        ) : selectedClients.length === 1 ? (
                                            <span style={{ color: '#2365AB', fontWeight: 700 }}>
                                                {clients.find(c => c.id === selectedClients[0])?.name || selectedClients[0]}
                                            </span>
                                        ) : (
                                            <span style={{ color: '#2365AB', fontWeight: 700 }}>
                                                {selectedClients.length} clientes seleccionados
                                            </span>
                                        )}
                                    </div>
                                    <ChevronDown size={16} style={{ color: '#64748b', flexShrink: 0, transform: isClientDropdownOpen ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }} />
                                </div>

                                {/* Menú Flotante con Buscador y Checkboxes para Clientes */}
                                {isClientDropdownOpen && (
                                    <div style={{
                                        position: 'absolute',
                                        top: '100%',
                                        left: 0,
                                        right: 0,
                                        marginTop: 4,
                                        background: '#ffffff',
                                        border: '1px solid #cbd5e1',
                                        borderRadius: 10,
                                        boxShadow: '0 10px 25px rgba(0,0,0,0.15)',
                                        zIndex: 105,
                                        padding: '0.6rem',
                                        display: 'flex',
                                        flexDirection: 'column',
                                        gap: '0.5rem',
                                        width: 'max(100%, 280px)'
                                    }}>
                                        {/* Input Buscador de Clientes */}
                                        <div style={{ position: 'relative' }}>
                                            <Search size={14} style={{ position: 'absolute', left: 8, top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }} />
                                            <input
                                                type="text"
                                                placeholder="Buscar cliente por nombre o NIT..."
                                                value={clientSearch}
                                                onChange={e => setClientSearch(e.target.value)}
                                                autoFocus
                                                style={{
                                                    width: '100%',
                                                    padding: '0.45rem 0.5rem 0.45rem 1.75rem',
                                                    fontSize: '0.8rem',
                                                    borderRadius: 6,
                                                    border: '1px solid #e2e8f0',
                                                    outline: 'none',
                                                    boxSizing: 'border-box'
                                                }}
                                            />
                                        </div>

                                        {/* Acciones Rápidas: Todos / Ninguno */}
                                        <div style={{ display: 'flex', justifyContent: 'space-between', padding: '0 0.25rem', fontSize: '0.72rem' }}>
                                            <span 
                                                onClick={selectAllClients}
                                                style={{ color: '#2365AB', cursor: 'pointer', fontWeight: 700 }}
                                            >
                                                Seleccionar todos
                                            </span>
                                            <span 
                                                onClick={clearClients}
                                                style={{ color: '#64748b', cursor: 'pointer', fontWeight: 600 }}
                                            >
                                                Deseleccionar
                                            </span>
                                        </div>

                                        {/* Lista con scroll y checkboxes */}
                                        <div style={{ maxHeight: '190px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 2 }}>
                                            {clientesFiltradosBusqueda.length === 0 ? (
                                                <div style={{ padding: '0.75rem', textAlign: 'center', fontSize: '0.75rem', color: '#94a3b8' }}>
                                                    No se encontraron clientes
                                                </div>
                                            ) : (
                                                clientesFiltradosBusqueda.map(client => {
                                                    const isChecked = selectedClients.includes(client.id);
                                                    return (
                                                        <div
                                                            key={client.id}
                                                            onClick={() => toggleClient(client.id)}
                                                            style={{
                                                                display: 'flex',
                                                                alignItems: 'center',
                                                                gap: '0.5rem',
                                                                padding: '0.4rem 0.5rem',
                                                                borderRadius: 6,
                                                                cursor: 'pointer',
                                                                background: isChecked ? 'rgba(35, 101, 171, 0.08)' : 'transparent',
                                                                transition: 'background 0.15s'
                                                            }}
                                                            onMouseEnter={e => !isChecked && (e.currentTarget.style.background = '#f8fafc')}
                                                            onMouseLeave={e => !isChecked && (e.currentTarget.style.background = 'transparent')}
                                                        >
                                                            <div style={{
                                                                width: 16,
                                                                height: 16,
                                                                borderRadius: 4,
                                                                border: isChecked ? '1.5px solid #2365AB' : '1.5px solid #cbd5e1',
                                                                background: isChecked ? '#2365AB' : '#ffffff',
                                                                display: 'flex',
                                                                alignItems: 'center',
                                                                justifyContent: 'center',
                                                                flexShrink: 0
                                                            }}>
                                                                {isChecked && <Check size={12} color="#ffffff" strokeWidth={3} />}
                                                            </div>
                                                            <div style={{ flex: 1, minWidth: 0 }}>
                                                                <div style={{ fontSize: '0.78rem', color: isChecked ? '#104166' : '#334155', fontWeight: isChecked ? 700 : 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                                                    {client.name}
                                                                </div>
                                                                {client.nit && (
                                                                    <div style={{ fontSize: '0.68rem', color: '#94a3b8' }}>
                                                                        NIT: {client.nit}
                                                                    </div>
                                                                )}
                                                            </div>
                                                        </div>
                                                    );
                                                })
                                            )}
                                        </div>
                                    </div>
                                )}
                            </div>

                            {/* Obra */}
                            <div>
                                <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 700, color: '#64748b', marginBottom: '0.35rem' }}>
                                    Obra / Proyecto
                                </label>
                                <select
                                    value={selectedObra}
                                    onChange={e => setSelectedObra(e.target.value)}
                                    disabled={selectedClients.length === 0}
                                    style={{
                                        ...inputStyle,
                                        background: selectedClients.length === 0 ? '#f1f5f9' : '#ffffff',
                                        cursor: selectedClients.length === 0 ? 'not-allowed' : 'default'
                                    }}
                                >
                                    <option value="">— Todas las Obras —</option>
                                    {obrasDisponibles.map(o => (
                                        <option key={o.id} value={o.id}>{o.nombre}</option>
                                    ))}
                                </select>
                            </div>

                            {/* Ítem / Equipo Alquilado con Buscador y Selección Múltiple */}
                            <div ref={productDropdownRef} style={{ position: 'relative' }}>
                                <label style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.75rem', fontWeight: 700, color: '#64748b', marginBottom: '0.35rem' }}>
                                    <span>Ítems / Equipos Alquilados</span>
                                    {selectedProducts.length > 0 && (
                                        <span 
                                            onClick={clearProducts}
                                            style={{ color: '#ef4444', cursor: 'pointer', fontWeight: 600, fontSize: '0.7rem' }}
                                        >
                                            Limpiar ({selectedProducts.length})
                                        </span>
                                    )}
                                </label>

                                {/* Botón / Tarjeta que abre el desplegable */}
                                <div
                                    onClick={() => setIsProductDropdownOpen(!isProductDropdownOpen)}
                                    style={{
                                        ...inputStyle,
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'space-between',
                                        cursor: 'pointer',
                                        background: selectedProducts.length > 0 ? 'rgba(35, 101, 171, 0.05)' : '#ffffff',
                                        borderColor: selectedProducts.length > 0 ? '#2365AB' : '#cbd5e1'
                                    }}
                                >
                                    <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', paddingRight: 6 }}>
                                        {selectedProducts.length === 0 ? (
                                            <span style={{ color: '#64748b' }}>— Todos los Equipos —</span>
                                        ) : selectedProducts.length === 1 ? (
                                            <span style={{ color: '#2365AB', fontWeight: 700 }}>
                                                {products.find(p => p.id === selectedProducts[0])?.name || selectedProducts[0]}
                                            </span>
                                        ) : (
                                            <span style={{ color: '#2365AB', fontWeight: 700 }}>
                                                {selectedProducts.length} equipos seleccionados
                                            </span>
                                        )}
                                    </div>
                                    <ChevronDown size={16} style={{ color: '#64748b', flexShrink: 0, transform: isProductDropdownOpen ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }} />
                                </div>

                                {/* Menú Flotante con Buscador y Checkboxes */}
                                {isProductDropdownOpen && (
                                    <div style={{
                                        position: 'absolute',
                                        top: '100%',
                                        left: 0,
                                        right: 0,
                                        marginTop: 4,
                                        background: '#ffffff',
                                        border: '1px solid #cbd5e1',
                                        borderRadius: 10,
                                        boxShadow: '0 10px 25px rgba(0,0,0,0.15)',
                                        zIndex: 100,
                                        padding: '0.6rem',
                                        display: 'flex',
                                        flexDirection: 'column',
                                        gap: '0.5rem',
                                        width: 'max(100%, 280px)'
                                    }}>
                                        {/* Input Buscador */}
                                        <div style={{ position: 'relative' }}>
                                            <Search size={14} style={{ position: 'absolute', left: 8, top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }} />
                                            <input
                                                type="text"
                                                placeholder="Buscar equipo..."
                                                value={productSearch}
                                                onChange={e => setProductSearch(e.target.value)}
                                                autoFocus
                                                style={{
                                                    width: '100%',
                                                    padding: '0.45rem 0.5rem 0.45rem 1.75rem',
                                                    fontSize: '0.8rem',
                                                    borderRadius: 6,
                                                    border: '1px solid #e2e8f0',
                                                    outline: 'none',
                                                    boxSizing: 'border-box'
                                                }}
                                            />
                                        </div>

                                        {/* Acciones Rápidas: Todos / Ninguno */}
                                        <div style={{ display: 'flex', justifyContent: 'space-between', padding: '0 0.25rem', fontSize: '0.72rem' }}>
                                            <span 
                                                onClick={selectAllProducts}
                                                style={{ color: '#2365AB', cursor: 'pointer', fontWeight: 700 }}
                                            >
                                                Seleccionar todos
                                            </span>
                                            <span 
                                                onClick={clearProducts}
                                                style={{ color: '#64748b', cursor: 'pointer', fontWeight: 600 }}
                                            >
                                                Deseleccionar
                                            </span>
                                        </div>

                                        {/* Lista con scroll y checkboxes */}
                                        <div style={{ maxHeight: '190px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 2 }}>
                                            {productosFiltradosBusqueda.length === 0 ? (
                                                <div style={{ padding: '0.75rem', textAlign: 'center', fontSize: '0.75rem', color: '#94a3b8' }}>
                                                    No se encontraron equipos
                                                </div>
                                            ) : (
                                                productosFiltradosBusqueda.map(prod => {
                                                    const isChecked = selectedProducts.includes(prod.id);
                                                    return (
                                                        <div
                                                            key={prod.id}
                                                            onClick={() => toggleProduct(prod.id)}
                                                            style={{
                                                                display: 'flex',
                                                                alignItems: 'center',
                                                                gap: '0.5rem',
                                                                padding: '0.4rem 0.5rem',
                                                                borderRadius: 6,
                                                                cursor: 'pointer',
                                                                background: isChecked ? 'rgba(35, 101, 171, 0.08)' : 'transparent',
                                                                transition: 'background 0.15s'
                                                            }}
                                                            onMouseEnter={e => !isChecked && (e.currentTarget.style.background = '#f8fafc')}
                                                            onMouseLeave={e => !isChecked && (e.currentTarget.style.background = 'transparent')}
                                                        >
                                                            <div style={{
                                                                width: 16,
                                                                height: 16,
                                                                borderRadius: 4,
                                                                border: isChecked ? '1.5px solid #2365AB' : '1.5px solid #cbd5e1',
                                                                background: isChecked ? '#2365AB' : '#ffffff',
                                                                display: 'flex',
                                                                alignItems: 'center',
                                                                justifyContent: 'center',
                                                                flexShrink: 0
                                                            }}>
                                                                {isChecked && <Check size={12} color="#ffffff" strokeWidth={3} />}
                                                            </div>
                                                            <div style={{ fontSize: '0.78rem', color: isChecked ? '#104166' : '#334155', fontWeight: isChecked ? 700 : 500 }}>
                                                                {prod.name || prod.nombre}
                                                            </div>
                                                        </div>
                                                    );
                                                })
                                            )}
                                        </div>
                                    </div>
                                )}
                            </div>

                            {/* Estado Remisión */}
                            <div>
                                <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 700, color: '#64748b', marginBottom: '0.35rem' }}>
                                    Estado de Remisión
                                </label>
                                <select
                                    value={selectedEstado}
                                    onChange={e => setSelectedEstado(e.target.value)}
                                    style={inputStyle}
                                >
                                    <option value="Todos">Todos los Estados</option>
                                    <option value="Activa">Activa</option>
                                    <option value="Parcial">Parcial</option>
                                    <option value="Cerrada">Cerrada</option>
                                    <option value="Pendiente">Pendiente</option>
                                </select>
                            </div>
                        </div>
                    </div>

                    {/* ─── TARJETAS DE KPIS / RESUMEN ────────────────────────────── */}
                    <div style={{
                        display: 'grid',
                        gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
                        gap: '0.75rem'
                    }}>
                        <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '12px', padding: '1rem', textAlign: 'center' }}>
                            <div style={{ fontSize: '0.7rem', color: '#64748b', fontWeight: 700, textTransform: 'uppercase' }}>Remisiones</div>
                            <div style={{ fontSize: '1.4rem', fontWeight: 800, color: '#2365AB', marginTop: 4 }}>{metricas.totalRemisiones}</div>
                        </div>

                        <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '12px', padding: '1rem', textAlign: 'center' }}>
                            <div style={{ fontSize: '0.7rem', color: '#64748b', fontWeight: 700, textTransform: 'uppercase' }}>Equipos Despachados</div>
                            <div style={{ fontSize: '1.4rem', fontWeight: 800, color: '#334155', marginTop: 4 }}>{metricas.totalEquiposDespachados}</div>
                        </div>

                        <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '12px', padding: '1rem', textAlign: 'center' }}>
                            <div style={{ fontSize: '0.7rem', color: '#64748b', fontWeight: 700, textTransform: 'uppercase' }}>Equipos en Obra (Campo)</div>
                            <div style={{ fontSize: '1.4rem', fontWeight: 800, color: '#f97316', marginTop: 4 }}>{metricas.totalEquiposEnCampo}</div>
                        </div>

                        <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '12px', padding: '1rem', textAlign: 'center' }}>
                            <div style={{ fontSize: '0.7rem', color: '#64748b', fontWeight: 700, textTransform: 'uppercase' }}>Equipos Devueltos</div>
                            <div style={{ fontSize: '1.4rem', fontWeight: 800, color: '#10b981', marginTop: 4 }}>{metricas.totalEquiposDevueltos}</div>
                        </div>

                        <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '12px', padding: '1rem', textAlign: 'center' }}>
                            <div style={{ fontSize: '0.7rem', color: '#64748b', fontWeight: 700, textTransform: 'uppercase' }}>Total Facturado</div>
                            <div style={{ fontSize: '1.2rem', fontWeight: 800, color: '#2365AB', marginTop: 4 }}>{fmtCOP(metricas.totalFacturado)}</div>
                        </div>

                        <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '12px', padding: '1rem', textAlign: 'center' }}>
                            <div style={{ fontSize: '0.7rem', color: '#64748b', fontWeight: 700, textTransform: 'uppercase' }}>Total Cobrado</div>
                            <div style={{ fontSize: '1.2rem', fontWeight: 800, color: '#10b981', marginTop: 4 }}>{fmtCOP(metricas.totalPagado)}</div>
                        </div>
                    </div>

                    {/* ─── PESTAÑAS DE VISTA PREVIA ──────────────────────────────── */}
                    <div style={{ display: 'flex', borderBottom: '1px solid #e2e8f0', gap: '1rem' }}>
                        <button
                            onClick={() => setReportType('detallado')}
                            style={{
                                background: 'none',
                                border: 'none',
                                padding: '0.6rem 0.5rem',
                                fontSize: '0.85rem',
                                fontWeight: 700,
                                cursor: 'pointer',
                                color: reportType === 'detallado' ? '#2365AB' : '#64748b',
                                borderBottom: reportType === 'detallado' ? '2px solid #2365AB' : '2px solid transparent'
                            }}
                        >
                            Vista Detallada de Remisiones ({remisionesFiltradas.length})
                        </button>
                        <button
                            onClick={() => setReportType('ingresos')}
                            style={{
                                background: 'none',
                                border: 'none',
                                padding: '0.6rem 0.5rem',
                                fontSize: '0.85rem',
                                fontWeight: 700,
                                cursor: 'pointer',
                                color: reportType === 'ingresos' ? '#2365AB' : '#64748b',
                                borderBottom: reportType === 'ingresos' ? '2px solid #2365AB' : '2px solid transparent'
                            }}
                        >
                            Ingresos por Cliente ({clientesResumen.length})
                        </button>
                        <button
                            onClick={() => setReportType('equipos')}
                            style={{
                                background: 'none',
                                border: 'none',
                                padding: '0.6rem 0.5rem',
                                fontSize: '0.85rem',
                                fontWeight: 700,
                                cursor: 'pointer',
                                color: reportType === 'equipos' ? '#2365AB' : '#64748b',
                                borderBottom: reportType === 'equipos' ? '2px solid #2365AB' : '2px solid transparent'
                            }}
                        >
                            Rotación de Ítems / Equipos ({equiposResumen.length})
                        </button>
                    </div>

                    {/* ─── TABLA DE VISTA PREVIA ─────────────────────────────────── */}
                    <div style={{
                        border: '1px solid #e2e8f0',
                        borderRadius: '12px',
                        overflowX: 'auto',
                        maxHeight: '340px'
                    }}>
                        {reportType === 'detallado' && (
                            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8rem' }}>
                                <thead style={{ background: '#f8fafc', position: 'sticky', top: 0, zIndex: 10 }}>
                                    <tr style={{ borderBottom: '1px solid #e2e8f0', color: '#64748b', textTransform: 'uppercase', fontSize: '0.7rem' }}>
                                        <th style={{ padding: '0.75rem', textAlign: 'center' }}>Remisión</th>
                                        <th style={{ padding: '0.75rem', textAlign: 'center' }}>Fecha</th>
                                        <th style={{ padding: '0.75rem', textAlign: 'left' }}>Cliente</th>
                                        <th style={{ padding: '0.75rem', textAlign: 'left' }}>Obra</th>
                                        <th style={{ padding: '0.75rem', textAlign: 'center' }}>Estado</th>
                                        <th style={{ padding: '0.75rem', textAlign: 'left' }}>Equipos Despachados</th>
                                        <th style={{ padding: '0.75rem', textAlign: 'center' }}>Devueltos</th>
                                        <th style={{ padding: '0.75rem', textAlign: 'center' }}>En Obra</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {remisionesFiltradas.length === 0 ? (
                                        <tr>
                                            <td colSpan={8} style={{ padding: '2rem', textAlign: 'center', color: '#94a3b8' }}>
                                                No se encontraron remisiones con los filtros seleccionados.
                                            </td>
                                        </tr>
                                    ) : (
                                        remisionesFiltradas.map(rem => {
                                            const cl = clients.find(c => c.id === rem.clientId);
                                            const ob = cl?.obras?.find(o => o.id === rem.obraId);
                                            const totalDesp = (rem.items || []).reduce((s, i) => s + (Number(i.cantidad) || 0), 0);
                                            const totalDev = (rem.items || []).reduce((s, i) => s + (Number(i.cantidadDevuelta) || 0), 0);
                                            const enObra = Math.max(0, totalDesp - totalDev);

                                            return (
                                                <tr key={rem.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                                                    <td style={{ padding: '0.75rem', textAlign: 'center', fontWeight: 800, color: '#2365AB' }}>
                                                        {rem.id.split('-').pop()}
                                                    </td>
                                                    <td style={{ padding: '0.75rem', textAlign: 'center', color: '#64748b' }}>
                                                        {rem.fecha}
                                                    </td>
                                                    <td style={{ padding: '0.75rem', fontWeight: 600 }}>
                                                        {cl?.name || rem.clientId}
                                                    </td>
                                                    <td style={{ padding: '0.75rem', color: '#64748b' }}>
                                                        {ob?.nombre || '—'}
                                                    </td>
                                                    <td style={{ padding: '0.75rem', textAlign: 'center' }}>
                                                        <span style={{
                                                            fontSize: '0.7rem',
                                                            fontWeight: 700,
                                                            padding: '2px 8px',
                                                            borderRadius: 999,
                                                            background: rem.estado === 'Activa' ? 'rgba(35, 101, 171, 0.1)' : rem.estado === 'Cerrada' ? 'rgba(16, 185, 129, 0.1)' : 'rgba(249, 115, 22, 0.1)',
                                                            color: rem.estado === 'Activa' ? '#2365AB' : rem.estado === 'Cerrada' ? '#10b981' : '#f97316'
                                                        }}>
                                                            {rem.estado}
                                                        </span>
                                                    </td>
                                                    <td style={{ padding: '0.75rem' }}>
                                                        {(rem.items || []).map((it, idx) => (
                                                            <div key={idx} style={{ fontSize: '0.75rem', color: '#334155' }}>
                                                                • {it.nombre || it.productId} <strong>({it.cantidad})</strong>
                                                            </div>
                                                        ))}
                                                    </td>
                                                    <td style={{ padding: '0.75rem', textAlign: 'center', color: '#10b981', fontWeight: 700 }}>
                                                        {totalDev}
                                                    </td>
                                                    <td style={{ padding: '0.75rem', textAlign: 'center', color: enObra > 0 ? '#f97316' : '#64748b', fontWeight: 700 }}>
                                                        {enObra}
                                                    </td>
                                                </tr>
                                            );
                                        })
                                    )}
                                </tbody>
                            </table>
                        )}

                        {reportType === 'ingresos' && (
                            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8rem' }}>
                                <thead style={{ background: '#f8fafc', position: 'sticky', top: 0, zIndex: 10 }}>
                                    <tr style={{ borderBottom: '1px solid #e2e8f0', color: '#64748b', textTransform: 'uppercase', fontSize: '0.7rem' }}>
                                        <th style={{ padding: '0.75rem', textAlign: 'left' }}>Cliente / Empresa</th>
                                        <th style={{ padding: '0.75rem', textAlign: 'center' }}>NIT / CC</th>
                                        <th style={{ padding: '0.75rem', textAlign: 'center' }}>Remisiones</th>
                                        <th style={{ padding: '0.75rem', textAlign: 'center' }}>Equipos en Obra</th>
                                        <th style={{ padding: '0.75rem', textAlign: 'right' }}>Total Facturado</th>
                                        <th style={{ padding: '0.75rem', textAlign: 'right' }}>Total Cobrado</th>
                                        <th style={{ padding: '0.75rem', textAlign: 'right' }}>Saldo Pendiente</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {clientesResumen.length === 0 ? (
                                        <tr>
                                            <td colSpan={7} style={{ padding: '2rem', textAlign: 'center', color: '#94a3b8' }}>
                                                Sin datos de clientes e ingresos en el período.
                                            </td>
                                        </tr>
                                    ) : (
                                        clientesResumen.map((cr, idx) => (
                                            <tr key={idx} style={{ borderBottom: '1px solid #f1f5f9' }}>
                                                <td style={{ padding: '0.75rem', fontWeight: 700, color: '#1e293b' }}>
                                                    {cr.client?.name}
                                                </td>
                                                <td style={{ padding: '0.75rem', textAlign: 'center', color: '#64748b' }}>
                                                    {cr.client?.nit || '—'}
                                                </td>
                                                <td style={{ padding: '0.75rem', textAlign: 'center', fontWeight: 600 }}>
                                                    {cr.remisionesCount}
                                                </td>
                                                <td style={{ padding: '0.75rem', textAlign: 'center', fontWeight: 700, color: cr.equiposEnCampo > 0 ? '#f97316' : '#64748b' }}>
                                                    {cr.equiposEnCampo}
                                                </td>
                                                <td style={{ padding: '0.75rem', textAlign: 'right', fontWeight: 700, color: '#2365AB' }}>
                                                    {fmtCOP(cr.ingresosFacturados)}
                                                </td>
                                                <td style={{ padding: '0.75rem', textAlign: 'right', fontWeight: 700, color: '#10b981' }}>
                                                    {fmtCOP(cr.ingresosCobrados)}
                                                </td>
                                                <td style={{ padding: '0.75rem', textAlign: 'right', fontWeight: 700, color: (cr.ingresosFacturados - cr.ingresosCobrados) > 0 ? '#ef4444' : '#64748b' }}>
                                                    {fmtCOP(Math.max(0, cr.ingresosFacturados - cr.ingresosCobrados))}
                                                </td>
                                            </tr>
                                        ))
                                    )}
                                </tbody>
                            </table>
                        )}

                        {reportType === 'equipos' && (
                            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8rem' }}>
                                <thead style={{ background: '#f8fafc', position: 'sticky', top: 0, zIndex: 10 }}>
                                    <tr style={{ borderBottom: '1px solid #e2e8f0', color: '#64748b', textTransform: 'uppercase', fontSize: '0.7rem' }}>
                                        <th style={{ padding: '0.75rem', textAlign: 'left' }}>Equipo / Ítem</th>
                                        <th style={{ padding: '0.75rem', textAlign: 'center' }}>Categoría</th>
                                        <th style={{ padding: '0.75rem', textAlign: 'center' }}>Veces Despachado</th>
                                        <th style={{ padding: '0.75rem', textAlign: 'center' }}>Total Despachado</th>
                                        <th style={{ padding: '0.75rem', textAlign: 'center' }}>Total Devuelto</th>
                                        <th style={{ padding: '0.75rem', textAlign: 'center' }}>Saldo en Obra</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {equiposResumen.length === 0 ? (
                                        <tr>
                                            <td colSpan={6} style={{ padding: '2rem', textAlign: 'center', color: '#94a3b8' }}>
                                                Sin datos de ítems o equipos para los filtros aplicados.
                                            </td>
                                        </tr>
                                    ) : (
                                        equiposResumen.map((eq, idx) => (
                                            <tr key={idx} style={{ borderBottom: '1px solid #f1f5f9' }}>
                                                <td style={{ padding: '0.75rem', fontWeight: 700, color: '#1e293b' }}>
                                                    {eq.nombre}
                                                </td>
                                                <td style={{ padding: '0.75rem', textAlign: 'center', color: '#64748b' }}>
                                                    {eq.categoria}
                                                </td>
                                                <td style={{ padding: '0.75rem', textAlign: 'center', fontWeight: 600 }}>
                                                    {eq.vecesAlquilado}
                                                </td>
                                                <td style={{ padding: '0.75rem', textAlign: 'center', fontWeight: 700 }}>
                                                    {eq.totalDespachado}
                                                </td>
                                                <td style={{ padding: '0.75rem', textAlign: 'center', color: '#10b981', fontWeight: 700 }}>
                                                    {eq.totalDevuelto}
                                                </td>
                                                <td style={{ padding: '0.75rem', textAlign: 'center', color: eq.enCampo > 0 ? '#f97316' : '#64748b', fontWeight: 800 }}>
                                                    {eq.enCampo}
                                                </td>
                                            </tr>
                                        ))
                                    )}
                                </tbody>
                            </table>
                        )}
                    </div>
                </div>

                {/* Footer Modal */}
                <div style={{
                    padding: '1rem 2rem',
                    borderTop: '1px solid #e2e8f0',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    background: '#f8fafc'
                }}>
                    <div style={{ fontSize: '0.8rem', color: '#64748b' }}>
                        Mostrando <strong>{remisionesFiltradas.length}</strong> remisiones con <strong>{metricas.totalEquiposEnCampo}</strong> equipos en campo.
                    </div>
                    <div style={{ display: 'flex', gap: '0.75rem' }}>
                        <button
                            onClick={onClose}
                            className="btn btn-secondary"
                            style={{ padding: '0.55rem 1.25rem' }}
                        >
                            Cerrar
                        </button>
                        <button
                            onClick={exportarPDF}
                            className="btn btn-primary"
                            style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: '0.5rem',
                                background: '#2365AB',
                                color: 'white',
                                padding: '0.55rem 1.25rem',
                                borderRadius: '8px',
                                fontWeight: 700
                            }}
                        >
                            <Download size={16} /> Generar y Descargar PDF
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}
