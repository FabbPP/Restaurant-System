const STORAGE_KEYS = {
  mesas: "mesas",
  meseros: "meseros",
  ordenes: "ordenes",
};

const state = {
  mesas: [],
  meseros: [],
  ordenes: [],
  editingMesaId: null,
  editingMeseroId: null,
  loadError: null,
};

class ValidationError extends Error {
  constructor(errors) {
    super("ValidationError");
    this.name = "ValidationError";
    this.errors = errors;
  }
}

const mesaForm = document.getElementById("mesa-form");
const mesaErrors = document.getElementById("mesa-errors");
const mesaBody = document.getElementById("mesa-body");
const mesaEmpty = document.getElementById("mesa-empty");
const mesaIdInput = document.getElementById("mesa-id");
const mesaNumeroInput = document.getElementById("mesa-numero");
const mesaCapacidadInput = document.getElementById("mesa-capacidad");
const mesaEstadoInput = document.getElementById("mesa-estado");
const mesaCancelButton = document.getElementById("mesa-cancel");
const mesaResetButton = document.getElementById("mesa-reset");

const meseroForm = document.getElementById("mesero-form");
const meseroErrors = document.getElementById("mesero-errors");
const meseroBody = document.getElementById("mesero-body");
const meseroEmpty = document.getElementById("mesero-empty");
const meseroIdInput = document.getElementById("mesero-id");
const meseroNombreInput = document.getElementById("mesero-nombre");
const meseroDniInput = document.getElementById("mesero-dni");
const meseroTelefonoInput = document.getElementById("mesero-telefono");
const meseroEstadoInput = document.getElementById("mesero-estado");
const meseroCancelButton = document.getElementById("mesero-cancel");
const meseroResetButton = document.getElementById("mesero-reset");

const globalError = document.getElementById("global-error");

function loadList(key) {
  const raw = localStorage.getItem(key);
  if (!raw) {
    return [];
  }
  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) {
      throw new Error(`Formato invalido para ${key}.`);
    }
    return parsed;
  } catch (error) {
    throw new Error(`Error leyendo ${key}: ${error.message}`);
  }
}

function saveList(key, value) {
  localStorage.setItem(key, JSON.stringify(value));
}

function initState() {
  try {
    state.mesas = loadList(STORAGE_KEYS.mesas);
    state.meseros = loadList(STORAGE_KEYS.meseros);
    state.ordenes = loadList(STORAGE_KEYS.ordenes);
  } catch (error) {
    state.loadError = error.message;
    globalError.textContent =
      `${error.message} Corrige LocalStorage o usa "Limpiar datos" para reiniciar.`;
  }
}

function setFormDisabled(disabled) {
  const fields = document.querySelectorAll("input, select, button");
  fields.forEach((field) => {
    if (field.id === "mesa-reset" || field.id === "mesero-reset") {
      field.disabled = false;
      return;
    }
    field.disabled = disabled;
  });
}

function normalizeText(value) {
  return value.trim();
}

function normalizeId(value) {
  return value.trim().toUpperCase();
}

function isId(value) {
  return /^[A-Za-z0-9_-]+$/.test(value);
}

function isAlphanumericText(value) {
  return /^[A-Za-z0-9 _-]+$/.test(value);
}

function isDigits(value) {
  return /^\d+$/.test(value);
}

function getActiveOrdersByMesaId(mesaId) {
  return state.ordenes.filter(
    (orden) =>
      orden.mesaId === mesaId &&
      !["CLOSED", "CERRADA"].includes(String(orden.estado).toUpperCase())
  );
}

function getOrdersByMeseroId(meseroId) {
  return state.ordenes.filter((orden) => orden.meseroId === meseroId);
}

function renderErrors(container, errors) {
  if (!errors.length) {
    container.innerHTML = "";
    return;
  }
  const list = document.createElement("ul");
  errors.forEach((error) => {
    const item = document.createElement("li");
    item.textContent = error;
    list.appendChild(item);
  });
  container.innerHTML = "";
  container.appendChild(list);
}

