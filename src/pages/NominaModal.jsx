import React, { useState, useMemo } from 'react';
import { X, Users, DollarSign, Calendar, Briefcase, FileText, Download, CheckCircle, Calculator, CreditCard } from 'lucide-react';
import { format } from 'date-fns';
import Swal from 'sweetalert2';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { applyStandardLayout, drawInfoGrid } from './pdfTheme';
import { generateComprobanteNominaPDF } from './NominaHelpers';
import { METODOS_PAGO } from './cajaMenorUtils';

const TIPOS_HORA_EXTRA = [
    { key: 'diurna', label: 'Extra Diurna (25%)', factor: 1.25 },
    { key: 'nocturna', label: 'Extra Nocturna (75%)', factor: 1.75 },
    { key: 'dominical', label: 'Dominical / Festiva (100%)', factor: 2.0 },
    { key: 'domNocturna', label: 'Extra Dom. Nocturna (150%)', factor: 2.5 },
];

export default function NominaModal({ onClose, users, addGastoMantenimiento, settings }) {
    const [periodo, setPeriodo] = useState(format(new Date(), 'yyyy-MM'));
    const [selectedUserId, setSelectedUserId] = useState(users[0]?.id || '');
    
    // Payroll variables per liquidation
    const [diasTrabajados, setDiasTrabajados] = useState(30);
    const [horasExtrasMap, setHorasExtrasMap] = useState({
        diurna: '',
        nocturna: '',
        dominical: '',
        domNocturna: ''
    });
    const [bonificaciones, setBonificaciones] = useState(0);
    const [porcSalud, setPorcSalud] = useState(4);
    const [porcPension, setPorcPension] = useState(4);
    const [otrasDeducciones, setOtrasDeducciones] = useState(0);
    const [notas, setNotas] = useState('');
    const [metodoPago, setMetodoPago] = useState('Efectivo');
    const [loading, setLoading] = useState(false);

    const selectedUser = useMemo(() => {
        return users.find(u => u.id === selectedUserId) || users[0];
    }, [users, selectedUserId]);

    const salarioBase = Number(selectedUser?.salario_base || 0);
    const auxTransporte = Number(selectedUser?.auxilio_transporte || 0);

    const setHrs = (key, val) => {
        setHorasExtrasMap(prev => ({ ...prev, [key]: val }));
    };

    // Live payroll calculations
    const calculations = useMemo(() => {
        const dTrab = Number(diasTrabajados) || 0;
        const devBase = Math.round((salarioBase / 30) * dTrab);
        const auxTransProp = dTrab > 0 ? Math.round((auxTransporte / 30) * dTrab) : 0;
        
        // Calculation of Overtime based on base salary (240 hours/month standard)
        const valorHoraOrdinaria = salarioBase > 0 ? (salarioBase / 240) : 0;

        const extrasBreakdown = TIPOS_HORA_EXTRA.map(t => {
            const cantHrs = Number(horasExtrasMap[t.key]) || 0;
            const valorHoraExtra = Math.round(valorHoraOrdinaria * t.factor);
            const subtotal = Math.round(cantHrs * valorHoraExtra);
            return {
                key: t.key,
                label: t.label,
                factor: t.factor,
                cantHrs,
                valorHoraExtra,
                subtotal
            };
        });

        const extras = extrasBreakdown.reduce((sum, item) => sum + item.subtotal, 0);
        const cantHrsTotal = extrasBreakdown.reduce((sum, item) => sum + item.cantHrs, 0);

        const bonif = Number(bonificaciones) || 0;
        const totalDevengado = devBase + auxTransProp + extras + bonif;

        const valSalud = Math.round(devBase * (Number(porcSalud) / 100));
        const valPension = Math.round(devBase * (Number(porcPension) / 100));
        const otrDed = Number(otrasDeducciones) || 0;
        const totalDeducciones = valSalud + valPension + otrDed;

        const netoAPagar = Math.max(0, totalDevengado - totalDeducciones);

        return {
            devBase,
            auxTransProp,
            valorHoraOrdinaria,
            extrasBreakdown,
            cantHrsTotal,
            extras,
            bonif,
            totalDevengado,
            valSalud,
            valPension,
            otrDed,
            totalDeducciones,
            netoAPagar
        };
    }, [salarioBase, auxTransporte, diasTrabajados, horasExtrasMap, bonificaciones, porcSalud, porcPension, otrasDeducciones]);

    const generateNominaPDF = (user, calc, per) => {
        try {
            const doc = new jsPDF();
            const W = doc.internal.pageSize.getWidth();
            const margin = 10;
            const refNo = `NOM-${user.id}-${per.replace('-', '')}`;

            let y = applyStandardLayout(doc, 'Comprobante de Nómina', settings, refNo);

            y = drawInfoGrid(doc, y, {
                name: user.name,
                nit: user.documento || 'No registrado',
                direccion: user.banco_cuenta || 'Pago Directo',
                phone: user.username,
                ciudad: 'BOGOTÁ'
            }, {
                valTopLeft: per,
                labelTopLeft: 'Periodo Liquida.',
                valTopRight: format(new Date(), 'dd/MM/yyyy'),
                labelTopRight: 'Fecha Pago',
                valMidLeft: user.cargo || 'PERFIL REGISTRADO',
                valMidRight: user.role?.toUpperCase(),
                labelMidRight: 'Rol Sistema',
                hideBottom: true
            });

            // Table of items
            autoTable(doc, {
                startY: y,
                margin: { left: margin, right: margin },
                head: [['CONCEPTO / DESCRIPCIÓN', 'DEVENGADOS', 'DEDUCCIONES']],
                body: [
                    [`Sueldo Básico (${diasTrabajados} días)`, `$${calc.devBase.toLocaleString('es-CO')}`, '—'],
                    [`Auxilio de Transporte`, `$${calc.auxTransProp.toLocaleString('es-CO')}`, '—'],
                    ...calc.extrasBreakdown.filter(e => e.cantHrs > 0).map(e => [
                        `${e.label} (${e.cantHrs} hrs @ ${e.factor}x)`,
                        `$${e.subtotal.toLocaleString('es-CO')}`,
                        '—'
                    ]),
                    calc.bonif > 0 ? [`Bonificaciones / Incentivos`, `$${calc.bonif.toLocaleString('es-CO')}`, '—'] : null,
                    [`Aporte Salud (${porcSalud}%)`, '—', `$${calc.valSalud.toLocaleString('es-CO')}`],
                    [`Aporte Pensión (${porcPension}%)`, '—', `$${calc.valPension.toLocaleString('es-CO')}`],
                    calc.otrDed > 0 ? [`Otras Deducciones / Descuentos`, '—', `$${calc.otrDed.toLocaleString('es-CO')}`] : null,
                ].filter(Boolean),
                theme: 'grid',
                headStyles: { fillColor: [35, 101, 171], textColor: [255, 255, 255], fontSize: 8.5, fontStyle: 'bold', halign: 'center' },
                styles: { fontSize: 8.5, cellPadding: 3, textColor: [0, 0, 0], fontStyle: 'normal' },
                columnStyles: {
                    0: { halign: 'left', cellWidth: 'auto' },
                    1: { halign: 'right', cellWidth: 45 },
                    2: { halign: 'right', cellWidth: 45 }
                }
            });

            y = doc.lastAutoTable.finalY + 8;

            // Summary box
            doc.setFillColor(248, 250, 252);
            doc.setDrawColor(203, 213, 225);
            doc.roundedRect(margin, y, W - (margin * 2), 20, 3, 3, 'FD');

            doc.setFontSize(8.5);
            doc.setFont('helvetica', 'bold');
            doc.setTextColor(30, 41, 59);
            doc.text(`Total Devengado: $${calc.totalDevengado.toLocaleString('es-CO')}`, margin + 5, y + 6);
            doc.text(`Total Deducciones: $${calc.totalDeducciones.toLocaleString('es-CO')}`, margin + 5, y + 14);

            doc.setFontSize(11);
            doc.setTextColor(35, 101, 171);
            doc.text(`NETO A PAGAR: $${calc.netoAPagar.toLocaleString('es-CO')}`, W - margin - 5, y + 11, { align: 'right' });

            y += 30;

            // Signatures
            doc.setLineWidth(0.5);
            doc.setDrawColor(30, 41, 59);
            doc.line(margin + 10, y, margin + 70, y);
            doc.line(W - margin - 70, y, W - margin - 10, y);

            doc.setFontSize(8);
            doc.setTextColor(30, 41, 59);
            doc.setFont('helvetica', 'normal');
            doc.text(`Firma Empleador (${settings?.companyName || 'Empresa'})`, margin + 40, y + 5, { align: 'center' });
            doc.text(`Firma Recibido (${user.name})`, W - margin - 40, y + 5, { align: 'center' });

            doc.save(`Comprobante_Nomina_${user.name.replace(/\s+/g, '_')}_${per}.pdf`);
        } catch (e) {
            console.error("Error generating Payroll PDF:", e);
        }
    };

    const handleLiquidar = async () => {
        if (!selectedUser) return;
        if (calculations.netoAPagar <= 0) {
            Swal.fire('Atención', 'El neto a pagar debe ser mayor a cero para procesar la liquidación.', 'warning');
            return;
        }

        setLoading(true);
        try {
            const fechaActual = format(new Date(), 'yyyy-MM-dd');
            const desc = `Pago de Nómina Mensual (${periodo}) - ${selectedUser.name} [${selectedUser.cargo || 'Perfil Registrado'}]`;
            
            const metadataObj = {
                user: selectedUser,
                calc: {
                    ...calculations,
                    diasTrabajados,
                    porcSalud,
                    porcPension
                },
                periodo
            };

            // Register expense in GastosMantenimiento
            await addGastoMantenimiento({
                id_maquina: null,
                tipo_gasto: 'Gastos de Sostenimiento',
                subtipo_gasto: 'Nómina Operativa',
                descripcion: desc + (notas ? ` · ${notas}` : ''),
                costo: calculations.netoAPagar,
                fecha_gasto: fechaActual,
                proveedor_beneficiario: selectedUser.name,
                referencia_soporte: `NOM-${selectedUser.id}-${periodo.replace('-', '')}`,
                metadata: JSON.stringify(metadataObj),
                metodo_pago: metodoPago
            });

            // Generate Paystub PDF using shared helper
            generateComprobanteNominaPDF({
                user: selectedUser,
                calc: { ...calculations, diasTrabajados, porcSalud, porcPension },
                periodo,
                settings,
                fechaPago: fechaActual,
                refNo: `NOM-${selectedUser.id}-${periodo.replace('-', '')}`
            });

            Swal.fire({
                icon: 'success',
                title: '¡Nómina Liquidada!',
                text: `Se registró el egreso por $${calculations.netoAPagar.toLocaleString('es-CO')} y se descargó el comprobante PDF de ${selectedUser.name}.`,
                confirmButtonColor: '#2365AB'
            });

            onClose();
        } catch (error) {
            console.error("Error liquidating payroll:", error);
            Swal.fire('Error', 'Ocurrió un error al procesar la liquidación de nómina: ' + error.message, 'error');
        } finally {
            setLoading(false);
        }
    };

    const inputStyle = { width: '100%', padding: '0.55rem 0.75rem', background: '#ffffff', border: '1px solid #cbd5e1', borderRadius: '8px', color: '#1e293b', fontSize: '0.875rem', outline: 'none', boxSizing: 'border-box' };
    const labelStyle = { fontSize: '0.72rem', color: '#64748b', fontWeight: 700, textTransform: 'uppercase', marginBottom: '0.35rem', display: 'flex', alignItems: 'center', gap: 4 };

    return (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(15, 23, 42, 0.6)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1200, padding: '1rem' }}>
            <div style={{ background: '#ffffff', borderRadius: '16px', boxShadow: '0 25px 50px -12px rgba(0,0,0,0.25)', width: '100%', maxWidth: 850, maxHeight: '90vh', display: 'flex', flexDirection: 'column' }}>
                {/* Modal Header */}
                <div style={{ padding: '1.25rem 2rem', borderBottom: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#ffffff', borderTopLeftRadius: '16px', borderTopRightRadius: '16px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                        <div style={{ width: 36, height: 36, borderRadius: '10px', background: 'rgba(35,101,171,0.1)', color: '#2365AB', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                            <Users size={20} />
                        </div>
                        <div>
                            <h3 style={{ margin: 0, color: '#104166', fontSize: '1.1rem', fontWeight: 800 }}>Liquidar Nómina Mensual</h3>
                            <span style={{ fontSize: '0.75rem', color: '#64748b' }}>A partir de los trabajadores de <strong>Perfiles Registrados</strong></span>
                        </div>
                    </div>
                    <button onClick={onClose} style={{ background: 'transparent', border: 'none', borderRadius: '50%', width: 32, height: 32, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: '#64748b' }}>
                        <X size={18} />
                    </button>
                </div>

                {/* Modal Body */}
                <div style={{ padding: '1.5rem 2rem', overflowY: 'auto', flex: 1, display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                    {/* Top Selectors: Period & Worker */}
                    <div style={{ display: 'grid', gridTemplateColumns: '1.4fr 1fr', gap: '1.25rem', background: '#f8fafc', padding: '1rem', borderRadius: '12px', border: '1px solid #e2e8f0' }}>
                        <div>
                            <label style={labelStyle}><Users size={12} /> Seleccionar Trabajador (Perfil Registrado)</label>
                            <select 
                                value={selectedUserId} 
                                onChange={e => setSelectedUserId(e.target.value)}
                                style={{ ...inputStyle, fontWeight: 700, color: '#104166' }}
                            >
                                {users.map(u => (
                                    <option key={u.id} value={u.id}>
                                        {u.name} — {u.cargo || u.role} {u.documento ? `(CC: ${u.documento})` : ''}
                                    </option>
                                ))}
                            </select>
                        </div>
                        <div>
                            <label style={labelStyle}><Calendar size={12} /> Periodo Mensual</label>
                            <input 
                                type="month" 
                                value={periodo} 
                                onChange={e => setPeriodo(e.target.value)}
                                style={{ ...inputStyle, fontWeight: 700, color: '#104166' }}
                            />
                        </div>
                    </div>

                    {/* Selected Profile Summary Banner */}
                    {selectedUser && (
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '0.75rem', background: 'rgba(35,101,171,0.04)', padding: '0.85rem 1rem', borderRadius: '10px', border: '1px solid rgba(35,101,171,0.15)', fontSize: '0.8rem' }}>
                            <div><span style={{ color: '#64748b' }}>Trabajador:</span> <strong style={{ color: '#104166', display: 'block' }}>{selectedUser.name}</strong></div>
                            <div><span style={{ color: '#64748b' }}>Cargo:</span> <strong style={{ color: '#104166', display: 'block' }}>{selectedUser.cargo || 'Sin asignar'}</strong></div>
                            <div><span style={{ color: '#64748b' }}>Salario Base:</span> <strong style={{ color: '#10b981', display: 'block' }}>${salarioBase.toLocaleString('es-CO')}</strong></div>
                            <div><span style={{ color: '#64748b' }}>Aux. Transporte:</span> <strong style={{ color: '#2365AB', display: 'block' }}>${auxTransporte.toLocaleString('es-CO')}</strong></div>
                        </div>
                    )}

                    {/* Inputs Grid */}
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem' }}>
                        {/* Devengados Column */}
                        <div style={{ background: '#ffffff', borderRadius: '12px', border: '1px solid #e2e8f0', padding: '1rem', display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
                            <h4 style={{ margin: 0, fontSize: '0.8rem', color: '#10b981', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 800, display: 'flex', alignItems: 'center', gap: 6 }}>
                                <DollarSign size={14} /> Devengados (Ingresos)
                            </h4>

                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                                <div>
                                    <label style={labelStyle}>Días Trabajados</label>
                                    <input type="number" min="0" max="30" value={diasTrabajados} onChange={e => setDiasTrabajados(e.target.value)} style={inputStyle} />
                                </div>
                                <div>
                                    <label style={labelStyle}>Sueldo Proporcional</label>
                                    <div style={{ ...inputStyle, background: '#f8fafc', fontWeight: 700 }}>${calculations.devBase.toLocaleString('es-CO')}</div>
                                </div>
                            </div>

                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                                <div>
                                    <label style={labelStyle}>Aux. Transporte</label>
                                    <div style={{ ...inputStyle, background: '#f8fafc', fontWeight: 700 }}>${calculations.auxTransProp.toLocaleString('es-CO')}</div>
                                </div>
                                <div>
                                    <label style={labelStyle}>Bonificaciones / Incentivos</label>
                                    <input type="number" min="0" value={bonificaciones} onChange={e => setBonificaciones(e.target.value)} placeholder="0" style={inputStyle} />
                                </div>
                            </div>

                            {/* Overtime calculation controls per type */}
                            <div style={{ background: '#f8fafc', padding: '0.75rem', borderRadius: '8px', border: '1px solid #e2e8f0', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                    <span style={{ fontSize: '0.72rem', color: '#1e293b', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                                        Horas Extras y Recargos
                                    </span>
                                    <span style={{ fontSize: '0.68rem', color: '#64748b' }}>
                                        Hora Ord: ${Math.round(calculations.valorHoraOrdinaria).toLocaleString('es-CO')}
                                    </span>
                                </div>

                                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
                                    {TIPOS_HORA_EXTRA.map(t => {
                                        const detail = calculations.extrasBreakdown.find(b => b.key === t.key);
                                        return (
                                            <div key={t.key} style={{ display: 'grid', gridTemplateColumns: '1.4fr 0.8fr 1fr', alignItems: 'center', gap: '0.5rem', background: '#ffffff', padding: '0.3rem 0.5rem', borderRadius: '6px', border: '1px solid #cbd5e1' }}>
                                                <span style={{ fontSize: '0.72rem', color: '#334155', fontWeight: 600 }}>{t.label}</span>
                                                <input 
                                                    type="number" 
                                                    min="0" 
                                                    step="0.5" 
                                                    value={horasExtrasMap[t.key] || ''} 
                                                    onChange={e => setHrs(t.key, e.target.value)} 
                                                    placeholder="0 hrs" 
                                                    style={{ ...inputStyle, padding: '0.25rem 0.4rem', fontSize: '0.78rem', textAlign: 'center', height: '26px' }} 
                                                />
                                                <span style={{ fontSize: '0.75rem', fontWeight: 700, textAlign: 'right', color: detail.subtotal > 0 ? '#059669' : '#94a3b8' }}>
                                                    ${detail.subtotal.toLocaleString('es-CO')}
                                                </span>
                                            </div>
                                        );
                                    })}
                                </div>

                                {calculations.cantHrsTotal > 0 && (
                                    <div style={{ fontSize: '0.72rem', color: '#059669', fontWeight: 800, display: 'flex', justifyContent: 'space-between', background: '#f0fdf4', padding: '0.35rem 0.6rem', borderRadius: '6px', border: '1px solid #bbf7d0', marginTop: '0.2rem' }}>
                                        <span>Total Recargos: {calculations.cantHrsTotal} hrs</span>
                                        <span>+ ${calculations.extras.toLocaleString('es-CO')}</span>
                                    </div>
                                )}
                            </div>

                            <div style={{ marginTop: 'auto', paddingTop: '0.75rem', borderTop: '1px solid #f1f5f9', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                <span style={{ fontSize: '0.8rem', fontWeight: 700, color: '#475569' }}>Total Devengado:</span>
                                <span style={{ fontSize: '1.05rem', fontWeight: 800, color: '#10b981' }}>${calculations.totalDevengado.toLocaleString('es-CO')}</span>
                            </div>
                        </div>

                        {/* Deducciones Column */}
                        <div style={{ background: '#ffffff', borderRadius: '12px', border: '1px solid #e2e8f0', padding: '1rem', display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
                            <h4 style={{ margin: 0, fontSize: '0.8rem', color: '#ef4444', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 800, display: 'flex', alignItems: 'center', gap: 6 }}>
                                <Calculator size={14} /> Deducciones (Descuentos)
                            </h4>

                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                                <div>
                                    <label style={labelStyle}>Salud (%)</label>
                                    <input type="number" min="0" step="0.5" value={porcSalud} onChange={e => setPorcSalud(e.target.value)} style={inputStyle} />
                                    <span style={{ fontSize: '0.68rem', color: '#94a3b8', marginTop: 2, display: 'block' }}>${calculations.valSalud.toLocaleString('es-CO')}</span>
                                </div>
                                <div>
                                    <label style={labelStyle}>Pensión (%)</label>
                                    <input type="number" min="0" step="0.5" value={porcPension} onChange={e => setPorcPension(e.target.value)} style={inputStyle} />
                                    <span style={{ fontSize: '0.68rem', color: '#94a3b8', marginTop: 2, display: 'block' }}>${calculations.valPension.toLocaleString('es-CO')}</span>
                                </div>
                            </div>

                            <div>
                                <label style={labelStyle}>Otras Deducciones (COP)</label>
                                <input type="number" min="0" value={otrasDeducciones} onChange={e => setOtrasDeducciones(e.target.value)} placeholder="0" style={inputStyle} />
                            </div>

                            <div>
                                <label style={labelStyle}>Método de Pago</label>
                                <select value={metodoPago} onChange={e => setMetodoPago(e.target.value)} style={{ ...inputStyle, cursor: 'pointer' }}>
                                    {METODOS_PAGO.map(m => <option key={m} value={m}>{m}</option>)}
                                </select>
                                {metodoPago === 'Efectivo' && (
                                    <span style={{ fontSize: '0.68rem', color: '#c2410c', marginTop: 3, display: 'block' }}>
                                        Se descontará de la caja menor.
                                    </span>
                                )}
                            </div>

                            <div>
                                <label style={labelStyle}>Notas / Observaciones</label>
                                <input type="text" value={notas} onChange={e => setNotas(e.target.value)} placeholder="Ej: Pago quincenal u observaciones..." style={inputStyle} />
                            </div>

                            <div style={{ marginTop: 'auto', paddingTop: '0.75rem', borderTop: '1px solid #f1f5f9', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                <span style={{ fontSize: '0.8rem', fontWeight: 700, color: '#475569' }}>Total Deducciones:</span>
                                <span style={{ fontSize: '1.05rem', fontWeight: 800, color: '#ef4444' }}>${calculations.totalDeducciones.toLocaleString('es-CO')}</span>
                            </div>
                        </div>
                    </div>

                    {/* Net Total Summary Box */}
                    <div style={{ background: 'linear-gradient(135deg, #f0fdf4 0%, #dcfce7 100%)', border: '1px solid #bbf7d0', borderRadius: '12px', padding: '1.25rem 1.5rem', color: '#1e293b', display: 'flex', justifyContent: 'space-between', alignItems: 'center', boxShadow: '0 2px 8px rgba(16, 185, 129, 0.08)' }}>
                        <div>
                            <span style={{ fontSize: '0.75rem', color: '#166534', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 800 }}>Total Neto a Transferir / Pagar</span>
                            <div style={{ fontSize: '0.9rem', color: '#0f172a', fontWeight: 700, marginTop: 3 }}>{selectedUser?.name ? selectedUser.name : '—'} — {selectedUser?.cargo || 'Trabajador'}</div>
                        </div>
                        <div style={{ textAlign: 'right' }}>
                            <div style={{ fontSize: '1.7rem', fontWeight: 900, color: '#059669' }}>${calculations.netoAPagar.toLocaleString('es-CO')}</div>
                            <div style={{ fontSize: '0.75rem', color: '#166534', fontWeight: 600 }}>Periodo: {periodo}</div>
                        </div>
                    </div>
                </div>

                {/* Modal Footer */}
                <div style={{ padding: '1rem 2rem', background: '#ffffff', borderTop: '1px solid #e2e8f0', display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', borderBottomLeftRadius: '16px', borderBottomRightRadius: '16px' }}>
                    <button className="btn btn-secondary" onClick={onClose} disabled={loading} style={{ height: '40px', padding: '0 1.5rem' }}>
                        Cancelar
                    </button>
                    <button className="btn btn-primary" onClick={handleLiquidar} disabled={loading || calculations.netoAPagar <= 0}
                        style={{ background: '#2365AB', border: 'none', color: 'white', fontWeight: 700, padding: '0 1.5rem', borderRadius: '8px', height: '40px', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <CheckCircle size={16} /> {loading ? 'Procesando...' : 'Liquidar y Registrar Egreso'}
                    </button>
                </div>
            </div>
        </div>
    );
}
