import React from 'react';
import { Activity, Clock, LogOut, LogIn, Mail } from 'lucide-react';
import { useAppContext } from '../context/AppContext';

export default function Trazability() {
    const { logs } = useAppContext();

    return (
        <>
            <div className="flex justify-between items-center mb-6">
                <div>
                    <h1>Trazabilidad de Actividades</h1>
                    <p className="text-muted">Registro detallado de todo el movimiento de equipos y facturación</p>
                </div>
                <button className="btn btn-secondary">Exportar CSV</button>
            </div>

            <div className="glass-panel p-6">
                <div className="flex-col gap-6">
                    {logs.map((log, index) => {
                        const isExit = log.type === 'exit';
                        const isEntry = log.type === 'entry';
                        const isSystem = log.type === 'system';

                        let Icon = Activity;
                        if (isExit) Icon = LogOut;
                        if (isEntry) Icon = LogIn;
                        if (log.action.includes('Email')) Icon = Mail;

                        const iconClass = isExit ? 'orange' : isEntry ? 'green' : 'blue';

                        return (
                            <div key={log.id} style={{ display: 'flex', gap: '1.5rem', position: 'relative', paddingBottom: index === logs.length - 1 ? 0 : '1.5rem' }}>
                                {index !== logs.length - 1 && (
                                    <div style={{ position: 'absolute', top: '48px', bottom: 0, left: '23px', width: '2px', background: 'var(--surface-border)' }}></div>
                                )}
                                <div className={`icon-wrapper ${iconClass}`} style={{ zIndex: 10 }}>
                                    <Icon size={20} />
                                </div>
                                <div style={{ flex: 1, padding: '0.75rem', background: 'rgba(255,255,255,0.02)', borderRadius: '12px', border: '1px solid var(--surface-border)' }}>
                                    <div className="flex justify-between items-center mb-2">
                                        <h3 style={{ fontSize: '1rem', color: 'var(--text-primary)' }}>{log.action}</h3>
                                        <div className="flex items-center gap-2 text-muted" style={{ fontSize: '0.8rem' }}>
                                            <Clock size={14} />
                                            {log.time}
                                        </div>
                                    </div>
                                    <div style={{ fontSize: '0.9rem', color: 'var(--text-secondary)' }}>
                                        <p style={{ marginBottom: '0.25rem' }}><strong>Equipo/Detalle:</strong> <span style={{ color: 'var(--primary)' }}>{log.product}</span></p>
                                        <p><strong>Cliente/Usuario:</strong> {log.client}</p>
                                    </div>
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>
        </>
    );
}
