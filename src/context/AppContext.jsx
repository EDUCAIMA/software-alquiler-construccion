import React, { createContext, useState, useContext, useEffect, useCallback } from 'react';
import { format } from 'date-fns';
import Swal from 'sweetalert2';

const AppContext = createContext();
export const useAppContext = () => useContext(AppContext);

// ─── Usuarios (hardcoded, sin DB) ────────────────────────────────────────────
const USERS = [
  { id: 'U-001', username: 'admin', password: 'admin123', name: 'Administrador', role: 'admin', avatar: 'A' },
  { id: 'U-002', username: 'gerente', password: 'gerente123', name: 'Gerente General', role: 'gerente', avatar: 'G' },
  { id: 'U-003', username: 'op', password: 'op123', name: 'Operativo', role: 'operativo', avatar: 'O' },
];

// ─── Helper genérico de API ───────────────────────────────────────────────────
const api = {
  get: (url) => fetch(url).then(r => r.json()),
  post: async (url, body) => {
    const res = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    if (!res.ok) {
      const errData = await res.json().catch(() => ({}));
      throw new Error(errData.error || `Error en POST ${url} (${res.status})`);
    }
    return res.json();
  },
  put: async (url, data) => {
    const res = await fetch(url, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) });
    if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error || `Error en PUT ${url} (${res.status})`);
    }
    return res.json();
  },
  del: async (url) => {
    const res = await fetch(url, { method: 'DELETE' });
    if (!res.ok) {
      const errData = await res.json().catch(() => ({}));
      throw new Error(errData.error || `Error en DELETE ${url} (${res.status})`);
    }
    return res.json();
  },
};

