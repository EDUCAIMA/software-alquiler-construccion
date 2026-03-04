import React, { useState, useMemo } from 'react';
import {
    DollarSign, TrendingUp, TrendingDown, Users, Plus, X,
    CheckCircle, Clock, Download, FileText, BarChart2,
    CreditCard, ShoppingBag, Truck, Home, Wrench, Zap,
    ChevronDown
} from 'lucide-react';
import { useAppContext } from '../context/AppContext';
import { format, parseISO, isWithinInterval, startOfMonth, endOfMonth, startOfYear, endOfYear, subMonths } from 'date-fns';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

// ─── Helpers ──────────────────────────────────────────────────────────────────
const fmtCOP = n => `$${Math.round(n || 0).toLocaleString('es-CO')}`;

const CAT_CFG = {
    'Arriendo': { color: '#8b5cf6', icon: Home },
    'Transporte': { color: '#f97316', icon: Truck },
    'Mantenimiento': { color: '#3b82f6', icon: Wrench },
    'Servicio': { color: '#06b6d4', icon: Zap },
    'Insumo': { color: '#10b981', icon: ShoppingBag },
    'Nómina': { color: '#ec4899', icon: Users },
    'Otro': { color: '#94a3b8', icon: DollarSign },
};

const IS = { width: '100%', padding: '0.6rem 0.75rem', boxSizing: 'border-box', background: 'rgba(255,255,255,0.06)', border: '1px solid var(--surface-border)', borderRadius: 8, color: 'var(--text-primary)', fontSize: '0.875rem', outline: 'none' };
const SS = { ...IS, background: 'rgba(20,20,28,0.8)' };

const calcLiquidacion = (liq, emp) => {
    if (!emp) return 0;
    const salario = emp.salarioDia * liq.diasTrabajados;
    const horas = (liq.horasExtra || 0) * (liq.valorHoraExtra || 0);
    const bono = Number(liq.bonificaciones || 0);
    const bruto = salario + horas + bono;
    const salud = Math.round(bruto * (liq.deduccionSalud || 0) / 100);
    const pension = Math.round(bruto * (liq.deduccionPension || 0) / 100);
    const fondo = Math.round(bruto * (liq.fondoSolidaridad || 0) / 100);
    return bruto - salud - pension - fondo;
};

// ─── PDF liquidación ──────────────────────────────────────────────────────────
function generateLiquidacionPDF(liq, emp) {
    const doc = new jsPDF();
    const W = doc.internal.pageSize.getWidth();
    doc.setFillColor(30, 41, 59); doc.rect(0, 0, W, 36, 'F');
    doc.setFont('helvetica', 'bold'); doc.setFontSize(16); doc.setTextColor(255, 255, 255);
    doc.text('COMPROBANTE DE NÓMINA', W / 2, 18, { align: 'center' });
    doc.setFontSize(9); doc.setFont('helvetica', 'normal');
    doc.text(`CIELO — Alquiler de Equipos  |  ${liq.id}`, W / 2, 28, { align: 'center' });

    const salario = emp.salarioDia * liq.diasTrabajados;
    const horas = (liq.horasExtra || 0) * (liq.valorHoraExtra || 0);
    const bono = Number(liq.bonificaciones || 0);
    const bruto = salario + horas + bono;
    const salud = Math.round(bruto * (liq.deduccionSalud || 0) / 100);
    const pension = Math.round(bruto * (liq.deduccionPension || 0) / 100);
    const fondo = Math.round(bruto * (liq.fondoSolidaridad || 0) / 100);
    const neto = bruto - salud - pension - fondo;

    doc.setTextColor(30, 41, 59); doc.setFontSize(10); doc.setFont('helvetica', 'normal');
    const info = [['Empleado', emp.nombre], ['Cargo', emp.cargo], ['Período', liq.periodo], ['Días trabajados', liq.diasTrabajados], ['Horas extra', liq.horasExtra || 0]];
    info.forEach(([k, v], i) => {
        doc.setFont('helvetica', 'bold'); doc.text(`${k}:`, 14, 50 + i * 8);
        doc.setFont('helvetica', 'normal'); doc.text(String(v), 70, 50 + i * 8);
    });

    autoTable(doc, {
        startY: 98,
        head: [['Concepto', 'Valor']],
        body: [
            ['Salario devengado', fmtCOP(salario)],
            ['Horas extra', fmtCOP(horas)],
            ['Bonificaciones', fmtCOP(bono)],
            ['= Salario Bruto', fmtCOP(bruto)],
            [`— Salud (${liq.deduccionSalud || 0}%)`, `– ${fmtCOP(salud)}`],
            [`— Pensión (${liq.deduccionPension || 0}%)`, `– ${fmtCOP(pension)}`],
            [`— Fondo Solidaridad (${liq.fondoSolidaridad || 0}%)`, `– ${fmtCOP(fondo)}`],
            ['= SALARIO NETO A PAGAR', fmtCOP(neto)],
        ],
        headStyles: { fillColor: [30, 41, 59] },
        styles: { fontSize: 10 },
        bodyStyles: (row) => row.rowIndex === 7 ? { fontStyle: 'bold' } : {},
    });
    doc.save(`Nomina_${liq.id}.pdf`);
}

