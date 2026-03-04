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
  post: (url, body) => fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }).then(r => r.json()),
  put: (url, body) => fetch(url, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }).then(r => r.json()),
  del: (url) => fetch(url, { method: 'DELETE' }).then(r => r.json()),
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

  // ── Carga inicial desde la API ───────────────────────────────────────────
  const reloadAll = useCallback(async () => {
    try {
      const [p, c, inv, cot, rem, maint, g, emp, liq] = await Promise.all([
        api.get('/api/products'),
        api.get('/api/clients'),
        api.get('/api/invoices'),
        api.get('/api/cotizaciones'),
        api.get('/api/remisiones'),
        api.get('/api/maintenances'),
        api.get('/api/gastos'),
        api.get('/api/empleados'),
        api.get('/api/liquidaciones'),
      ]);
      if (Array.isArray(p)) setProducts(p);
      if (Array.isArray(c)) setClients(c);
      if (Array.isArray(inv)) setInvoices(inv);
      if (Array.isArray(cot)) setCotizaciones(cot);
      if (Array.isArray(rem)) setRemisiones(rem);
      if (Array.isArray(maint)) setMaintenances(maint);
      if (Array.isArray(g)) setGastos(g);
      if (Array.isArray(emp)) setEmpleados(emp);
      if (Array.isArray(liq)) setLiquidaciones(liq);
    } catch (err) {
      console.error('Error cargando datos desde la API:', err);
    }
  }, []);

  useEffect(() => { reloadAll(); }, [reloadAll]);

  // ─── HELPERS ─────────────────────────────────────────────────────────────
  const logAction = (action, product, client, type) => {
    setLogs(prev => [{ id: Date.now(), action, product, client, time: format(new Date(), 'yyyy-MM-dd hh:mm a'), type }, ...prev]);
  };

  const nextId = (list, prefix) => `${prefix}-${String(list.length + 1).padStart(3, '0')}`;

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
      id: `P-${String(products.length + 101).padStart(3, '0')}`,
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
    const amount = invoiceDetails.items.reduce((t, i) => t + (i.quantity * i.days * i.price), 0);
    const newInvoice = {
      ...invoiceDetails,
      id: nextId(invoices, 'INV'),
      amount,
      status: 'Pending',
      date: format(new Date(), 'yyyy-MM-dd')
    };
    await api.post('/api/invoices', newInvoice);

    // Actualizar deuda del cliente
    const client = clients.find(c => c.id === invoiceDetails.clientId);
    if (client) {
      await api.put(`/api/clients/${client.id}`, { ...client, debt: client.debt + amount });
    }

    await reloadAll();
    sendEmail(client?.email || 'N/A', newInvoice);
    logAction('Rental Order Generated', `Invoice ${newInvoice.id}`, client?.name || 'Unknown', 'exit');
  };

  const payInvoice = async (invoiceId) => {
    const invoice = invoices.find(inv => inv.id === invoiceId);
    if (!invoice || invoice.status === 'Paid') return;
    const updated = { ...invoice, status: 'Paid', paidDate: format(new Date(), 'yyyy-MM-dd') };
    await api.put(`/api/invoices/${invoiceId}`, updated);

    // Actualizar deuda del cliente
    const client = clients.find(c => c.id === invoice.clientId);
    if (client) {
      await api.put(`/api/clients/${client.id}`, { ...client, debt: Math.max(0, client.debt - invoice.amount) });
    }

    await reloadAll();
    logAction('Payment Received', `Invoice ${invoiceId} - $${invoice.amount.toLocaleString()}`, client?.name || 'Unknown', 'entry');
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

  const registrarDevolucion = async (clientId, obraId, devoluciones) => {
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
    logAction('Devolución PEPS', `Obra ${obraId}`, client?.name || 'N/A', 'entry');
  };

  // ─── COTIZACIONES CRUD ────────────────────────────────────────────────────
  const addCotizacion = async (data) => {
    const id = nextId(cotizaciones, 'COT');
    const nueva = { ...data, id, fecha: format(new Date(), 'yyyy-MM-dd'), estado: 'Borrador', habeasData: false, habeasDataTimestamp: null, firma: null, foto: null };
    await api.post('/api/cotizaciones', nueva);
    await reloadAll();
    const client = clients.find(c => c.id === data.clientId);
    logAction('Cotización Creada', id, client?.name || 'N/A', 'system');
  };

  const actualizarEstadoCotizacion = async (cotId, nuevoEstado, extra = {}) => {
    const current = cotizaciones.find(c => c.id === cotId);
    if (!current) return;
    await api.put(`/api/cotizaciones/${cotId}`, { ...current, estado: nuevoEstado, ...extra });
    await reloadAll();
    logAction(`Cotización ${nuevoEstado}`, cotId, '', 'system');
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

  const sendEmail = (email, invoice) => {
    console.log(`[Email] To: ${email} | Invoice: ${invoice.id} | Amount: $${invoice.amount}`);
    logAction('Auto-Email Sent', `Invoice ${invoice.id}`, email, 'system');
  };

  return (
    <AppContext.Provider value={{
      // Auth
      currentUser, login, logout, canViewDashboard, isAdmin, isGerente,
      // Clients
      clients, setClients, addClient, editClient, addObra, editObra,
      // Products
      products, setProducts, addProduct, editProduct, returnProduct,
      // Invoices
      invoices, setInvoices, createInvoice, payInvoice,
      // Other
      logs, maintenances, addMaintenance, editMaintenance,
      // Remisiones
      remisiones, addRemision, registrarDevolucion,
      // Cotizaciones
      cotizaciones, addCotizacion, actualizarEstadoCotizacion,
      // Financiero
      gastos, addGasto, pagarGasto,
      empleados, addEmpleado,
      liquidaciones, addLiquidacion, pagarLiquidacion,
    }}>
      {children}
    </AppContext.Provider>
  );
};