function clearErrors() {
  mesaErrors.innerHTML = "";
  meseroErrors.innerHTML = "";
  globalError.textContent = state.loadError ? globalError.textContent : "";
}

function validateMesa(input) {
  const errors = [];
  if (!input.id) {
    errors.push("El ID es obligatorio.");
  } else if (!isId(input.id)) {
    errors.push("El ID solo permite letras, numeros, guion y guion bajo.");
  } else if (
    state.mesas.some(
      (mesa) => mesa.id === input.id && mesa.id !== state.editingMesaId
    )
  ) {
    errors.push("El ID de la mesa ya existe.");
  }

  if (!input.numero) {
    errors.push("El numero es obligatorio.");
  } else if (!Number.isInteger(input.numero) || input.numero < 1) {
    errors.push("El numero debe ser un entero mayor o igual a 1.");
  } else if (
    state.mesas.some(
      (mesa) =>
        mesa.numero === input.numero && mesa.id !== state.editingMesaId
    )
  ) {
    errors.push("El numero de mesa ya esta registrado.");
  }

  if (!input.capacidad) {
    errors.push("La capacidad es obligatoria.");
  } else if (!Number.isInteger(input.capacidad)) {
    errors.push("La capacidad debe ser un numero entero.");
  } else if (input.capacidad < 1 || input.capacidad > 99) {
    errors.push("La capacidad debe estar entre 1 y 99.");
  }

  if (!["LIBRE", "OCUPADA"].includes(input.estado)) {
    errors.push("El estado debe ser LIBRE u OCUPADA.");
  }

  const activeOrders = getActiveOrdersByMesaId(input.id);
  const existingMesa = state.mesas.find((mesa) => mesa.id === state.editingMesaId);
  if (
    input.estado === "OCUPADA" &&
    activeOrders.length > 0 &&
    (!existingMesa || existingMesa.estado !== "OCUPADA")
  ) {
    errors.push("La mesa ya tiene una orden activa y no puede marcarse OCUPADA.");
  }

  if (errors.length) {
    throw new ValidationError(errors);
  }
}

function validateMesero(input) {
  const errors = [];
  if (!input.id) {
    errors.push("El ID es obligatorio.");
  } else if (!isId(input.id)) {
    errors.push("El ID solo permite letras, numeros, guion y guion bajo.");
  } else if (
    state.meseros.some(
      (mesero) => mesero.id === input.id && mesero.id !== state.editingMeseroId
    )
  ) {
    errors.push("El ID del mesero ya existe.");
  }

  if (!input.nombre) {
    errors.push("El nombre es obligatorio.");
  } else if (!isAlphanumericText(input.nombre)) {
    errors.push("El nombre solo permite caracteres alfanumericos.");
  }

  if (!input.dni) {
    errors.push("El DNI es obligatorio.");
  } else if (!isDigits(input.dni) || input.dni.length !== 8) {
    errors.push("El DNI debe tener 8 digitos numericos.");
  } else if (
    state.meseros.some(
      (mesero) =>
        mesero.dni === input.dni && mesero.id !== state.editingMeseroId
    )
  ) {
    errors.push("El DNI ya esta registrado.");
  }

  if (!input.telefono) {
    errors.push("El telefono es obligatorio.");
  } else if (!isDigits(input.telefono)) {
    errors.push("El telefono solo permite numeros.");
  } else if (input.telefono.length < 6 || input.telefono.length > 15) {
    errors.push("El telefono debe tener entre 6 y 15 digitos.");
  }

  if (!["ACTIVO", "INACTIVO"].includes(input.estado)) {
    errors.push("El estado debe ser ACTIVO o INACTIVO.");
  }

  if (errors.length) {
    throw new ValidationError(errors);
  }
}

function readMesaForm() {
  return {
    id: state.editingMesaId || generateMesaId(),
    numero: Number(mesaNumeroInput.value),
    capacidad: Number(mesaCapacidadInput.value),
    estado: mesaEstadoInput.value,
  };
}

function readMeseroForm() {
  return {
    id: state.editingMeseroId || generateMeseroId(),
    nombre: normalizeText(meseroNombreInput.value),
    dni: meseroDniInput.value.trim(),
    telefono: meseroTelefonoInput.value.trim(),
    estado: meseroEstadoInput.value,
  };
}

