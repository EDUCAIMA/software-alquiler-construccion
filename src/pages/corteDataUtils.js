// Los campos JSON antiguos pueden llegar serializados. Una colección ilegible
// se distingue de una vacía para no inventar cobertura ni abonos disponibles.
export function readCorteRecords(value) {
    if (value === undefined || value === null || value === '') return [];
    let records = value;
    if (typeof records === 'string') {
        try { records = JSON.parse(records); } catch { return null; }
    }
    return Array.isArray(records) && records.every(record =>
        record !== null && typeof record === 'object' && !Array.isArray(record)
    ) ? records : null;
}

export function requireCorteRecords(value, label) {
    const records = readCorteRecords(value);
    if (records === null) throw new Error(`No se pueden leer ${label}. Revisa la información del cliente antes de generar el corte.`);
    return records;
}
