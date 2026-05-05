import React from 'react';
import Cotizaciones from './Cotizaciones';

export default function Comercial() {
    return (
        <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
            <div style={{ flex: 1 }}>
                <Cotizaciones hideHeader={true} />
            </div>
        </div>
    );
}
