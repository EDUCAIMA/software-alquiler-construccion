import React from 'react';
import { 
    Edit2, ShieldCheck, DollarSign, Truck, Clock, CheckCircle, AlertTriangle, Ban
} from 'lucide-react';

export function ActionSection({ title, icon: Icon, color, children, stepNumber }) {
    const isStep = !!stepNumber;
    return (
        <div style={{ background: 'white', border: '1px solid #e2e8f0', borderRadius: 12, overflow: 'hidden', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.05), 0 2px 4px -1px rgba(0, 0, 0, 0.03)' }}>
            <div style={{ 
                padding: '0.75rem 1rem', 
                borderBottom: '1px solid ' + (isStep ? '#bae6fd' : '#f1f5f9'), 
                display: 'flex', 
                alignItems: 'center', 
                gap: 8, 
                background: isStep ? '#f0f9ff' : '#fafafa' 
            }}>
                {stepNumber && (
                    <div style={{ width: 18, height: 18, borderRadius: '50%', background: '#bae6fd', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.6rem', color: '#0284c7', fontWeight: 800 }}>
                        {stepNumber}
                    </div>
                )}
                <Icon size={14} style={{ color: isStep ? '#0369a1' : color }} />
                <span style={{ fontSize: '0.7rem', fontWeight: 800, color: isStep ? '#0369a1' : '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{title}</span>
            </div>
            <div style={{ padding: '1rem', display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '0.75rem' }}>
                {children}
            </div>
        </div>
    );
}

export function ActionBtn({ onClick, icon: Icon, label, variant = 'default', disabled, style }) {
    const variants = {
        primary:        { background: 'linear-gradient(135deg,#2365AB,#1d4f8f)', color: 'white', border: 'none' },
        green:          { background: '#10b981', color: 'white', border: 'none' },
        indigo:         { background: 'linear-gradient(135deg,#6366f1,#4f46e5)', color: 'white', border: 'none' },
        orange:         { background: '#f97316', color: 'white', border: 'none' },
        outline_blue:   { background: 'rgba(35,101,171,0.08)', color: '#2365AB', border: '1px solid rgba(35,101,171,0.2)' },
        outline_red:    { background: 'rgba(239,68,68,0.07)', color: '#ef4444', border: '1px solid rgba(239,68,68,0.2)' },
        outline_orange: { background: 'rgba(249,115,22,0.08)', color: '#f97316', border: '1px solid rgba(249,115,22,0.2)' },
        outline_purple: { background: 'rgba(139,92,246,0.08)', color: '#8b5cf6', border: '1px solid rgba(139,92,246,0.2)' },
        default:        { background: '#f1f5f9', color: '#475569', border: '1px solid #e2e8f0' },
    };
    const s = variants[variant] || variants.default;
    return (
        <button onClick={onClick} disabled={disabled}
            style={{ 
                width: '100%', 
                padding: '0.45rem 0.6rem', 
                borderRadius: 8, 
                cursor: disabled ? 'not-allowed' : 'pointer', 
                fontWeight: 700, 
                fontSize: '0.72rem', 
                display: 'flex', 
                alignItems: 'center', 
                justifyContent: 'center',
                gap: 6, 
                opacity: disabled ? 0.4 : 1, 
                textAlign: 'center',
                ...s,
                ...style 
            }}>
            {Icon && <Icon size={13} />}{label}
        </button>
    );
}

export function ProcessTimeline({ cot, hasInvoice, hasRems }) {
    const steps = [
        { id: 'draft',   label: 'Borrador',   icon: Edit2,       active: true },
        { id: 'approve', label: 'Aprobación', icon: ShieldCheck, active: ['Aprobada', 'Facturada'].includes(cot.estado) },
        { id: 'invoice', label: 'Factura',    icon: DollarSign,  active: hasInvoice },
        { id: 'dispatch',label: 'Despacho',   icon: Truck,       active: hasRems }
    ];

    return (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '1rem 0.5rem', background: 'white', borderRadius: 12, border: '1px solid #e2e8f0', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.05)', marginBottom: '1rem' }}>
            {steps.map((s, idx) => {
                const Icon = s.icon;
                const isLast = idx === steps.length - 1;
                return (
                    <React.Fragment key={s.id}>
                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6, flex: 1, position: 'relative' }}>
                            <div style={{ 
                                width: 30, height: 30, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center',
                                background: s.active ? '#2365AB' : '#f1f5f9',
                                color: s.active ? 'white' : '#94a3b8',
                                transition: 'all 0.3s ease',
                                border: s.active ? 'none' : '1px solid #e2e8f0',
                                boxShadow: s.active ? '0 4px 10px rgba(35,101,171,0.3)' : 'none'
                            }}>
                                <Icon size={14} />
                            </div>
                            <span style={{ fontSize: '0.58rem', fontWeight: 800, color: s.active ? '#0f172a' : '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.02em' }}>{s.label}</span>
                        </div>
                        {!isLast && (
                            <div style={{ height: 2, background: s.active && steps[idx+1].active ? '#2365AB' : '#f1f5f9', flex: 0.5, marginTop: -15, transition: 'all 0.3s' }} />
                        )}
                    </React.Fragment>
                );
            })}
        </div>
    );
}

export const REM_ICON  = { Activa: Truck, Parcial: Clock, Cerrada: CheckCircle, Pendiente: AlertTriangle, Cancelada: Ban };

export const BADGE = (label, color, Icon) => (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '3px 9px', borderRadius: 999, background: color, color: 'white', fontWeight: 800, fontSize: '0.62rem', textTransform: 'uppercase', whiteSpace: 'nowrap' }}>
        {Icon && <Icon size={11} />}{label}
    </span>
);
