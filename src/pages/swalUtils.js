import Swal from 'sweetalert2';

const TOP_LAYER_Z_INDEX = '2147483647';

/**
 * Muestra una alerta por encima de cualquier modal de la aplicación.
 * El z-index se aplica directamente al contenedor creado por SweetAlert para
 * no depender del orden de carga de las hojas de estilo ni de su caché.
 */
export const fireAboveModal = (options) => {
    const originalDidOpen = options?.didOpen;

    return Swal.fire({
        ...options,
        target: document.body,
        didOpen: popup => {
            const container = Swal.getContainer();
            if (container) {
                container.style.setProperty('z-index', TOP_LAYER_Z_INDEX, 'important');
            }
            originalDidOpen?.(popup);
        }
    });
};
