import React, { useMemo, useState } from 'react';
import { ChevronDown, Package, Search, Wrench } from 'lucide-react';
import { isRemisionServiceProduct } from './remisionUtils';
import './RemisionProductPicker.css';

export default function RemisionProductPicker({ products = [], value, onChange }) {
    const selectedProduct = products.find(product => product.id === value);
    const [query, setQuery] = useState(selectedProduct?.name || '');
    const [open, setOpen] = useState(false);
    const [highlightedIndex, setHighlightedIndex] = useState(0);

    const eligibleProducts = useMemo(() => products.filter(product =>
        product.estado !== 'Dado de baja' && (isRemisionServiceProduct(product) || Number(product.availableStock) > 0)
    ), [products]);

    const filteredProducts = useMemo(() => {
        const normalized = query.trim().toLocaleLowerCase('es');
        if (!normalized || selectedProduct?.name === query) return eligibleProducts;
        return eligibleProducts.filter(product => [product.name, product.id, product.category, product.tipoCobro]
            .filter(Boolean)
            .some(field => String(field).toLocaleLowerCase('es').includes(normalized))
        );
    }, [eligibleProducts, query, selectedProduct?.name]);

    const selectProduct = product => {
        onChange(product.id);
        setQuery(product.name);
        setOpen(false);
    };

    const handleKeyDown = event => {
        if (event.key === 'ArrowDown') {
            event.preventDefault();
            setOpen(true);
            setHighlightedIndex(current => Math.min(current + 1, filteredProducts.length - 1));
        } else if (event.key === 'ArrowUp') {
            event.preventDefault();
            setHighlightedIndex(current => Math.max(current - 1, 0));
        } else if (event.key === 'Enter' && open && filteredProducts[highlightedIndex]) {
            event.preventDefault();
            selectProduct(filteredProducts[highlightedIndex]);
        } else if (event.key === 'Escape') {
            setOpen(false);
        }
    };

    return (
        <div className="remision-product-picker">
            <div className={`remision-product-picker__control${open ? ' is-open' : ''}`}>
                <Search size={16} aria-hidden="true" />
                <input
                    type="text"
                    value={query}
                    placeholder="Escriba el nombre o código..."
                    autoComplete="off"
                    role="combobox"
                    aria-expanded={open}
                    aria-controls="remision-product-results"
                    onFocus={() => setOpen(true)}
                    onBlur={() => window.setTimeout(() => setOpen(false), 150)}
                    onKeyDown={handleKeyDown}
                    onChange={event => {
                        setQuery(event.target.value);
                        setHighlightedIndex(0);
                        onChange('');
                        setOpen(true);
                    }}
                />
                <ChevronDown size={16} aria-hidden="true" />
            </div>

            {open && (
                <div id="remision-product-results" className="remision-product-picker__menu" role="listbox">
                    {filteredProducts.length > 0 ? filteredProducts.map((product, index) => {
                        const service = isRemisionServiceProduct(product);
                        return (
                            <button
                                type="button"
                                role="option"
                                aria-selected={value === product.id}
                                key={product.id}
                                className={`remision-product-picker__option${index === highlightedIndex ? ' is-highlighted' : ''}${value === product.id ? ' is-selected' : ''}`}
                                onMouseDown={event => event.preventDefault()}
                                onMouseEnter={() => setHighlightedIndex(index)}
                                onClick={() => selectProduct(product)}
                            >
                                <span className={`remision-product-picker__icon${service ? ' is-service' : ''}`}>{service ? <Wrench size={16} /> : <Package size={16} />}</span>
                                <span className="remision-product-picker__description"><strong>{product.name}</strong><small>{product.id}{product.category ? ` · ${product.category}` : ''}</small></span>
                                <span className="remision-product-picker__meta">
                                    <strong>${Number(product.value || 0).toLocaleString('es-CO')}</strong>
                                    <small className={service ? 'is-service' : ''}>{service ? 'Servicio' : `${product.availableStock} disponibles`}</small>
                                </span>
                            </button>
                        );
                    }) : (
                        <div className="remision-product-picker__empty"><Search size={20} /><strong>Sin resultados</strong><span>Intente con otro nombre o código.</span></div>
                    )}
                </div>
            )}
        </div>
    );
}