export const AppProvider = ({ children }) => {

  // ── Auth ──────────────────────────────────────────────────────────────────
  const [currentUser, setCurrentUser] = useState(() => {
    try { return JSON.parse(sessionStorage.getItem('cielo_user')); } catch { return null; }
  });
  const login = (username, password) => {
    const user = USERS.find(u => u.username === username && u.password === password);
    if (user) {
      const { password: _, ...safe } = user;
      setCurrentUser(safe);
      sessionStorage.setItem('cielo_user', JSON.stringify(safe));
      return { success: true };
    }
    return { success: false, error: 'Usuario o contraseña incorrectos' };
  };
  const logout = () => { setCurrentUser(null); sessionStorage.removeItem('cielo_user'); };
  const isAdmin = currentUser?.role === 'admin';
  const isGerente = currentUser?.role === 'gerente';
  const canViewDashboard = isAdmin || isGerente;

  const checkPassword = (password) => {
    const user = USERS.find(u => u.username === currentUser?.username);
    return user && user.password === password;
  };

  // ── Estado general ────────────────────────────────────────────────────────
  const [products, setProducts] = useState([]);
  const [clients, setClients] = useState([]);
  const [invoices, setInvoices] = useState([]);
  const [cotizaciones, setCotizaciones] = useState([]);
  const [remisiones, setRemisiones] = useState([]);
  const [maintenances, setMaintenances] = useState([]);
  const [gastos, setGastos] = useState([]);
  const [empleados, setEmpleados] = useState([]);
  const [liquidaciones, setLiquidaciones] = useState([]);
  const [logs, setLogs] = useState([]);
  const [globalPreload, setGlobalPreload] = useState(null);
  const [settings, setSettings] = useState({ 
    companyName: '', shortName: '', nameComplement: '', nit: '', phone: '', email: '', logo: '', address: '', headerExtra: '' 
  });

  // ── Carga inicial desde la API ───────────────────────────────────────────
  const reloadAll = useCallback(async () => {
    try {
      const fetchSafe = (url, fallback) => api.get(url).catch(e => { console.error(`Error fetching ${url}:`, e); return fallback; });
      
      const [p, c, inv, cot, rem, maint, g, emp, liq, s] = await Promise.all([
        fetchSafe('/api/products', []),
        fetchSafe('/api/clients', []),
        fetchSafe('/api/invoices', []),
        fetchSafe('/api/cotizaciones', []),
        fetchSafe('/api/remisiones', []),
        fetchSafe('/api/maintenances', []),
        fetchSafe('/api/gastos', []),
        fetchSafe('/api/empleados', []),
        fetchSafe('/api/liquidaciones', []),
        fetchSafe('/api/settings', { companyName: 'CIELO', logo: '', headerExtra: '' }),
      ]);
      
      console.log('API Data loaded:', { products: p.length, clients: c.length, settings: s });
      
      setProducts(Array.isArray(p) ? p : []);
      setClients(Array.isArray(c) ? c : []);
      setInvoices(Array.isArray(inv) ? inv : []);
      setCotizaciones(Array.isArray(cot) ? cot : []);
      setRemisiones(Array.isArray(rem) ? rem : []);
      setMaintenances(Array.isArray(maint) ? maint : []);
      setGastos(Array.isArray(g) ? g : []);
      setEmpleados(Array.isArray(emp) ? emp : []);
      setLiquidaciones(Array.isArray(liq) ? liq : []);
      if (s && !s.error) setSettings(s);
    } catch (err) {
      console.error('Error crítico en reloadAll:', err);
    }
  }, []);

  useEffect(() => { reloadAll(); }, [reloadAll]);

  // ─── HELPERS ─────────────────────────────────────────────────────────────
  const logAction = (action, product, client, type) => {
    setLogs(prev => [{ id: Date.now(), action, product, client, time: format(new Date(), 'yyyy-MM-dd hh:mm a'), type }, ...prev]);
  };

  const nextId = (list, prefix, minStart = 1) => {
    const padSize = prefix === '' ? 2 : 3;
    const separator = prefix === '' ? '' : '-';
    if (!list || list.length === 0) return `${prefix}${separator}${String(minStart).padStart(padSize, '0')}`;
    const ids = list.map(item => {
      const match = item.id ? String(item.id).match(/\d+$/) : null;
      return match ? parseInt(match[0], 10) : 0;
    });
    const maxId = Math.max(...ids, minStart - 1);
    return `${prefix}${separator}${String(maxId + 1).padStart(padSize, '0')}`;
  };

  // ─── CLIENTS CRUD ─────────────────────────────────────────────────────────
  const addClient = async (client) => {
    const id = nextId(clients, 'C');
    const firstObra = client.primeraObra
      ? [{ id: `${id}-1`, nombre: client.primeraObra, ubicacion: client.obraUbicacion || '', estado: 'Activa', presupuesto: Number(client.obraPresupuesto) || 0, fechaInicio: format(new Date(), 'yyyy-MM-dd'), descripcion: '' }]
      : [];
    const { primeraObra: _, obraUbicacion: __, obraPresupuesto: ___, ...rest } = client;
    const newClient = { ...rest, id, debt: 0, joined: format(new Date(), 'yyyy-MM-dd'), obras: firstObra };
    await api.post('/api/clients', newClient);
    await reloadAll();
    logAction('Cliente Creado', id, newClient.name, 'system');
  };

  const editClient = async (clientId, updatedData) => {
    const current = clients.find(c => c.id === clientId);
    if (!current) return;
    const updated = { ...current, ...updatedData };
    await api.put(`/api/clients/${clientId}`, updated);
    await reloadAll();
  };
  const deleteClient = async (clientId) => {
    await api.del(`/api/clients/${clientId}`);
    await reloadAll();
    logAction('Cliente Eliminado', clientId, '', 'system');
  };

  // ── Obra CRUD (embebida en client.obras como JSONB) ─────────────────────
  const addObra = async (clientId, obra) => {
    const current = clients.find(c => c.id === clientId);
    if (!current) return;
    const newId = `${clientId}-${current.obras.length + 1}`;
    const newObraObj = { ...obra, id: newId, fechaInicio: obra.fechaInicio || format(new Date(), 'yyyy-MM-dd') };
    const updated = { ...current, obras: [...current.obras, newObraObj] };
    await api.put(`/api/clients/${clientId}`, updated);
    await reloadAll();
  };

  const editObra = async (clientId, obraId, data) => {
    const current = clients.find(c => c.id === clientId);
    if (!current) return;
    const updated = { ...current, obras: current.obras.map(o => o.id === obraId ? { ...o, ...data } : o) };
    await api.put(`/api/clients/${clientId}`, updated);
    await reloadAll();
  };

  // ─── PRODUCTS CRUD ────────────────────────────────────────────────────────
  const addProduct = async (product) => {
    const newProduct = {
      ...product,
      id: nextId(products, '', 1),
      totalStock: product.totalStock || 1,
      availableStock: product.totalStock || 1
    };
    await api.post('/api/products', newProduct);
    await reloadAll();
    logAction('Product Created', product.name, 'System Admin', 'system');
  };

  const editProduct = async (productId, updatedData) => {
    const current = products.find(p => p.id === productId);
    if (!current) return;
    const finalProduct = { ...current, ...updatedData, availableStock: updatedData.totalStock - (current.totalStock - current.availableStock) };
    await api.put(`/api/products/${productId}`, finalProduct);
    await reloadAll();
    logAction('Product Edited', updatedData.name, 'System Admin', 'system');
  };

  const deleteProduct = async (productId) => {
    await api.del(`/api/products/${productId}`);
    await reloadAll();
    logAction('Product Deleted', productId, 'System Admin', 'system');
  };

  const darDeBajaProduct = async (productId, motivo) => {
    const current = products.find(p => p.id === productId);
    if (!current) return;
    const updated = { ...current, estado: 'Dado de baja', motivoBaja: motivo, fechaBaja: format(new Date(), 'yyyy-MM-dd'), availableStock: 0 };
    await api.put(`/api/products/${productId}`, updated);
    await reloadAll();
    logAction('Equipo Dado de Baja', current.name, 'System Admin', 'system');
  };

  const returnProduct = async (productId, quantity, clientId) => {
    const current = products.find(p => p.id === productId);
    if (!current) return;
    const finalProduct = { ...current, availableStock: Math.min(current.totalStock, current.availableStock + quantity) };
    await api.put(`/api/products/${productId}`, finalProduct);
    await reloadAll();
    const client = clients.find(c => c.id === clientId);
    logAction('Rental Return', `${quantity}x ${current.name}`, client?.name || 'Unknown', 'entry');
  };

  // ─── INVOICES CRUD ────────────────────────────────────────────────────────
  const createInvoice = async (invoiceDetails) => {
    const subtotal = invoiceDetails.items.reduce((t, i) => t + (i.quantity * i.days * i.price), 0);
    const client = clients.find(c => c.id === invoiceDetails.clientId);
    const iva = client?.responsableIVA ? Math.round(subtotal * (client?.porcIVA || 0) / 100) : 0;
    const ret = Math.round(subtotal * (client?.porcRetencion || 0) / 100);
    const amount = subtotal + iva + ret;

    const newInvoice = {
      ...invoiceDetails,
      id: nextId(invoices, 'F-'),
      amount,
      status: 'Pending',
      date: format(new Date(), 'yyyy-MM-dd'),
      remisionEnabled: false,
      remisionCreada: false,
    };
    await api.post('/api/invoices', newInvoice);

    // Actualizar deuda del cliente
    if (client) {
      await api.put(`/api/clients/${client.id}`, { ...client, debt: client.debt + amount });
    }

    await reloadAll();
    sendEmail(client?.email || 'N/A', newInvoice);
    logAction('Rental Order Generated', `Invoice ${newInvoice.id}`, client?.name || 'Unknown', 'exit');
  };

  // ─── Crear factura directamente desde una cotización aprobada ─────────────
  const createInvoiceFromCotizacion = async (cotizacionId, extraCotData = {}) => {
    try {
      console.log('🚀 CREATE INVOICE FROM COTIZACION:', cotizacionId);
      const cot = cotizaciones.find(c => c.id === cotizacionId);
      if (!cot) throw new Error('Cotización no encontrada');

      const items = cot.items.map(i => ({
        productId: i.productId,
        nombre: i.nombre || i.name,
        quantity: i.cantidad,
        days: i.dias,
        price: i.tarifaDia,
      }));
      const subtotal = items.reduce((t, i) => t + (i.quantity * i.days * i.price), 0);
      const client = clients.find(c => c.id === cot.clientId);
      const iva = client?.responsableIVA ? Math.round(subtotal * (client?.porcIVA || 0) / 100) : 0;
      const ret = Math.round(subtotal * (client?.porcRetencion || 0) / 100);
      const amount = subtotal + iva + ret + (Number(cot.transporte) || 0);

      const newInvoice = {
        clientId: cot.clientId,
        obraId: cot.obraId,
        cotizacionId,
        items,
        amount,
        status: 'Pending',
        date: format(new Date(), 'yyyy-MM-dd'),
        remisionEnabled: false,
        remisionCreada: false,
        id: nextId(invoices, 'F-'),
      };
      await api.post('/api/invoices', newInvoice);

      // Actualizar deuda del cliente
      if (client) {
        await api.put(`/api/clients/${client.id}`, { ...client, debt: (client.debt || 0) + amount });
      }

      // Marcar cotización como Facturada
      await api.put(`/api/cotizaciones/${cotizacionId}`, { ...cot, ...extraCotData, estado: 'Facturada', facturaId: newInvoice.id });

      await reloadAll();
      Swal.fire({
        title: '¡Factura Creada!',
        text: 'La factura ha sido generada con éxito. Puede verla y descargarla en el módulo de Facturación.',
        icon: 'success',
        confirmButtonColor: '#10b981',
        confirmButtonText: 'Entendido'
      });
    } catch (e) {
      console.error('ERROR FACTURANDO:', e);
      Swal.fire({
        title: 'Error al Facturar',
        text: e.message,
        icon: 'error',
        confirmButtonColor: '#ef4444'
      });
    }
  };

  const payInvoice = async (invoiceId, paidAmount, paymentType) => {
    const invoice = invoices.find(inv => inv.id === invoiceId);
    if (!invoice) return;
    
    let newStatus = 'Paid';
    if (paymentType === 'Abono' && paidAmount < invoice.amount) {
      newStatus = 'Partial';
    } else if (paymentType === 'Credito') {
      newStatus = 'Credito';
      paidAmount = 0;
    }

    const updated = { 
      ...invoice, 
      status: newStatus, 
      paidAmount: (invoice.paidAmount || 0) + paidAmount,
      paymentType: paymentType,
      paidDate: paidAmount > 0 ? format(new Date(), 'yyyy-MM-dd') : invoice.paidDate, 
      remisionEnabled: true,
      abonos: paidAmount > 0 
        ? [...(invoice.abonos || []), { monto: paidAmount, fecha: format(new Date(), 'yyyy-MM-dd'), tipo: paymentType }]
        : (invoice.abonos || [])
    };
    
    await api.put(`/api/invoices/${invoiceId}`, updated);

    // Si no se ha creado remisión aún, crearla automáticamente en estado 'Pendiente'
    if (!invoice.remisionCreada) {
      await createPendingRemision(updated);
    }

    // Actualizar deuda del cliente
    const client = clients.find(c => c.id === invoice.clientId);
    if (client && paidAmount > 0) {
      await api.put(`/api/clients/${client.id}`, { ...client, debt: Math.max(0, client.debt - paidAmount) });
    }

    await reloadAll();
    logAction('Pago Registrado', `Factura ${invoiceId} - ${paymentType}: $${paidAmount.toLocaleString()}`, client?.name || 'Unknown', 'entry');
  };

  const addCorteObra = async (invoiceId, corteData) => {
    const inv = invoices.find(i => i.id === invoiceId);
    if (!inv) return null;
    const newCorte = { ...corteData, id: Date.now(), status: 'Pendiente' };
    const updated = {
      ...inv,
      cortes: [...(inv.cortes || []), newCorte]
    };
    
    // Actualizar estado local inmediatamente para reflejo en UI
    setInvoices(prev => prev.map(i => i.id === invoiceId ? updated : i));

    await api.put(`/api/invoices/${invoiceId}`, updated);
    await reloadAll();
    return newCorte.id;
  };

  const updateCorteStatus = async (invoiceId, corteId, newStatus) => {
    const inv = invoices.find(i => i.id === invoiceId);
    if (!inv) return;
    const updated = {
      ...inv,
      cortes: (inv.cortes || []).map(c => c.id === corteId ? { ...c, status: newStatus } : c)
    };
    
    setInvoices(prev => prev.map(i => i.id === invoiceId ? updated : i));

    await api.put(`/api/invoices/${invoiceId}`, updated);
    await reloadAll();
  };

  // Marcar factura como remisionCreada (llamado desde Remisiones al crear la remisión desde ella)
  const marcarRemisionCreada = async (invoiceId) => {
    const invoice = invoices.find(inv => inv.id === invoiceId);
    if (!invoice) return;
    await api.put(`/api/invoices/${invoiceId}`, { ...invoice, remisionCreada: true });
    await reloadAll();
  };

  const deleteInvoice = async (invoiceId) => {
    const invoice = invoices.find(inv => inv.id === invoiceId);
    if (!invoice) throw new Error('No se encontró el registro de facturación para eliminar.');

    // Si la factura está pendiente, restamos de la deuda del cliente
    if (invoice.status === 'Pending') {
      const client = clients.find(c => c.id === invoice.clientId);
      if (client) {
        await api.put(`/api/clients/${client.id}`, { ...client, debt: Math.max(0, client.debt - invoice.amount) });
      }
    }

    // Si la factura viene de una cotización, resetear el estado de la cotización
    if (invoice.cotizacionId) {
      const cot = cotizaciones.find(c => c.id === invoice.cotizacionId);
      if (cot) {
        await api.put(`/api/cotizaciones/${cot.id}`, { ...cot, estado: 'Aprobada', facturaId: null });
      }
    }

    await api.del(`/api/invoices/${invoiceId}`);
    await reloadAll();
    logAction('Invoice Deleted', invoiceId, '', 'system');
  };

  // ─── MAINTENANCE CRUD ─────────────────────────────────────────────────────
  const addMaintenance = async (maint) => {
    const newM = { ...maint, id: nextId(maintenances, 'M'), date: format(new Date(), 'yyyy-MM-dd') };
    await api.post('/api/maintenances', newM);
    await reloadAll();
    const product = products.find(p => p.id === maint.productId);
    logAction('Mantenimiento Registrado', product?.name || maint.productId, 'Sistema', 'system');
  };

  const editMaintenance = async (maintId, data) => {
    const current = maintenances.find(m => m.id === maintId);
    if (!current) return;
    await api.put(`/api/maintenances/${maintId}`, { ...current, ...data });
    await reloadAll();
  };

  // ─── REMISIONES CRUD ──────────────────────────────────────────────────────
  const addRemision = async (data) => {
    // Bloqueo de mantenimiento pendiente
    for (const item of data.items) {
      const hasPending = maintenances.some(
        m => m.productId === item.productId && (m.status === 'Pendiente' || m.status === 'En Proceso')
      );
      if (hasPending) {
        const prod = products.find(p => p.id === item.productId);
        throw new Error(`BLOQUEO: "${prod?.name || item.productId}" tiene un mantenimiento pendiente o en proceso.`);
      }
    }

    const id = nextId(remisiones, 'REM');
    const nueva = { ...data, id, fecha: data.fecha || format(new Date(), 'yyyy-MM-dd'), estado: 'Activa', items: data.items.map(i => ({ ...i, cantidadDevuelta: 0 })) };
    await api.post('/api/remisiones', nueva);

    // Reducir stock de productos
    for (const item of nueva.items) {
      const prod = products.find(p => p.id === item.productId);
      if (prod) {
        await api.put(`/api/products/${prod.id}`, { ...prod, availableStock: Math.max(0, prod.availableStock - item.cantidad) });
      }
    }

    await reloadAll();
    
    // Generar Factura Automática para Remisiones Manuales
    if (!data.facturaId && !data.cotizacionId) {
        try {
            console.log('📦 INICIANDO FACTURACIÓN AUTOMÁTICA PARA REMISIÓN:', id);
            
            const invoiceItems = nueva.items.map(i => {
                const prod = products.find(p => p.id === i.productId);
                return {
                    productId: i.productId,
                    name: i.nombre || prod?.nombre || prod?.name || 'Equipo',
                    quantity: Number(i.cantidad),
                    days: 1, 
                    price: Number(i.tarifaDia || prod?.value || 0)
                };
            });

            const subtotal = invoiceItems.reduce((t, i) => t + (i.quantity * i.days * i.price), 0);
            const client = clients.find(c => c.id === data.clientId);
            const iva = client?.responsableIVA ? Math.round(subtotal * (client?.porcIVA || 0) / 100) : 0;
            const ret = Math.round(subtotal * (client?.porcRetencion || 0) / 100);
            const totalAmount = subtotal + iva + ret + (Number(nueva.transporte) || 0);

            // Usar formato de ID estándar para evitar problemas de filtro
            const autoInvoiceId = nextId(invoices, 'F-');

            const autoInvoice = {
                id: autoInvoiceId,
                clientId: data.clientId,
                obraId: data.obraId,
                items: invoiceItems,
                amount: totalAmount,
                status: 'Pending',
                date: nueva.fecha,
                remisionEnabled: true,
                remisionCreada: true,
                manualRemisionId: id,
                notas: `Generada desde Remisión Manual ${id}`
            };

            await api.post('/api/invoices', autoInvoice);
            
            if (client) {
                await api.put(`/api/clients/${client.id}`, { ...client, debt: (client.debt || 0) + totalAmount });
            }
            
            await api.put(`/api/remisiones/${id}`, { ...nueva, facturaId: autoInvoiceId });
            await reloadAll();
            
            console.log('✅ FACTURA AUTOMÁTICA VINCULADA:', autoInvoiceId);
        } catch (invErr) {
            console.error('❌ ERROR CRÍTICO EN FACTURACIÓN AUTOMÁTICA:', invErr);
            Swal.fire({
                title: 'Error de Sincronización',
                text: 'La remisión se creó pero no se pudo generar la factura en Comercio automáticamente.',
                icon: 'warning',
                confirmButtonColor: '#f59e0b'
            });
        }
    }

    const client = clients.find(c => c.id === data.clientId);
    logAction('Remisión Creada', `${id} — ${nueva.items.length} equipo(s)`, client?.name || 'N/A', 'exit');
    return nueva;
  };

  const createPendingRemision = async (invoice) => {
    // Intentar usar el mismo consecutivo numérico de la cotización/factura
    let remId = nextId(remisiones, 'REM');
    const consecutive = invoice.id.split('-').pop();
    const candidateId = `REM-${consecutive}`;
    
    // Si no existe ya una remisión con ese ID, lo usamos para mantener consistencia con Comercio
    if (!remisiones.some(r => r.id === candidateId)) {
        remId = candidateId;
    }

    const newRem = {
        id: remId,
        clientId: invoice.clientId,
        obraId: invoice.obraId,
        fecha: format(new Date(), 'yyyy-MM-dd'),
        items: invoice.items.map(i => {
            const prod = products.find(p => p.id === i.productId);
            return { 
                productId: i.productId,
                nombre: i.nombre || i.name || prod?.nombre || prod?.name || 'Equipo sin nombre',
                cantidad: i.quantity || i.cantidad || 0,
                tarifaDia: i.price || i.tarifaDia || 0,
                cantidadDevuelta: 0 
            };
        }),
        estado: 'Pendiente', // Estado especial para identificar que viene de facturación
        notas: `Generada automáticamente desde Factura ${invoice.id}`,
        cotizacionId: invoice.cotizacionId || null,
        facturaId: invoice.id
    };

    await api.post('/api/remisiones', newRem);
    
    // Reducir stock de productos inmediatamente para reservar los equipos
    for (const item of newRem.items) {
      const prod = products.find(p => p.id === item.productId);
      if (prod) {
        await api.put(`/api/products/${prod.id}`, { ...prod, availableStock: Math.max(0, prod.availableStock - item.cantidad) });
      }
    }

    // Marcar la factura como remisión creada para que no se duplique
    await api.put(`/api/invoices/${invoice.id}`, { ...invoice, remisionCreada: true });
  };

  const editRemision = async (remId, data) => {
    const current = remisiones.find(r => r.id === remId);
    if (!current) return;
    await api.put(`/api/remisiones/${remId}`, { ...current, ...data });
    await reloadAll();
  };

  const registrarDevolucion = async (clientId, obraId, devoluciones, fecha) => {
    // 1. Identificar remisiones candidatas (Activas o Parciales para el cliente/obra)
    const targetRems = (remisiones || [])
      .filter(r => r.clientId === clientId && r.obraId === obraId && (r.estado === 'Activa' || r.estado === 'Parcial'))
      .sort((a, b) => a.fecha.localeCompare(b.fecha) || a.id.localeCompare(b.id));

    if (targetRems.length === 0) return;

    // Clonamos las remisiones candidatas para trabajar sobre ellas
    const updatedRemsMap = {};
    targetRems.forEach(r => {
        updatedRemsMap[r.id] = JSON.parse(JSON.stringify(r));
    });

    const stockReintegrar = {};
    const modifiedIds = new Set();

    // 2. Procesar cada producto a devolver aplicando PEPS
    for (const { productId, cantidad } of devoluciones) {
      let restante = cantidad;
      
      for (const rem of targetRems) {
        if (restante <= 0) break;
        
        const remToUpdate = updatedRemsMap[rem.id];
        const itemIdx = remToUpdate.items.findIndex(i => i.productId === productId);
        if (itemIdx === -1) continue;
        
        const item = remToUpdate.items[itemIdx];
        const pendiente = item.cantidad - (item.cantidadDevuelta || 0);
        if (pendiente <= 0) continue;
        
        const descuento = Math.min(restante, pendiente);
        
        // Registrar la devolución
        item.cantidadDevuelta = (item.cantidadDevuelta || 0) + descuento;
        if (!item.devoluciones) item.devoluciones = [];
        item.devoluciones.push({ 
            cantidad: descuento, 
            fecha: fecha || format(new Date(), 'yyyy-MM-dd') 
        });
        
        restante -= descuento;
        stockReintegrar[productId] = (stockReintegrar[productId] || 0) + descuento;
        modifiedIds.add(rem.id);
      }
    }

    // 3. Actualizar estados y persistir solo las remisiones modificadas
    for (const id of modifiedIds) {
      const rem = updatedRemsMap[id];
      const total = rem.items.reduce((s, i) => s + (Number(i.cantidad) || 0), 0);
      const devuelto = rem.items.reduce((s, i) => s + (Number(i.cantidadDevuelta) || 0), 0);
      
      rem.estado = devuelto === 0 ? 'Activa' : devuelto >= total ? 'Cerrada' : 'Parcial';
      
      await api.put(`/api/remisiones/${rem.id}`, rem);
    }

    // 4. Reintegrar stock de productos
    for (const [productId, devuelto] of Object.entries(stockReintegrar)) {
      const prod = products.find(p => p.id === productId);
      if (prod && devuelto > 0) {
        await api.put(`/api/products/${productId}`, { 
            ...prod, 
            availableStock: Math.min(prod.totalStock, prod.availableStock + devuelto) 
        });
      }
    }

    await reloadAll();
    const client = clients.find(c => c.id === clientId);
    logAction('Devolución PEPS Aplicada', `Obra ${obraId} - ${devoluciones.length} producto(s)`, client?.name || 'N/A', 'entry');
  };

  const deleteRemision = async (remId) => {
    const rem = remisiones.find(r => r.id === remId);
    if (!rem) return;

    // 1. Reintegrar stock de lo que NO se ha devuelto aún
    for (const item of rem.items) {
      const prod = products.find(p => p.id === item.productId);
      const pendiente = item.cantidad - (item.cantidadDevuelta || 0);
      if (prod && pendiente > 0) {
        await api.put(`/api/products/${prod.id}`, { 
          ...prod, 
          availableStock: Math.min(prod.totalStock, prod.availableStock + pendiente) 
        });
      }
    }

    // 2. Si venía de una factura, intentar desmarcarla
    const potentialInvId = rem.invoiceId || (typeof rem.id === 'string' ? rem.id.replace('REM-', 'INV-') : null);
    const inv = invoices.find(i => i.id === potentialInvId);
    if (inv) {
      await api.put(`/api/invoices/${inv.id}`, { ...inv, remisionCreada: false });
    }

    // 3. Eliminar
    await api.del(`/api/remisiones/${remId}`);
    await reloadAll();
    logAction('Remisión Eliminada', remId, '', 'system');
  };

  const cancelRemision = async (remId) => {
    const rem = remisiones.find(r => r.id === remId);
    if (!rem || rem.estado === 'Cancelada') return;

    // 1. Reintegrar stock de lo pendiente
    for (const item of rem.items) {
      const prod = products.find(p => p.id === item.productId);
      const pendiente = item.cantidad - (item.cantidadDevuelta || 0);
      if (prod && pendiente > 0) {
        await api.put(`/api/products/${prod.id}`, { 
          ...prod, 
          availableStock: Math.min(prod.totalStock, prod.availableStock + pendiente) 
        });
      }
    }

    // 2. Desvincular de la factura (permitir re-remisionar)
    const potentialInvId = rem.invoiceId || (typeof rem.id === 'string' ? rem.id.replace('REM-', 'F-') : null);
    const inv = invoices.find(i => i.id === potentialInvId);
    if (inv) {
      await api.put(`/api/invoices/${inv.id}`, { ...inv, remisionCreada: false });
    }

    // 3. Marcar como Cancelada
    await api.put(`/api/remisiones/${remId}`, { ...rem, estado: 'Cancelada' });
    await reloadAll();
    logAction('Anular Remisión', remId, '', 'system');
  };

  // ─── COTIZACIONES CRUD ────────────────────────────────────────────────────
  const addCotizacion = async (data) => {
    const id = nextId(cotizaciones, 'C-');
    const defaultClausulas = [
        '1. El ARRENDATARIO se compromete a utilizar los equipos únicamente en la obra indicada y a devolverlos en perfectas condiciones de funcionamiento.',
        '2. Cualquier daño, pérdida o robo de los equipos será de responsabilidad exclusiva del ARRENDATARIO.',
        '3. Los días de alquiler se calculan desde la fecha indicada en cada remisión hasta su correspondiente devolución (lógica PEPS).',
        '4. El incumplimiento en el pago generará intereses de mora del 1.5% mensual sobre el saldo pendiente.',
        '5. Este contrato se rige por las leyes colombianas. Las partes se someten a los jueces competentes de la ciudad de Bogotá D.C.',
        '6. Forma de pago: ' + (data.metodoPago || 'Acordada entre las partes.'),
        '7. Transporte: ' + (data.responsableTransporte || 'Acordado entre las partes.'),
    ];
    const nueva = { ...data, id, fecha: format(new Date(), 'yyyy-MM-dd'), estado: 'Borrador', habeasData: false, habeasDataTimestamp: null, firma: null, foto: null, clausulas: data.clausulas || defaultClausulas };
    await api.post('/api/cotizaciones', nueva);
    await reloadAll();
    const client = clients.find(c => c.id === data.clientId);
    logAction('Cotización Creada', id, client?.name || 'N/A', 'system');
    return nueva;
  };

  const actualizarEstadoCotizacion = async (cotId, nuevoEstado, extra = {}) => {
    try {
      console.log('🚀 ACTUALIZAR ESTADO COTIZACION:', { cotId, nuevoEstado, extra });
      const current = cotizaciones.find(c => c.id === cotId);
      if (!current) throw new Error('Cotización no encontrada localmente');
      console.log('🚀 PROCESANDO API.PUT:', `/api/cotizaciones/${cotId}`, { ...current, estado: nuevoEstado, ...extra });
      await api.put(`/api/cotizaciones/${cotId}`, { ...current, estado: nuevoEstado, ...extra });
      await reloadAll();
      logAction(`Cotización ${nuevoEstado}`, cotId, '', 'system');
      Swal.fire({
        title: 'Estado Actualizado',
        text: `La cotización ha sido marcada como ${nuevoEstado} con éxito.`,
        icon: 'success',
        confirmButtonColor: '#2365AB'
      });
    } catch (e) {
      console.error('❌ ERROR ACTUALIZANDO ESTADO:', e);
      Swal.fire({
        title: 'Error',
        text: e.message,
        icon: 'error',
        confirmButtonColor: '#ef4444'
      });
    }
  };

  const updateCotizacion = async (cotId, data) => {
    const current = cotizaciones.find(c => c.id === cotId);
    if (!current) return;
    await api.put(`/api/cotizaciones/${cotId}`, { ...current, ...data });
    await reloadAll();
    logAction('Cotización Actualizada', cotId, '', 'system');
  };

  const deleteCotizacion = async (cotId) => {
    const cot = cotizaciones.find(c => c.id === cotId);
    if (!cot) throw new Error('No se encontró la cotización para eliminar.');
    
    if (cot.facturaId) {
      throw new Error('No se puede eliminar una cotización que ya tiene factura asociada.');
    }

    await api.del(`/api/cotizaciones/${cotId}`);
    await reloadAll();
    logAction('Cotización Eliminada', cotId, '', 'system');
  };

  // ─── GASTOS CRUD ──────────────────────────────────────────────────────────
  const addGasto = async (data) => {
    const id = nextId(gastos, 'G');
    const nuevo = { ...data, id, monto: Number(data.monto), iva: Number(data.iva || 0) };
    await api.post('/api/gastos', nuevo);
    await reloadAll();
    logAction('Gasto Registrado', `${id} — ${data.concepto}`, data.proveedor || 'N/A', 'exit');
  };

  const pagarGasto = async (id) => {
    const current = gastos.find(g => g.id === id);
    if (!current) return;
    await api.put(`/api/gastos/${id}`, { ...current, estado: 'Pagado' });
    await reloadAll();
    logAction('Gasto Pagado', id, '', 'system');
  };

  // ─── EMPLEADOS + NÓMINA ───────────────────────────────────────────────────
  const addEmpleado = async (data) => {
    const id = nextId(empleados, 'EMP');
    const nuevo = { ...data, id, salarioDia: Number(data.salarioDia), activo: true };
    await api.post('/api/empleados', nuevo);
    await reloadAll();
    logAction('Empleado Registrado', id, data.nombre, 'system');
  };

  const addLiquidacion = async (data) => {
    const id = nextId(liquidaciones, 'LIQ');
    const nueva = { ...data, id, estado: 'Pendiente' };
    await api.post('/api/liquidaciones', nueva);
    await reloadAll();
    const emp = empleados.find(e => e.id === data.empleadoId);
    logAction('Liquidación Nómina', id, emp?.nombre || data.empleadoId, 'system');
  };

  const pagarLiquidacion = async (id) => {
    const current = liquidaciones.find(l => l.id === id);
    if (!current) return;
    await api.put(`/api/liquidaciones/${id}`, { ...current, estado: 'Pagado' });
    await reloadAll();
    logAction('Nómina Pagada', id, '', 'system');
  };
  


  const updateSettings = async (data) => {
    await api.put('/api/settings', data);
    await reloadAll();
    logAction('Configuración Actualizada', 'Empresa', currentUser?.name, 'system');
  };

  const sendEmail = (email, invoice) => {
    console.log(`[Email] To: ${email} | Invoice: ${invoice.id} | Amount: $${invoice.amount}`);
    logAction('Auto-Email Sent', `Invoice ${invoice.id}`, email, 'system');
  };

  return (
    <AppContext.Provider value={{
      // Auth
      currentUser, login, logout, canViewDashboard, isAdmin, isGerente,
      // Clients
      clients, setClients, addClient, editClient, deleteClient, addObra, editObra,
      // Products
      products, setProducts, addProduct, editProduct, returnProduct, deleteProduct, darDeBajaProduct,
      // Invoices
      invoices, setInvoices, createInvoice, payInvoice, addCorteObra, updateCorteStatus, createInvoiceFromCotizacion, marcarRemisionCreada, deleteInvoice,
      // Other
      logs, maintenances, addMaintenance, editMaintenance,
      // Remisiones
      remisiones, addRemision, editRemision, registrarDevolucion, deleteRemision, cancelRemision,
      // Cotizaciones
      cotizaciones, addCotizacion, actualizarEstadoCotizacion, updateCotizacion, deleteCotizacion,
      // Gastos
      gastos, addGasto, pagarGasto,
      empleados, addEmpleado,
      liquidaciones, addLiquidacion, pagarLiquidacion,
      // Settings
      settings, updateSettings,
      // Auth Utils
      checkPassword,
      globalPreload, setGlobalPreload
    }}>
      {children}
    </AppContext.Provider>
  );
};