function resetMesaForm() {
  mesaForm.reset();
  state.editingMesaId = null;
  mesaIdInput.disabled = false;
  mesaSubmitText("Guardar");
  mesaErrors.innerHTML = "";
}

function resetMeseroForm() {
  meseroForm.reset();
  state.editingMeseroId = null;
  meseroIdInput.disabled = false;
  meseroSubmitText("Guardar");
  meseroErrors.innerHTML = "";
}

function mesaSubmitText(text) {
  document.getElementById("mesa-submit").textContent = text;
}

function meseroSubmitText(text) {
  document.getElementById("mesero-submit").textContent = text;
}

function renderMesas() {
  mesaBody.innerHTML = "";
  const mesas = [...state.mesas].sort((a, b) => a.numero - b.numero);
  mesaEmpty.style.display = mesas.length ? "none" : "block";
  mesas.forEach((mesa) => {
    const row = document.createElement("tr");
    row.appendChild(createCell(mesa.id));
    row.appendChild(createCell(mesa.numero));
    row.appendChild(createCell(mesa.capacidad));
    row.appendChild(createCell(mesa.estado));

    const actions = document.createElement("td");
    actions.appendChild(createActionButton("Editar", "edit-mesa", mesa.id));
    actions.appendChild(createActionButton("Eliminar", "delete-mesa", mesa.id, "danger"));
    row.appendChild(actions);
    mesaBody.appendChild(row);
  });
}

function renderMeseros() {
  meseroBody.innerHTML = "";
  const meseros = [...state.meseros].sort((a, b) =>
    a.nombre.localeCompare(b.nombre)
  );
  meseroEmpty.style.display = meseros.length ? "none" : "block";
  meseros.forEach((mesero) => {
    const row = document.createElement("tr");
    row.appendChild(createCell(mesero.id));
    row.appendChild(createCell(mesero.nombre));
    row.appendChild(createCell(mesero.dni));
    row.appendChild(createCell(mesero.telefono));
    row.appendChild(createCell(mesero.estado));

    const actions = document.createElement("td");
    actions.appendChild(createActionButton("Editar", "edit-mesero", mesero.id));
    actions.appendChild(
      createActionButton("Eliminar", "delete-mesero", mesero.id, "danger")
    );
    row.appendChild(actions);
    meseroBody.appendChild(row);
  });
}

function createCell(value) {
  const cell = document.createElement("td");
  cell.textContent = value;
  return cell;
}

function createActionButton(label, action, id, className) {
  const button = document.createElement("button");
  button.type = "button";
  button.textContent = label;
  button.dataset.action = action;
  button.dataset.id = id;
  if (className) {
    button.classList.add(className);
  }
  return button;
}

function handleMesaSubmit(event) {
  event.preventDefault();
  clearErrors();
  try {
    const input = readMesaForm();
    validateMesa(input);
    if (state.editingMesaId) {
      state.mesas = state.mesas.map((mesa) =>
        mesa.id === state.editingMesaId ? input : mesa
      );
    } else {
      state.mesas.push(input);
    }
    saveList(STORAGE_KEYS.mesas, state.mesas);
    resetMesaForm();
    renderMesas();
  } catch (error) {
    if (error instanceof ValidationError) {
      renderErrors(mesaErrors, error.errors);
      return;
    }
    globalError.textContent = error.message;
  }
}

function handleMeseroSubmit(event) {
  event.preventDefault();
  clearErrors();
  try {
    const input = readMeseroForm();
    validateMesero(input);
    if (state.editingMeseroId) {
      state.meseros = state.meseros.map((mesero) =>
        mesero.id === state.editingMeseroId ? input : mesero
      );
    } else {
      state.meseros.push(input);
    }
    saveList(STORAGE_KEYS.meseros, state.meseros);
    resetMeseroForm();
    renderMeseros();
  } catch (error) {
    if (error instanceof ValidationError) {
      renderErrors(meseroErrors, error.errors);
      return;
    }
    globalError.textContent = error.message;
  }
}