// ─── CSV export ───────────────────────────────────────────────────────────────
function exportGastosCSV(gastos) {
    const header = 'ID,Fecha,Concepto,Proveedor,Categoría,Monto,IVA,Total,Estado\n';
    const rows = gastos.map(g =>
        `${g.id},${g.fecha},"${g.concepto}","${g.proveedor}",${g.categoria},${g.monto},${g.iva},${g.monto + g.iva},${g.estado}`
    ).join('\n');
    const blob = new Blob([header + rows], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = 'gastos_cielo.csv'; a.click();
}

function exportPLCSV(rows) {
    const header = 'Mes,Ingresos,Egresos,Utilidad\n';
    const body = rows.map(r => `${r.mes},${r.ingresos},${r.egresos},${r.utilidad}`).join('\n');
    const blob = new Blob([header + body], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = 'resultado_cielo.csv'; a.click();
}

// ─── Tab 1: Gastos ────────────────────────────────────────────────────────────
function GastosTab() {
    const { gastos, addGasto, pagarGasto } = useAppContext();
    const [showModal, setShowModal] = useState(false);
    const [form, setForm] = useState({ fecha: format(new Date(), 'yyyy-MM-dd'), concepto: '', proveedor: '', categoria: 'Otro', monto: '', iva: '', estado: 'Pendiente', notas: '' });

    const totalMes = gastos.filter(g => g.fecha?.startsWith(format(new Date(), 'yyyy-MM'))).reduce((s, g) => s + g.monto + g.iva, 0);
    const pendiente = gastos.filter(g => g.estado === 'Pendiente').length;
    const topCat = Object.entries(gastos.reduce((acc, g) => { acc[g.categoria] = (acc[g.categoria] || 0) + g.monto; return acc; }, {})).sort((a, b) => b[1] - a[1])[0];

    const handleAdd = () => {
        if (!form.concepto || !form.monto) return;
        addGasto(form);
        setShowModal(false);
        setForm({ fecha: format(new Date(), 'yyyy-MM-dd'), concepto: '', proveedor: '', categoria: 'Otro', monto: '', iva: '', estado: 'Pendiente', notas: '' });
    };

    return (
        <>
            {/* KPIs */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: '1rem', marginBottom: '1.5rem' }}>
                {[
                    ['Gasto Mes Actual', fmtCOP(totalMes), 'red', TrendingDown],
                    ['Total Registros', gastos.length, 'blue', FileText],
                    ['Pendientes de Pago', pendiente, 'orange', Clock],
                    ['Mayor Categoría', topCat ? `${topCat[0]}: ${fmtCOP(topCat[1])}` : '—', 'purple', BarChart2],
                ].map(([l, v, c, Ic]) => (
                    <div key={l} className={`stat-card ${c}`}>
                        <div className={`icon-wrapper ${c}`}><Ic size={20} /></div>
                        <div><div className="stat-value" style={{ fontSize: c === 'purple' ? '0.9rem' : undefined }}>{v}</div><div className="stat-label">{l}</div></div>
                    </div>
                ))}
            </div>

            {/* Toolbar */}
            <div className="glass-panel p-4 mb-4" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '0.75rem' }}>
                <span style={{ fontWeight: 700 }}>Registro de Gastos y Compras</span>
                <div style={{ display: 'flex', gap: '0.6rem' }}>
                    <button onClick={() => exportGastosCSV(gastos)} className="btn btn-secondary" style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: '0.82rem' }}><Download size={14} /> CSV para Contadora</button>
                    <button onClick={() => setShowModal(true)} className="btn btn-primary" style={{ display: 'flex', alignItems: 'center', gap: 5 }}><Plus size={16} /> Nuevo Gasto</button>
                </div>
            </div>

            {/* Table */}
            <div className="glass-panel p-6">
                <div style={{ overflowX: 'auto' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                        <thead>
                            <tr style={{ borderBottom: '2px solid var(--surface-border)' }}>
                                {['ID', 'Fecha', 'Concepto', 'Proveedor', 'Categoría', 'Monto', 'IVA', 'Total', 'Estado', ''].map(h => (
                                    <th key={h} style={{ padding: '0.65rem 0.8rem', textAlign: 'left', fontSize: '0.67rem', color: 'var(--text-muted)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', whiteSpace: 'nowrap' }}>{h}</th>
                                ))}
                            </tr>
                        </thead>
                        <tbody>
                            {[...gastos].sort((a, b) => b.fecha.localeCompare(a.fecha)).map(g => {
                                const cfg = CAT_CFG[g.categoria] || CAT_CFG['Otro'];
                                const CatIcon = cfg.icon;
                                return (
                                    <tr key={g.id} style={{ borderBottom: '1px solid var(--surface-border)' }}>
                                        <td style={{ padding: '0.75rem 0.8rem', fontFamily: 'monospace', color: '#3b82f6', fontSize: '0.8rem', fontWeight: 700 }}>{g.id}</td>
                                        <td style={{ padding: '0.75rem 0.8rem', color: 'var(--text-muted)', fontSize: '0.82rem' }}>{g.fecha}</td>
                                        <td style={{ padding: '0.75rem 0.8rem', fontWeight: 600 }}>{g.concepto}</td>
                                        <td style={{ padding: '0.75rem 0.8rem', color: 'var(--text-muted)', fontSize: '0.82rem' }}>{g.proveedor}</td>
                                        <td style={{ padding: '0.75rem 0.8rem' }}>
                                            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '2px 10px', borderRadius: 999, background: `${cfg.color}18`, color: cfg.color, fontSize: '0.72rem', fontWeight: 700, border: `1px solid ${cfg.color}30` }}>
                                                <CatIcon size={11} />{g.categoria}
                                            </span>
                                        </td>
                                        <td style={{ padding: '0.75rem 0.8rem', fontWeight: 600 }}>{fmtCOP(g.monto)}</td>
                                        <td style={{ padding: '0.75rem 0.8rem', color: 'var(--text-muted)', fontSize: '0.82rem' }}>{fmtCOP(g.iva)}</td>
                                        <td style={{ padding: '0.75rem 0.8rem', fontWeight: 700, color: '#10b981' }}>{fmtCOP(g.monto + g.iva)}</td>
                                        <td style={{ padding: '0.75rem 0.8rem' }}>
                                            <span style={{ padding: '2px 9px', borderRadius: 999, fontSize: '0.7rem', fontWeight: 700, background: g.estado === 'Pagado' ? 'rgba(16,185,129,0.12)' : 'rgba(249,115,22,0.12)', color: g.estado === 'Pagado' ? '#10b981' : '#f97316', border: `1px solid ${g.estado === 'Pagado' ? 'rgba(16,185,129,0.3)' : 'rgba(249,115,22,0.3)'}` }}>
                                                {g.estado}
                                            </span>
                                        </td>
                                        <td style={{ padding: '0.75rem 0.8rem' }}>
                                            {g.estado === 'Pendiente' && (
                                                <button onClick={() => pagarGasto(g.id)} style={{ padding: '0.3rem 0.7rem', borderRadius: 6, background: 'rgba(16,185,129,0.1)', color: '#10b981', border: '1px solid rgba(16,185,129,0.3)', cursor: 'pointer', fontSize: '0.72rem', fontWeight: 700 }}>Pagar</button>
                                            )}
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Add Modal */}
            {showModal && (
                <div style={{ position: 'fixed', inset: 0, background: 'rgba(15, 23, 42, 0.6)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '1rem' }}>
                    <div style={{ background: '#ffffff', borderRadius: '16px', boxShadow: '0 20px 40px rgba(0,0,0,0.15)', width: '100%', maxWidth: 520, display: 'flex', flexDirection: 'column' }}>
                        <div style={{ padding: '1.25rem 1.5rem', borderBottom: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <h3 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '0.6rem', color: '#1e293b', fontSize: '1.1rem' }}>
                                <div style={{ background: '#eff6ff', padding: '0.4rem', borderRadius: '8px', display: 'flex' }}><Plus size={18} style={{ color: '#3b82f6' }} /></div>
                                Registrar Gasto
                            </h3>
                            <button onClick={() => setShowModal(false)} style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '50%', width: 30, height: 30, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: '#64748b' }}><X size={16} /></button>
                        </div>
                        <div style={{ padding: '1.5rem', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                            {[['Concepto *', 'concepto', 'text', 'Ej. Arriendo bodega'], ['Proveedor', 'proveedor', 'text', 'Nombre proveedor'], ['Fecha', 'fecha', 'date', ''], ['Monto ($)', 'monto', 'number', '0'], ['IVA ($)', 'iva', 'number', '0']].map(([label, key, type, ph]) => (
                                <div key={key} style={{ margin: 0 }}>
                                    <label style={{ fontSize: '0.8rem', color: '#475569', fontWeight: 600, display: 'block', marginBottom: '0.4rem' }}>{label}</label>
                                    <input type={type} style={{ width: '100%', padding: '0.6rem 0.75rem', boxSizing: 'border-box', background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: 8, color: '#1e293b', fontSize: '0.85rem', outline: 'none', transition: 'border-color 0.2s' }} value={form[key]} onChange={e => setForm(p => ({ ...p, [key]: e.target.value }))} placeholder={ph} />
                                </div>
                            ))}
                            <div style={{ margin: 0 }}>
                                <label style={{ fontSize: '0.8rem', color: '#475569', fontWeight: 600, display: 'block', marginBottom: '0.4rem' }}>Categoría</label>
                                <select style={{ width: '100%', padding: '0.6rem 0.75rem', boxSizing: 'border-box', background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: 8, color: '#1e293b', fontSize: '0.85rem', outline: 'none', cursor: 'pointer' }} value={form.categoria} onChange={e => setForm(p => ({ ...p, categoria: e.target.value }))}>
                                    {Object.keys(CAT_CFG).map(k => <option key={k}>{k}</option>)}
                                </select>
                            </div>
                            <div style={{ margin: 0 }}>
                                <label style={{ fontSize: '0.8rem', color: '#475569', fontWeight: 600, display: 'block', marginBottom: '0.4rem' }}>Estado</label>
                                <select style={{ width: '100%', padding: '0.6rem 0.75rem', boxSizing: 'border-box', background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: 8, color: '#1e293b', fontSize: '0.85rem', outline: 'none', cursor: 'pointer' }} value={form.estado} onChange={e => setForm(p => ({ ...p, estado: e.target.value }))}>
                                    <option>Pendiente</option><option>Pagado</option>
                                </select>
                            </div>
                            <div style={{ margin: 0, gridColumn: '1/-1' }}>
                                <label style={{ fontSize: '0.8rem', color: '#475569', fontWeight: 600, display: 'block', marginBottom: '0.4rem' }}>Notas</label>
                                <textarea style={{ width: '100%', padding: '0.6rem 0.75rem', boxSizing: 'border-box', background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: 8, color: '#1e293b', fontSize: '0.85rem', outline: 'none', resize: 'vertical' }} value={form.notas} onChange={e => setForm(p => ({ ...p, notas: e.target.value }))} rows={2} />
                            </div>
                        </div>
                        <div style={{ padding: '1rem 1.5rem', background: '#f8fafc', borderTop: '1px solid #e2e8f0', borderRadius: '0 0 16px 16px', display: 'flex', justifyContent: 'flex-end', gap: '0.75rem' }}>
                            <button className="btn btn-secondary" onClick={() => setShowModal(false)} style={{ background: '#ffffff', border: '1px solid #cbd5e1', color: '#475569' }}>Cancelar</button>
                            <button className="btn btn-primary" onClick={handleAdd}>Registrar</button>
                        </div>
                    </div>
                </div>
            )}
        </>
    );
}

// ─── Tab 2: Nómina ────────────────────────────────────────────────────────────
function NominaTab() {
    const { empleados, liquidaciones, addEmpleado, addLiquidacion, pagarLiquidacion } = useAppContext();
    const [showEmpModal, setShowEmpModal] = useState(false);
    const [showLiqModal, setShowLiqModal] = useState(false);
    const [empForm, setEmpForm] = useState({ nombre: '', cargo: '', salarioDia: '', tipo: 'Fijo' });
    const [liqForm, setLiqForm] = useState({ empleadoId: '', periodo: '', diasTrabajados: 26, horasExtra: 0, valorHoraExtra: 0, deduccionSalud: 4, deduccionPension: 4, fondoSolidaridad: 0, bonificaciones: 0 });

    const totalNominaMes = liquidaciones.reduce((s, l) => {
        const emp = empleados.find(e => e.id === l.empleadoId);
        return s + calcLiquidacion(l, emp);
    }, 0);

    const preview = useMemo(() => {
        const emp = empleados.find(e => e.id === liqForm.empleadoId);
        if (!emp) return null;
        const salario = emp.salarioDia * liqForm.diasTrabajados;
        const horas = liqForm.horasExtra * liqForm.valorHoraExtra;
        const bono = Number(liqForm.bonificaciones || 0);
        const bruto = salario + horas + bono;
        const salud = Math.round(bruto * liqForm.deduccionSalud / 100);
        const pension = Math.round(bruto * liqForm.deduccionPension / 100);
        const fondo = Math.round(bruto * liqForm.fondoSolidaridad / 100);
        return { bruto, salud, pension, fondo, neto: bruto - salud - pension - fondo };
    }, [liqForm, empleados]);

    return (
        <>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: '1rem', marginBottom: '1.5rem' }}>
                {[
                    ['Total Nómina Hist.', fmtCOP(totalNominaMes), 'red', DollarSign],
                    ['Empleados Activos', empleados.filter(e => e.activo).length, 'blue', Users],
                    ['Liquidaciones Pendientes', liquidaciones.filter(l => l.estado === 'Pendiente').length, 'orange', Clock],
                ].map(([l, v, c, Ic]) => (
                    <div key={l} className={`stat-card ${c}`}>
                        <div className={`icon-wrapper ${c}`}><Ic size={20} /></div>
                        <div><div className="stat-value">{v}</div><div className="stat-label">{l}</div></div>
                    </div>
                ))}
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.6fr', gap: '1.5rem' }}>
                {/* Empleados */}
                <div className="glass-panel p-6">
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                        <h3 style={{ fontSize: '0.95rem', margin: 0 }}>Empleados</h3>
                        <button onClick={() => setShowEmpModal(true)} className="btn btn-primary btn-sm" style={{ display: 'flex', alignItems: 'center', gap: 4 }}><Plus size={14} />Nuevo</button>
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                        {empleados.map(emp => (
                            <div key={emp.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.7rem 0.85rem', background: 'rgba(255,255,255,0.04)', borderRadius: 10, border: '1px solid var(--surface-border)' }}>
                                <div>
                                    <div style={{ fontWeight: 700, fontSize: '0.875rem' }}>{emp.nombre}</div>
                                    <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: 2 }}>{emp.cargo} · {emp.tipo}</div>
                                </div>
                                <div style={{ textAlign: 'right' }}>
                                    <div style={{ fontWeight: 700, color: '#10b981', fontSize: '0.875rem' }}>{fmtCOP(emp.salarioDia)}<span style={{ fontSize: '0.65rem', color: 'var(--text-muted)', fontWeight: 400 }}>/día</span></div>
                                    <span style={{ fontSize: '0.65rem', padding: '1px 7px', borderRadius: 999, background: 'rgba(16,185,129,0.1)', color: '#10b981', fontWeight: 700 }}>{emp.activo ? 'Activo' : 'Inactivo'}</span>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>

                {/* Liquidaciones */}
                <div className="glass-panel p-6">
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                        <h3 style={{ fontSize: '0.95rem', margin: 0 }}>Liquidaciones de Nómina</h3>
                        <button onClick={() => setShowLiqModal(true)} className="btn btn-primary btn-sm" style={{ display: 'flex', alignItems: 'center', gap: 4 }}><Plus size={14} />Nueva</button>
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                        {liquidaciones.map(liq => {
                            const emp = empleados.find(e => e.id === liq.empleadoId);
                            const neto = calcLiquidacion(liq, emp);
                            return (
                                <div key={liq.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.7rem 0.85rem', background: 'rgba(255,255,255,0.04)', borderRadius: 10, border: '1px solid var(--surface-border)' }}>
                                    <div>
                                        <div style={{ fontWeight: 700, fontSize: '0.85rem', fontFamily: 'monospace', color: '#3b82f6' }}>{liq.id}</div>
                                        <div style={{ fontWeight: 600, fontSize: '0.875rem' }}>{emp?.nombre}</div>
                                        <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>{liq.periodo} · {liq.diasTrabajados}d</div>
                                    </div>
                                    <div style={{ textAlign: 'right', display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '0.35rem' }}>
                                        <div style={{ fontWeight: 800, color: '#10b981' }}>{fmtCOP(neto)}</div>
                                        <span style={{ fontSize: '0.65rem', padding: '1px 7px', borderRadius: 999, background: liq.estado === 'Pagado' ? 'rgba(16,185,129,0.12)' : 'rgba(249,115,22,0.12)', color: liq.estado === 'Pagado' ? '#10b981' : '#f97316', fontWeight: 700 }}>{liq.estado}</span>
                                        <div style={{ display: 'flex', gap: '0.4rem' }}>
                                            {liq.estado === 'Pendiente' && <button onClick={() => pagarLiquidacion(liq.id)} style={{ padding: '0.2rem 0.6rem', borderRadius: 6, background: 'rgba(16,185,129,0.12)', color: '#10b981', border: '1px solid rgba(16,185,129,0.3)', cursor: 'pointer', fontSize: '0.7rem', fontWeight: 700 }}>Pagar</button>}
                                            <button onClick={() => emp && generateLiquidacionPDF(liq, emp)} style={{ padding: '0.2rem 0.6rem', borderRadius: 6, background: 'rgba(59,130,246,0.1)', color: '#3b82f6', border: '1px solid rgba(59,130,246,0.25)', cursor: 'pointer', fontSize: '0.7rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: 3 }}><Download size={10} />PDF</button>
                                        </div>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>
            </div>

            {/* New Empleado Modal */}
            {showEmpModal && (
                <div style={{ position: 'fixed', inset: 0, background: 'rgba(15, 23, 42, 0.6)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '1rem' }}>
                    <div style={{ background: '#ffffff', borderRadius: '16px', boxShadow: '0 20px 40px rgba(0,0,0,0.15)', width: '100%', maxWidth: 440, display: 'flex', flexDirection: 'column' }}>
                        <div style={{ padding: '1.25rem 1.5rem', borderBottom: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <h3 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '0.6rem', color: '#1e293b', fontSize: '1.1rem' }}>
                                <div style={{ background: '#eff6ff', padding: '0.4rem', borderRadius: '8px', display: 'flex' }}><Users size={18} style={{ color: '#3b82f6' }} /></div>
                                Nuevo Empleado
                            </h3>
                            <button onClick={() => setShowEmpModal(false)} style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '50%', width: 30, height: 30, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: '#64748b' }}><X size={16} /></button>
                        </div>
                        <div style={{ padding: '1.5rem', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                            <div style={{ margin: 0, gridColumn: '1/-1' }}>
                                <label style={{ fontSize: '0.8rem', color: '#475569', fontWeight: 600, display: 'block', marginBottom: '0.4rem' }}>Nombre Completo</label>
                                <input type="text" style={{ width: '100%', padding: '0.6rem 0.75rem', boxSizing: 'border-box', background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: 8, color: '#1e293b', fontSize: '0.85rem', outline: 'none' }} value={empForm.nombre} onChange={e => setEmpForm(p => ({ ...p, nombre: e.target.value }))} />
                            </div>
                            <div style={{ margin: 0 }}>
                                <label style={{ fontSize: '0.8rem', color: '#475569', fontWeight: 600, display: 'block', marginBottom: '0.4rem' }}>Cargo</label>
                                <input type="text" style={{ width: '100%', padding: '0.6rem 0.75rem', boxSizing: 'border-box', background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: 8, color: '#1e293b', fontSize: '0.85rem', outline: 'none' }} value={empForm.cargo} onChange={e => setEmpForm(p => ({ ...p, cargo: e.target.value }))} />
                            </div>
                            <div style={{ margin: 0 }}>
                                <label style={{ fontSize: '0.8rem', color: '#475569', fontWeight: 600, display: 'block', marginBottom: '0.4rem' }}>Tipo</label>
                                <select style={{ width: '100%', padding: '0.6rem 0.75rem', boxSizing: 'border-box', background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: 8, color: '#1e293b', fontSize: '0.85rem', outline: 'none', cursor: 'pointer' }} value={empForm.tipo} onChange={e => setEmpForm(p => ({ ...p, tipo: e.target.value }))}><option>Fijo</option><option>Temporal</option></select>
                            </div>
                            <div style={{ margin: 0, gridColumn: '1/-1' }}>
                                <label style={{ fontSize: '0.8rem', color: '#475569', fontWeight: 600, display: 'block', marginBottom: '0.4rem' }}>Salario por Día ($)</label>
                                <input type="number" style={{ width: '100%', padding: '0.6rem 0.75rem', boxSizing: 'border-box', background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: 8, color: '#1e293b', fontSize: '0.85rem', outline: 'none' }} value={empForm.salarioDia} onChange={e => setEmpForm(p => ({ ...p, salarioDia: e.target.value }))} placeholder="Ej. 66667" />
                            </div>
                        </div>
                        <div style={{ padding: '1rem 1.5rem', background: '#f8fafc', borderTop: '1px solid #e2e8f0', borderRadius: '0 0 16px 16px', display: 'flex', justifyContent: 'flex-end', gap: '0.75rem' }}>
                            <button className="btn btn-secondary" onClick={() => setShowEmpModal(false)} style={{ background: '#ffffff', border: '1px solid #cbd5e1', color: '#475569' }}>Cancelar</button>
                            <button className="btn btn-primary" onClick={() => { if (empForm.nombre) { addEmpleado(empForm); setShowEmpModal(false); setEmpForm({ nombre: '', cargo: '', salarioDia: '', tipo: 'Fijo' }); } }}>Guardar</button>
                        </div>
                    </div>
                </div>
            )}

            {/* New Liquidación Modal */}
            {showLiqModal && (
                <div style={{ position: 'fixed', inset: 0, background: 'rgba(15, 23, 42, 0.6)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '1rem' }}>
                    <div style={{ background: '#ffffff', borderRadius: '16px', boxShadow: '0 20px 40px rgba(0,0,0,0.15)', width: '100%', maxWidth: 540, display: 'flex', flexDirection: 'column' }}>
                        <div style={{ padding: '1.25rem 1.5rem', borderBottom: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <h3 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '0.6rem', color: '#1e293b', fontSize: '1.1rem' }}>
                                <div style={{ background: '#eff6ff', padding: '0.4rem', borderRadius: '8px', display: 'flex' }}><FileText size={18} style={{ color: '#3b82f6' }} /></div>
                                Nueva Liquidación de Nómina
                            </h3>
                            <button onClick={() => setShowLiqModal(false)} style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '50%', width: 30, height: 30, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: '#64748b' }}><X size={16} /></button>
                        </div>
                        <div style={{ padding: '1.5rem', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                            <div style={{ margin: 0 }}>
                                <label style={{ fontSize: '0.8rem', color: '#475569', fontWeight: 600, display: 'block', marginBottom: '0.4rem' }}>Empleado</label>
                                <select style={{ width: '100%', padding: '0.6rem 0.75rem', boxSizing: 'border-box', background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: 8, color: '#1e293b', fontSize: '0.85rem', outline: 'none', cursor: 'pointer' }} value={liqForm.empleadoId} onChange={e => setLiqForm(p => ({ ...p, empleadoId: e.target.value }))}>
                                    <option value="">— Seleccionar —</option>
                                    {empleados.map(e => <option key={e.id} value={e.id}>{e.nombre}</option>)}
                                </select>
                            </div>
                            <div style={{ margin: 0 }}>
                                <label style={{ fontSize: '0.8rem', color: '#475569', fontWeight: 600, display: 'block', marginBottom: '0.4rem' }}>Período (ej. 2024-01-01 / 2024-01-31)</label>
                                <input type="text" style={{ width: '100%', padding: '0.6rem 0.75rem', boxSizing: 'border-box', background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: 8, color: '#1e293b', fontSize: '0.85rem', outline: 'none' }} value={liqForm.periodo} onChange={e => setLiqForm(p => ({ ...p, periodo: e.target.value }))} placeholder="YYYY-MM-DD / YYYY-MM-DD" />
                            </div>
                            {[['Días Trabajados', 'diasTrabajados'], ['Horas Extra', 'horasExtra'], ['Valor Hora Extra ($)', 'valorHoraExtra'], ['Bonificaciones ($)', 'bonificaciones'], ['Deduc. Salud (%)', 'deduccionSalud'], ['Deduc. Pensión (%)', 'deduccionPension'], ['Fondo Solidaridad (%)', 'fondoSolidaridad']].map(([label, key]) => (
                                <div key={key} style={{ margin: 0 }}>
                                    <label style={{ fontSize: '0.8rem', color: '#475569', fontWeight: 600, display: 'block', marginBottom: '0.4rem' }}>{label}</label>
                                    <input type="number" style={{ width: '100%', padding: '0.6rem 0.75rem', boxSizing: 'border-box', background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: 8, color: '#1e293b', fontSize: '0.85rem', outline: 'none' }} min={0} value={liqForm[key]} onChange={e => setLiqForm(p => ({ ...p, [key]: Number(e.target.value) }))} />
                                </div>
                            ))}
                        </div>
                        {preview && (
                            <div style={{ margin: '0 1.5rem 1.5rem 1.5rem', background: '#ecfdf5', border: '1px solid #a7f3d0', borderRadius: 12, padding: '1rem 1.25rem' }}>
                                <div style={{ fontSize: '0.75rem', fontWeight: 700, color: '#059669', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '0.75rem' }}>Vista Previa</div>
                                {[['Salario Bruto', preview.bruto], ['— Salud', -preview.salud], ['— Pensión', -preview.pension], ['— Fondo Solidaridad', -preview.fondo]].map(([k, v]) => (
                                    <div key={k} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem', marginBottom: 6 }}>
                                        <span style={{ color: '#475569', fontWeight: 500 }}>{k}</span>
                                        <span style={{ fontWeight: 600, color: v < 0 ? '#ef4444' : '#1e293b' }}>{v < 0 ? `-${fmtCOP(-v)}` : fmtCOP(v)}</span>
                                    </div>
                                ))}
                                <div style={{ borderTop: '1px solid #a7f3d0', marginTop: 10, paddingTop: 10, display: 'flex', justifyContent: 'space-between', fontWeight: 800, fontSize: '1rem' }}>
                                    <span style={{ color: '#064e3b' }}>= NETO A PAGAR</span><span style={{ color: '#10b981' }}>{fmtCOP(preview.neto)}</span>
                                </div>
                            </div>
                        )}
                        <div style={{ padding: '1rem 1.5rem', background: '#f8fafc', borderTop: '1px solid #e2e8f0', borderRadius: '0 0 16px 16px', display: 'flex', justifyContent: 'flex-end', gap: '0.75rem' }}>
                            <button className="btn btn-secondary" onClick={() => setShowLiqModal(false)} style={{ background: '#ffffff', border: '1px solid #cbd5e1', color: '#475569' }}>Cancelar</button>
                            <button className="btn btn-primary" disabled={!liqForm.empleadoId || !liqForm.periodo} onClick={() => { addLiquidacion(liqForm); setShowLiqModal(false); }}>Guardar</button>
                        </div>
                    </div>
                </div>
            )}
        </>
    );
}

// ─── Tab 3: Estado de Resultados ──────────────────────────────────────────────
function PLTab() {
    const { invoices, gastos, liquidaciones, empleados } = useAppContext();
    const [periodo, setPeriodo] = useState('mes');

    // Last 6 months monthly data for chart
    const chartData = useMemo(() => {
        return Array.from({ length: 6 }, (_, i) => {
            const d = subMonths(new Date(), 5 - i);
            const key = format(d, 'yyyy-MM');
            const label = format(d, 'MMM yy');
            const ingresos = invoices.filter(inv => (inv.date || inv.fecha || '').startsWith(key)).reduce((s, inv) => s + (inv.amount || inv.total || 0), 0);
            const egresosG = gastos.filter(g => (g.fecha || '').startsWith(key)).reduce((s, g) => s + g.monto + g.iva, 0);
            const egresosN = liquidaciones.filter(l => l.periodo?.startsWith(key.slice(0, 7))).reduce((s, l) => { const emp = empleados.find(e => e.id === l.empleadoId); return s + calcLiquidacion(l, emp); }, 0);
            const egresos = egresosG + egresosN;
            return { mes: label, ingresos, egresos, utilidad: ingresos - egresos };
        });
    }, [invoices, gastos, liquidaciones, empleados]);

    const totIngresos = chartData.reduce((s, r) => s + r.ingresos, 0);
    const totEgresos = chartData.reduce((s, r) => s + r.egresos, 0);
    const utilidad = totIngresos - totEgresos;
    const margen = totIngresos > 0 ? ((utilidad / totIngresos) * 100).toFixed(1) : 0;

    const exportPLPDF = () => {
        const doc = new jsPDF();
        const W = doc.internal.pageSize.getWidth();
        doc.setFillColor(30, 41, 59); doc.rect(0, 0, W, 36, 'F');
        doc.setFont('helvetica', 'bold'); doc.setFontSize(16); doc.setTextColor(255, 255, 255);
        doc.text('ESTADO DE RESULTADOS', W / 2, 20, { align: 'center' });
        doc.setFontSize(9); doc.setFont('helvetica', 'normal');
        doc.text(`CIELO — Últimos 6 meses | Generado: ${format(new Date(), 'dd/MM/yyyy')}`, W / 2, 30, { align: 'center' });
        autoTable(doc, {
            startY: 44,
            head: [['Período', 'Ingresos', 'Egresos', 'Utilidad']],
            body: [
                ...chartData.map(r => [r.mes, fmtCOP(r.ingresos), fmtCOP(r.egresos), fmtCOP(r.utilidad)]),
                ['TOTAL', fmtCOP(totIngresos), fmtCOP(totEgresos), fmtCOP(utilidad)],
            ],
            headStyles: { fillColor: [30, 41, 59] },
            footStyles: { fontStyle: 'bold' },
        });
        doc.save('EstadoResultados_CIELO.pdf');
    };

    return (
        <>
            {/* KPIs */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: '1rem', marginBottom: '1.5rem' }}>
                {[
                    ['Ingresos (6m)', fmtCOP(totIngresos), 'green', TrendingUp],
                    ['Egresos (6m)', fmtCOP(totEgresos), 'red', TrendingDown],
                    ['Utilidad Neta', fmtCOP(utilidad), utilidad >= 0 ? 'green' : 'red', DollarSign],
                    ['Margen', `${margen}%`, utilidad >= 0 ? 'blue' : 'orange', BarChart2],
                ].map(([l, v, c, Ic]) => (
                    <div key={l} className={`stat-card ${c}`}>
                        <div className={`icon-wrapper ${c}`}><Ic size={20} /></div>
                        <div><div className="stat-value" style={{ fontSize: '1rem' }}>{v}</div><div className="stat-label">{l}</div></div>
                    </div>
                ))}
            </div>

            {/* Toolbar */}
            <div className="glass-panel p-4 mb-4" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontWeight: 700 }}>Últimos 6 meses — Ingresos vs. Egresos</span>
                <div style={{ display: 'flex', gap: '0.6rem' }}>
                    <button onClick={() => exportPLCSV(chartData)} className="btn btn-secondary" style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: '0.82rem' }}><Download size={14} />CSV</button>
                    <button onClick={exportPLPDF} className="btn btn-primary" style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: '0.82rem' }}><FileText size={14} />PDF</button>
                </div>
            </div>

            {/* Chart */}
            <div className="glass-panel p-6 mb-4">
                <ResponsiveContainer width="100%" height={280}>
                    <BarChart data={chartData} margin={{ top: 10, right: 20, left: 20, bottom: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
                        <XAxis dataKey="mes" tick={{ fill: '#94a3b8', fontSize: 12 }} axisLine={false} tickLine={false} />
                        <YAxis tickFormatter={v => `$${(v / 1000000).toFixed(1)}M`} tick={{ fill: '#94a3b8', fontSize: 11 }} axisLine={false} tickLine={false} />
                        <Tooltip formatter={(v) => fmtCOP(v)} contentStyle={{ background: '#1e293b', border: '1px solid #334155', borderRadius: 10, color: 'white', fontSize: '0.82rem' }} />
                        <Legend wrapperStyle={{ fontSize: '0.82rem', color: '#94a3b8' }} />
                        <Bar dataKey="ingresos" name="Ingresos" fill="#10b981" radius={[4, 4, 0, 0]} />
                        <Bar dataKey="egresos" name="Egresos" fill="#ef4444" radius={[4, 4, 0, 0]} />
                        <Bar dataKey="utilidad" name="Utilidad" fill="#3b82f6" radius={[4, 4, 0, 0]} />
                    </BarChart>
                </ResponsiveContainer>
            </div>

            {/* Detail table */}
            <div className="glass-panel p-6">
                <h3 style={{ marginBottom: '1rem', fontSize: '0.9rem' }}>Desglose Mensual</h3>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                    <thead>
                        <tr style={{ borderBottom: '2px solid var(--surface-border)' }}>
                            {['Período', 'Ingresos', 'Egresos', 'Utilidad', 'Margen'].map(h => (
                                <th key={h} style={{ padding: '0.6rem 0.8rem', textAlign: 'left', fontSize: '0.67rem', color: 'var(--text-muted)', fontWeight: 700, textTransform: 'uppercase' }}>{h}</th>
                            ))}
                        </tr>
                    </thead>
                    <tbody>
                        {chartData.map(r => {
                            const mg = r.ingresos > 0 ? ((r.utilidad / r.ingresos) * 100).toFixed(1) : 0;
                            return (
                                <tr key={r.mes} style={{ borderBottom: '1px solid var(--surface-border)' }}>
                                    <td style={{ padding: '0.75rem 0.8rem', fontWeight: 600 }}>{r.mes}</td>
                                    <td style={{ padding: '0.75rem 0.8rem', color: '#10b981', fontWeight: 700 }}>{fmtCOP(r.ingresos)}</td>
                                    <td style={{ padding: '0.75rem 0.8rem', color: '#ef4444', fontWeight: 700 }}>{fmtCOP(r.egresos)}</td>
                                    <td style={{ padding: '0.75rem 0.8rem', fontWeight: 700, color: r.utilidad >= 0 ? '#3b82f6' : '#ef4444' }}>{fmtCOP(r.utilidad)}</td>
                                    <td style={{ padding: '0.75rem 0.8rem' }}>
                                        <span style={{ padding: '2px 8px', borderRadius: 999, fontSize: '0.72rem', fontWeight: 700, background: Number(mg) >= 0 ? 'rgba(59,130,246,0.1)' : 'rgba(239,68,68,0.1)', color: Number(mg) >= 0 ? '#3b82f6' : '#ef4444' }}>{mg}%</span>
                                    </td>
                                </tr>
                            );
                        })}
                        {/* Total row */}
                        <tr style={{ borderTop: '2px solid var(--surface-border)', background: 'rgba(59,130,246,0.04)' }}>
                            <td style={{ padding: '0.75rem 0.8rem', fontWeight: 800 }}>TOTAL</td>
                            <td style={{ padding: '0.75rem 0.8rem', color: '#10b981', fontWeight: 800 }}>{fmtCOP(totIngresos)}</td>
                            <td style={{ padding: '0.75rem 0.8rem', color: '#ef4444', fontWeight: 800 }}>{fmtCOP(totEgresos)}</td>
                            <td style={{ padding: '0.75rem 0.8rem', fontWeight: 800, color: utilidad >= 0 ? '#3b82f6' : '#ef4444' }}>{fmtCOP(utilidad)}</td>
                            <td style={{ padding: '0.75rem 0.8rem' }}>
                                <span style={{ padding: '2px 8px', borderRadius: 999, fontSize: '0.72rem', fontWeight: 800, background: 'rgba(59,130,246,0.15)', color: '#3b82f6' }}>{margen}%</span>
                            </td>
                        </tr>
                    </tbody>
                </table>
            </div>
        </>
    );
}

// ─── MAIN PAGE ────────────────────────────────────────────────────────────────
export default function Financiero() {
    const [tab, setTab] = useState('gastos');

    const TABS = [
        { id: 'gastos', label: 'Gastos y Compras', icon: ShoppingBag },
        { id: 'nomina', label: 'Nómina y Empleados', icon: Users },
        { id: 'resultados', label: 'Estado de Resultados', icon: BarChart2 },
    ];

    return (
        <>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
                <div>
                    <h1>Módulo Financiero</h1>
                    <p className="text-muted">Gastos, nómina y estado de resultados</p>
                </div>
            </div>

            {/* Tab bar */}
            <div style={{ display: 'flex', gap: '0.25rem', background: 'rgba(255,255,255,0.04)', padding: '0.3rem', borderRadius: 12, marginBottom: '1.5rem', border: '1px solid var(--surface-border)' }}>
                {TABS.map(t => {
                    const Ic = t.icon;
                    const active = tab === t.id;
                    return (
                        <button key={t.id} onClick={() => setTab(t.id)}
                            style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.45rem', padding: '0.6rem 1rem', borderRadius: 9, border: 'none', cursor: 'pointer', fontWeight: active ? 700 : 500, fontSize: '0.875rem', background: active ? 'var(--primary)' : 'transparent', color: active ? 'white' : 'var(--text-muted)', transition: 'all 0.2s ease', boxShadow: active ? '0 2px 10px rgba(59,130,246,0.3)' : 'none' }}>
                            <Ic size={16} />{t.label}
                        </button>
                    );
                })}
            </div>

            {tab === 'gastos' && <GastosTab />}
            {tab === 'nomina' && <NominaTab />}
            {tab === 'resultados' && <PLTab />}
        </>
    );
}
