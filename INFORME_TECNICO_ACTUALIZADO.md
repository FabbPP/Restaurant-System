# Informe Técnico: RestoFlow POS System (Web Edition)

## 0. Contexto y Supuestos Mínimos (Control de Alcance)

Este sistema fue concebido como una solución de gestión transaccional de restaurante, evolucionando de un prototipo CLI a una robusta aplicación Web SPA. El diseño se basó en **supuestos de control** para garantizar la integridad operativa:

### Supuestos Funcionales
- **Núcleo Transaccional:** El sistema debe gestionar mesas, personal y órdenes vinculadas de forma atómica.
- **Modalidades de Orden:** Soporte para `Dine-In` (Mesa) y `Takeaway` (Para Llevar) compartiendo una estructura base pero con reglas de negocio diferenciadas (ej. Recargo de empaque).
- **Ciclo de Vida (FSM):** Una orden es gobernada por una máquina de estados estricta: `PENDIENTE` → `EN COCINA` → `LISTO` → `PAGADO`. No se permiten saltos ilegales (ej. de Pendiente a Pagado sin pasar por cocina).
- **Integridad de Recursos:** Una mesa no puede tener más de una orden activa. La liberación del recurso físico ocurre únicamente tras la confirmación del pago.

### Supuestos de Calidad
- **Precisión Financiera:** Los cálculos monetarios se realizan mediante **aritmética de céntimos** (números enteros) para evitar errores de precisión de punto flotante IEEE-754.
- **Blindaje de Triple Capa:** Validaciones previas a cualquier mutación de estado, excepciones tipadas (`ValidationError`) y retroalimentación visual inmediata.
- **Persistencia Local:** Uso de `LocalStorage` para garantizar que los datos sobrevivan a recargas del navegador, actuando como un repositorio in-memory persistente.

### Diseño Operacional
1. **Acceso y Sincronización:** El sistema inicia cargando el estado desde `LocalStorage`. El usuario accede a un Dashboard centralizado que ofrece una vista en tiempo real del estado de las mesas (LIBRE, OCUPADA, DESHABILITADA) y el rendimiento de los meseros.
2. **Flujo de Apertura de Comanda:**
    - **Modalidad MESA:** El operador selecciona una mesa libre y un mesero activo. El sistema bloquea automáticamente la mesa tras la creación.
    - **Modalidad PARA LLEVAR:** Se exige el nombre del cliente y se aplica de forma atómica el `PACKAGING_FEE` (S/ 0.40).
3. **Gestión Dinámica de Ítems:** A través del modal "Items de Orden", se añaden productos del catálogo validando existencias y estados. El sistema restringe las cantidades al rango `1..99` mediante validación reactiva en los inputs (TC-IT-04).
4. **Control Transaccional de la FSM:** Las órdenes avanzan mediante botones de acción que respetan la secuencia `PENDIENTE` → `EN COCINA` → `LISTO`. El sistema impide saltos de estado para asegurar que ningún pedido llegue a caja sin ser preparado.
5. **Liquidación y Cierre (Modal de Cobro):** Al intentar pasar al estado `PAGADO`, se dispara el flujo de facturación:
    - Verificación del "Monto Recibido" contra el Total Cents.
    - Validación de DNI (8 dígitos) y Nombre del Cliente (seguridad AlphaText).
    - Cálculo de vuelto y registro en el Historial de Ventas.
6. **Liberación Atómica de Recursos:** Tras el pago exitoso, la mesa vinculada regresa al estado `LIBRE` síncronamente, quedando disponible para una nueva asignación de forma inmediata.

## 0.1 Gestión de Riesgos Antecesores

| Riesgo | Fundamento Técnico | Respuesta en Diseño |
| :--- | :--- | :--- |
| **Mesa Doble** | Falta de bloqueo de recursos | Función `validateOrden` y `checkMesaActionLocks`. |
| **Transición Ilegal** | FSM no controlada | Función `getNextOrderState` valida secuencia exacta. |
| **Corrupción de Historial** | Mutación post-cierre | Bloqueo lógico de edición tras estado `PAGADO`. |
| **Entrada Corrupta** | Fallo en parsing de tipos | Validadores `isDigits`, `isValidPrice` y `isStrictAlphaText`. |
| **Montos Inexactos** | Error IEEE-754 | Implementación de `parsePriceToCents`. |
| **Caída del Sistema** | Excepciones no capturadas | Clase `ValidationError` y manejo de errores globales. |

## 1. Diseño Operacional y Funcional

