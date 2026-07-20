import React, { useMemo } from 'react';
import {
  Users, Package, FileText, ArrowUpRight, ArrowDownRight,
  TrendingUp, Wrench, AlertTriangle, Clock, ShieldAlert, CheckCircle, Bell,
  Truck, Calculator
} from 'lucide-react';
import { useAppContext } from '../context/AppContext';
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, PieChart, Pie, Cell, BarChart, Bar, Legend
} from 'recharts';
import { format, subDays, eachDayOfInterval, isAfter, parseISO, differenceInDays } from 'date-fns';
import { es } from 'date-fns/locale';

// ─── Color Palette ────────────────────────────────────────────────────────────
const COLORS = {
  blue: '#2365AB',
  green: '#10b981',
  orange: '#f97316',
  red: '#ef4444',
  purple: '#8b5cf6',
  teal: '#06b6d4',
};

// ─── Custom Tooltip ───────────────────────────────────────────────────────────
const CustomTooltip = ({ active, payload, label }) => {
  if (active && payload && payload.length) {
    return (
      <div style={{
        background: 'rgba(24, 24, 27, 0.95)', 
        backdropFilter: 'blur(4px)',
        border: '1px solid rgba(63, 63, 70, 0.5)',
        borderRadius: 12, 
        padding: '12px 16px', 
        fontSize: '0.825rem',
        boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.3)'
      }}>
        <p style={{ color: '#94a3b8', marginBottom: 8, fontWeight: 700, textTransform: 'uppercase', fontSize: '0.7rem', letterSpacing: '0.05em' }}>{label}</p>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {payload.map((p, i) => (
            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <div style={{ width: 8, height: 8, borderRadius: '50%', background: p.color }} />
              <div style={{ color: '#f8fafc', fontWeight: 600 }}>
                {p.name}: {typeof p.value === 'number' && p.name.toLowerCase().includes('$')
                  ? `$${p.value.toLocaleString()}`
                  : p.value.toLocaleString()}
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }
  return null;
};

// ─── Donut Label ──────────────────────────────────────────────────────────────
const renderCustomLabel = ({ cx, cy, midAngle, innerRadius, outerRadius, percent, name }) => {
  const RADIAN = Math.PI / 180;
  const radius = innerRadius + (outerRadius - innerRadius) * 0.5;
  const x = cx + radius * Math.cos(-midAngle * RADIAN);
  const y = cy + radius * Math.sin(-midAngle * RADIAN);
  return percent > 0.06 ? (
    <text x={x} y={y} fill="white" textAnchor="middle" dominantBaseline="central"
      style={{ fontSize: '0.75rem', fontWeight: 700 }}>
      {`${(percent * 100).toFixed(0)}%`}
    </text>
  ) : null;
};

export default function Dashboard() {
  const { clients, products, invoices, settings, remisiones = [], maintenances = [], gastosMantenimiento = [] } = useAppContext();

  // ── Derived Alerts ──────────────────────────────────────────────────────────
  const alerts = useMemo(() => {
    const list = [];
    const today = new Date();

    const overdue = invoices.filter(inv => inv.status !== 'Paid' && differenceInDays(today, parseISO(inv.date)) > 30);
    if (overdue.length > 0) {
      list.push({ id: 'overdue', type: 'error', icon: ShieldAlert, title: `${overdue.length} Facturas Vencidas`, desc: 'Existen cobros con más de 30 días de antigüedad sin liquidar.' });
    }

    const pendingMaint = maintenances.filter(m => m.status === 'Pendiente' || m.status === 'En Proceso');
    if (pendingMaint.length > 0) {
      list.push({ id: 'maint', type: 'warning', icon: Wrench, title: `${pendingMaint.length} Equipos en Mantenimiento`, desc: 'Hay equipos fuera de servicio que requieren atención.' });
    }

    const pendingRem = remisiones.filter(r => r.estado === 'Pendiente');
    if (pendingRem.length > 0) {
      list.push({ id: 'rem', type: 'info', icon: Truck, title: `${pendingRem.length} Remisiones por Despachar`, desc: 'Equipos listos para salida que aún no han sido confirmados.' });
    }

    const longInObra = remisiones.filter(r => (r.estado === 'Activa' || r.estado === 'Parcial') && differenceInDays(today, parseISO(r.fecha)) > 30);
    if (longInObra.length > 0) {
      list.push({ id: 'corte', type: 'success', icon: Calculator, title: `${longInObra.length} Cortes Sugeridos`, desc: 'Equipos con más de 30 días en obra. Se recomienda realizar un corte de cuenta.' });
    }

    return list;
  }, [invoices, remisiones, maintenances]);

  // ── Derived KPIs ────────────────────────────────────────────────────────────
  const totalDebt = clients.reduce((acc, c) => acc + c.debt, 0);
  const totalUnits = products.reduce((acc, p) => acc + (p.totalStock || 0), 0);
  const availableUnits = products.reduce((acc, p) => acc + (p.availableStock || 0), 0);
  const rentedUnits = totalUnits - availableUnits;

  const totalRevenue = invoices
    .filter(inv => inv.status === 'Paid')
    .reduce((acc, inv) => acc + inv.amount, 0);

  const pendingRevenue = invoices
    .filter(inv => inv.status === 'Pending')
    .reduce((acc, inv) => acc + inv.amount, 0);

  const activeMaintenances = maintenances.filter(m => m.status === 'En Proceso').length;
  const pendingMaintenances = maintenances.filter(m => m.status === 'Pendiente').length;
  const maintIndex = maintenances.length > 0
    ? Math.round((maintenances.filter(m => m.status === 'Completado').length / maintenances.length) * 100)
    : 0;

  // ── Category Derived KPIs ───────────────────────────────────────────────────
  const getCategoryStats = (categoriesArray) => {
    const cats = products.filter(p => categoriesArray.includes(p.category) || categoriesArray.includes(p.category?.toLowerCase()));
    const total = cats.reduce((acc, p) => acc + (p.totalStock || 0), 0);
    const available = cats.reduce((acc, p) => acc + (p.availableStock || 0), 0);
    return { rented: total - available, total };
  };

  const maqPesada = getCategoryStats(['Heavy Machinery', 'Machinery', 'maquinaria pesada']);
  const maqElectricas = getCategoryStats(['Power Tools', 'herramientas electricas', 'herramientas eléctricas']);
  const estAndamios = getCategoryStats(['Structures', 'estructuras y andamios']);
  const otrosCats = products.filter(p => !['Heavy Machinery', 'Machinery', 'maquinaria pesada', 'Power Tools', 'herramientas electricas', 'herramientas eléctricas', 'Structures', 'estructuras y andamios'].includes(p.category) && !['Heavy Machinery', 'Machinery', 'maquinaria pesada', 'Power Tools', 'herramientas electricas', 'herramientas eléctricas', 'Structures', 'estructuras y andamios'].includes(p.category?.toLowerCase()));
  const otros = {
    total: otrosCats.reduce((acc, p) => acc + (p.totalStock || 0), 0),
    rented: otrosCats.reduce((acc, p) => acc + (p.totalStock || 0) - (p.availableStock || 0), 0)
  };


  // ── Chart 1: Ingresos por día (últimos 7 días) ────────────────────────────
  const revenueByDay = useMemo(() => {
    const today = new Date();
    const days = eachDayOfInterval({ start: subDays(today, 6), end: today });
    return days.map(day => {
      const dayStr = format(day, 'yyyy-MM-dd');
      const paid = invoices
        .filter(inv => inv.status === 'Paid' && inv.date === dayStr)
        .reduce((s, inv) => s + inv.amount, 0);
      const pending = invoices
        .filter(inv => inv.status === 'Pending' && inv.date === dayStr)
        .reduce((s, inv) => s + inv.amount, 0);
      return {
        name: format(day, 'EEE', { locale: es }),
        'Pagado ($)': paid,
        'Pendiente ($)': pending,
      };
    });
  }, [invoices]);

  // ── Chart 2: Egresos por día (últimos 7 días) ─────────────────────────────
  const expensesByDay = useMemo(() => {
    const today = new Date();
    const days = eachDayOfInterval({ start: subDays(today, 6), end: today });
    return days.map(day => {
      const dayStr = format(day, 'yyyy-MM-dd');
      const totalExpense = gastosMantenimiento
        .filter(g => {
          if (!g.fecha_gasto) return false;
          const cleanGastoDate = String(g.fecha_gasto).split('T')[0];
          return cleanGastoDate === dayStr;
        })
        .reduce((s, g) => s + (Number(g.costo) || 0), 0);
      return {
        name: format(day, 'EEE', { locale: es }),
        'Egreso ($)': totalExpense
      };
    });
  }, [gastosMantenimiento]);

  const totalExpenses7Days = useMemo(() => {
    return expensesByDay.reduce((sum, d) => sum + d['Egreso ($)'], 0);
  }, [expensesByDay]);

  // ── Chart 3: Inventario – En Calle vs En Bodega ───────────────────────────
  const inventoryData = [
    { name: 'En Calle', value: rentedUnits, color: COLORS.blue },
    { name: 'En Bodega', value: availableUnits, color: COLORS.purple },
  ];

  // ── Chart 4: Top Clientes por Equipos en Obra ─────────────────────────────
  const topClientsData = useMemo(() => {
    const clientMap = {};
    remisiones.forEach(r => {
      if (r.estado === 'Activa' || r.estado === 'Parcial') {
        const clientName = clients.find(c => c.id === r.clientId)?.name || r.clientId;
        const totalItemsInField = r.items.reduce((sum, item) => sum + (item.cantidad - (item.cantidadDevuelta || 0)), 0);
        if (totalItemsInField > 0) {
          clientMap[clientName] = (clientMap[clientName] || 0) + totalItemsInField;
        }
      }
    });

    return Object.entries(clientMap)
      .map(([name, value]) => ({ 
        name: name.length > 20 ? name.slice(0, 20) + '...' : name, 
        value 
      }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 5);
  }, [remisiones, clients]);

  // ── UI ────────────────────────────────────────────────────────────────────
  return (
    <div>
      {/* Header */}
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1>Panel de Control</h1>
          <p className="text-muted">Resumen ejecutivo de alquileres y finanzas</p>
        </div>
      </div>

      {/* Alerts & Reminders */}
      {alerts.length > 0 && (
        <div style={{ marginBottom: '1.5rem', display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '1rem' }}>
          {alerts.map(alert => (
            <div key={alert.id} className={`alert-card ${alert.type}`} style={{ 
              background: alert.type === 'error' ? 'rgba(239,68,68,0.08)' : alert.type === 'warning' ? 'rgba(245,158,11,0.08)' : alert.type === 'success' ? 'rgba(35,101,171,0.08)' : 'rgba(99,102,241,0.08)',
              border: `1px solid ${alert.type === 'error' ? 'rgba(239,68,68,0.2)' : alert.type === 'warning' ? 'rgba(245,158,11,0.2)' : alert.type === 'success' ? 'rgba(35,101,171,0.2)' : 'rgba(99,102,241,0.2)'}`,
              borderRadius: 12, padding: '1rem', display: 'flex', gap: '0.85rem', alignItems: 'flex-start'
            }}>
              <div style={{ 
                background: alert.type === 'error' ? '#ef4444' : alert.type === 'warning' ? '#f59e0b' : alert.type === 'success' ? '#2365AB' : '#6366f1',
                padding: '0.5rem', borderRadius: 10, color: 'white', display: 'flex'
              }}>
                <alert.icon size={18} />
              </div>
              <div>
                <div style={{ fontWeight: 800, fontSize: '0.9rem', color: 'var(--text-primary)', marginBottom: 2 }}>{alert.title}</div>
                <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', lineHeight: 1.4 }}>{alert.desc}</div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ── Mini KPI Items ─────────────────────────────────────────────────── */}
      <div className="mini-stat-grid">
        {/* Total Clientes */}
        <div className="mini-stat-dashboard blue">
          <div className="stat-mini-value">{clients.length}</div>
          <div className="stat-mini-label">Total Clientes</div>
        </div>

        {/* En Calle / Total */}
        <div className="mini-stat-dashboard orange">
          <div className="stat-mini-value">
            {rentedUnits} <span style={{ fontSize: '0.9rem', opacity: 0.7 }}>/ {totalUnits}</span>
          </div>
          <div className="stat-mini-label">En Calle / Total Unidades</div>
        </div>

        {/* Ingresos Cobrados */}
        <div className="mini-stat-dashboard green">
          <div className="stat-mini-value">${totalRevenue.toLocaleString()}</div>
          <div className="stat-mini-label">Ingresos Cobrados</div>
        </div>

        {/* Cartera Pendiente */}
        <div className="mini-stat-dashboard red">
          <div className="stat-mini-value">${totalDebt.toLocaleString()}</div>
          <div className="stat-mini-label">Cartera Pendiente</div>
        </div>
      </div>

      {/* ── Categorías Mini KPI Items ───────────────────────────────────────── */}
      <h3 className="mb-4" style={{ marginTop: '1rem' }}>Indicadores por Categoría (En Calle / Total)</h3>
      <div className="mini-stat-grid">
        {/* Maquinaria Pesada */}
        <div className="mini-stat-dashboard blue">
          <div className="stat-mini-value">
            {maqPesada.rented} <span style={{ fontSize: '0.9rem', opacity: 0.7 }}>/ {maqPesada.total}</span>
          </div>
          <div className="stat-mini-label">Maquinaria pesada</div>
        </div>

        {/* Herramientas Eléctricas */}
        <div className="mini-stat-dashboard orange">
          <div className="stat-mini-value">
            {maqElectricas.rented} <span style={{ fontSize: '0.9rem', opacity: 0.7 }}>/ {maqElectricas.total}</span>
          </div>
          <div className="stat-mini-label">Herramientas eléctricas</div>
        </div>

        {/* Estructuras y andamios */}
        <div className="mini-stat-dashboard purple">
          <div className="stat-mini-value">
            {estAndamios.rented} <span style={{ fontSize: '0.9rem', opacity: 0.7 }}>/ {estAndamios.total}</span>
          </div>
          <div className="stat-mini-label">Estructuras y andamios</div>
        </div>

        {/* Otros */}
        <div className="mini-stat-dashboard green">
          <div className="stat-mini-value">
            {otros.rented} <span style={{ fontSize: '0.9rem', opacity: 0.7 }}>/ {otros.total}</span>
          </div>
          <div className="stat-mini-label">Otros</div>
        </div>
      </div>



      {/* ── Row 1: Ingresos por día + Cartera Pie ──────────────────────────── */}
      <div className="grid-2" style={{ marginBottom: '1.5rem' }}>
        {/* Area chart – ingresos últimos 7 días */}
        <div className="glass-panel p-6">
          <h3 className="mb-4" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <TrendingUp size={18} style={{ color: COLORS.blue }} />
            Ingresos últimos 7 días
          </h3>
          <div style={{ height: 280 }}>
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={revenueByDay} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="gPagado" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor={COLORS.green} stopOpacity={0.4} />
                    <stop offset="95%" stopColor={COLORS.green} stopOpacity={0.02} />
                  </linearGradient>
                  <linearGradient id="gPendiente" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor={COLORS.orange} stopOpacity={0.4} />
                    <stop offset="95%" stopColor={COLORS.orange} stopOpacity={0.02} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="4 4" stroke="rgba(148, 163, 184, 0.1)" vertical={false} />
                <XAxis 
                  dataKey="name" 
                  stroke="#94a3b8" 
                  tick={{ fontSize: 11, fontWeight: 500 }} 
                  axisLine={false}
                  tickLine={false}
                  dy={10}
                />
                <YAxis 
                  stroke="#94a3b8" 
                  tick={{ fontSize: 10, fontWeight: 500 }} 
                  tickFormatter={v => v >= 1000 ? `$${(v / 1000).toFixed(0)}k` : `$${v}`}
                  axisLine={false}
                  tickLine={false}
                />
                <Tooltip content={<CustomTooltip />} cursor={{ stroke: 'rgba(148, 163, 184, 0.2)', strokeWidth: 2 }} />
                <Legend 
                  verticalAlign="bottom" 
                  height={36} 
                  iconType="circle"
                  wrapperStyle={{ fontSize: '0.75rem', fontWeight: 600, paddingTop: 20 }} 
                />
                <Area 
                  type="monotone" 
                  dataKey="Pagado ($)" 
                  stroke={COLORS.green} 
                  fill="url(#gPagado)" 
                  strokeWidth={3}
                  activeDot={{ r: 6, strokeWidth: 0 }}
                  dot={{ r: 3, fill: COLORS.green, strokeWidth: 0, fillOpacity: 0.4 }}
                />
                <Area 
                  type="monotone" 
                  dataKey="Pendiente ($)" 
                  stroke={COLORS.orange} 
                  fill="url(#gPendiente)" 
                  strokeWidth={3}
                  activeDot={{ r: 6, strokeWidth: 0 }}
                  dot={{ r: 3, fill: COLORS.orange, strokeWidth: 0, fillOpacity: 0.4 }}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Area chart – Egresos últimos 7 días */}
        <div className="glass-panel p-6">
          <h3 className="mb-4" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <ArrowDownRight size={18} style={{ color: COLORS.red }} />
            Egresos últimos 7 días
          </h3>
          <div style={{ height: 280 }}>
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={expensesByDay} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="gEgreso" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor={COLORS.red} stopOpacity={0.4} />
                    <stop offset="95%" stopColor={COLORS.red} stopOpacity={0.02} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="4 4" stroke="rgba(148, 163, 184, 0.1)" vertical={false} />
                <XAxis 
                  dataKey="name" 
                  stroke="#94a3b8" 
                  tick={{ fontSize: 11, fontWeight: 500 }} 
                  axisLine={false}
                  tickLine={false}
                  dy={10}
                />
                <YAxis 
                  stroke="#94a3b8" 
                  tick={{ fontSize: 10, fontWeight: 500 }} 
                  tickFormatter={v => v >= 1000 ? `$${(v / 1000).toFixed(0)}k` : `$${v}`}
                  axisLine={false}
                  tickLine={false}
                />
                <Tooltip content={<CustomTooltip />} cursor={{ stroke: 'rgba(148, 163, 184, 0.2)', strokeWidth: 2 }} />
                <Legend 
                  verticalAlign="bottom" 
                  height={36} 
                  iconType="circle"
                  wrapperStyle={{ fontSize: '0.75rem', fontWeight: 600, paddingTop: 20 }} 
                />
                <Area 
                  type="monotone" 
                  dataKey="Egreso ($)" 
                  stroke={COLORS.red} 
                  fill="url(#gEgreso)" 
                  strokeWidth={3}
                  activeDot={{ r: 6, strokeWidth: 0 }}
                  dot={{ r: 3, fill: COLORS.red, strokeWidth: 0, fillOpacity: 0.4 }}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* ── Row 2: Inventario Donut + Top Clientes ─────────────────────────── */}
      <div className="grid-2">
        {/* Donut – En Calle vs En Bodega */}
        <div className="glass-panel p-6">
          <h3 className="mb-4" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <Package size={18} style={{ color: COLORS.blue }} />
            Inventario: En Calle vs. En Bodega
          </h3>
          <div style={{ height: 220 }}>
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={inventoryData}
                  cx="50%" cy="50%"
                  innerRadius={55} outerRadius={90}
                  labelLine={false}
                  label={renderCustomLabel}
                  paddingAngle={3}
                  dataKey="value"
                >
                  {inventoryData.map((entry, i) => (
                    <Cell key={i} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip 
                  contentStyle={{ background: 'rgba(24, 24, 27, 0.95)', border: '1px solid rgba(63, 63, 70, 0.5)', borderRadius: 12, boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.3)' }} 
                  itemStyle={{ color: '#f8fafc' }} 
                />
                <Legend iconType="circle" wrapperStyle={{ fontSize: '0.75rem', fontWeight: 600 }} />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-around', marginTop: 12 }}>
            <div style={{ textAlign: 'center' }}>
              <div style={{ color: COLORS.blue, fontWeight: 800, fontSize: '1.1rem' }}>{rentedUnits}</div>
              <div style={{ fontSize: '0.7rem', color: '#94a3b8', fontWeight: 600, textTransform: 'uppercase' }}>En Calle</div>
            </div>
            <div style={{ textAlign: 'center' }}>
              <div style={{ color: COLORS.purple, fontWeight: 800, fontSize: '1.1rem' }}>{availableUnits}</div>
              <div style={{ fontSize: '0.7rem', color: '#94a3b8', fontWeight: 600, textTransform: 'uppercase' }}>En Bodega</div>
            </div>
            <div style={{ textAlign: 'center' }}>
              <div style={{ color: '#f8fafc', fontWeight: 800, fontSize: '1.1rem' }}>{totalUnits}</div>
              <div style={{ fontSize: '0.7rem', color: '#94a3b8', fontWeight: 600, textTransform: 'uppercase' }}>Total</div>
            </div>
          </div>
        </div>

        {/* Top Clientes Bar Chart */}
        <div className="glass-panel p-6">
          <h3 className="mb-4" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <Users size={18} style={{ color: COLORS.orange }} />
            Top 5 Clientes (Equipos en Obra)
          </h3>
          <div style={{ height: 280 }}>
            {topClientsData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={topClientsData} layout="vertical" margin={{ left: 20, right: 30, top: 10, bottom: 10 }}>
                  <CartesianGrid strokeDasharray="4 4" stroke="rgba(148, 163, 184, 0.1)" horizontal={false} />
                  <XAxis type="number" hide />
                  <YAxis 
                    dataKey="name" 
                    type="category" 
                    stroke="#94a3b8" 
                    tick={{ fontSize: 11, fontWeight: 600 }} 
                    axisLine={false}
                    tickLine={false}
                    width={120}
                  />
                  <Tooltip 
                    cursor={{ fill: 'transparent' }}
                    content={({ active, payload }) => {
                      if (active && payload && payload.length) {
                        return (
                          <div style={{ background: 'rgba(24, 24, 27, 0.95)', border: '1px solid rgba(63, 63, 70, 0.5)', borderRadius: 10, padding: '8px 12px', boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.3)' }}>
                            <p style={{ margin: 0, color: '#f8fafc', fontWeight: 700, fontSize: '0.8rem' }}>{payload[0].value} unidades</p>
                          </div>
                        );
                      }
                      return null;
                    }}
                  />
                  <Bar 
                    dataKey="value" 
                    fill={COLORS.orange} 
                    radius={[0, 6, 6, 0]} 
                    barSize={24}
                    label={{ position: 'right', fill: '#94a3b8', fontSize: 11, fontWeight: 700, offset: 10 }}
                  />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#94a3b8', fontSize: '0.9rem', fontStyle: 'italic' }}>
                No hay equipos en calle actualmente
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