function handleMesaActions(event) {
  const action = event.target.dataset.action;
  const id = event.target.dataset.id;
  if (!action || !id) {
    return;
  }

  if (action === "edit-mesa") {
    const mesa = state.mesas.find((item) => item.id === id);
    if (!mesa) {
      return;
    }
    mesaIdInput.value = mesa.id;
    mesaNumeroInput.value = mesa.numero;
    mesaCapacidadInput.value = mesa.capacidad;
    mesaEstadoInput.value = mesa.estado;
    state.editingMesaId = mesa.id;
    mesaIdInput.disabled = true;
    mesaSubmitText("Actualizar");
    return;
  }

  if (action === "delete-mesa") {
    const ordenes = getActiveOrdersByMesaId(id);
    const historico = state.ordenes.some((orden) => orden.mesaId === id);
    if (ordenes.length || historico) {
      renderErrors(mesaErrors, [
        "No se puede eliminar la mesa porque tiene ordenes asociadas.",
      ]);
      return;
    }
    if (!confirm("Deseas eliminar esta mesa?")) {
      return;
    }
    state.mesas = state.mesas.filter((mesa) => mesa.id !== id);
    saveList(STORAGE_KEYS.mesas, state.mesas);
    renderMesas();
  }
}

function handleMeseroActions(event) {
  const action = event.target.dataset.action;
  const id = event.target.dataset.id;
  if (!action || !id) {
    return;
  }

  if (action === "edit-mesero") {
    const mesero = state.meseros.find((item) => item.id === id);
    if (!mesero) {
      return;
    }
    meseroIdInput.value = mesero.id;
    meseroNombreInput.value = mesero.nombre;
    meseroDniInput.value = mesero.dni;
    meseroTelefonoInput.value = mesero.telefono;
    meseroEstadoInput.value = mesero.estado;
    state.editingMeseroId = mesero.id;
    meseroIdInput.disabled = true;
    meseroSubmitText("Actualizar");
    return;
  }

  if (action === "delete-mesero") {
    const ordenes = getOrdersByMeseroId(id);
    if (ordenes.length) {
      renderErrors(meseroErrors, [
        "No se puede eliminar el mesero porque tiene ordenes asociadas. Marca INACTIVO.",
      ]);
      return;
    }
    if (!confirm("Deseas eliminar este mesero?")) {
      return;
    }
    state.meseros = state.meseros.filter((mesero) => mesero.id !== id);
    saveList(STORAGE_KEYS.meseros, state.meseros);
    renderMeseros();
  }
}

function handleMesaReset() {
  if (!confirm("Deseas limpiar los datos de mesas?")) {
    return;
  }
  state.mesas = [];
  saveList(STORAGE_KEYS.mesas, state.mesas);
  resetMesaForm();
  renderMesas();
}

function handleMeseroReset() {
  if (!confirm("Deseas limpiar los datos de meseros?")) {
    return;
  }
  state.meseros = [];
  saveList(STORAGE_KEYS.meseros, state.meseros);
  resetMeseroForm();
  renderMeseros();
}

function bindEvents() {
  mesaForm.addEventListener("submit", handleMesaSubmit);
  mesaCancelButton.addEventListener("click", resetMesaForm);
  mesaBody.addEventListener("click", handleMesaActions);
  mesaResetButton.addEventListener("click", handleMesaReset);

  meseroForm.addEventListener("submit", handleMeseroSubmit);
  meseroCancelButton.addEventListener("click", resetMeseroForm);
  meseroBody.addEventListener("click", handleMeseroActions);
  meseroResetButton.addEventListener("click", handleMeseroReset);
}

function renderAll() {
  renderMesas();
  renderMeseros();
}

initState();
bindEvents();
renderAll();
if (state.loadError) {
  setFormDisabled(true);
}

function generateMesaId() {
  const maxId = state.mesas.length ? Math.max(...state.mesas.map(m => parseInt(m.id))) : 0;
  return String(maxId + 1);
}

function generateMeseroId() {
  const maxId = state.meseros.length ? Math.max(...state.meseros.map(m => parseInt(m.id))) : 0;
  return String(maxId + 1);
}