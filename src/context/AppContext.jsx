import React, { createContext, useState, useContext } from 'react';
import { format } from 'date-fns';

function useLocalStorage(key, initialValue) {
  const [storedValue, setStoredValue] = useState(() => {
    try {
      const item = window.localStorage.getItem(key);
      return item ? JSON.parse(item) : initialValue;
    } catch (error) {
      console.warn(`Error reading localStorage key "${key}":`, error);
      return initialValue;
    }
  });

  const setValue = (value) => {
    try {
      const valueToStore = value instanceof Function ? value(storedValue) : value;
      setStoredValue(valueToStore);
      window.localStorage.setItem(key, JSON.stringify(valueToStore));
    } catch (error) {
      console.warn(`Error setting localStorage key "${key}":`, error);
    }
  };

  return [storedValue, setValue];
}

const AppContext = createContext();
export const useAppContext = () => useContext(AppContext);

// ─── Usuarios ─────────────────────────────────────────────────────────────────
const USERS = [
  { id: 'U-001', username: 'admin', password: 'admin123', name: 'Administrador', role: 'admin', avatar: 'A' },
  { id: 'U-002', username: 'gerente', password: 'gerente123', name: 'Gerente General', role: 'gerente', avatar: 'G' },
  { id: 'U-003', username: 'op', password: 'op123', name: 'Operativo', role: 'operativo', avatar: 'O' },
];

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

  // ── Clientes (modelo CRM ampliado) ───────────────────────────────────────
  const [clients, setClients] = useLocalStorage('cielo_clients', [
    {
      id: 'C-001',
      // Datos generales
      name: 'Constructora Alfa S.A.S',
      tipoPersona: 'Jurídica',
      nit: '900.123.456-7',
      regimen: 'Común',
      responsableIVA: true,
      porcIVA: 19,
      porcRetencion: 2.5,
      email: 'contacto@alfa.com',
      phone: '3001234567',
      direccion: 'Cra 15 # 80-20',
      ciudad: 'Bogotá',
      departamento: 'Cundinamarca',
      contactoPrincipal: 'Andrés Martínez',
      joined: '2023-01-15',
      debt: 500000,
      // Obras
      obras: [
        { id: 'O-001-1', nombre: 'Edificio Central', ubicacion: 'Calle 72 # 10-45, Bogotá', estado: 'Activa', presupuesto: 5000000000, fechaInicio: '2023-01-20', descripcion: 'Torre de 20 pisos residencial' },
        { id: 'O-001-2', nombre: 'Parqueadero Subterráneo', ubicacion: 'Calle 70 # 11-30, Bogotá', estado: 'Activa', presupuesto: 800000000, fechaInicio: '2023-06-01', descripcion: '3 niveles de parqueadero' },
      ],
    },
    {
      id: 'C-002',
      name: 'Ingenieros Beta Ltda',
      tipoPersona: 'Jurídica',
      nit: '800.987.654-2',
      regimen: 'Común',
      responsableIVA: true,
      porcIVA: 19,
      porcRetencion: 3.5,
      email: 'info@beta.com',
      phone: '3109876543',
      direccion: 'Av. El Dorado # 68C-61',
      ciudad: 'Bogotá',
      departamento: 'Cundinamarca',
      contactoPrincipal: 'Carlos Ruiz',
      joined: '2023-03-22',
      debt: 0,
      obras: [
        { id: 'O-002-1', nombre: 'Puente Sur', ubicacion: 'Km 5 Vía al Sur, Bogotá', estado: 'Activa', presupuesto: 12000000000, fechaInicio: '2023-04-01', descripcion: 'Puente vehicular de 200m de luz' },
      ],
    },
    {
      id: 'C-003',
      name: 'Arquitectura y Diseño S.A',
      tipoPersona: 'Jurídica',
      nit: '901.456.789-3',
      regimen: 'Común',
      responsableIVA: false,
      porcIVA: 0,
      porcRetencion: 2.5,
      email: 'hola@arquid.com',
      phone: '3204561234',
      direccion: 'Calle 93 # 13-24',
      ciudad: 'Bogotá',
      departamento: 'Cundinamarca',
      contactoPrincipal: 'Valentina Ospina',
      joined: '2023-06-10',
      debt: 1200000,
      obras: [
        { id: 'O-003-1', nombre: 'Residencial Los Pinos', ubicacion: 'Cra 50 # 25-60, Medellín', estado: 'Activa', presupuesto: 3500000000, fechaInicio: '2023-07-01', descripcion: 'Conjunto residencial 80 apartamentos' },
        { id: 'O-003-2', nombre: 'Centro Comercial Patio', ubicacion: 'Av. 33 # 80-15, Medellín', estado: 'Suspendida', presupuesto: 9000000000, fechaInicio: '2023-09-01', descripcion: 'Centro comercial 3 niveles' },
        { id: 'O-003-3', nombre: 'Hotel Boutique Zona Rosa', ubicacion: 'Cra 15 # 85-32, Bogotá', estado: 'Terminada', presupuesto: 2200000000, fechaInicio: '2022-05-10', descripcion: 'Hotel 5 estrellas 80 hab.' },
      ],
    },
  ]);

  // ── Productos ─────────────────────────────────────────────────────────────
  const [products, setProducts] = useLocalStorage('cielo_products', [
    { id: 'P-101', name: 'Excavadora Cat 320', totalStock: 3, availableStock: 2, category: 'Heavy Machinery', value: 350000, image: 'https://images.unsplash.com/photo-1541888087405-c8108c48a8f1?auto=format&fit=crop&q=80&w=150' },
    { id: 'P-102', name: 'Martillo Demoledor Bosch', totalStock: 5, availableStock: 5, category: 'Power Tools', value: 45000, image: 'https://images.unsplash.com/photo-1504148455328-c376907d081c?auto=format&fit=crop&q=80&w=150' },
    { id: 'P-103', name: 'Planta Eléctrica 10kW', totalStock: 2, availableStock: 2, category: 'Equipment', value: 85000, image: 'https://images.unsplash.com/photo-1580983546051-7649d214a1e9?auto=format&fit=crop&q=80&w=150' },
    { id: 'P-104', name: 'Andamio Tubular', totalStock: 100, availableStock: 60, category: 'Structures', value: 15000, image: 'https://images.unsplash.com/photo-1533038676239-502a507fa733?auto=format&fit=crop&q=80&w=150' },
    { id: 'P-105', name: 'Mezcladora de Concreto 1 Bulto', totalStock: 4, availableStock: 3, category: 'Machinery', value: 65000, image: 'https://images.unsplash.com/photo-1589939705384-5185137a7f0f?auto=format&fit=crop&q=80&w=150' },
  ]);

  // ── Facturas ──────────────────────────────────────────────────────────────
  const [invoices, setInvoices] = useLocalStorage('cielo_invoices', [
    { id: 'INV-001', clientId: 'C-001', obraId: 'O-001-1', amount: 500000, status: 'Pending', date: '2023-10-20', items: [{ productId: 'P-101', quantity: 1, days: 1, price: 350000 }, { productId: 'P-104', quantity: 10, days: 1, price: 15000 }] },
    { id: 'INV-002', clientId: 'C-002', obraId: 'O-002-1', amount: 250000, status: 'Paid', date: '2023-10-15', items: [{ productId: 'P-102', quantity: 2, days: 2, price: 45000 }, { productId: 'P-104', quantity: 2, days: 5, price: 15000 }] },
    { id: 'INV-003', clientId: 'C-003', obraId: 'O-003-1', amount: 1200000, status: 'Pending', date: '2023-10-05', items: [{ productId: 'P-103', quantity: 1, days: 14, price: 85000 }] },
  ]);

  // ── Logs ──────────────────────────────────────────────────────────────────
  const [logs, setLogs] = useLocalStorage('cielo_logs', [
    { id: 1, action: 'Rental Exit', product: 'Excavadora Cat 320', client: 'Constructora Alfa', time: '2023-10-20 08:30 AM', type: 'exit' },
    { id: 2, action: 'Rental Return', product: 'Martillo Demoledor Bosch', client: 'Ingenieros Beta', time: '2023-10-21 04:15 PM', type: 'entry' },
    { id: 3, action: 'Maintenance', product: 'Mezcladora de Concreto 1 Bulto', client: 'Internal', time: '2023-10-22 09:00 AM', type: 'system' },
  ]);

  // ── Mantenimientos ────────────────────────────────────────────────────────
  const [maintenances, setMaintenances] = useLocalStorage('cielo_maintenances', [
    { id: 'M-001', productId: 'P-101', type: 'Preventivo', description: 'Cambio de aceite y filtros', status: 'Completado', date: '2023-10-10', cost: 150000 },
    { id: 'M-002', productId: 'P-105', type: 'Correctivo', description: 'Reparación de motor', status: 'En Proceso', date: '2023-10-22', cost: 320000 },
  ]);

  // ── Remisiones ────────────────────────────────────────────────────────────────
  // Estado: 'Activa' | 'Parcial' | 'Cerrada'
  const [remisiones, setRemisiones] = useLocalStorage('cielo_remisiones', [
    {
      id: 'REM-001',
      clientId: 'C-001', obraId: 'O-001-1',
      fecha: '2023-10-16',
      transporte: 80000,
      estado: 'Cerrada',
      notas: 'Entrega al amanecer',
      items: [
        { productId: 'P-104', cantidad: 2, cantidadDevuelta: 2 },
      ],
    },
    {
      id: 'REM-002',
      clientId: 'C-001', obraId: 'O-001-1',
      fecha: '2023-10-17',
      transporte: 60000,
      estado: 'Parcial',
      notas: '',
      items: [
        { productId: 'P-104', cantidad: 3, cantidadDevuelta: 3 },
        { productId: 'P-102', cantidad: 2, cantidadDevuelta: 0 },
      ],
    },
    {
      id: 'REM-003',
      clientId: 'C-001', obraId: 'O-001-1',
      fecha: '2023-10-18',
      transporte: 75000,
      estado: 'Activa',
      notas: 'Urgente',
      items: [
        { productId: 'P-104', cantidad: 10, cantidadDevuelta: 1 },
      ],
    },
    {
      id: 'REM-004',
      clientId: 'C-002', obraId: 'O-002-1',
      fecha: '2023-10-19',
      transporte: 120000,
      estado: 'Activa',
      notas: '',
      items: [
        { productId: 'P-101', cantidad: 1, cantidadDevuelta: 0 },
        { productId: 'P-103', cantidad: 1, cantidadDevuelta: 0 },
      ],
    },
  ]);

  // ─────────────────────────────────────────────────────────────────────────
  // HELPERS
  // ─────────────────────────────────────────────────────────────────────────
  const logAction = (action, product, client, type) => {
    setLogs(prev => [{ id: Date.now(), action, product, client, time: format(new Date(), 'yyyy-MM-dd hh:mm a'), type }, ...prev]);
  };

  // ── Client CRUD ───────────────────────────────────────────────────────────
  const addClient = (client) => {
    const id = `C-${String(clients.length + 1).padStart(3, '0')}`;
    const firstObra = client.primeraObra
      ? [{ id: `${id}-1`, nombre: client.primeraObra, ubicacion: client.obraUbicacion || '', estado: 'Activa', presupuesto: Number(client.obraPresupuesto) || 0, fechaInicio: format(new Date(), 'yyyy-MM-dd'), descripcion: '' }]
      : [];
    const { primeraObra: _, obraUbicacion: __, obraPresupuesto: ___, ...rest } = client;
    setClients(prev => [...prev, { ...rest, id, debt: 0, joined: format(new Date(), 'yyyy-MM-dd'), obras: firstObra }]);
  };

  const editClient = (clientId, updatedData) => {
    setClients(prev => prev.map(c => c.id === clientId ? { ...c, ...updatedData } : c));
  };

  // ── Obra CRUD (per-client) ─────────────────────────────────────────────────
  const addObra = (clientId, obra) => {
    setClients(prev => prev.map(c => {
      if (c.id !== clientId) return c;
      const newId = `${clientId}-${c.obras.length + 1}`;
      return { ...c, obras: [...c.obras, { ...obra, id: newId, fechaInicio: obra.fechaInicio || format(new Date(), 'yyyy-MM-dd') }] };
    }));
  };

  const editObra = (clientId, obraId, data) => {
    setClients(prev => prev.map(c => {
      if (c.id !== clientId) return c;
      return { ...c, obras: c.obras.map(o => o.id === obraId ? { ...o, ...data } : o) };
    }));
  };

  // ── Product CRUD ──────────────────────────────────────────────────────────
  const addProduct = (product) => {
    setProducts(prev => [...prev, { ...product, id: `P-${String(prev.length + 101).padStart(3, '0')}`, totalStock: product.totalStock || 1, availableStock: product.totalStock || 1 }]);
    logAction('Product Created', product.name, 'System Admin', 'system');
  };
  const editProduct = (productId, updatedData) => {
    setProducts(prev => prev.map(p => p.id === productId ? { ...p, ...updatedData, availableStock: updatedData.totalStock - (p.totalStock - p.availableStock) } : p));
    logAction('Product Edited', updatedData.name, 'System Admin', 'system');
  };
  const returnProduct = (productId, quantity, clientId) => {
    setProducts(prev => prev.map(p => p.id === productId ? { ...p, availableStock: Math.min(p.totalStock, p.availableStock + quantity) } : p));
    const product = products.find(p => p.id === productId);
    const client = clients.find(c => c.id === clientId);
    logAction('Rental Return', `${quantity}x ${product?.name}`, client?.name || 'Unknown', 'entry');
  };

  // ── Invoice CRUD ──────────────────────────────────────────────────────────
  const createInvoice = (invoiceDetails) => {
    const amount = invoiceDetails.items.reduce((t, i) => t + (i.quantity * i.days * i.price), 0);
    const newInvoice = { ...invoiceDetails, id: `INV-${String(invoices.length + 1).padStart(3, '0')}`, amount, status: 'Pending', date: format(new Date(), 'yyyy-MM-dd') };
    setInvoices(prev => [...prev, newInvoice]);
    setClients(prev => prev.map(c => c.id === invoiceDetails.clientId ? { ...c, debt: c.debt + amount } : c));
    setProducts(prev => prev.map(p => {
      const item = invoiceDetails.items.find(i => i.productId === p.id);
      return item ? { ...p, availableStock: Math.max(0, p.availableStock - item.quantity) } : p;
    }));
    const client = clients.find(c => c.id === invoiceDetails.clientId);
    sendEmail(client?.email || 'N/A', newInvoice);
    logAction('Rental Order Generated', `Invoice ${newInvoice.id} (${invoiceDetails.items.length} items)`, client?.name || 'Unknown', 'exit');
  };

  const payInvoice = (invoiceId) => {
    const invoice = invoices.find(inv => inv.id === invoiceId);
    if (!invoice || invoice.status === 'Paid') return;
    setInvoices(prev => prev.map(inv => inv.id === invoiceId ? { ...inv, status: 'Paid', paidDate: format(new Date(), 'yyyy-MM-dd') } : inv));
    setClients(prev => prev.map(c => c.id === invoice.clientId ? { ...c, debt: Math.max(0, c.debt - invoice.amount) } : c));
    setProducts(prev => prev.map(p => {
      const item = invoice.items.find(i => i.productId === p.id);
      return item ? { ...p, availableStock: Math.min(p.totalStock, p.availableStock + item.quantity) } : p;
    }));
    const client = clients.find(c => c.id === invoice.clientId);
    logAction('Payment Received', `Invoice ${invoiceId} - $${invoice.amount.toLocaleString()}`, client?.name || 'Unknown', 'entry');
  };

  // ── Maintenance ───────────────────────────────────────────────────────────
  const addMaintenance = (maint) => {
    const newM = { ...maint, id: `M-${String(maintenances.length + 1).padStart(3, '0')}`, date: format(new Date(), 'yyyy-MM-dd') };
    setMaintenances(prev => [...prev, newM]);
    const product = products.find(p => p.id === maint.productId);
    logAction('Mantenimiento Registrado', product?.name || maint.productId, 'Sistema', 'system');
  };

  // ── Remisión CRUD ─────────────────────────────────────────────────────────
  const addRemision = (data) => {
    // Block if any item has a pending/in-process maintenance
    for (const item of data.items) {
      const hasPending = maintenances.some(
        m => m.productId === item.productId && (m.status === 'Pendiente' || m.status === 'En Proceso')
      );
      if (hasPending) {
        const prod = products.find(p => p.id === item.productId);
        throw new Error(`BLOQUEO: "${prod?.name || item.productId}" tiene un mantenimiento pendiente o en proceso. Resuelva el mantenimiento antes de despachar.`);
      }
    }
    setRemisiones(prev => {
      const id = `REM-${String(prev.length + 1).padStart(3, '0')}`;
      const nueva = { ...data, id, fecha: data.fecha || format(new Date(), 'yyyy-MM-dd'), estado: 'Activa', items: data.items.map(i => ({ ...i, cantidadDevuelta: 0 })) };
      setProducts(prods => prods.map(p => {
        const item = nueva.items.find(i => i.productId === p.id);
        return item ? { ...p, availableStock: Math.max(0, p.availableStock - item.cantidad) } : p;
      }));
      const client = clients.find(c => c.id === data.clientId);
      logAction('Remisión Creada', `${id} — ${nueva.items.length} equipo(s)`, client?.name || 'N/A', 'exit');
      return [...prev, nueva];
    });
  };

  /**
   * registrarDevolucion — lógica PEPS
   * devoluciones: [{ productId, cantidad }]
   * Cierra remisiones de más antigua a más reciente.
   */
  const registrarDevolucion = (clientId, obraId, devoluciones) => {
    setRemisiones(prev => {
      let updated = prev.map(r => ({ ...r, items: r.items.map(i => ({ ...i })) }));
      const stockReintegrar = {};

      devoluciones.forEach(({ productId, cantidad }) => {
        let restante = cantidad;
        const activas = updated
          .map((r, idx) => ({ r, idx }))
          .filter(({ r }) => r.clientId === clientId && r.obraId === obraId && (r.estado === 'Activa' || r.estado === 'Parcial'))
          .sort((a, b) => a.r.fecha.localeCompare(b.r.fecha));

        for (const { idx } of activas) {
          if (restante <= 0) break;
          const itemIdx = updated[idx].items.findIndex(i => i.productId === productId);
          if (itemIdx === -1) continue;
          const item = updated[idx].items[itemIdx];
          const pendiente = item.cantidad - item.cantidadDevuelta;
          if (pendiente <= 0) continue;
          const descuento = Math.min(restante, pendiente);
          updated[idx].items[itemIdx].cantidadDevuelta += descuento;
          restante -= descuento;
          stockReintegrar[productId] = (stockReintegrar[productId] || 0) + descuento;
        }

        // Actualizar estado de remisiones
        updated = updated.map(r => {
          if (r.clientId !== clientId || r.obraId !== obraId) return r;
          const total = r.items.reduce((s, i) => s + i.cantidad, 0);
          const devuelto = r.items.reduce((s, i) => s + i.cantidadDevuelta, 0);
          const estado = devuelto === 0 ? 'Activa' : devuelto >= total ? 'Cerrada' : 'Parcial';
          return { ...r, estado };
        });
      });

      // Reintegrar stock
      setProducts(prods => prods.map(p => {
        const devuelto = stockReintegrar[p.id] || 0;
        return devuelto > 0 ? { ...p, availableStock: Math.min(p.totalStock, p.availableStock + devuelto) } : p;
      }));

      const client = clients.find(c => c.id === clientId);
      logAction('Devolución PEPS', `Obra ${obraId}`, client?.name || 'N/A', 'entry');
      return updated;
    });
  };

  const sendEmail = (email, invoice) => {
    console.log(`[Email] To: ${email} | Invoice: ${invoice.id} | Amount: $${invoice.amount}`);
    logAction('Auto-Email Sent', `Invoice ${invoice.id}`, email, 'system');
  };

  // ── Cotizaciones ─────────────────────────────────────────────────────────
  // Estado: 'Borrador' | 'Enviada' | 'Aprobada' | 'Rechazada'
  const [cotizaciones, setCotizaciones] = useLocalStorage('cielo_cotizaciones', [
    {
      id: 'COT-001',
      clientId: 'C-001', obraId: 'O-001-1',
      fecha: '2023-10-15',
      validezDias: 15,
      metodoPago: 'Crédito 30 días',
      responsableTransporte: 'CIELO',
      plazoEntrega: '24 horas',
      transporte: 80000,
      notas: 'Cliente prioritario, descuento especial.',
      estado: 'Aprobada',
      items: [
        { productId: 'P-104', nombre: 'Andamio Modular', cantidad: 10, dias: 15, tarifaDia: 15000 },
        { productId: 'P-102', nombre: 'Vibrocompactador', cantidad: 1, dias: 15, tarifaDia: 80000 },
      ],
      habeasData: true,
      habeasDataTimestamp: '2023-10-15T10:23:00',
      firma: null,
      foto: null,
    },
    {
      id: 'COT-002',
      clientId: 'C-002', obraId: 'O-002-1',
      fecha: '2023-10-20',
      validezDias: 10,
      metodoPago: 'Contado',
      responsableTransporte: 'Cliente',
      plazoEntrega: '48 horas',
      transporte: 0,
      notas: '',
      estado: 'Enviada',
      items: [
        { productId: 'P-101', nombre: 'Retroexcavadora CAT', cantidad: 1, dias: 30, tarifaDia: 350000 },
      ],
      habeasData: false,
      habeasDataTimestamp: null,
      firma: null,
      foto: null,
    },
  ]);

  const addCotizacion = (data) => {
    setCotizaciones(prev => {
      const id = `COT-${String(prev.length + 1).padStart(3, '0')}`;
      const nueva = { ...data, id, fecha: format(new Date(), 'yyyy-MM-dd'), estado: 'Borrador', habeasData: false, habeasDataTimestamp: null, firma: null, foto: null };
      const client = clients.find(c => c.id === data.clientId);
      logAction('Cotización Creada', id, client?.name || 'N/A', 'system');
      return [...prev, nueva];
    });
  };

  const actualizarEstadoCotizacion = (cotId, nuevoEstado, extra = {}) => {
    setCotizaciones(prev => prev.map(c => c.id === cotId ? { ...c, estado: nuevoEstado, ...extra } : c));
    logAction(`Cotización ${nuevoEstado}`, cotId, '', 'system');
  };

  // ── Gastos ──────────────────────────────────────────────────────
  const [gastos, setGastos] = useLocalStorage('cielo_gastos', [
    { id: 'G-001', fecha: '2023-10-01', concepto: 'Arriendo bodega', proveedor: 'Inmobiliaria XYZ', categoria: 'Arriendo', monto: 1500000, iva: 0, estado: 'Pagado', notas: '' },
    { id: 'G-002', fecha: '2023-10-05', concepto: 'Combustible camiones', proveedor: 'Terpel', categoria: 'Transporte', monto: 350000, iva: 66500, estado: 'Pagado', notas: 'Semana 1' },
    { id: 'G-003', fecha: '2023-10-10', concepto: 'Repuestos motor', proveedor: 'Automáxt S.A.S', categoria: 'Mantenimiento', monto: 420000, iva: 79800, estado: 'Pendiente', notas: 'Retroexcavadora P-101' },
    { id: 'G-004', fecha: '2023-10-15', concepto: 'Servicios públicos', proveedor: 'Codensa / EPM', categoria: 'Servicio', monto: 280000, iva: 0, estado: 'Pagado', notas: '' },
    { id: 'G-005', fecha: '2023-10-20', concepto: 'Insumos de oficina', proveedor: 'Papéleria El Escudo', categoria: 'Insumo', monto: 95000, iva: 18050, estado: 'Pagado', notas: '' },
  ]);

  const addGasto = (data) => {
    setGastos(prev => {
      const id = `G-${String(prev.length + 1).padStart(3, '0')}`;
      logAction('Gasto Registrado', `${id} — ${data.concepto}`, data.proveedor || 'N/A', 'exit');
      return [...prev, { ...data, id, monto: Number(data.monto), iva: Number(data.iva || 0) }];
    });
  };

  const pagarGasto = (id) => {
    setGastos(prev => prev.map(g => g.id === id ? { ...g, estado: 'Pagado' } : g));
    logAction('Gasto Pagado', id, '', 'system');
  };

  // ── Empleados + Nómina ────────────────────────────────────────────
  const [empleados, setEmpleados] = useLocalStorage('cielo_empleados', [
    { id: 'EMP-001', nombre: 'Andrés Martínez', cargo: 'Conductor / Despachador', salarioDia: 66667, tipo: 'Fijo', activo: true },
    { id: 'EMP-002', nombre: 'Carlos Roa', cargo: 'Operario de Equipos', salarioDia: 50000, tipo: 'Fijo', activo: true },
    { id: 'EMP-003', nombre: 'Laura Gómez', cargo: 'Administradora', salarioDia: 83333, tipo: 'Fijo', activo: true },
  ]);

  const [liquidaciones, setLiquidaciones] = useLocalStorage('cielo_liquidaciones', [
    { id: 'LIQ-001', empleadoId: 'EMP-001', periodo: '2023-10-01 / 2023-10-31', diasTrabajados: 26, horasExtra: 8, valorHoraExtra: 12500, deduccionSalud: 4, deduccionPension: 4, fondoSolidaridad: 0, bonificaciones: 0, estado: 'Pagado' },
  ]);

  const addEmpleado = (data) => {
    setEmpleados(prev => {
      const id = `EMP-${String(prev.length + 1).padStart(3, '0')}`;
      logAction('Empleado Registrado', id, data.nombre, 'system');
      return [...prev, { ...data, id, salarioDia: Number(data.salarioDia), activo: true }];
    });
  };

  const addLiquidacion = (data) => {
    setLiquidaciones(prev => {
      const id = `LIQ-${String(prev.length + 1).padStart(3, '0')}`;
      const emp = empleados.find(e => e.id === data.empleadoId);
      logAction('Liquidación Nómina', id, emp?.nombre || data.empleadoId, 'system');
      return [...prev, { ...data, id, estado: 'Pendiente' }];
    });
  };

  const pagarLiquidacion = (id) => {
    setLiquidaciones(prev => prev.map(l => l.id === id ? { ...l, estado: 'Pagado' } : l));
    logAction('Nómina Pagada', id, '', 'system');
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
      logs, maintenances, addMaintenance,
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
