import { eachDayOfInterval, isSunday, isSaturday, parseISO } from 'date-fns';

/**
 * Normaliza cualquier fecha a formato YYYY-MM-DD
 */
export const toDateString = (date) => {
    if (!date) return '';
    if (typeof date === 'string') return date.split('T')[0];
    if (date instanceof Date) return date.toISOString().split('T')[0];
    return String(date);
};

/**
 * Calcula los días facturables/liquidables según el esquema de cobro pactado.
 * @param {string|Date} startDate - Fecha inicio
 * @param {string|Date} endDate - Fecha fin
 * @param {string} scheme - 'Calendario', 'Lunes-Sábado', 'Lunes-Viernes', 'Única Vez'
 * @returns {number} Número de días
 */
export const calcularDiasSubarriendo = (startDate, endDate, scheme = 'Calendario') => {
    try {
        if (!startDate || !endDate) return 1;
        const start = typeof startDate === 'string' ? parseISO(startDate.split('T')[0]) : startDate;
        const end = typeof endDate === 'string' ? parseISO(endDate.split('T')[0]) : endDate;

        if (start > end) return 1;

        if (scheme === 'Única Vez') return 1;

        const days = eachDayOfInterval({ start, end });
        let count = 0;

        days.forEach(d => {
            let isBillable = true;
            if (isSunday(d)) {
                if (scheme === 'Lunes-Sábado' || scheme === 'Lunes-Viernes') isBillable = false;
            } else if (isSaturday(d)) {
                if (scheme === 'Lunes-Viernes') isBillable = false;
            }
            if (isBillable) count++;
        });

        return Math.max(1, count);
    } catch (e) {
        return 1;
    }
};

/**
 * Calcula el costo a pagar a un proveedor por un equipo subarrendado
 * @param {Object} params
 * @param {number} params.cantidad
 * @param {number} params.tarifaCosto
 * @param {string} params.tipoCobro - 'Día', 'Hora', 'Servicio'
 * @param {string} params.esquemaCobro - 'Calendario', 'Lunes-Sábado', 'Lunes-Viernes', 'Única Vez'
 * @param {string} params.fechaInicio
 * @param {string} params.fechaFin
 * @param {number} [params.horas]
 * @returns {{ diasCobrados: number, montoTotal: number }}
 */
export const calcularCostoSubarriendo = ({
    cantidad = 1,
    tarifaCosto = 0,
    tipoCobro = 'Día',
    esquemaCobro = 'Calendario',
    fechaInicio,
    fechaFin,
    horas = 0
}) => {
    const cant = Math.max(1, Number(cantidad) || 1);
    const tarifa = Number(tarifaCosto) || 0;
    const tipo = (tipoCobro || 'Día').toLowerCase();

    if (tipo.includes('servicio') || (esquemaCobro || '').toLowerCase().includes('única')) {
        return {
            diasCobrados: 1,
            montoTotal: cant * tarifa
        };
    }

    if (tipo.includes('hora')) {
        const h = Math.max(1, Number(horas) || 1);
        return {
            diasCobrados: h,
            montoTotal: cant * h * tarifa
        };
    }

    // Por días
    const dias = calcularDiasSubarriendo(fechaInicio, fechaFin || fechaInicio, esquemaCobro);
    return {
        diasCobrados: dias,
        montoTotal: cant * dias * tarifa
    };
};
