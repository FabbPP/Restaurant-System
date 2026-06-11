/** @jest-environment jsdom */
const controllers = require('../js/controllers');
const stateManager = require('../js/state');
const validation = require('../js/validation');
const ui = require('../js/ui');
const config = require('../js/config');
const utils = require('../js/utils');

// Mock de funciones de stateManager
jest.mock('../js/state', () => ({
  state: {
    mesas: [],
    meseros: [],
    productos: [],
    ordenes: [],
    editingMesaId: null,
    editingMeseroId: null,
    editingProductoId: null,
    currentOrderIdForItems: null,
    currentOrderIdForBilling: null,
    currentOrderTotalCents: 0,
  },
  saveItem: jest.fn(() => Promise.resolve()),
  initState: jest.fn(),
  getNextMesaId: jest.fn(() => 'M01'),
  getNextMesaNumero: jest.fn(() => 1),
  getNextMeseroId: jest.fn(() => 'W01'),
  getNextProductoId: jest.fn(() => 'P01'),
  getNextOrderId: jest.fn(() => 'O-001'),
  calculateOrderTotals: jest.fn(() => ({ subtotalCents: 1000, packagingFeeCents: 0, totalCents: 1000 })),
  getActiveOrdersByMesaId: jest.fn(() => []),
  getOrdenesActivas: jest.fn(() => []),
  getHistorialVentas: jest.fn(() => []),
}));

// Mock de funciones de validación
jest.mock('../js/validation', () => ({
  ValidationError: class extends Error {
    constructor(errors) {
      super(errors.join('\n'));
      this.name = 'ValidationError';
      this.errors = errors;
    }
  },
  validateMesa: jest.fn(),
  validateMesero: jest.fn(),
  validateProducto: jest.fn(),
  validateOrden: jest.fn(),
  validateOrdenItem: jest.fn(),
}));

// Mock de funciones y elementos de la interfaz de usuario (UI)
jest.mock('../js/ui', () => {
  const mockEls = new Proxy({}, {
    get: (target, prop) => {
      if (!target[prop]) {
        const listeners = {};
        target[prop] = {
          value: '',
          textContent: '',
          innerHTML: '',
          classList: { add: jest.fn(), remove: jest.fn(), contains: jest.fn(() => false) },
          style: { display: '' },
          addEventListener: jest.fn((type, cb) => {
            listeners[type] = cb;
          }),
          dispatchEvent: jest.fn(async (event) => {
            if (listeners[event.type]) {
              await listeners[event.type](event);
            }
            return true;
          }),
          removeEventListener: jest.fn(),
          querySelector: jest.fn(() => ({
            value: '',
            textContent: '',
            classList: { add: jest.fn(), remove: jest.fn() },
            focus: jest.fn(),
            addEventListener: jest.fn(),
          })),
          querySelectorAll: jest.fn(() => []), // Array vacío por defecto
          focus: jest.fn(),
          reset: jest.fn(),
        };
      }
      return target[prop];
    },
    set: (target, prop, value) => {
      target[prop] = value;
      return true;
    }
  });

  return {
    els: mockEls,
    renderAll: jest.fn(),
    renderMesas: jest.fn(),
    renderMeseros: jest.fn(),
    renderProductos: jest.fn(),
    renderOrdenes: jest.fn(),
    renderHistoryTable: jest.fn(),
    clearErrors: jest.fn(),
    displayFieldErrors: jest.fn(),
    setFormDisabled: jest.fn(),
    resetMesaForm: jest.fn(),
    resetMeseroForm: jest.fn(),
    resetProductoForm: jest.fn(),
    resetOrdenForm: jest.fn(),
    resetBillingForm: jest.fn(),
    openBillingModal: jest.fn(),
    closeItemsModal: jest.fn(),
    closeBillingModal: jest.fn(),
    openItemsModal: jest.fn(),
    updateOrderTypeFields: jest.fn(),
    createItemRow: jest.fn(),
  };
});

// Mock de funciones de utilidades
jest.mock('../js/utils', () => ({
  normalizeText: jest.fn(value => String(value || '').trim()),
  normalizeId: jest.fn(value => String(value || '').trim().toUpperCase()),
  isId: jest.fn(() => true),
  isStrictAlphaText: jest.fn(() => true),
  isDigits: jest.fn(() => true),
  isValidPrice: jest.fn(() => true),
  formatPrice: jest.fn(value => Number(value).toFixed(2)),
  formatCents: jest.fn(cents => (cents / 100).toFixed(2)),
  parsePriceToCents: jest.fn(value => Math.round(parseFloat(value) * 100)),
  isValidNameLength: jest.fn(() => true),
  formatOrderType: jest.fn(value => String(value || '').replace(/_/g, ' ')),
  normalizeOrderType: jest.fn(value => String(value || '').trim().toUpperCase().replace(/\s+/g, '_')),
}));

