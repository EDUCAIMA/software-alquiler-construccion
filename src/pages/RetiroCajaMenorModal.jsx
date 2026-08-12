import React, { useState, useMemo } from 'react';
import { X, Wallet, AlertTriangle } from 'lucide-react';
import { format } from 'date-fns';
import Swal from 'sweetalert2';
import { useAppContext } from '../context/AppContext';
import {
    buildMovimientosCajaMenor, resumirMovimientos, fmtCOP, DESTINOS_RETIRO
} from './cajaMenorUtils';

const inputStyle = {
    width: '100%', padding: '0.6rem 0.75rem', background: '#ffffff',
    border: '1px solid #e2e8f0', borderRadius: 8, color: '#104166',
    fontSize: '0.85rem', outline: 'none', boxSizing: 'border-box'
};
const labelStyle = {
    display: 'block', fontSize: '0.8rem', color: '#263777',
    fontWeight: 600, marginBottom: '0.4rem'
};

const emptyForm = {
    concepto: '',
    monto: '',
    fecha_retiro: format(new Date(), 'yyyy-MM-dd'),
    destino: DESTINOS_RETIRO[0],
    responsable: '',
    referencia_soporte: '',
    descripcion: ''
};

/**
 * Registra una salida de efectivo de la caja menor. No es un egreso contable:
 * el dinero se traslada (al banco, a gerencia, etc.), por eso no se guarda en
 * gastos y no afecta los reportes de gastos operativos.
 */
