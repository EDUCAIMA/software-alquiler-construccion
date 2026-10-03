export const isRemisionServiceProduct = (product = {}) => {
    const descriptor = [product.category, product.tipoCobro, product.esquemaCobro, product.nombre, product.name]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();
    return ['servicio', 'servio ', 'única vez', 'unica vez', 'transporte', 'entrega', 'recogida',
        'flete', 'acarreo', 'mano de obra', 'armado', 'desarmado', 'depósito', 'deposito', 'cargo por']
        .some(term => descriptor.includes(term));
};