El sistema ha evolucionado de un prototipo CLI a una aplicación web SPA (Single Page Application) persistida en `LocalStorage`. El núcleo transaccional gestiona el ciclo de vida de las mesas, el personal y las comandas con integridad garantizada.

### Flujos Críticos Implementados:
1.  **Gestión de Órdenes (Mesa y Para Llevar):** 
    - **Mesa:** Bloqueo de recurso físico (`Mesa OCUPADA`) y asignación de mesero.
    - **Para Llevar:** Aplicación automática de `PACKAGING_FEE` (S/ 0.40) y validación de nombre de cliente.
2.  **Ciclo de Vida (FSM):** Flujo estricto `PENDIENTE` -> `EN COCINA` -> `LISTO` -> `PAGADO`. No se permiten saltos de estado para asegurar la trazabilidad financiera.
3.  **Cierre y Liberación Atómica:** El proceso de cobro (Modal de Facturación) valida el monto recibido y, al confirmarse, libera la mesa síncronamente en una sola operación atómica.

## 2. Gestión de Calidad y Riesgos

| Riesgo Identificado | Mitigación Técnica en la Implementación Actual |
| :--- | :--- |
| **Inexactitud Financiera** | Uso de aritmética de céntimos (números enteros) antes de formatear a decimal para evitar errores de punto flotante IEEE-754. |
| **Mesa con doble orden** | Validación en `validateOrden` y `checkMesaActionLocks` que impide asignar órdenes a mesas con estado `OCUPADA`. |
| **Inyección de datos corruptos** | Estrategia de triple capa: Atributos HTML5 (`pattern`), validación lógica en `app.js` y manejo de excepciones `ValidationError`. |
| **Pérdida de Historial** | Implementación de borrado lógico (`activo: false`) para productos y personal con órdenes vinculadas. |
| **Entradas no numéricas** | Uso de `input type="number"` y validación `isDigits()` / `isValidPrice()` en el núcleo de la lógica. |

## 3. Catálogo de Pruebas de Caja Negra (Actualizado)

Las pruebas se ejecutan mediante **Jest** (en lugar de Pytest) y utilizan JSDOM para simular el entorno del navegador. Se aplican técnicas de Partición de Equivalencia (PE) y Análisis de Valores Límite (AVL).

### Módulo: Mesas (TC-ME)
| ID | Caso de Prueba | Técnica | Entrada | Resultado Esperado |
| :--- | :--- | :--- | :--- | :--- |
| TC-ME-01 | Autocalcular ID inicial | AVL | Estado inicial vacío | Genera "M01" y Número 1 |
| TC-ME-04 | Capacidad inválida (0) | AVL | `capacidad: 0` | Throw `ValidationError` (1-16) |
| TC-ME-07 | Bloqueo mesa OCUPADA | PE | `checkMesaActionLocks` | Bloquea edición/eliminación |

### Módulo: Meseros (TC-MS)
| ID | Caso de Prueba | Técnica | Entrada | Resultado Esperado |
| :--- | :--- | :--- | :--- | :--- |
| TC-MS-02 | DNI insuficiente | AVL | `dni: "1234567"` | Error: "Exactamente 8 dígitos" |
| TC-MS-07 | Números en Nombre | PE | `nombre: "Juan 123"` | Error: "NO puede contener números" |
| TC-MS-08 | Letras en DNI | PE | `dni: "ABCDEFGH"` | Error: Requerido numérico |

### Módulo: Catálogo (TC-CA)
| ID | Caso de Prueba | Técnica | Entrada | Resultado Esperado |
| :--- | :--- | :--- | :--- | :--- |
| TC-CA-02 | Precio nulo | AVL | `precio: 0.00` | Error: "> 0 y < 999999" |
| TC-CA-05 | Símbolos en Desc. | PE | `desc: "<script>"` | Bloqueo por seguridad AlphaText |
| TC-CA-06 | Borrado Lógico | PE | `delete-producto` | `activo: false` si tiene órdenes |

### Módulo: Cobro y Facturación (TC-CO)
| ID | Caso de Prueba | Técnica | Entrada | Resultado Esperado |
| :--- | :--- | :--- | :--- | :--- |
| TC-CO-03 | Monto insuficiente | AVL | Total: 10, Rec: 9.9 | Alerta: "Dinero insuficiente" |
| TC-CO-04 | Letras en Monto | PE | `recibido: "Diez"` | Alerta: "Número decimal válido" |
| TC-CO-08 | Seguridad en Nombre | PE | `cliente: "Ana 123"` | Bloqueo de caracteres no alfa |

## 4. Resultados de Ejecución de Pruebas

