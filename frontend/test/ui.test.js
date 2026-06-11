/** @jest-environment jsdom */

// Mock de dependencias antes de cargar ui.js
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

jest.mock('../js/utils', () => ({
  formatPrice: jest.fn(v => Number(v).toFixed(2)),
  formatCents: jest.fn(c => (c / 100).toFixed(2)),
  formatOrderType: jest.fn(t => String(t || '').replace(/_/g, ' '))
}));

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
  getActiveOrdersByMesaId: jest.fn(() => []),
  getOrdenesActivas: jest.fn(() => []),
  calculateOrderTotals: jest.fn(() => ({ subtotalCents: 0, packagingFeeCents: 0, totalCents: 0 })),
  getHistorialVentas: jest.fn(() => []),
  getNextMesaId: jest.fn(() => 'M01'),
  getNextMesaNumero: jest.fn(() => 1),
  getNextMeseroId: jest.fn(() => 'W01'),
  getNextProductoId: jest.fn(() => 'P01'),
  getNextOrderId: jest.fn(() => 'O-001')
}));

const ui = require('../js/ui');
const stateManager = require('../js/state');

describe('Pruebas unitarias de ui.js', () => {
  beforeEach(() => {
    // Configuración del DOM mínimo para que els.* no devuelva null
    document.body.innerHTML = `
      <div id="global-error"></div>
      
      <!-- Mesas -->
      <form id="mesa-form">
        <input id="mesa-id">
        <input id="mesa-numero">
        <input id="mesa-capacidad">
        <select id="mesa-estado"></select>
        <button type="submit">Guardar Mesa</button>
      </form>
      <table id="mesa-body"></table>
      <div id="mesa-empty"></div>
      <div id="mesa-errors"></div>
      <span id="error-mesa-id" class="error-message"></span>

      <!-- Ordenes -->
      <form id="orden-form">
        <input id="orden-id">
        <select id="orden-tipo"><option value="MESA">MESA</option></select>
        <select id="orden-mesa"></select>
        <select id="orden-mesero"></select>
        <input id="orden-cliente">
        <select id="orden-estado"></select>
      </form>
      <div id="orden-errors"></div>
      <div id="orden-items-container"></div>
      <table id="orden-body"></table>
      <div id="orden-empty"></div>
      <span id="orden-item-errors"></span>
      <div id="items-modal" class="hidden">
        <span id="items-modal-order-id"></span>
      </div>

      <!-- Facturación (Cobro) -->
      <div id="billing-modal" class="hidden">
        <span id="billing-order-id"></span>
        <span id="billing-order-type"></span>
        <ul id="billing-items-list"></ul>
        <span id="billing-total-amount"></span>
        <form id="billing-form"></form>
        <input id="billing-received-amount">
        <span id="billing-change-amount"></span>
      </div>

      <!-- Dashboard -->
      <div id="dashboard-table-grid"></div>
      <div id="dashboard-mesa-libre"></div>
      <div id="dashboard-mesa-ocupada"></div>
      <div id="dashboard-mesa-deshabilitada"></div>

      <!-- Contenedores de error faltantes para evitar errores de null en ui.js -->
      <div id="mesero-errors"></div>
      <div id="producto-errors"></div>
      
      <!-- Historial -->
      <div id="history-modal" class="hidden">
        <table id="history-body"></table>
        <div id="history-empty"></div>
      </div>
    `;

    // Limpiar estado y mocks
    jest.clearAllMocks();
    stateManager.state.mesas = [];
    stateManager.state.meseros = [];
    stateManager.state.productos = [];
    stateManager.state.ordenes = [];
    stateManager.state.editingMesaId = null;
  });

  describe('displayFieldErrors y clearErrors', () => {
    test('displayFieldErrors debe inyectar el mensaje en el elemento span correcto', () => {
      const errors = ['El ID es obligatorio.'];
      const mapping = { "ID": "error-mesa-id" };
      
      ui.displayFieldErrors(errors, mapping);
      
      const span = document.getElementById('error-mesa-id');
      expect(span.textContent).toBe('El ID es obligatorio.');
      expect(span.style.display).toBe('block');
    });

    test('clearErrors debe vaciar los contenedores de error y ocultar los mensajes de campo', () => {
      document.getElementById('mesa-errors').innerHTML = 'Error Genérico';
      const span = document.getElementById('error-mesa-id');
      span.textContent = 'Error Específico';
      span.style.display = 'block';

      ui.clearErrors();

      expect(document.getElementById('mesa-errors').innerHTML).toBe('');
      expect(span.textContent).toBe('');
      expect(span.style.display).toBe('none');
    });
  });

  describe('renderMesas', () => {
    test('debe poblar el cuerpo de la tabla con las mesas activas y ocultar el mensaje de vacío', () => {
      stateManager.state.mesas = [
        { id: 'M01', numero: 1, capacidad: 4, estado: 'LIBRE', activo: true }
      ];
      
      ui.renderMesas();
      
      const body = document.getElementById('mesa-body');
      expect(body.children.length).toBe(1);
      expect(body.innerHTML).toContain('M01');
      expect(document.getElementById('mesa-empty').style.display).toBe('none');
    });

    test('debe mostrar el mensaje de "vacío" si no hay mesas registradas', () => {
      stateManager.state.mesas = [];
      ui.renderMesas();
      expect(document.getElementById('mesa-empty').style.display).toBe('block');
    });
  });

  describe('resetMesaForm', () => {
    test('debe resetear el formulario y preparar el ID correlativo generado por el estado', () => {
      const idInput = document.getElementById('mesa-id');
      const submitBtn = document.querySelector('#mesa-form button[type="submit"]');
      
      idInput.value = 'VALOR_SUCIO';
      submitBtn.textContent = 'Actualizar Mesa';
      stateManager.state.editingMesaId = 'M99';

      ui.resetMesaForm();

      expect(idInput.value).toBe('M01'); // Valor retornado por el mock getNextMesaId
      expect(submitBtn.textContent).toBe('Guardar Mesa');
      expect(stateManager.state.editingMesaId).toBeNull();
    });
  });

  describe('openBillingModal', () => {
    test('debe quitar la clase "hidden" y cargar los totales de la orden seleccionada', () => {
      const orden = {
        id: 'O-001',
        tipo: 'MESA',
        items: [{ nombre: 'Soda', cantidad: 1, precioCents: 500 }]
      };
      stateManager.state.ordenes = [orden];
      stateManager.calculateOrderTotals.mockReturnValue({ totalCents: 500 });

      ui.openBillingModal('O-001');

      expect(document.getElementById('billing-modal').classList.contains('hidden')).toBe(false);
      expect(document.getElementById('billing-order-id').textContent).toBe('O-001');
      expect(document.getElementById('billing-total-amount').textContent).toBe('S/ 5.00');
    });
  });

  describe('createItemRow', () => {
    test('debe añadir una nueva fila de producto al contenedor de items de orden', () => {
      stateManager.state.productos = [{ id: 'P01', nombre: 'Test Producto' }];
      const container = document.getElementById('orden-items-container');

      ui.createItemRow('P01', 3);

      expect(container.children.length).toBe(1);
      const select = container.querySelector('.product-select');
      const qtyInput = container.querySelector('.qty-input');
      expect(select.value).toBe('P01');
      expect(qtyInput.value).toBe('3');
    });
  });

  describe('renderHistoryTable', () => {
    test('debe listar las órdenes con estado PAGADO en la tabla de historial', () => {
      const ordenPagada = { id: 'O-999', tipo: 'PARA_LLEVAR', cliente: 'Juan', items: [], estado: 'PAGADO' };
      stateManager.getHistorialVentas.mockReturnValue([ordenPagada]);
      stateManager.calculateOrderTotals.mockReturnValue({ totalCents: 1500 });

      ui.renderHistoryTable();

      const body = document.getElementById('history-body');
      expect(body.children.length).toBe(1);
      expect(body.innerHTML).toContain('O-999');
      expect(body.innerHTML).toContain('S/ 15.00');
    });
  });
});