// Mock de configuración
jest.mock('../js/config', () => ({
  STORAGE_KEYS: {
    mesas: "mesas",
    meseros: "meseros",
    ordenes: "ordenes",
productos: "productos",
  },
  ORDER_TYPES: {
    MESA: "MESA",
    PARA_LLEVAR: "PARA_LLEVAR",
  },
  ORDER_STATES: ["PENDIENTE", "EN COCINA", "LISTO", "PAGADO"],
  PACKAGING_FEE_CENTS: 40
}));

// Crear un mock persistente para elementos fuera de ui.els
const mockHistoryOverlay = { addEventListener: jest.fn() };
const mockTabPanels = [{ classList: { add: jest.fn(), remove: jest.fn() }, dataset: { tab: 'dashboard' } }, { classList: { add: jest.fn(), remove: jest.fn() }, dataset: { tab: 'catalogo' } }];

// Mock de document.querySelectorAll para botones de pestañas y otros elementos globales
const mockTabButton = {
  dataset: { tab: 'dashboard' },
  classList: { add: jest.fn(), remove: jest.fn(), contains: jest.fn(() => false) },
  addEventListener: jest.fn(),
};
const mockTabButton2 = {
  dataset: { tab: 'catalogo' },
  classList: { add: jest.fn(), remove: jest.fn(), contains: jest.fn(() => false) },
  addEventListener: jest.fn(),
};
document.querySelectorAll = jest.fn((selector) => {
  if (selector === '.tab-button') {
    return [mockTabButton, mockTabButton2];
  }
  if (selector === '.tab-panel') {
    return mockTabPanels;
  }
  return [];
});
document.getElementById = jest.fn((id) => {
  if (id === 'history-modal-overlay') {
    return mockHistoryOverlay;
  }
  return ui.els[id];
});

