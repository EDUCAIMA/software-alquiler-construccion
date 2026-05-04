import React, { useState, useEffect } from 'react';
import Cotizaciones from './Cotizaciones';
import Remisiones from './Remisiones';
import { useLocation } from 'react-router-dom';
import { FileText, Truck } from 'lucide-react';

export default function Comercial() {
    const [activeTab, setActiveTab] = useState('cotizaciones');
    const location = useLocation();

    // Manejar el tab por URL query (?tab=despachos)
    useEffect(() => {
        const params = new URLSearchParams(location.search);
        const tab = params.get('tab');
        if (tab === 'despachos') setActiveTab('remisiones');
        else if (tab === 'cotizaciones') setActiveTab('cotizaciones');
    }, [location.search]);

    const tabStyle = (isActive) => ({
        padding: '0.75rem 1.5rem',
        cursor: 'pointer',
        fontSize: '0.9rem',
        fontWeight: 700,
        color: isActive ? '#2365AB' : '#64748b',
        borderBottom: isActive ? '3px solid #2365AB' : '3px solid transparent',
        transition: 'all 0.2s ease',
        display: 'flex',
        alignItems: 'center',
        gap: '8px',
        background: 'none',
        border: 'none',
        outline: 'none'
    });

    return (
        <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
            {/* Tab Bar interna */}
            <div style={{ 
                display: 'flex', 
                gap: '1rem', 
                borderBottom: '1px solid #e2e8f0', 
                marginBottom: '1rem',
                background: 'white',
                padding: '0 1rem',
                borderRadius: '12px 12px 0 0'
            }}>
                <button 
                    style={tabStyle(activeTab === 'cotizaciones')} 
                    onClick={() => setActiveTab('cotizaciones')}
                >
                    <FileText size={18} /> Cotizaciones y Facturas
                </button>
                <button 
                    style={tabStyle(activeTab === 'remisiones')} 
                    onClick={() => setActiveTab('remisiones')}
                >
                    <Truck size={18} /> Remisiones / Despachos
                </button>
            </div>

            <div style={{ flex: 1 }}>
                {activeTab === 'cotizaciones' ? (
                    <Cotizaciones hideHeader={true} />
                ) : (
                    <Remisiones />
                )}
            </div>
        </div>
    );
}
