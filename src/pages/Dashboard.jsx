import React, { useMemo, useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import {
  Users, Package, FileText, ArrowUpRight, ArrowDownRight,
  TrendingUp, Wrench, AlertTriangle, Clock, ShieldAlert, CheckCircle, Bell,
  Truck, Calculator, UserCheck, Forklift, Building2, Briefcase
} from 'lucide-react';
import { useAppContext } from '../context/AppContext';
import * as echarts from 'echarts';
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

// ─── Custom Theme Listener Hook ───────────────────────────────────────────────
function useThemeMode() {
  const [isDark, setIsDark] = useState(() => document.documentElement.getAttribute('data-theme') === 'dark');

  useEffect(() => {
    const observer = new MutationObserver(() => {
      setIsDark(document.documentElement.getAttribute('data-theme') === 'dark');
    });

    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['data-theme']
    });

    return () => observer.disconnect();
  }, []);

  return isDark;
}

// ─── EChart Helper Component ──────────────────────────────────────────────────
function EChart({ option, onInit }) {
  const containerRef = useRef(null);
  const chartRef = useRef(null);

  useEffect(() => {
    if (!containerRef.current) return;

    const chart = echarts.init(containerRef.current, null, {
      renderer: 'canvas',
      devicePixelRatio: window.devicePixelRatio || 2
    });
    chartRef.current = chart;
    chart.setOption(option);

    if (onInit) {
      onInit(chart);
    }

    const resizeObserver = new ResizeObserver(() => {
      if (chartRef.current) {
        chartRef.current.resize();
      }
    });
    resizeObserver.observe(containerRef.current);

    return () => {
      resizeObserver.disconnect();
      chart.dispose();
    };
  }, []);

  useEffect(() => {
    if (chartRef.current) {
      chartRef.current.setOption(option, true);
    }
  }, [option]);

  return <div ref={containerRef} style={{ width: '100%', height: '100%' }} />;
}