describe('Pruebas de controllers.js', () => {
  let mockEvent;

  beforeEach(() => {
    // Reiniciar todos los mocks antes de cada prueba
    jest.clearAllMocks();

    // Reiniciar el estado del administrador de estado
    stateManager.state.mesas = [];
    stateManager.state.meseros = [];
    stateManager.state.productos = [];
    stateManager.state.ordenes = [];
    stateManager.state.editingMesaId = null;
    stateManager.state.editingMeseroId = null;
    stateManager.state.editingProductoId = null;
    stateManager.state.currentOrderIdForItems = null;
    stateManager.state.currentOrderIdForBilling = null;
    stateManager.state.currentOrderTotalCents = 0;

    // Mock de un objeto de evento genérico
    mockEvent = {
      preventDefault: jest.fn(),
      target: {
        dataset: {},
        value: '',
        checked: false,
      },
    };

    // Mock de window.alert
    window.alert = jest.fn();

    // Asegurar que ui.els tenga las propiedades necesarias para los formularios
    ui.els.mesaIdInput.value = 'M01';
    ui.els.mesaNumeroInput.value = '1';
    ui.els.mesaCapacidadInput.value = '4';
    ui.els.mesaEstadoInput.value = 'LIBRE';
    ui.els.mesaForm.querySelector.mockReturnValue({ textContent: 'Guardar Mesa' });

    ui.els.meseroIdInput.value = 'W01';
    ui.els.meseroNombreInput.value = 'Juan Perez';
    ui.els.meseroDniInput.value = '12345678';
    ui.els.meseroCelularInput.value = '987654321';
    ui.els.meseroEstadoInput.value = 'ACTIVO';
    ui.els.meseroForm.querySelector.mockReturnValue({ textContent: 'Guardar Mesero' });

    ui.els.productoIdInput.value = 'P01';
    ui.els.productoNombreInput.value = 'Producto de Prueba';
    ui.els.productoPrecioInput.value = '10.00';
    ui.els.productoDisponibilidadInput.value = 'true';
    ui.els.productoEstadoInput.value = 'true';
    ui.els.productoDescripcionInput.value = 'Descripción de Prueba';
    ui.els.productoForm.querySelector.mockReturnValue({ textContent: 'Guardar Producto' });

    ui.els.ordenIdInput.value = 'O-001';
    ui.els.ordenTipoInput.value = 'MESA';
    ui.els.ordenMesaInput.value = 'M01';
    ui.els.ordenMeseroInput.value = 'W01';
    ui.els.ordenClienteInput.value = '';

    ui.els.billingReceivedAmount.value = '0.00';
    ui.els.billingChangeAmount.textContent = 'S/ 0.00';
    ui.els.billingChangeAmount.className = 'font-display text-on-surface-variant';

    // Mock de confirm para acciones de eliminación
    window.confirm = jest.fn(() => true);
  });

  describe('Función handleMesaSubmit', () => {
    test('debe agregar una nueva mesa exitosamente', async () => {
      await controllers.handleMesaSubmit(mockEvent);

      expect(mockEvent.preventDefault).toHaveBeenCalled();
      expect(ui.clearErrors).toHaveBeenCalled();
      expect(validation.validateMesa).toHaveBeenCalledWith(stateManager.state, {
        id: 'M01',
        numero: 1,
        capacidad: 4,
        estado: 'LIBRE',
      });
      expect(stateManager.saveItem).toHaveBeenCalledWith(
        config.STORAGE_KEYS.mesas,
        { id: 'M01', numero: 1, capacidad: 4, estado: 'LIBRE', activo: true },
        false
      );
      expect(ui.resetMesaForm).toHaveBeenCalled();
      expect(ui.renderMesas).toHaveBeenCalled();
    });

    test('debe actualizar una mesa existente exitosamente', async () => {
      stateManager.state.editingMesaId = 'M01';
      stateManager.state.mesas = [{ id: 'M01', numero: 1, capacidad: 4, estado: 'LIBRE', activo: true }];
      ui.els.mesaCapacidadInput.value = '6';
      ui.els.mesaEstadoInput.value = 'OCUPADA';

      await controllers.handleMesaSubmit(mockEvent);

      expect(mockEvent.preventDefault).toHaveBeenCalled();
      expect(ui.clearErrors).toHaveBeenCalled();
      expect(validation.validateMesa).toHaveBeenCalledWith(stateManager.state, {
        id: 'M01',
        numero: 1,
        capacidad: 6,
        estado: 'OCUPADA',
      });
      expect(stateManager.saveItem).toHaveBeenCalledWith(
        config.STORAGE_KEYS.mesas,
        { id: 'M01', numero: 1, capacidad: 6, estado: 'OCUPADA', activo: true },
        true
      );
      expect(ui.resetMesaForm).toHaveBeenCalled();
      expect(ui.renderMesas).toHaveBeenCalled();
    });

    test('debe mostrar errores de validación para una entrada de mesa inválida', async () => {
      const errors = ['El ID es obligatorio.'];
      validation.validateMesa.mockImplementationOnce(() => {
        throw new validation.ValidationError(errors);
      });

      await controllers.handleMesaSubmit(mockEvent);

      expect(mockEvent.preventDefault).toHaveBeenCalled();
      expect(ui.clearErrors).toHaveBeenCalled();
      expect(validation.validateMesa).toHaveBeenCalled();
      expect(ui.displayFieldErrors).toHaveBeenCalledWith(errors, expect.any(Object));
      expect(stateManager.saveItem).not.toHaveBeenCalled();
      expect(ui.resetMesaForm).not.toHaveBeenCalled();
      expect(ui.renderMesas).not.toHaveBeenCalled();
    });
  });

  describe('Función handleMeseroSubmit', () => {
    test('debe agregar un nuevo mesero exitosamente', async () => {
      await controllers.handleMeseroSubmit(mockEvent);

      expect(mockEvent.preventDefault).toHaveBeenCalled();
      expect(ui.clearErrors).toHaveBeenCalled();
      expect(validation.validateMesero).toHaveBeenCalledWith(stateManager.state, {
        id: 'W01',
        nombre: 'Juan Perez',
        dni: '12345678',
        celular: '987654321',
        estado: 'ACTIVO',
      });
      expect(stateManager.saveItem).toHaveBeenCalledWith(
        config.STORAGE_KEYS.meseros,
        { id: 'W01', nombre: 'Juan Perez', dni: '12345678', celular: '987654321', estado: 'ACTIVO', activo: true },
        false
      );
      expect(ui.resetMeseroForm).toHaveBeenCalled();
      expect(ui.renderMeseros).toHaveBeenCalled();
    });

    test('debe mostrar errores de validación para una entrada de mesero inválida', async () => {
      const errors = ['El nombre es obligatorio.'];
      validation.validateMesero.mockImplementationOnce(() => {
        throw new validation.ValidationError(errors);
      });

      await controllers.handleMeseroSubmit(mockEvent);

      expect(ui.displayFieldErrors).toHaveBeenCalledWith(errors, expect.any(Object));
    });
  });

  describe('Función handleProductoSubmit', () => {
    test('debe agregar un nuevo producto exitosamente', async () => {
      await controllers.handleProductoSubmit(mockEvent);

      expect(mockEvent.preventDefault).toHaveBeenCalled();
      expect(ui.clearErrors).toHaveBeenCalled();
      expect(validation.validateProducto).toHaveBeenCalledWith(stateManager.state, {
        id: 'P01',
        nombre: 'Producto de Prueba',
        precio: '10.00',
        disponibilidad: true,
        estado: true,
        descripcion: 'Descripción de Prueba',
      });
      expect(stateManager.saveItem).toHaveBeenCalledWith(
        config.STORAGE_KEYS.productos,
        {
          id: 'P01',
          nombre: 'Producto de Prueba',
          precio: '10.00',
          disponibilidad: true,
          estado: true,
          descripcion: 'Descripción de Prueba',
          activo: true,
        },
        false
      );
      expect(ui.resetProductoForm).toHaveBeenCalled();
      expect(ui.renderProductos).toHaveBeenCalled();
    });

    test('debe mostrar errores de validación para una entrada de producto inválida', async () => {
      const errors = ['El precio es obligatorio.'];
      validation.validateProducto.mockImplementationOnce(() => {
        throw new validation.ValidationError(errors);
      });

      await controllers.handleProductoSubmit(mockEvent);

      expect(ui.displayFieldErrors).toHaveBeenCalledWith(errors, expect.any(Object));
    });
  });

  describe('Función handleOrdenSubmit', () => {
    test('debe crear una nueva orden exitosamente', async () => {
      stateManager.initState.mockResolvedValueOnce({}); // Mock de initState para resolver

      await controllers.handleOrdenSubmit(mockEvent);

      expect(mockEvent.preventDefault).toHaveBeenCalled();
      expect(ui.clearErrors).toHaveBeenCalled();
      expect(validation.validateOrden).toHaveBeenCalledWith(stateManager.state, {
        id: 'O-001',
        tipo: 'MESA',
        mesaId: 'M01',
        meseroId: 'W01',
        cliente: '',
      });
      expect(stateManager.saveItem).toHaveBeenCalledWith(
        config.STORAGE_KEYS.ordenes,
        { id: 'O-001', tipo: 'MESA', mesaId: 'M01', meseroId: 'W01', cliente: '', estado: 'PENDIENTE', items: [] },
        false
      );
      expect(stateManager.initState).toHaveBeenCalled();
      expect(ui.resetOrdenForm).toHaveBeenCalled();
      expect(ui.renderAll).toHaveBeenCalled();
    });

    test('debe mostrar errores de validación para una entrada de orden inválida', async () => {
      const errors = ['Debe seleccionar una mesa.'];
      validation.validateOrden.mockImplementationOnce(() => {
        throw new validation.ValidationError(errors);
      });

      await controllers.handleOrdenSubmit(mockEvent);

      expect(ui.displayFieldErrors).toHaveBeenCalledWith(errors, expect.any(Object));
      expect(stateManager.initState).not.toHaveBeenCalled();
    });
  });

  describe('Función handleOrdenItemSubmit', () => {
    beforeEach(() => {
      stateManager.state.currentOrderIdForItems = 'O-001';
      stateManager.state.ordenes = [{ id: 'O-001', items: [], estado: 'PENDIENTE' }];
      stateManager.state.productos = [{ id: 'P01', nombre: 'Gaseosa', precio: '5.00', activo: true, disponibilidad: true }];

      // Mock de querySelectorAll para las filas de ítems
      ui.els.ordenItemsContainer.querySelectorAll.mockReturnValue([
        {
          querySelector: jest.fn((selector) => {
            if (selector === '.product-select') return { value: 'P01' };
            if (selector === '.qty-input') return { value: '2' };
            return null;
          }),
        },
      ]);
    });

    test('debe agregar ítems a una orden exitosamente', async () => {
      await controllers.handleOrdenItemSubmit(mockEvent);

      expect(mockEvent.preventDefault).toHaveBeenCalled();
      expect(ui.clearErrors).toHaveBeenCalled();
      expect(stateManager.saveItem).toHaveBeenCalledWith(
        config.STORAGE_KEYS.ordenes,
        {
          id: 'O-001',
          items: [{ productId: 'P01', nombre: 'Gaseosa', precioCents: 500, cantidad: 2 }],
          estado: 'PENDIENTE',
        },
        true
      );
      expect(ui.closeItemsModal).toHaveBeenCalled();
      expect(ui.renderOrdenes).toHaveBeenCalled();
    });

    test('debe mostrar error de validación si no se agregan ítems', async () => {
      ui.els.ordenItemsContainer.querySelectorAll.mockReturnValue([]); // Sin ítems

      await controllers.handleOrdenItemSubmit(mockEvent);

      expect(ui.els.ordenItemErrors.textContent).toContain('Debe agregar al menos un producto.');
      expect(ui.els.ordenItemErrors.style.display).toBe('block');
      expect(stateManager.saveItem).not.toHaveBeenCalled();
    });

    test('debe mostrar error de validación para una cantidad de ítem inválida', async () => {
      ui.els.ordenItemsContainer.querySelectorAll.mockReturnValue([
        {
          querySelector: jest.fn((selector) => {
            if (selector === '.product-select') return { value: 'P01' };
            if (selector === '.qty-input') return { value: '0' }; // Cantidad inválida
            return null;
          }),
        },
      ]);

      await controllers.handleOrdenItemSubmit(mockEvent);

      expect(ui.els.ordenItemErrors.textContent).toContain('La cantidad debe estar entre 1 y 99.');
      expect(ui.els.ordenItemErrors.style.display).toBe('block');
      expect(stateManager.saveItem).not.toHaveBeenCalled();
    });
  });

  describe('Función updateBillingChange', () => {
    test('debe calcular el vuelto positivo correctamente', () => {
      stateManager.state.currentOrderTotalCents = 1000; // S/ 10.00
      ui.els.billingReceivedAmount.value = '15.00'; // S/ 15.00

      controllers.updateBillingChange();

      expect(ui.els.billingChangeAmount.textContent).toBe('S/ 5.00');
      expect(ui.els.billingChangeAmount.className).toBe('font-display text-green-700');
    });

    test('debe calcular el vuelto de cero correctamente', () => {
      stateManager.state.currentOrderTotalCents = 1000; // S/ 10.00
      ui.els.billingReceivedAmount.value = '10.00'; // S/ 10.00

      controllers.updateBillingChange();

      expect(ui.els.billingChangeAmount.textContent).toBe('S/ 0.00');
      expect(ui.els.billingChangeAmount.className).toBe('font-display text-green-700');
    });

    test('debe indicar monto insuficiente', () => {
      stateManager.state.currentOrderTotalCents = 1000; // S/ 10.00
      ui.els.billingReceivedAmount.value = '9.50'; // S/ 9.50

      controllers.updateBillingChange();

      expect(ui.els.billingChangeAmount.textContent).toBe('S/ 0.00');
      expect(ui.els.billingChangeAmount.className).toBe('font-display text-error');
    });

    test('debe manejar una entrada de monto recibido inválida', () => {
      utils.isValidPrice.mockReturnValueOnce(false);
      ui.els.billingReceivedAmount.value = 'abc';

      controllers.updateBillingChange();

      expect(ui.els.billingChangeAmount.textContent).toBe('S/ 0.00');
      expect(ui.els.billingChangeAmount.className).toBe('font-display text-error');
    });
  });

  describe('Función handleBillingSubmit', () => {
    beforeEach(() => {
      stateManager.state.currentOrderIdForBilling = 'O-001';
      stateManager.state.ordenes = [{ id: 'O-001', estado: 'LISTO', tipo: 'MESA', items: [], mesaId: 'M01' }];
      stateManager.state.currentOrderTotalCents = 1000; // S/ 10.00

      ui.els.billingCustomerId.value = '12345678';
      ui.els.billingCustomerName.value = 'Ana García';
      ui.els.billingReceivedAmount.value = '10.00';
      ui.els.billingChangeAmount.textContent = 'S/ 0.00';
    });

    test('debe procesar el pago exitosamente', async () => {
      stateManager.initState.mockResolvedValueOnce({});

      await controllers.handleBillingSubmit(mockEvent);

      expect(mockEvent.preventDefault).toHaveBeenCalled();
      expect(ui.clearErrors).toHaveBeenCalled();
      expect(stateManager.saveItem).toHaveBeenCalledWith(
        config.STORAGE_KEYS.ordenes,
        {
          id: 'O-001',
          estado: 'PAGADO',
          tipo: 'MESA',
          items: [],
          mesaId: 'M01',
          clienteDni: '12345678',
          clienteNombre: 'Ana García',
        },
        true
      );
      expect(stateManager.initState).toHaveBeenCalled();
      expect(window.alert).toHaveBeenCalledWith('¡Pago exitoso! Cambio a entregar: S/ 0.00');
      expect(ui.closeBillingModal).toHaveBeenCalled();
      expect(ui.renderAll).toHaveBeenCalled();
    });

    test('debe mostrar error por DNI inválido', async () => {
      ui.els.billingCustomerId.value = '123'; // Longitud de DNI inválida
      utils.isDigits.mockReturnValueOnce(false);

      await controllers.handleBillingSubmit(mockEvent);

      expect(ui.displayFieldErrors).toHaveBeenCalledWith(['El DNI debe tener exactamente 8 dígitos numéricos.'], expect.any(Object));
      expect(stateManager.saveItem).not.toHaveBeenCalled();
    });

    test('debe mostrar error por nombre de cliente inválido (números)', async () => {
      ui.els.billingCustomerName.value = 'Ana 123'; 
      utils.isStrictAlphaText.mockReturnValueOnce(false);

      await controllers.handleBillingSubmit(mockEvent);

      expect(ui.displayFieldErrors).toHaveBeenCalledWith(['El nombre solo permite letras.'], expect.any(Object));
      expect(stateManager.saveItem).not.toHaveBeenCalled();
    });

    test('debe mostrar error por monto insuficiente', async () => {
      ui.els.billingReceivedAmount.value = '5.00'; // Menor que el total
      ui.els.billingChangeAmount.textContent = 'S/ 0.00';

      await controllers.handleBillingSubmit(mockEvent);

      expect(ui.displayFieldErrors).toHaveBeenCalledWith(['Monto insuficiente.'], expect.any(Object));
      expect(stateManager.saveItem).not.toHaveBeenCalled();
    });
  });

  describe('Función handleMesaActions', () => {
    beforeEach(() => {
      stateManager.state.mesas = [{ id: 'M01', numero: 1, capacidad: 4, estado: 'LIBRE', activo: true }];
      mockEvent.target.dataset.id = 'M01';
    });

    test('debe realizar el borrado lógico de una mesa', async () => {
      mockEvent.target.dataset.action = 'delete-mesa';
      window.confirm.mockReturnValueOnce(true);

      await controllers.handleMesaActions(mockEvent);

      expect(window.confirm).toHaveBeenCalledWith('¿Deseas eliminar esta mesa?');
      expect(stateManager.saveItem).toHaveBeenCalledWith(
        config.STORAGE_KEYS.mesas,
        { id: 'M01', numero: 1, capacidad: 4, estado: 'LIBRE', activo: false },
        true
      );
      expect(ui.renderMesas).toHaveBeenCalled();
    });

    test('no debe eliminar si el usuario cancela', async () => {
      mockEvent.target.dataset.action = 'delete-mesa';
      window.confirm.mockReturnValueOnce(false);

      await controllers.handleMesaActions(mockEvent);

      expect(window.confirm).toHaveBeenCalledWith('¿Deseas eliminar esta mesa?');
      expect(stateManager.saveItem).not.toHaveBeenCalled();
      expect(ui.renderMesas).not.toHaveBeenCalled();
    });

    test('debe llenar el formulario para editar una mesa', async () => {
      mockEvent.target.dataset.action = 'edit-mesa';

      await controllers.handleMesaActions(mockEvent);

      expect(ui.els.mesaIdInput.value).toBe('M01');
      expect(ui.els.mesaNumeroInput.value).toBe(1);
      expect(ui.els.mesaCapacidadInput.value).toBe(4);
      expect(ui.els.mesaEstadoInput.value).toBe('LIBRE');
      expect(stateManager.state.editingMesaId).toBe('M01');
      expect(ui.els.mesaForm.querySelector).toHaveBeenCalledWith('button[type="submit"]');
      expect(ui.els.mesaForm.querySelector().textContent).toBe('Actualizar Mesa');
      expect(ui.els.mesaNumeroInput.focus).toHaveBeenCalled();
    });
  });

  describe('Función handleMeseroActions', () => {
    beforeEach(() => {
      stateManager.state.meseros = [{ id: 'W01', nombre: 'Juan', dni: '12345678', celular: '987654321', estado: 'ACTIVO', activo: true }];
      mockEvent.target.dataset.id = 'W01';
    });

    test('debe realizar el borrado lógico de un mesero', async () => {
      mockEvent.target.dataset.action = 'delete-mesero';
      window.confirm.mockReturnValueOnce(true);

      await controllers.handleMeseroActions(mockEvent);

      expect(stateManager.saveItem).toHaveBeenCalledWith(
        config.STORAGE_KEYS.meseros,
        { id: 'W01', nombre: 'Juan', dni: '12345678', celular: '987654321', estado: 'ACTIVO', activo: false },
        true
      );
      expect(ui.renderMeseros).toHaveBeenCalled();
    });

    test('debe llenar el formulario para editar un mesero', async () => {
      mockEvent.target.dataset.action = 'edit-mesero';

      await controllers.handleMeseroActions(mockEvent);

      expect(ui.els.meseroIdInput.value).toBe('W01');
      expect(ui.els.meseroNombreInput.value).toBe('Juan');
      expect(stateManager.state.editingMeseroId).toBe('W01');
      expect(ui.els.meseroForm.querySelector().textContent).toBe('Actualizar Mesero');
    });
  });

  describe('Función handleProductoActions', () => {
    beforeEach(() => {
      stateManager.state.productos = [{ id: 'P01', nombre: 'Gaseosa', precio: '5.00', disponibilidad: true, estado: true, descripcion: 'Refresco', activo: true }];
      mockEvent.target.dataset.id = 'P01';
    });

    test('debe realizar el borrado lógico de un producto', async () => {
      mockEvent.target.dataset.action = 'delete-producto';
      window.confirm.mockReturnValueOnce(true);

      await controllers.handleProductoActions(mockEvent);

      expect(stateManager.saveItem).toHaveBeenCalledWith(
        config.STORAGE_KEYS.productos,
        { id: 'P01', nombre: 'Gaseosa', precio: '5.00', disponibilidad: true, estado: true, descripcion: 'Refresco', activo: false },
        true
      );
      expect(ui.renderProductos).toHaveBeenCalled();
    });

    test('debe llenar el formulario para editar un producto', async () => {
      mockEvent.target.dataset.action = 'edit-producto';

      await controllers.handleProductoActions(mockEvent);

      expect(ui.els.productoIdInput.value).toBe('P01');
      expect(ui.els.productoNombreInput.value).toBe('Gaseosa');
      expect(stateManager.state.editingProductoId).toBe('P01');
      expect(ui.els.productoForm.querySelector().textContent).toBe('Actualizar Producto');
    });
  });

  describe('Eventos de clic en handleOrdenBody', () => {
    beforeEach(() => {
      stateManager.state.ordenes = [
        { id: 'O-001', estado: 'PENDIENTE', items: [] },
        { id: 'O-002', estado: 'EN COCINA', items: [] }, 
        { id: 'O-003', estado: 'LISTO', items: [] },
      ];
      mockEvent.target.dataset.id = 'O-001';
    });

    test('debe abrir el modal de ítems', async () => {
      mockEvent.target.dataset.action = 'open-items-modal';

      // Simular un evento de clic en el ordenBody que se propaga
      const clickEvent = new MouseEvent('click', { bubbles: true });
      Object.defineProperty(clickEvent, 'target', { value: mockEvent.target });

      // Bind events first, then dispatch the event
      controllers.bindEvents();
      await ui.els.ordenBody.dispatchEvent(clickEvent);

      expect(stateManager.state.currentOrderIdForItems).toBe('O-001');
      expect(ui.openItemsModal).toHaveBeenCalledWith('O-001');
    });

    test('debe avanzar la orden de PENDIENTE a EN COCINA', async () => {
      mockEvent.target.dataset.action = 'advance-order';
      mockEvent.target.dataset.id = 'O-001';

      const clickEvent = new MouseEvent('click', { bubbles: true });
      Object.defineProperty(clickEvent, 'target', { value: mockEvent.target });

      controllers.bindEvents();
      await ui.els.ordenBody.dispatchEvent(clickEvent);

      expect(stateManager.saveItem).toHaveBeenCalledWith(
        config.STORAGE_KEYS.ordenes,
        { id: 'O-001', estado: 'EN COCINA', items: [] },
        true
      );
      expect(ui.renderAll).toHaveBeenCalled();
    });

    test('debe avanzar la orden de EN COCINA a LISTO', async () => {
      mockEvent.target.dataset.action = 'advance-order';
      mockEvent.target.dataset.id = 'O-002';

      const clickEvent = new MouseEvent('click', { bubbles: true });
      Object.defineProperty(clickEvent, 'target', { value: mockEvent.target });

      controllers.bindEvents();
      await ui.els.ordenBody.dispatchEvent(clickEvent);

      expect(stateManager.saveItem).toHaveBeenCalledWith(
        config.STORAGE_KEYS.ordenes,
        { id: 'O-002', estado: 'LISTO', items: [] },
        true
      );
      expect(ui.renderAll).toHaveBeenCalled();
    });

    test('debe abrir el modal de facturación al avanzar a PAGADO', async () => {
      mockEvent.target.dataset.action = 'advance-order';
      mockEvent.target.dataset.id = 'O-003';

      const clickEvent = new MouseEvent('click', { bubbles: true });
      Object.defineProperty(clickEvent, 'target', { value: mockEvent.target });

      controllers.bindEvents();
      await ui.els.ordenBody.dispatchEvent(clickEvent);

      expect(ui.openBillingModal).toHaveBeenCalledWith('O-003');
      expect(stateManager.saveItem).not.toHaveBeenCalled(); // saveItem es llamado por handleBillingSubmit
    });
  });

  describe('Función bindEvents', () => {
    test('debe adjuntar escuchadores de eventos a los elementos relevantes', () => {
      controllers.bindEvents();

      expect(ui.els.mesaForm.addEventListener).toHaveBeenCalledWith('submit', expect.any(Function));
      expect(ui.els.meseroForm.addEventListener).toHaveBeenCalledWith('submit', expect.any(Function));
      expect(ui.els.productoForm.addEventListener).toHaveBeenCalledWith('submit', expect.any(Function));
      expect(ui.els.ordenForm.addEventListener).toHaveBeenCalledWith('submit', expect.any(Function));
      expect(ui.els.ordenTipoInput.addEventListener).toHaveBeenCalledWith('change', expect.any(Function));
      expect(ui.els.addItemRowBtn.addEventListener).toHaveBeenCalledWith('click', expect.any(Function));
      expect(ui.els.mesaBody.addEventListener).toHaveBeenCalledWith('click', expect.any(Function));
      expect(ui.els.meseroBody.addEventListener).toHaveBeenCalledWith('click', expect.any(Function));
      expect(ui.els.productoBody.addEventListener).toHaveBeenCalledWith('click', expect.any(Function));
      expect(ui.els.ordenBody.addEventListener).toHaveBeenCalledWith('click', expect.any(Function));
      expect(ui.els.itemsModalClose.addEventListener).toHaveBeenCalledWith('click', ui.closeItemsModal);
      expect(ui.els.itemsModalCancel.addEventListener).toHaveBeenCalledWith('click', ui.closeItemsModal);
      expect(ui.els.ordenItemForm.addEventListener).toHaveBeenCalledWith('submit', expect.any(Function));
      expect(ui.els.billingForm.addEventListener).toHaveBeenCalledWith('submit', expect.any(Function));
      expect(ui.els.billingReceivedAmount.addEventListener).toHaveBeenCalledWith('input', expect.any(Function));
      expect(ui.els.billingModalClose.addEventListener).toHaveBeenCalledWith('click', ui.closeBillingModal);
      expect(ui.els.billingModalCancel.addEventListener).toHaveBeenCalledWith('click', ui.closeBillingModal);
      expect(ui.els.btnVerHistorial.addEventListener).toHaveBeenCalledWith('click', expect.any(Function));
      expect(document.getElementById('history-modal-overlay').addEventListener).toHaveBeenCalledWith('click', expect.any(Function));
      expect(ui.els.historyModalClose.addEventListener).toHaveBeenCalledWith('click', expect.any(Function));
      expect(ui.els.mesaResetButton.addEventListener).toHaveBeenCalledWith('click', ui.resetMesaForm);
      expect(ui.els.meseroResetButton.addEventListener).toHaveBeenCalledWith('click', ui.resetMeseroForm);
      expect(ui.els.productoResetButton.addEventListener).toHaveBeenCalledWith('click', ui.resetProductoForm);
      expect(ui.els.ordenResetButton.addEventListener).toHaveBeenCalledWith('click', ui.resetOrdenForm);
      expect(ui.els.mesaCancelButton.addEventListener).toHaveBeenCalledWith('click', ui.resetMesaForm);
      expect(ui.els.meseroCancelButton.addEventListener).toHaveBeenCalledWith('click', ui.resetMeseroForm);
      expect(ui.els.productoCancelButton.addEventListener).toHaveBeenCalledWith('click', ui.resetProductoForm);
      expect(ui.els.ordenCancelButton.addEventListener).toHaveBeenCalledWith('click', ui.resetOrdenForm);

      // Verificar botones de pestañas
      document.querySelectorAll('.tab-button').forEach(btn => {
        expect(btn.addEventListener).toHaveBeenCalledWith('click', expect.any(Function));
      });
    });

    test('la entrada de DNI debe restringirse a 8 dígitos', () => {
      // Mock de los elementos de entrada específicos y su addEventListener
      const mockMeseroDniInput = {
        value: '',
        addEventListener: jest.fn(),
      };
      const mockBillingCustomerIdInput = {
        value: '',
        addEventListener: jest.fn(),
      };

      ui.els.meseroDniInput = mockMeseroDniInput;
      ui.els.billingCustomerId = mockBillingCustomerIdInput;

      controllers.bindEvents();

      // Encontrar el manejador de eventos de entrada para meseroDniInput
      const meseroDniInputHandler = mockMeseroDniInput.addEventListener.mock.calls.find(
        call => call[0] === 'input'
      )[1];

      // Simular un evento de entrada con un valor de más de 8 dígitos
      const mockInputEvent = {
        target: { value: '1234567890' },
        preventDefault: jest.fn(),
      };
      meseroDniInputHandler(mockInputEvent);

      // El manejador modifica event.target.value directamente
      expect(mockInputEvent.target.value).toBe('12345678');

      // Hacer lo mismo para billingCustomerId
      const billingCustomerIdHandler = mockBillingCustomerIdInput.addEventListener.mock.calls.find(
        call => call[0] === 'input'
      )[1];
      mockInputEvent.target.value = '0987654321';
      billingCustomerIdHandler(mockInputEvent);
      expect(mockInputEvent.target.value).toBe('09876543');
    });
  });
});