export default function RetiroCajaMenorModal({ onClose, editingRetiro = null }) {
    const {
        invoices = [], clients = [], ingresosCajaMenor = [],
        gastosMantenimiento = [], retirosCajaMenor = [],
        addRetiroCajaMenor, editRetiroCajaMenor
    } = useAppContext();

    const [form, setForm] = useState(() => editingRetiro ? {
        concepto: editingRetiro.concepto || '',
        monto: editingRetiro.monto || '',
        fecha_retiro: String(editingRetiro.fecha_retiro || '').split('T')[0] || emptyForm.fecha_retiro,
        destino: editingRetiro.destino || DESTINOS_RETIRO[0],
        responsable: editingRetiro.responsable || '',
        referencia_soporte: editingRetiro.referencia_soporte || '',
        descripcion: editingRetiro.descripcion || ''
    } : emptyForm);
    const [loading, setLoading] = useState(false);

    // Saldo disponible. Al editar, se descuenta el propio retiro para que el
    // tope mostrado sea el efectivo realmente disponible para ese movimiento.
    const saldoDisponible = useMemo(() => {
        const movimientos = buildMovimientosCajaMenor({
            invoices, clients, ingresosCajaMenor, gastosMantenimiento, retirosCajaMenor
        });
        const { saldo } = resumirMovimientos(movimientos);
        return editingRetiro ? saldo + (Number(editingRetiro.monto) || 0) : saldo;
    }, [invoices, clients, ingresosCajaMenor, gastosMantenimiento, retirosCajaMenor, editingRetiro]);

    const montoNum = Number(form.monto) || 0;
    const excedeSaldo = montoNum > saldoDisponible;
    const saldoResultante = saldoDisponible - montoNum;

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!form.concepto.trim() || montoNum <= 0) {
            Swal.fire('Datos incompletos', 'Indique el concepto y un monto mayor a cero.', 'warning');
            return;
        }

        if (excedeSaldo) {
            const { isConfirmed } = await Swal.fire({
                title: 'El retiro supera el saldo',
                html: `El saldo disponible en caja menor es <b>${fmtCOP(saldoDisponible)}</b> y está retirando <b>${fmtCOP(montoNum)}</b>.<br/><br/>La caja quedaría en <b>${fmtCOP(saldoResultante)}</b>. ¿Desea registrarlo de todas formas?`,
                icon: 'warning',
                showCancelButton: true,
                confirmButtonText: 'Sí, registrar',
                cancelButtonText: 'Cancelar',
                confirmButtonColor: '#f97316',
                cancelButtonColor: '#64748b'
            });
            if (!isConfirmed) return;
        }

        setLoading(true);
        try {
            if (editingRetiro) {
                await editRetiroCajaMenor(editingRetiro.id, form);
            } else {
                await addRetiroCajaMenor(form);
            }
            await Swal.fire({
                icon: 'success',
                title: editingRetiro ? 'Retiro actualizado' : '¡Retiro registrado!',
                text: `Se descontaron ${fmtCOP(montoNum)} de la caja menor. Nuevo saldo: ${fmtCOP(saldoResultante)}.`,
                confirmButtonColor: '#2365AB'
            });
            onClose();
        } catch (error) {
            console.error('Error registrando retiro de caja menor:', error);
            Swal.fire('Error', 'No se pudo registrar el retiro: ' + error.message, 'error');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(15, 23, 42, 0.6)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1200, padding: '1rem' }}>
            <div style={{ background: '#ffffff', borderRadius: '16px', boxShadow: '0 20px 40px rgba(0,0,0,0.15)', width: '100%', maxWidth: 520, maxHeight: '92vh', display: 'flex', flexDirection: 'column' }}>

                {/* Header */}
                <div style={{ padding: '1.25rem 1.5rem', borderBottom: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <h3 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '0.6rem', color: '#104166', fontSize: '1.1rem' }}>
                        <div style={{ background: '#fff7ed', padding: '0.4rem', borderRadius: '8px', display: 'flex' }}><Wallet size={18} style={{ color: '#f97316' }} /></div>
                        {editingRetiro ? 'Editar Retiro de Caja Menor' : 'Retiro de Caja Menor'}
                    </h3>
                    <button type="button" onClick={onClose} style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '50%', width: 30, height: 30, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: '#64748b' }}><X size={16} /></button>
                </div>

                <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1rem', padding: '1.5rem', margin: 0, overflowY: 'auto' }}>

                    {/* Saldo disponible */}
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#f0f9ff', border: '1px solid #bae6fd', borderRadius: 12, padding: '0.85rem 1.1rem' }}>
                        <div>
                            <div style={{ fontSize: '0.72rem', color: '#0369a1', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Saldo disponible en caja</div>
                            <div style={{ fontSize: '1.35rem', fontWeight: 800, color: '#0c4a6e', lineHeight: 1.3 }}>{fmtCOP(saldoDisponible)}</div>
                        </div>
                        {montoNum > 0 && (
                            <div style={{ textAlign: 'right' }}>
                                <div style={{ fontSize: '0.72rem', color: '#0369a1', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Queda después</div>
                                <div style={{ fontSize: '1.15rem', fontWeight: 800, color: saldoResultante < 0 ? '#ef4444' : '#059669', lineHeight: 1.3 }}>{fmtCOP(saldoResultante)}</div>
                            </div>
                        )}
                    </div>

                    <div>
                        <label style={labelStyle}>Concepto del Retiro *</label>
                        <input type="text" required value={form.concepto}
                            onChange={e => setForm(f => ({ ...f, concepto: e.target.value }))}
                            placeholder="Ej. Consignación de recaudos de la semana"
                            style={inputStyle} />
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                        <div>
                            <label style={labelStyle}>Fecha del Retiro</label>
                            <input type="date" required value={form.fecha_retiro}
                                onChange={e => setForm(f => ({ ...f, fecha_retiro: e.target.value }))}
                                style={inputStyle} />
                        </div>
                        <div>
                            <label style={labelStyle}>Monto a Retirar ($) *</label>
                            <input type="number" min="0" required value={form.monto}
                                onChange={e => setForm(f => ({ ...f, monto: e.target.value }))}
                                placeholder="0"
                                style={{ ...inputStyle, borderColor: excedeSaldo ? '#fca5a5' : '#e2e8f0' }} />
                        </div>
                    </div>

                    {excedeSaldo && (
                        <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.6rem', background: '#fffbeb', border: '1px solid #fcd34d', borderRadius: 10, padding: '0.75rem 0.9rem' }}>
                            <AlertTriangle size={16} style={{ color: '#d97706', flexShrink: 0, marginTop: 2 }} />
                            <span style={{ fontSize: '0.8rem', color: '#92400e', lineHeight: 1.5 }}>
                                El monto supera el efectivo disponible ({fmtCOP(saldoDisponible)}). Revise si falta registrar algún ingreso en efectivo antes de continuar.
                            </span>
                        </div>
                    )}

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                        <div>
                            <label style={labelStyle}>Destino del Dinero</label>
                            <select value={form.destino}
                                onChange={e => setForm(f => ({ ...f, destino: e.target.value }))}
                                style={{ ...inputStyle, cursor: 'pointer' }}>
                                {DESTINOS_RETIRO.map(d => <option key={d} value={d}>{d}</option>)}
                            </select>
                        </div>
                        <div>
                            <label style={labelStyle}>Responsable / Quién Retira</label>
                            <input type="text" value={form.responsable}
                                onChange={e => setForm(f => ({ ...f, responsable: e.target.value }))}
                                placeholder="Nombre de quien recibe el efectivo"
                                style={inputStyle} />
                        </div>
                    </div>

                    <div>
                        <label style={labelStyle}>Referencia Soporte</label>
                        <input type="text" value={form.referencia_soporte}
                            onChange={e => setForm(f => ({ ...f, referencia_soporte: e.target.value }))}
                            placeholder="Nº de consignación, recibo de caja, etc..."
                            style={inputStyle} />
                    </div>

                    <div>
                        <label style={labelStyle}>Observaciones</label>
                        <textarea rows={3} value={form.descripcion}
                            onChange={e => setForm(f => ({ ...f, descripcion: e.target.value }))}
                            placeholder="Detalles adicionales del retiro..."
                            style={{ ...inputStyle, resize: 'vertical' }} />
                    </div>

                    <div style={{ fontSize: '0.75rem', color: '#64748b', lineHeight: 1.5, background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 10, padding: '0.75rem 0.9rem' }}>
                        Un retiro <b>no se registra como gasto</b>: solo traslada el efectivo fuera de la caja, por lo que reduce el saldo sin afectar los reportes de gastos operativos.
                    </div>

                    <div style={{ padding: '1rem', background: '#f8fafc', borderTop: '1px solid #e2e8f0', borderRadius: '0 0 16px 16px', display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', margin: '0.5rem -1.5rem -1.5rem -1.5rem' }}>
                        <button type="button" className="btn btn-secondary" onClick={onClose}
                            style={{ background: '#ffffff', border: '1px solid #cbd5e1', color: '#263777' }}>Cancelar</button>
                        <button type="submit" className="btn btn-primary" disabled={loading}
                            style={{ background: '#f97316', border: 'none', opacity: loading ? 0.7 : 1 }}>
                            {loading ? 'Guardando...' : (editingRetiro ? 'Guardar Cambios' : 'Registrar Retiro')}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}
