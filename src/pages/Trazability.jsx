import React, { useMemo, useState } from 'react';
import { Activity, ArrowDownToLine, ArrowUpFromLine, Clock, Search, Package, Briefcase, UserRound } from 'lucide-react';
import { useAppContext } from '../context/AppContext';

const normalizarRemision = (id) => {
    const value = String(id || '').replace(/^#/, '').toUpperCase();
    return value.startsWith('REM') ? `#${value}` : `#REM-${value}`;
};

const esServicio = (item = {}, product = {}) => {
    const descriptor = [
        item.category,
        item.tipoCobro,
        item.esquemaCobro,
        product.category,
        product.tipoCobro,
        product.esquemaCobro,
        item.nombre,
        product.name
    ].filter(Boolean).join(' ').toLowerCase();

    return descriptor.includes('servicio') || descriptor.includes('servio ') || descriptor.includes('única vez') ||
        descriptor.includes('unica vez') || descriptor.includes('transporte') ||
        descriptor.includes('entrega') || descriptor.includes('recogida') ||
        descriptor.includes('flete') || descriptor.includes('acarreo') || descriptor.includes('mano de obra') ||
        descriptor.includes('armado') || descriptor.includes('desarmado') ||
        descriptor.includes('depósito') || descriptor.includes('deposito') || descriptor.includes('cargo por');
};

const fechaLegible = (value) => {
    if (!value) return 'Sin fecha';
    const [datePart] = String(value).split('T');
    const parts = datePart.split('-');
    return parts.length === 3 ? `${parts[2]}/${parts[1]}/${parts[0]}` : value;
};

export default function Trazability({ embedded = false }) {
    const { logs = [], remisiones = [], clients = [], products = [] } = useAppContext();
    const [tipo, setTipo] = useState('todos');
    const [search, setSearch] = useState('');

    const eventos = useMemo(() => {
        const result = [];

        (remisiones || [])
            .filter(rem => rem.estado !== 'Cancelada')
            .forEach(rem => {
                const client = clients.find(c => String(c.id) === String(rem.clientId));
                const obra = client?.obras?.find(o => String(o.id) === String(rem.obraId));
                const clientName = client?.name || rem.clientName || 'Cliente no identificado';
                const obraName = obra?.nombre || rem.obraNombre || 'Sin obra';
                const items = (rem.items || []).map(item => {
                    const product = products.find(p => String(p.id) === String(item.productId));
                    const servicio = esServicio(item, product);
                    return {
                        nombre: item.nombre || product?.name || item.productId || 'Ítem',
                        cantidad: servicio ? null : Number(item.cantidad) || 0,
                        servicio
                    };
                });

                result.push({
                    id: `salida-${rem.id}`,
                    tipo: 'salida',
                    remId: rem.id,
                    fecha: rem.fecha,
                    hora: rem.hora || '',
                    clientName,
                    obraName,
                    items
                });

                (rem.items || []).forEach((item, itemIndex) => {
                    const product = products.find(p => String(p.id) === String(item.productId));
                    if (esServicio(item, product)) return;

                    (item.devoluciones || []).forEach((dev, devIndex) => {
                        result.push({
                            id: `entrada-${rem.id}-${itemIndex}-${devIndex}`,
                            tipo: 'entrada',
                            remId: rem.id,
                            fecha: dev.fecha,
                            hora: dev.hora || '',
                            clientName,
                            obraName,
                            items: [{
                                nombre: item.nombre || product?.name || item.productId || 'Equipo',
                                cantidad: Number(dev.cantidad) || 0,
                                servicio: false
                            }]
                        });
                    });
                });
            });

        return result.sort((a, b) => {
            const aKey = `${a.fecha || ''}T${a.hora || '00:00'}`;
            const bKey = `${b.fecha || ''}T${b.hora || '00:00'}`;
            return bKey.localeCompare(aKey);
        });
    }, [remisiones, clients, products]);

    const filtrados = useMemo(() => {
        const query = search.trim().toLowerCase();
        return eventos.filter(evento => {
            if (tipo !== 'todos' && evento.tipo !== tipo) return false;
            if (!query) return true;
            const haystack = [
                evento.remId,
                normalizarRemision(evento.remId),
                evento.clientName,
                evento.obraName,
                ...evento.items.map(item => item.nombre)
            ].join(' ').toLowerCase();
            return haystack.includes(query);
        });
    }, [eventos, tipo, search]);

    const salidas = eventos.filter(e => e.tipo === 'salida').length;
    const entradas = eventos.filter(e => e.tipo === 'entrada').length;

    return (
        <div className={embedded ? '' : 'page-animate'}>
            {!embedded && (
                <div style={{ marginBottom: '1.25rem' }}>
                    <h2 style={{ color: '#104166', margin: 0 }}>Trazabilidad logística</h2>
                    <p style={{ color: '#64748b', margin: '0.35rem 0 0' }}>Registro de entradas y salidas asociado a cada remisión.</p>
                </div>
            )}

            <div className="trace-summary-grid">
                <div className="trace-summary-card">
                    <ArrowUpFromLine size={22} color="#ea580c" />
                    <div><strong>{salidas}</strong><span>Remisiones de despacho</span></div>
                </div>
                <div className="trace-summary-card">
                    <ArrowDownToLine size={22} color="#059669" />
                    <div><strong>{entradas}</strong><span>Registros de devolución</span></div>
                </div>
                <div className="trace-summary-card">
                    <Activity size={22} color="#2365AB" />
                    <div><strong>{eventos.length}</strong><span>Movimientos trazados</span></div>
                </div>
            </div>

            <div className="glass-panel" style={{ padding: '1rem', marginBottom: '1rem' }}>
                <div className="trace-filter-row">
                    <div style={{ position: 'relative', flex: 1, minWidth: 220 }}>
                        <Search size={16} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }} />
                        <input
                            value={search}
                            onChange={e => setSearch(e.target.value)}
                            placeholder="Buscar cliente, obra, #REM o equipo…"
                            style={{ width: '100%', boxSizing: 'border-box', padding: '0.65rem 0.8rem 0.65rem 2.25rem', border: '1px solid #cbd5e1', borderRadius: 9, background: '#fff', color: '#1e293b' }}
                        />
                    </div>
                    <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap' }}>
                        {[
                            ['todos', 'Todos'],
                            ['salida', 'Salidas'],
                            ['entrada', 'Entradas']
                        ].map(([value, label]) => (
                            <button
                                key={value}
                                type="button"
                                onClick={() => setTipo(value)}
                                style={{ padding: '0.55rem 0.8rem', borderRadius: 8, border: tipo === value ? '1px solid #2365AB' : '1px solid #cbd5e1', background: tipo === value ? '#eff6ff' : '#fff', color: tipo === value ? '#2365AB' : '#64748b', fontWeight: 800, cursor: 'pointer' }}
                            >
                                {label}
                            </button>
                        ))}
                    </div>
                </div>
            </div>

            <div className="glass-panel" style={{ padding: '1rem' }}>
                {filtrados.length === 0 ? (
                    <div style={{ padding: '3rem 1rem', textAlign: 'center', color: '#94a3b8' }}>
                        <Package size={36} style={{ marginBottom: '0.75rem' }} />
                        <div style={{ fontWeight: 700 }}>No hay movimientos para los filtros seleccionados.</div>
                    </div>
                ) : (
                    <div style={{ display: 'grid', gap: '0.75rem' }}>
                        {filtrados.map(evento => {
                            const entrada = evento.tipo === 'entrada';
                            const Icon = entrada ? ArrowDownToLine : ArrowUpFromLine;
                            const color = entrada ? '#059669' : '#ea580c';
                            const bg = entrada ? '#ecfdf5' : '#fff7ed';
                            return (
                                <article key={evento.id} className="trace-event-card" style={{ borderLeft: `4px solid ${color}` }}>
                                    <div className="trace-event-icon" style={{ color, background: bg }}><Icon size={20} /></div>
                                    <div style={{ minWidth: 0, flex: 1 }}>
                                        <div className="trace-event-title-row">
                                            <div>
                                                <span style={{ color, fontWeight: 900, fontSize: '0.72rem', textTransform: 'uppercase', letterSpacing: '0.06em' }}>{entrada ? 'Entrada / Devolución' : 'Salida / Despacho'}</span>
                                                <h3 style={{ margin: '0.15rem 0 0', color: '#104166', fontSize: '1rem' }}>{normalizarRemision(evento.remId)}</h3>
                                            </div>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: '#64748b', fontSize: '0.78rem', whiteSpace: 'nowrap' }}>
                                                <Clock size={14} /> {fechaLegible(evento.fecha)} {evento.hora && `· ${evento.hora}`}
                                            </div>
                                        </div>
                                        <div className="trace-event-meta">
                                            <span><UserRound size={14} /> {evento.clientName}</span>
                                            <span><Briefcase size={14} /> {evento.obraName}</span>
                                        </div>
                                        <div className="trace-item-list">
                                            {evento.items.map((item, index) => (
                                                <span key={`${item.nombre}-${index}`}>
                                                    {item.nombre} <b>{item.servicio ? 'Servicio' : `${item.cantidad} und.`}</b>
                                                </span>
                                            ))}
                                        </div>
                                    </div>
                                </article>
                            );
                        })}
                    </div>
                )}
            </div>

            {!embedded && logs.length > 0 && (
                <p style={{ marginTop: '1rem', color: '#94a3b8', fontSize: '0.78rem', textAlign: 'right' }}>
                    Auditoría adicional del sistema disponible: {logs.length} registro(s).
                </p>
            )}
        </div>
    );
}
