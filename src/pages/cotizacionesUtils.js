// Utilidades puras sin dependencias de React ni de otros módulos
export const fmtCOP = n => `$${(Number(n) || 0).toLocaleString('es-CO')}`;

/**
 * Calcula las horas transcurridas entre una hora/fecha de inicio y una hora/fecha de fin.
 * @param {string} horaInicio - Formato "HH:mm" (ej. "08:00")
 * @param {string} horaFin - Formato "HH:mm" (ej. "14:30")
 * @param {string} [fechaInicio] - Formato "YYYY-MM-DD"
 * @param {string} [fechaFin] - Formato "YYYY-MM-DD"
 * @returns {number} Número de horas transcurridas
 */
export function calcularHorasAlquiler(horaInicio, horaFin, fechaInicio, fechaFin) {
    if (!horaInicio || !horaFin) return 0;
    
    const fInicio = fechaInicio || '2000-01-01';
    const fFin = fechaFin || fInicio;
    
    const start = new Date(`${fInicio}T${horaInicio}:00`);
    const end = new Date(`${fFin}T${horaFin}:00`);
    
    if (isNaN(start.getTime()) || isNaN(end.getTime())) return 0;
    
    let diffMs = end.getTime() - start.getTime();
    
    // Si la horaFin es menor que horaInicio en el mismo día, asumimos que cruza la medianoche (ej: 22:00 a 06:00)
    if (diffMs < 0 && (!fechaInicio || !fechaFin || fechaInicio === fechaFin)) {
        diffMs += 24 * 60 * 60 * 1000;
    }
    
    if (diffMs <= 0) return 0;
    
    const diffHours = diffMs / (1000 * 60 * 60);
    return Math.round(diffHours * 100) / 100;
}

/**
 * Calcula la hora final (HH:mm) dada una hora inicial (HH:mm) y un número de horas.
 * @param {string} horaInicio - Formato "HH:mm" (ej. "08:00")
 * @param {number|string} horas - Número de horas (ej. 5 o 4.5)
 * @returns {string} Formato "HH:mm" (ej. "13:30")
 */
export function calcularHoraFin(horaInicio, horas) {
    if (!horaInicio || !horas || Number(horas) <= 0) return '';
    const [hStr, mStr] = horaInicio.split(':');
    const h = parseInt(hStr, 10);
    const m = parseInt(mStr, 10);
    if (isNaN(h) || isNaN(m)) return '';
    
    const totalMinutes = h * 60 + m + Math.round(Number(horas) * 60);
    const finalMinutes = (totalMinutes % (24 * 60) + (24 * 60)) % (24 * 60);
    
    const outH = Math.floor(finalMinutes / 60);
    const outM = finalMinutes % 60;
    
    const pad = n => n.toString().padStart(2, '0');
    return `${pad(outH)}:${pad(outM)}`;
}