Se ha migrado la suite de pruebas a **Jest**. La ejecución se realiza mediante el comando `npm test`.

### Resumen de Suite de Pruebas (`app.test.js`):
- **Módulo Mesas:** 5 tests PASSED (Incluye AVL de capacidad y bloqueos de estado).
- **Módulo Meseros:** 6 tests PASSED (Incluye validación de DNI, Celular y Seguridad de Nombre).
- **Módulo Catálogo:** 6 tests PASSED (Incluye AVL de precios, longitud de descripción y borrado lógico).
- **Módulo Órdenes/Items:** 7 tests PASSED (Incluye validación de "Para Llevar", límites de cantidad y FSM).
- **Módulo Cobro:** 8 tests PASSED (Incluye validación de montos, vuelto y datos fiscales del cliente).

**Resultado Global:** `100% de éxito en los casos de prueba definidos en la matriz de caja negra.`

## 5. Conclusiones Técnicas

1.  **Persistencia:** El sistema garantiza la persistencia mediante `LocalStorage`, permitiendo cierres de sesión sin pérdida de datos.
2.  **Integridad de Datos:** La implementación de `parsePriceToCents` asegura que el sistema sea inmune a los errores de precisión de punto flotante en todas las transacciones.
3.  **Escalabilidad:** La arquitectura modular en `app.js` permite añadir nuevos tipos de órdenes (como `DELIVERY`) extendiendo los validadores y las constantes de negocio sin afectar el núcleo de la FSM.
4.  **UX/QA:** La inyección dinámica de errores en texto rojo bajo los inputs mejora la experiencia de usuario en comparación con los `alerts` tradicionales, cumpliendo con la estrategia de blindaje de triple capa.

## 6. Documentación de Prompts

Esta sección detalla la secuencia de ingeniería de prompts utilizada para la construcción del sistema, asegurando que cada etapa respete los criterios de integridad y robustez.

**PROMPT 1 — Cimientos y Gestión de Personal/Recursos**
- **Finalidad:** Establecer la base CRUD para Meseros y Mesas definiendo el stack tecnológico (HTML/JS/LocalStorage).
- **Razonamiento:** Se prioriza la definición de los recursos físicos y humanos antes de la lógica transaccional, integrando validaciones de entrada desde el primer momento.

**PROMPT 2 — Identidad Única y Gestión de Catálogo**
- **Finalidad:** Implementar la generación automática de IDs y el CRUD del catálogo de productos.
- **Razonamiento:** La automatización de identificadores internos elimina el error humano por duplicidad. Se introducen los estados de mesa (LIBRE, OCUPADA, DESHABILITADA) para el control de flujo.

**PROMPT 3 — Motor Transaccional y Reglas de Negocio**
- **Finalidad:** Desarrollar el sistema de órdenes (Mesa/Para Llevar) con lógica de FSM y cálculos monetarios.
- **Razonamiento:** Se implementa la atomicidad de las operaciones (ej. suma automática de `PACKAGING_FEE` y bloqueo de mesas). Se enfatiza el manejo de excepciones para evitar la caída del sistema ante datos corruptos.

**PROMPT 4 — Arquitectura de Interfaz y Dashboard Visual**
- **Finalidad:** Unificar la visualización operativa mediante un Dashboard interactivo basado en mockups.
- **Razonamiento:** La separación visual por estados de mesa y la disponibilidad inmediata de la carta en el lateral optimizan la velocidad de atención al cliente.

**PROMPT 5 — Consolidación Operativa y Despliegue**
- **Finalidad:** Finalizar los requerimientos de visualización (RF-12), generar el manual de usuario y preparar el despliegue en GitHub Pages.
- **Razonamiento:** Se asegura que la experiencia del usuario final esté alineada con el diseño técnico mediante documentación de flujo clara.

**PROMPT 6 — Ingeniería de Pruebas (Matriz de Caja Negra)**
- **Finalidad:** Diseñar de forma exhaustiva la matriz de casos de prueba basada en PE y AVL.
- **Razonamiento:** Antes de automatizar, se definen los límites críticos (fronteras) y las clases de equivalencia para cubrir todos los escenarios de riesgo identificados (ej. TC-ME-01 a TC-CO-05).

**PROMPT 7 — Automatización de QA con Jest**
- **Finalidad:** Configurar el entorno de pruebas automatizadas y traducir la matriz de casos a código ejecutable en `app.test.js`.
- **Razonamiento:** Se utiliza `describe()` para agrupar módulos y `expect()` para validar las aserciones de la matriz, garantizando que el sistema sea resistente a regresiones durante el mantenimiento futuro.