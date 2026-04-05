import React, { useRef, useMemo } from 'react';
import {
  Users, Package, FileText, ArrowUpRight, ArrowDownRight,
  TrendingUp, Wrench, Download, Printer
} from 'lucide-react';
import { useAppContext } from '../context/AppContext';
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, PieChart, Pie, Cell, BarChart, Bar, Legend
} from 'recharts';
import { format, parseISO, subDays, eachDayOfInterval } from 'date-fns';
import { es } from 'date-fns/locale';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { applyStandardLayout } from './pdfTheme';
import * as XLSX from 'xlsx';
import html2canvas from 'html2canvas';

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
        background: '#18181b', border: '1px solid #3f3f46',
        borderRadius: 8, padding: '10px 14px', fontSize: '0.8rem'
      }}>
        <p style={{ color: '#94a3b8', marginBottom: 6 }}>{label}</p>
        {payload.map((p, i) => (
          <p key={i} style={{ color: p.color, fontWeight: 600 }}>
            {p.name}: {typeof p.value === 'number' && p.name.toLowerCase().includes('$')
              ? `$${p.value.toLocaleString()}`
              : p.value.toLocaleString()}
          </p>
        ))}
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
  const { clients, products, invoices, settings, maintenances = [] } = useAppContext();
  const dashboardRef = useRef(null);

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

  // ── Chart 2: Cartera – Pagado vs Pendiente ────────────────────────────────
  const carteraData = [
    { name: 'Pagado', value: totalRevenue, color: COLORS.green },
    { name: 'Pendiente', value: pendingRevenue, color: COLORS.orange },
  ];

  // ── Chart 3: Inventario – En Calle vs En Bodega ───────────────────────────
  const inventoryData = [
    { name: 'En Calle', value: rentedUnits, color: COLORS.blue },
    { name: 'En Bodega', value: availableUnits, color: COLORS.purple },
  ];

  // ── Chart 4: Inventario detallado por producto ────────────────────────────
  const inventoryDetail = products.map(p => ({
    name: p.name.length > 18 ? p.name.slice(0, 18) + '…' : p.name,
    'En Calle': (p.totalStock || 0) - (p.availableStock || 0),
    'En Bodega': p.availableStock || 0,
  }));

  // ── Export to PDF ─────────────────────────────────────────────────────────
  const exportPDF = async () => {
    const doc = new jsPDF({ orientation: 'landscape' });
    const margin = 10;
    
    let y = applyStandardLayout(doc, 'Panel de Control - Reporte Ejecutivo', settings);

    // Indicators section
    doc.setTextColor(30, 41, 59); doc.setFontSize(10); doc.setFont('helvetica', 'bold');
    doc.text('1. Indicadores Clave', margin, y);

    autoTable(doc, {
      startY: y + 5,
      head: [['Métrica', 'Valor', 'Métrica', 'Valor']],
      body: [
        ['Total Clientes', clients.length.toString(), 'Ingresos Cobrados', `$${totalRevenue.toLocaleString()}`],
        ['Unidades en Calle', rentedUnits.toString(), 'Cartera Pendiente', `$${pendingRevenue.toLocaleString()}`],
        ['Unidades en Bodega', availableUnits.toString(), 'Total Facturas', invoices.length.toString()],
        ['Total Unidades', totalUnits.toString(), 'Facturas Pagadas', invoices.filter(i => i.status === 'Paid').length.toString()],
      ],
      headStyles: { fillColor: [30, 41, 59], textColor: 255, fontSize: 8 },
      styles: { fontSize: 8, cellPadding: 3 },
      alternateRowStyles: { fillColor: [248, 250, 252] },
      margin: { left: margin, right: margin },
    });

    // Facturas detail
    const afterKPIs = doc.lastAutoTable.finalY + 12;
    doc.setFontSize(10); doc.setFont('helvetica', 'bold');
    doc.text('2. Detalle de Facturación Reciente', margin, afterKPIs);

    const clientMap = Object.fromEntries(clients.map(c => [c.id, c.name]));
    autoTable(doc, {
      startY: afterKPIs + 5,
      head: [['Factura', 'Cliente', 'Monto', 'Estado', 'Fecha']],
      body: invoices.slice(0, 20).map(inv => [
        inv.id,
        clientMap[inv.clientId] || inv.clientId,
        `$${inv.amount.toLocaleString()}`,
        inv.status === 'Paid' ? 'PAGADA' : 'PENDIENTE',
        inv.date,
      ]),
      headStyles: { fillColor: [30, 41, 59], textColor: 255, fontSize: 8 },
      styles: { fontSize: 8, cellPadding: 3 },
      alternateRowStyles: { fillColor: [248, 250, 252] },
      margin: { left: margin, right: margin },
    });

    // Dashboard view
    if (dashboardRef.current) {
      doc.addPage('a4', 'landscape');
      applyStandardLayout(doc, 'Panel de Control - Captura Visual', settings);
      
      const canvas = await html2canvas(dashboardRef.current, { backgroundColor: '#09090b', scale: 1.2 });
      const imgData = canvas.toDataURL('image/png');
      const pageW = doc.internal.pageSize.getWidth();
      const pageH = doc.internal.pageSize.getHeight();
      
      doc.addImage(imgData, 'PNG', 10, 45, pageW - 20, pageH - 60);
    }

    doc.save(`Dashboard_${settings?.companyName || 'CIELO'}_${format(new Date(), 'yyyyMMdd_HHmm')}.pdf`);
  };

  // ── Export to Excel ───────────────────────────────────────────────────────
  const exportExcel = () => {
    const wb = XLSX.utils.book_new();
    const clientMap = Object.fromEntries(clients.map(c => [c.id, c.name]));

    // Sheet 1: KPIs
    const kpiData = [
      ['Métrica', 'Valor'],
      ['Total Clientes', clients.length],
      ['Unidades en Calle', rentedUnits],
      ['Unidades en Bodega', availableUnits],
      ['Total Unidades', totalUnits],
      ['Ingresos Cobrados ($)', totalRevenue],
      ['Cartera Pendiente ($)', pendingRevenue],
      ['Total Facturas', invoices.length],
      ['Facturas Pagadas', invoices.filter(i => i.status === 'Paid').length],
      ['Facturas Pendientes', invoices.filter(i => i.status === 'Pending').length],
    ];
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(kpiData), 'KPIs');

    // Sheet 2: Facturas
    const invData = [['ID', 'Cliente', 'Monto', 'Estado', 'Fecha'],
    ...invoices.map(inv => [
      inv.id,
      clientMap[inv.clientId] || inv.clientId,
      inv.amount,
      inv.status === 'Paid' ? 'Pagado' : 'Pendiente',
      inv.date,
    ])
    ];
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(invData), 'Facturas');

    // Sheet 3: Inventario
    const prodData = [['ID', 'Nombre', 'Categoría', 'Total', 'En Bodega', 'En Calle', 'Valor Unit.'],
    ...products.map(p => [
      p.id, p.name, p.category || '',
      p.totalStock || 0, p.availableStock || 0,
      (p.totalStock || 0) - (p.availableStock || 0),
      p.value || 0,
    ])
    ];
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(prodData), 'Inventario');

    // Sheet 4: Clientes
    const cliData = [['ID', 'Nombre', 'Obra', 'Email', 'Teléfono', 'Cartera ($)', 'Desde'],
    ...clients.map(c => [c.id, c.name, c.obra, c.email, c.phone, c.debt, c.joined])
    ];
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(cliData), 'Clientes');

    XLSX.writeFile(wb, `Reporte_${settings?.shortName || 'CIELO'}_${format(new Date(), 'yyyyMMdd_HHmm')}.xlsx`);
  };

  // ── UI ────────────────────────────────────────────────────────────────────
  return (
    <div ref={dashboardRef}>
      {/* Header */}
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1>Panel de Control</h1>
          <p className="text-muted">Resumen ejecutivo de alquileres y finanzas</p>
        </div>
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          <button className="btn btn-secondary" onClick={exportExcel} style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
            <Download size={16} /> Excel / CSV
          </button>
          <button className="btn btn-secondary" onClick={exportPDF} style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
            <Printer size={16} /> PDF
          </button>
        </div>
      </div>

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

      {/* ── Categorías KPI Cards ───────────────────────────────────────────── */}
      <h3 className="mb-4" style={{ marginTop: '1rem' }}>Indicadores por Categoría (En Calle / Total)</h3>
      <div className="grid-cards" style={{ marginBottom: '1.5rem' }}>
        {/* Maquinaria Pesada */}
        <div className="stat-card blue">
          <div className="icon-wrapper blue"><Wrench size={24} /></div>
          <div>
            <div className="stat-value">{maqPesada.rented} <span style={{ fontSize: '1rem', color: 'var(--text-muted)' }}>/ {maqPesada.total}</span></div>
            <div className="stat-label">Maquinaria pesada</div>
          </div>
        </div>

        {/* Herramientas Eléctricas */}
        <div className="stat-card orange">
          <div className="icon-wrapper orange"><Wrench size={24} /></div>
          <div>
            <div className="stat-value">{maqElectricas.rented} <span style={{ fontSize: '1rem', color: 'var(--text-muted)' }}>/ {maqElectricas.total}</span></div>
            <div className="stat-label">Herramientas eléctricas</div>
          </div>
        </div>

        {/* Estructuras y andamios */}
        <div className="stat-card purple">
          <div className="icon-wrapper purple"><Package size={24} /></div>
          <div>
            <div className="stat-value">{estAndamios.rented} <span style={{ fontSize: '1rem', color: 'var(--text-muted)' }}>/ {estAndamios.total}</span></div>
            <div className="stat-label">Estructuras y andamios</div>
          </div>
        </div>

        {/* Otros */}
        <div className="stat-card green">
          <div className="icon-wrapper green"><Package size={24} /></div>
          <div>
            <div className="stat-value">{otros.rented} <span style={{ fontSize: '1rem', color: 'var(--text-muted)' }}>/ {otros.total}</span></div>
            <div className="stat-label">Otros</div>
          </div>
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
              <AreaChart data={revenueByDay}>
                <defs>
                  <linearGradient id="gPagado" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor={COLORS.green} stopOpacity={0.35} />
                    <stop offset="95%" stopColor={COLORS.green} stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="gPendiente" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor={COLORS.orange} stopOpacity={0.35} />
                    <stop offset="95%" stopColor={COLORS.orange} stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#3f3f46" vertical={false} />
                <XAxis dataKey="name" stroke="#94a3b8" tick={{ fontSize: 12 }} />
                <YAxis stroke="#94a3b8" tick={{ fontSize: 11 }} tickFormatter={v => v >= 1000 ? `$${(v / 1000).toFixed(0)}k` : `$${v}`} />
                <Tooltip content={<CustomTooltip />} />
                <Legend wrapperStyle={{ fontSize: '0.8rem', paddingTop: 8 }} />
                <Area type="monotone" dataKey="Pagado ($)" stroke={COLORS.green} fill="url(#gPagado)" strokeWidth={2} />
                <Area type="monotone" dataKey="Pendiente ($)" stroke={COLORS.orange} fill="url(#gPendiente)" strokeWidth={2} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Pie – Cartera */}
        <div className="glass-panel p-6">
          <h3 className="mb-4" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <FileText size={18} style={{ color: COLORS.orange }} />
            Estado de Cartera
          </h3>
          <div style={{ height: 220 }}>
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={carteraData}
                  cx="50%" cy="50%"
                  innerRadius={55} outerRadius={90}
                  labelLine={false}
                  label={renderCustomLabel}
                  paddingAngle={3}
                  dataKey="value"
                >
                  {carteraData.map((entry, i) => (
                    <Cell key={i} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip formatter={(v) => `$${v.toLocaleString()}`} contentStyle={{ background: '#18181b', border: '1px solid #3f3f46', borderRadius: 8 }} itemStyle={{ color: '#f8fafc' }} />
                <Legend wrapperStyle={{ fontSize: '0.8rem' }} />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-around', marginTop: 8 }}>
            <div style={{ textAlign: 'center' }}>
              <div style={{ color: COLORS.green, fontWeight: 700, fontSize: '1rem' }}>${totalRevenue.toLocaleString()}</div>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Cobrado</div>
            </div>
            <div style={{ textAlign: 'center' }}>
              <div style={{ color: COLORS.orange, fontWeight: 700, fontSize: '1rem' }}>${pendingRevenue.toLocaleString()}</div>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Pendiente</div>
            </div>
          </div>
        </div>
      </div>

      {/* ── Row 2: Inventario Donut + Detalle por Producto ─────────────────── */}
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
                <Tooltip contentStyle={{ background: '#18181b', border: '1px solid #3f3f46', borderRadius: 8 }} itemStyle={{ color: '#f8fafc' }} />
                <Legend wrapperStyle={{ fontSize: '0.8rem' }} />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-around', marginTop: 8 }}>
            <div style={{ textAlign: 'center' }}>
              <div style={{ color: COLORS.blue, fontWeight: 700, fontSize: '1rem' }}>{rentedUnits}</div>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>En Calle</div>
            </div>
            <div style={{ textAlign: 'center' }}>
              <div style={{ color: COLORS.purple, fontWeight: 700, fontSize: '1rem' }}>{availableUnits}</div>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>En Bodega</div>
            </div>
            <div style={{ textAlign: 'center' }}>
              <div style={{ color: 'var(--text-primary)', fontWeight: 700, fontSize: '1rem' }}>{totalUnits}</div>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Total</div>
            </div>
          </div>
        </div>

        {/* Bar – por producto */}
        <div className="glass-panel p-6">
          <h3 className="mb-4" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <Wrench size={18} style={{ color: COLORS.purple }} />
            Distribución por Equipo
          </h3>
          <div style={{ height: 280 }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={inventoryDetail} layout="vertical" barCategoryGap="30%">
                <CartesianGrid strokeDasharray="3 3" stroke="#3f3f46" horizontal={false} />
                <XAxis type="number" stroke="#94a3b8" tick={{ fontSize: 11 }} allowDecimals={false} />
                <YAxis type="category" dataKey="name" stroke="#94a3b8" tick={{ fontSize: 11 }} width={100} />
                <Tooltip contentStyle={{ background: '#18181b', border: '1px solid #3f3f46', borderRadius: 8 }} itemStyle={{ color: '#f8fafc' }} />
                <Legend wrapperStyle={{ fontSize: '0.8rem' }} />
                <Bar dataKey="En Calle" fill={COLORS.blue} radius={[0, 4, 4, 0]} />
                <Bar dataKey="En Bodega" fill={COLORS.purple} radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
    </div>
  );
}
