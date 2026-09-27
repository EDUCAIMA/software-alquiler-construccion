import React from 'react';
import { useSearchParams } from 'react-router-dom';
import { FileText, Truck, Activity } from 'lucide-react';
import Cotizaciones from './Cotizaciones';
import Remisiones from './Remisiones';
import Trazability from './Trazability';

const VALID_TABS = new Set(['cotizaciones', 'despachos', 'trazabilidad']);

export default function Comercial() {
    const [searchParams, setSearchParams] = useSearchParams();
    const requestedTab = searchParams.get('tab') || 'cotizaciones';
    const activeTab = VALID_TABS.has(requestedTab) ? requestedTab : 'cotizaciones';

    const setTab = (tab) => setSearchParams(tab === 'cotizaciones' ? {} : { tab });

    const tabs = [
        { id: 'cotizaciones', label: 'Cotizaciones', icon: FileText },
        { id: 'despachos', label: 'Despachos y devoluciones', icon: Truck },
        { id: 'trazabilidad', label: 'Trazabilidad', icon: Activity }
    ];

    return (
        <div className="page-animate commercial-shell">
            <div className="commercial-tabs" role="tablist" aria-label="Secciones del módulo comercial">
                {tabs.map(tab => {
                    const Icon = tab.icon;
                    const active = tab.id === activeTab;
                    return (
                        <button
                            key={tab.id}
                            type="button"
                            role="tab"
                            aria-selected={active}
                            onClick={() => setTab(tab.id)}
                            className={active ? 'commercial-tab active' : 'commercial-tab'}
                        >
                            <Icon size={17} /> {tab.label}
                        </button>
                    );
                })}
            </div>

            <div className="commercial-content">
                {activeTab === 'cotizaciones' && <Cotizaciones hideHeader />}
                {activeTab === 'despachos' && <Remisiones />}
                {activeTab === 'trazabilidad' && <Trazability embedded />}
            </div>
        </div>
    );
}
