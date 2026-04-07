import React, { createContext, useState, useContext, useEffect, useCallback } from 'react';
import { format } from 'date-fns';

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
    if (!list || list.length === 0) return `${prefix}-${String(minStart).padStart(3, '0')}`;
    const ids = list.map(item => {
      const match = item.id ? String(item.id).match(/\d+$/) : null;
      return match ? parseInt(match[0], 10) : 0;
    });
    const maxId = Math.max(...ids, minStart - 1);
    return `${prefix}-${String(maxId + 1).padStart(3, '0')}`;
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
      id: nextId(products, 'P', 101),
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
      id: nextId(invoices, 'INV'),
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
  const createInvoiceFromCotizacion = async (cotizacionId) => {
    try {
      console.log('🚀 CREATE INVOICE FROM COTIZACION:', cotizacionId);
      const cot = cotizaciones.find(c => c.id === cotizacionId);
      if (!cot) throw new Error('Cotización no encontrada');

      const items = cot.items.map(i => ({
        productId: i.productId,
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
        id: nextId(invoices, 'INV'),
      };
      await api.post('/api/invoices', newInvoice);

      // Actualizar deuda del cliente
      if (client) {
        await api.put(`/api/clients/${client.id}`, { ...client, debt: (client.debt || 0) + amount });
      }

      // Marcar cotización como Facturada
      await api.put(`/api/cotizaciones/${cotizacionId}`, { ...cot, estado: 'Facturada', facturaId: newInvoice.id });

      await reloadAll();
      alert('✅ Factura creada con éxito. Puede verla en el módulo de facturación.');
    } catch (e) {
      console.error('ERROR FACTURANDO:', e);
      alert('❌ Error al facturar: ' + e.message);
    }
  };

  const payInvoice = async (invoiceId) => {
    const invoice = invoices.find(inv => inv.id === invoiceId);
    if (!invoice || invoice.status === 'Paid') return;
    const updated = { ...invoice, status: 'Paid', paidDate: format(new Date(), 'yyyy-MM-dd'), remisionEnabled: true };
    await api.put(`/api/invoices/${invoiceId}`, updated);

    // Actualizar deuda del cliente
    const client = clients.find(c => c.id === invoice.clientId);
    if (client) {
      await api.put(`/api/clients/${client.id}`, { ...client, debt: Math.max(0, client.debt - invoice.amount) });
    }

    await reloadAll();
    logAction('Payment Received', `Invoice ${invoiceId} - $${invoice.amount.toLocaleString()}`, client?.name || 'Unknown', 'entry');
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
    if (!invoice) return;

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
    const client = clients.find(c => c.id === data.clientId);
    logAction('Remisión Creada', `${id} — ${nueva.items.length} equipo(s)`, client?.name || 'N/A', 'exit');
  };

  const registrarDevolucion = async (clientId, obraId, devoluciones, fecha) => {
    let updatedRems = remisiones.map(r => ({ ...r, items: r.items.map(i => ({ ...i })) }));
    const stockReintegrar = {};

    devoluciones.forEach(({ productId, cantidad }) => {
      let restante = cantidad;
      const activas = updatedRems
        .map((r, idx) => ({ r, idx }))
        .filter(({ r }) => r.clientId === clientId && r.obraId === obraId && (r.estado === 'Activa' || r.estado === 'Parcial'))
        .sort((a, b) => a.r.fecha.localeCompare(b.r.fecha));

      for (const { idx } of activas) {
        if (restante <= 0) break;
        const itemIdx = updatedRems[idx].items.findIndex(i => i.productId === productId);
        if (itemIdx === -1) continue;
        const item = updatedRems[idx].items[itemIdx];
        const pendiente = item.cantidad - item.cantidadDevuelta;
        if (pendiente <= 0) continue;
        const descuento = Math.min(restante, pendiente);
        updatedRems[idx].items[itemIdx].cantidadDevuelta += descuento;
        restante -= descuento;
        stockReintegrar[productId] = (stockReintegrar[productId] || 0) + descuento;
      }

      updatedRems = updatedRems.map(r => {
        if (r.clientId !== clientId || r.obraId !== obraId) return r;
        const total = r.items.reduce((s, i) => s + i.cantidad, 0);
        const devuelto = r.items.reduce((s, i) => s + i.cantidadDevuelta, 0);
        const estado = devuelto === 0 ? 'Activa' : devuelto >= total ? 'Cerrada' : 'Parcial';
        return { ...r, estado };
      });
    });

    // Persistir remisiones actualizadas
    for (const rem of updatedRems) {
      await api.put(`/api/remisiones/${rem.id}`, rem);
    }

    // Reintegrar stock de productos
    for (const [productId, devuelto] of Object.entries(stockReintegrar)) {
      const prod = products.find(p => p.id === productId);
      if (prod && devuelto > 0) {
        await api.put(`/api/products/${productId}`, { ...prod, availableStock: Math.min(prod.totalStock, prod.availableStock + devuelto) });
      }
    }

    await reloadAll();
    const client = clients.find(c => c.id === clientId);
    logAction('Devolución PEPS', `Obra ${obraId} - Fecha Devolución: ${fecha || format(new Date(), 'yyyy-MM-dd')}`, client?.name || 'N/A', 'entry');
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
    const potentialInvId = rem.invoiceId || (typeof rem.id === 'string' ? rem.id.replace('REM-', 'INV-') : null);
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
    const id = nextId(cotizaciones, 'COT');
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
      alert(`✅ Cotización ${nuevoEstado} con éxito.`);
    } catch (e) {
      console.error('❌ ERROR ACTUALIZANDO ESTADO:', e);
      alert('❌ Error al actualizar estado: ' + e.message);
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
    if (!cot) return;
    
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
      invoices, setInvoices, createInvoice, payInvoice, createInvoiceFromCotizacion, marcarRemisionCreada, deleteInvoice,
      // Other
      logs, maintenances, addMaintenance, editMaintenance,
      // Remisiones
      remisiones, addRemision, registrarDevolucion, deleteRemision, cancelRemision,
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
    }}>
      {children}
    </AppContext.Provider>
  );
};