// ─── Mini Progress Circle Component ───────────────────────────────────────────
function MiniProgressCircle({ percent, color = '#2365AB' }) {
  const radius = 22;
  const strokeWidth = 5;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (percent / 100) * circumference;

  return (
    <div style={{ position: 'relative', width: 54, height: 54, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
      <svg width="54" height="54" viewBox="0 0 54 54" style={{ transform: 'rotate(-90deg)' }}>
        {/* Background Circle */}
        <circle
          cx="27"
          cy="27"
          r={radius}
          fill="transparent"
          stroke="var(--surface-hover)"
          strokeWidth={strokeWidth}
        />
        {/* Progress Circle */}
        <circle
          cx="27"
          cy="27"
          r={radius}
          fill="transparent"
          stroke={color}
          strokeWidth={strokeWidth}
          strokeDasharray={circumference}
          strokeDashoffset={strokeDashoffset}
          strokeLinecap="round"
          style={{ transition: 'stroke-dashoffset 0.3s ease-in-out' }}
        />
      </svg>
      {/* Percentage Text in Center */}
      <span style={{ position: 'absolute', fontSize: '0.8rem', fontWeight: 800, color: 'var(--text-primary)' }}>
        {Math.round(percent)}%
      </span>
    </div>
  );
}

export default function Dashboard() {
  const { clients, products, invoices, settings, remisiones = [], maintenances = [], gastosMantenimiento = [] } = useAppContext();
  const revenueChartRef = useRef(null);
  const kpiTooltipCardRef = useRef(null);
  const [kpiTooltipVisible, setKpiTooltipVisible] = useState(false);
  const [kpiTooltipPos, setKpiTooltipPos] = useState({ top: 0, left: 0 });
  const [dataViewOpen, setDataViewOpen] = useState(false);
  const [startDateFilter, setStartDateFilter] = useState(() => format(subDays(new Date(), 6), 'yyyy-MM-dd'));
  const [endDateFilter, setEndDateFilter] = useState(() => format(new Date(), 'yyyy-MM-dd'));
  const carteraChartRef = useRef(null);
  const [carteraDataViewOpen, setCarteraDataViewOpen] = useState(false);
  const [revenueLineVisible, setRevenueLineVisible] = useState(true);
  const [revenueBarsVisible, setRevenueBarsVisible] = useState(true);
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
  const rentedPct = totalUnits > 0 ? Math.round((rentedUnits / totalUnits) * 100) : 0;
  const availablePct = totalUnits > 0 ? 100 - rentedPct : 0;

  const totalRevenue = invoices
    .filter(inv => inv.status === 'Paid')
    .reduce((acc, inv) => acc + inv.amount, 0);

  const pendingRevenue = invoices
    .filter(inv => inv.status === 'Pending')
    .reduce((acc, inv) => acc + inv.amount, 0);

  const totalFinancialVolume = totalRevenue + totalDebt;
  const collectedPct = totalFinancialVolume > 0 ? (totalRevenue / totalFinancialVolume) * 100 : 0;

  const pendingRemCount = remisiones.filter(r => r.estado === 'Pendiente').length;
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


  // ── Chart 1: Ingresos por día (Filtro por Período) ────────────────────────────
  const revenueByDay = useMemo(() => {
    if (!startDateFilter || !endDateFilter) return [];
    const start = parseISO(startDateFilter);
    const end = parseISO(endDateFilter);
    if (isAfter(start, end)) return [];

    const days = eachDayOfInterval({ start, end });
    return days.map(day => {
      const dayStr = format(day, 'yyyy-MM-dd');
      const paid = invoices
        .filter(inv => inv.status === 'Paid' && inv.date === dayStr)
        .reduce((s, inv) => s + inv.amount, 0);
      const pending = invoices
        .filter(inv => inv.status === 'Pending' && inv.date === dayStr)
        .reduce((s, inv) => s + inv.amount, 0);
      return {
        name: format(day, 'EEE dd', { locale: es }),
        'Pagado ($)': paid,
        'Pendiente ($)': pending,
        dateStr: dayStr
      };
    });
  }, [invoices, startDateFilter, endDateFilter]);

  // ── Chart Cartera por día (Filtro por Período) ────────────────────────────
  const carteraByDay = useMemo(() => {
    if (!startDateFilter || !endDateFilter) return [];
    const start = parseISO(startDateFilter);
    const end = parseISO(endDateFilter);
    if (isAfter(start, end)) return [];

    const days = eachDayOfInterval({ start, end });
    return days.map(day => {
      const dayStr = format(day, 'yyyy-MM-dd');
      const pending = invoices
        .filter(inv => inv.status === 'Pending' && inv.date === dayStr)
        .reduce((s, inv) => s + inv.amount, 0);
      return {
        name: format(day, 'EEE dd', { locale: es }),
        'Pendiente ($)': pending,
        dateStr: dayStr
      };
    });
  }, [invoices, startDateFilter, endDateFilter]);

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

  const isDark = useThemeMode();

  const themeConfig = useMemo(() => {
    return {
      textColor: isDark ? '#94a3b8' : '#64748b',
      splitLineColor: isDark ? 'rgba(255, 255, 255, 0.08)' : 'rgba(148, 163, 184, 0.1)',
      axisLineColor: isDark ? '#334155' : '#cbd5e1',
      tooltipBg: isDark ? '#1e293b' : '#ffffff',
      tooltipBorderColor: isDark ? '#334155' : '#e2e8f0',
      tooltipTextColor: isDark ? '#f8fafc' : '#0f172a'
    };
  }, [isDark]);

  const revenueOption = useMemo(() => {
    const daysStr = revenueByDay.map(d => d.name);
    const dataPaid = revenueByDay.map(d => d['Pagado ($)']);
    const dataPending = revenueByDay.map(d => d['Pendiente ($)']);
    
    const today = new Date();
    const daysInterval = eachDayOfInterval({ start: subDays(today, 6), end: today });
    const dataCount = daysInterval.map(day => {
      const dayStr = format(day, 'yyyy-MM-dd');
      return invoices.filter(inv => inv.date === dayStr).length;
    });

    const maxPaidPending = Math.max(...dataPaid, ...dataPending, 1000);
    const leftMax = Math.ceil(maxPaidPending / 500000) * 500000;
    const leftInterval = leftMax / 5;

    const maxCount = Math.max(...dataCount, 5);
    const rightMax = Math.ceil(maxCount / 5) * 5;
    const rightInterval = rightMax / 5;

    return {
      tooltip: {
        trigger: 'axis',
        axisPointer: {
          type: 'cross',
          crossStyle: {
            color: '#999'
          }
        },
        backgroundColor: themeConfig.tooltipBg,
        borderColor: themeConfig.tooltipBorderColor,
        textStyle: { color: themeConfig.tooltipTextColor, fontSize: 12 }
      },
      toolbox: { show: false },
      legend: {
        data: ['Pagado ($)', 'Pendiente ($)', 'Cobros Realizados'],
        bottom: 0,
        selectedMode: true,
        textStyle: { color: themeConfig.textColor, fontSize: 11, fontWeight: 600 }
      },
      grid: {
        top: '12%',
        left: '2%',
        right: '2%',
        bottom: '15%',
        containLabel: true
      },
      xAxis: [
        {
          type: 'category',
          data: daysStr,
          axisPointer: {
            type: 'shadow'
          },
          axisLine: { show: false },
          axisTick: { show: false },
          axisLabel: { color: '#000000', fontSize: 13, fontWeight: 700 }
        }
      ],
      yAxis: [
        {
          type: 'value',
          name: 'Pesos ($)',
          nameTextStyle: { color: '#000000', fontWeight: 700, fontSize: 11 },
          min: 0,
          max: leftMax,
          interval: leftInterval,
          splitLine: { lineStyle: { color: themeConfig.splitLineColor, type: 'dashed' } },
          axisLine: { show: false },
          axisTick: { show: false },
          axisLabel: {
            color: '#000000',
            fontSize: 12,
            fontWeight: 700,
            formatter: v => v >= 1000000 ? `$${(v / 1000000).toFixed(1)}M` : v >= 1000 ? `$${(v / 1000).toFixed(0)}k` : `$${v}`
          }
        },
        {
          type: 'value',
          name: 'Cobros',
          nameTextStyle: { color: '#000000', fontWeight: 700, fontSize: 11 },
          min: 0,
          max: rightMax,
          interval: rightInterval,
          splitLine: { show: false },
          axisLine: { show: false },
          axisTick: { show: false },
          axisLabel: {
            color: '#000000',
            fontSize: 12,
            fontWeight: 700,
            formatter: '{value} und'
          }
        }
      ],
      series: [
        {
          name: 'Pagado ($)',
          type: 'bar',
          barWidth: 24,
          itemStyle: {
            color: COLORS.green,
            borderRadius: [4, 4, 0, 0]
          },
          tooltip: {
            valueFormatter: function (value) {
              return '$' + Number(value).toLocaleString('es-CO');
            }
          },
          data: dataPaid
        },
        {
          name: 'Pendiente ($)',
          type: 'bar',
          barWidth: 24,
          itemStyle: {
            color: COLORS.orange,
            borderRadius: [4, 4, 0, 0]
          },
          tooltip: {
            valueFormatter: function (value) {
              return '$' + Number(value).toLocaleString('es-CO');
            }
          },
          data: dataPending
        },
        {
          name: 'Cobros Realizados',
          type: 'line',
          yAxisIndex: 1,
          smooth: true,
          showSymbol: true,
          symbolSize: 8,
          lineStyle: { width: 3.5, color: COLORS.blue },
          itemStyle: { color: COLORS.blue, borderWidth: 2, borderColor: '#fff' },
          tooltip: {
            valueFormatter: function (value) {
              return value + ' transacciones';
            }
          },
          data: dataCount
        }
      ]
    };
  }, [revenueByDay, invoices, themeConfig]);

  const carteraOption = useMemo(() => {
    const daysStr = carteraByDay.map(d => d.name);
    const dataPending = carteraByDay.map(d => d['Pendiente ($)']);

    const maxPending = Math.max(...dataPending, 1000);
    const leftMax = Math.ceil(maxPending / 500000) * 500000;
    const leftInterval = leftMax / 5;

    return {
      tooltip: {
        trigger: 'axis',
        axisPointer: { type: 'shadow' },
        backgroundColor: themeConfig.tooltipBg,
        borderColor: themeConfig.tooltipBorderColor,
        textStyle: { color: themeConfig.tooltipTextColor, fontSize: 12 },
        formatter: function(params) {
          let res = `<div style="font-weight: 700; margin-bottom: 6px; color: ${themeConfig.textColor}; font-size: 10px; text-transform: uppercase; letter-spacing: 0.05em;">${params[0].name}</div>`;
          params.forEach(p => {
            res += `<div style="display: flex; align-items: center; gap: 8px; margin-top: 4px;">
              <span style="display: inline-block; width: 8px; height: 8px; border-radius: 50%; background: ${p.color};"></span>
              <span style="color: ${themeConfig.tooltipTextColor}; font-weight: 600;">${p.seriesName}: $${Number(p.value).toLocaleString('es-CO')}</span>
            </div>`;
          });
          return res;
        }
      },
      legend: {
        data: ['Cartera Pendiente ($)'],
        bottom: 0,
        textStyle: { color: themeConfig.textColor, fontSize: 11, fontWeight: 600 }
      },
      grid: {
        top: '12%',
        left: '2%',
        right: '2%',
        bottom: '15%',
        containLabel: true
      },
      xAxis: {
        type: 'category',
        data: daysStr,
        axisLine: { show: false },
        axisTick: { show: false },
        axisLabel: { color: themeConfig.textColor, fontSize: 11, fontWeight: 500 }
      },
      yAxis: {
        type: 'value',
        splitLine: { lineStyle: { color: themeConfig.splitLineColor, type: 'dashed' } },
        axisLine: { show: false },
        axisTick: { show: false },
        axisLabel: {
          color: themeConfig.textColor,
          fontSize: 10,
          formatter: v => v >= 1000000 ? `$${(v / 1000000).toFixed(1)}M` : v >= 1000 ? `$${(v / 1000).toFixed(0)}k` : `$${v}`
        }
      },
      series: [
        {
          name: 'Cartera Pendiente ($)',
          type: 'bar',
          barWidth: 32,
          itemStyle: {
            color: COLORS.orange,
            borderRadius: [6, 6, 0, 0]
          },
          data: dataPending
        }
      ]
    };
  }, [carteraByDay, themeConfig]);

  const expensesOption = useMemo(() => {
    return {
      tooltip: {
        trigger: 'axis',
        backgroundColor: themeConfig.tooltipBg,
        borderColor: themeConfig.tooltipBorderColor,
        textStyle: { color: themeConfig.tooltipTextColor, fontSize: 12 },
        formatter: function(params) {
          let res = `<div style="font-weight: 700; margin-bottom: 6px; color: ${themeConfig.textColor}; font-size: 10px; text-transform: uppercase; letter-spacing: 0.05em;">${params[0].name}</div>`;
          params.forEach(p => {
            res += `<div style="display: flex; align-items: center; gap: 8px; margin-top: 4px;">
              <span style="display: inline-block; width: 8px; height: 8px; border-radius: 50%; background: ${p.color};"></span>
              <span style="color: ${themeConfig.tooltipTextColor}; font-weight: 600;">${p.seriesName}: $${Number(p.value).toLocaleString('es-CO')}</span>
            </div>`;
          });
          return res;
        }
      },
      legend: {
        data: ['Egreso ($)'],
        bottom: 0,
        textStyle: { color: themeConfig.textColor, fontSize: 11, fontWeight: 600 }
      },
      grid: {
        top: '10%',
        left: '2%',
        right: '2%',
        bottom: '15%',
        containLabel: true
      },
      xAxis: {
        type: 'category',
        boundaryGap: false,
        data: expensesByDay.map(d => d.name),
        axisLine: { show: false },
        axisTick: { show: false },
        axisLabel: { color: themeConfig.textColor, fontSize: 11, fontWeight: 500 }
      },
      yAxis: {
        type: 'value',
        splitLine: { lineStyle: { color: themeConfig.splitLineColor, type: 'dashed' } },
        axisLine: { show: false },
        axisTick: { show: false },
        axisLabel: {
          color: themeConfig.textColor,
          fontSize: 10,
          fontWeight: 500,
          formatter: v => v >= 1000 ? `$${(v / 1000).toFixed(0)}k` : `$${v}`
        }
      },
      series: [
        {
          name: 'Egreso ($)',
          type: 'line',
          smooth: true,
          showSymbol: false,
          lineStyle: { width: 3, color: COLORS.red },
          itemStyle: { color: COLORS.red },
          areaStyle: {
            color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
              { offset: 0, color: COLORS.red + '66' },
              { offset: 1, color: COLORS.red + '00' }
            ])
          },
          data: expensesByDay.map(d => d['Egreso ($)'])
        }
      ]
    };
  }, [expensesByDay, themeConfig]);

  const inventoryOption = useMemo(() => {
    return {
      tooltip: {
        trigger: 'item',
        backgroundColor: themeConfig.tooltipBg,
        borderColor: themeConfig.tooltipBorderColor,
        textStyle: { color: themeConfig.tooltipTextColor, fontSize: 12 },
        formatter: '{b}: <b>{c}</b> unidades ({d}%)'
      },
      legend: {
        show: false
      },
      title: {
        text: `${rentedPct}%`,
        subtext: 'EN USO',
        left: 'center',
        top: 'middle',
        itemGap: 6,
        textStyle: {
          fontSize: 28,
          fontWeight: 800,
          color: themeConfig.tooltipTextColor
        },
        subtextStyle: {
          fontSize: 11,
          fontWeight: 700,
          color: themeConfig.textColor,
          letterSpacing: 1
        }
      },
      series: [
        {
          name: 'Inventario',
          type: 'pie',
          radius: ['62%', '80%'],
          center: ['50%', '50%'],
          avoidLabelOverlap: false,
          itemStyle: {
            borderRadius: 8,
            borderColor: isDark ? '#18181b' : '#ffffff',
            borderWidth: 2
          },
          label: {
            show: false
          },
          emphasis: {
            scale: true,
            scaleSize: 6
          },
          labelLine: {
            show: false
          },
          data: [
            { value: rentedUnits, name: 'En Calle', itemStyle: { color: '#32D64B' } },
            { value: availableUnits, name: 'En Bodega', itemStyle: { color: '#57AB90' } }
          ]
        }
      ]
    };
  }, [rentedUnits, availableUnits, rentedPct, themeConfig, isDark]);

  const topClientsOption = useMemo(() => {
    return {
      tooltip: {
        trigger: 'axis',
        axisPointer: { type: 'shadow' },
        backgroundColor: themeConfig.tooltipBg,
        borderColor: themeConfig.tooltipBorderColor,
        textStyle: { color: themeConfig.tooltipTextColor, fontSize: 12 },
        formatter: function(params) {
          const p = params[0];
          return `<div style="font-weight: 700; color: ${themeConfig.tooltipTextColor};">${p.name}</div>
                  <div style="margin-top: 4px; font-weight: 600; color: ${themeConfig.textColor};">${p.value} unidades</div>`;
        }
      },
      grid: {
        top: '5%',
        left: '2%',
        right: '12%',
        bottom: '5%',
        containLabel: true
      },
      xAxis: {
        type: 'value',
        splitLine: { show: false },
        axisLabel: { show: false }
      },
      yAxis: {
        type: 'category',
        data: topClientsData.map(c => c.name).reverse(),
        axisLine: { show: false },
        axisTick: { show: false },
        axisLabel: {
          color: themeConfig.textColor,
          fontSize: 11,
          fontWeight: 600
        }
      },
      series: [
        {
          name: 'Equipos',
          type: 'bar',
          barWidth: 24,
          data: topClientsData.map(c => c.value).reverse(),
          itemStyle: {
            color: COLORS.orange,
            borderRadius: [0, 6, 6, 0]
          },
          label: {
            show: true,
            position: 'right',
            color: themeConfig.textColor,
            fontSize: 11,
            fontWeight: 700,
            formatter: '{c} und'
          }
        }
      ]
    };
  }, [topClientsData, themeConfig]);

  // ── UI ────────────────────────────────────────────────────────────────────
  return (
    <div>
      {/* Header */}
      <div className="flex justify-between items-center mb-6 flex-wrap gap-4">
        <div>
          <h1>Panel de Control</h1>
          <p className="text-muted">Resumen ejecutivo de alquileres y finanzas</p>
        </div>

        {/* ── Tarjeta de Filtro de Fechas Única (Diseño Sólido y Esquinas Rectas) ── */}
        <div style={{
          background: COLORS.blue,
          color: '#ffffff',
          padding: '0.65rem 1.1rem',
          borderRadius: '8px',
          boxShadow: '0 4px 6px rgba(0, 0, 0, 0.05)',
          display: 'flex',
          alignItems: 'center',
          gap: '1.25rem',
          flexWrap: 'wrap'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Calculator size={16} />
            <span style={{ fontWeight: 700, fontSize: '0.8rem', letterSpacing: '0.02em' }}>PERÍODO DE ANÁLISIS COMERCIAL</span>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '0.8rem', flexWrap: 'wrap' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <label style={{ fontSize: '0.75rem', fontWeight: 600, color: 'rgba(255, 255, 255, 0.9)' }}>Desde:</label>
              <input 
                type="date" 
                value={startDateFilter}
                onChange={(e) => setStartDateFilter(e.target.value)}
                style={{
                  padding: '0.25rem 0.5rem',
                  fontSize: '0.78rem',
                  fontWeight: 600,
                  background: '#ffffff',
                  color: '#1e293b',
                  border: 'none',
                  borderRadius: '4px',
                  outline: 'none',
                  cursor: 'pointer'
                }}
              />
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <label style={{ fontSize: '0.75rem', fontWeight: 600, color: 'rgba(255, 255, 255, 0.9)' }}>Hasta:</label>
              <input 
                type="date" 
                value={endDateFilter}
                onChange={(e) => setEndDateFilter(e.target.value)}
                style={{
                  padding: '0.25rem 0.5rem',
                  fontSize: '0.78rem',
                  fontWeight: 600,
                  background: '#ffffff',
                  color: '#1e293b',
                  border: 'none',
                  borderRadius: '4px',
                  outline: 'none',
                  cursor: 'pointer'
                }}
              />
            </div>
          </div>
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
                <div style={{ fontWeight: 800, fontSize: '0.9rem', color: 'var(--text-primary)', marginBottom: alert.desc ? 2 : 0 }}>{alert.title}</div>
                {alert.desc && <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', lineHeight: 1.4 }}>{alert.desc}</div>}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ── Mini KPI Items ─────────────────────────────────────────────────── */}
      <div className="mini-stat-grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))' }}>
        {/* En Calle / Total */}
        <div
          ref={kpiTooltipCardRef}
          className="mini-stat-dashboard orange"
          style={{ display: 'flex', flexDirection: 'row', alignItems: 'center', gap: '1.35rem', padding: '1.5rem 1.75rem', textAlign: 'left', justifyContent: 'flex-start', overflow: 'visible', position: 'relative' }}
          onMouseEnter={() => {
            const rect = kpiTooltipCardRef.current?.getBoundingClientRect();
            if (rect) setKpiTooltipPos({ top: rect.bottom + 8, left: rect.left + rect.width / 2 });
            setKpiTooltipVisible(true);
          }}
          onMouseLeave={() => setKpiTooltipVisible(false)}
        >
          <MiniProgressCircle percent={rentedPct} color="#f97316" />
          <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
            <div style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.02em' }}>
              Equipos en Calle
            </div>
            <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: 2, fontWeight: 500 }}>
              Alquilados / Disponibles
            </div>
            <div style={{ fontSize: '1.75rem', fontWeight: 800, color: 'var(--text-primary)', lineHeight: 1.1, marginTop: 4 }}>
              {rentedUnits} <span style={{ fontSize: '1rem', opacity: 0.7 }}>/ {totalUnits}</span>
            </div>
          </div>
        </div>

        {/* Tooltip Popup on Hover — portaled to <body> so it always paints above every other card, regardless of stacking context */}
        {createPortal(
          <div
            className="category-kpi-tooltip"
            style={{
              textTransform: 'none',
              position: 'fixed',
              top: kpiTooltipPos.top,
              left: kpiTooltipPos.left,
              transform: kpiTooltipVisible ? 'translateX(-50%) translateY(0)' : 'translateX(-50%) translateY(8px)',
              opacity: kpiTooltipVisible ? 1 : 0,
              visibility: kpiTooltipVisible ? 'visible' : 'hidden',
              zIndex: 1000000
            }}
          >
            <h4 style={{ margin: '0 0 0.5rem 0', fontSize: '0.75rem', textTransform: 'uppercase', color: '#f97316', fontWeight: 800 }}>
              Desglose por Categoría
            </h4>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.45rem', fontSize: '0.75rem', color: 'var(--text-primary)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid var(--surface-border)', paddingBottom: '3px' }}>
                <span>Maquinaria Pesada:</span>
                <span style={{ fontWeight: 700 }}>{maqPesada.rented} / {maqPesada.total}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid var(--surface-border)', paddingBottom: '3px' }}>
                <span>Herramientas Eléctricas:</span>
                <span style={{ fontWeight: 700 }}>{maqElectricas.rented} / {maqElectricas.total}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid var(--surface-border)', paddingBottom: '3px' }}>
                <span>Estructuras y Andamios:</span>
                <span style={{ fontWeight: 700 }}>{estAndamios.rented} / {estAndamios.total}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span>Otros:</span>
                <span style={{ fontWeight: 700 }}>{otros.rented} / {otros.total}</span>
              </div>
            </div>
          </div>,
          document.body
        )}

        {/* Total Clientes */}
        <div className="mini-stat-dashboard blue" style={{ display: 'flex', flexDirection: 'row', alignItems: 'center', gap: '1.35rem', padding: '1.5rem 1.75rem', textAlign: 'left', justifyContent: 'flex-start' }}>
          <div style={{
            width: 54,
            height: 54,
            borderRadius: '50%',
            background: 'rgba(35, 101, 171, 0.1)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#2365AB',
            flexShrink: 0
          }}>
            <UserCheck size={26} />
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
            <div style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.02em' }}>
              Clientes Totales
            </div>
            <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: 2, fontWeight: 500 }}>
              Registrados en sistema
            </div>
            <div style={{ fontSize: '1.75rem', fontWeight: 800, color: 'var(--text-primary)', lineHeight: 1.1, marginTop: 4 }}>
              {clients.length}
            </div>
          </div>
        </div>

        {/* Eficiencia de Cobro */}
        <div className="mini-stat-dashboard green" style={{ display: 'flex', flexDirection: 'row', alignItems: 'center', gap: '1.35rem', padding: '1.5rem 1.75rem', textAlign: 'left', justifyContent: 'flex-start' }}>
          <MiniProgressCircle percent={collectedPct} color="#10b981" />
          <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
            <div style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.02em' }}>
              Eficiencia de Cobro
            </div>
            <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: 2, fontWeight: 500 }}>
              Pendiente: <span style={{ fontWeight: 700 }}>${totalDebt.toLocaleString()}</span>
            </div>
            <div style={{ fontSize: '1.75rem', fontWeight: 800, color: 'var(--text-primary)', lineHeight: 1.1, marginTop: 4 }}>
              ${totalRevenue.toLocaleString()}
            </div>
          </div>
        </div>

        {/* Remisiones por Despachar */}
        <div className="mini-stat-dashboard purple" style={{ display: 'flex', flexDirection: 'row', alignItems: 'center', gap: '1.35rem', padding: '1.5rem 1.75rem', textAlign: 'left', justifyContent: 'flex-start' }}>
          <div style={{
            width: 54,
            height: 54,
            borderRadius: '50%',
            background: 'rgba(139, 92, 246, 0.1)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#8b5cf6',
            flexShrink: 0
          }}>
            <Forklift size={26} />
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
            <div style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.02em' }}>
              Por Despachar
            </div>
            <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: 2, fontWeight: 500 }}>
              Remisiones pendientes
            </div>
            <div style={{ fontSize: '1.75rem', fontWeight: 800, color: 'var(--text-primary)', lineHeight: 1.1, marginTop: 4 }}>
              {pendingRemCount}
            </div>
          </div>
        </div>
      </div>



      {/* ── Row 1: Ingresos por día + Cartera Pie ──────────────────────────── */}
      <div className="grid-2" style={{ marginBottom: '1.5rem' }}>
        {/* Area chart – ingresos últimos 7 días */}
        {/* Area chart – ingresos últimos 7 días */}
        <div className="glass-panel p-6">
          <div className="flex justify-between items-center mb-4 flex-wrap gap-2">
            <h3 style={{ fontSize: '1rem', fontWeight: 700, margin: 0, color: 'var(--text-primary)' }}>
              Ingresos por Período
            </h3>
            
            <div className="flex items-center gap-2 flex-wrap">
              <button 
                onClick={() => {
                  if (revenueChartRef.current) {
                    const nextVisible = !revenueLineVisible;
                    revenueChartRef.current.setOption({
                      legend: {
                        selected: {
                          'Cobros Realizados': nextVisible
                        }
                      }
                    });
                    setRevenueLineVisible(nextVisible);
                  }
                }}
                style={{
                  background: revenueLineVisible ? '#2365AB' : '#cbd5e1',
                  color: revenueLineVisible ? '#ffffff' : '#334155',
                  border: 'none',
                  borderRadius: '6px',
                  padding: '0.4rem 0.75rem',
                  fontSize: '0.75rem',
                  fontWeight: 600,
                  cursor: 'pointer',
                  boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
                }}
              >
                Línea
              </button>
              <button 
                onClick={() => {
                  if (revenueChartRef.current) {
                    const nextVisible = !revenueBarsVisible;
                    revenueChartRef.current.setOption({
                      legend: {
                        selected: {
                          'Pagado ($)': nextVisible,
                          'Pendiente ($)': nextVisible
                        }
                      }
                    });
                    setRevenueBarsVisible(nextVisible);
                  }
                }}
                style={{
                  background: revenueBarsVisible ? '#10b981' : '#cbd5e1',
                  color: revenueBarsVisible ? '#ffffff' : '#334155',
                  border: 'none',
                  borderRadius: '6px',
                  padding: '0.4rem 0.75rem',
                  fontSize: '0.75rem',
                  fontWeight: 600,
                  cursor: 'pointer',
                  boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
                }}
              >
                Barras
              </button>
            </div>
          </div>
          <div style={{ height: 280 }}>
            <EChart option={revenueOption} onInit={(chart) => { revenueChartRef.current = chart; }} />
          </div>
        </div>

        {/* Bar chart – cartera por período */}
        <div className="glass-panel p-6">
          <div className="flex justify-between items-center mb-4 flex-wrap gap-2">
            <h3 style={{ fontSize: '1rem', fontWeight: 700, margin: 0, color: 'var(--text-primary)' }}>
              Cartera por Período
            </h3>
            
            <div className="flex items-center gap-2 flex-wrap">
              <button 
                onClick={() => setCarteraDataViewOpen(true)}
                style={{
                  background: '#475569',
                  color: '#ffffff',
                  border: 'none',
                  borderRadius: '6px',
                  padding: '0.4rem 0.75rem',
                  fontSize: '0.75rem',
                  fontWeight: 600,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px',
                  boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
                }}
              >
                <FileText size={14} /> Datos
              </button>
              <button 
                onClick={() => {
                  if (carteraChartRef.current) {
                    const url = carteraChartRef.current.getDataURL({
                      type: 'png',
                      pixelRatio: 2,
                      backgroundColor: isDark ? '#18181b' : '#ffffff'
                    });
                    const a = document.createElement('a');
                    a.download = `Reporte_Cartera_${format(new Date(), 'yyyy-MM-dd')}.png`;
                    a.href = url;
                    a.click();
                  }
                }}
                style={{
                  background: '#06b6d4',
                  color: '#ffffff',
                  border: 'none',
                  borderRadius: '6px',
                  padding: '0.4rem 0.75rem',
                  fontSize: '0.75rem',
                  fontWeight: 600,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px',
                  boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
                }}
              >
                <ArrowDownRight size={14} /> Guardar
              </button>
            </div>
          </div>
          <div style={{ height: 280 }}>
            <EChart option={carteraOption} onInit={(chart) => { carteraChartRef.current = chart; }} />
          </div>
        </div>
      </div>

      {/* ── Row 2 & 3: Egresos, Top Clientes + Inventario (Span 2) ────────── */}
      <div className="grid-2-span" style={{ marginBottom: '1.5rem' }}>
        {/* Area chart – Egresos últimos 7 días */}
        <div className="glass-panel p-6">
          <h3 className="mb-4" style={{ fontSize: '1rem', fontWeight: 700, margin: 0, color: 'var(--text-primary)' }}>
            Egresos últimos 7 días
          </h3>
          <div style={{ height: 220 }}>
            <EChart option={expensesOption} />
          </div>
        </div>

        {/* Donut – En Calle vs En Bodega (Ocupa 2 filas) */}
        <div className="glass-panel p-6 inventario-double-card">
          <div className="mb-4" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.5rem', flexWrap: 'wrap' }}>
            <h3 style={{ fontSize: '1rem', fontWeight: 700, margin: 0, color: 'var(--text-primary)' }}>
              Inventario: En Calle vs. En Bodega
            </h3>
            <span style={{
              fontSize: '0.72rem', fontWeight: 700, color: 'var(--text-secondary)',
              background: 'var(--surface-hover)', border: '1px solid var(--surface-border)',
              borderRadius: 999, padding: '0.25rem 0.65rem'
            }}>
              {totalUnits > 0 ? `${rentedPct}% de ocupación` : 'Sin unidades registradas'}
            </span>
          </div>
          <div style={{ display: 'flex', flex: 1, alignItems: 'center', gap: '1rem', marginTop: 12, flexWrap: 'wrap' }}>
            {/* Chart (Left) */}
            <div style={{ flex: '1 1 280px', height: 350 }}>
              <EChart option={inventoryOption} />
            </div>
            {/* Data (Right) */}
            <div style={{ flex: '1 1 180px', display: 'flex', flexDirection: 'column', gap: '1.75rem', justifyContent: 'center', paddingLeft: '1.5rem', borderLeft: '1px solid var(--surface-border)' }}>
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.6rem' }}>
                <span style={{ width: 10, height: 10, borderRadius: 3, background: '#32D64B', marginTop: 8, flexShrink: 0 }} />
                <div>
                  <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.45rem' }}>
                    <span style={{ color: 'var(--text-primary)', fontWeight: 800, fontSize: '2rem', lineHeight: 1.1 }}>{rentedUnits}</span>
                    <span style={{ color: '#32D64B', fontWeight: 700, fontSize: '0.8rem' }}>{rentedPct}%</span>
                  </div>
                  <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', fontWeight: 700, textTransform: 'uppercase', marginTop: 4 }}>En Calle</div>
                </div>
              </div>
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.6rem' }}>
                <span style={{ width: 10, height: 10, borderRadius: 3, background: '#57AB90', marginTop: 8, flexShrink: 0 }} />
                <div>
                  <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.45rem' }}>
                    <span style={{ color: 'var(--text-primary)', fontWeight: 800, fontSize: '2rem', lineHeight: 1.1 }}>{availableUnits}</span>
                    <span style={{ color: '#57AB90', fontWeight: 700, fontSize: '0.8rem' }}>{availablePct}%</span>
                  </div>
                  <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', fontWeight: 700, textTransform: 'uppercase', marginTop: 4 }}>En Bodega</div>
                </div>
              </div>
              <div style={{ paddingTop: '1.5rem', borderTop: '1px solid var(--surface-border)' }}>
                <div style={{ color: 'var(--text-primary)', fontWeight: 800, fontSize: '2rem', lineHeight: 1.1 }}>{totalUnits}</div>
                <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', fontWeight: 700, textTransform: 'uppercase', marginTop: 4 }}>Total Unidades</div>
              </div>
            </div>
          </div>
        </div>

        {/* Top 5 Clientes (Equipos en Obra) */}
        <div className="glass-panel p-6">
          <h3 className="mb-4" style={{ fontSize: '1rem', fontWeight: 700, margin: 0, color: 'var(--text-primary)' }}>
            Top 5 Clientes (Equipos en Obra)
          </h3>
          <div style={{ height: 280 }}>
            {topClientsData.length > 0 ? (
              <EChart option={topClientsOption} />
            ) : (
              <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#94a3b8', fontSize: '0.9rem', fontStyle: 'italic' }}>
                No hay equipos en calle actualmente
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Vista de Datos Modal */}
      {dataViewOpen && (
        <div className="modal-backdrop" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 2000 }}>
          <div className="modal-content" style={{ width: '90%', maxWidth: '600px', padding: '2rem', borderRadius: '16px' }}>
            <h2 style={{ marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <FileText style={{ color: COLORS.blue }} /> Vista de Datos: Facturación Reciente
            </h2>
            <div style={{ maxHeight: '300px', overflowY: 'auto', marginBottom: '1.5rem', border: '1px solid var(--border-color)', borderRadius: '8px' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ background: 'var(--background-secondary)', borderBottom: '1px solid var(--border-color)' }}>
                    <th style={{ padding: '0.75rem', textAlign: 'left', fontSize: '0.8rem', color: 'var(--text-secondary)' }}>DÍA</th>
                    <th style={{ padding: '0.75rem', textAlign: 'right', fontSize: '0.8rem', color: 'var(--text-secondary)' }}>PAGADO</th>
                    <th style={{ padding: '0.75rem', textAlign: 'right', fontSize: '0.8rem', color: 'var(--text-secondary)' }}>PENDIENTE</th>
                    <th style={{ padding: '0.75rem', textAlign: 'right', fontSize: '0.8rem', color: 'var(--text-secondary)' }}>TOTAL</th>
                  </tr>
                </thead>
                <tbody>
                  {revenueByDay.map((d, i) => {
                    const paid = d['Pagado ($)'];
                    const pending = d['Pendiente ($)'];
                    return (
                      <tr key={i} style={{ borderBottom: '1px solid var(--border-color)' }}>
                        <td style={{ padding: '0.75rem', fontSize: '0.85rem', fontWeight: 600 }}>{d.name}</td>
                        <td style={{ padding: '0.75rem', textAlign: 'right', fontSize: '0.85rem', color: COLORS.green }}>${paid.toLocaleString('es-CO')}</td>
                        <td style={{ padding: '0.75rem', textAlign: 'right', fontSize: '0.85rem', color: COLORS.orange }}>${pending.toLocaleString('es-CO')}</td>
                        <td style={{ padding: '0.75rem', textAlign: 'right', fontSize: '0.85rem', fontWeight: 700 }}>${(paid + pending).toLocaleString('es-CO')}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <div className="flex justify-end">
              <button className="btn btn-secondary" onClick={() => setDataViewOpen(false)}>Cerrar</button>
            </div>
          </div>
        </div>
      )}

      {/* Vista de Datos Cartera Modal */}
      {carteraDataViewOpen && (
        <div className="modal-backdrop" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 2000 }}>
          <div className="modal-content" style={{ width: '90%', maxWidth: '600px', padding: '2rem', borderRadius: '16px' }}>
            <h2 style={{ marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <FileText style={{ color: COLORS.orange }} /> Vista de Datos: Cartera Pendiente
            </h2>
            <div style={{ maxHeight: '300px', overflowY: 'auto', marginBottom: '1.5rem', border: '1px solid var(--border-color)', borderRadius: '8px' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ background: 'var(--background-secondary)', borderBottom: '1px solid var(--border-color)' }}>
                    <th style={{ padding: '0.75rem', textAlign: 'left', fontSize: '0.8rem', color: 'var(--text-secondary)' }}>DÍA</th>
                    <th style={{ padding: '0.75rem', textAlign: 'right', fontSize: '0.8rem', color: 'var(--text-secondary)' }}>PENDIENTE</th>
                  </tr>
                </thead>
                <tbody>
                  {carteraByDay.map((d, i) => {
                    const pending = d['Pendiente ($)'];
                    return (
                      <tr key={i} style={{ borderBottom: '1px solid var(--border-color)' }}>
                        <td style={{ padding: '0.75rem', fontSize: '0.85rem', fontWeight: 600 }}>{d.name}</td>
                        <td style={{ padding: '0.75rem', textAlign: 'right', fontSize: '0.85rem', color: COLORS.orange, fontWeight: 700 }}>${pending.toLocaleString('es-CO')}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <div className="flex justify-end">
              <button className="btn btn-secondary" onClick={() => setCarteraDataViewOpen(false)}>Cerrar</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
