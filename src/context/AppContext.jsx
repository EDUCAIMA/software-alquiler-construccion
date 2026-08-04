import React, { createContext, useState, useContext, useEffect, useCallback } from 'react';
import { format } from 'date-fns';
import Swal from 'sweetalert2';

const AppContext = createContext();
export const useAppContext = () => useContext(AppContext);

// ─── Usuarios (Cargados de DB) ────────────────────────────────────────────────

// ─── Helper genérico de API ───────────────────────────────────────────────────
const API_BASE_URL = import.meta.env.VITE_API_URL || '';

const api = {
  get: (url) => fetch(API_BASE_URL + url).then(r => r.json()),
  post: async (url, body) => {
    const res = await fetch(API_BASE_URL + url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    if (!res.ok) {
      const errData = await res.json().catch(() => ({}));
      throw new Error(errData.error || `Error en POST ${url} (${res.status})`);
    }
    return res.json();
  },
  put: async (url, data) => {
    const res = await fetch(API_BASE_URL + url, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) });
    if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error || `Error en PUT ${url} (${res.status})`);
    }
    return res.json();
  },
  del: async (url) => {
    const res = await fetch(API_BASE_URL + url, { method: 'DELETE' });
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
  const login = async (username, password) => {
    try {
      const data = await api.post('/api/auth/login', { username, password });
      setCurrentUser(data);
      sessionStorage.setItem('cielo_user', JSON.stringify(data));
      return { success: true };
    } catch (e) {
      return { success: false, error: e.message || 'Usuario o contraseña incorrectos' };
    }
  };
  const logout = () => { setCurrentUser(null); sessionStorage.removeItem('cielo_user'); };
  const isAdmin = currentUser?.role === 'admin';
  const isGerente = currentUser?.role === 'gerente';
  const canViewDashboard = isAdmin || isGerente;

  const checkPassword = async (password) => {
    try {
      const { isValid } = await api.post('/api/auth/check-password', {
        username: currentUser?.username,
        password
      });
      return isValid;
    } catch (e) {
      console.error('Error verifying password:', e);
      return false;
    }
  };

  // ── Estado general ────────────────────────────────────────────────────────
  const [products, setProducts] = useState([]);
  const [clients, setClients] = useState([]);
  const [invoices, setInvoices] = useState([]);
  const [cotizaciones, setCotizaciones] = useState([]);
  const [remisiones, setRemisiones] = useState([]);
  const [maintenances, setMaintenances] = useState([]);
  const [gastos, setGastos] = useState([]);
  const [gastosMantenimiento, setGastosMantenimiento] = useState([]);
  const [empleados, setEmpleados] = useState([]);
  const [liquidaciones, setLiquidaciones] = useState([]);
  const [logs, setLogs] = useState([]);
  const [users, setUsers] = useState([]);
  const [providers, setProviders] = useState([]);
  const [globalPreload, setGlobalPreload] = useState(null);
  const [settings, setSettings] = useState({ 
    companyName: '', shortName: '', nameComplement: '', nit: '', phone: '', email: '', logo: '', address: '', headerExtra: '' 
  });

  const addUser = async (userData) => {
    const newUser = await api.post('/api/users', userData);
    setUsers(prev => [...prev, newUser]);
    return newUser;
  };

  const deleteUser = async (id) => {
    await api.del(`/api/users/${id}`);
    setUsers(prev => prev.filter(u => u.id !== id));
  };

  // ── Carga inicial desde la API ───────────────────────────────────────────
  const reloadAll = useCallback(async () => {
    try {
      const fetchSafe = (url, fallback) => api.get(url).catch(e => { console.error(`Error fetching ${url}:`, e); return fallback; });
      
      const [p, c, inv, cot, rem, maint, g, emp, liq, s, gm, lgs, usrs, provs] = await Promise.all([
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
        fetchSafe('/api/gastos-mantenimiento', []),
        fetchSafe('/api/logs', []),
        fetchSafe('/api/users', []),
        fetchSafe('/api/providers', []),
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
      setGastosMantenimiento(Array.isArray(gm) ? gm : []);
      setLogs(Array.isArray(lgs) ? lgs : []);
      setUsers(Array.isArray(usrs) ? usrs : []);
      setProviders(Array.isArray(provs) ? provs : []);
      if (s && !s.error) setSettings(s);
    } catch (err) {
      console.error('Error crítico en reloadAll:', err);
    }
  }, []);

  useEffect(() => { reloadAll(); }, [reloadAll]);

  // ─── HELPERS ─────────────────────────────────────────────────────────────
  const logAction = async (action, product, client, type) => {
    const timeStr = format(new Date(), 'yyyy-MM-dd hh:mm a');
    try {
      const { data } = await api.post('/api/logs', {
        action,
        product: product ? String(product) : '',
        client: client ? String(client) : '',
        time: timeStr,
        type: type || 'system'
      });
      setLogs(prev => [data, ...prev]);
    } catch (e) {
      console.error('Error recording log:', e);
      setLogs(prev => [{ id: Date.now(), action, product, client, time: timeStr, type: type || 'system' }, ...prev]);
    }
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

  // ─── PROVIDERS CRUD ───────────────────────────────────────────────────────
  const addProvider = async (provider) => {
    const id = nextId(providers, 'P');
    const newProvider = { ...provider, id, joined: format(new Date(), 'yyyy-MM-dd') };
    await api.post('/api/providers', newProvider);
    await reloadAll();
    logAction('Proveedor Creado', id, newProvider.name, 'system');
  };

  const editProvider = async (providerId, updatedData) => {
    const current = providers.find(p => p.id === providerId);
    if (!current) return;
    const updated = { ...current, ...updatedData };
    await api.put(`/api/providers/${providerId}`, updated);
    await reloadAll();
    logAction('Proveedor Editado', providerId, updated.name, 'system');
  };

  const deleteProvider = async (providerId) => {
    await api.del(`/api/providers/${providerId}`);
    await reloadAll();
    logAction('Proveedor Eliminado', providerId, '', 'system');
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

  const addProductBatch = async (productId, batchData) => {
    await api.post(`/api/products/${productId}/batches`, batchData);
    await reloadAll();
    logAction('Lote de Producto Creado', `ID: ${productId}`, 'System Admin', 'system');
  };

  const editProductBatch = async (productId, batchId, batchData) => {
    await api.put(`/api/products/${productId}/batches/${batchId}`, batchData);
    await reloadAll();
    logAction('Lote de Producto Editado', `ID: ${productId}, Lote: ${batchId}`, 'System Admin', 'system');
  };

  const deleteProductBatch = async (productId, batchId) => {
    await api.del(`/api/products/${productId}/batches/${batchId}`);
    await reloadAll();
    logAction('Lote de Producto Eliminado', `ID: ${productId}, Lote: ${batchId}`, 'System Admin', 'system');
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
    const amount = subtotal + iva + ret + (Number(invoiceDetails.transporte) || 0);

    const initialPaid = Number(invoiceDetails.paidAmount) || 0;
    let initialStatus = invoiceDetails.status || 'Pending';
    if (initialPaid >= amount) {
      initialStatus = 'Paid';
    } else if (initialPaid > 0) {
      initialStatus = 'Partial';
    }

    const newInvoice = {
      ...invoiceDetails,
      id: nextId(invoices, 'F'),
      amount,
      status: initialStatus,
      paidAmount: initialPaid,
      date: format(new Date(), 'yyyy-MM-dd'),
      remisionEnabled: invoiceDetails.remisionEnabled !== undefined ? invoiceDetails.remisionEnabled : false,
      remisionCreada: invoiceDetails.remisionCreada !== undefined ? invoiceDetails.remisionCreada : false,
    };
    await api.post('/api/invoices', newInvoice);

    // Actualizar deuda del cliente (solo por la parte pendiente neta de esta factura)
    if (client) {
      const pendingAmount = Math.max(0, amount - initialPaid);
      await api.put(`/api/clients/${client.id}`, { ...client, debt: client.debt + pendingAmount });
    }

    await reloadAll();
    sendEmail(client?.email || 'N/A', newInvoice);
    logAction('Rental Order Generated', `Invoice ${newInvoice.id}`, client?.name || 'Unknown', 'exit');
    return newInvoice;
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

      const hasRemision = remisiones.some(r => r.cotizacionId === cotizacionId && r.estado !== 'Cancelada');
      const newInvoice = {
        clientId: cot.clientId,
        obraId: cot.obraId,
        cotizacionId,
        items,
        amount,
        status: 'Pending',
        date: format(new Date(), 'yyyy-MM-dd'),
        remisionEnabled: hasRemision,
        remisionCreada: hasRemision,
        id: nextId(invoices, 'F'),
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
    
    const totalPaid = (invoice.paidAmount || 0) + paidAmount;
    let newStatus = 'Paid';
    if (totalPaid < invoice.amount) {
      newStatus = 'Partial';
    }
    if (paymentType === 'Credito' || paymentType === 'Fiado') {
      newStatus = paymentType === 'Fiado' ? 'Fiado' : 'Credito';
      paidAmount = 0;
    }

    const updated = { 
      ...invoice, 
      status: newStatus, 
      paidAmount: paymentType === 'Credito' || paymentType === 'Fiado' ? invoice.paidAmount : totalPaid,
      paymentType: paymentType,
      paidDate: paidAmount > 0 ? format(new Date(), 'yyyy-MM-dd') : invoice.paidDate, 
      remisionEnabled: true,
      abonos: paidAmount > 0 
        ? [...(invoice.abonos || []), { monto: paidAmount, fecha: format(new Date(), 'yyyy-MM-dd'), tipo: paymentType }]
        : (invoice.abonos || [])
    };
    
    await api.put(`/api/invoices/${invoiceId}`, updated);

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
    
    // Auto-facturación para remisiones manuales deshabilitada por solicitud de usuario.
    // La remisión se guarda en el perfil del cliente y se facturará en el Corte de Obra.

    const client = clients.find(c => c.id === data.clientId);
    logAction('Remisión Creada', `${id} — ${nueva.items.length} equipo(s)`, client?.name || 'N/A', 'exit');
    return nueva;
  };

  const editRemision = async (remId, data) => {
    const current = remisiones.find(r => r.id === remId);
    if (!current) return;

    // Si se modifican o eliminan ítems de la remisión, ajustar el inventario por la diferencia
    if (data.items && Array.isArray(data.items)) {
      const oldPendingMap = {};
      (current.items || []).forEach(item => {
        if (item.productId) {
          const pendiente = Math.max(0, (Number(item.cantidad) || 0) - (Number(item.cantidadDevuelta) || 0));
          oldPendingMap[item.productId] = (oldPendingMap[item.productId] || 0) + pendiente;
        }
      });

      const newPendingMap = {};
      data.items.forEach(item => {
        if (item.productId) {
          const pendiente = Math.max(0, (Number(item.cantidad) || 0) - (Number(item.cantidadDevuelta) || 0));
          newPendingMap[item.productId] = (newPendingMap[item.productId] || 0) + pendiente;
        }
      });

      const affectedProdIds = new Set([...Object.keys(oldPendingMap), ...Object.keys(newPendingMap)]);

      for (const prodId of affectedProdIds) {
        const oldPending = oldPendingMap[prodId] || 0;
        const newPending = newPendingMap[prodId] || 0;
        const delta = oldPending - newPending; // Positivo: ítems eliminados/reducidos -> retornar a inventario. Negativo: ítems añadidos -> reservar stock.

        if (delta !== 0) {
          const prod = products.find(p => p.id === prodId);
          if (prod) {
            const currentAvailable = Number(prod.availableStock) || 0;
            const total = Number(prod.totalStock) || (currentAvailable + Math.max(0, delta));
            const newAvailable = Math.max(0, Math.min(total, currentAvailable + delta));

            await api.put(`/api/products/${prod.id}`, {
              ...prod,
              availableStock: newAvailable
            });
          }
        }
      }
    }

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
        
        const returnDate = fecha || format(new Date(), 'yyyy-MM-dd');
        const existingDev = item.devoluciones.find(d => d.fecha === returnDate);
        if (existingDev) {
            existingDev.cantidad += descuento;
        } else {
            item.devoluciones.push({ 
                cantidad: descuento, 
                fecha: returnDate 
            });
        }
        
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
    try {
      const rem = remisiones.find(r => String(r.id).trim().toUpperCase() === String(remId).trim().toUpperCase());
      const clientId = rem?.clientId;

      // 1. Eliminar la remisión del backend (el servidor realiza el reintegro de inventario en PostgreSQL)
      await api.del(`/api/remisiones/${remId}`);

      // 2. Recargar los datos actualizados del servidor
      await reloadAll();

      const client = clients.find(c => String(c.id) === String(clientId));
      logAction('Remisión Eliminada', `${remId} — Reintegrados equipos al inventario`, client?.name || 'N/A', 'system');
    } catch (error) {
      console.error('Error en deleteRemision:', error);
      throw error;
    }
  };

  const cancelRemision = async (remId) => {
    const rem = remisiones.find(r => r.id === remId);
    if (!rem || rem.estado === 'Cancelada') return;

    // 1. Reintegrar stock de lo pendiente
    for (const item of (rem.items || [])) {
      const prod = products.find(p => p.id === item.productId);
      const pendiente = Math.max(0, (Number(item.cantidad) || 0) - (Number(item.cantidadDevuelta) || 0));
      if (prod && pendiente > 0) {
        const currentAvailable = Number(prod.availableStock) || 0;
        const total = Number(prod.totalStock) || (currentAvailable + pendiente);
        await api.put(`/api/products/${prod.id}`, { 
          ...prod, 
          availableStock: Math.min(total, currentAvailable + pendiente) 
        });
      }
    }

    // 2. Desvincular de la factura (permitir re-remisionar)
    const linkedInv = invoices.find(i => 
      i.id === rem.facturaId || 
      i.manualRemisionId === remId || 
      i.id === (typeof rem.id === 'string' ? rem.id.replace('REM-', 'F-') : '')
    );
    if (linkedInv) {
      await api.put(`/api/invoices/${linkedInv.id}`, { ...linkedInv, remisionCreada: false });
    }

    // 3. Marcar como Cancelada
    await api.put(`/api/remisiones/${remId}`, { ...rem, estado: 'Cancelada' });
    await reloadAll();
    logAction('Anular Remisión', remId, '', 'system');
  };

  // ─── COTIZACIONES CRUD ────────────────────────────────────────────────────
  const addCotizacion = async (data) => {
    const id = nextId(cotizaciones, 'C');
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

  // ─── GASTOS MANTENIMIENTO CRUD ─────────────────────────────────────────────
  const addGastoMantenimiento = async (data) => {
    const id = nextId(gastosMantenimiento, 'GM');
    const nuevo = { ...data, id, costo: Number(data.costo || 0) };
    await api.post('/api/gastos-mantenimiento', nuevo);
    await reloadAll();
    logAction('Gasto Mantenimiento Registrado', `${id} — ${data.tipo_gasto}`, data.id_maquina || 'General', 'exit');
  };

  const editGastoMantenimiento = async (id, data) => {
    const editado = { ...data, costo: Number(data.costo || 0) };
    await api.put(`/api/gastos-mantenimiento/${id}`, editado);
    await reloadAll();
    logAction('Gasto Mantenimiento Modificado', id, data.id_maquina || 'General', 'system');
  };

  const deleteGastoMantenimiento = async (id) => {
    await api.del(`/api/gastos-mantenimiento/${id}`);
    await reloadAll();
    logAction('Gasto Mantenimiento Eliminado', id, '', 'system');
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
      // Providers
      providers, setProviders, addProvider, editProvider, deleteProvider,
      // Products
      products, setProducts, addProduct, editProduct, returnProduct, deleteProduct, darDeBajaProduct, addProductBatch, editProductBatch, deleteProductBatch,
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
      // Gastos Mantenimiento
      gastosMantenimiento, addGastoMantenimiento, editGastoMantenimiento, deleteGastoMantenimiento,
      empleados, addEmpleado,
      liquidaciones, addLiquidacion, pagarLiquidacion,
      // Settings
      settings, updateSettings,
      // Users & Roles
      users, addUser, deleteUser,
      // Auth Utils
      checkPassword,
      globalPreload, setGlobalPreload
    }}>
      {children}
    </AppContext.Provider>
  );
};
